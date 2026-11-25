import { l10n } from '../utils/localization';
import { AlertThresholds, HandoffRow } from '../types/handoff';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronRight, CircleAlert, Users, X } from 'lucide-react';
import { SeverityTier } from '../data/stopAndWatchCodes';
import { getResidentStatus } from '../utils/residentStatus';
import { useCompactLayout } from '../utils/useCompactLayout';
import { Button, ControlledDialog } from './WorkspaceUi';

interface ResidentRibbonProps {
  rows: HandoffRow[];
  selectedRoom: string;
  onSelectResident: (room: string) => void;
  customCodeTiers?: Record<string, SeverityTier>;
  thresholds?: AlertThresholds;

}

export const ResidentRibbon = ({ rows, selectedRoom, onSelectResident, customCodeTiers, thresholds }: ResidentRibbonProps) => {
  const compact = useCompactLayout();
  const [choosing, setChoosing] = useState(false);
  const pickerId = useId();
  const rail = useRef<HTMLElement>(null);
  const residents = rows.map((row) => ({ row, status: getResidentStatus(row, thresholds, customCodeTiers) }));
  const pending = residents.filter(({ status }) => status.hasPending).length;
  const selected = rows.find((row) => row.room === selectedRoom);

  useEffect(() => {
    if (compact || !choosing) return;
    setChoosing(false);
  }, [compact, choosing]);

  function choose(room: string) {
    onSelectResident(room);
    setChoosing(false);
  }

  const choices = (
    <div className="cb-roster-list">
      {residents.map(({ row, status }) => {
        const flagged = status.clinicalLevel !== 'routine' || status.hasPending;
        const current = selectedRoom === row.room;
        return (
          <button type="button" key={row.room} aria-current={current ? 'true' : undefined}
            onClick={() => choose(row.room)}>
            <span><strong><bdi>{row.room}</bdi> · <bdi>{row.residentName}</bdi></strong>
              <small>{status.hasPending ? l10n("Pending review") : status.codesCount
                ? l10n('Changes: {{count}}', { count: status.codesCount })
                : flagged ? status.clinicalShortSummary : l10n("No change recorded")}</small>
            </span>
            <span className="cb-roster-status" aria-hidden="true">
              {flagged ? <CircleAlert className={status.isUrgent ? 'cb-urgent' : 'cb-warning'} /> : <Check />}
            </span>
          </button>
        );
      })}
      <button type="button" className="cb-roster-overview" onClick={() => choose('all')}
        aria-current={selectedRoom === 'all' ? 'true' : undefined}>
        <span><strong>{l10n('Overview')}</strong></span><Users aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <>
      <aside ref={rail} className="cb-panel cb-roster" aria-label={l10n("Residents")}>
        <h2>{l10n("Residents ·") + " "}{rows.length}{pending > 0 && <small>{pending}{" " + l10n("to review")}</small>}</h2>
        {choices}
      </aside>
      <Button id={pickerId} className="cb-resident-picker" aria-haspopup="dialog"
        aria-label={l10n('Choose resident')} aria-describedby={pickerId + '-current'} onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setChoosing(true);
        }}>
        <span className="cb-resident-picker-icon"><Users aria-hidden="true" /></span>
        <span className="cb-resident-picker-copy">
          <small>{l10n('Residents ·')} {rows.length}</small>
          <strong id={pickerId + '-current'}>{selected
            ? l10n('{{resident}} · Room {{room}}', { resident: selected.residentName, room: selected.room })
            : l10n('Overview')}</strong>
        </span>
        <ChevronRight aria-hidden="true" />
      </Button>
      <ControlledDialog open={compact && choosing} onDismiss={() => setChoosing(false)}
        onAfterClose={() => {
          if (!compact) rail.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true });
        }}
        label={l10n('Choose resident')} className="cb-resident-chooser cb-adaptive-sheet cb-motion-dialog"
        fallbackFocusId={pickerId}>
        <div className="cb-resident-chooser-head">
          <h2>{l10n('Choose resident')}</h2>
          <Button variant="quiet" aria-label={l10n('Close')} onClick={() => setChoosing(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>
        {choices}
      </ControlledDialog>
    </>
  );
};
