import { SelectPopover } from './SelectPopover';
import { l10n } from '../utils/localization';
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Info, Lock, Mic, Printer, ShieldCheck, SlidersVertical, TriangleAlert,
} from 'lucide-react';
import { AlertThresholds } from '../types/handoff';
import { DEFAULT_THRESHOLDS } from '../data/seedData';
import {
  DEFAULT_CODE_TIERS, SeverityTier, STOP_AND_WATCH_CODES, StopAndWatchCodeConfig,
} from '../data/stopAndWatchCodes';
import './SettingsView.css';
import { Button, PageHeader, StatusToast, WorkspaceFooter } from './WorkspaceUi';

interface SettingsViewProps {
  thresholds: AlertThresholds;
  onUpdateThresholds: (thresholds: AlertThresholds) => void;
  onPrintPaperFallback: () => void;
}

type Page = 'home' | 'rules' | 'thresholds' | 'privacy' | 'about';

const metrics = [
  { key: 'bowelMovementHoursThreshold', name: 'No bowel movement alert', unit: 'h' },
  { key: 'fluidIntakeMinMl', name: 'Daily minimum fluids', unit: 'mL' },
  { key: 'weightChangeKgThreshold', name: 'Weight change alert', unit: 'kg', storedOnly: true },
  { key: 'repositioningMaxHours', name: 'Repositioning interval', unit: 'h', storedOnly: true },
] as const;

type MetricKey = typeof metrics[number]['key'];
type Draft = { kind: 'rules'; values: Record<string, SeverityTier> }
  | { kind: 'thresholds'; values: Record<MetricKey, string> };
type Change = { name: string; before: string; after: string };
type Dialog = { kind: 'pause' | 'discard-home' | 'discard' | 'restore' | 'print' }
  | { kind: 'info'; code: StopAndWatchCodeConfig }
  | { kind: 'review'; changes: Change[]; patch: Partial<AlertThresholds> };

const tierNames: Record<SeverityTier, string> = { 1: 'Monitor', 2: 'This shift', 3: 'Report now' };
const tierOrder = [3, 2, 1] as const;
const tierText = (tier: SeverityTier) => l10n('Tier {{tier}} · {{name}}', { tier, name: l10n(tierNames[tier]) });
const speechDefault = DEFAULT_THRESHOLDS.silenceBufferSeconds ?? 0.8;

const information = {
  privacy: [
    ['Human review', 'Automation assists with documentation. Staff verify extracted entries before submission. Clinical decisions remain with the nurse.'],
    ['Browser storage', 'The browser saves settings, active handoff data and simulated archives, including submitted transcripts, in local storage. Voice drafts and segments use tab session storage.'],
    ['Speech & external processing', 'Browser speech recognition may use an external speech service. Translation can send text to Google, as can Gemini features when configured. The app server caches some results in memory.'],
    ['Access & deployment', 'This prototype is for fictional data. The app has no sign-in or role enforcement. Facility-managed devices, private network access, Canadian hosting and role-based access are proposed production safeguards.'],
  ],
  about: [
    ['CareBridge Handoff', 'Multilingual voice-to-checklist handoff for long-term care. The React interface uses an Express server for extraction and translation.'],
    ['Simulated integration', 'Submitted shifts appear in a read-only archive in this browser. Sync is simulated. There is no live EMR connection.'],
    ['Paper fallback', 'Print blank handoff sheet opens the original CareBridge paper fallback.'],
    ['Future development', 'Live EMR integration, historical contradiction checks and proactive reminders are proposed production features.'],
  ],
} as const;

