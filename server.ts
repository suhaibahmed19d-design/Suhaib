import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { jobManager } from './server/job-manager';
import { redisQueue } from './server/redis-queue';
import { probeVideo } from './server/prober';
import { detectHardwareProfile } from './server/ai-pipeline';
import { ExportSettings } from './server/types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Setup Multer for secure video file handling
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, jobManager.getUploadsDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_');
    cb(null, `${safeBase}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300 MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const commonVideoExts = [
      '.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.3gp',
      '.flv', '.wmv', '.mts', '.m2ts', '.ts', '.mp4v'
    ];

    if (
      !file.mimetype ||
      file.mimetype.startsWith('video/') ||
      file.mimetype === 'application/octet-stream' ||
      commonVideoExts.includes(ext) ||
      !ext
    ) {
      cb(null, true);
    } else {
      cb(new Error(`صيغة الملف غير مدعومة (${ext || file.mimetype}). يرجى رفع ملف فيديو صالح.`));
    }
  },
});

// Memory storage for slice chunks (each chunk is ~8MB)
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB max per chunk
  },
});

// Rate limiting and security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// 1. Video Upload & Probe (Direct upload for smaller files)
app.post('/api/upload', upload.single('video'), async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم استلام أي ملف فيديو.' });
    }

    const filePath = req.file.path;
    const metadata = await probeVideo(filePath);

    return res.json({
      success: true,
      metadata,
      uploadedFile: {
        originalName: req.file.originalname,
        savedPath: filePath,
        size: req.file.size,
      },
    });
  } catch (error: any) {
    console.error('Upload & Probe Error:', error);
    return res.status(500).json({ error: error.message || 'فشل في تحليل مواصفات الفيديو.' });
  }
});

// 1.5. Chunked Video Upload & Assembly (Bypasses Cloud Run 32MB HTTP limit for large 94MB+ videos)
app.post('/api/upload/chunk', chunkUpload.single('chunk'), async (req: Request, res: Response): Promise<any> => {
  try {
    const { uploadId, chunkIndex, totalChunks, filename } = req.body;

    if (!req.file || !uploadId || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ error: 'بيانات قطعة الفيديو غير مكتملة.' });
    }

    const cIndex = parseInt(chunkIndex, 10);
    const tChunks = parseInt(totalChunks, 10);
    const safeUploadId = uploadId.replace(/[^a-zA-Z0-9_\-]/g, '');
    const tempPartPath = path.join(jobManager.getUploadsDir(), `chunk_${safeUploadId}.part`);

    // Append current chunk binary to the partial assembly file
    await fs.promises.appendFile(tempPartPath, req.file.buffer);

    // If this is the final chunk, assemble and probe the complete video
    if (cIndex === tChunks - 1) {
      const originalName = filename || 'video.mp4';
      const ext = path.extname(originalName) || '.mp4';
      const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_');
      const finalPath = path.join(jobManager.getUploadsDir(), `${safeBase}_${Date.now()}${ext}`);

      await fs.promises.rename(tempPartPath, finalPath);
      const metadata = await probeVideo(finalPath);
      const stat = await fs.promises.stat(finalPath);

      return res.json({
        success: true,
        done: true,
        metadata,
        uploadedFile: {
          originalName,
          savedPath: finalPath,
          size: stat.size,
        },
      });
    }

    return res.json({
      success: true,
      done: false,
      chunkIndex: cIndex,
    });
  } catch (error: any) {
    console.error('Chunk Assembly Error:', error);
    return res.status(500).json({ error: error.message || 'حدث خطأ أثناء استقبال وتجميع قطعة الفيديو.' });
  }
});

// 2. Sample Video Generator (Instant trial without needing local upload)
app.get('/api/sample-video', async (req: Request, res: Response): Promise<any> => {
  try {
    const samplePath = path.join(jobManager.getUploadsDir(), 'sample_tiktok_clip.mp4');

    // Create sample if not present
    if (!fs.existsSync(samplePath)) {
      // 30 FPS, 720x1280 (vertical), with moving visual countdown and sine audio
      const cmd = `ffmpeg -y -f lavfi -i testsrc=duration=4:size=720x1280:rate=30 -f lavfi -i sine=frequency=520:duration=4 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac "${samplePath}"`;
      await execAsync(cmd);
    }

    const metadata = await probeVideo(samplePath);
    return res.json({
      success: true,
      metadata,
      uploadedFile: {
        originalName: 'عينة_فيديو_تيك_توك.mp4',
        savedPath: samplePath,
        size: fs.statSync(samplePath).size,
      },
    });
  } catch (error: any) {
    console.error('Sample Video Generation Error:', error);
    return res.status(500).json({ error: 'تعذر إنشاء فيديو العينة' });
  }
});

// 3. Create Optimization Job
app.post('/api/jobs', async (req: Request, res: Response): Promise<any> => {
  try {
    const { filePath, originalName, settings } = req.body;

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'مسار الملف غير صالح أو تم حذفه.' });
    }

    const exportSettings: ExportSettings = {
      preset: settings?.preset || 'balanced',
      speedEngine: settings?.speedEngine || 'turbo',
      allowSmartPassthrough: settings?.allowSmartPassthrough ?? true,
      priority: settings?.priority || 'normal',
      resolution: settings?.resolution || 'original',
      targetFps: settings?.targetFps || 60,
      useAiInterpolation: settings?.useAiInterpolation ?? true,
      interpolationMode: settings?.interpolationMode || 'rife',
      interpolationEngine: settings?.interpolationEngine || 'rife_ai',
      clarityEngine: settings?.clarityEngine || 'pro_sharp',
      colorEngine: settings?.colorEngine || 'tiktok_vibrant',
      audioEngine: settings?.audioEngine || 'tiktok_loudnorm',
      compressionGuard: settings?.compressionGuard ?? true,
      videoCodec: settings?.videoCodec || 'libx264',
      rateControl: settings?.rateControl || 'crf',
      crfValue: settings?.crfValue ?? 19,
      targetBitrateKbps: settings?.targetBitrateKbps || 12000,
      maxBitrateKbps: settings?.maxBitrateKbps || 16000,
      gopSize: settings?.gopSize || 60,
      pixelFormat: settings?.pixelFormat || 'yuv420p',
      audioCodec: settings?.audioCodec || 'aac',
      audioBitrateKbps: settings?.audioBitrateKbps || 256,
      fastStart: settings?.fastStart ?? true,
      smartFit: settings?.smartFit || 'scale_exact',
    };

    const job = await jobManager.createJob(
      originalName || 'video.mp4',
      filePath,
      exportSettings,
      exportSettings.priority
    );

    return res.json({ success: true, job });
  } catch (error: any) {
    console.error('Job Creation Error:', error);
    return res.status(500).json({ error: error.message || 'تعذر بدء عملية تحسين الفيديو.' });
  }
});

// 4. Job List
app.get('/api/jobs', (req: Request, res: Response) => {
  res.json({ jobs: jobManager.getAllJobs() });
});

// 5. Single Job
app.get('/api/jobs/:id', (req: Request, res: Response): any => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'المهمة غير موجودة' });
  }
  return res.json({ job });
});

// 6. SSE Stream for Live Real-Time Progress
app.get('/api/jobs/:id/stream', (req: Request, res: Response): any => {
  const jobId = req.params.id;
  const job = jobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'المهمة غير موجودة' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current state immediately
  res.write(`data: ${JSON.stringify(job)}\n\n`);

  const onProgress = (updatedJob: any) => {
    if (updatedJob.id === jobId) {
      res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);
      if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
        res.end();
      }
    }
  };

  jobManager.on('progress', onProgress);

  req.on('close', () => {
    jobManager.off('progress', onProgress);
  });
});

// 7. Video Download
app.get('/api/jobs/:id/download', (req: Request, res: Response): any => {
  const job = jobManager.getJob(req.params.id);
  if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: 'الملف الناتج غير متوفر أو تم حذفه.' });
  }

  const filename = `saf_tiktok_${path.basename(job.originalName, path.extname(job.originalName))}.mp4`;
  res.download(job.outputPath, filename);
});

// 8. Video Stream / Preview (Range support for HTML5 video player)
app.get('/api/jobs/:id/preview', (req: Request, res: Response): any => {
  const job = jobManager.getJob(req.params.id);
  const type = req.query.type === 'original' ? 'input' : 'output';
  const targetPath = type === 'input' ? job?.inputPath : job?.outputPath;

  if (!job || !targetPath || !fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'الملف غير موجود للمعاينة' });
  }

  const stat = fs.statSync(targetPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(targetPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(targetPath).pipe(res);
  }
});

// 9. Delete Job
app.delete('/api/jobs/:id', async (req: Request, res: Response): Promise<any> => {
  const success = await jobManager.deleteJob(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'المهمة غير موجودة' });
  }
  return res.json({ success: true });
});

// 9.1. Queue Stats & Redis Status
app.get('/api/queue/stats', (req: Request, res: Response) => {
  return res.json({ stats: jobManager.getQueueStats() });
});

// 9.2. Reprioritize Job in Queue (Dynamic Priority Promotion)
app.post('/api/jobs/:id/priority', async (req: Request, res: Response): Promise<any> => {
  const { priority } = req.body;
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'المهمة غير موجودة' });
  }
  if (['high', 'normal', 'low'].includes(priority)) {
    job.priority = priority;
    job.settings.priority = priority;
    await redisQueue.enqueue(job);
    jobManager.triggerQueueProcessor();
    return res.json({ success: true, job });
  }
  return res.status(400).json({ error: 'مستوى أولوية غير صالح. القيم المتاحة: high, normal, low' });
});

// 9.3. Auto-Resume Trigger (Crash / Restart Recovery)
app.post('/api/queue/auto-resume', (req: Request, res: Response) => {
  const count = redisQueue.performAutoResume();
  jobManager.triggerQueueProcessor();
  return res.json({ success: true, resumedCount: count });
});

// 10. Hardware and System Information Probe
app.get('/api/system-info', async (req: Request, res: Response): Promise<any> => {
  try {
    const hw = await detectHardwareProfile();
    const os = await import('os');
    const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMb = Math.round(os.freemem() / (1024 * 1024));

    let ffmpegVersion = '4.4.2';
    try {
      const { stdout } = await execAsync('ffmpeg -version | head -n 1');
      ffmpegVersion = stdout.trim().split(' ')[2] || '4.4.2';
    } catch {
      // ignore
    }

    const jobs = jobManager.getAllJobs();
    const activeProcessingJobs = jobs.filter((j) => j.status === 'processing').length;

    return res.json({
      cpuModel: hw.cpuModel,
      cpuCores: hw.cores,
      totalMemMb,
      freeMemMb,
      gpuAvailable: hw.hasNvidiaGpu,
      gpuName: hw.gpuName,
      ffmpegVersion,
      supportedEncoders: ['libx264 (H.264 High)', 'libx265 (HEVC)', 'aac', 'minterpolate (MCI / Optical Flow)'],
      hasRifeEngine: true,
      activeProcessingJobs,
      aiEngineStatus: hw.aiEngineStatus,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 11. Storage Cleanup
app.post('/api/cleanup', (req: Request, res: Response) => {
  const jobs = jobManager.getAllJobs();
  let deletedCount = 0;
  for (const job of jobs) {
    if (job.status === 'completed' || job.status === 'failed') {
      jobManager.deleteJob(job.id);
      deletedCount++;
    }
  }
  res.json({ success: true, deletedCount });
});

// 12. Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 13. API 404 Handler (Guarantees JSON response instead of HTML for missing API routes)
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `المسار ${req.method} ${req.path} غير موجود.` });
});

// 14. Express API Error Handler (Guarantees JSON response for Multer, body-parser, or unhandled errors)
app.use((err: any, req: Request, res: Response, next: NextFunction): any => {
  console.error('Express Error Handler:', err);
  if (req.path.startsWith('/api')) {
    const status = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'حجم الفيديو يتجاوز الحد الأقصى المسموح به (300 ميجابايت).'
        : (err.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب.');
    return res.status(status).json({ error: message, code: err.code });
  }
  next(err);
});

// Serve Frontend Vite Middlewares in Dev or Dist in Prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[صــف] Server running on http://0.0.0.0:${PORT}`);
  });
  // 10 minutes timeout for large video uploads (94MB+)
  server.timeout = 10 * 60 * 1000;
  server.keepAliveTimeout = 65 * 1000;
  server.headersTimeout = 66 * 1000;
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
