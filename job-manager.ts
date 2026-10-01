import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { VideoJob, JobProgress, JobPhase, ExportSettings, VideoMetadata, JobPriority } from './types';
import { probeVideo } from './prober';
import { detectHardwareProfile, buildFfmpegPipeline } from './ai-pipeline';
import { redisQueue } from './redis-queue';

class JobManager extends EventEmitter {
  private storageDir: string;
  private uploadsDir: string;
  private outputsDir: string;
  private activeJobsCount = 0;
  private maxConcurrency = 2;
  private isProcessingQueue = false;

  constructor() {
    super();
    this.storageDir = path.join('/tmp', 'saf_storage');
    this.uploadsDir = path.join(this.storageDir, 'uploads');
    this.outputsDir = path.join(this.storageDir, 'outputs');

    fs.mkdirSync(this.uploadsDir, { recursive: true });
    fs.mkdirSync(this.outputsDir, { recursive: true });

    // Listen to queue events
    redisQueue.on('progress', (job: VideoJob) => {
      this.emit('progress', job);
    });

    redisQueue.on('autoResumed', (count: number) => {
      console.log(`[صــف JobManager] Auto-resumed ${count} interrupted jobs from queue.`);
      this.triggerQueueProcessor();
    });

    // Initial trigger for resumed jobs
    setTimeout(() => {
      this.triggerQueueProcessor();
    }, 1000);

    // Periodic queue check & cleanup of temp files older than 2 hours
    setInterval(() => {
      this.triggerQueueProcessor();
      this.cleanupOldFiles();
    }, 10000);
  }

  public getUploadsDir(): string {
    return this.uploadsDir;
  }

  public getOutputsDir(): string {
    return this.outputsDir;
  }

  public getAllJobs(): VideoJob[] {
    return redisQueue.getAllJobs();
  }

  public getJob(id: string): VideoJob | undefined {
    return redisQueue.getJob(id);
  }

  public getQueueStats() {
    return redisQueue.getStats();
  }

  public async createJob(
    originalName: string,
    inputPath: string,
    settings: ExportSettings,
    priority: JobPriority = 'normal'
  ): Promise<VideoJob> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const outputFilename = `saf_tiktok_${id}.mp4`;
    const outputPath = path.join(this.outputsDir, outputFilename);

    // Initial Probe
    const originalMetadata = await probeVideo(inputPath);

    const initialProgress: JobProgress = {
      phase: 'analyzing',
      phaseLabelAr: 'تحليل الفيديو',
      percent: 5,
      elapsedSeconds: 0,
      logMessage: 'جاري تسجيل المهمة في طابور الأولويات...',
    };

    const jobPriority = settings.priority || priority || 'normal';

    const job: VideoJob = {
      id,
      createdAt: Date.now(),
      originalName,
      inputPath,
      outputPath,
      originalMetadata,
      settings: {
        ...settings,
        priority: jobPriority,
      },
      status: 'queued',
      progress: initialProgress,
      priority: jobPriority,
      retryCount: 0,
      maxRetries: 3,
    };

    await redisQueue.enqueue(job);
    this.emit('jobCreated', job);

    // Trigger queue worker
    this.triggerQueueProcessor();

