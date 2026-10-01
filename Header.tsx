import React from 'react';
import { NavigationTab } from '../types';
import { Sparkles, Sliders } from 'lucide-react';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  activeJobsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeJobsCount = 0,
}) => {
  const navItems: { id: NavigationTab; label: string; count?: number }[] = [
    { id: 'home', label: 'الرئيسية' },
    { id: 'enhancer', label: 'المحسّن' },
    { id: 'inspector', label: 'تحليل الفيديو' },
    { id: 'jobs', label: 'سجل المعالجات', count: activeJobsCount },
    { id: 'settings', label: 'الإعدادات' },
    { id: 'account', label: 'الحساب' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0B0F17]/95 backdrop-blur-md border-b border-neutral-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 group text-right focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-rose-900/40">
              ص
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-rose-400 transition-colors">
              صـــف
            </span>
          </button>
        </div>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative py-1.5 transition-colors whitespace-nowrap focus:outline-none ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>{item.label}</span>
                {item.count && item.count > 0 ? (
                  <span className="mr-1.5 text-xs text-rose-400 font-mono">
                    ({item.count})
                  </span>
                ) : null}
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-rose-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('enhancer')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 rounded-lg shadow-sm shadow-rose-950 transition-all cursor-pointer whitespace-nowrap focus:ring-2 focus:ring-rose-500/50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>بدء التحسين لـ TikTok</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-neutral-800/60 bg-[#0E131F] py-2 px-2 overflow-x-auto text-xs">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === item.id
                ? 'bg-neutral-800 text-rose-400 font-medium'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};
