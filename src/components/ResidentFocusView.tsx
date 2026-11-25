import type { OpenResidentEditor, ResidentSection } from './ResidentEditor';
import { Button } from './WorkspaceUi';
import { ResidentStep } from './ResidentRibbon';
import { l10n } from '../utils/localization';
import { ClinicalText } from './ClinicalText';
import React, { useState, useEffect, useRef } from 'react';
import {
  HandoffRow,
  AlertThresholds,
  CareRequirementCategory,
  CareRequirementItem,
} from '../types/handoff';
import {
  Check,
  Info,
  Plus,
  Pencil,
  OctagonAlert,
  AlertTriangle,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import {
  getCodeConfig,
  TIER_METADATA,
  SeverityTier,
  getTranslatedStopAndWatchLabel,
} from '../data/stopAndWatchCodes';
import {
  getStopAndWatchIcon,
  StopAndWatchDetailModal,
} from './StopAndWatchIconBadge';
import { mergeCareRequirementsIntoRow } from '../utils/geminiParser';
import type { InterfaceLanguage } from '../utils/localization';
import { getResidentStatus } from '../utils/residentStatus';

interface ResidentFocusViewProps {
  headingRef?: React.Ref<HTMLHeadingElement>;
  row: HandoffRow;
  allRows: HandoffRow[];
  onUpdateRow: (room: string, updated: Partial<HandoffRow>) => void;
  onEdit: OpenResidentEditor;
  onSelectResident: (room: string | 'all') => void;
  staffStamp: string;

  interfaceLanguage?: InterfaceLanguage;
  customCodeTiers?: Record<string, SeverityTier>;
  thresholds?: AlertThresholds;
  isLocked?: boolean;
}

function inferRequirementCategory(text: string): CareRequirementCategory {
  const lower = text.toLowerCase();
  if (/(snack|lunch|breakfast|dinner|meal|eat|ate|drink|fluid|juice|water|tea|coffee|thickened|diet)/i.test(lower)) {
    return 'Dietary';
  }
  if (/(bath|shower|wash|toilet|bm|bowel|nail|mouth|denture|hygiene|groom|skin|heel|dress)/i.test(lower)) {
    return 'Hygiene';
  }
  if (/(reposition|turn|walk|transfer|wheelchair|lift|stand|mobility|physio)/i.test(lower)) {
    return 'Mobility';
  }
  if (/(med|pill|prn|pain|cream|ointment|drops|inhaler|insulin|laxative)/i.test(lower)) {
    return 'Medication';
  }
  return 'Other';
}

export const ResidentFocusView: React.FC<ResidentFocusViewProps> = ({
  headingRef,
  row,
  allRows,
  onUpdateRow,
  onEdit,
  onSelectResident,
  staffStamp,

  interfaceLanguage = 'en',
  customCodeTiers,
  thresholds,
  isLocked = false,
}) => {
  const fileLanguage = interfaceLanguage;


  const careCompletedText = row.done?.value || '';
  const additionalNotesText = row.mltcDetails?.qualitativeObservations?.value || row.changeNote?.value || '';
  const notDoneText = row.notDoneNextShift?.value || '';
  const careRequirements = row.careRequirements || [];
  const activeCodes = row.changeCodes?.value || [];
  const [selectedExplainingCode, setSelectedExplainingCode] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const openSection = (section: ResidentSection) => (event: React.MouseEvent<HTMLElement>) =>
    onEdit(row.room, section, event.currentTarget);

  const triggerSavedIndicator = () => {
    setSavedNotice(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedNotice(false), 1800);
  };

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const currentIndex = allRows.findIndex((r) => r.room === row.room);
  const prevRow = currentIndex > 0 ? allRows[currentIndex - 1] : null;
  const nextRow = currentIndex < allRows.length - 1 ? allRows[currentIndex + 1] : null;

  const status = getResidentStatus(row, thresholds, customCodeTiers);

  // Care Requirements Checklist helpers
  const persistRequirements = (next: CareRequirementItem[]) => {
    onUpdateRow(row.room, { careRequirements: next });
    triggerSavedIndicator();
  };

  const handleToggleRequirementDone = (id: string) => {
    if (isLocked) return;
    persistRequirements(
      careRequirements.map((r) =>
        r.id === id
          ? { ...r, completed: !r.completed, isPendingConfirmation: false, lastEditedBy: staffStamp }
          : r
      )
    );
  };

  const handleAcceptRequirement = (id: string) => {
    persistRequirements(
      careRequirements.map((r) =>
        r.id === id ? { ...r, isPendingConfirmation: false, lastEditedBy: staffStamp } : r
      )
    );
  };

  const fluidMin = thresholds?.fluidIntakeMinMl ?? 1000;
  const bmHoursMax = thresholds?.bowelMovementHoursThreshold ?? 48;
  const fluidValue = row.mltcDetails?.fluidIntakeMl?.value;
  const hoursSinceBM = row.mltcDetails?.hoursSinceLastBM?.value;
  const isLowFluid =
    fluidValue !== null && fluidValue !== undefined && fluidValue < fluidMin;
  const isBmOverdue =
    hoursSinceBM !== null && hoursSinceBM !== undefined && hoursSinceBM >= bmHoursMax;
  const hasMeasurementsPending = Boolean(
    row.mltcDetails?.fluidIntakeMl?.isPendingConfirmation ||
      row.mltcDetails?.weightKg?.isPendingConfirmation ||
      row.mltcDetails?.bowelMovement?.isPendingConfirmation ||
      row.mltcDetails?.lastRepositionTime?.isPendingConfirmation
  );

  const handleConfirmAllInResident = () => {
    onUpdateRow(row.room, {
      done: { ...row.done, isPendingConfirmation: false },
      notDoneNextShift: { ...row.notDoneNextShift, isPendingConfirmation: false },
      changeCodes: { ...row.changeCodes, isPendingConfirmation: false },
      changeNote: { ...row.changeNote, isPendingConfirmation: false },
      careRequirements: (row.careRequirements || []).map((req) => ({
        ...req,
        isPendingConfirmation: false,
      })),
      mltcDetails: {
        ...row.mltcDetails,
        fluidIntakeMl: { ...row.mltcDetails.fluidIntakeMl, isPendingConfirmation: false },
        weightKg: { ...row.mltcDetails.weightKg, isPendingConfirmation: false },
        bowelMovement: { ...row.mltcDetails.bowelMovement, isPendingConfirmation: false },
        qualitativeObservations: {
          ...row.mltcDetails.qualitativeObservations,
          isPendingConfirmation: false,
        },
      },
    });
    triggerSavedIndicator();
  };

  return (
    <div
      key={row.room}
      className="cb-panel cb-resident-card"
    >
      {/* 1. Resident Header: Distinct Clinical Status vs. Nurse Notification */}
      <div className="cb-resident-header">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="cb-resident-title">
              {row.residentName} <span>{l10n("· Room") + " "}{row.room}</span>
            </h2>

            {savedNotice ? (
              <span className="text-xs font-medium text-emerald-700">{l10n("· Saved")}</span>
            ) : null}
          </div>

          <div className="cb-resident-status">
            {/* Clinical Concern */}
            <span
              className={`inline-flex items-center gap-1.5 font-semibold ${
                status.clinicalLevel === 'urgent'
                  ? 'cb-urgent'
                  : status.clinicalLevel === 'elevated'
                  ? 'text-amber-800'
                  : status.clinicalLevel === 'watch'
                  ? 'text-sky-800'
                  : 'text-slate-600 font-medium'
              }`}
            >
              {status.clinicalLevel === 'urgent' ? (
                <OctagonAlert className="w-3.5 h-3.5 shrink-0" />
              ) : status.clinicalLevel === 'elevated' ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : status.clinicalLevel === 'watch' ? (
                <Info className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              )}
              <span>{status.isUrgent ? l10n("Priority attention") : status.clinicalLevel === 'elevated' ? l10n("This shift") :
                status.clinicalLevel === 'routine' ? l10n("No change recorded") : status.clinicalSummary}</span>
            </span>

          </div>
        </div>

        <div className="cb-resident-actions">
          {status.hasPending && !isLocked && (
            <button
              type="button"
              onClick={handleConfirmAllInResident}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{l10n("Confirm pending")}</span>
            </button>
          )}

          {prevRow && <ResidentStep direction="previous" resident={prevRow} showRoom onSelect={onSelectResident} />}
          {nextRow && <ResidentStep direction="next" resident={nextRow} showRoom onSelect={onSelectResident} />}
        </div>
        {!isLocked && <Button variant="quiet" aria-haspopup="dialog" onClick={openSection("metrics")}>
          <Pencil aria-hidden="true" /> {l10n('Edit resident')}
        </Button>}
        <div className="cb-notification-row" data-state={status.nurseState}>
          <span className="cb-notification-status">
            {status.nurseState === 'notified' ? <Check aria-hidden="true" /> : <BellRing aria-hidden="true" />}
            {status.nurseLabel || l10n('Not recorded')}
          </span>
          {!isLocked && <Button variant="quiet" aria-haspopup="dialog" onClick={openSection("notification")}>
            <Pencil aria-hidden="true" /> {l10n('Nurse notification')}
          </Button>}
        </div>
      </div>

      {/* 2. Read-First Horizontal Shift Measurements Strip */}
      <div className="cb-resident-metrics">
          <div className="cb-resident-measurements">
            <div className="cb-measure-head">
              <h3>{l10n("Measurements")}</h3>
              {!isLocked && (
              <button
                type="button"
                aria-haspopup="dialog" onClick={openSection("metrics")}
                className="cb-measure-edit inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <Pencil className="w-3 h-3" />
                <span>{l10n("Edit")}</span>
              </button>
            )}
            </div>
            <div className="cb-resident-metric-grid">
              <button
                type="button"
                disabled={isLocked}
                aria-haspopup="dialog" onClick={openSection("metrics")}
                className="text-start group cursor-pointer disabled:cursor-default"
              >
                <div className="text-[11px] font-medium text-slate-500">{l10n("Fluids")}</div>
                <div
                  className={`text-sm font-semibold tabular-nums mt-0.5 leading-snug ${
                    isLowFluid ? 'text-amber-800' : 'text-slate-900 group-hover:text-teal-800'
                  }`}
                >
                  {fluidValue !== null && fluidValue !== undefined ? l10n("{{p1}} mL", { p1: fluidValue }) : '—'}
                  {isLowFluid && (
                    <span className="text-[11px] font-medium text-amber-700 ms-1">
                      {l10n("(<")}{fluidMin})
                    </span>
                  )}
                </div>
              </button>

              <button
                type="button"
                disabled={isLocked}
                aria-haspopup="dialog" onClick={openSection("metrics")}
                className="text-start group cursor-pointer disabled:cursor-default"
              >
                <div className="text-[11px] font-medium text-slate-500">{l10n("Weight")}</div>
                <div className="text-sm font-semibold tabular-nums text-slate-900 group-hover:text-teal-800 mt-0.5 leading-snug">
                  {row.mltcDetails?.weightKg?.value !== null &&
                  row.mltcDetails?.weightKg?.value !== undefined
                    ? l10n("{{p1}} kg", { p1: row.mltcDetails.weightKg.value })
                    : '—'}
                </div>
              </button>

              <button
                type="button"
                disabled={isLocked}
                aria-haspopup="dialog" onClick={openSection("metrics")}
                className="text-start group cursor-pointer disabled:cursor-default"
              >
                <div className="text-[11px] font-medium text-slate-500">{l10n("Last bowel movement")}</div>
                <div
                  className={`text-sm font-semibold mt-0.5 leading-snug ${
                    isBmOverdue ? 'text-rose-800' : 'text-slate-900 group-hover:text-teal-800'
                  }`}
                >
                  {(() => {
                    const bmVal = row.mltcDetails?.bowelMovement?.value || '';
                    const alreadyHasHours =
                      hoursSinceBM !== null &&
                      hoursSinceBM !== undefined &&
                      new RegExp(`\\b${hoursSinceBM}\\s*h\\b`, 'i').test(bmVal);
                    return (
                      <>
                        {bmVal || '—'}
                        {hoursSinceBM !== null && hoursSinceBM !== undefined && !alreadyHasHours && (
                          <span className="text-xs font-mono tabular-nums font-normal text-slate-500 ms-1.5">
                            · {hoursSinceBM}{l10n("h ago")}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </button>

              <button
                type="button"
                disabled={isLocked}
                aria-haspopup="dialog" onClick={openSection("metrics")}
                className="text-start group cursor-pointer disabled:cursor-default"
              >
                <div className="text-[11px] font-medium text-slate-500">{l10n("Repositioned")}</div>
                <div className="text-sm font-semibold tabular-nums text-slate-900 group-hover:text-teal-800 mt-0.5 leading-snug">
                  {row.mltcDetails?.lastRepositionTime?.value || '—'}
                </div>
              </button>
            </div>

          </div>
          {hasMeasurementsPending && (
            <div className="mt-2.5 flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950">
              <span className="font-medium">{l10n("AI-updated shift measurements awaiting confirmation")}</span>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateRow(row.room, {
                      mltcDetails: {
                        ...row.mltcDetails,
                        fluidIntakeMl: {
                          ...row.mltcDetails.fluidIntakeMl,
                          isPendingConfirmation: false,
                        },
                        weightKg: {
                          ...row.mltcDetails.weightKg,
                          isPendingConfirmation: false,
                        },
                        bowelMovement: {
                          ...row.mltcDetails.bowelMovement,
                          isPendingConfirmation: false,
                        },
                        lastRepositionTime: {
                          ...row.mltcDetails.lastRepositionTime,
                          isPendingConfirmation: false,
                        },
                      },
                    });
                    triggerSavedIndicator();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-amber-300 rounded-md text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  <Check className="w-3 h-3" />
                  <span>{l10n("Confirm")}</span>
                </button>
              )}
            </div>
          )}
      </div>

      {/* 3. Main 2-Column Workspace (Reduces vertical scrolling on desktop) */}
      <div className="cb-resident-columns">
        {/* Left Column: Completed Care + Health & Changes */}
        <div className="cb-resident-observations">
          {/* GROUP 1: Completed Care (Read-first, Edit-on-demand) */}
          <section className="cb-resident-section cb-resident-care">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{l10n("Completed care")}</h3>

              <div className="flex items-center gap-2 shrink-0">


                {!isLocked && (
                  <button
                    type="button"
                    aria-haspopup="dialog" onClick={openSection("care")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <>
                        <Pencil className="w-3 h-3" />
                        <span>{l10n("Edit")}</span>
                      </>
                  </button>
                )}
              </div>
            </div>

            {row.done?.isPendingConfirmation && (
              <div className="flex items-start justify-between gap-2 px-3 py-2 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950">
                <div className="leading-snug min-w-0 flex-1">
                  <span className="font-semibold">{l10n("Pending review")}</span>
                  {row.done.sourceQuote && (
                    <span className="text-amber-900"> — “{row.done.sourceQuote}”</span>
                  )}
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateRow(row.room, {
                        done: { ...row.done, isPendingConfirmation: false },
                      });
                      triggerSavedIndicator();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-amber-300 rounded-md text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    <Check className="w-3 h-3" />
                    <span>{l10n("Confirm")}</span>
                  </button>
                )}
              </div>
            )}

            <><button
                type="button"
                disabled={isLocked}
                aria-haspopup="dialog" onClick={openSection("care")}
                className={`w-full text-start text-sm leading-relaxed rounded-lg transition-colors ${
                  !isLocked ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1' : 'cursor-default'
                } ${careCompletedText.trim() ? 'text-slate-800' : 'text-slate-400 italic'}`}
              >
                {careCompletedText.trim() || l10n("Add completed care...")}
              </button><ClinicalText text={careCompletedText} previewOnly /></>

          </section>

          {/* GROUP 2: Health & Changes (Progressive Stop & Watch + Nurse Escalation + Notes) */}
          <section className="cb-resident-section cb-resident-changes">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {l10n("Health changes")}
              </h3>

              {!isLocked && (
                <button
                  type="button"
                  aria-haspopup="dialog" onClick={openSection("flags")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:text-teal-950 px-2 py-0.5 rounded-md hover:bg-teal-50 transition-colors cursor-pointer shrink-0"
                >
                  <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{activeCodes.length > 0 ? l10n("Edit flags") : l10n("Flag change")}</span>
                    </>
                </button>
              )}
            </div>

            {(((row.changeCodes?.value?.length || 0) > 0 &&
              row.changeCodes?.isPendingConfirmation) ||
              row.changeNote?.isPendingConfirmation ||
              row.mltcDetails?.qualitativeObservations?.isPendingConfirmation) && (
              <div className="flex items-start justify-between gap-2 px-3 py-2 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950">
                <div className="leading-snug min-w-0 flex-1">
                  <span className="font-semibold">{l10n("Pending review")}</span>
                  {(row.changeNote?.sourceQuote ||
                    row.changeCodes?.sourceQuote ||
                    row.mltcDetails?.qualitativeObservations?.sourceQuote) && (
                    <span className="text-amber-900">
                      {' '}
                      — “
                      {row.changeNote?.sourceQuote ||
                        row.changeCodes?.sourceQuote ||
                        row.mltcDetails?.qualitativeObservations?.sourceQuote}
                      ”
                    </span>
                  )}
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateRow(row.room, {
                        changeCodes: { ...row.changeCodes, isPendingConfirmation: false },
                        changeNote: { ...row.changeNote, isPendingConfirmation: false },
                        mltcDetails: {
                          ...row.mltcDetails,
                          qualitativeObservations: {
                            ...row.mltcDetails.qualitativeObservations,
                            isPendingConfirmation: false,
                          },
                        },
                      });
                      triggerSavedIndicator();
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-amber-300 rounded-md text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    <Check className="w-3 h-3" />
                    <span>{l10n("Confirm")}</span>
                  </button>
                )}
              </div>
            )}

            {/* Active Stop & Watch Summary (Always visible; full 12-grid disclosed on demand) */}
            {activeCodes.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {activeCodes.map((codeId) => {
                    const cfg = getCodeConfig(codeId, customCodeTiers);
                    if (!cfg) return null;
                    const IconComp = getStopAndWatchIcon(codeId);
                    const tier = customCodeTiers?.[codeId] || cfg.defaultTier;
                    const tierBadge = TIER_METADATA[tier];
                    const translatedPrimary = getTranslatedStopAndWatchLabel(
                      codeId,
                      fileLanguage,
                      cfg.plainLabel || cfg.shortLabel
                    );

                    return (
                      <div
                        key={codeId}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${tierBadge.badgeBg} ${tierBadge.badgeBorder} ${tierBadge.badgeColor}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedExplainingCode(codeId)}
                          className="inline-flex items-center gap-1.5 cursor-pointer hover:underline"
                          title={l10n("View clinical details")}
                        >
                          <IconComp className="w-3.5 h-3.5 shrink-0" />
                          <span>{translatedPrimary}</span>
                        </button>

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500">{l10n("No health changes flagged")}</div>
              )}

            {/* Observations & Mood (Read-first, Edit-on-demand) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="cb-observation-heading">{l10n("Observations")}</h3>
                <div className="flex items-center gap-2">

                  {!isLocked && (
                    <button
                      type="button"
                      aria-haspopup="dialog" onClick={openSection("note")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <>
                          <Pencil className="w-3 h-3" />
                          <span>{l10n("Edit")}</span>
                        </>
                    </button>
                  )}
                </div>
              </div>

              <><button
                  type="button"
                  disabled={isLocked}
                  aria-haspopup="dialog" onClick={openSection("note")}
                  className={`w-full text-start text-sm leading-relaxed rounded-lg transition-colors ${
                    !isLocked ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1' : 'cursor-default'
                  } ${additionalNotesText.trim() ? 'text-slate-800' : 'text-slate-400 italic'}`}
                >
                  {additionalNotesText.trim() || l10n("Add mood, energy, or skin observations...")}
                </button><ClinicalText text={additionalNotesText} previewOnly /></>

            </div>

          </section>
        </div>

        {/* Right Column: Unified Next Shift (Notes + Actionable Tasks) */}
        <section className="cb-resident-section cb-resident-next">
          {(() => {
            const hasNextNote = Boolean(notDoneText.trim() && notDoneText.trim() !== '—');
            const completedTasksCount = careRequirements.filter((r) => r.completed).length;

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 shrink-0">{l10n("Next shift")}</h3>
                    {careRequirements.length > 0 && (
                      <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                        {completedTasksCount}/{careRequirements.length}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">


                    {!isLocked && (
                      <>
                        <button
                          type="button"
                          aria-haspopup="dialog" onClick={openSection("next")}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <>
                              <Pencil className="w-3 h-3" />
                              <span>{hasNextNote ? l10n("Edit note") : l10n("Add note")}</span>
                            </>
                        </button>

                        <button
                          type="button"
                          aria-haspopup="dialog" onClick={openSection("next")}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:text-teal-950 px-2 py-0.5 rounded-md hover:bg-teal-50 transition-colors cursor-pointer"
                        >
                          <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{l10n("Add task")}</span>
                            </>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {row.notDoneNextShift?.isPendingConfirmation && (
                  <div className="flex items-start justify-between gap-2 px-3 py-2 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950">
                    <div className="leading-snug min-w-0 flex-1">
                      <span className="font-semibold">{l10n("Pending review")}</span>
                      {row.notDoneNextShift.sourceQuote && (
                        <span className="text-amber-900">
                          {' '}
                          — “{row.notDoneNextShift.sourceQuote}”
                        </span>
                      )}
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateRow(row.room, {
                            notDoneNextShift: {
                              ...row.notDoneNextShift,
                              isPendingConfirmation: false,
                            },
                          });
                          triggerSavedIndicator();
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-amber-300 rounded-md text-[11px] font-semibold cursor-pointer shrink-0"
                      >
                        <Check className="w-3 h-3" />
                        <span>{l10n("Confirm")}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Unified Handover Note + Actionable Tasks */}
                {hasNextNote ? (
                  <div className="cb-next-content">
                    <button
                      type="button"
                      disabled={isLocked}
                      aria-haspopup="dialog" onClick={openSection("next")}
                      className={`w-full text-start text-sm leading-relaxed text-slate-800 rounded-lg transition-colors ${
                        !isLocked ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1' : 'cursor-default'
                      }`}
                    >
                      {notDoneText}
                    </button>
                    <ClinicalText text={notDoneText} previewOnly />
                    {!isLocked &&
                      !careRequirements.some(
                        (req) =>
                          req.action_item.trim().toLowerCase() === notDoneText.trim().toLowerCase()
                      ) && (
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              const cleanNote = notDoneText.trim();
                              if (!cleanNote || cleanNote === '—') return;
                              const nextReqs = mergeCareRequirementsIntoRow(
                                careRequirements,
                                [
                                  {
                                    category: inferRequirementCategory(cleanNote),
                                    action_item: cleanNote,
                                  },
                                ],
                                row.notDoneNextShift?.sourceQuote || 'Tracked from handover note',
                                false,
                                staffStamp
                              );
                              onUpdateRow(row.room, {
                                careRequirements: nextReqs,
                                notDoneNextShift: {
                                  value: '—',
                                  isPendingConfirmation: false,
                                  lastEditedBy: staffStamp,
                                },
                              });
                              triggerSavedIndicator();
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:text-teal-950 hover:bg-teal-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{l10n("Track as task")}</span>
                          </button>
                        </div>
                      )}
                  </div>
                ) : null}

                {/* Interactive Task Checklist */}
                {careRequirements.length > 0 && (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                    {careRequirements.map((req) => {
                      return (
                        <div
                          key={req.id}
                          className={`flex items-start justify-between gap-2.5 px-3 py-2 text-xs group ${
                            req.isPendingConfirmation
                              ? 'bg-amber-50/60'
                              : req.completed
                              ? 'bg-emerald-50/30'
                              : 'bg-white'
                          }`}
                        >
                          <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(req.completed)}
                              disabled={isLocked}
                              onChange={() => handleToggleRequirementDone(req.id)}
                              className="w-4 h-4 mt-0.5 text-teal-700 rounded border-slate-300 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0 flex-1 leading-snug">
                              <span className="font-semibold text-slate-500 me-1.5">
                                {l10n(req.category)} ·
                              </span>
                              <span
                                className={`font-medium ${
                                  req.completed ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                <ClinicalText text={req.action_item} />
                              </span>
                            </div>
                          </label>

                          <div className="flex items-center gap-1 shrink-0">
                            {req.isPendingConfirmation && !isLocked && (
                              <button
                                type="button"
                                onClick={() => handleAcceptRequirement(req.id)}
                                className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md cursor-pointer"
                                title={l10n("Confirm task")}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isLocked && (
                              <button
                                type="button"
                                aria-haspopup="dialog" onClick={openSection("next")}
                                className="p-1 text-slate-500 hover:text-teal-800 hover:bg-teal-50 rounded-md cursor-pointer"
                                title={l10n("Edit")} aria-label={l10n("Edit")}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Single Unified Empty State */}
                {!hasNextNote &&
                  careRequirements.length === 0 && (
                    <button
                      type="button"
                      disabled={isLocked}
                      aria-haspopup="dialog" onClick={openSection("next")}
                      className={`w-full text-start text-sm italic text-slate-400 rounded-lg transition-colors ${
                        !isLocked ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1' : 'cursor-default'
                      }`}
                    >
                      {l10n("Nothing pending for next shift")}
                    </button>
                  )}
              </>
            );
          })()}
        </section>
      </div>

      {/* Stop & Watch Code Details Modal */}
      {selectedExplainingCode &&
        (() => {
          const explConfig = getCodeConfig(selectedExplainingCode, customCodeTiers);
          if (!explConfig) return null;
          const tier = explConfig.defaultTier;
          const explTierMeta = TIER_METADATA[tier];
          return (
            <StopAndWatchDetailModal
              config={explConfig}
              tierMeta={explTierMeta}
              onClose={() => setSelectedExplainingCode(null)}
            />
          );
        })()}
    </div>
  );
};