    return job;
  }

  /**
   * Continuous Priority Worker Loop.
   * Pulls the next available job with highest priority score.
   */
  public async triggerQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.activeJobsCount < this.maxConcurrency) {
        const nextJob = await redisQueue.dequeue();
        if (!nextJob) break;

        this.activeJobsCount++;
        this.runJob(nextJob)
          .catch((err) => {
            console.error(`Error executing job ${nextJob.id}:`, err);
            nextJob.status = 'failed';
            nextJob.error = err.message || 'حدث خطأ أثناء معالجة الفيديو';
            nextJob.progress.phase = 'failed';
            nextJob.progress.phaseLabelAr = 'فشل المعالجة';
            redisQueue.updateJob(nextJob);
            this.emit('progress', nextJob);
          })
          .finally(() => {
            this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
            this.triggerQueueProcessor();
          });
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async runJob(job: VideoJob): Promise<void> {
    job.status = 'processing';
    await redisQueue.updateJob(job);
    this.emit('progress', job);

    const startTime = Date.now();
    const hw = await detectHardwareProfile();

    // 1. Phase: Preparing Frames
    job.progress = {
      phase: 'preparing_frames',
      phaseLabelAr: job.resumedFromCrash ? 'استئناف المعالجة' : 'تجهيز الإطارات',
      percent: 15,
      elapsedSeconds: 0,
      logMessage: job.resumedFromCrash
        ? `جاري استئناف المعالجة تلقائيًا بأولوية ${job.priority === 'high' ? 'عالية' : 'قصوى'}...`
        : 'تجهيز مسارات المعالجة وتقسيم الإطارات...',
    };
    await redisQueue.updateJob(job);
    this.emit('progress', job);

    // Build FFmpeg command
    const { args } = buildFfmpegPipeline(
      job.inputPath,
      job.outputPath!,
      job.originalMetadata,
      job.settings,
      hw
    );

    // Add progress reporting argument
    const ffmpegArgs = ['-progress', 'pipe:1', ...args];
    const totalDuration = job.originalMetadata.duration || 5;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', ffmpegArgs);
      let buffer = '';
      let lastCheckpointTime = Date.now();

      proc.stdout.on('data', async (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const [key, value] = line.trim().split('=');
          if (!key || !value) continue;

          if (key === 'out_time_ms') {
            const outTimeMs = parseInt(value, 10);
            const currentTimeSec = outTimeMs / 1000000;
            const progressRatio = Math.min(0.98, Math.max(0.05, currentTimeSec / totalDuration));
            const percent = Math.round(progressRatio * 100);
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            // Determine Phase accurately
            let phase: JobPhase = 'processing_video';
            let phaseLabelAr = 'معالجة الفيديو';

            if (percent < 25) {
              phase = 'preparing_frames';
              phaseLabelAr = 'تجهيز الإطارات';
            } else if (percent < 55) {
              phase = job.settings.useAiInterpolation ? 'enhancing_motion' : 'processing_video';
              phaseLabelAr = job.settings.useAiInterpolation ? 'تحسين الحركة ومضاعفة الإطارات AI' : 'معالجة الفيديو';
            } else if (percent < 85) {
              phase = 'processing_video';
              phaseLabelAr = 'معالجة الأبعاد والألوان لـ TikTok';
            } else {
              phase = 'encoding_output';
              phaseLabelAr = 'ترميز الملف النهائي';
            }

            job.progress = {
              ...job.progress,
              phase,
              phaseLabelAr,
              percent,
              elapsedSeconds: elapsed,
            };

            this.emit('progress', job);

            // Periodic persistence checkpoint every 3 seconds
            if (Date.now() - lastCheckpointTime > 3000) {
              lastCheckpointTime = Date.now();
              redisQueue.updateJob(job);
            }
          } else if (key === 'fps') {
            job.progress.fps = parseFloat(value) || job.progress.fps;
          } else if (key === 'frame') {
            job.progress.currentFrame = parseInt(value, 10) || job.progress.currentFrame;
          } else if (key === 'speed') {
            job.progress.speed = value;
          }
        }
      });

      let stderrOutput = '';
      proc.stderr.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      proc.on('close', async (code) => {
        if (code === 0) {
          try {
            // Verify output exists
            if (fs.existsSync(job.outputPath!)) {
              job.outputMetadata = await probeVideo(job.outputPath!);
            }
            job.status = 'completed';
            job.completedAt = Date.now();
            job.progress = {
              phase: 'completed',
              phaseLabelAr: 'اكتملت المعالجة بنجاح',
              percent: 100,
              elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
              logMessage: 'تم تجهيز الفيديو بكامل معايير TikTok القياسية',
            };
            await redisQueue.updateJob(job);
            this.emit('progress', job);
            resolve();
          } catch (err: any) {
            reject(new Error(`فشل تحليل الملف الناتج: ${err.message}`));
          }
        } else {
          console.error('FFmpeg error output:', stderrOutput);
          const errorLines = stderrOutput
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .filter((l) => !l.includes('vendor_id') && !l.includes('handler_name') && !l.includes('Metadata:'));
          const relevantError = errorLines.slice(-4).join(' | ') || stderrOutput.slice(-300);
          reject(new Error(`فشل FFmpeg برمز خروج ${code}: ${relevantError}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async deleteJob(id: string): Promise<boolean> {
    const job = redisQueue.getJob(id);
    if (!job) return false;

    // Delete files
    try {
      if (job.inputPath && fs.existsSync(job.inputPath)) {
        fs.unlinkSync(job.inputPath);
      }
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        fs.unlinkSync(job.outputPath);
      }
    } catch (e) {
      console.error('Error removing job files:', e);
    }

    await redisQueue.deleteJob(id);
    this.emit('jobDeleted', id);
    return true;
  }

  private async cleanupOldFiles(): Promise<void> {
    const maxAgeMs = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();

    for (const job of redisQueue.getAllJobs()) {
      if (job.status === 'completed' || job.status === 'failed') {
        if (now - job.createdAt > maxAgeMs) {
          await this.deleteJob(job.id);
        }
      }
    }
  }
}

export const jobManager = new JobManager();
