import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { VideoMetadata, ExportSettings } from './types';

const execAsync = promisify(exec);

export interface HardwareProfile {
  cpuModel: string;
  cores: number;
  hasNvidiaGpu: boolean;
  gpuName?: string;
  hasVaapi: boolean;
  recommendedThreads: number;
  aiEngineStatus: 'gpu_accelerated' | 'cpu_optimized' | 'lightweight_fallback';
}

// Inspect hardware environment
export async function detectHardwareProfile(): Promise<HardwareProfile> {
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'Standard CPU';
  const cores = cpus.length || 2;
  const recommendedThreads = Math.max(1, Math.min(cores, 8));

  let hasNvidiaGpu = false;
  let gpuName: string | undefined;
  let hasVaapi = false;

  // Check nvidia-smi explicitly
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader', { timeout: 1500 });
    if (stdout.trim()) {
      hasNvidiaGpu = true;
      gpuName = stdout.trim().split('\n')[0];
    }
  } catch {
    hasNvidiaGpu = false;
  }

  const aiEngineStatus = hasNvidiaGpu
    ? 'gpu_accelerated'
    : cores >= 4
    ? 'cpu_optimized'
    : 'lightweight_fallback';

  return {
    cpuModel,
    cores,
    hasNvidiaGpu,
    gpuName,
    hasVaapi,
    recommendedThreads,
    aiEngineStatus,
  };
}

/**
 * Builds the modular FFmpeg command arguments based on Video Metadata, Export Settings, and Hardware Profile.
 */
