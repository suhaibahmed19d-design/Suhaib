export interface VideoMetadata {
  filename: string;
  filePath: string;
  fileSize: number;
  fileSizeFormatted: string;
  duration: number;
  durationFormatted: string;
  width: number;
  height: number;
  aspectRatio: string;
  displayAspectRatio: string;
  fps: number;
  videoCodec: string;
  videoCodecLong: string;
  videoBitrate: number; // kbps
  audioCodec: string;
  audioCodecLong?: string;
  audioBitrate?: number; // kbps
  audioSampleRate?: number;
  audioChannels?: number;
  pixelFormat: string;
  colorSpace?: string;
  colorRange?: string;
  gopSize?: number;
  keyframeInterval?: string;
  isVertical: boolean;
  tiktokCompliance: {
    resolutionOk: boolean;
    fpsOk: boolean;
    codecOk: boolean;
    pixelFormatOk: boolean;
    gopOk: boolean;
    bitrateOk: boolean;
    score: number;
    recommendationTitle: string;
    recommendationDetail: string;
    actionNeeded: 'ready' | 'needs_fps' | 'needs_reencode' | 'needs_cropping' | 'needs_gop_fix';
  };
}

export type ExportPreset = 'balanced' | 'max_quality' | 'lightweight' | 'custom';

export type SpeedEngine = 'turbo' | 'balanced' | 'studio';

export type ClarityEngine = 'off' | 'subtle' | 'pro_sharp';
export type ColorEngine = 'passthrough' | 'natural_rec709' | 'tiktok_vibrant';
export type AudioEngine = 'direct_aac' | 'tiktok_loudnorm' | 'vocal_clarity';
export type InterpolationEngine = 'rife_ai' | 'cinema_blend' | 'turbo_flow';
export type JobPriority = 'high' | 'normal' | 'low';

export interface ExportSettings {
  preset: ExportPreset;
  speedEngine: SpeedEngine;
  allowSmartPassthrough?: boolean;
  priority?: JobPriority;
  resolution: '1080x1920' | '720x1280' | 'original';
  targetFps: 30 | 60 | 'original';
  useAiInterpolation: boolean;
  interpolationMode: 'rife' | 'mci' | 'blend';
  interpolationEngine?: InterpolationEngine;
  clarityEngine?: ClarityEngine;
  colorEngine?: ColorEngine;
  audioEngine?: AudioEngine;
  compressionGuard?: boolean;
  videoCodec: 'libx264' | 'libx265' | 'h264_nvenc';
  rateControl: 'crf' | 'vbr';
  crfValue: number;
  targetBitrateKbps?: number;
  maxBitrateKbps?: number;
  gopSize: number;
  pixelFormat: 'yuv420p' | 'yuv420p10le';
  audioCodec: 'aac' | 'mp3' | 'copy';
  audioBitrateKbps: number;
  fastStart: boolean;
  smartFit: 'cover_blur' | 'crop_center' | 'scale_exact';
}

export type JobPhase =
  | 'analyzing'
  | 'preparing_frames'
  | 'enhancing_motion'
  | 'processing_video'
  | 'encoding_output'
  | 'completed'
  | 'failed';

export interface JobProgress {
  phase: JobPhase;
  phaseLabelAr: string;
  percent: number;
  currentFrame?: number;
  totalFrames?: number;
  fps?: number;
  speed?: string;
  etaSeconds?: number;
  elapsedSeconds?: number;
  logMessage?: string;
}

export interface VideoJob {
  id: string;
  createdAt: number;
  completedAt?: number;
  originalName: string;
  inputPath: string;
  outputPath?: string;
  originalMetadata: VideoMetadata;
  outputMetadata?: VideoMetadata;
  settings: ExportSettings;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'resuming';
  progress: JobProgress;
  priority: JobPriority;
  priorityScore?: number;
  retryCount?: number;
  maxRetries?: number;
  resumedFromCrash?: boolean;
  resumedAt?: number;
  error?: string;
}

export interface SystemHardwareInfo {
  cpuModel: string;
  cpuCores: number;
  totalMemMb: number;
  freeMemMb: number;
  gpuAvailable: boolean;
  gpuName?: string;
  ffmpegVersion: string;
  supportedEncoders: string[];
  hasRifeEngine: boolean;
  activeProcessingJobs: number;
  aiEngineStatus?: string;
}

export type NavigationTab = 'home' | 'enhancer' | 'inspector' | 'jobs' | 'settings' | 'account';
