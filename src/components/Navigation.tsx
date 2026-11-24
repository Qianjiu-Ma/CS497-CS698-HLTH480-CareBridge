import { l10n } from '../utils/localization';
import React, { useEffect, useRef } from 'react';
import { CircleAlert, FileText, Folder, HeartPulse, ListChecks, Printer, SlidersHorizontal } from 'lucide-react';
import type { InterfaceLanguage } from '../utils/localization';
import { LanguagePicker } from './LanguagePicker';
import { Button } from './WorkspaceUi';

export type ScreenTab = 'handoff' | 'nurse' | 'incoming' | 'emr' | 'settings';

interface NavigationProps {
  currentTab: ScreenTab;
  onTabChange: (tab: ScreenTab) => void;
  pendingNurseEscalationsCount: number;
  onPrintPaperFallback: () => void;
  interfaceLanguage?: InterfaceLanguage;
  onLanguageChange?: (lang: InterfaceLanguage) => void;

}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab, onTabChange, pendingNurseEscalationsCount, onPrintPaperFallback,
  interfaceLanguage = 'en', onLanguageChange,
}) => {
  const navigation = useRef<HTMLElement>(null);
  const tabs = [
    { id: 'handoff', label: l10n('Handoff'), Icon: FileText },
    { id: 'nurse', label: l10n('Clinical review'), Icon: CircleAlert },
    { id: 'incoming', label: l10n('My shift'), Icon: ListChecks },
    { id: 'emr', label: l10n('Records'), Icon: Folder },
    { id: 'settings', label: l10n('Settings'), Icon: SlidersHorizontal },
  ] as const;

  useEffect(() => {
    const strip = navigation.current;
    const active = strip?.querySelector('[aria-current="page"]');
    if (!strip || !active) return;
    const navRect = strip.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.right > navRect.right || activeRect.left < navRect.left) {
      strip.scrollLeft += activeRect.left - navRect.left - (navRect.width - activeRect.width) / 2;
    }
  }, [currentTab, interfaceLanguage]);

  return (
    <header className="cb-navigation no-print">
      <div className="cb-wrap cb-nav-layout">
        <button type="button" className="cb-brand" onClick={() => onTabChange('handoff')}>
          <HeartPulse aria-hidden="true" /> CareBridge
        </button>
        <nav className="cb-nav-tabs" aria-label={l10n("Main navigation")} ref={navigation}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" data-tab={id} aria-current={id === currentTab ? 'page' : undefined}
              onClick={() => onTabChange(id)}>
              <Icon aria-hidden="true" /> {label}
              {id === 'nurse' && pendingNurseEscalationsCount > 0 && (
                <span className="cb-nav-count" aria-label={l10n('Pending reviews: {{count}}', { count: pendingNurseEscalationsCount })}>
                  {pendingNurseEscalationsCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="cb-nav-tools">
          {onLanguageChange && <LanguagePicker language={interfaceLanguage} onChange={onLanguageChange} />}
          <Button onClick={onPrintPaperFallback} aria-label={l10n('Print paper sheet')}>
            <Printer aria-hidden="true" /><span className="cb-print-label">{l10n('Print')}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
