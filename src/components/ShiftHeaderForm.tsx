import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { ShiftHeader } from '../types/handoff';
import { useHandoffEditorDraft } from '../utils/handoffEditorDraft';
import { l10n } from '../utils/localization';
import { FocusedEditor } from './FocusedEditor';
import { SelectPopover } from './SelectPopover';
import { Button, PageHeader } from './WorkspaceUi';

type Props = { header: ShiftHeader; onChange: (header: ShiftHeader) => void; isLocked?: boolean };
const fields = {
  unit: 'Unit', date: 'Date', shift: 'Shift', outgoingPsw: 'Outgoing staff', incomingPsw: 'Incoming staff',
} as const;
const shiftOptions = [
  { value: 'Day (07:00 - 15:00)', label: 'Day (07:00 – 15:00)' },
  { value: 'Evening (15:00 - 23:00)', label: 'Evening (15:00 – 23:00)' },
  { value: 'Night (23:00 - 07:00)', label: 'Night (23:00 – 07:00)' },
] as const;

export function ShiftHeaderForm({ header, onChange, isLocked = false }: Props) {
  const [open, setOpen] = useState(false);
  const label = l10n(isLocked ? 'Shift details' : 'Edit shift');

  return <>
    <PageHeader title={l10n('Handoff')} actions={<Button aria-haspopup="dialog" onClick={(event) => {
      event.currentTarget.focus({ preventScroll: true });
      setOpen(true);
    }}><Pencil aria-hidden="true" /> {label}</Button>} />
    {open && <ShiftEditor header={header} onChange={onChange} isLocked={isLocked} onClose={() => setOpen(false)} />}
  </>;
}

function ShiftEditor({ header, onChange, isLocked, onClose }: Props & { onClose: () => void }) {
  const { draft, original, dirty, change, clear } = useHandoffEditorDraft('shift', header);
  const [invalid, setInvalid] = useState<keyof ShiftHeader | null>(null);
  const [conflict, setConflict] = useState(false);
  const display = isLocked ? header : draft;

  function save(finish: () => void) {
    if (isLocked) return;
    const changed = (Object.keys(fields) as (keyof ShiftHeader)[]).filter((field) => draft[field] !== original[field]);
    if (changed.some((field) => header[field] !== original[field] && header[field] !== draft[field])) {
      setConflict(true);
      return;
    }
    const next = { ...header, ...Object.fromEntries(changed.map((field) => [field, draft[field]])) };
    const missing = (Object.keys(fields) as (keyof ShiftHeader)[]).find((field) => !next[field].trim());
    if (missing) {
      setInvalid(missing);
      document.getElementById('cb-edit-shift-' + missing)?.focus();
      return;
    }
    onChange(next);
    clear();
    finish();
  }

  return <FocusedEditor title={l10n(isLocked ? 'Shift details' : 'Edit shift')} dirty={!isLocked && dirty} readOnly={isLocked}
    onSave={save} onClose={onClose} onDiscard={clear}>
    {invalid && <p className="cb-editor-error" id="cb-shift-edit-error" role="alert">{l10n('Complete all shift fields.')}</p>}
    {conflict && <p className="cb-editor-error" role="alert">{l10n('This record changed while you were editing. Discard the draft and reopen the editor to use the latest values.')}</p>}
    <div className="cb-editor-grid">{(Object.keys(fields) as (keyof ShiftHeader)[]).map((field) => <div key={field}>
      <label className="cb-editor-label" htmlFor={'cb-edit-shift-' + field}>{l10n(fields[field])}</label>
      {field === 'shift' ? <SelectPopover id="cb-edit-shift-shift" label={l10n('Shift')} value={display.shift} disabled={isLocked}
        options={shiftOptions.map(({ value, label }) => ({ value, label: l10n(label) }))}
        onChange={(shift) => change({ ...draft, shift })} /> : <input id={'cb-edit-shift-' + field} className="cb-field"
        type={field === 'date' ? 'date' : 'text'} dir="auto" value={display[field]} readOnly={isLocked} required
        aria-invalid={invalid === field || undefined} aria-describedby={invalid === field ? 'cb-shift-edit-error' : undefined}
        onChange={(event) => { setInvalid(null); change({ ...draft, [field]: event.target.value }); }} />}
    </div>)}</div>
  </FocusedEditor>;
}
