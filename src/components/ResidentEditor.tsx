import { Info, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCompactLayout } from '../utils/useCompactLayout';
import { QUICK_ADD_CARE_CHIPS } from '../data/residentCarePhrases';
import { getCodeConfig, getTranslatedStopAndWatchLabel, STOP_AND_WATCH_CONFIG, TIER_METADATA } from '../data/stopAndWatchCodes';
import type { AlertThresholds, CareRequirementCategory, HandoffRow } from '../types/handoff';
import { mergeCareRequirementsIntoRow } from '../utils/geminiParser';
import { useHandoffEditorDraft } from '../utils/handoffEditorDraft';
import { l10n, type InterfaceLanguage } from '../utils/localization';
import { ClinicalText } from './ClinicalText';
import { FocusedEditor } from './FocusedEditor';
import { SelectPopover } from './SelectPopover';
import { getStopAndWatchIcon, StopAndWatchDetailModal } from './StopAndWatchIconBadge';
import { Button, ControlledDialog } from './WorkspaceUi';

const sections = {
  metrics: 'Measurements', care: 'Completed care', flags: 'Health changes', notification: 'Nurse notification', note: 'Observations', next: 'Next shift',
} as const;
export type ResidentSection = keyof typeof sections;
export type OpenResidentEditor = (room: string, section: ResidentSection, trigger: HTMLElement, changeNote?: boolean) => void;

const measurements = {
  fluidIntakeMl: 'Fluids (mL)', weightKg: 'Weight (kg)', hoursSinceLastBM: 'Hours since last bowel movement',
} as const;
type NumericField = keyof typeof measurements;
const metricNames = Object.keys(measurements) as NumericField[];
const taskCategories = ['Mobility', 'Dietary', 'Medication', 'Hygiene', 'Other'] as const;

function readFields(row: HandoffRow) {
  const details = row.mltcDetails;
  const changeNote = row.changeNote?.value || '';
  return {
    fluidIntakeMl: String(details?.fluidIntakeMl?.value ?? ''),
    weightKg: String(details?.weightKg?.value ?? ''),
    hoursSinceLastBM: String(details?.hoursSinceLastBM?.value ?? ''),
    bowelMovement: details?.bowelMovement?.value || '',
    lastRepositionTime: details?.lastRepositionTime?.value || '',
    done: row.done?.value || '',
    flags: row.changeCodes?.value || [],
    notified: Boolean(row.toldNurse?.value),
    initials: row.nurseInitials?.value || '',
    observations: details?.qualitativeObservations?.value || (isClinicalNote(changeNote) ? changeNote : ''),
    changeNote,
    next: row.notDoneNextShift?.value === '—' ? '' : row.notDoneNextShift?.value || '',
    tasks: row.careRequirements || [],
    taskText: '',
    taskCategory: 'Mobility' as CareRequirementCategory,
  };
}

function isClinicalNote(value: string) {
  return Boolean(value.trim()) && value !== 'Observed changes' && value !== 'No change';
}

function readNumber(value: string) {
  const normalized = value.trim().replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 15)).replace(/[,٫]/g, '.');
  if (!normalized) return null;
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

type Fields = ReturnType<typeof readFields>;
const fingerprint = (value: unknown) => JSON.stringify(value);

