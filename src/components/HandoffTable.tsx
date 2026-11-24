import React, { useState, useEffect, useRef } from 'react';
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
import { getInstantLtcTranslation, translateBidirectional } from '../utils/translator';
import { StopAndWatchIconBadge } from './StopAndWatchIconBadge';
import { InterfaceLanguage, UiTranslations } from '../utils/uiTranslations';
import { getResidentStatus } from '../utils/residentStatus';

interface HandoffTableProps {
  rows: HandoffRow[];
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
  t?: UiTranslations;
  interfaceLanguage?: InterfaceLanguage;
}

export const HandoffTable: React.FC<HandoffTableProps> = ({
  rows,
  onUpdateRow,
  onAcceptAllPending,
  onAcceptCell,
  onRejectCell,
  isLocked = false,
  customTiers,
  thresholds,
  onSelectResident,
  t,
  interfaceLanguage = 'en',
}) => {
  const [editingCell, setEditingCell] = useState<{ room: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [activeSourcePopover, setActiveSourcePopover] = useState<{
    room: string;
    field: string;
    quote: string;
  } | null>(null);
  const [sheetTranslations, setSheetTranslations] = useState<Record<string, string>>({});
  const [isTranslatingSheet, setIsTranslatingSheet] = useState<boolean>(false);
  const sheetCacheRef = useRef<Map<string, string>>(new Map());

  const tableLanguage = interfaceLanguage;

  // Close source popover on Escape
  useEffect(() => {
    if (!activeSourcePopover) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveSourcePopover(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeSourcePopover]);

  // Translate table cell texts dynamically when global reading language != 'en'
  useEffect(() => {
    if (tableLanguage === 'en') {
      setIsTranslatingSheet(false);
      return;
    }

    let cancelled = false;
    const uniqueTexts = new Set<string>();
    rows.forEach((r) => {
      [r.done?.value, r.notDoneNextShift?.value, r.changeNote?.value].forEach((val) => {
        const clean = (val || '').trim();
        if (clean && clean !== '—') uniqueTexts.add(clean);
      });
      (r.careRequirements || []).slice(0, 3).forEach((req) => {
        const clean = (req.action_item || '').trim();
        if (clean) uniqueTexts.add(clean);
      });
    });

    const pendingTexts = Array.from(uniqueTexts).filter(
      (txt) => !sheetCacheRef.current.has(`${tableLanguage}::${txt}`)
    );

    if (pendingTexts.length === 0) {
      setIsTranslatingSheet(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslatingSheet(true);
      const updates: Record<string, string> = {};

      try {
        await Promise.all(
          pendingTexts.map(async (txt) => {
            const res = await translateBidirectional(txt, 'en', tableLanguage);
            const translated =
              res?.translatedText?.trim() || getInstantLtcTranslation(txt, tableLanguage, 'en');
            const key = `${tableLanguage}::${txt}`;
            sheetCacheRef.current.set(key, translated);
            updates[key] = translated;
          })
        );
        if (!cancelled) {
          setSheetTranslations((prev) => ({ ...prev, ...updates }));
        }
      } catch {
        // fallback already handled per-item
      } finally {
        if (!cancelled) setIsTranslatingSheet(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tableLanguage, rows]);

  const tSheet = (text: string): string => {
    if (!text || tableLanguage === 'en') return text;
    const key = `${tableLanguage}::${text.trim()}`;
    return sheetTranslations[key] || getInstantLtcTranslation(text, tableLanguage, 'en');
  };

  const toggleRowExpand = (room: string) => {
    const row = rows.find((r) => r.room === room);
    if (row) {
      onUpdateRow(room, { isExpanded: !row.isExpanded });
    }
  };

  const startEditing = (room: string, field: string, currentValue: string) => {
    if (isLocked) return;
    setEditingCell({ room, field });
    setEditValue(currentValue);
  };

  const saveEdit = (room: string, field: string) => {
    const row = rows.find((r) => r.room === room);
    if (!row) return;

    if (field === 'done') {
      onUpdateRow(room, {
        done: { value: editValue, isPendingConfirmation: false, lastEditedBy: 'Staff Inline' },
      });
    } else if (field === 'notDoneNextShift') {
      onUpdateRow(room, {
        notDoneNextShift: {
          value: editValue,
          isPendingConfirmation: false,
          lastEditedBy: 'Staff Inline',
        },
      });
    } else if (field === 'changeNote') {
      onUpdateRow(room, {
        changeNote: {
          value: editValue,
          isPendingConfirmation: false,
          lastEditedBy: 'Staff Inline',
        },
      });
    }
    setEditingCell(null);
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
            All residents
          </h2>
          <span className="text-xs text-slate-400 tabular-nums">
            · {rows.length}
          </span>
          {isTranslatingSheet && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
          )}
        </div>

        {totalPendingCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-amber-800 tabular-nums">
              {totalPendingCount} pending
            </span>
            {!isLocked && (
              <button
                type="button"
                onClick={onAcceptAllPending}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Accept all</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/70 text-slate-500 text-[11px] font-semibold border-b border-slate-200">
              <th className="py-2.5 px-3 w-48">Resident</th>
              <th className="py-2.5 px-3 min-w-[240px]">
                {tableLanguage === 'en' ? 'Completed care' : t?.careCompletedTitle || 'Completed care'}
              </th>
              <th className="py-2.5 px-3 min-w-[220px]">
                {tableLanguage === 'en' ? 'Next shift' : t?.notDoneTitle || 'Next shift'}
              </th>
              <th className="py-2.5 px-3 min-w-[220px]">
                {tableLanguage === 'en' ? 'Health & changes' : t?.stopAndWatchTitle || 'Health & changes'}
              </th>
              <th className="py-2.5 px-3 w-36">
                {tableLanguage === 'en' ? 'Nurse notified' : t?.toldNurseTitle || 'Nurse notified'}
              </th>
              <th className="py-2.5 px-3 w-24 text-right">Open</th>
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
                          aria-label={`Toggle measurements and notes for Room ${row.room}`}
                          className="mt-0.5 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded hover:bg-slate-100"
                          title="Toggle measurements and notes"
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
                            className="font-semibold text-slate-900 text-xs hover:text-teal-700 transition-colors text-left cursor-pointer flex items-center gap-1.5"
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
                              <span>Routine</span>
                            </div>
                          )}

                          {status.hasPending && (
                            <div className="text-[11px] font-semibold text-amber-800">
                              Review needed
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
                      {editingCell?.room === row.room && editingCell.field === 'done' ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={2}
                            className="w-full text-xs p-1.5 border border-teal-500 rounded bg-white text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(row.room, 'done')}
                              className="px-2 py-0.5 bg-teal-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCell(null)}
                              className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {(() => {
                            const originalDone = row.done?.value || '';
                            const displayDone =
                              tableLanguage === 'en' ? originalDone : tSheet(originalDone);

                            return (
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => startEditing(row.room, 'done', originalDone)}
                                className="w-full text-left cursor-pointer disabled:cursor-default text-slate-900 hover:text-slate-700 leading-snug"
                                title={isLocked ? undefined : 'Click to edit'}
                              >
                                {displayDone ? (
                                  <div>
                                    <div className="font-medium text-slate-900">{displayDone}</div>
                                    {tableLanguage !== 'en' &&
                                      originalDone &&
                                      displayDone !== originalDone && (
                                        <div className="text-[11px] text-slate-400 italic mt-0.5">
                                          EN: {originalDone}
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">None recorded</span>
                                )}
                              </button>
                            );
                          })()}

                          {row.done?.isPendingConfirmation && (
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-amber-200/80">
                              <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                                <span>Pending</span>
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
                                    title="View source quote"
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
                                  title="Accept"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectCell(row.room, 'done')}
                                  className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title="Reject"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
                      {editingCell?.room === row.room &&
                      editingCell.field === 'notDoneNextShift' ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={2}
                            className="w-full text-xs p-1.5 border border-teal-500 rounded bg-white text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(row.room, 'notDoneNextShift')}
                              className="px-2 py-0.5 bg-teal-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCell(null)}
                              className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(() => {
                            const originalNotDone = row.notDoneNextShift?.value || '';
                            const displayNotDone =
                              tableLanguage === 'en' ? originalNotDone : tSheet(originalNotDone);
                            const hasNote = Boolean(displayNotDone && displayNotDone !== '—');
                            const hasTasks = (row.careRequirements || []).length > 0;

                            if (!hasNote && !hasTasks) {
                              return (
                                <button
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() =>
                                    startEditing(row.room, 'notDoneNextShift', originalNotDone)
                                  }
                                  className="w-full text-left cursor-pointer disabled:cursor-default text-slate-400 hover:text-slate-600"
                                  title={isLocked ? undefined : 'Click to add note'}
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
                                    onClick={() =>
                                      startEditing(row.room, 'notDoneNextShift', originalNotDone)
                                    }
                                    className="w-full text-left cursor-pointer disabled:cursor-default text-slate-900 hover:text-slate-700 leading-snug font-medium"
                                    title={isLocked ? undefined : 'Click to edit'}
                                  >
                                    <div>{displayNotDone}</div>
                                    {tableLanguage !== 'en' &&
                                      originalNotDone &&
                                      originalNotDone !== '—' &&
                                      displayNotDone !== originalNotDone && (
                                        <div className="text-[11px] text-slate-400 font-normal italic mt-0.5">
                                          EN: {originalNotDone}
                                        </div>
                                      )}
                                  </button>
                                )}

                                {hasTasks && (
                                  <ul className="space-y-1 pt-0.5 text-[11px] text-slate-700">
                                    {row.careRequirements!.slice(0, 3).map((req) => (
                                      <li key={req.id} className="flex items-start gap-1.5 leading-snug">
                                        <span className="text-teal-700 font-semibold shrink-0">
                                          · {req.category}:
                                        </span>
                                        <span
                                          className={
                                            req.completed ? 'line-through text-slate-400' : ''
                                          }
                                        >
                                          {tableLanguage === 'en'
                                            ? req.action_item
                                            : tSheet(req.action_item)}
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
                                          +{row.careRequirements!.length - 3} more
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
                                <span>Pending</span>
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
                                    title="View source quote"
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
                                  title="Accept"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectCell(row.room, 'notDoneNextShift')}
                                  className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title="Reject"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
                      {editingCell?.room === row.room && editingCell.field === 'changeNote' ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={2}
                            className="w-full text-xs p-1.5 border border-teal-500 rounded bg-white text-slate-900 focus:outline-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(row.room, 'changeNote')}
                              className="px-2 py-0.5 bg-teal-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCell(null)}
                              className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
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
                            <span className="text-[11px] text-slate-400">Routine care</span>
                          )}

                          {(() => {
                            const originalChangeNote = row.changeNote?.value || '';
                            const displayChangeNote =
                              tableLanguage === 'en'
                                ? originalChangeNote
                                : tSheet(originalChangeNote);

                            if (!originalChangeNote || originalChangeNote === 'No change') {
                              return null;
                            }

                            return (
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() =>
                                  startEditing(row.room, 'changeNote', originalChangeNote)
                                }
                                className="w-full text-left cursor-pointer disabled:cursor-default text-slate-800 hover:text-slate-600 leading-snug"
                                title={isLocked ? undefined : 'Click to edit'}
                              >
                                <div>{displayChangeNote}</div>
                                {tableLanguage !== 'en' && displayChangeNote !== originalChangeNote && (
                                  <div className="text-[11px] text-slate-400 italic mt-0.5">
                                    EN: {originalChangeNote}
                                  </div>
                                )}
                              </button>
                            );
                          })()}

                          {(row.changeNote?.isPendingConfirmation ||
                            row.changeCodes?.isPendingConfirmation) && (
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-amber-200/80">
                              <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
                                <span>Pending</span>
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
                                    title="View source quote"
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
                                  title="Accept"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRejectCell(row.room, 'changeNote')}
                                  className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title="Reject"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Column 5: Told Nurse? */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(row.toldNurse?.value)}
                            disabled={isLocked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              onUpdateRow(row.room, {
                                toldNurse: { value: checked, isPendingConfirmation: false },
                                nurseInitials: {
                                  value: checked ? row.nurseInitials?.value || 'RN (KL)' : '',
                                  isPendingConfirmation: false,
                                },
                              });
                            }}
                            className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700"
                          />
                          <span
                            className={`font-medium text-xs ${
                              row.toldNurse?.value ? 'text-emerald-800' : 'text-slate-600'
                            }`}
                          >
                            {row.toldNurse?.value ? 'Notified' : 'Not told'}
                          </span>
                        </label>

                        {row.toldNurse?.value && (
                          <input
                            type="text"
                            value={row.nurseInitials?.value || 'RN (KL)'}
                            disabled={isLocked}
                            onChange={(e) =>
                              onUpdateRow(row.room, {
                                nurseInitials: {
                                  value: e.target.value,
                                  isPendingConfirmation: false,
                                },
                              })
                            }
                            className="w-24 px-1.5 py-0.5 border border-slate-200 rounded text-[11px] bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                            placeholder="RN (KL)"
                          />
                        )}

                        {status.needsNurseAction && !row.toldNurse?.value && (
                          <div
                            className={`text-[11px] font-semibold ${
                              status.isUrgent ? 'text-rose-800' : 'text-amber-900'
                            }`}
                          >
                            {status.isUrgent ? 'Notify RN now' : 'Notify RN'}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Column 6: Open */}
                    <td className="py-2.5 px-3 align-top text-right">
                      {onSelectResident && (
                        <button
                          type="button"
                          onClick={() => onSelectResident(row.room)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors active:scale-[0.98]"
                          title="Open resident workspace"
                        >
                          <span>Open</span>
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
                                AI-extracted measurements &amp; observations awaiting review
                              </span>
                              {!isLocked && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onAcceptCell(row.room, 'mltc')}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-amber-300 rounded text-[11px] font-semibold cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Confirm</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRejectCell(row.room, 'mltc')}
                                    className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                    title="Dismiss pending flag"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                            <div className="p-3">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Fluids (mL)
                              </label>
                              <input
                                type="number"
                                value={row.mltcDetails.fluidIntakeMl?.value ?? ''}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : null;
                                  onUpdateRow(row.room, {
                                    mltcDetails: {
                                      ...row.mltcDetails,
                                      fluidIntakeMl: { value: val, isPendingConfirmation: false },
                                    },
                                  });
                                }}
                                className="w-full tabular-nums text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                              />
                            </div>

                            <div className="p-3">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Weight (kg)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={row.mltcDetails.weightKg?.value ?? ''}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : null;
                                  onUpdateRow(row.room, {
                                    mltcDetails: {
                                      ...row.mltcDetails,
                                      weightKg: { value: val, isPendingConfirmation: false },
                                    },
                                  });
                                }}
                                className="w-full tabular-nums text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                              />
                            </div>

                            <div className="p-3">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Bowel movement
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={row.mltcDetails.bowelMovement?.value || ''}
                                  disabled={isLocked}
                                  onChange={(e) => {
                                    onUpdateRow(row.room, {
                                      mltcDetails: {
                                        ...row.mltcDetails,
                                        bowelMovement: {
                                          value: e.target.value,
                                          isPendingConfirmation: false,
                                        },
                                      },
                                    });
                                  }}
                                  className="flex-1 min-w-0 text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  value={row.mltcDetails.hoursSinceLastBM?.value ?? ''}
                                  disabled={isLocked}
                                  onChange={(e) => {
                                    const val = e.target.value ? Number(e.target.value) : null;
                                    onUpdateRow(row.room, {
                                      mltcDetails: {
                                        ...row.mltcDetails,
                                        hoursSinceLastBM: {
                                          value: val,
                                          isPendingConfirmation: false,
                                        },
                                      },
                                    });
                                  }}
                                  className="w-14 tabular-nums text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                                  aria-label={`Hours since last bowel movement for Room ${row.room}`}
                                  placeholder="0"
                                />
                                <span className="text-[11px] text-slate-500 shrink-0">hrs</span>
                              </div>
                            </div>

                            <div className="p-3">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Repositioned
                              </label>
                              <input
                                type="text"
                                value={row.mltcDetails.lastRepositionTime?.value || ''}
                                disabled={isLocked}
                                onChange={(e) => {
                                  onUpdateRow(row.room, {
                                    mltcDetails: {
                                      ...row.mltcDetails,
                                      lastRepositionTime: {
                                        value: e.target.value,
                                        isPendingConfirmation: false,
                                      },
                                    },
                                  });
                                }}
                                className="w-full tabular-nums text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                              />
                            </div>
                          </div>

                          <div className="p-3">
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">
                              Observations &amp; mood
                            </label>
                            <textarea
                              value={row.mltcDetails.qualitativeObservations?.value || ''}
                              disabled={isLocked}
                              onChange={(e) => {
                                onUpdateRow(row.room, {
                                  mltcDetails: {
                                    ...row.mltcDetails,
                                    qualitativeObservations: {
                                      value: e.target.value,
                                      isPendingConfirmation: false,
                                    },
                                  },
                                });
                              }}
                              rows={2}
                              className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                            />
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
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveSourcePopover(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 space-y-3 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="text-xs font-bold text-slate-900">
                Source Excerpt · {activeSourcePopover.field} (Room {activeSourcePopover.room})
              </div>
              <button
                type="button"
                onClick={() => setActiveSourcePopover(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 leading-relaxed font-mono">
              &ldquo;{activeSourcePopover.quote}&rdquo;
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveSourcePopover(null)}
                className="px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
