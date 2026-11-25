import { ControlledDialog } from './WorkspaceUi';
import type { OpenResidentEditor } from './ResidentEditor';
import { l10n } from '../utils/localization';
import { useOverlayScrollbars } from '../utils/overlayScrollbars';
import { ClinicalText } from './ClinicalText';
import React, { useState, useRef } from 'react';
import { AlertThresholds, HandoffRow } from '../types/handoff';
import {
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  OctagonAlert,
  Info,
  MessageSquare,
  CheckCheck,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  SeverityTier,
} from '../data/stopAndWatchCodes';
import { StopAndWatchIconBadge } from './StopAndWatchIconBadge';
import type { InterfaceLanguage } from '../utils/localization';
import { getResidentStatus } from '../utils/residentStatus';

interface HandoffTableProps {
  rows: HandoffRow[];
  onEdit: OpenResidentEditor;
  onUpdateRow: (room: string, updated: Partial<HandoffRow>) => void;
  onAcceptAllPending: () => void;
  onAcceptCell: (
    room: string,
    field: 'done' | 'notDoneNextShift' | 'changeNote' | 'changeCodes' | 'mltc'
  ) => void;
  onRejectCell: (
    room: string,
    field: 'done' | 'notDoneNextShift' | 'changeNote' | 'changeCodes' | 'mltc'
  ) => void;
  isLocked?: boolean;
  customTiers?: Record<string, SeverityTier>;
  thresholds?: AlertThresholds;
  onSelectResident?: (room: string) => void;

  interfaceLanguage?: InterfaceLanguage;
}

