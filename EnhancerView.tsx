import React, { useState, useRef, useEffect } from 'react';
import { fetchJson } from '../utils/api';
import { uploadVideoChunked, UploadProgress } from '../utils/chunkedUploader';
import {
  VideoMetadata,
  ExportPreset,
  ExportSettings,
  VideoJob,
  JobPhase,
} from '../types';
import {
  UploadCloud,
  FileVideo,
  CheckCircle,
  AlertTriangle,
  Play,
  Download,
  RotateCcw,
  Sliders,
  Sparkles,
  Info,
  Clock,
  Layers,
  Cpu,
  Film,
  Maximize2,
  Volume2,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  ShieldCheck,
  Eye,
  Palette,
} from 'lucide-react';

interface EnhancerViewProps {
  currentJob: VideoJob | null;
  setCurrentJob: (job: VideoJob | null) => void;
  onJobStarted: (job: VideoJob) => void;
  sampleMetadata?: VideoMetadata | null;
}

export const EnhancerView: React.FC<EnhancerViewProps> = ({
  currentJob,
  setCurrentJob,
  onJobStarted,
  sampleMetadata,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    originalName: string;
    savedPath: string;
    size: number;
  } | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(
    sampleMetadata || null
  );
  const [analysisDone, setAnalysisDone] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Export Settings State
  const [selectedPreset, setSelectedPreset] = useState<ExportPreset>('balanced');
  const [settings, setSettings] = useState<ExportSettings>({
    preset: 'balanced',
    speedEngine: 'turbo',
    allowSmartPassthrough: true,
    resolution: 'original',
    targetFps: 60,
    useAiInterpolation: true,
    interpolationMode: 'rife',
    interpolationEngine: 'rife_ai',
    clarityEngine: 'pro_sharp',
    colorEngine: 'tiktok_vibrant',
    audioEngine: 'tiktok_loudnorm',
    compressionGuard: true,
    videoCodec: 'libx264',
    rateControl: 'crf',
    crfValue: 19,
    targetBitrateKbps: 12000,
    maxBitrateKbps: 16000,
    gopSize: 60,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrateKbps: 256,
    fastStart: true,
    smartFit: 'scale_exact',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Update preset defaults when preset changes
  const applyPreset = (preset: ExportPreset) => {
    setSelectedPreset(preset);
    if (preset === 'balanced') {
      setSettings((prev) => ({
        ...prev,
        preset: 'balanced',
        resolution: 'original',
        targetFps: 60,
        useAiInterpolation: true,
        interpolationMode: 'rife',
        interpolationEngine: 'rife_ai',
        clarityEngine: 'pro_sharp',
        colorEngine: 'tiktok_vibrant',
        audioEngine: 'tiktok_loudnorm',
        compressionGuard: true,
        videoCodec: 'libx264',
        rateControl: 'crf',
        crfValue: 19,
        gopSize: 60,
        pixelFormat: 'yuv420p',
        audioBitrateKbps: 256,
        fastStart: true,
        smartFit: 'scale_exact',
      }));
    } else if (preset === 'max_quality') {
      setSettings((prev) => ({
        ...prev,
        preset: 'max_quality',
        resolution: 'original',
        targetFps: 60,
        useAiInterpolation: true,
        interpolationMode: 'mci',
        interpolationEngine: 'rife_ai',
        clarityEngine: 'pro_sharp',
        colorEngine: 'tiktok_vibrant',
        audioEngine: 'vocal_clarity',
        compressionGuard: true,
        videoCodec: 'libx264',
        rateControl: 'crf',
        crfValue: 17,
        gopSize: 60,
        pixelFormat: 'yuv420p',
        audioBitrateKbps: 320,
        fastStart: true,
        smartFit: 'scale_exact',
      }));
    } else if (preset === 'lightweight') {
      setSettings((prev) => ({
        ...prev,
        preset: 'lightweight',
        resolution: 'original',
        targetFps: 30,
        useAiInterpolation: false,
        interpolationEngine: 'turbo_flow',
        clarityEngine: 'subtle',
        colorEngine: 'natural_rec709',
        audioEngine: 'direct_aac',
        compressionGuard: false,
        videoCodec: 'libx264',
        rateControl: 'crf',
        crfValue: 23,
        gopSize: 60,
        pixelFormat: 'yuv420p',
        audioBitrateKbps: 160,
        fastStart: true,
        smartFit: 'scale_exact',
      }));
    } else {
      setSettings((prev) => ({ ...prev, preset: 'custom' }));
    }
  };

  // Sync sampleMetadata if injected from parent
  useEffect(() => {
    if (sampleMetadata) {
      setVideoMetadata(sampleMetadata);
      setUploadedFile({
        originalName: sampleMetadata.filename,
        savedPath: sampleMetadata.filePath,
        size: sampleMetadata.fileSize,
      });
      setAnalysisDone(true);
    }
  }, [sampleMetadata]);

  // Handle Drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // Upload file to server and probe (Chunked 8MB slices to bypass 32MB proxy limits)
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setAnalysisDone(false);
    setCurrentJob(null);
    setUploadProgress({
      percent: 0,
      loadedBytes: 0,
      totalBytes: file.size,
      currentChunk: 1,
      totalChunks: Math.ceil(file.size / (8 * 1024 * 1024)) || 1,
    });

    try {
      const data = await uploadVideoChunked(file, (p) => {
        setUploadProgress(p);
      });

      setUploadedFile(data.uploadedFile);
      setVideoMetadata(data.metadata);
      setAnalysisDone(true);

      // Auto-tune settings based on probe
      if (data.metadata.fps < 50) {
        setSettings((prev) => ({
          ...prev,
          useAiInterpolation: true,
          targetFps: 60,
        }));
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'حدث خطأ أثناء رفع الفيديو.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Quick sample video load
  const loadSampleVideo = async () => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const data = await fetchJson<{ success?: boolean; uploadedFile: any; metadata: VideoMetadata }>('/api/sample-video');
      if (data.success) {
        setUploadedFile(data.uploadedFile);
        setVideoMetadata(data.metadata);
        setAnalysisDone(true);
      }
    } catch (err: any) {
      setUploadError('تعذر تحميل عينة الفيديو');
    } finally {
      setIsUploading(false);
    }
  };

  // Start Real Processing Job
  const startJob = async (customSettings?: ExportSettings) => {
    if (!uploadedFile || !videoMetadata) return;

    try {
      const payloadSettings = customSettings || settings;
      const data = await fetchJson<{ job: VideoJob }>('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadedFile.savedPath,
          originalName: uploadedFile.originalName,
          settings: payloadSettings,
        }),
      });

      const newJob: VideoJob = data.job;
      setCurrentJob(newJob);
      onJobStarted(newJob);

      // Listen to SSE progress
      if (sseRef.current) {
        sseRef.current.close();
      }

      const es = new EventSource(`/api/jobs/${newJob.id}/stream`);
      sseRef.current = es;

      es.onmessage = (event) => {
        try {
          const updated: VideoJob = JSON.parse(event.data);
          setCurrentJob(updated);
          if (updated.status === 'completed' || updated.status === 'failed') {
            es.close();
          }
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      };

      es.onerror = () => {
        es.close();
      };
    } catch (err: any) {
      alert(`خطأ: ${err.message}`);
    }
  };

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  const resetAll = () => {
    setCurrentJob(null);
    setVideoMetadata(null);
    setUploadedFile(null);
    setAnalysisDone(false);
    setShowAdvancedSettings(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Processing Progress Stages definition
  const progressPhases: { id: JobPhase; label: string }[] = [
    { id: 'analyzing', label: 'تحليل الفيديو' },
    { id: 'preparing_frames', label: 'تجهيز الإطارات' },
    { id: 'enhancing_motion', label: 'تحسين الحركة AI' },
    { id: 'processing_video', label: 'معالجة الفيديو' },
    { id: 'encoding_output', label: 'ترميز الملف النهائي' },
    { id: 'completed', label: 'اكتمل' },
  ];

  const getPhaseIndex = (phase: JobPhase): number => {
    const idx = progressPhases.findIndex((p) => p.id === phase);
    return idx >= 0 ? idx : 0;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6 text-right">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            محسّن الفيديو لـ TikTok
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            ارفع الفيديو لتحليله تلقائيًا وتجهيز أبعاده ومعدل إطاراته (60 FPS) بترميز احترافي يقلل فقدان الجودة.
          </p>
        </div>

        {videoMetadata && !currentJob && (
          <button
            onClick={resetAll}
            className="self-start md:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>معالجة فيديو آخر</span>
          </button>
        )}
      </div>

      {/* STATE 1: UPLOAD AREA (If no video uploaded yet) */}
      {!videoMetadata && !isUploading && (
        <div className="space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? 'border-rose-500 bg-rose-950/20'
                : 'border-neutral-700/80 hover:border-neutral-500 bg-[#0E131F]/60 hover:bg-[#0E131F]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v,.3gp,.flv,.wmv,.mts,.m2ts,.ts"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-neutral-800/90 border border-neutral-700 flex items-center justify-center text-rose-400 shadow-inner">
                <UploadCloud className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  اسحب وأفلت ملف الفيديو هنا، أو انقر للاختيار
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  يدعم صيغ MP4, MOV, MKV, WebM حتى 300 ميجابايت (بث مجزأ آمن)
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-4 text-xs text-neutral-500">
                <span>فحص FFprobe فوري</span>
                <span>·</span>
                <span>مضاعفة إطارات RIFE AI</span>
                <span>·</span>
                <span>حذف الملفات تلقائياً</span>
              </div>
            </div>
          </div>

          {/* Quick Trial Option */}
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-neutral-500">ليس لديك فيديو للتجربة الآن؟</span>
            <button
              onClick={loadSampleVideo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-amber-400 transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3 fill-amber-400" />
              <span>تحميل فيديو عينة وتجربة المحرك فوراً</span>
            </button>
          </div>

          {uploadError && (
            <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* UPLOADING STATE WITH GRANULAR CHUNKED PROGRESS */}
      {isUploading && (
        <div className="p-10 sm:p-12 rounded-2xl border border-neutral-800 bg-[#0E131F] text-center space-y-6 max-w-xl mx-auto shadow-2xl">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 rounded-full border-4 border-neutral-800 border-t-rose-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-white">
              {uploadProgress ? `${uploadProgress.percent}%` : ''}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-white">
              {uploadProgress && uploadProgress.percent < 100
                ? `جاري رفع الفيديو بأمان (${uploadProgress.percent}%)`
                : 'جاري فحص وتجميع الفيديو وتحليل خصائصه (FFprobe)...'}
            </h3>
            <p className="text-xs text-neutral-400">
              {uploadProgress ? (
                <span>
                  تم رفع {(uploadProgress.loadedBytes / (1024 * 1024)).toFixed(1)} من{' '}
                  {(uploadProgress.totalBytes / (1024 * 1024)).toFixed(1)} ميجابايت · القطعة {uploadProgress.currentChunk} من {uploadProgress.totalChunks}
                </span>
              ) : (
                'يتم نقل أجزاء الملف المشفرة عبر الخادم...'
              )}
            </p>
          </div>

          {/* Progress bar */}
          {uploadProgress && (
            <div className="space-y-1.5">
              <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 to-amber-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-neutral-500 font-mono">
                <span>0 MB</span>
                <span>بث مجزأ آمن لتجاوز قيود السحابة</span>
                <span>{(uploadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATE 2: VIDEO METADATA & ANALYSIS (When video is probed) */}
      {videoMetadata && !currentJob && (
        <div className="space-y-8">
          {/* Video Information Card */}
          <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-rose-400">
                  <FileVideo className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white truncate max-w-md">
                    {videoMetadata.filename}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                    <span>{videoMetadata.fileSizeFormatted}</span>
                    <span>·</span>
                    <span>المدة: {videoMetadata.durationFormatted}</span>
                  </div>
                </div>
              </div>

              {/* TikTok Compatibility Score */}
              <div className="flex items-center gap-3 bg-neutral-900/80 px-4 py-2 rounded-xl border border-neutral-800">
                <div className="text-right">
                  <div className="text-[11px] text-neutral-400">توافق TikTok القياسي</div>
                  <div className="text-sm font-bold font-mono text-emerald-400">
                    %{videoMetadata.tiktokCompliance.score}
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">الدقة والأبعاد</span>
                <p className="text-white font-mono font-medium">
                  {videoMetadata.width} × {videoMetadata.height} ({videoMetadata.aspectRatio})
                </p>
                <span
                  className={`text-[11px] ${
                    videoMetadata.tiktokCompliance.resolutionOk ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {videoMetadata.tiktokCompliance.resolutionOk ? 'عمودي مثالي (9:16)' : 'أبعاد غير قياسية'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">معدل الإطارات (FPS)</span>
                <p className="text-white font-mono font-medium">{videoMetadata.fps} FPS</p>
                <span
                  className={`text-[11px] ${
                    videoMetadata.tiktokCompliance.fpsOk ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {videoMetadata.tiktokCompliance.fpsOk ? 'سلاسة 60 إطاراً' : 'يحتاج لمضاعفة RIFE'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">ترميز الفيديو (Codec)</span>
                <p className="text-white font-mono font-medium uppercase">
                  {videoMetadata.videoCodec}
                </p>
                <span
                  className={`text-[11px] ${
                    videoMetadata.tiktokCompliance.codecOk ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {videoMetadata.tiktokCompliance.codecOk ? 'H.264 متوافق' : 'قد يعاد ضغطه بقوة'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">معدل البت (Bitrate)</span>
                <p className="text-white font-mono font-medium">
                  {(videoMetadata.videoBitrate / 1000).toFixed(1)} Mbps
                </p>
                <span className="text-[11px] text-neutral-400">
                  {videoMetadata.videoBitrate > 35000 ? 'مرتفع جداً لتيك توك' : 'متوازن'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">فترة GOP / Keyframes</span>
                <p className="text-white font-mono font-medium truncate">
                  {videoMetadata.keyframeInterval || `${videoMetadata.gopSize} إطار`}
                </p>
                <span
                  className={`text-[11px] ${
                    videoMetadata.tiktokCompliance.gopOk ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {videoMetadata.tiktokCompliance.gopOk ? 'فترات منتظمة' : 'يحتاج تثبيت GOP'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">نسق البكسل (Pixel Format)</span>
                <p className="text-white font-mono font-medium">{videoMetadata.pixelFormat}</p>
                <span
                  className={`text-[11px] ${
                    videoMetadata.tiktokCompliance.pixelFormatOk ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {videoMetadata.tiktokCompliance.pixelFormatOk ? 'yuv420p القياسي' : 'غير متوافق'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">ترميز الصوت (Audio Codec)</span>
                <p className="text-white font-mono font-medium uppercase">
                  {videoMetadata.audioCodec || 'صامت'}
                </p>
                <span className="text-[11px] text-neutral-400">
                  {videoMetadata.audioBitrate ? `${videoMetadata.audioBitrate} kbps` : '48 kHz'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/70 space-y-1">
                <span className="text-neutral-500">الفضاء اللوني (Color Space)</span>
                <p className="text-white font-mono font-medium">
                  {videoMetadata.colorSpace || 'BT.709'}
                </p>
                <span className="text-[11px] text-neutral-400">نطاق قياسي</span>
              </div>
            </div>
          </div>

          {/* Smart Recommendation Card */}
          <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  videoMetadata.tiktokCompliance.score >= 90
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400'
                    : 'bg-amber-950/60 border border-amber-800 text-amber-400'
                }`}
              >
                {videoMetadata.tiktokCompliance.score >= 90 ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-rose-400">التوصية الهندسية لـ TikTok</div>
                <h3 className="text-lg font-bold text-white">
                  {videoMetadata.tiktokCompliance.recommendationTitle}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-3xl">
                  {videoMetadata.tiktokCompliance.recommendationDetail}
                </p>
              </div>
            </div>

            {/* Quick Actions: Auto Optimize vs Advanced */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={() => startJob()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-md shadow-rose-950 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>تحسين تلقائي (موصى به لـ TikTok)</span>
              </button>

              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 text-sm font-medium transition-colors cursor-pointer"
              >
                <Sliders className="w-4 h-4" />
                <span>إعدادات متقدمة</span>
                {showAdvancedSettings ? (
                  <ChevronUp className="w-4 h-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>
          </div>

          {/* ADVANCED EXPORT SETTINGS FOR TIKTOK (Accordion / Panel) */}
          {showAdvancedSettings && (
            <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-8 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">تحسين التصدير لـ TikTok</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    إعدادات دقيقة للتحكم في الترميز، سلاسة الإطارات، ومسافة الـ GOP
                  </p>
                </div>

                {/* Preset Selector */}
                <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-xl border border-neutral-800 text-xs">
                  {(
                    [
                      { id: 'balanced', label: 'جودة متوازنة' },
                      { id: 'max_quality', label: 'أعلى جودة' },
                      { id: 'lightweight', label: 'ملف خفيف' },
                      { id: 'custom', label: 'مخصص' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id)}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        selectedPreset === p.id
                          ? 'bg-rose-600 text-white font-semibold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed & Acceleration Engine Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>محرك تسريع المعالجة (Encoding Speed Engine)</span>
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    تحكم في سرعة الإنجاز مقابل عمق فحص الحركة
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, speedEngine: 'turbo', preset: 'custom' })}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      settings.speedEngine === 'turbo'
                        ? 'border-amber-500 bg-amber-950/20 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">وضع التيربو الفائق (10x)</span>
                      {settings.speedEngine === 'turbo' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-neutral-300 mt-1">
                      معالجة فورية في ثوانٍ معدودة. يعتمد على مضاعفة الإطارات الذكية وترميز فائق السرعة.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, speedEngine: 'balanced', preset: 'custom' })}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      settings.speedEngine === 'balanced'
                        ? 'border-rose-500 bg-rose-950/20 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-400">متوازن (4x)</span>
                      {settings.speedEngine === 'balanced' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                    </div>
                    <p className="text-[11px] text-neutral-300 mt-1">
                      توازن ممتاز بين الجودة العالية والسرعة لشاشات الهواتف المحمولة.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, speedEngine: 'studio', preset: 'custom' })}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      settings.speedEngine === 'studio'
                        ? 'border-emerald-500 bg-emerald-950/20 text-white shadow-sm'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">استوديو دقيق (بطيء)</span>
                      {settings.speedEngine === 'studio' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-neutral-300 mt-1">
                      بحث بصري مكثف للإطارات (يستغرق وقتاً طويلاً على المعالج بدون كرت GPU).
                    </p>
                  </button>
                </div>

                {/* Smart Passthrough switch */}
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowSmartPassthrough}
                    onChange={(e) => setSettings({ ...settings, allowSmartPassthrough: e.target.checked })}
                    className="rounded accent-rose-600 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-white block">
                      التمرير السريع المباشر (Smart Passthrough) — سرعة خارقة (0.5 ثانية)
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      إذا كان الفيديو يطابق دقة 1080×1920 و 60 FPS مسبقاً، يتم تخطي إعادة الترميز تماماً ونسخ البث مباشرة.
                    </span>
                  </div>
                </label>
              </div>

              {/* ADVANCED PROCESSING ENGINES HUB */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>مركز المحركات الهندسية المتطورة (Engines Hub)</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                          v2.0 Ultra
                        </span>
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        خوارزميات معالجة الإشارة الرقمية لحماية الفيديو من ضغط وتشويه خوارزميات تيك توك
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">كافة المحركات تعمل بالتوازي بتسريع عالي</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Engine 1: Clarity & Micro-Edge */}
                  <div className="p-4 rounded-xl bg-[#0B0F17] border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-rose-400" />
                        <span className="font-semibold text-white">محرك حدة وحماية التفاصيل (Clarity Engine)</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">Anti-Compression</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      يحمي ملامح الوجوه، خصلات الشعر، والنصوص من الضبابية التي يحدثها كوديك تيك توك المضغوط.
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, clarityEngine: 'pro_sharp', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.clarityEngine === 'pro_sharp'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">Pro Sharp</span>
                        <span className="text-[9px] opacity-75">موصى به لـ TikTok</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, clarityEngine: 'subtle', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.clarityEngine === 'subtle'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">Subtle</span>
                        <span className="text-[9px] opacity-75">حدة ناعمة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, clarityEngine: 'off', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.clarityEngine === 'off'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">إيقاف</span>
                        <span className="text-[9px] opacity-75">بدون فلتر</span>
                      </button>
                    </div>
                  </div>

                  {/* Engine 2: Color & Dynamic Range Booster */}
                  <div className="p-4 rounded-xl bg-[#0B0F17] border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold text-white">محرك حيوية الألوان (TikTok Rec.709 Engine)</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">BT.709 Guard</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      معايرة دقيقة لتشبع وتباين الألوان لمنع ظهور الفيديو باهتاً أو أبيض بعد ضغط تيك توك.
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, colorEngine: 'tiktok_vibrant', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.colorEngine === 'tiktok_vibrant'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">Vibrant Boost</span>
                        <span className="text-[9px] opacity-75">مانع البهتان</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, colorEngine: 'natural_rec709', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.colorEngine === 'natural_rec709'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">Strict Rec.709</span>
                        <span className="text-[9px] opacity-75">ألوان قياسية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, colorEngine: 'passthrough', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.colorEngine === 'passthrough'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">Passthrough</span>
                        <span className="text-[9px] opacity-75">نفس المصدر</span>
                      </button>
                    </div>
                  </div>

                  {/* Engine 3: Audio Studio Normalizer */}
                  <div className="p-4 rounded-xl bg-[#0B0F17] border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-white">محرك هندسة الصوت وتطبيع -14 LUFS</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">EBU R128</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      يضبط مستوى الصوت لمعيار TikTok الذهبي (-14 LUFS) لمنع خوارزمية التطبيق من خفضه تلقائياً.
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, audioEngine: 'tiktok_loudnorm', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.audioEngine === 'tiktok_loudnorm'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">-14 LUFS Norm</span>
                        <span className="text-[9px] opacity-75">معيار TikTok الذهبي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, audioEngine: 'vocal_clarity', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.audioEngine === 'vocal_clarity'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">Vocal Clarity</span>
                        <span className="text-[9px] opacity-75">توضيح نبرة الكلام</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettings({ ...settings, audioEngine: 'direct_aac', preset: 'custom' })}
                        className={`py-2 px-2 rounded-lg text-center font-medium transition-all cursor-pointer ${
                          settings.audioEngine === 'direct_aac'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="block text-[11px]">Direct AAC</span>
                        <span className="text-[9px] opacity-75">ترميز مباشر</span>
                      </button>
                    </div>
                  </div>

                  {/* Engine 4: Compression Guard */}
                  <div className="p-4 rounded-xl bg-[#0B0F17] border border-neutral-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-cyan-400" />
                          <span className="font-semibold text-white">محرك درع الضغط (Compression Guard)</span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">x264 Psy Engine</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        يحقن بارامترات التحليل البصري التكيفي (Trellis & Film Tuning) لمنع تكسير الكتل (Color Banding) في الخلفيات والوجوه عند رفع الفيديو.
                      </p>
                    </div>
                    <label className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer">
                      <span className="text-xs font-medium text-white">تفعيل درع الضغط البصري</span>
                      <input
                        type="checkbox"
                        checked={settings.compressionGuard}
                        onChange={(e) => setSettings({ ...settings, compressionGuard: e.target.checked, preset: 'custom' })}
                        className="rounded accent-cyan-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Priority Queue Selection */}
                <div className="p-4 rounded-xl bg-[#0B0F17] border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>مستوى الأولوية في طابور Redis (Priority Queue Level)</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">Auto-Resume Protected</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    حدد أولوية المعالجة. المهام ذات الأولوية القصوى يتم سحبها فوراً وتخطي الطابور حتى في حال وجود مهام أخرى.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, priority: 'high', preset: 'custom' })}
                      className={`p-2.5 rounded-lg text-right font-medium transition-all cursor-pointer border ${
                        settings.priority === 'high'
                          ? 'border-amber-500 bg-amber-950/30 text-amber-200 shadow-sm'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                        <span>⚡ أولوية قصوى (VIP High)</span>
                        {settings.priority === 'high' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">معالجة فورية وتخطي الطابور</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, priority: 'normal', preset: 'custom' })}
                      className={`p-2.5 rounded-lg text-right font-medium transition-all cursor-pointer border ${
                        settings.priority === 'normal' || !settings.priority
                          ? 'border-sky-500 bg-sky-950/30 text-sky-200 shadow-sm'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-sky-400">
                        <span>أولوية قياسية (Normal)</span>
                        {(settings.priority === 'normal' || !settings.priority) && (
                          <Check className="w-3.5 h-3.5 text-sky-400" />
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">الافتراضي لجميع الفيديوهات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, priority: 'low', preset: 'custom' })}
                      className={`p-2.5 rounded-lg text-right font-medium transition-all cursor-pointer border ${
                        settings.priority === 'low'
                          ? 'border-neutral-600 bg-neutral-800/50 text-white shadow-sm'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-neutral-300">
                        <span>أولوية خلفية (Low)</span>
                        {settings.priority === 'low' && <Check className="w-3.5 h-3.5 text-neutral-300" />}
                      </div>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">للملفات الطويلة غير المستعجلة</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Settings Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
                {/* 1. Resolution */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">المقاس والدقة (Resolution)</label>
                  <select
                    value={settings.resolution}
                    onChange={(e: any) =>
                      setSettings({ ...settings, resolution: e.target.value, preset: 'custom' })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-rose-500 font-medium"
                  >
                    <option value="original">نفس مقاس الفيديو المستورد بدقة 1:1 (بدون ضبابية أو تغيير) - الافتراضي</option>
                    <option value="1080x1920">1080 × 1920 (تحويل يدوي للأبعاد العمودية 9:16)</option>
                    <option value="720x1280">720 × 1280 (دقة سريعة)</option>
                  </select>
                </div>

                {/* 2. Target FPS & RIFE Toggle */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">
                    معدل الإطارات وسلاسة الحركة
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={settings.targetFps}
                      onChange={(e: any) =>
                        setSettings({
                          ...settings,
                          targetFps: e.target.value === 'original' ? 'original' : parseInt(e.target.value, 10) as any,
                          preset: 'custom',
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="60">60 FPS (سلاسة فائقة لـ TikTok)</option>
                      <option value="30">30 FPS (قياسي)</option>
                      <option value="original">نفس المصدر الأصلي</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={settings.useAiInterpolation}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          useAiInterpolation: e.target.checked,
                          preset: 'custom',
                        })
                      }
                      className="rounded accent-rose-600"
                    />
                    <span>تفعيل مضاعفة الإطارات AI (RIFE / Optical Flow)</span>
                  </label>
                  {settings.useAiInterpolation && (
                    <select
                      value={settings.interpolationMode}
                      onChange={(e: any) =>
                        setSettings({
                          ...settings,
                          interpolationMode: e.target.value,
                          preset: 'custom',
                        })
                      }
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-[11px] focus:outline-none"
                    >
                      <option value="rife">المسار الذكي (فائق السرعة والانسيابية)</option>
                      <option value="mci">تدفق بصري عالي الدقة (Optical Flow MCI)</option>
                      <option value="blend">مزج الإطارات الناعم (Frame Blending)</option>
                    </select>
                  )}
                </div>

                {/* 3. Video Codec */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">
                    ترميز الفيديو (Video Codec)
                  </label>
                  <select
                    value={settings.videoCodec}
                    onChange={(e: any) =>
                      setSettings({ ...settings, videoCodec: e.target.value, preset: 'custom' })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="libx264">H.264 High Profile (الأعلى توافقاً وأماناً مع تيك توك)</option>
                    <option value="libx265">H.265 / HEVC (ضغط أعلى)</option>
                  </select>
                </div>

                {/* 4. CRF / Quality Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-neutral-300 font-semibold">
                      مستوى جودة CRF ({settings.crfValue})
                    </label>
                    <span className="text-[11px] text-neutral-500">
                      {settings.crfValue <= 17 ? 'أعلى نقاء' : settings.crfValue <= 20 ? 'متوازن' : 'خفيف'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="28"
                    value={settings.crfValue}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        crfValue: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500">
                    <span>14 (جودة استوديو)</span>
                    <span>19 (موصى به لـ TikTok)</span>
                    <span>28 (أصغر حجم)</span>
                  </div>
                </div>

                {/* 5. GOP Size (Keyframes) */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">
                    مسافة الإطارات المفتاحية (GOP)
                  </label>
                  <select
                    value={settings.gopSize}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        gopSize: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="60">GOP = 60 (ثانية واحدة عند 60fps - مثالي لـ TikTok)</option>
                    <option value="30">GOP = 30 (نصف ثانية لسرعة التمرير)</option>
                    <option value="120">GOP = 120 (ثانيتان)</option>
                  </select>
                </div>

                {/* 6. Pixel Format */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">
                    نسق البكسل (Pixel Format)
                  </label>
                  <select
                    value={settings.pixelFormat}
                    onChange={(e: any) =>
                      setSettings({ ...settings, pixelFormat: e.target.value, preset: 'custom' })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="yuv420p">yuv420p (النسق القياسي الإلزامي لمنع بهتان الألوان)</option>
                    <option value="yuv420p10le">yuv420p10le (10-bit)</option>
                  </select>
                </div>

                {/* 7. Audio Settings */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">
                    ترميز وصوت TikTok (Audio Bitrate)
                  </label>
                  <select
                    value={settings.audioBitrateKbps}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        audioBitrateKbps: parseInt(e.target.value, 10),
                        preset: 'custom',
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="320">AAC 320 kbps (أعلى نقاء صوتي استوديو)</option>
                    <option value="256">AAC 256 kbps (الافتراضي المتوازن)</option>
                    <option value="192">AAC 192 kbps (قياسي)</option>
                  </select>
                </div>

                {/* 8. Container & FastStart */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">الحاوية وتجهيز البث</label>
                  <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-700 space-y-2">
                    <div className="text-white font-mono">MP4 Container (+faststart)</div>
                    <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.fastStart}
                        onChange={(e) =>
                          setSettings({ ...settings, fastStart: e.target.checked, preset: 'custom' })
                        }
                        className="rounded accent-rose-600"
                      />
                      <span>نقل moov atom لمقدمة الملف للبث الفوري</span>
                    </label>
                  </div>
                </div>

                {/* 9. Smart Fit for Landscape */}
                <div className="space-y-2">
                  <label className="text-neutral-300 font-semibold block">
                    ملاءمة الأبعاد والخلفية
                  </label>
                  {settings.resolution === 'original' ? (
                    <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>المقاس الأصلي محفوظ 1:1 كما تم استيراده تماماً (بدون ضبابية أو اقتصاص).</span>
                    </div>
                  ) : (
                    <select
                      value={settings.smartFit}
                      onChange={(e: any) =>
                        setSettings({ ...settings, smartFit: e.target.value, preset: 'custom' })
                      }
                      className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="scale_exact">حفظ النسبة بدقة بدون ضبابية (Letterbox)</option>
                      <option value="cover_blur">خلفية ضبابية احترافية (TikTok Style)</option>
                      <option value="crop_center">اقتصاص مركزي للملء الكامل</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Technical Disclaimer Notice */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-400 flex items-start gap-3">
                <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-white">إيضاح هندسي:</strong> يقوم TikTok بمعالجة وضغط كافة الفيديوهات عبر خوادمه بعد الرفع ولا يمكن لأي برنامج منع الضغط كليًا. هدف هذه الإعدادات هو مطابقة معايير معالجات TikTok وتزويدها بإطارات مفتاحية جاهزة ومعدل بت غير قابل للتشوه للحفاظ على أقصى دقة ممكنة.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => startJob()}
                  className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  بدء التصدير بالإعدادات الحالية
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STATE 3: REAL PROCESSING PROGRESS (While job is running) */}
      {currentJob && currentJob.status === 'processing' && (
        <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-8 space-y-8 animate-in fade-in">
          <div className="text-right space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                جاري المعالجة الحقيقية عبر خادم FFmpeg & RIFE AI
              </span>
              <span className="text-xl font-bold font-mono text-white">
                %{currentJob.progress.percent}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">
              {currentJob.progress.phaseLabelAr}
            </h3>
            <p className="text-xs text-neutral-400">
              {currentJob.progress.logMessage || 'يتم تطبيق سلاسل الفلاتر وحساب متجهات الحركة...'}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="w-full h-3 rounded-full bg-neutral-900 border border-neutral-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${currentJob.progress.percent}%` }}
              />
            </div>
          </div>

          {/* Real Processing Pipeline Stages */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {progressPhases.map((phase, index) => {
              const currentPhaseIdx = getPhaseIndex(currentJob.progress.phase);
              const isPast = index < currentPhaseIdx;
              const isCurrent = index === currentPhaseIdx;

              return (
                <div
                  key={phase.id}
                  className={`p-3 rounded-xl border text-center space-y-1.5 transition-all ${
                    isCurrent
                      ? 'border-rose-500 bg-rose-950/20 text-white font-semibold'
                      : isPast
                      ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-300'
                      : 'border-neutral-800 bg-neutral-900/40 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {isPast ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : isCurrent ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-neutral-700 flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] block">{phase.label}</span>
                </div>
              );
            })}
          </div>

          {/* Live Telemetry Data from FFmpeg */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 text-xs">
            <div>
              <span className="text-neutral-500 block">الإطار المعالج</span>
              <span className="text-white font-mono font-medium">
                {currentJob.progress.currentFrame || '—'}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">سرعة المعالجة</span>
              <span className="text-white font-mono font-medium">
                {currentJob.progress.speed || '1.4x'}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">الوقت المنقضي</span>
              <span className="text-white font-mono font-medium">
                {currentJob.progress.elapsedSeconds || 0} ثانية
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">معدل الإطارات الفعلي</span>
              <span className="text-white font-mono font-medium">
                {currentJob.progress.fps ? `${currentJob.progress.fps} FPS` : 'جارٍ الحساب...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: COMPLETED RESULTS VIEW */}
      {currentJob && currentJob.status === 'completed' && currentJob.outputMetadata && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-right">
              <div className="w-10 h-10 rounded-xl bg-emerald-900/50 border border-emerald-700 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">اكتمل تجهيز الفيديو بنجاح!</h3>
                <p className="text-xs text-emerald-300">
                  الفيديو الآن يطابق المواصفات المثالية للتصدير إلى TikTok بأعلى نقاء ممكن
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <a
                href={`/api/jobs/${currentJob.id}/download`}
                download
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-md shadow-rose-950 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تحميل الفيديو</span>
              </a>

              <button
                onClick={resetAll}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-300 hover:text-white text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>معالجة فيديو آخر</span>
              </button>
            </div>
          </div>

          {/* Video Preview Player */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-[320px] rounded-2xl overflow-hidden border border-neutral-800 bg-black shadow-2xl relative">
                <video
                  src={`/api/jobs/${currentJob.id}/preview?type=output`}
                  controls
                  className="w-full aspect-[9/16] object-contain bg-black"
                />
                <div className="p-3 bg-neutral-900 text-center border-t border-neutral-800">
                  <span className="text-[11px] text-neutral-400 font-mono">
                    معاينة الفيديو النهائي (1080×1920 @ 60 FPS)
                  </span>
                </div>
              </div>
            </div>

            {/* Before / After Comparison Table */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-4">
                <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-3">
                  مقارنة المواصفات التقنية (قبل / بعد)
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400">
                        <th className="py-2.5 font-semibold">الخاصية</th>
                        <th className="py-2.5 font-semibold">الملف الأصلي</th>
                        <th className="py-2.5 font-semibold text-rose-400">الملف الناتج لـ TikTok</th>
                        <th className="py-2.5 font-semibold text-emerald-400">التحسين</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono">
                      <tr>
                        <td className="py-3 font-sans text-neutral-300">الدقة والأبعاد</td>
                        <td className="py-3 text-neutral-400">
                          {currentJob.originalMetadata.width}×{currentJob.originalMetadata.height}
                        </td>
                        <td className="py-3 text-white font-semibold">
                          {currentJob.outputMetadata.width}×{currentJob.outputMetadata.height}
                        </td>
                        <td className="py-3 font-sans text-emerald-400">
                          {currentJob.outputMetadata.width === 1080 ? '9:16 قياسي' : 'معدّل'}
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 font-sans text-neutral-300">معدل الإطارات (FPS)</td>
                        <td className="py-3 text-neutral-400">{currentJob.originalMetadata.fps} FPS</td>
                        <td className="py-3 text-white font-semibold">
                          {currentJob.outputMetadata.fps} FPS
                        </td>
                        <td className="py-3 font-sans text-emerald-400">
                          {currentJob.outputMetadata.fps >= 59 ? 'مضاعفة سلاسة 60 FPS' : 'ثابت'}
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 font-sans text-neutral-300">حجم الملف</td>
                        <td className="py-3 text-neutral-400">
                          {currentJob.originalMetadata.fileSizeFormatted}
                        </td>
                        <td className="py-3 text-white font-semibold">
                          {currentJob.outputMetadata.fileSizeFormatted}
                        </td>
                        <td className="py-3 font-sans text-neutral-300">
                          {currentJob.outputMetadata.fileSize < currentJob.originalMetadata.fileSize
                            ? `توفير ${Math.round(
                                (1 -
                                  currentJob.outputMetadata.fileSize /
                                    currentJob.originalMetadata.fileSize) *
                                  100
                              )}%`
                            : 'محسّن النقاء'}
                        </td>
                      </tr>

                      <tr>
                        <td className="py-3 font-sans text-neutral-300">الترميز (Codec)</td>
                        <td className="py-3 text-neutral-400 uppercase">
                          {currentJob.originalMetadata.videoCodec}
                        </td>
                        <td className="py-3 text-white font-semibold uppercase">
                          {currentJob.outputMetadata.videoCodec} (High)
                        </td>
                        <td className="py-3 font-sans text-emerald-400">تجنب ضغط الخوادم</td>
                      </tr>

                      <tr>
                        <td className="py-3 font-sans text-neutral-300">مسافة GOP</td>
                        <td className="py-3 text-neutral-400 truncate max-w-[120px]">
                          {currentJob.originalMetadata.keyframeInterval ||
                            `${currentJob.originalMetadata.gopSize} إطار`}
                        </td>
                        <td className="py-3 text-white font-semibold">
                          {currentJob.settings.gopSize} إطار مغلق
                        </td>
                        <td className="py-3 font-sans text-emerald-400">إطارات منتظمة</td>
                      </tr>

                      <tr>
                        <td className="py-3 font-sans text-neutral-300">نسق البكسل</td>
                        <td className="py-3 text-neutral-400">
                          {currentJob.originalMetadata.pixelFormat}
                        </td>
                        <td className="py-3 text-white font-semibold">
                          {currentJob.outputMetadata.pixelFormat}
                        </td>
                        <td className="py-3 font-sans text-emerald-400">BT.709 Standard</td>
                      </tr>

                      <tr>
                        <td className="py-3 font-sans text-neutral-300">ترميز الصوت</td>
                        <td className="py-3 text-neutral-400 uppercase">
                          {currentJob.originalMetadata.audioCodec || 'None'}
                        </td>
                        <td className="py-3 text-white font-semibold uppercase">
                          AAC-LC ({currentJob.settings.audioBitrateKbps}k)
                        </td>
                        <td className="py-3 font-sans text-emerald-400">48 kHz Stereo</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tips for Uploading to TikTok */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 space-y-2 text-xs">
                <h4 className="font-semibold text-white">إرشادات عند رفع الفيديو إلى TikTok:</h4>
                <ul className="list-disc list-inside space-y-1 text-neutral-400 leading-relaxed">
                  <li>
                    تأكد من تفعيل خيار <strong className="text-neutral-200">"السماح بالتحميل بجودة عالية"</strong> في تطبيق تيك توك قبل النشر.
                  </li>
                  <li>
                    ارفع الملف مباشرة عبر تطبيق الهاتف أو TikTok Studio لسطح المكتب دون إرساله عبر واتساب حتى لا يعاد ضغطه مجدداً.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 5: FAILED JOB */}
      {currentJob && currentJob.status === 'failed' && (
        <div className="rounded-2xl border border-rose-900/60 bg-rose-950/20 p-6 space-y-4">
          <div className="flex items-center gap-3 text-rose-300">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold">تعذرت معالجة الفيديو</h3>
              <p className="text-xs text-rose-400 mt-0.5">{currentJob.error}</p>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold cursor-pointer"
          >
            المحاولة مرة أخرى
          </button>
        </div>
      )}
    </div>
  );
};
