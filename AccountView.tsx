import React from 'react';
import { User, ShieldCheck, Zap, Film, Award, Check } from 'lucide-react';

export const AccountView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-right">
      <div className="border-b border-neutral-800/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          الملف الشخصي والحساب
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          إدارة حساب صانع المحتوى وإعدادات المنصة الشخصية
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-4 rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-rose-500 shadow-xl">
              <img
                src="/src/assets/images/saf_user_avatar_1790873426616.jpg"
                alt="الصورة الشخصية"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">أحمد بن خالد</h3>
              <p className="text-xs text-neutral-400">صانع ومحرر محتوى TikTok & Reels</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold">
              <Award className="w-3.5 h-3.5" />
              <span>باقة المحترفين (Pro Studio)</span>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4 space-y-3 text-xs">
            <div className="flex justify-between text-neutral-400">
              <span>البريد الإلكتروني</span>
              <span className="text-white font-mono">creator@saf.media</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>حالة الخادم</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                متصل وجاهز
              </span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>استهلاك المعالجة</span>
              <span className="text-white font-mono">غير محدود (خادم خاص)</span>
            </div>
          </div>
        </div>

        {/* Detailed Stats and Preferences */}
        <div className="lg:col-span-8 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-neutral-800 bg-[#0E131F] space-y-1">
              <div className="text-neutral-500 text-xs">الفيديوهات المحسنة</div>
              <div className="text-2xl font-bold font-mono text-white">48</div>
              <div className="text-[11px] text-emerald-400">جميعها بترميز H.264 High</div>
            </div>

            <div className="p-5 rounded-2xl border border-neutral-800 bg-[#0E131F] space-y-1">
              <div className="text-neutral-500 text-xs">مقاطع تم تحويلها لـ 60 FPS</div>
              <div className="text-2xl font-bold font-mono text-rose-400">35</div>
              <div className="text-[11px] text-neutral-400">سلاسة حركة بصرية RIFE</div>
            </div>

            <div className="p-5 rounded-2xl border border-neutral-800 bg-[#0E131F] space-y-1">
              <div className="text-neutral-500 text-xs">متوسط توفير النطاق الترددي</div>
              <div className="text-2xl font-bold font-mono text-emerald-400">32%</div>
              <div className="text-[11px] text-neutral-400">مع الحفاظ الكامل على النقاء</div>
            </div>
          </div>

          {/* Preferences */}
          <div className="rounded-2xl border border-neutral-800 bg-[#0E131F] p-6 space-y-4 text-xs">
            <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-3">
              التفضيلات الافتراضية للتصدير
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer">
                <div>
                  <span className="font-semibold text-white block">
                    اقتراح مضاعفة الإطارات إلى 60 FPS تلقائياً
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    تحليل معدل إطارات المصدر وتقديم خيار RIFE عند الحاجة
                  </span>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded accent-rose-600 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer">
                <div>
                  <span className="font-semibold text-white block">
                    تطبيق moov atom faststart دائمًا
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    يضمن بدء تشغيل الفيديو فورًا دون انتظار اكتمال تحميله
                  </span>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded accent-rose-600 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer">
                <div>
                  <span className="font-semibold text-white block">
                    تنبيه صوتي خفيف عند اكتمال الترميز
                  </span>
                  <span className="text-neutral-400 text-[11px]">
                    إشعار صوتي عند انتهاء مرحلة معالجة الملف
                  </span>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded accent-rose-600 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