export function ResidentEditor({ row, initialSection, editChangeNote, staffStamp, language, thresholds, onSave, onClose }: {
  row: HandoffRow;
  initialSection: ResidentSection;
  editChangeNote?: boolean;
  staffStamp: string;
  language: InterfaceLanguage;
  thresholds: AlertThresholds;
  onSave: (patch: Partial<HandoffRow>) => void;
  onClose: () => void;
}) {
  const compact = useCompactLayout();
  const sectionKeys = Object.keys(sections) as ResidentSection[];
  const latest = readFields(row);
  const { original, draft, dirty, change, clear } = useHandoffEditorDraft('resident:' + row.room, latest);
  const [section, setSection] = useState(initialSection);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState<keyof Fields | null>(null);
  const [criteria, setCriteria] = useState<string | null>(null);
  const [criteriaClosing, setCriteriaClosing] = useState(false);
  const closeCriteria = () => setCriteriaClosing(true);
  const details = criteria ? getCodeConfig(criteria, thresholds.customCodeTiers) : null;
  const independentChangeNote = isClinicalNote(original.changeNote) && original.changeNote !== original.observations;
  const showChangeNote = editChangeNote || independentChangeNote || original.changeNote !== draft.changeNote;

  function update<K extends keyof Fields>(field: K, value: Fields[K]) {
    change({ ...draft, [field]: value });
    setError('');
    setInvalidField(null);
  }

  function withTask(source = draft.tasks) {
    return mergeCareRequirementsIntoRow(source, [{ category: draft.taskCategory, action_item: draft.taskText.trim() }],
      'Added in resident file', false, staffStamp);
  }

  function reject(field: keyof Fields, nextSection: ResidentSection, message: string) {
    setSection(nextSection);
    setInvalidField(field);
    setError(message);
    requestAnimationFrame(() => document.getElementById('cb-resident-edit-' + field)?.focus());
  }

  function save(finish: () => void) {
    const changed = (field: keyof Fields) => fingerprint(original[field]) !== fingerprint(draft[field]);
    const invalid = metricNames.find((field) => changed(field) && !Number.isFinite(readNumber(draft[field]) ?? 0));
    if (invalid) return reject(invalid, 'metrics', 'Enter a non-negative number.');
    if ((changed('notified') || changed('initials')) && draft.notified && !draft.initials.trim()) {
      return reject('initials', 'notification', 'Enter nurse initials after confirming notification.');
    }

    const conflict = (Object.keys(original) as (keyof Fields)[]).some((key) => changed(key) &&
      fingerprint(original[key]) !== fingerprint(latest[key]) && fingerprint(latest[key]) !== fingerprint(draft[key]));
    const linkedNoteConflict = changed('observations') && !independentChangeNote && latest.changeNote !== original.changeNote &&
      isClinicalNote(latest.changeNote) && latest.changeNote !== draft.observations;
    if (conflict || linkedNoteConflict) {
      setError('This record changed while you were editing. Discard the draft and reopen the editor to use the latest values.');
      return;
    }

    const manual = <T,>(value: T) => ({ value, isPendingConfirmation: false, lastEditedBy: staffStamp });
    const patch: Partial<HandoffRow> = {};
    const updatedDetails = { ...row.mltcDetails };
    let detailsChanged = false;
    for (const field of metricNames) {
      if (changed(field)) {
        updatedDetails[field] = manual(readNumber(draft[field]));
        detailsChanged = true;
      }
    }
    for (const field of ['bowelMovement', 'lastRepositionTime'] as const) {
      if (changed(field)) {
        updatedDetails[field] = manual(draft[field]);
        detailsChanged = true;
      }
    }
    if (changed('observations')) {
      updatedDetails.qualitativeObservations = manual(draft.observations);
      detailsChanged = true;
    }
    if (detailsChanged) patch.mltcDetails = updatedDetails;
    if (changed('done')) patch.done = manual(draft.done);
    if (changed('next')) patch.notDoneNextShift = manual(draft.next);
    if (changed('flags')) patch.changeCodes = manual(draft.flags);
    if (changed('notified')) patch.toldNurse = manual(draft.notified);
    if (changed('notified') || changed('initials')) patch.nurseInitials = manual(draft.notified ? draft.initials.trim() : '');
    if (changed('changeNote')) patch.changeNote = manual(draft.changeNote);
    else if (changed('observations') && !independentChangeNote && !editChangeNote) {
      patch.changeNote = manual(draft.observations || (draft.flags.length ? 'Observed changes' : 'No change'));
    } else if (changed('flags') && !isClinicalNote(latest.changeNote) && !row.changeNote?.isPendingConfirmation) {
      patch.changeNote = manual(latest.observations || (draft.flags.length ? 'Observed changes' : 'No change'));
    }
    if (changed('tasks') || draft.taskText.trim()) {
      const tasks = changed('tasks') ? draft.tasks : latest.tasks;
      patch.careRequirements = draft.taskText.trim() ? withTask(tasks) : tasks;
    }
    if (Object.keys(patch).length) onSave(patch);
    clear();
    finish();
  }

  function textField(field: 'done' | 'observations' | 'changeNote' | 'next', label: string, placeholder?: string) {
    return <label className="block"><span className={field === 'changeNote' ? 'cb-editor-label' : 'sr-only'}>{l10n(label)}</span>
      <textarea dir="auto" className="cb-field" rows={4} value={draft[field]} onChange={(event) => update(field, event.target.value)}
        placeholder={placeholder && l10n(placeholder)} />
    </label>;
  }

  function metricField(field: NumericField | 'bowelMovement' | 'lastRepositionTime', label: string, numeric = false) {
    return <label className="block" key={field}><span className="cb-editor-label">{l10n(label)}</span>
      <input id={'cb-resident-edit-' + field} className="cb-field" dir="auto" value={draft[field]}
        inputMode={numeric ? 'decimal' : undefined} aria-invalid={invalidField === field || undefined}
        aria-describedby={invalidField === field ? 'cb-resident-edit-error' : undefined}
        onChange={(event) => update(field, event.target.value)} />
    </label>;
  }

  return <>
    <FocusedEditor title={l10n('Edit resident')} fullScreen={initialSection !== 'notification' || section !== 'notification'} dirty={dirty} activeSection={section} onClose={onClose}
      subtitle={<><bdi>{row.residentName}</bdi> {l10n('· Room')} <bdi>{row.room}</bdi></>}
      onSave={save} onDiscard={clear}
      sections={<div className="cb-editor-sections" role="group" aria-label={l10n('Edit sections')}>
        {compact
          ? <SelectPopover label={l10n('Edit sections')} value={section} onChange={setSection}
              options={sectionKeys.map((value) => ({ value, label: l10n(sections[value]) }))} />
          : sectionKeys.map((key) => <Button key={key} variant="quiet" aria-pressed={key === section}
              onClick={() => setSection(key)}>{l10n(sections[key])}</Button>)}
      </div>}>
      {!compact && <h3>{l10n(sections[section])}</h3>}
      {error && <p id="cb-resident-edit-error" className="cb-editor-error" role="alert">{l10n(error)}</p>}
      {section === 'metrics' && <div className="cb-editor-grid">
        {metricField('fluidIntakeMl', measurements.fluidIntakeMl, true)}
        {metricField('weightKg', measurements.weightKg, true)}
        {metricField('bowelMovement', 'Bowel movement')}
        {metricField('hoursSinceLastBM', measurements.hoursSinceLastBM, true)}
        {metricField('lastRepositionTime', 'Repositioned')}
      </div>}
      {section === 'care' && <>
        {textField('done', 'Care provided', 'Baths, meals, hygiene, assistance, and mobility completed...')}
        <p className="cb-editor-help mt-2">{l10n('Quick phrases · Add only if actually performed')}</p>
        <div className="cb-editor-phrases">{QUICK_ADD_CARE_CHIPS.map(({ en, labels }) => <Button key={en}
          onClick={() => update('done', draft.done && draft.done !== 'Per care plan' ? `${draft.done}; ${en}` : en)}>
          <Plus aria-hidden="true" />{labels[language] || en}
        </Button>)}</div>
      </>}
      {section === 'flags' && <>
        <div className="cb-editor-grid cb-editor-flags">{STOP_AND_WATCH_CONFIG.map((item) => {
          const selected = draft.flags.includes(item.id);
          const Icon = getStopAndWatchIcon(item.id);
          const label = getTranslatedStopAndWatchLabel(item.id, language, item.plainLabel || item.shortLabel);
          return <div key={item.id} className="flex gap-1 min-w-0">
            <Button className="flex-1 text-start justify-start" aria-pressed={selected} variant={selected ? 'primary' : 'secondary'}
              onClick={() => update('flags', selected ? draft.flags.filter((id) => id !== item.id) : [...draft.flags, item.id])}>
              <Icon aria-hidden="true" /> {label}
            </Button>
            <Button variant="quiet" aria-label={label + ' · ' + l10n('Details')} onClick={() => setCriteria(item.id)}><Info aria-hidden="true" /></Button>
          </div>;
        })}</div>
        {draft.flags.length > 0 && <Button variant="quiet" onClick={() => update('flags', [])}>{l10n('Clear all flags')}</Button>}
      </>}
      {section === 'notification' && <>
        <label className="flex items-center gap-2 min-h-11 mt-2">
          <input type="checkbox" checked={draft.notified} aria-describedby="cb-notification-help"
            onChange={(event) => update('notified', event.target.checked)} />
          {l10n('Told Charge Nurse')}
        </label>
        <p className="cb-editor-help mb-2" id="cb-notification-help">{l10n('Record only after notifying the nurse.')}</p>
        {draft.notified && <label className="block"><span className="cb-editor-label">{l10n('Charge nurse initials')}</span>
          <input id="cb-resident-edit-initials" className="cb-field" value={draft.initials} aria-invalid={invalidField === 'initials' || undefined}
            aria-describedby={invalidField === 'initials' ? 'cb-resident-edit-error' : undefined} onChange={(event) => update('initials', event.target.value)} />
        </label>}
      </>}
      {section === 'note' && <div className="space-y-3">
        {editChangeNote && textField('changeNote', 'Change note')}
        {textField('observations', 'Observations & mood', 'Energy, mood, appetite, skin checks, or family updates...')}
        {!editChangeNote && showChangeNote && textField('changeNote', 'Change note')}
        <ClinicalText text={draft.observations} previewOnly />
      </div>}
      {section === 'next' && <div className="space-y-3">
        {textField('next', 'Next shift', 'Carry-over note for incoming shift (e.g. Offer snack at 15:30)...')}
        {draft.tasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-2">
          <span><bdi>{task.action_item}</bdi> <small>{l10n(task.category)}</small></span>
          <Button variant="quiet" aria-label={l10n('Remove {{p1}}', { p1: task.action_item })}
            onClick={() => update('tasks', draft.tasks.filter(({ id }) => id !== task.id))}><Trash2 aria-hidden="true" /></Button>
        </div>)}
        <div className="cb-editor-grid">
          <SelectPopover label={l10n('Task category')} value={draft.taskCategory} onChange={(value) => update('taskCategory', value)}
            options={taskCategories.map((value) => ({ value, label: l10n(value) }))} />
          <input type="text" className="cb-field" value={draft.taskText} dir="auto" aria-label={l10n('Add follow-up task...')}
            placeholder={l10n('Add follow-up task...')} onChange={(event) => update('taskText', event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (draft.taskText.trim()) change({ ...draft, tasks: withTask(), taskText: '' });
            }} />
          <Button disabled={!draft.taskText.trim()} onClick={() => change({ ...draft, tasks: withTask(), taskText: '' })}>
            <Plus aria-hidden="true" />{l10n('Add')}
          </Button>
        </div>
      </div>}
    </FocusedEditor>
    {details && <ControlledDialog open={!criteriaClosing} label={l10n('Stop & Watch criteria')} onDismiss={closeCriteria}
      onAfterClose={() => { setCriteria(null); setCriteriaClosing(false); }}
      className="cb-editor-criteria cb-motion-dialog cb-adaptive-sheet">
      <StopAndWatchDetailModal embedded config={details} tierMeta={TIER_METADATA[details.defaultTier]} onClose={closeCriteria} />
    </ControlledDialog>}
  </>;
}
