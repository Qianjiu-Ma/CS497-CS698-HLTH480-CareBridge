import { l10n } from '../utils/localization';
import { AlertThresholds, HandoffRow } from '../types/handoff';
import { Check, CircleAlert, Users } from 'lucide-react';
import { SeverityTier } from '../data/stopAndWatchCodes';
import { getResidentStatus } from '../utils/residentStatus';

interface ResidentRibbonProps {
  rows: HandoffRow[];
  selectedRoom: string;
  onSelectResident: (room: string) => void;
  customCodeTiers?: Record<string, SeverityTier>;
  thresholds?: AlertThresholds;

}

export const ResidentRibbon = ({ rows, selectedRoom, onSelectResident, customCodeTiers, thresholds }: ResidentRibbonProps) => {
  const residents = rows.map((row) => ({ row, status: getResidentStatus(row, thresholds, customCodeTiers) }));
  const pending = residents.filter(({ status }) => status.hasPending).length;
  return (
    <aside className="cb-panel cb-roster" aria-label={l10n("Residents")}>
      <h2>{l10n("Residents ·") + " "}{rows.length}{pending > 0 && <small>{pending}{" " + l10n("to review")}</small>}</h2>
      <div className="cb-roster-list">
        {residents.map(({ row, status }) => {
          const flagged = status.clinicalLevel !== 'routine' || status.hasPending;
          return (
            <button type="button" key={row.room} aria-current={selectedRoom === row.room ? 'true' : undefined}
              onClick={() => onSelectResident(row.room)}>
              <span><strong>{row.room} · {row.residentName}</strong>
                <small>{status.hasPending ? l10n("Pending review") : status.codesCount
                  ? status.codesCount + (status.codesCount === 1 ? ' change' : ' changes')
                  : flagged ? status.clinicalShortSummary : l10n("No change recorded")}</small>
              </span>
              {flagged ? <CircleAlert className={status.isUrgent ? 'cb-urgent' : 'cb-warning'} aria-hidden="true" />
                : <Check aria-hidden="true" />}
            </button>
          );
        })}
        <button type="button" className="cb-roster-overview" onClick={() => onSelectResident('all')}
          aria-current={selectedRoom === 'all' ? 'true' : undefined}>
          <span><strong>{l10n('Overview')}</strong></span><Users aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
