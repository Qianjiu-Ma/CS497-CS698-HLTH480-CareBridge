import React from 'react';
import { AlertThresholds, HandoffRow } from '../types/handoff';
import { Users, AlertTriangle, OctagonAlert, CheckCircle2, Info } from 'lucide-react';
import { SeverityTier } from '../data/stopAndWatchCodes';
import { UiTranslations } from '../utils/uiTranslations';
import { getResidentStatus } from '../utils/residentStatus';

interface ResidentRibbonProps {
  rows: HandoffRow[];
  selectedRoom: string | 'all';
  onSelectResident: (room: string | 'all') => void;
  customCodeTiers?: Record<string, SeverityTier>;
  thresholds?: AlertThresholds;
  t: UiTranslations;
}

export const ResidentRibbon: React.FC<ResidentRibbonProps> = ({
  rows,
  selectedRoom,
  onSelectResident,
  customCodeTiers,
  thresholds,
  t,
}) => {
  const totalPendingCount = rows.reduce((sum, r) => {
    const status = getResidentStatus(r, thresholds, customCodeTiers);
    return sum + (status.hasPending ? 1 : 0);
  }, 0);

  return (
    <aside
      aria-label="Residents"
      className="bg-white border border-slate-200 rounded-2xl p-2 lg:sticky lg:top-20"
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 text-xs">
        <span className="font-semibold text-slate-500">
          Residents ({rows.length})
        </span>
        {totalPendingCount > 0 && (
          <span className="font-medium text-amber-800 font-mono tabular-nums">
            {totalPendingCount} to review
          </span>
        )}
      </div>

      {/* Desktop: vertical roster list; Mobile/Tablet: horizontal scrollable strip */}
      <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
        {/* All Residents Overview */}
        <button
          type="button"
          onClick={() => onSelectResident('all')}
          className={`shrink-0 lg:w-full px-3 py-2 rounded-xl text-left transition-colors cursor-pointer active:scale-[0.98] flex items-center justify-between gap-2.5 ${
            selectedRoom === 'all'
              ? 'bg-teal-700 text-white'
              : 'hover:bg-slate-100 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Users
              className={`w-4 h-4 shrink-0 ${
                selectedRoom === 'all' ? 'text-teal-100' : 'text-teal-700'
              }`}
            />
            <span className="text-xs font-semibold">{t.overview}</span>
          </div>
          <span
            className={`text-xs font-mono tabular-nums font-semibold ${
              selectedRoom === 'all' ? 'text-teal-100' : 'text-slate-400'
            }`}
          >
            {rows.length}
          </span>
        </button>

        <div className="hidden lg:block h-px bg-slate-100 my-1 mx-2" />

        {/* Individual Resident Entries */}
        {rows.map((row) => {
          const isSelected = selectedRoom === row.room;
          const status = getResidentStatus(row, thresholds, customCodeTiers);
          const hasUnnotifiedUrgent = status.nurseState === 'notify_now';
          const hasUnnotifiedShift = status.nurseState === 'notify_shift';
          const hasClinicalAlert = status.clinicalLevel === 'urgent' || status.clinicalLevel === 'elevated';

          return (
            <button
              key={row.room}
              type="button"
              onClick={() => onSelectResident(row.room)}
              className={`shrink-0 lg:w-full min-w-[172px] lg:min-w-0 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer active:scale-[0.98] flex items-start justify-between gap-2 ${
                isSelected
                  ? 'bg-teal-700 text-white'
                  : hasUnnotifiedUrgent
                  ? 'bg-rose-50/75 hover:bg-rose-100/75 text-rose-950'
                  : hasUnnotifiedShift
                  ? 'bg-amber-50/75 hover:bg-amber-100/75 text-amber-950'
                  : status.clinicalLevel === 'urgent'
                  ? 'bg-amber-50/40 hover:bg-amber-50/80 text-slate-900'
                  : 'hover:bg-slate-100 text-slate-800'
              }`}
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                      isSelected ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    {row.room}
                  </span>
                  <span className="text-sm font-semibold leading-snug">
                    {row.residentName}
                  </span>
                </div>

                {/* Orthogonal Clinical Concern + Nurse Status + Review */}
                <div className="text-[11px] leading-snug space-y-0.5">
                  <div
                    className={
                      isSelected
                        ? 'text-teal-100'
                        : hasUnnotifiedUrgent
                        ? 'text-rose-800 font-medium'
                        : hasClinicalAlert
                        ? 'text-amber-900 font-medium'
                        : status.clinicalLevel === 'watch'
                        ? 'text-sky-800 font-medium'
                        : 'text-slate-500'
                    }
                  >
                    {status.clinicalShortSummary}
                  </div>

                  {(status.nurseState !== 'none' || status.hasPending) && (
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      {status.nurseState !== 'none' && (
                        <span
                          className={
                            isSelected
                              ? 'text-white/90 font-medium'
                              : status.nurseState === 'notify_now'
                              ? 'text-rose-800 font-semibold'
                              : status.nurseState === 'notify_shift'
                              ? 'text-amber-800 font-semibold'
                              : 'text-emerald-800 font-medium'
                          }
                        >
                          {status.nurseShortLabel}
                        </span>
                      )}

                      {status.nurseState !== 'none' && status.hasPending && (
                        <span className={isSelected ? 'text-teal-200' : 'text-slate-300'} aria-hidden="true">
                          ·
                        </span>
                      )}

                      {status.hasPending && (
                        <span
                          className={
                            isSelected ? 'text-amber-200 font-semibold' : 'text-amber-800 font-semibold'
                          }
                        >
                          Review
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                {status.clinicalLevel === 'urgent' ? (
                  <OctagonAlert
                    className={`w-4 h-4 ${
                      isSelected
                        ? 'text-rose-200'
                        : hasUnnotifiedUrgent
                        ? 'text-rose-700'
                        : 'text-amber-600'
                    }`}
                  />
                ) : status.clinicalLevel === 'elevated' ? (
                  <AlertTriangle
                    className={`w-4 h-4 ${
                      isSelected ? 'text-amber-200' : 'text-amber-600'
                    }`}
                  />
                ) : status.clinicalLevel === 'watch' ? (
                  <Info
                    className={`w-4 h-4 ${
                      isSelected ? 'text-teal-200' : 'text-sky-600'
                    }`}
                  />
                ) : (
                  <CheckCircle2
                    className={`w-4 h-4 ${
                      isSelected ? 'text-teal-200' : 'text-emerald-600'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