export const SettingsView: React.FC<SettingsViewProps> = ({ thresholds, onUpdateThresholds, onPrintPaperFallback }) => {
  const [page, setPage] = useState<Page>('home');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pauseDraft, setPauseDraft] = useState(speechDefault);
  const [invalidFields, setInvalidFields] = useState<MetricKey[]>([]);
  const [toast, setToast] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const settingsRoot = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speechPause = thresholds.silenceBufferSeconds ?? speechDefault;
  const currentTiers = { ...DEFAULT_CODE_TIERS, ...thresholds.customCodeTiers };
  const pageTitle = page === 'rules' ? 'Stop & Watch rules' : page === 'thresholds' ? 'Alert thresholds'
    : page === 'privacy' ? 'Privacy & safety' : page === 'about' ? 'About CareBridge' : 'Settings';

  useEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [dialog]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  };

  const openDialog = (next: Dialog, trigger: HTMLElement) => {
    openerRef.current = trigger;
    setDialog(next);
  };

  const closeDialog = () => dialogRef.current?.close();

  const navigate = (next: Page) => {
    setPage(next);
    setDraft(null);
    setInvalidFields([]);
    setToast('');
    requestAnimationFrame(() => {
      const homeRow = next === 'home' && [...(settingsRoot.current?.querySelectorAll<HTMLButtonElement>('.setting') || [])]
        .find((button) => button.dataset.setting === pageTitle);
      (homeRow || headingRef.current)?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
  };

  const edit = () => {
    setInvalidFields([]);
    if (page === 'rules') setDraft({ kind: 'rules', values: currentTiers });
    if (page === 'thresholds') {
      setDraft({
        kind: 'thresholds',
        values: {
          bowelMovementHoursThreshold: String(thresholds.bowelMovementHoursThreshold ?? DEFAULT_THRESHOLDS.bowelMovementHoursThreshold),
          fluidIntakeMinMl: String(thresholds.fluidIntakeMinMl ?? DEFAULT_THRESHOLDS.fluidIntakeMinMl),
          weightChangeKgThreshold: String(thresholds.weightChangeKgThreshold ?? DEFAULT_THRESHOLDS.weightChangeKgThreshold),
          repositioningMaxHours: String(thresholds.repositioningMaxHours ?? DEFAULT_THRESHOLDS.repositioningMaxHours),
        },
      });
    }
    requestAnimationFrame(() => settingsRoot.current?.querySelector<HTMLElement>('.rule-row select, .rule-row input')?.focus());
  };

  const restoreDraft = () => {
    if (draft?.kind === 'rules') setDraft({ kind: 'rules', values: { ...draft.values, ...DEFAULT_CODE_TIERS } });
    if (draft?.kind === 'thresholds') {
      setDraft({
        kind: 'thresholds',
        values: {
          bowelMovementHoursThreshold: String(DEFAULT_THRESHOLDS.bowelMovementHoursThreshold),
          fluidIntakeMinMl: String(DEFAULT_THRESHOLDS.fluidIntakeMinMl),
          weightChangeKgThreshold: String(DEFAULT_THRESHOLDS.weightChangeKgThreshold),
          repositioningMaxHours: String(DEFAULT_THRESHOLDS.repositioningMaxHours),
        },
      });
    }
    setInvalidFields([]);
    closeDialog();
  };

  const finishEditing = () => {
    setDraft(null);
    setInvalidFields([]);
    closeDialog();
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  const review = (trigger: HTMLElement) => {
    if (!draft) return;
    const changes: Change[] = [];
    const patch: Partial<AlertThresholds> = {};
    if (draft.kind === 'rules') {
      const assignments = { ...thresholds.customCodeTiers };
      for (const code of STOP_AND_WATCH_CODES) {
        const before = currentTiers[code.id] ?? code.defaultTier;
        const after = draft.values[code.id];
        if (after !== 1 && after !== 2 && after !== 3) {
          notify('Choose a priority for every rule.');
          return;
        }
        if (before === after) continue;
        assignments[code.id] = after;
        changes.push({ name: code.shortLabel, before: tierText(before), after: tierText(after) });
      }
      if (changes.length) patch.customCodeTiers = assignments;
    } else {
      const invalid = metrics.filter(({ key }) => !Number.isFinite(Number(draft.values[key])) || Number(draft.values[key]) <= 0);
      setInvalidFields(invalid.map(({ key }) => key));
      if (invalid.length) {
        notify('Enter a positive number for every threshold.');
        document.getElementById('settings-' + invalid[0].key)?.focus();
        return;
      }
      for (const { key, name, unit } of metrics) {
        const before = thresholds[key] ?? DEFAULT_THRESHOLDS[key];
        const after = Number(draft.values[key]);
        if (before !== after) {
          patch[key] = after;
          changes.push({ name, before: before + ' ' + unit, after: after + ' ' + unit });
        }
      }
    }
    if (changes.length) openDialog({ kind: 'review', changes, patch }, trigger);
    else notify('No changes to review.');
  };

  const row = (label: string, Icon: typeof Info, action: (trigger: HTMLButtonElement) => void,
    value?: string, tone?: 'neutral' | 'amber', opensDialog = false) => (
    <button type="button" className="setting" data-setting={label} aria-haspopup={opensDialog ? 'dialog' : undefined}
      onClick={(event) => action(event.currentTarget)}>
      <span className={'tile' + (tone ? ' ' + tone : '')}><Icon /></span>
      <span className="name">{l10n(label)}</span>
      {value && <span className="value">{value}</span>}
      <ChevronRight className="chev" />
    </button>
  );

  const renderRules = () => tierOrder.map((tier) => {
    const codes = STOP_AND_WATCH_CODES.filter((code) => (currentTiers[code.id] ?? code.defaultTier) === tier);
    return codes.length > 0 && (
      <section key={tier}>
        <h2 className="group-label">{tierText(tier)}{draft ? l10n(" · Current group") : ''}</h2>
        <div className="cb-panel group">{codes.map((code) => (
          <div className="rule-row" key={code.id} data-rule-id={code.id}>
            <span className="code">{code.letter}</span>
            <span className="name">{l10n(code.shortLabel)}</span>
            <button type="button" className="info" aria-label={l10n('About {{code}}', { code: l10n(code.shortLabel) })} aria-haspopup="dialog"
              onClick={(event) => openDialog({ kind: 'info', code }, event.currentTarget)}><Info /></button>
            {draft?.kind === 'rules' ? (
              <SelectPopover label={l10n('Priority for {{code}}', { code: l10n(code.shortLabel) })}
                value={draft.values[code.id]}
                onChange={(value) => setDraft({ kind: draft.kind, values: { ...draft.values, [code.id]: value } })}
                options={([1, 2, 3] as const).map((value) => ({ value, label: tierText(value) }))} />
            ) : <span className={'tier t' + tier}>{l10n(tierNames[tier])}</span>}
          </div>
        ))}</div>
      </section>
    );
  });

  const renderThresholds = () => (
    <div className="cb-panel group">
      {metrics.map(({ key, name, unit, ...metric }) => <div className="rule-row" key={key}>
        <span className="name">
          {draft?.kind === 'thresholds' ? <label htmlFor={'settings-' + key}>{l10n(name)}</label> : l10n(name)}
          {'storedOnly' in metric && <small className="stored muted">{l10n("Stored only")}</small>}
        </span>
        {draft?.kind === 'thresholds' ? <>
          <input className="cb-field" id={'settings-' + key} type="number" inputMode="decimal" min="0" step="any"
            value={draft.values[key]} aria-invalid={invalidFields.includes(key)}
            onChange={(event) => {
              setDraft({ kind: draft.kind, values: { ...draft.values, [key]: event.target.value } });
              setInvalidFields((fields) => fields.filter((field) => field !== key));
            }} />
          <span className="muted">{unit}</span>
        </> : <span className="value">{thresholds[key] ?? DEFAULT_THRESHOLDS[key]} {unit}</span>}
      </div>)}
    </div>
  );

  const modal = () => {
    if (!dialog) return null;
    let title: string;
    let content: React.ReactNode;
    let confirmLabel: string;
    let confirm: () => void;
    let cancelLabel = 'Cancel';
    switch (dialog.kind) {
      case 'pause':
        title = 'Speech pause';
        content = <>
          <p className="muted">{l10n("Wait this long during a pause before processing speech.")}</p>
          <output htmlFor="settings-pause" className="pause-value">{pauseDraft.toFixed(1)}{" " + l10n("s")}</output>
          <input id="settings-pause" aria-label={l10n("Speech pause in seconds")} type="range" min="0.5" max="2" step="0.1"
            value={pauseDraft} onChange={(event) => setPauseDraft(Number(event.target.value))} />
          <div className="pause-ends muted"><span>{l10n("0.5 s · Shorter")}</span><span>{l10n("2.0 s · Longer")}</span></div>
          <p className="muted">{l10n("Sentence-ending punctuation starts processing immediately.")}</p>
        </>;
        confirmLabel = 'Save';
        confirm = () => {
          onUpdateThresholds({ ...thresholds, silenceBufferSeconds: pauseDraft });
          closeDialog();
          notify('Speech preference saved.');
        };
        break;
      case 'discard-home':
      case 'discard':
        title = 'Discard draft?';
        content = <p>{l10n("Unsaved changes will be lost.")}</p>;
        cancelLabel = 'Keep editing';
        confirmLabel = 'Discard';
        confirm = () => {
          if (dialog.kind === 'discard-home') {
            closeDialog();
            navigate('home');
          } else finishEditing();
        };
        break;
      case 'restore':
        title = 'Restore demo defaults?';
        content = <p>{l10n("This replaces the draft for this section with its original demo values. Review changes before applying.")}</p>;
        confirmLabel = 'Restore draft';
        confirm = restoreDraft;
        break;
      case 'review':
        title = 'Review demo changes';
        content = <>
          <p className="muted">{l10n("Changes apply to this browser’s demo configuration.")}</p>
          {dialog.changes.map(({ name, before, after }) => (
            <div className="diff" key={name}><strong>{l10n(name)}</strong><span>{before} → {after}</span></div>
          ))}
        </>;
        cancelLabel = 'Back';
        confirmLabel = 'Apply demo changes';
        confirm = () => {
          onUpdateThresholds({ ...thresholds, ...dialog.patch });
          finishEditing();
          notify('Demo changes applied.');
        };
        break;
      case 'print':
        title = 'Print blank handoff sheet';
        content = <p>{l10n("Open the existing blank paper handoff in your browser’s print dialog.")}</p>;
        confirmLabel = 'Print blank sheet';
        confirm = () => {
          closeDialog();
          onPrintPaperFallback();
        };
        break;
      case 'info':
        title = dialog.code.shortLabel;
        content = <><p>{l10n(dialog.code.plainLanguageDescription)}</p>
          <p className="muted">{l10n("Rule ID:") + " "}{dialog.code.id}</p>
        </>;
        confirmLabel = 'Done';
        confirm = closeDialog;
        break;
    }
    return <>
      <h2 id="settings-modal-title">{l10n(title)}</h2>
      {content}
      <div className="actions">
        {dialog.kind !== 'info' && <Button onClick={closeDialog}>{l10n(cancelLabel)}</Button>}
        <Button variant="primary" onClick={confirm}>{l10n(confirmLabel)}</Button>
      </div>
    </>;
  };

  const clinical = page === 'rules' || page === 'thresholds';

  return (
    <div className="carebridge-settings" ref={settingsRoot}>
      {page === 'home' ? (
        <>
          <PageHeader ref={headingRef} title={l10n("Settings")} subtitle={l10n("Preferences and prototype configuration")} />
          <section aria-labelledby="settings-preferences">
            <h2 className="group-label" id="settings-preferences">{l10n("Preferences")}</h2>
            <div className="cb-panel group">{row('Speech pause', Mic, (trigger) => {
              setPauseDraft(speechPause);
              openDialog({ kind: 'pause' }, trigger);
            }, speechPause.toFixed(1) + ' s', undefined, true)}</div>
          </section>
          <section aria-labelledby="settings-clinical">
            <h2 className="group-label" id="settings-clinical">{l10n("Clinical configuration")}</h2>
            <div className="cb-panel group">
              {row('Stop & Watch rules', ShieldCheck, () => navigate('rules'), l10n('Rules: {{count}}', { count: STOP_AND_WATCH_CODES.length }), 'amber')}
              {row('Alert thresholds', SlidersVertical, () => navigate('thresholds'), l10n('Thresholds: {{count}}', { count: metrics.length }), 'neutral')}
            </div>
            <p className="muted group-note">{l10n("Prototype rules · Not clinically approved")}</p>
          </section>
          <section aria-labelledby="settings-support">
            <h2 className="group-label" id="settings-support">{l10n("Support")}</h2>
            <div className="cb-panel group">
              {row('Print blank handoff sheet', Printer, (trigger) => openDialog({ kind: 'print' }, trigger), undefined, 'neutral', true)}
              {row('Privacy & safety', Lock, () => navigate('privacy'), undefined, 'neutral')}
              {row('About CareBridge', Info, () => navigate('about'), undefined, 'neutral')}
            </div>
          </section>
          <WorkspaceFooter><span>{l10n("CareBridge · Prototype")}</span></WorkspaceFooter>
        </>
      ) : (
        <>
          <button type="button" className="back" onClick={(event) => {
            if (draft) openDialog({ kind: 'discard-home' }, event.currentTarget);
            else navigate('home');
          }}><ChevronLeft />{" " + l10n("Settings")}</button>
          <PageHeader ref={headingRef} title={l10n(pageTitle)} className="detail-head"
            actions={clinical && !draft && <Button ref={editButtonRef} onClick={edit}>{l10n("Edit demo rules")}</Button>} />
          {clinical ? <>
            <div className="notice"><TriangleAlert /><span>
            {l10n("Prototype configuration only.") + " "}{page === 'rules'
                ? l10n("These tiers are separate from official INTERACT classifications. ")
                : l10n("These values are not approved clinical limits. ")}
              {l10n("Clinical leadership approval is required before real use.")}
            </span></div>
            {page === 'rules' ? renderRules() : renderThresholds()}
            {draft && <div className="actions">
              <Button variant="quiet" onClick={(event) => openDialog({ kind: 'restore' }, event.currentTarget)}>{l10n("Restore demo defaults")}</Button>
              <div className="actions-right">
                <Button onClick={(event) => openDialog({ kind: 'discard' }, event.currentTarget)}>{l10n("Cancel")}</Button>
                <Button variant="primary" onClick={(event) => review(event.currentTarget)}>{l10n("Review changes")}</Button>
              </div>
            </div>}
          </> : (page === 'privacy' || page === 'about') && <div className="group information">
            {information[page].map(([title, copy]) => <section className="detail-text" key={title}>
              <h2>{title}</h2><p className="muted">{l10n(copy)}</p>
            </section>)}
          </div>}
        </>
      )}
      <dialog className="cb-motion-dialog" ref={dialogRef} aria-labelledby="settings-modal-title" onClose={() => {
        setDialog(null);
        const target = openerRef.current;
        if (target?.isConnected) target.focus();
      }}>{modal()}</dialog>
      <StatusToast>{l10n(toast)}</StatusToast>
    </div>
  );
};
