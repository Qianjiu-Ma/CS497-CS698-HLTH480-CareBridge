import React, { useEffect, useRef } from 'react';
import { CircleAlert, FileText, Folder, Globe, HeartPulse, ListChecks, Printer, SlidersHorizontal } from 'lucide-react';
import { InterfaceLanguage, UiTranslations } from '../utils/uiTranslations';
import { Button } from './WorkspaceUi';

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

const languages: { id: InterfaceLanguage; name: string }[] = [
  { id: 'en', name: 'English (CA)' },
  { id: 'tl', name: 'Tagalog' },
  { id: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { id: 'hi', name: 'हिन्दी (Hindi)' },
  { id: 'zh', name: '普通话 (Mandarin)' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' },
  { id: 'ar', name: 'العربية' },
];

export const Navigation: React.FC<NavigationProps> = ({
  currentTab, onTabChange, pendingNurseEscalationsCount, onPrintPaperFallback,
  interfaceLanguage = 'en', onLanguageChange, t,
}) => {
  const navigation = useRef<HTMLElement>(null);
  const isEnglish = interfaceLanguage === 'en';
  const tabs = [
    { id: 'handoff', label: isEnglish ? 'Handoff' : t.tabHandoff, Icon: FileText },
    { id: 'nurse', label: isEnglish ? 'Clinical review' : t.tabNurse, Icon: CircleAlert },
    { id: 'incoming', label: isEnglish ? 'My shift' : t.tabIncoming, Icon: ListChecks },
    { id: 'emr', label: isEnglish ? 'Records' : t.tabEmr, Icon: Folder },
    { id: 'settings', label: isEnglish ? 'Settings' : t.tabSettings, Icon: SlidersHorizontal },
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
        <nav className="cb-nav-tabs" aria-label="Main navigation" ref={navigation}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" data-tab={id} aria-current={id === currentTab ? 'page' : undefined}
              onClick={() => onTabChange(id)}>
              <Icon aria-hidden="true" /> {label}
              {id === 'nurse' && pendingNurseEscalationsCount > 0 && (
                <span className="cb-nav-count" aria-label={pendingNurseEscalationsCount + ' pending reviews'}>
                  {pendingNurseEscalationsCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="cb-nav-tools">
          {onLanguageChange && (
            <label className="cb-button cb-language" title={languages.find(({ id }) => id === interfaceLanguage)?.name}>
              <Globe aria-hidden="true" /> <span aria-hidden="true">{interfaceLanguage.toUpperCase()}</span>
              <select value={interfaceLanguage} aria-label="Global reading language"
                onChange={(event) => onLanguageChange(event.target.value as InterfaceLanguage)}>
                {languages.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          )}
          <Button onClick={onPrintPaperFallback} aria-label={t.printPaperSheet}>
            <Printer aria-hidden="true" /><span className="cb-print-label">{isEnglish ? 'Print' : t.printPaperSheet}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