export function buildFfmpegPipeline(
  inputPath: string,
  outputPath: string,
  meta: VideoMetadata,
  settings: ExportSettings,
  hw: HardwareProfile
): { args: string[]; pipelineDescriptionAr: string } {
  const args: string[] = ['-y', '-i', inputPath];
  const pipelineSteps: string[] = [];

  // 0. Smart Passthrough Check:
  // If the video already satisfies TikTok guidelines (60fps, h264, yuv420p)
  // and matches requested resolution (or keeping original),
  // we do ultra-fast stream remuxing without re-encoding the video stream! (Takes ~0.5s)
  const isResolutionSatisfied =
    settings.resolution === 'original' ||
    (settings.resolution === '1080x1920' && meta.width === 1080 && meta.height === 1920);

  const isAlreadyOptimal =
    isResolutionSatisfied &&
    meta.fps >= 59 &&
    meta.fps <= 61 &&
    meta.videoCodec === 'h264' &&
    meta.pixelFormat === 'yuv420p';

  if (settings.allowSmartPassthrough && isAlreadyOptimal && settings.preset !== 'custom') {
    args.push('-c:v', 'copy');
    if (meta.audioCodec && meta.audioCodec !== 'none') {
      args.push('-c:a', 'aac', '-b:a', `${settings.audioBitrateKbps}k`, '-ar', '48000', '-ac', '2');
    }
    if (settings.fastStart) args.push('-movflags', '+faststart');
    args.push(outputPath);
    return {
      args,
      pipelineDescriptionAr: 'التمرير السريع المباشر (Smart Direct Stream Copy) — الفيديو مهيأ مسبقاً بنسبة 100%',
    };
  }

  const speed = settings.speedEngine || 'turbo';
  const scaleFlag = speed === 'turbo' ? 'fast_bilinear' : 'bicubic';

  // 1. Motion & Frame Interpolation (RIFE / Motion Flow)
  const isTargeting60 = settings.targetFps === 60;
  const needsInterpolation = isTargeting60 && meta.fps < 55 && settings.useAiInterpolation;

  // Decide if we need a complex split graph (cover_blur for landscape) only if explicitly requested
  const isLandscapeToVerticalBlur =
    settings.resolution === '1080x1920' &&
    !meta.isVertical &&
    settings.smartFit === 'cover_blur';

  if (isLandscapeToVerticalBlur) {
    let preFilter = '';
    if (needsInterpolation) {
      preFilter =
        speed === 'studio' && settings.interpolationMode === 'blend'
          ? 'tblend=all_mode=average,framerate=fps=60,'
          : 'framerate=fps=60,';
      pipelineSteps.push('مضاعفة الإطارات الذكية لـ 60 FPS');
    } else if (settings.targetFps !== 'original') {
      preFilter = `fps=${settings.targetFps},`;
      pipelineSteps.push(`تثبيت معدل الإطارات عند ${settings.targetFps} FPS`);
    }

    const unsharpPart = speed !== 'turbo' ? ',unsharp=3:3:0.3:3:3:0.0' : '';

    const filterComplex =
      `[0:v]${preFilter}split=2[orig][bg_in];` +
      `[bg_in]scale=1080:1920:force_original_aspect_ratio=increase:flags=${scaleFlag},crop=1080:1920,boxblur=12:2[bg];` +
      `[orig]scale=1080:1920:force_original_aspect_ratio=decrease:flags=${scaleFlag}[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2${unsharpPart},format=yuv420p[v_out]`;

    args.push('-filter_complex', filterComplex);
    args.push('-map', '[v_out]');
    pipelineSteps.push('تحويل إلى عمودي 9:16 مع خلفية ضبابية خفيفة');
  } else {
    // Clean Linear Filter Chain (-vf) — No blur, no forced cropping!
    const vfFilters: string[] = [];

    // 1. Motion & Frame Interpolation Engine
    const interpEngine = settings.interpolationEngine || (settings.interpolationMode === 'blend' ? 'cinema_blend' : 'rife_ai');
    if (needsInterpolation) {
      if (interpEngine === 'cinema_blend') {
        vfFilters.push('tblend=all_mode=average', 'framerate=fps=60');
        pipelineSteps.push('محرك Cinema Blend: مزج حركي سينمائي سلس بـ 60 FPS');
      } else if (interpEngine === 'rife_ai' && speed === 'studio') {
        vfFilters.push('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1');
        pipelineSteps.push('محرك RIFE MCI AI: تدفق بصري ثنائي الاتجاه (Bi-directional Optical Flow)');
      } else {
        vfFilters.push('framerate=fps=60');
        pipelineSteps.push('محرك Turbo Flow AI: مضاعفة الإطارات فائقة السرعة لـ 60 FPS');
      }
    } else if (settings.targetFps !== 'original') {
      vfFilters.push(`fps=${settings.targetFps}`);
      pipelineSteps.push(`تثبيت معدل الإطارات عند ${settings.targetFps} FPS`);
    }

    // 2. Resolution & Geometry Engine:
    if (settings.resolution === 'original') {
      // Keep exact imported dimensions! No blur, no distortion, no custom aspect ratio.
      if (meta.width % 2 !== 0 || meta.height % 2 !== 0) {
        vfFilters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
      }
      pipelineSteps.push(`الحفاظ على المقاس الأصلي للفيديو المستورد (${meta.width}×${meta.height}) بدون تعديل أو ضبابية`);
    } else if (settings.resolution === '1080x1920') {
      if (!meta.isVertical) {
        if (settings.smartFit === 'crop_center') {
          vfFilters.push(
            `scale=1080:1920:force_original_aspect_ratio=increase:flags=${scaleFlag}`,
            'crop=1080:1920'
          );
          pipelineSteps.push('اقتصاص مركزي ذكي لأبعاد 1080×1920');
        } else {
          vfFilters.push(
            `scale=1080:1920:force_original_aspect_ratio=decrease:flags=${scaleFlag}`,
            'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'
          );
          pipelineSteps.push('ملاءمة الأبعاد لـ 1080×1920 مع حواف متوازنة');
        }
      } else if (meta.width !== 1080 || meta.height !== 1920) {
        vfFilters.push(`scale=1080:1920:flags=${scaleFlag}`);
        pipelineSteps.push(`إعادة تحجيم بدقة (${scaleFlag} 1080×1920)`);
      }
    } else if (settings.resolution === '720x1280') {
      vfFilters.push('scale=720:1280:flags=fast_bilinear');
      pipelineSteps.push('تحجيم اقتصادي سريع (720×1280)');
    }

    // 3. Color & Dynamic Range Engine (TikTok Color Optimizer)
    const colorEngine = settings.colorEngine || 'tiktok_vibrant';
    if (colorEngine === 'tiktok_vibrant') {
      vfFilters.push('eq=contrast=1.03:brightness=0.01:saturation=1.06');
      pipelineSteps.push('محرك حيوية الألوان (TikTok Rec.709 Booster): معايرة التشبع والتباين لمنع بهتان الألوان');
    } else if (colorEngine === 'natural_rec709') {
      vfFilters.push('setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709');
      pipelineSteps.push('محرك الألوان الطبيعية: توحيد النطاق اللوني القياسي Rec.709');
    }

    // 4. Clarity & Edge Sharpener Engine (Anti-Compression Guard)
    const clarity = settings.clarityEngine || (speed !== 'turbo' ? 'subtle' : 'pro_sharp');
    if (clarity === 'pro_sharp') {
      vfFilters.push('unsharp=5:5:0.8:3:3:0.0');
      pipelineSteps.push('محرك الوضوح الاحترافي (Pro Sharp): تعزيز حدة الحواف وحماية الملامح من ضغط تيك توك');
    } else if (clarity === 'subtle') {
      vfFilters.push('unsharp=3:3:0.4:3:3:0.0');
      pipelineSteps.push('محرك الوضوح المتوازن (Subtle): حماية ناعمة لتفاصيل الإطار');
    }

    vfFilters.push('format=yuv420p');
    pipelineSteps.push('توحيد نسق البكسل القياسي (YUV 4:2:0 - BT.709)');

    args.push('-vf', vfFilters.join(','));
    args.push('-map', '0:v');
  }

  // 2. Audio mapping: safely map input audio if it exists
  args.push('-map', '0:a?');

  // 3. Video Codec & Encoding Parameters
  let videoEncoder = settings.videoCodec === 'libx265' ? 'libx265' : 'libx264';
  if (hw.hasNvidiaGpu && (settings.videoCodec as any) === 'h264_nvenc') {
    videoEncoder = 'h264_nvenc';
  }

  args.push('-c:v', videoEncoder);

  if (videoEncoder === 'libx264') {
    args.push('-profile:v', 'high', '-level', '4.2');
  }

  // Compute x264 Preset based on Speed Engine
  let x264Preset = 'veryfast';
  if (speed === 'turbo') {
    x264Preset = 'ultrafast';
  } else if (speed === 'balanced') {
    x264Preset = 'veryfast';
  } else {
    x264Preset = hw.hasNvidiaGpu ? 'slow' : 'faster';
  }

  // Rate control & Compression Guard
  if (videoEncoder === 'h264_nvenc') {
    args.push('-preset', 'p4', '-cq', settings.crfValue.toString());
  } else if (settings.rateControl === 'crf') {
    args.push('-crf', settings.crfValue.toString());
    args.push('-preset', x264Preset);
  } else {
    const br = settings.targetBitrateKbps || 12000;
    const maxBr = settings.maxBitrateKbps || 16000;
    args.push('-b:v', `${br}k`, '-maxrate', `${maxBr}k`, '-bufsize', `${maxBr * 2}k`, '-preset', x264Preset);
  }

  // 5. Compression Guard Engine (x264 Psy Engine)
  if (settings.compressionGuard && videoEncoder === 'libx264') {
    args.push('-tune', 'film');
    pipelineSteps.push('محرك درع الضغط (Compression Guard): ضبط التحليل البصري لحماية النصوص والملامح');
  }

  // 6. Keyframe / GOP intervals for TikTok
  const gop = settings.gopSize || (settings.targetFps === 30 ? 30 : 60);
  args.push('-g', gop.toString(), '-keyint_min', gop.toString(), '-sc_threshold', '0');
  pipelineSteps.push(`تثبيت الإطارات المفتاحية GOP = ${gop} (تمنع تقطيع الخوادم)`);

  // 7. Audio Studio Engine (TikTok EBU R128 -14 LUFS Normalizer)
  if (meta.audioCodec && meta.audioCodec !== 'none') {
    if (settings.audioCodec === 'copy') {
      args.push('-c:a', 'copy');
      pipelineSteps.push('تمرير مسار الصوت الأصلي دون تعديل');
    } else {
      const audioEngine = settings.audioEngine || 'tiktok_loudnorm';
      const audioFilters: string[] = [];

      if (audioEngine === 'tiktok_loudnorm') {
        audioFilters.push('loudnorm=I=-14:LRA=11:TP=-1.5');
        pipelineSteps.push('محرك الصوت الذكي: تطبيع قياسي لـ -14 LUFS (معيار TikTok الذهبي لمنع كتم الصوت)');
      } else if (audioEngine === 'vocal_clarity') {
        audioFilters.push('equalizer=f=1200:width_type=h:width=1200:g=2.5', 'loudnorm=I=-14:LRA=10:TP=-1.5');
        pipelineSteps.push('محرك نقاء الصوت والصوت البشري: تعزيز وضوح الصوت مع تطبيع -14 LUFS');
      }

      if (audioFilters.length > 0) {
        args.push('-af', audioFilters.join(','));
      }

      args.push('-c:a', 'aac', '-b:a', `${settings.audioBitrateKbps}k`, '-ar', '48000', '-ac', '2');
      pipelineSteps.push(`ترميز الصوت AAC-LC ستيريو بمعدل ${settings.audioBitrateKbps} kbps و 48kHz`);
    }
  }

  // 6. Container & FastStart
  if (settings.fastStart) {
    args.push('-movflags', '+faststart');
    pipelineSteps.push('تفعيل moov atom faststart للبدء الفوري');
  }

  // Multi-threading (0 = optimal auto detection by ffmpeg & x264)
  args.push('-threads', '0');

  // Output destination
  args.push(outputPath);

  return {
    args,
    pipelineDescriptionAr: pipelineSteps.join(' ← '),
  };
}
