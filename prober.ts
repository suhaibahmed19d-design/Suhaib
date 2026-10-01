import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { VideoMetadata } from './types';

const execFileAsync = promisify(execFile);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

function parseFraction(fractionStr?: string): number {
  if (!fractionStr) return 0;
  const parts = fractionStr.split('/');
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    return den !== 0 ? Math.round((num / den) * 100) / 100 : 0;
  }
  return parseFloat(fractionStr) || 0;
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`الملف غير موجود في المسار: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  // 1. Run main ffprobe command
  const probeArgs = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  const { stdout } = await execFileAsync('ffprobe', probeArgs);
  const probeData = JSON.parse(stdout);

  const videoStream = probeData.streams?.find((s: any) => s.codec_type === 'video');
  const audioStream = probeData.streams?.find((s: any) => s.codec_type === 'audio');

  if (!videoStream) {
    throw new Error('لم يتم العثور على مسار فيديو صالح في الملف المرفوع.');
  }

  const width = parseInt(videoStream.width || 0, 10);
  const height = parseInt(videoStream.height || 0, 10);
  const duration = parseFloat(videoStream.duration || probeData.format?.duration || 0);

  // Compute FPS
  let fps = parseFraction(videoStream.r_frame_rate) || parseFraction(videoStream.avg_frame_rate) || 30;
  if (fps > 120 || fps <= 0) fps = 30;

  const videoCodec = (videoStream.codec_name || 'unknown').toLowerCase();
  const videoCodecLong = videoStream.codec_long_name || videoCodec;
  const audioCodec = (audioStream?.codec_name || 'none').toLowerCase();
  const audioCodecLong = audioStream?.codec_long_name;

  const videoBitrate = Math.round(
    parseInt(videoStream.bit_rate || probeData.format?.bit_rate || '0', 10) / 1000
  );
  const audioBitrate = audioStream?.bit_rate
    ? Math.round(parseInt(audioStream.bit_rate, 10) / 1000)
    : undefined;

  const pixelFormat = videoStream.pix_fmt || 'unknown';
  const colorSpace = videoStream.color_space || videoStream.color_primaries;
  const colorRange = videoStream.color_range;

  // Aspect ratio calculation
  const isVertical = height > width;
  let displayAspectRatio = '9:16';
  if (width && height) {
    const gcdVal = (a: number, b: number): number => (b === 0 ? a : gcdVal(b, a % b));
    const divisor = gcdVal(width, height);
    displayAspectRatio = `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
  }

  // 2. Measure GOP / keyframes sampling the first 4 seconds
  let gopSize = 60;
  let keyframeInterval = '~2.0 ثوانٍ';
  try {
    const keyframeArgs = [
      '-select_streams', 'v',
      '-show_frames',
      '-show_entries', 'frame=key_frame,pkt_pts_time,pict_type',
      '-read_intervals', '%+4',
      '-of', 'json',
      filePath,
    ];
    const { stdout: kfStdout } = await execFileAsync('ffprobe', keyframeArgs);
    const kfData = JSON.parse(kfStdout);
    const frames = kfData.frames || [];
    const iFrames = frames.filter((f: any) => f.key_frame === 1 || f.pict_type === 'I');
    if (iFrames.length >= 2) {
      const firstI = frames.indexOf(iFrames[0]);
      const secondI = frames.indexOf(iFrames[1]);
      if (secondI > firstI) {
        gopSize = secondI - firstI;
        const timeDiff = parseFloat(iFrames[1].pkt_pts_time) - parseFloat(iFrames[0].pkt_pts_time);
        keyframeInterval = `${timeDiff.toFixed(1)} ثانية (كل ${gopSize} إطار)`;
      }
    } else if (frames.length > 0) {
      gopSize = frames.length;
      keyframeInterval = `ثابت (> ${frames.length} إطار)`;
    }
  } catch (err) {
    // GOP sampling non-fatal fallback
    gopSize = Math.round(fps * 2);
    keyframeInterval = `تقريبي: ${gopSize} إطار`;
  }

  // TikTok Compliance Analysis
  const resolutionOk = width === 1080 && height === 1920;
  const fpsOk = fps >= 59 && fps <= 61;
  const codecOk = videoCodec === 'h264';
  const pixelFormatOk = pixelFormat === 'yuv420p';
  const gopOk = gopSize >= 30 && gopSize <= 120;
  const bitrateOk = videoBitrate >= 5000 && videoBitrate <= 25000;

  // Calculate compatibility score
  let score = 100;
  if (!resolutionOk) score -= 25;
  if (!fpsOk) score -= 20;
  if (!codecOk) score -= 20;
  if (!pixelFormatOk) score -= 15;
  if (!gopOk) score -= 10;
  if (!bitrateOk && (videoBitrate > 40000 || videoBitrate < 2000)) score -= 10;
  score = Math.max(25, Math.min(100, score));

  // Determine technical recommendation
  let recommendationTitle = 'الفيديو مناسب للتصدير مع تحسين طفيف لـ TikTok';
  let recommendationDetail =
    'أبعاد الفيديو ومعدل الإطارات متوافقان جيدًا. ننصح بتطبيق ترميز H.264 High مع تثبيت مسافة GOP لضمان عدم حدوث تشوه عند رفع الفيديو.';
  let actionNeeded: VideoMetadata['tiktokCompliance']['actionNeeded'] = 'ready';

  if (!resolutionOk && !isVertical) {
    recommendationTitle = 'أبعاد الفيديو أفقية — تتطلب تهيئة عمودية لـ TikTok (9:16)';
    recommendationDetail = `الفيديو بدقة ${width}×${height} بأبعاد أفقية. يعرض تيك توك الفيديوهات بدقة 1080×1920 عمودية، وإلا سيتم اقتصاصه أو إضافة حواف سوداء عريضة.`;
    actionNeeded = 'needs_cropping';
  } else if (!fpsOk && fps <= 35) {
    recommendationTitle = 'ننصح بتحويل الفيديو إلى 60 FPS عبر مضاعفة الإطارات AI';
    recommendationDetail = `الفيديو يعمل بمعدل ${fps} FPS. تحويله إلى 60 FPS باستخدام خوارزمية Motion Flow / RIFE يمنح الفيديو سلاسة فائقة تحاكي تصوير الهواتف الاحترافية وتمنع التقطيع في خوارزمية TikTok.`;
    actionNeeded = 'needs_fps';
  } else if (!codecOk || !pixelFormatOk) {
    recommendationTitle = 'ننصح بتحسين الترميز وتوحيد نسق البكسل قبل التصدير';
    recommendationDetail = `الفيديو مشفر بترميز ${videoCodec.toUpperCase()} بنسق بكسل ${pixelFormat}. خوادم تيك توك تعيد ضغط هذا الترميز بعنف شديد؛ تحويله إلى H.264 High بنسق yuv420p القياسي يحمي تدرجات الألوان.`;
    actionNeeded = 'needs_reencode';
  } else if (!gopOk) {
    recommendationTitle = 'ننصح بتثبيت مسافة الإطارات المفتاحية (GOP)';
    recommendationDetail = `فترات الإطارات المفتاحية (${keyframeInterval}) غير منتظمة، مما قد يسبب تشوشًا في اللقطات السريعة أثناء معالجة تيك توك الداخلية.`;
    actionNeeded = 'needs_gop_fix';
  } else if (score >= 90) {
    recommendationTitle = 'الفيديو مطابق للمواصفات القياسية المثالية لـ TikTok';
    recommendationDetail =
      'الأبعاد 1080×1920 بمعدل إطارات سلس وترميز متوافق تمامًا. يمكنك استخدام وضع "جودة متوازنة" للتصدير النهائي السريع.';
    actionNeeded = 'ready';
  }

  return {
    filename: path.basename(filePath),
    filePath,
    fileSize,
    fileSizeFormatted: formatBytes(fileSize),
    duration,
    durationFormatted: formatDuration(duration),
    width,
    height,
    aspectRatio: displayAspectRatio,
    displayAspectRatio,
    fps,
    videoCodec,
    videoCodecLong,
    videoBitrate,
    audioCodec,
    audioCodecLong,
    audioBitrate,
    audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined,
    audioChannels: audioStream?.channels,
    pixelFormat,
    colorSpace,
    colorRange,
    gopSize,
    keyframeInterval,
    isVertical,
    tiktokCompliance: {
      resolutionOk,
      fpsOk,
      codecOk,
      pixelFormatOk,
      gopOk,
      bitrateOk,
      score,
      recommendationTitle,
      recommendationDetail,
      actionNeeded,
    },
  };
}
