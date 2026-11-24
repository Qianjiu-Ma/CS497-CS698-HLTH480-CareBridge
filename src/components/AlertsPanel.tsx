import React, { useId, useState } from 'react';
import { Check, ChevronDown, CircleAlert } from 'lucide-react';
import { AlertThresholds, DeterministicAlert, HandoffRow, NurseEscalation } from '../types/handoff';
import { buildIncomingResidents } from '../utils/incomingShift';
import { Button } from './WorkspaceUi';

interface AlertsPanelProps {
  alerts: DeterministicAlert[];
  onMarkPerCarePlan: (room: string) => void;
  onQuickNotifyNurse: (room: string) => void;
  onSelectResident: (room: string) => void;
  rows: HandoffRow[];
  thresholds: AlertThresholds;
  escalations: NurseEscalation[];
  isLocked: boolean;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts, onMarkPerCarePlan, onQuickNotifyNurse, onSelectResident, rows, thresholds, escalations, isLocked,
}) => {
  const [showChecks, setShowChecks] = useState(false);
  const checksId = useId();
  const concerns = buildIncomingResidents(rows, escalations, thresholds)
    .filter((resident) => resident.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  const checks = alerts.filter((alert) => {
    const concern = concerns.find(({ row }) => row.room === alert.room);
    if (!concern) return true;
    if (alert.type === 'nurse_escalation' || alert.type === 'bm_overdue') return false;
    return alert.type !== 'fluid_low' || !concern.summary.includes(' mL');
  });
  const urgentChecks = checks.filter((alert) => alert.severity === 'critical_nurse');
  const otherChecks = checks.filter((alert) => alert.severity !== 'critical_nurse');

  const renderCheck = (alert: DeterministicAlert) => {
    const urgent = alert.severity === 'critical_nurse';
    return (
      <div key={alert.id} className="cb-handoff-alert" data-tone={urgent ? 'urgent' : undefined}>
        {urgent && <CircleAlert aria-hidden="true" className="cb-alert-symbol" />}
        <div className="cb-alert-copy"><strong>{alert.room} · {alert.title}</strong>
          <span> · {alert.message}</span></div>
        <div className="cb-alert-actions">
          {!isLocked && alert.type === 'missing_care' && (
            <Button variant="quiet" onClick={() => onMarkPerCarePlan(alert.room)}>Mark routine care</Button>
          )}
          <Button variant="quiet" onClick={() => onSelectResident(alert.room)}
            aria-label={'Open room ' + alert.room}>Open</Button>
          {!isLocked && urgent && !rows.find((row) => row.room === alert.room)?.toldNurse?.value && (
            <Button variant="quiet" onClick={() => onQuickNotifyNurse(alert.room)}
              aria-label={'Mark told nurse for room ' + alert.room}>Mark told nurse</Button>
          )}
        </div>
      </div>
    );
  };

  if (!concerns.length && !checks.length) return (
    <p className="cb-checks-clear"><Check /> No shift alerts</p>
  );

  return (
    <section aria-label="Clinical alerts" className="cb-panel cb-handoff-alerts">
      {concerns.map(({ row, status, title, summary, notified, unverified }) => (
        <div key={row.room} className="cb-handoff-alert" data-tone={status.isUrgent ? 'urgent' : 'warning'}>
          <CircleAlert aria-hidden="true" className="cb-alert-symbol" />
          <div className="cb-alert-copy">
            <strong>{row.room} · {title}</strong>
            {summary && <span> · {summary}</span>}
            {unverified && <span> · Unverified handoff entries</span>}
            {(status.needsNurseAction || notified === 'RN notification unverified') && (
              <span> · {notified === 'RN notification unverified' ? notified : status.nurseLabel}</span>
            )}
          </div>
          <div className="cb-alert-actions">
            <Button variant="quiet" onClick={() => onSelectResident(row.room)}
              aria-label={'Open room ' + row.room}>Open</Button>
            {!isLocked && alerts.some((alert) => alert.room === row.room && alert.severity === 'critical_nurse') &&
              notified !== 'RN notified' && (
              <Button variant="quiet" onClick={() => onQuickNotifyNurse(row.room)}
                aria-label={'Mark told nurse for room ' + row.room}>Mark told nurse</Button>
            )}
          </div>
        </div>
      ))}
      {urgentChecks.map(renderCheck)}
      {!!otherChecks.length && (
        <div>
          <button type="button" className="cb-checks-toggle" aria-expanded={showChecks} aria-controls={checksId}
            onClick={() => setShowChecks(!showChecks)}>
            Other checks <span>{otherChecks.length}</span> <ChevronDown className="cb-disclosure-icon" aria-hidden="true" />
          </button>
          <div id={checksId} hidden={!showChecks}>
            {otherChecks.map(renderCheck)}
          </div>
        </div>
      )}
    </section>
  );
};
