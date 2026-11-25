import { useHandoffEditorDraft } from '../utils/handoffEditorDraft';
import { l10n } from '../utils/localization';
import { ClinicalText } from './ClinicalText';
import { FocusedEditor } from './FocusedEditor';

export function AnythingElseSection({ value, onChange, onClose, isLocked }: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  isLocked: boolean;
}) {
  const { draft, dirty, change, clear, original } = useHandoffEditorDraft('unit', value);
  const conflict = dirty && value !== original && value !== draft;

  return <FocusedEditor title={l10n('Unit notes')} dirty={!isLocked && dirty} readOnly={isLocked}
    onSave={(finish) => {
      if (isLocked || conflict) return;
      onChange(draft);
      clear();
      finish();
    }} onClose={onClose} onDiscard={clear}>
    <div id="handoff-unit-notes" className="space-y-2">
      {isLocked ? <p dir="auto" className="whitespace-pre-wrap">{value || l10n('No unit notes')}</p> :
        <textarea dir="auto" aria-label={l10n('Unit notes')} className="cb-field" value={draft} rows={5}
          onChange={(event) => change(event.target.value)}
          placeholder={l10n('Equipment, supplies, tub room lifts, or unit reminders for next shift...')} />}
      <ClinicalText text={isLocked ? value : draft} previewOnly />
      {conflict && !isLocked && <p className="cb-editor-error" role="alert">
        {l10n('This record changed while you were editing. Discard the draft and reopen the editor to use the latest values.')}
      </p>}
    </div>
  </FocusedEditor>;
}
