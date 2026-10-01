import React from 'react';
import { NavigationTab } from '../types';
import { ArrowLeft, Play, Cpu, Zap, Sliders, CheckCircle2, Film, Layers } from 'lucide-react';

interface HomeViewProps {
  setActiveTab: (tab: NavigationTab) => void;
  onTrySample: () => void;
  isLoadingSample: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  setActiveTab,
  onTrySample,
  isLoadingSample,
}) => {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-neutral-800/80 bg-[#0E131F]/40 pt-12 pb-16 lg:pt-16 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-right">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                محرك هندسي متكامل لتحسين جودة وتجهيز الفيديوهات لـ TikTok
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.25] text-balance">
                تجهيز هندسي دقيق لفيديوهاتك قبل الرفع، لحماية التفاصيل من خوارزميات الضغط
              </h1>

              <p className="text-base sm:text-lg text-neutral-300 leading-relaxed max-w-2xl">
                يقوم TikTok بإعادة ترميز كل فيديو يُرفع إليه. منصة <span className="text-rose-400 font-semibold">صــف</span> تفحص بنية الإطارات عبر FFprobe، وتضبط مسافة الـ GOP، وتتيح مضاعفة الإطارات إلى 60 FPS عبر RIFE / Motion Flow لضمان أقصى سلاسة ونقاء ممكن.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setActiveTab('enhancer')}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-md shadow-rose-950/60 cursor-pointer"
                >
                  <span>بدء معالجة فيديو</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={onTrySample}
                  disabled={isLoadingSample}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 text-neutral-200 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{isLoadingSample ? 'جاري تجهيز العينة...' : 'تجربة فورية مع فيديو عينة'}</span>
                </button>
              </div>

              {/* Technical badges without pill wrappers */}
              <div className="pt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-neutral-400 border-t border-neutral-800/60">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  H.264 High Profile (Level 4.2)
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  توحيد نسق البكسل BT.709 yuv420p
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  تثبيت GOP = 60 المغلق
                </span>
              </div>
            </div>

            {/* Visual Studio Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl">
                <img
                  src="/src/assets/images/saf_hero_studio_1790873403285.jpg"
                  alt="مختبر صـف لمعالجة الفيديو"
                  referrerPolicy="no-referrer"
                  className="w-full h-80 object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-black/40 to-transparent flex flex-col justify-end p-5">
                  <div className="flex items-center justify-between text-xs text-neutral-300">
                    <span className="font-semibold text-white">معالجة فورية عبر FFmpeg 4.4</span>
                    <span className="font-mono text-emerald-400">1080×1920 @ 60 FPS</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    محاذاة الإطارات المفتاحية بدقة مع خوارزميات Ingest لمنع الضغط التعسفي
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Videos Degrade on TikTok: The Technical Reality */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-right mb-10 space-y-2">
          <div className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
            الحقيقة الهندسية
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            لماذا يفقد الفيديو جودته بعد رفعه إلى تيك توك؟
          </h2>
          <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
            عند رفع الفيديو، تقوم خوادم تيك توك بتحويله آليًا إلى عدة نسخ (ABR Ladders). إذا كان الملف الأصلي يحوي معدلات بت مفرطة أو فترات GOP غير منتظمة، تنهار التفاصيل وتظهر التقطيعات.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-neutral-800 bg-[#0E131F]/50 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-rose-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">فترات GOP المتباعدة (Keyframes)</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              إذا كان الفيديو يحوي فترات طويلة بين الإطارات المفتاحية (I-Frames)، يضطر ترميز تيك توك إلى فرض إطارات عشوائية مسببة تشويشًا وضبابية في المشاهد السريعة. صـف تثبت الـ GOP بدقة كل 60 إطار.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-neutral-800 bg-[#0E131F]/50 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">معدل البت المفرط الخادع (Bitrate)</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              تصدير الفيديو بـ 60 أو 100 ميجابت يجعله فريسة سهلة لضغط تيك توك الجائر ليهبط به إلى 3 ميجابت مع تشوهات ملحوظة. ضبط معدل CRF متوازن بين 17 و 19 يحفظ التفاصيل الحادة دون تحفيز الضغط العنيف.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-neutral-800 bg-[#0E131F]/50 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">سلاسة الحركة والـ 60 FPS</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              مقاطع 24 و 30 إطارًا تبدو متقطعة عند التمرير السريع. مضاعفة الإطارات بتقنية تدفق الحركة البصري (Optical Flow / RIFE) تصنع حركة انسيابية مريحة للعين ترفع مدة بقاء المشاهد.
            </p>
          </div>
        </div>
      </section>

      {/* RIFE and Optical Flow Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-8 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5 text-right">
              <div className="text-xs font-semibold text-emerald-400">محرك RIFE & Motion Interpolation</div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                توليد فريمات بينية ذكية للانتقال من 30 إلى 60 إطارًا بالثانية
              </h2>
              <p className="text-sm text-neutral-300 leading-relaxed">
                لا نستخدم مجرد تكرار بسيط للإطارات (Frame Duplication) الذي لا يضيف أي سلاسة حقيقية. يقوم محرك صـف بحساب متجهات حركة البكسلات (Motion Vectors) بين كل إطارين متتاليين لتوليد إطار وسيط بدقة عالية.
              </p>
              <div className="space-y-2 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>توليد إطارات جديدة بنقاء عالي دون أثر الشبح (Ghosting)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>مسار معالجة خفيف وذكي لا يثقل الخادم، مع تفعيل GPU تلقائيًا عند توفره</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>خيار غير إجباري: أنت تقرر متى يتم تفعيل مضاعفة الحركة</span>
                </div>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('enhancer')}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  تجربة مضاعفة الإطارات الآن
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950">
                <img
                  src="/src/assets/images/saf_motion_flow_1790873413562.jpg"
                  alt="متجهات الحركة البصرية"
                  referrerPolicy="no-referrer"
                  className="w-full h-64 object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Preset Modes Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-right mb-8">
          <div className="text-xs font-semibold text-rose-400">أوضاع التصدير الهندسية</div>
          <h2 className="text-2xl font-bold text-white mt-1">4 أوضاع جاهزة مصممة خصيصًا لكل حاجة</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-neutral-800 bg-[#0E131F]/40 space-y-3">
            <div className="text-xs font-bold text-rose-400">01. جودة متوازنة (الافتراضي)</div>
            <h4 className="text-base font-semibold text-white">1080×1920 @ 60 FPS</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              الخيار الأمثل لمعظم المقاطع. CRF 19 مع H.264 High و مسافة GOP 60 لضمان معالجة سريعة ونقاء عالي.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-neutral-800 bg-[#0E131F]/40 space-y-3">
            <div className="text-xs font-bold text-amber-400">02. أعلى جودة (Max Quality)</div>
            <h4 className="text-base font-semibold text-white">CRF 17 Slow Preset</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              للمقاطع الفنية والدعائية. تحليل أعمق للمشهد، صوت 320 kbps، وتوليد إطارات دقيق جداً بأعلى معدل دقة.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-neutral-800 bg-[#0E131F]/40 space-y-3">
            <div className="text-xs font-bold text-blue-400">03. ملف خفيف (Lightweight)</div>
            <h4 className="text-base font-semibold text-white">حجم مضغوط وسريع</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              مناسب للمقاطع الطويلة وسرعات الإنترنت المحدودة مع الحفاظ على التوافق الكامل مع معايير تيك توك.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-neutral-800 bg-[#0E131F]/40 space-y-3">
            <div className="text-xs font-bold text-purple-400">04. إعدادات مخصصة (Custom)</div>
            <h4 className="text-base font-semibold text-white">تحكم يدوي كامل</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              تحكم فردي في الدقة، معدل البت، نسق البكسل، مسافة الـ GOP، ومستوى الترميز وخوارزمية مضاعفة الحركة.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
