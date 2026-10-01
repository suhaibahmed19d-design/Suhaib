import React, { useState, useRef } from 'react';
import { VideoMetadata, NavigationTab } from '../types';
import { fetchJson } from '../utils/api';
import { uploadVideoChunked, UploadProgress } from '../utils/chunkedUploader';
import {
  Search,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  Play,
  Film,
  Layers,
  Cpu,
  ArrowLeft,
  Volume2,
  FileCheck,
} from 'lucide-react';

interface InspectorViewProps {
  onSelectForEnhancement: (metadata: VideoMetadata) => void;
  setActiveTab: (tab: NavigationTab) => void;
}

export const InspectorView: React.FC<InspectorViewProps> = ({
  onSelectForEnhancement,
  setActiveTab,
}) => {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setIsProbing(true);
    setError(null);
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

      setMetadata(data.metadata);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء فحص الفيديو');
    } finally {
      setIsProbing(false);
      setUploadProgress(null);
    }
  };

  const loadSample = async () => {
    setIsProbing(true);
    setError(null);
    try {
      const data = await fetchJson<{ metadata: VideoMetadata }>('/api/sample-video');
      setMetadata(data.metadata);
    } catch (err: any) {
      setError('تعذر تحميل عينة الفيديو');
    } finally {
      setIsProbing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-right">
      <div className="border-b border-neutral-800/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          تحليل الفيديو العميق (FFprobe Inspector)
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          فحص بنيوي متقدم لترميز الفيديو، مسافات GOP، النسق اللوني، وتوافق الملف مع خوارزميات TikTok
        </p>
      </div>

      {!metadata && (
        <div className="space-y-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed border-neutral-700/80 hover:border-neutral-500 bg-[#0E131F]/60 hover:bg-[#0E131F] p-12 text-center cursor-pointer transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-800 flex items-center justify-center text-rose-400">
                <Search className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-white">اختر فيديو لتحليله هندسيًا</h3>
              <p className="text-xs text-neutral-400">
                سيقوم FFprobe بقراءة كافة الحقول والمؤشرات الداخلية للملف
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={loadSample}
              disabled={isProbing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-amber-400 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-amber-400" />
              <span>فحص عينة تجريبية فوراً</span>
            </button>
          </div>

          {isProbing && (
            <div className="text-center p-6 space-y-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
              <div className="text-xs text-neutral-300">
                {uploadProgress && uploadProgress.percent < 100
                  ? `جاري رفع الفيديو (${uploadProgress.percent}%) · القطعة ${uploadProgress.currentChunk} من ${uploadProgress.totalChunks}`
                  : 'جاري تشغيل FFprobe وقراءة الإطارات المفتاحية...'}
              </div>
              {uploadProgress && (
                <div className="w-full max-w-md mx-auto h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-300 text-xs">
              {error}
            </div>
          )}
        </div>
      )}

      {metadata && (
        <div className="space-y-8 animate-in fade-in">
          {/* Top Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-900/70 border border-neutral-800">
            <div>
              <span className="text-xs text-neutral-500">الملف المفحوص:</span>
              <h3 className="text-sm font-semibold text-white font-mono">{metadata.filename}</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  onSelectForEnhancement(metadata);
                  setActiveTab('enhancer');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <span>تجهيز هذا الفيديو في المحسّن</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setMetadata(null)}
                className="px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300"
              >
                فحص ملف آخر
              </button>
            </div>
          </div>

          {/* TikTok Ingest Checklist */}
          <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-4">
            <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-rose-400" />
              <span>قائمة التوافق مع خوارزميات TikTok Ingest</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">الأبعاد والاتجاه</span>
                  {metadata.tiktokCompliance.resolutionOk ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> مطابق
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> غير قياسي
                    </span>
                  )}
                </div>
                <p className="text-neutral-400 font-mono">
                  {metadata.width}×{metadata.height} ({metadata.aspectRatio})
                </p>
                <p className="text-[11px] text-neutral-500">
                  تيك توك يفضل 1080×1920 عمودي بالكامل
                </p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">معدل الإطارات (FPS)</span>
                  {metadata.tiktokCompliance.fpsOk ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> 60 FPS ناعم
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> يفضل مضاعفته
                    </span>
                  )}
                </div>
                <p className="text-neutral-400 font-mono">{metadata.fps} FPS</p>
                <p className="text-[11px] text-neutral-500">
                  مضاعفته إلى 60 FPS يحسن بقاء المشاهد
                </p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">ترميز الفيديو</span>
                  {metadata.tiktokCompliance.codecOk ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> H.264 آمن
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> قد يتعرض لضغط عنيف
                    </span>
                  )}
                </div>
                <p className="text-neutral-400 font-mono uppercase">{metadata.videoCodec}</p>
                <p className="text-[11px] text-neutral-500">
                  ترميز H.264 High هو الأكثر استقراراً
                </p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">نسق البكسل والألوان</span>
                  {metadata.tiktokCompliance.pixelFormatOk ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> yuv420p القياسي
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> تشوه لوني محتمل
                    </span>
                  )}
                </div>
                <p className="text-neutral-400 font-mono">{metadata.pixelFormat}</p>
                <p className="text-[11px] text-neutral-500">
                  أنماط 10-bit أو 4:2:2 تفقد تدرجها إذا لم تحول
                </p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">فترة GOP (Keyframes)</span>
                  {metadata.tiktokCompliance.gopOk ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> منتظم
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> عشوائي
                    </span>
                  )}
                </div>
                <p className="text-neutral-400 font-mono">{metadata.keyframeInterval}</p>
                <p className="text-[11px] text-neutral-500">
                  فترات الـ GOP الطويلة تسبب تغبيش المشاهد السريعة
                </p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">معدل البت الإجمالي</span>
                  {metadata.tiktokCompliance.bitrateOk ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> متوازن
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> مرتفع أو منخفض
                    </span>
                  )}
                </div>
                <p className="text-neutral-400 font-mono">
                  {(metadata.videoBitrate / 1000).toFixed(1)} Mbps
                </p>
                <p className="text-[11px] text-neutral-500">
                  المعدل المثالي بين 8 إلى 20 Mbps لـ 1080p60
                </p>
              </div>
            </div>
          </div>

          {/* Full Technical Stream Probing Dump */}
          <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-4">
            <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-3">
              البيانات التفصيلية لقنوات البث (Streams)
            </h3>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                <div className="font-semibold text-rose-400 flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  <span>قناة الفيديو الأساسية (Stream #0:0)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-neutral-300 font-mono">
                  <div>
                    <span className="text-neutral-500 block font-sans">الترميز:</span>
                    {metadata.videoCodecLong}
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-sans">الدقة:</span>
                    {metadata.width} × {metadata.height}
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-sans">نسبة الأبعاد:</span>
                    {metadata.aspectRatio}
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-sans">عدد الإطارات/ثانية:</span>
                    {metadata.fps}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                <div className="font-semibold text-emerald-400 flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  <span>قناة الصوت (Stream #0:1)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-neutral-300 font-mono">
                  <div>
                    <span className="text-neutral-500 block font-sans">الترميز الصوتي:</span>
                    {metadata.audioCodecLong || metadata.audioCodec}
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-sans">معدل البت:</span>
                    {metadata.audioBitrate ? `${metadata.audioBitrate} kbps` : 'غير محدد'}
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-sans">تردد العينة:</span>
                    {metadata.audioSampleRate ? `${metadata.audioSampleRate} Hz` : '48000 Hz'}
                  </div>
                  <div>
                    <span className="text-neutral-500 block font-sans">عدد القنوات:</span>
                    {metadata.audioChannels === 2 ? 'ستيريو (Stereo)' : metadata.audioChannels || '2'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
