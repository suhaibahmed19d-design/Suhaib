import React from 'react';
import { NavigationTab } from '../types';
import { ShieldCheck, Cpu } from 'lucide-react';

interface FooterProps {
  setActiveTab: (tab: NavigationTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab }) => {
  return (
    <footer className="border-t border-neutral-800/80 bg-[#080B11] text-neutral-400 text-xs py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center text-white font-bold text-xs">
                ص
              </div>
              <span className="text-sm font-bold text-white tracking-wide">صـــف للهندسة المرئية</span>
            </div>
            <p className="text-neutral-400 leading-relaxed max-w-md">
              منصة هندسية لتجهيز وضبط ترميز الفيديوهات قبل رفعها إلى TikTok. تعتمد على محركات FFmpeg المدمجة
              ومضاعفة الإطارات AI (RIFE / Optical Flow) للحد من تشوهات الضغط وفقدان التفاصيل.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-neutral-500 pt-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                حذف تلقائي للملفات المؤقتة
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-rose-500" />
                معالجة محلية على مستوى الخادم
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-neutral-200 font-semibold mb-3">أدوات المنصة</h4>
            <ul className="space-y-2 text-neutral-400">
              <li>
                <button
                  onClick={() => setActiveTab('enhancer')}
                  className="hover:text-white transition-colors"
                >
                  محسّن الفيديو لـ TikTok
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('inspector')}
                  className="hover:text-white transition-colors"
                >
                  محلل الخصائص العميقة (FFprobe)
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="hover:text-white transition-colors"
                >
                  طابور وسجل المعالجة
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="hover:text-white transition-colors"
                >
                  فحص تسريع العتاد
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-neutral-200 font-semibold mb-3">شفافية تقنية</h4>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              يقوم TikTok بمعالجة وضغط كافة الفيديوهات عبر خوادمه بشكل حتمي. لا توجد أداة تمنع الضغط بالكامل، ولكن مطابقة الترميز والأبعاد ومسافة GOP تحافظ على أقصى نقاء بصري ممكن.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-900 flex flex-col sm:flex-row items-center justify-between text-neutral-500 text-[11px]">
          <p>© {new Date().getFullYear()} منصة صــف. جميع الحقوق محفوظة لمهندسي وصنّاع المحتوى المرئي.</p>
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <span>النسخة التقنية v1.4</span>
            <span>·</span>
            <span>FFmpeg 4.4.2 Core</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