export const HandoffTable: React.FC<HandoffTableProps> = ({
  rows,
  onUpdateRow,
  onEdit,
  onAcceptAllPending,
  onAcceptCell,
  onRejectCell,
  isLocked = false,
  customTiers,
  thresholds,
  onSelectResident,

  interfaceLanguage = 'en',
}) => {
  const tableScroller = useRef<HTMLDivElement>(null);
  useOverlayScrollbars(tableScroller, 'x');
  const [activeSourcePopover, setActiveSourcePopover] = useState<{
    room: string;
    field: string;
    quote: string;
  } | null>(null);
  const tableLanguage = interfaceLanguage;

  const [sourceClosing, setSourceClosing] = useState(false);
  const closeSource = () => setSourceClosing(true);

  const toggleRowExpand = (room: string) => {
    const row = rows.find((r) => r.room === room);
    if (row) {
      onUpdateRow(room, { isExpanded: !row.isExpanded });
    }
  };


  const totalPendingCount = rows.reduce((acc, row) => {
    let count = 0;
    if (row.done?.isPendingConfirmation) count++;
    if (row.notDoneNextShift?.isPendingConfirmation) count++;
    if (row.changeCodes?.isPendingConfirmation) count++;
    if (row.changeNote?.isPendingConfirmation) count++;
    if (row.mltcDetails?.qualitativeObservations?.isPendingConfirmation) count++;
    if (row.mltcDetails?.fluidIntakeMl?.isPendingConfirmation) count++;
    if ((row.careRequirements || []).some((req) => req.isPendingConfirmation)) count++;
    return acc + count;
  }, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Table Toolbar */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            {l10n("All residents")}
          </h2>
          <span className="text-xs text-slate-400 tabular-nums">
            · {rows.length}
          </span>
        </div>

        {totalPendingCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-800 tabular-nums">
              {totalPendingCount}{" " + l10n("pending")}
            </span>
            {!isLocked && (
              <button
                type="button"
                onClick={onAcceptAllPending}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{l10n("Accept all")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      <div ref={tableScroller} className="overflow-x-auto" role="region" aria-label={l10n("All residents")} tabIndex={0}>
        <table className="w-full text-start text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/70 text-slate-500 text-[11px] font-semibold border-b border-slate-200">
              <th className="py-2.5 px-3 w-48">{l10n("Resident")}</th>
              <th className="py-2.5 px-3 min-w-[240px]">
                {l10n("Completed care")}
              </th>
              <th className="py-2.5 px-3 min-w-[220px]">
                {l10n("Next shift")}
              </th>
              <th className="py-2.5 px-3 min-w-[220px]">
                {l10n("Health & changes")}
              </th>
              <th className="py-2.5 px-3 w-36">
                {l10n("Nurse notified")}
              </th>
              <th className="py-2.5 px-3 w-24 text-end">{l10n("Open")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const status = getResidentStatus(row, thresholds, customTiers);
              const hasCodes = (row.changeCodes?.value || []).length > 0;

              return (
                <React.Fragment key={row.room}>
                  <tr
                    className={`transition-colors hover:bg-slate-50/80 ${
                      status.nurseState === 'notify_now'
                        ? 'bg-rose-50/35'
                        : status.nurseState === 'notify_shift' || status.clinicalLevel === 'urgent'
                        ? 'bg-amber-50/30'
                        : ''
                    }`}
                  >
                    {/* Column 1: Room / Resident */}
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleRowExpand(row.room)}
                          aria-expanded={Boolean(row.isExpanded)}
                          aria-label={l10n("Toggle measurements and notes for Room {{p1}}", { p1: row.room })}
                          className="mt-0.5 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded hover:bg-slate-100"
                          title={l10n("Toggle measurements and notes")}
                        >
                          {row.isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-teal-700" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => onSelectResident && onSelectResident(row.room)}
                            className="font-semibold text-slate-900 text-xs hover:text-teal-700 transition-colors text-start cursor-pointer flex items-center gap-1.5"
                          >
                            <span className="tabular-nums text-slate-400">
                              {row.room}
                            </span>
                            <span>{row.residentName}</span>
                          </button>

                          {status.clinicalLevel !== 'routine' ? (
                            <div
                              className={`inline-flex items-start gap-1 text-[11px] font-semibold leading-snug ${
                                status.clinicalLevel === 'urgent'
                                  ? status.nurseState === 'notify_now'
                                    ? 'text-rose-800'
                                    : 'text-amber-900'
                                  : status.clinicalLevel === 'elevated'
                                  ? 'text-amber-800'
                                  : 'text-sky-800'
                              }`}
                            >
                              {status.clinicalLevel === 'urgent' ? (
                                <OctagonAlert className="w-3 h-3 shrink-0 mt-0.5" />
                              ) : status.clinicalLevel === 'elevated' ? (
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              ) : (
                                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                              )}
                              <span>{status.clinicalShortSummary}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-600" />
                              <span>{l10n("Routine")}</span>
                            </div>
                          )}

                          {status.hasPending && (
                            <div className="text-[11px] font-semibold text-amber-800">
                              {l10n("Review needed")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Done */}
                    <td
                      className={`py-2.5 px-3 align-top transition-colors ${
                        row.done?.isPendingConfirmation ? 'bg-amber-50/70' : ''
                      }`}
                    >
                      <div className="space-y-1">
                          {(() => {
                            const originalDone = row.done?.value || '';
                            const displayDone = originalDone;

                            return (
                              <>
                              <button
                                type="button"
                                disabled={isLocked}
                                aria-haspopup="dialog" onClick={(event) => onEdit(row.room, "care", event.currentTarget)}
                                className="w-full text-start cursor-pointer disabled:cursor-default text-slate-900 hover:text-slate-700 leading-snug"
                                title={isLocked ? undefined : l10n("Click to edit")}
                              >
                                {displayDone ? (
                                  <div>
                                    <div className="font-medium text-slate-900">{displayDone}</div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">{l10n("None recorded")}</span>
                                )}
                              </button>
                            <ClinicalText text={originalDone} previewOnly />
                              </>
                            );
                          })()}

                          {row.done?.isPendingConfirmation && (
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-amber-200/80">
                              <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                                <span>{l10n("Pending")}</span>
                                {row.done.sourceQuote && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveSourcePopover({
                                        room: row.room,
                                        field: 'Completed care',
                                        quote: row.done.sourceQuote!,
                                      })
                                    }
                                    className="text-amber-700 hover:text-amber-900 cursor-pointer"
                                    title={l10n("View source quote")}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onAcceptCell(row.room, 'done')}
                                  className="p-1 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                                  title={l10n("Accept")}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectCell(row.room, 'done')}
                                  className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title={l10n("Reject")}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                    </td>

                    {/* Column 3: Next shift */}
                    <td
                      className={`py-2.5 px-3 align-top transition-colors ${
                        row.notDoneNextShift?.isPendingConfirmation ||
                        (row.careRequirements || []).some((req) => req.isPendingConfirmation)
                          ? 'bg-amber-50/70'
                          : ''
                      }`}
                    >
                      <div className="space-y-1.5">
                          {(() => {
                            const originalNotDone = row.notDoneNextShift?.value || '';
                            const displayNotDone = originalNotDone;
                            const hasNote = Boolean(displayNotDone && displayNotDone !== '—');
                            const hasTasks = (row.careRequirements || []).length > 0;

                            if (!hasNote && !hasTasks) {
                              return (
                                <button
                                  type="button"
                                  disabled={isLocked}
                                  aria-haspopup="dialog" onClick={(event) => onEdit(row.room, "next", event.currentTarget)}
                                  className="w-full text-start cursor-pointer disabled:cursor-default text-slate-400 hover:text-slate-600"
                                  title={isLocked ? undefined : l10n("Click to add note")}
                                >
                                  —
                                </button>
                              );
                            }

                            return (
                              <>
                                {hasNote && (
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    aria-haspopup="dialog" onClick={(event) => onEdit(row.room, "next", event.currentTarget)}
                                    className="w-full text-start cursor-pointer disabled:cursor-default text-slate-900 hover:text-slate-700 leading-snug font-medium"
                                    title={isLocked ? undefined : l10n("Click to edit")}
                                  >
                                    <div>{displayNotDone}</div>
                                  </button>
                                )}
                                {hasNote && <ClinicalText text={originalNotDone} previewOnly />}

                                {hasTasks && (
                                  <ul className="space-y-1 pt-0.5 text-[11px] text-slate-700">
                                    {row.careRequirements!.slice(0, 3).map((req) => (
                                      <li key={req.id} className="flex items-start gap-1.5 leading-snug">
                                        <span className="text-teal-700 font-semibold shrink-0">
                                          · {l10n(req.category)}:
                                        </span>
                                        <span
                                          className={
                                            req.completed ? 'line-through text-slate-400' : ''
                                          }
                                        >
                                          <ClinicalText text={req.action_item} />
                                        </span>
                                      </li>
                                    ))}
                                    {row.careRequirements!.length > 3 && (
                                      <li>
                                        <button
                                          type="button"
                                          onClick={() => onSelectResident && onSelectResident(row.room)}
                                          className="text-[11px] font-medium text-teal-700 hover:text-teal-900 cursor-pointer"
                                        >
                                          +{row.careRequirements!.length - 3}{" " + l10n("more")}
                                        </button>
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </>
                            );
                          })()}

                          {(row.notDoneNextShift?.isPendingConfirmation ||
                            (row.careRequirements || []).some(
                              (req) => req.isPendingConfirmation
                            )) && (
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-amber-200/80">
                              <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                                <span>{l10n("Pending")}</span>
                                {row.notDoneNextShift?.sourceQuote && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveSourcePopover({
                                        room: row.room,
                                        field: 'Next-shift tasks',
                                        quote: row.notDoneNextShift.sourceQuote!,
                                      })
                                    }
                                    className="text-amber-700 hover:text-amber-900 cursor-pointer"
                                    title={l10n("View source quote")}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onAcceptCell(row.room, 'notDoneNextShift')}
                                  className="p-1 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                                  title={l10n("Accept")}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectCell(row.room, 'notDoneNextShift')}
                                  className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title={l10n("Reject")}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                    </td>

                    {/* Column 4: Stop & Watch Changes */}
                    <td
                      className={`py-2.5 px-3 align-top transition-colors ${
                        row.changeNote?.isPendingConfirmation ||
                        row.changeCodes?.isPendingConfirmation
                          ? 'bg-amber-50/70'
                          : ''
                      }`}
                    >
                      <div className="space-y-1.5">
                          {hasCodes ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {(row.changeCodes?.value || []).map((codeId) => (
                                <StopAndWatchIconBadge
                                  key={codeId}
                                  codeId={codeId}
                                  size="sm"
                                  showLabel={true}
                                  customTiers={customTiers}
                                  language={tableLanguage}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">{l10n("Routine care")}</span>
                          )}

                          {(() => {
                            const originalChangeNote = row.changeNote?.value || '';
                            const displayChangeNote = originalChangeNote;

                            if (!originalChangeNote || originalChangeNote === 'No change') {
                              return null;
                            }

                            return (
                              <>
                              <button
                                type="button"
                                disabled={isLocked}
                                aria-haspopup="dialog" onClick={(event) => onEdit(row.room, "note", event.currentTarget, true)}
                                className="w-full text-start cursor-pointer disabled:cursor-default text-slate-800 hover:text-slate-600 leading-snug"
                                title={isLocked ? undefined : l10n("Click to edit")}
                              >
                                <div>{displayChangeNote}</div>
                              </button>
                              <ClinicalText text={originalChangeNote} previewOnly />
                              </>
                            );
                          })()}

                          {(row.changeNote?.isPendingConfirmation ||
                            row.changeCodes?.isPendingConfirmation) && (
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-amber-200/80">
                              <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                                <span>{l10n("Pending")}</span>
                                {row.changeNote?.sourceQuote && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveSourcePopover({
                                        room: row.room,
                                        field: 'Health & changes',
                                        quote: row.changeNote.sourceQuote!,
                                      })
                                    }
                                    className="text-amber-700 hover:text-amber-900 cursor-pointer"
                                    title={l10n("View source quote")}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onAcceptCell(row.room, 'changeNote')}
                                  className="p-1 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                                  title={l10n("Accept")}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectCell(row.room, 'changeNote')}
                                  className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title={l10n("Reject")}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                    </td>

                    {/* Column 5: Told Nurse? */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="space-y-1.5">
                        <button type="button" disabled={isLocked} aria-haspopup="dialog"
                          className="text-start font-semibold text-xs min-h-8"
                          onClick={(event) => onEdit(row.room, 'flags', event.currentTarget)}>
                          {row.toldNurse?.value ? l10n("Notified") : l10n("Not told")}
                        </button>
                        {row.toldNurse?.value && row.nurseInitials?.value && <p><bdi>{row.nurseInitials.value}</bdi></p>}
                        {status.needsNurseAction && !row.toldNurse?.value && (
                          <div
                            className={`text-[11px] font-semibold ${
                              status.isUrgent ? 'text-rose-800' : 'text-amber-900'
                            }`}
                          >
                            {status.isUrgent ? l10n("Notify RN now") : l10n("Notify RN")}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Column 6: Open */}
                    <td className="py-2.5 px-3 align-top text-end">
                      {onSelectResident && (
                        <button
                          type="button"
                          onClick={() => onSelectResident(row.room)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                          title={l10n("Open resident workspace")}
                        >
                          <span>{l10n("Open")}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expandable Measurements & Observations Drawer (Single Grouped Surface) */}
                  {row.isExpanded && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                          {(row.mltcDetails.fluidIntakeMl?.isPendingConfirmation ||
                            row.mltcDetails.weightKg?.isPendingConfirmation ||
                            row.mltcDetails.bowelMovement?.isPendingConfirmation ||
                            row.mltcDetails.qualitativeObservations?.isPendingConfirmation) && (
                            <div className="px-3 py-2 bg-amber-50/80 flex items-center justify-between gap-2 text-xs text-amber-950">
                              <span className="font-medium">
                                {l10n("AI-extracted measurements & observations awaiting review")}
                              </span>
                              {!isLocked && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onAcceptCell(row.room, 'mltc')}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-amber-300 rounded text-[11px] font-semibold cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>{l10n("Confirm")}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRejectCell(row.room, 'mltc')}
                                    className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                    title={l10n("Dismiss pending flag")}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="p-3">
                            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                              <div><dt>{l10n("Fluids (mL)")}</dt><dd>{row.mltcDetails.fluidIntakeMl?.value ?? '—'}</dd></div>
                              <div><dt>{l10n("Weight (kg)")}</dt><dd>{row.mltcDetails.weightKg?.value ?? '—'}</dd></div>
                              <div><dt>{l10n("Bowel movement")}</dt><dd>{row.mltcDetails.bowelMovement?.value || '—'}
                                {row.mltcDetails.hoursSinceLastBM?.value != null && <span> · {row.mltcDetails.hoursSinceLastBM.value} {l10n("hrs")}</span>}
                              </dd></div>
                              <div><dt>{l10n("Repositioned")}</dt><dd>{row.mltcDetails.lastRepositionTime?.value || '—'}</dd></div>
                            </dl>
                            {!isLocked && <button type="button" aria-haspopup="dialog"
                              className="min-h-9 font-semibold text-teal-800"
                              onClick={(event) => onEdit(row.room, 'metrics', event.currentTarget)}>{l10n("Edit measurements")}</button>}
                          </div>
                          <div className="p-3">
                            <p className="font-semibold">{l10n("Observations & mood")}</p>
                            <ClinicalText text={row.mltcDetails.qualitativeObservations?.value || ''} />
                            {!isLocked && <button type="button" aria-haspopup="dialog"
                              className="min-h-9 font-semibold text-teal-800"
                              onClick={(event) => onEdit(row.room, 'note', event.currentTarget)}>{l10n("Edit")}</button>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Transcript Source Quote Popover */}
      {activeSourcePopover && (
        <ControlledDialog open={!sourceClosing} label={l10n("Source Excerpt ·")} onDismiss={closeSource}
          onAfterClose={() => { setActiveSourcePopover(null); setSourceClosing(false); }}
          className="cb-motion-dialog max-w-md">
          <div className="bg-white rounded-xl shadow-xl w-full p-4 space-y-3 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="text-xs font-bold text-slate-900">
                {l10n("Source Excerpt ·") + " "}{activeSourcePopover.field}{" " + l10n("(Room") + " "}{activeSourcePopover.room})
              </div>
              <button
                type="button"
                onClick={closeSource}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed font-mono">
              {l10n("&ldquo;")}{activeSourcePopover.quote}{l10n("&rdquo;")}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeSource}
                className="px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {l10n("Close")}
              </button>
            </div>
          </div>
        </ControlledDialog>
      )}
    </div>
  );
};
