import React, { useState, useEffect, useRef } from 'react';
import { HandoffRow, ShiftHeader } from '../types/handoff';
import {
  CheckSquare,
  Square,
  AlertTriangle,
  Layers,
  CheckCircle2,
  ListTodo,
  OctagonAlert,
  Info,
  Loader2,
} from 'lucide-react';
import {
  computeRowSeverity,
  TIER_METADATA,
} from '../data/stopAndWatchCodes';
import { StopAndWatchIconBadge } from './StopAndWatchIconBadge';
import { getInstantLtcTranslation, translateBidirectional } from '../utils/translator';
import { InterfaceLanguage } from '../utils/uiTranslations';

interface IncomingShiftViewProps {
  header: ShiftHeader;
  rows: HandoffRow[];
  anythingElse: string;
  customCodeTiers?: Record<string, 1 | 2 | 3>;
  interfaceLanguage?: InterfaceLanguage;
}

interface ChecklistItem {
  id: string;
  room: string;
  residentName: string;
  task: string;
  completed: boolean;
  completedAt?: string;
}

export const IncomingShiftView: React.FC<IncomingShiftViewProps> = ({
  header,
  rows,
  anythingElse,
  customCodeTiers,
  interfaceLanguage = 'en',
}) => {
  const viewLanguage = interfaceLanguage;
  const [showOriginalEn, setShowOriginalEn] = useState<boolean>(false);
  const [briefingTranslations, setBriefingTranslations] = useState<Record<string, string>>({});
  const [isTranslatingBriefing, setIsTranslatingBriefing] = useState<boolean>(false);
  const briefingCacheRef = useRef<Map<string, string>>(new Map());

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  // Sync actionable checklist reactively whenever rows update
  useEffect(() => {
    setChecklist((prev) => {
      const prevMap = new Map(prev.map((item) => [item.id, item]));
      const items: ChecklistItem[] = [];
      rows.forEach((r) => {
        const reqs = r.careRequirements || [];
        const notDone = r.notDoneNextShift?.value;
        const hasNote = Boolean(notDone && notDone !== '—' && notDone.trim().length > 0);

        if (hasNote) {
          const alreadyInReqs = reqs.some(
            (req) => req.action_item.trim().toLowerCase() === notDone!.trim().toLowerCase()
          );
          if (!alreadyInReqs) {
            const id = `task-${r.room}`;
            const existing = prevMap.get(id);
            const sameTask = existing && existing.task === notDone;
            items.push({
              id,
              room: r.room,
              residentName: r.residentName,
              task: notDone!,
              completed: sameTask ? existing.completed : false,
              completedAt: sameTask ? existing.completedAt : undefined,
            });
          }
        }

        reqs.forEach((req) => {
          const id = `req-${r.room}-${req.id}`;
          const existing = prevMap.get(id);
          const taskLabel = `${req.category}: ${req.action_item}`;
          const isCompleted =
            req.completed !== undefined
              ? Boolean(req.completed)
              : existing && existing.task === taskLabel
              ? existing.completed
              : false;
          items.push({
            id,
            room: r.room,
            residentName: r.residentName,
            task: taskLabel,
            completed: isCompleted,
            completedAt: isCompleted ? existing?.completedAt || 'Logged' : undefined,
          });
        });
      });
      return items;
    });
  }, [rows]);

  // Translate briefing items dynamically via Cloud Translation v3 when non-English is selected
  useEffect(() => {
    if (viewLanguage === 'en') {
      setIsTranslatingBriefing(false);
      setShowOriginalEn(false);
      return;
    }

    let cancelled = false;
    const uniqueTexts = new Set<string>();
    if (anythingElse?.trim()) uniqueTexts.add(anythingElse.trim());
    checklist.forEach((item) => {
      if (item.task?.trim()) uniqueTexts.add(item.task.trim());
    });
    rows.forEach((r) => {
      [
        r.done?.value,
        r.notDoneNextShift?.value,
        r.changeNote?.value,
        r.mltcDetails.qualitativeObservations?.value,
      ].forEach((val) => {
        const clean = (val || '').trim();
        if (clean && clean !== '—') uniqueTexts.add(clean);
      });
    });

    const pendingTexts = Array.from(uniqueTexts).filter(
      (txt) => !briefingCacheRef.current.has(`${viewLanguage}::${txt}`)
    );

    if (pendingTexts.length === 0) {
      setIsTranslatingBriefing(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsTranslatingBriefing(true);
      const updates: Record<string, string> = {};

      try {
        await Promise.all(
          pendingTexts.map(async (txt) => {
            const res = await translateBidirectional(txt, 'en', viewLanguage);
            const translated =
              res?.translatedText?.trim() || getInstantLtcTranslation(txt, viewLanguage, 'en');
            const key = `${viewLanguage}::${txt}`;
            briefingCacheRef.current.set(key, translated);
            updates[key] = translated;
          })
        );
        if (!cancelled) {
          setBriefingTranslations((prev) => ({ ...prev, ...updates }));
        }
      } catch {
        // fallback already handled
      } finally {
        if (!cancelled) setIsTranslatingBriefing(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [viewLanguage, rows, checklist, anythingElse]);

  const tBrief = (text: string): string => {
    if (!text || viewLanguage === 'en') return text;
    const key = `${viewLanguage}::${text.trim()}`;
    return briefingTranslations[key] || getInstantLtcTranslation(text, viewLanguage, 'en');
  };

  const toggleTask = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            }
          : item
      )
    );
  };

  // Compute severity and sort: Tier 3 > Tier 2 > Tier 1 > Pending next shift tasks > Standard per care plan
  const evaluatedRows = rows.map((r) => {
    const codes = r.changeCodes?.value || [];
    const severity = computeRowSeverity(codes, r.prevShiftTier, customCodeTiers);
    const hasNotDoneNote = Boolean(r.notDoneNextShift?.value && r.notDoneNextShift.value !== '—');
    const hasReqTasks = (r.careRequirements || []).length > 0;
    const hasNextShift = hasNotDoneNote || hasReqTasks;
    return {
      row: r,
      codes,
      severity,
      hasNextShift,
    };
  });

  const sortedRows = [...evaluatedRows].sort((a, b) => {
    const tierA = a.severity?.effectiveTier ?? 0;
    const tierB = b.severity?.effectiveTier ?? 0;
    if (tierA !== tierB) {
      return tierB - tierA; // Higher tier first
    }
    // If same tier, check next shift tasks
    if (a.hasNextShift && !b.hasNextShift) return -1;
    if (!a.hasNextShift && b.hasNextShift) return 1;
    return a.row.room.localeCompare(b.row.room);
  });

  const completedCount = checklist.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      {/* Header card for incoming shift staff */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-teal-700" />
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Incoming Shift Priority Briefing & Task Checklist
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prepared for <strong>{header.incomingPsw}</strong> ({header.shift}) · Handed over by {header.outgoingPsw}. Flagged residents and pending tasks are prioritized by clinical severity (Tier 3 Now &gt; Tier 2 Shift &gt; Tier 1 Monitor).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {viewLanguage !== 'en' && (
            <div className="flex items-center gap-2">
              {isTranslatingBriefing && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => setShowOriginalEn((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer active:scale-[0.98] ${
                  showOriginalEn
                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {showOriginalEn ? 'Hide EN' : 'Show EN'}
              </button>
            </div>
          )}

          {checklist.length > 0 && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-1.5">
              <div className="text-xs">
                <span className="font-bold text-slate-800">Next Shift Tasks:</span>{' '}
                <span className="font-mono text-teal-800 font-semibold tabular-nums">
                  {completedCount} / {checklist.length} completed
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Actionable Checklist for Incoming Shift */}
      {checklist.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-teal-700" />
              <span>Outstanding Care & Follow-Up Checklist</span>
            </h2>
            <span className="text-[11px] text-slate-500">
              Tick off tasks as you perform them during your shift
            </span>
          </div>

          <div className="space-y-2">
            {checklist.map((item) => {
              const displayTask =
                viewLanguage === 'en'
                  ? item.task
                  : tBrief(item.task);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleTask(item.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer text-xs ${
                    item.completed
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 text-slate-800'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 text-teal-700">
                    {item.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        Room {item.room} ({item.residentName})
                      </span>
                      {item.completed && (
                        <span className="text-[11px] font-mono text-emerald-700 font-medium">
                          ✓ Completed at {item.completedAt}
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-0.5 leading-snug ${
                        item.completed ? 'line-through text-slate-500' : 'text-slate-800 font-medium'
                      }`}
                    >
                      {displayTask}
                    </div>
                    {viewLanguage !== 'en' && showOriginalEn && displayTask !== item.task && (
                      <div className="text-[10px] text-slate-400 font-normal italic mt-0.5">
                        EN: {item.task}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Equipment and Village Notes */}
      {anythingElse && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs space-y-1">
          <div className="font-bold text-amber-950 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-700" />
            <span>Unit / Equipment Alert for Upcoming Shift:</span>
          </div>
          <p className="text-amber-900 pl-5 font-medium">
            {viewLanguage === 'en'
              ? anythingElse
              : tBrief(anythingElse)}
          </p>
          {viewLanguage !== 'en' && showOriginalEn && tBrief(anythingElse) !== anythingElse && (
            <p className="text-[11px] text-amber-700/80 pl-5 italic">
              EN: {anythingElse}
            </p>
          )}
        </div>
      )}

      {/* Read-Only Priority Sorted Resident Summary */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">
          Resident Status Summary (Prioritized by clinical severity)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sortedRows.map(({ row: r, codes, severity, hasNextShift }) => {
            const hasCodes = codes.length > 0;
            const effectiveTier = severity?.effectiveTier;
            const tierMeta = effectiveTier ? TIER_METADATA[effectiveTier] : null;

            const originalDone = r.done?.value || '—';
            const displayDone =
              viewLanguage === 'en'
                ? originalDone
                : tBrief(originalDone);

            const originalNextShift = r.notDoneNextShift?.value || '';
            const displayNextShift =
              viewLanguage === 'en'
                ? originalNextShift
                : tBrief(originalNextShift);

            const originalNote = r.changeNote?.value || '';
            const displayNote =
              viewLanguage === 'en'
                ? originalNote
                : tBrief(originalNote);

            const originalObs = r.mltcDetails.qualitativeObservations?.value || '';
            const displayObs =
              viewLanguage === 'en'
                ? originalObs
                : tBrief(originalObs);

            const borderClass =
              effectiveTier === 3
                ? 'border-purple-400 ring-1 ring-purple-300'
                : effectiveTier === 2
                ? 'border-amber-400 ring-1 ring-amber-200'
                : effectiveTier === 1
                ? 'border-sky-300'
                : hasNextShift
                ? 'border-teal-300'
                : 'border-slate-200 opacity-90';

            return (
              <div
                key={r.room}
                className={`bg-white border rounded-lg p-4 shadow-xs text-xs space-y-2.5 transition-all ${borderClass}`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900 text-sm">
                    Room {r.room} · {r.residentName}
                  </div>
                  {tierMeta ? (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${tierMeta.badgeBg} ${tierMeta.badgeColor} ${tierMeta.badgeBorder}`}
                    >
                      {tierMeta.tier === 3 ? (
                        <OctagonAlert className="w-3 h-3 text-purple-700" />
                      ) : tierMeta.tier === 2 ? (
                        <AlertTriangle className="w-3 h-3 text-amber-700" />
                      ) : (
                        <Info className="w-3 h-3 text-sky-700" />
                      )}
                      <span>{tierMeta.label}</span>
                    </span>
                  ) : hasNextShift ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      Follow-up Due
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">Per Care Plan</span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="font-semibold text-slate-600">Care Done:</span>{' '}
                    <span className="text-slate-800">{displayDone}</span>
                    {viewLanguage !== 'en' && showOriginalEn && displayDone !== originalDone && (
                      <span className="text-[10px] text-slate-400 italic block">
                        EN: {originalDone}
                      </span>
                    )}
                  </div>

                  {(hasNextShift || (r.careRequirements || []).length > 0) && (
                    <div className="p-2 bg-teal-50/70 border border-teal-200 rounded text-teal-950 font-medium space-y-1">
                      {originalNextShift && originalNextShift !== '—' && (
                        <div>
                          <span className="font-bold">Next Shift Action:</span> {displayNextShift}
                          {viewLanguage !== 'en' && showOriginalEn && displayNextShift !== originalNextShift && (
                            <div className="text-[10px] text-teal-700/80 italic mt-0.5 font-normal">
                              EN: {originalNextShift}
                            </div>
                          )}
                        </div>
                      )}
                      {(r.careRequirements || []).length > 0 && (
                        <ul className="space-y-0.5 text-[11px] font-normal">
                          {r.careRequirements!.map((req) => (
                            <li key={req.id} className={req.completed ? 'line-through text-teal-700/70' : ''}>
                              <span className="font-semibold">{req.category}:</span>{' '}
                              {viewLanguage === 'en' ? req.action_item : tBrief(req.action_item)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {hasCodes && (
                    <div className={`p-2 rounded space-y-1 border ${
                      effectiveTier === 3
                        ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                        : effectiveTier === 2
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-sky-50/70 border-sky-200 text-sky-950'
                    }`}>
                      <div className="flex flex-wrap gap-1">
                        {codes.map((c) => (
                          <StopAndWatchIconBadge
                            key={c}
                            codeId={c}
                            size="sm"
                            customTiers={customCodeTiers}
                            language={viewLanguage}
                          />
                        ))}
                      </div>
                      <div className="text-xs font-normal">{displayNote}</div>
                      {viewLanguage !== 'en' && showOriginalEn && displayNote !== originalNote && (
                        <div className="text-[10px] text-slate-500 italic font-normal">
                          EN: {originalNote}
                        </div>
                      )}
                      {r.toldNurse?.value && (
                        <div className="text-[10px] text-emerald-800 font-semibold mt-0.5">
                          ✓ Charge Nurse notified ({r.nurseInitials?.value || 'RN'})
                        </div>
                      )}
                    </div>
                  )}

                  {originalObs && (
                    <div className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-slate-700">Observation:</span>{' '}
                      {displayObs}
                      {viewLanguage !== 'en' && showOriginalEn && displayObs !== originalObs && (
                        <span className="text-[10px] text-slate-400 italic block">
                          EN: {originalObs}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision support note */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700">
          * All alerts and tiers are decision support only. The charge nurse makes all clinical decisions.
        </p>
        <p className="text-[10px] text-slate-500">
          Severity tiers are a prototype proposal and must be reviewed and approved by Schlegel Villages nursing leadership. They are not part of the official INTERACT tool.
        </p>
      </div>
    </div>
  );
};


