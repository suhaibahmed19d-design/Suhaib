import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { VideoJob, JobPriority } from './types';

export interface QueueStats {
  engineType: 'redis' | 'disk_backed_emulator';
  isConnected: boolean;
  totalJobs: number;
  queuedJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  highPriorityCount: number;
  normalPriorityCount: number;
  lowPriorityCount: number;
  resumedJobsCount: number;
}

const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

export class RedisPriorityQueue extends EventEmitter {
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private memoryJobs: Map<string, VideoJob> = new Map();
  private priorityList: string[] = []; // Sorted job IDs
  private stateFilePath: string;
  private storageDir: string;
  private isProcessing = false;
  private concurrency = 2;
  private activeCount = 0;

  constructor() {
    super();
    this.storageDir = path.join('/tmp', 'saf_storage');
    this.stateFilePath = path.join(this.storageDir, 'jobs_queue_state.json');

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this.initRedis();
  }

  private initRedis() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Fallback to resilient in-memory disk-backed queue
          }
          return Math.min(times * 500, 2000);
        },
        lazyConnect: true,
      });

      this.redis.connect()
        .then(() => {
          this.isRedisConnected = true;
          console.log('[صــف] Redis Priority Queue Connected Successfully.');
          this.syncFromRedis();
        })
        .catch(() => {
          this.isRedisConnected = false;
          console.log('[صــف] Redis not detected on host. Activated Disk-Backed Priority Queue Engine with Auto-Resume.');
          this.loadStateFromDisk();
        });

      this.redis.on('error', () => {
        if (this.isRedisConnected) {
          this.isRedisConnected = false;
          console.log('[صــف] Redis disconnected, switching to disk-backed queue mode.');
        }
      });
    } catch {
      this.isRedisConnected = false;
      this.loadStateFromDisk();
    }
  }

  /**
   * Calculate priority score for Redis ZSET.
   * Higher score = higher priority in queue.
   * Format: (Weight * 10^13) + (10^13 - timestamp) so within same priority, FIFO applies.
   */
  public calculateScore(priority: JobPriority, isResumed = false): number {
    const baseWeight = PRIORITY_WEIGHTS[priority] || 2;
    const resumeBonus = isResumed ? 5 : 0;
    const finalWeight = baseWeight + resumeBonus;
    // Tie-break with inverted timestamp
    const now = Date.now();
    return finalWeight * 10000000000000 + (10000000000000 - now);
  }

  /**
   * Enqueue a new or resumed job with priority.
   */
  public async enqueue(job: VideoJob): Promise<void> {
    const priority = job.priority || 'normal';
    const score = this.calculateScore(priority, job.resumedFromCrash);
    job.priorityScore = score;

    this.memoryJobs.set(job.id, job);

    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.set(`saf:jobs:${job.id}`, JSON.stringify(job));
        if (job.status === 'queued') {
          await this.redis.zadd('saf:queue:priority_zset', score, job.id);
        }
      } catch (err) {
        console.error('Redis enqueue error:', err);
      }
    }

    this.rebuildPriorityList();
    this.saveStateToDisk();
    this.emit('jobEnqueued', job);
  }

  /**
   * Dequeue the highest priority job available.
   */
  public async dequeue(): Promise<VideoJob | null> {
    if (this.isRedisConnected && this.redis) {
      try {
        // ZPOPMIN or ZPOPMAX: highest score is highest priority
        const result = await this.redis.zpopmax('saf:queue:priority_zset', 1);
        if (result && result.length >= 2) {
          const jobId = result[0];
          const raw = await this.redis.get(`saf:jobs:${jobId}`);
          if (raw) {
            const job: VideoJob = JSON.parse(raw);
            return job;
          }
        }
      } catch (e) {
        console.error('Redis dequeue error:', e);
      }
    }

    // Memory / Disk queue fallback
    this.rebuildPriorityList();
    for (const jobId of this.priorityList) {
      const job = this.memoryJobs.get(jobId);
      if (job && (job.status === 'queued' || job.status === 'resuming')) {
        return job;
      }
    }

    return null;
  }

  /**
   * Update and persist job state in Redis and on disk.
   */
  public async updateJob(job: VideoJob): Promise<void> {
    this.memoryJobs.set(job.id, job);

    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.set(`saf:jobs:${job.id}`, JSON.stringify(job));
        if (job.status === 'completed' || job.status === 'failed') {
          await this.redis.zrem('saf:queue:priority_zset', job.id);
          await this.redis.sadd('saf:queue:finished', job.id);
        }
      } catch (e) {
        console.error('Redis updateJob error:', e);
      }
    }

    this.saveStateToDisk();
    this.emit('jobUpdated', job);
  }

  public getJob(id: string): VideoJob | undefined {
    return this.memoryJobs.get(id);
  }

  public getAllJobs(): VideoJob[] {
    return Array.from(this.memoryJobs.values()).sort((a, b) => {
      // Sort: active/queued first with priority, then completed by time
      if (a.status === 'processing' && b.status !== 'processing') return -1;
      if (b.status === 'processing' && a.status !== 'processing') return 1;
      if (a.status === 'queued' && b.status === 'queued') {
        const scoreA = a.priorityScore || this.calculateScore(a.priority || 'normal', a.resumedFromCrash);
        const scoreB = b.priorityScore || this.calculateScore(b.priority || 'normal', b.resumedFromCrash);
        return scoreB - scoreA;
      }
      return b.createdAt - a.createdAt;
    });
  }

  public async deleteJob(id: string): Promise<boolean> {
    const job = this.memoryJobs.get(id);
    if (!job) return false;

    this.memoryJobs.delete(id);
    this.priorityList = this.priorityList.filter((jId) => jId !== id);

    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.del(`saf:jobs:${id}`);
        await this.redis.zrem('saf:queue:priority_zset', id);
        await this.redis.srem('saf:queue:finished', id);
      } catch (e) {
        console.error('Redis delete error:', e);
      }
    }

    this.saveStateToDisk();
    this.emit('jobDeleted', id);
    return true;
  }

  /**
   * Sort the in-memory queue by priority score (High -> Normal -> Low, FIFO within tier).
   */
  private rebuildPriorityList(): void {
    const queued = Array.from(this.memoryJobs.values()).filter(
      (j) => j.status === 'queued' || j.status === 'resuming'
    );

    queued.sort((a, b) => {
      const scoreA = a.priorityScore || this.calculateScore(a.priority || 'normal', a.resumedFromCrash);
      const scoreB = b.priorityScore || this.calculateScore(b.priority || 'normal', b.resumedFromCrash);
      return scoreB - scoreA;
    });

    this.priorityList = queued.map((j) => j.id);
  }

  /**
   * Auto-Resume Engine:
   * Scans existing jobs from Redis or disk state.
   * If any job was interrupted (was 'processing' when server died),
   * it resets it to 'queued' with high priority boost for immediate resumption.
   */
  public performAutoResume(): number {
    let resumedCount = 0;
    const now = Date.now();

    for (const [id, job] of this.memoryJobs.entries()) {
      if (job.status === 'processing' || (job.status === 'queued' && !job.completedAt)) {
        // Verify input file still exists on disk
        if (job.inputPath && fs.existsSync(job.inputPath)) {
          job.status = 'queued';
          job.resumedFromCrash = true;
          job.resumedAt = now;
          job.retryCount = (job.retryCount || 0) + 1;
          job.progress = {
            ...job.progress,
            phase: 'preparing_frames',
            phaseLabelAr: 'استئناف المعالجة تلقائياً',
            logMessage: `تم استئناف المهمة تلقائيًا بعد إعادة تشغيل الخادم (المحاولة ${job.retryCount})`,
          };

          // Give resumed jobs highest priority boost
          job.priorityScore = this.calculateScore(job.priority || 'high', true);
          this.memoryJobs.set(id, job);
          resumedCount++;
          console.log(`[صــف Auto-Resume] Resumed interrupted job ${id} (file: ${job.originalName})`);
        } else {
          // File was deleted while server was down
          job.status = 'failed';
          job.error = 'تعذر استئناف المعالجة: ملف المصدر لم يعد متاحاً على القرص.';
          job.progress.phase = 'failed';
          job.progress.phaseLabelAr = 'فشل الاستئناف';
          this.memoryJobs.set(id, job);
        }
      }
    }

    if (resumedCount > 0) {
      this.rebuildPriorityList();
      this.saveStateToDisk();
      this.emit('autoResumed', resumedCount);
    }

    return resumedCount;
  }

  private saveStateToDisk(): void {
    try {
      const data = {
        savedAt: Date.now(),
        jobs: Array.from(this.memoryJobs.entries()),
      };
      fs.writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing jobs_queue_state.json:', e);
    }
  }

  private loadStateFromDisk(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.jobs)) {
          this.memoryJobs = new Map(parsed.jobs);
          console.log(`[صــف] Loaded ${this.memoryJobs.size} jobs from disk persistence.`);
        }
      }
    } catch (e) {
      console.error('Error reading jobs_queue_state.json:', e);
    }

    // Trigger auto-resume on loaded jobs
    this.performAutoResume();
  }

  private async syncFromRedis(): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys('saf:jobs:*');
      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (raw) {
          const job: VideoJob = JSON.parse(raw);
          this.memoryJobs.set(job.id, job);
        }
      }
      this.performAutoResume();
    } catch (e) {
      console.error('Error syncing from Redis:', e);
      this.loadStateFromDisk();
    }
  }

  public getStats(): QueueStats {
    const all = Array.from(this.memoryJobs.values());
    return {
      engineType: this.isRedisConnected ? 'redis' : 'disk_backed_emulator',
      isConnected: this.isRedisConnected,
      totalJobs: all.length,
      queuedJobs: all.filter((j) => j.status === 'queued').length,
      activeJobs: all.filter((j) => j.status === 'processing').length,
      completedJobs: all.filter((j) => j.status === 'completed').length,
      failedJobs: all.filter((j) => j.status === 'failed').length,
      highPriorityCount: all.filter((j) => j.priority === 'high').length,
      normalPriorityCount: all.filter((j) => j.priority === 'normal' || !j.priority).length,
      lowPriorityCount: all.filter((j) => j.priority === 'low').length,
      resumedJobsCount: all.filter((j) => j.resumedFromCrash).length,
    };
  }
}

export const redisQueue = new RedisPriorityQueue();
