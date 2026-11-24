import React from 'react';
import { Printer, Globe } from 'lucide-react';
import { InterfaceLanguage, UiTranslations } from '../utils/uiTranslations';

export type ScreenTab = 'handoff' | 'nurse' | 'incoming' | 'emr' | 'settings';

interface NavigationProps {
  currentTab: ScreenTab;
  onTabChange: (tab: ScreenTab) => void;
  pendingNurseEscalationsCount: number;
  onPrintPaperFallback: () => void;
  interfaceLanguage?: InterfaceLanguage;
  onLanguageChange?: (lang: InterfaceLanguage) => void;
  t: UiTranslations;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  pendingNurseEscalationsCount,
  onPrintPaperFallback,
  interfaceLanguage = 'en',
  onLanguageChange,
  t,
}) => {
  const navItems: { id: ScreenTab; label: string; count?: number }[] = [
    { id: 'handoff', label: t.tabHandoff },
    { id: 'nurse', label: t.tabNurse, count: pendingNurseEscalationsCount },
    { id: 'incoming', label: t.tabIncoming },
    { id: 'emr', label: t.tabEmr },
    { id: 'settings', label: t.tabSettings },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/90 translucent-chrome no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 h-14">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onTabChange('handoff')}
          className="text-left cursor-pointer focus:outline-none active:scale-[0.98] transition-transform shrink-0"
        >
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            {t.appName}
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 h-full">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`relative h-full inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 focus:outline-none ${
                  isActive
                    ? 'text-teal-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-mono tabular-nums leading-none">
                    {item.count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-700 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Global Reading Language & Print */}
        <div className="flex items-center gap-2 shrink-0">
          {onLanguageChange && (
            <label className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 transition-colors cursor-pointer">
              <Globe className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="font-medium text-slate-500 hidden sm:inline whitespace-nowrap">
                Read in:
              </span>
              <select
                value={interfaceLanguage}
                onChange={(e) => onLanguageChange(e.target.value as InterfaceLanguage)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer text-xs"
                aria-label="Global reading language"
                title="Set reading language for interface and clinical records"
              >
                <option value="en">English (CA)</option>
                <option value="tl">Tagalog</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="zh">普通话 (Mandarin)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={onPrintPaperFallback}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
            title="Print official paper backup shift sheet"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">{t.printPaperSheet}</span>
          </button>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2 border-t border-slate-200/70 bg-slate-50/80 text-xs">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-teal-700 text-white font-semibold'
                  : 'text-slate-700 hover:bg-slate-200/70 font-medium'
              }`}
            >
              <span>{item.label}</span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span
                  className={`font-mono tabular-nums text-[10px] px-1 rounded ${
                    isActive ? 'bg-teal-800 text-white' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
