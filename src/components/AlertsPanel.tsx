import React, { useState } from 'react';
import { DeterministicAlert, HandoffRow } from '../types/handoff';
import { formatToldNurseLabel } from '../utils/residentStatus';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AlertsPanelProps {
  alerts: DeterministicAlert[];
  onMarkPerCarePlan: (room: string) => void;
  onQuickNotifyNurse: (room: string) => void;
  onSelectResident?: (room: string) => void;
  rows: HandoffRow[];
}

function getCompactAlertSummary(alert: DeterministicAlert, matchedRow?: HandoffRow): string {
  switch (alert.type) {
    case 'bm_overdue': {
      const hours = matchedRow?.mltcDetails?.hoursSinceLastBM?.value;
      return hours !== null && hours !== undefined
        ? `BM overdue (${hours}h) — bowel protocol check`
        : 'BM overdue (>48h) — bowel protocol check';
    }
    case 'nurse_escalation': {
      const codeMatch = alert.message.match(/\[([^\]]+)\]/);
      const codes = codeMatch ? codeMatch[1] : '';
      return codes
        ? `Stop & Watch (${codes}) — Charge Nurse notification needed`
        : 'Charge Nurse notification needed';
    }
    case 'fluid_low':
      return alert.message.replace(/^.*?recorded /, 'Fluid intake ').replace(/, which is below.*$/, '');
    case 'missing_care':
      return 'No care recorded yet';
    case 'missing_required':
      return 'Missing mood & observations note';
    default:
      return alert.title;
  }
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onMarkPerCarePlan,
  onQuickNotifyNurse,
  onSelectResident,
  rows,
}) => {
  const [showSecondaryDetails, setShowSecondaryDetails] = useState(false);

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-emerald-800 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>All shift checks complete</span>
      </div>
    );
  }

  const nurseAlerts = alerts.filter((a) => a.severity === 'critical_nurse');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const missingAlerts = alerts.filter((a) => a.severity === 'info_missing');
  const secondaryAlerts = [...warningAlerts, ...missingAlerts];

  const warningRooms = Array.from(new Set(warningAlerts.map((a) => a.room)));
  const missingRooms = Array.from(new Set(missingAlerts.map((a) => a.room)));

  return (
    <section
      aria-label="Clinical alerts"
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100"
    >
      {/* Always-Visible Urgent Clinical & Nurse Alerts */}
      {nurseAlerts.map((alert) => {
        const matchedRow = rows.find((r) => r.room === alert.room);
        const alreadyTold = Boolean(matchedRow?.toldNurse?.value);
        const toldLabel = formatToldNurseLabel(matchedRow?.nurseInitials?.value);

        return (
          <div
            key={alert.id}
            className={`flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 text-xs ${
              alreadyTold ? 'bg-amber-50/55' : 'bg-rose-50/75'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1 leading-snug">
              <BellRing
                className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                  alreadyTold ? 'text-amber-700' : 'text-rose-700'
                }`}
              />
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-slate-900">
                  <span className="font-mono tabular-nums">Rm {alert.room}</span> {alert.residentName}
                </span>
                <span className="text-slate-400"> · </span>
                <span className={alreadyTold ? 'text-amber-950 font-medium' : 'text-rose-950 font-medium'}>
                  {getCompactAlertSummary(alert, matchedRow)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onSelectResident && (
                <button
                  type="button"
                  onClick={() => onSelectResident(alert.room)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-950 hover:bg-white/80 rounded-lg transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]"
                >
                  Open
                </button>
              )}

              {alreadyTold ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 px-2 py-0.5 whitespace-nowrap">
                  <Check className="w-3 h-3 shrink-0" />
                  <span>{toldLabel}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onQuickNotifyNurse(alert.room)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap active:scale-[0.98]"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark told nurse</span>
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Compact Secondary Warnings & Documentation Checks Strip */}
      {secondaryAlerts.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-50/60 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              {warningAlerts.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <span className="font-medium text-amber-950">
                    Low fluids ({warningAlerts.length}):
                  </span>
                  {warningRooms.map((room, idx) => (
                    <React.Fragment key={`w-${room}`}>
                      {idx > 0 && <span className="text-slate-400">,</span>}
                      <button
                        type="button"
                        onClick={() => onSelectResident && onSelectResident(room)}
                        className="font-mono tabular-nums font-medium text-teal-800 hover:underline cursor-pointer"
                      >
                        Rm {room}
                      </button>
                    </React.Fragment>
                  ))}
                </span>
              )}

              {warningAlerts.length > 0 && missingAlerts.length > 0 && (
                <span className="text-slate-300" aria-hidden="true">·</span>
              )}

              {missingAlerts.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <span className="font-medium text-slate-700">
                    Missing notes ({missingAlerts.length}):
                  </span>
                  {missingRooms.map((room, idx) => (
                    <React.Fragment key={`m-${room}`}>
                      {idx > 0 && <span className="text-slate-400">,</span>}
                      <button
                        type="button"
                        onClick={() => onSelectResident && onSelectResident(room)}
                        className="font-mono tabular-nums font-medium text-teal-800 hover:underline cursor-pointer"
                      >
                        Rm {room}
                      </button>
                    </React.Fragment>
                  ))}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSecondaryDetails((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>{showSecondaryDetails ? 'Hide' : 'Details'}</span>
              {showSecondaryDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {showSecondaryDetails && (
            <div className="divide-y divide-slate-100 border-t border-slate-100 bg-white">
              {secondaryAlerts.map((alert) => {
                const matchedRow = rows.find((r) => r.room === alert.room);
                return (
                  <div
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1 text-slate-700 leading-snug">
                      <span className="font-semibold text-slate-900">
                        <span className="font-mono tabular-nums">Rm {alert.room}</span> {alert.residentName}
                      </span>
                      <span className="text-slate-400"> — </span>
                      <span>{getCompactAlertSummary(alert, matchedRow)}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.type === 'missing_care' && (
                        <button
                          type="button"
                          onClick={() => onMarkPerCarePlan(alert.room)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap active:scale-[0.98]"
                        >
                          Mark routine care
                        </button>
                      )}
                      {onSelectResident && (
                        <button
                          type="button"
                          onClick={() => onSelectResident(alert.room)}
                          className="px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
