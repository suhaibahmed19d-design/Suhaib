import React, { useEffect, useState } from 'react';
import { VideoJob, NavigationTab, JobPriority } from '../types';
import { fetchJson } from '../utils/api';
import {
  ListFilter,
  Download,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  ArrowUpCircle,
  Layers,
  Database,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface QueueStats {
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

interface JobsViewProps {
  onSelectJob: (job: VideoJob) => void;
  setActiveTab: (tab: NavigationTab) => void;
}

export const JobsView: React.FC<JobsViewProps> = ({ onSelectJob, setActiveTab }) => {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumingAll, setResumingAll] = useState(false);

  const fetchJobsAndStats = async () => {
    try {
      const [jobsData, statsData] = await Promise.all([
        fetchJson<{ jobs?: VideoJob[] }>('/api/jobs'),
        fetchJson<{ stats?: QueueStats }>('/api/queue/stats').catch(() => ({ stats: undefined })),
      ]);
      setJobs(jobsData.jobs || []);
      if (statsData?.stats) {
        setStats(statsData.stats);
      }
    } catch (e) {
      console.error('Error fetching jobs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsAndStats();
    const interval = setInterval(fetchJobsAndStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const deleteJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetchJson(`/api/jobs/${id}`, { method: 'DELETE' });
      setJobs((prev) => prev.filter((j) => j.id !== id));
      fetchJobsAndStats();
    } catch (err) {
      console.error(err);
    }
  };

  const changePriority = async (id: string, priority: JobPriority, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetchJson(`/api/jobs/${id}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      fetchJobsAndStats();
    } catch (err) {
      console.error(err);
    }
  };

  const triggerAutoResume = async () => {
    setResumingAll(true);
    try {
      await fetchJson('/api/queue/auto-resume', { method: 'POST' });
      await fetchJobsAndStats();
    } catch (err) {
      console.error(err);
    } finally {
      setResumingAll(false);
    }
  };

  const clearAllCompleted = async () => {
    try {
      await fetchJson('/api/cleanup', { method: 'POST' });
      fetchJobsAndStats();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-right">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            طابور Redis للأولويات وسجل المعالجة
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            نظام الطابور الذكي (Priority Queue) مع الاستئناف التلقائي (Auto-Resume) ومقاومة انقطاع السيرفر
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={triggerAutoResume}
            disabled={resumingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-800/60 bg-amber-950/40 hover:bg-amber-900/60 text-xs text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resumingAll ? 'animate-spin' : ''}`} />
            <span>فحص واستئناف المهام المعلقة</span>
          </button>

          {jobs.length > 0 && (
            <button
              onClick={clearAllCompleted}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تنظيف السجل</span>
            </button>
          )}
        </div>
      </div>

      {/* Redis Priority Queue Stats Dashboard */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#0E131F] border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[11px]">
              <span>محرك الطابور</span>
              <Database className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-white font-bold font-mono">
              {stats.isConnected ? 'Redis Cluster' : 'Disk-Backed Queue'}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{stats.isConnected ? 'متصل ونشط' : 'استمرارية على القرص'}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E131F] border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[11px]">
              <span>الأولوية القصوى (VIP)</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-amber-400 font-bold font-mono text-base">
              {stats.highPriorityCount}
            </div>
            <div className="text-[10px] text-neutral-400">معالجة فورية متقدمة</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E131F] border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[11px]">
              <span>الأولوية العادية</span>
              <Layers className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-sky-400 font-bold font-mono text-base">
              {stats.normalPriorityCount}
            </div>
            <div className="text-[10px] text-neutral-400">طابور قياسي</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E131F] border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[11px]">
              <span>قيد المعالجة الآن</span>
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            </div>
            <div className="text-rose-400 font-bold font-mono text-base">
              {stats.activeJobs}
            </div>
            <div className="text-[10px] text-neutral-400">أنوية متوازية</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E131F] border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[11px]">
              <span>المهام المكتملة</span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-emerald-400 font-bold font-mono text-base">
              {stats.completedJobs}
            </div>
            <div className="text-[10px] text-neutral-400">جاهزة للتحميل</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E131F] border border-neutral-800 space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[11px]">
              <span>الاستئناف التلقائي</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-emerald-400 font-bold font-mono text-base">
              {stats.resumedJobsCount > 0 ? `${stats.resumedJobsCount} مهام` : 'جاهز'}
            </div>
            <div className="text-[10px] text-neutral-400">حماية من انقطاع الخادم</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-neutral-400">جاري تحميل سجل وطابور المهام...</div>
      ) : jobs.length === 0 ? (
        <div className="p-16 rounded-2xl border border-neutral-800 bg-[#0E131F]/40 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500">
            <ListFilter className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">لا توجد مهام في طابور المعالجة حالياً</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            قم برفع أي فيديو وسيتولى طابور Redis ترتيبه ومعالجته وفقاً لمستوى الأولوية المحدد.
          </p>
          <button
            onClick={() => setActiveTab('enhancer')}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
          >
            الانتقال إلى المحسّن
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const isCompleted = job.status === 'completed';
            const isProcessing = job.status === 'processing';
            const isQueued = job.status === 'queued';
            const isFailed = job.status === 'failed';
            const priority = job.priority || 'normal';

            return (
              <div
                key={job.id}
                onClick={() => {
                  onSelectJob(job);
                  setActiveTab('enhancer');
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-4 ${
                  isProcessing
                    ? 'border-rose-500/80 bg-[#0E131F] shadow-lg shadow-rose-950/20'
                    : job.resumedFromCrash
                    ? 'border-amber-700/80 bg-[#0E131F]'
                    : 'border-neutral-800 bg-[#0E131F] hover:border-neutral-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400'
                          : isProcessing
                          ? 'bg-rose-950/60 border border-rose-800 text-rose-400'
                          : isQueued
                          ? 'bg-amber-950/60 border border-amber-800 text-amber-400'
                          : 'bg-red-950/60 border border-red-800 text-red-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isProcessing ? (
                        <div className="w-4 h-4 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
                      ) : isQueued ? (
                        <Clock className="w-5 h-5 text-amber-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-white truncate max-w-md font-mono">
                          {job.originalName}
                        </h4>

                        {/* Priority Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            priority === 'high'
                              ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                              : priority === 'low'
                              ? 'bg-neutral-800 border border-neutral-700 text-neutral-400'
                              : 'bg-sky-500/20 border border-sky-500/50 text-sky-300'
                          }`}
                        >
                          {priority === 'high'
                            ? '⚡ أولوية قصوى (High)'
                            : priority === 'low'
                            ? 'أولوية خلفية (Low)'
                            : 'أولوية قياسية (Normal)'}
                        </span>

                        {/* Auto-Resumed Badge */}
                        {job.resumedFromCrash && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>مستأنف تلقائيًا بعد إعادة التشغيل</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                        <span>{new Date(job.createdAt).toLocaleTimeString('ar-EG')}</span>
                        <span>·</span>
                        <span>
                          {job.settings.preset === 'balanced'
                            ? 'جودة متوازنة'
                            : job.settings.preset === 'max_quality'
                            ? 'أعلى جودة'
                            : job.settings.preset === 'lightweight'
                            ? 'ملف خفيف'
                            : 'مخصص'}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{job.originalMetadata?.fileSizeFormatted}</span>
                        {job.retryCount && job.retryCount > 0 ? (
                          <>
                            <span>·</span>
                            <span className="text-amber-400">المحاولة {job.retryCount}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Priority Promotion */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {/* Priority Promotion for Queued Jobs */}
                    {isQueued && (
                      <div className="flex items-center gap-1 bg-neutral-900/90 p-1 rounded-lg border border-neutral-800 text-[11px]">
                        <span className="text-neutral-500 px-1">الأولوية:</span>
                        <button
                          onClick={(e) => changePriority(job.id, 'high', e)}
                          className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            priority === 'high' ? 'bg-amber-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                          }`}
                          title="ترقية للأولوية القصوى لمعالجته فوراً"
                        >
                          عالية
                        </button>
                        <button
                          onClick={(e) => changePriority(job.id, 'normal', e)}
                          className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            priority === 'normal' ? 'bg-sky-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          عادية
                        </button>
                        <button
                          onClick={(e) => changePriority(job.id, 'low', e)}
                          className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            priority === 'low' ? 'bg-neutral-700 text-white font-bold' : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          منخفضة
                        </button>
                      </div>
                    )}

                    {isCompleted && (
                      <a
                        href={`/api/jobs/${job.id}/download`}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs text-white font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل</span>
                      </a>
                    )}

                    <button
                      onClick={(e) => deleteJob(job.id, e)}
                      className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-rose-400 transition-colors"
                      title="حذف من الطابور"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar if running */}
                {isProcessing && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-300 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        <span>{job.progress.phaseLabelAr}</span>
                        {job.progress.logMessage && (
                          <span className="text-neutral-500 text-[11px]">({job.progress.logMessage})</span>
                        )}
                      </span>
                      <span className="text-rose-400 font-mono font-bold">%{job.progress.percent}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Queued indicator */}
                {isQueued && (
                  <div className="flex items-center justify-between text-xs text-amber-400/90 bg-amber-950/20 px-3 py-1.5 rounded-xl border border-amber-900/40 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>في طابور الانتظار (سيتم البدء تلقائيًا وفق الأولوية)</span>
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {job.resumedFromCrash ? 'جاهز للاستئناف' : 'في الانتظار'}
                    </span>
                  </div>
                )}

                {/* Finished metadata summary */}
                {isCompleted && job.outputMetadata && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-800/60 text-xs text-neutral-400 font-mono">
                    <div>
                      الدقة:{' '}
                      <span className="text-white">
                        {job.outputMetadata.width}×{job.outputMetadata.height}
                      </span>
                    </div>
                    <div>
                      السلاسة:{' '}
                      <span className="text-emerald-400">{job.outputMetadata.fps} FPS</span>
                    </div>
                    <div>
                      الحجم النهائي:{' '}
                      <span className="text-white">{job.outputMetadata.fileSizeFormatted}</span>
                    </div>
                    <div>
                      الترميز:{' '}
                      <span className="text-white uppercase">
                        {job.outputMetadata.videoCodec} High
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
