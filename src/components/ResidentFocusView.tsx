import { SelectPopover } from './SelectPopover';
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
  ChevronLeft,
  ChevronRight,
  Check,
  Info,
  Plus,
  Trash2,
  Pencil,
  X,
  OctagonAlert,
  AlertTriangle,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import {
  STOP_AND_WATCH_CONFIG,
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
  row: HandoffRow;
  allRows: HandoffRow[];
  onUpdateRow: (room: string, updated: Partial<HandoffRow>) => void;
  onSelectResident: (room: string | 'all') => void;
  staffStamp: string;

  interfaceLanguage?: InterfaceLanguage;
  customCodeTiers?: Record<string, SeverityTier>;
  thresholds?: AlertThresholds;
  isLocked?: boolean;
}

const QUICK_ADD_CARE_CHIPS: { en: string; labels: Record<string, string> }[] = [
  {
    en: 'Assisted morning bath & shampoo',
    labels: {
      tl: 'Tinulungang maligo at mag-shampoo sa umaga',
      pa: 'ਸਵੇਰ ਦੇ ਇਸ਼ਨਾਨ ਅਤੇ ਸ਼ੈਂਪੂ ਵਿੱਚ ਮਦਦ ਕੀਤੀ',
      hi: 'सुबह के स्नान और शैम्पू में सहायता की',
      zh: '协助晨间沐浴与洗发',
      es: 'Asistió con baño matutino y champú',
      fr: 'Aide au bain du matin et shampoing',
      ar: 'المساعدة في الاستحمام الصباحي والشامبو',
    },
  },
  {
    en: 'Ate 100% breakfast',
    labels: {
      tl: 'Kinain ang 100% ng almusal',
      pa: '100% ਨਾਸ਼ਤਾ ਖਾਧਾ',
      hi: '100% नाश्ता खाया',
      zh: '早餐全部吃完 (100%)',
      es: 'Comió 100% del desayuno',
      fr: 'A mangé 100% du déjeuner',
      ar: 'تناول 100% من وجبة الإفطار',
    },
  },
  {
    en: 'Repositioned 09:00 and 11:30',
    labels: {
      tl: 'Na-reposition ng 09:00 at 11:30',
      pa: '09:00 ਅਤੇ 11:30 ਵਜੇ ਪੁਜ਼ੀਸ਼ਨ ਬਦਲੀ',
      hi: '09:00 और 11:30 बजे पोज़िशन बदली',
      zh: '09:00 和 11:30 已协助翻身',
      es: 'Reposicionado a las 09:00 y 11:30',
      fr: 'Repositionné à 09:00 et 11:30',
      ar: 'تم تغيير الوضعية الساعة 09:00 و 11:30',
    },
  },
  {
    en: 'Full mouth & denture care',
    labels: {
      tl: 'Kumpletong paglinis ng bibig at pustiso',
      pa: 'ਮੂੰਹ ਅਤੇ ਦੰਦਾਂ ਦੀ ਪੂਰੀ ਸਫ਼ਾਈ',
      hi: 'मुँह और डेंचर की पूरी देखभाल',
      zh: '完成口腔及假牙清洁护理',
      es: 'Higiene bucal y de dentadura completa',
      fr: 'Soins complets de la bouche et dentier',
      ar: 'عناية كاملة بالفم وطقم الأسنان',
    },
  },
  {
    en: '1-person transfer to wheelchair',
    labels: {
      tl: '1-taong paglipat sa wheelchair',
      pa: '1-ਵਿਅਕਤੀ ਦੁਆਰਾ ਵ੍ਹੀਲਚੇਅਰ ਤੇ ਟ੍ਰਾਂਸਫਰ',
      hi: '1-व्यक्ति द्वारा व्हीलचेयर पर ट्रांसफर',
      zh: '单人协助转移至轮椅',
      es: 'Traslado de 1 persona a silla de ruedas',
      fr: 'Transfert à 1 personne au fauteuil roulant',
      ar: 'نقل بشخص واحد إلى الكرسي المتحرك',
    },
  },
  {
    en: 'Walked to activity room',
    labels: {
      tl: 'Naglakad papuntang activity room',
      pa: 'ਐਕਟੀਵਿਟੀ ਰੂਮ ਤੱਕ ਤੁਰ ਕੇ ਗਏ',
      hi: 'गतिविधि कक्ष तक चलकर गए',
      zh: '步行前往活动室',
      es: 'Caminó a la sala de actividades',
      fr: 'A marché jusqu’à la salle d’activités',
      ar: 'مشى إلى غرفة الأنشطة',
    },
  },
];

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
  row,
  allRows,
  onUpdateRow,
  onSelectResident,
  staffStamp,

  interfaceLanguage = 'en',
  customCodeTiers,
  thresholds,
  isLocked = false,
}) => {
  const fileLanguage = interfaceLanguage;


  // Local field state (synced immediately to parent)
  const [careCompletedText, setCareCompletedText] = useState(row.done?.value || '');
  const [additionalNotesText, setAdditionalNotesText] = useState(
    row.mltcDetails?.qualitativeObservations?.value || row.changeNote?.value || ''
  );
  const [notDoneText, setNotDoneText] = useState(row.notDoneNextShift?.value || '');
  const [careRequirements, setCareRequirements] = useState<CareRequirementItem[]>(
    row.careRequirements || []
  );
  const [newReqCategory, setNewReqCategory] = useState<CareRequirementCategory>('Mobility');
  const [newReqText, setNewReqText] = useState('');
  const [toldNurse, setToldNurse] = useState(Boolean(row.toldNurse?.value));
  const [nurseInitials, setNurseInitials] = useState(row.nurseInitials?.value || 'RN (KL)');
  const [activeCodes, setActiveCodes] = useState<string[]>(row.changeCodes?.value || []);
  const [selectedExplainingCode, setSelectedExplainingCode] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Read-first / Edit-on-demand disclosure states
  const [isEditingVitals, setIsEditingVitals] = useState(false);
  const [isEditingCare, setIsEditingCare] = useState(false);
  const [isEditingFlags, setIsEditingFlags] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingNextSummary, setIsEditingNextSummary] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const savedTimerRef = useRef<any>(null);
  const prevRoomRef = useRef<string>(row.room);

  const triggerSavedIndicator = () => {
    setSavedNotice(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedNotice(false), 1800);
  };

  // Sync local state when resident changes OR external extraction updates the row
  useEffect(() => {
    const roomChanged = prevRoomRef.current !== row.room;
    prevRoomRef.current = row.room;

    if (roomChanged) {
      setNewReqText('');
      setIsEditingVitals(false);
      setIsEditingCare(false);
      setIsEditingFlags(false);
      setIsEditingNotes(false);
      setIsEditingNextSummary(false);
      setShowAddTask(false);
    }

    setCareCompletedText(row.done?.value || '');
    setAdditionalNotesText(
      row.mltcDetails?.qualitativeObservations?.value || row.changeNote?.value || ''
    );
    setNotDoneText(row.notDoneNextShift?.value || '');
    setCareRequirements(row.careRequirements || []);
    setToldNurse(Boolean(row.toldNurse?.value));
    setNurseInitials(row.nurseInitials?.value || 'RN (KL)');
    setActiveCodes(row.changeCodes?.value || []);
  }, [row]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const currentIndex = allRows.findIndex((r) => r.room === row.room);
  const prevRow = currentIndex > 0 ? allRows[currentIndex - 1] : null;
  const nextRow = currentIndex < allRows.length - 1 ? allRows[currentIndex + 1] : null;

  const status = getResidentStatus(row, thresholds, customCodeTiers);

  // Immediate text field sync
  const syncFieldImmediately = (field: 'done' | 'notes' | 'notDone', value: string) => {
    if (field === 'done') {
      setCareCompletedText(value);
      onUpdateRow(row.room, {
        done: { value, isPendingConfirmation: false, lastEditedBy: staffStamp },
      });
    } else if (field === 'notes') {
      setAdditionalNotesText(value);
      onUpdateRow(row.room, {
        changeNote: {
          value: value || (activeCodes.length > 0 ? 'Observed changes' : 'No change'),
          isPendingConfirmation: false,
          lastEditedBy: staffStamp,
        },
        mltcDetails: {
          ...row.mltcDetails,
          qualitativeObservations: {
            value,
            isPendingConfirmation: false,
            lastEditedBy: staffStamp,
          },
        },
      });
    } else if (field === 'notDone') {
      setNotDoneText(value);
      onUpdateRow(row.room, {
        notDoneNextShift: { value, isPendingConfirmation: false, lastEditedBy: staffStamp },
      });
    }
    triggerSavedIndicator();
  };

  const handleAddCareChip = (text: string) => {
    if (isLocked) return;
    const updated =
      careCompletedText && careCompletedText !== 'Per care plan'
        ? `${careCompletedText}; ${text}`
        : text;
    syncFieldImmediately('done', updated);
  };

  // Care Requirements Checklist helpers
  const persistRequirements = (next: CareRequirementItem[]) => {
    setCareRequirements(next);
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

  const handleRemoveRequirement = (id: string) => {
    if (isLocked) return;
    persistRequirements(careRequirements.filter((r) => r.id !== id));
  };

  const handleAddManualRequirement = () => {
    if (isLocked) return;
    const clean = newReqText.trim();
    if (!clean) return;
    const next = mergeCareRequirementsIntoRow(
      careRequirements,
      [{ category: newReqCategory, action_item: clean }],
      'Added in resident file',
      false,
      staffStamp
    );
    persistRequirements(next);
    setNewReqText('');
  };

  const toggleCode = (codeId: string) => {
    if (isLocked) return;
    const updated = activeCodes.includes(codeId)
      ? activeCodes.filter((c) => c !== codeId)
      : [...activeCodes, codeId];
    setActiveCodes(updated);

    onUpdateRow(row.room, {
      changeCodes: {
        value: updated,
        isPendingConfirmation: false,
        lastEditedBy: staffStamp,
      },
      changeNote: {
        value: updated.length > 0 ? additionalNotesText || 'Observed changes' : 'No change',
        isPendingConfirmation: false,
        lastEditedBy: staffStamp,
      },
    });
    triggerSavedIndicator();
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
      <div className="cb-resident-header flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="cb-resident-title">
              {row.residentName} <span>{l10n("· Room") + " "}{row.room}</span>
            </h2>

            {savedNotice ? (
              <span className="text-xs font-medium text-emerald-700">{l10n("· Saved")}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-snug">
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

            {/* Orthogonal Nurse Notification Status */}
            {status.nurseState !== 'none' && (
              <>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    status.nurseState === 'notify_now'
                      ? 'text-rose-800'
                      : status.nurseState === 'notify_shift'
                      ? 'text-amber-800'
                      : 'text-emerald-800'
                  }`}
                >
                  {status.nurseState === 'notified' ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <BellRing className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{status.nurseLabel}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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

          {prevRow && (
            <button
              type="button"
              onClick={() => onSelectResident(prevRow.room)}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={l10n("Previous: Room {{p1}} ({{p2}})", { p1: prevRow.room, p2: prevRow.residentName })}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="font-mono tabular-nums">{prevRow.room}</span>
            </button>
          )}

          {nextRow && (
            <button
              type="button"
              onClick={() => onSelectResident(nextRow.room)}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={l10n("Next: Room {{p1}} ({{p2}})", { p1: nextRow.room, p2: nextRow.residentName })}
            >
              <span className="font-mono tabular-nums">{nextRow.room}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Read-First Horizontal Shift Measurements Strip */}
      <div className="cb-resident-metrics">
        {!isEditingVitals ? (
          <>
          <div className="flex items-start justify-between gap-3">
            <div className="cb-resident-metric-grid">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && setIsEditingVitals(true)}
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
                onClick={() => !isLocked && setIsEditingVitals(true)}
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
                onClick={() => !isLocked && setIsEditingVitals(true)}
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
                onClick={() => !isLocked && setIsEditingVitals(true)}
                className="text-start group cursor-pointer disabled:cursor-default"
              >
                <div className="text-[11px] font-medium text-slate-500">{l10n("Repositioned")}</div>
                <div className="text-sm font-semibold tabular-nums text-slate-900 group-hover:text-teal-800 mt-0.5 leading-snug">
                  {row.mltcDetails?.lastRepositionTime?.value || '—'}
                </div>
              </button>
            </div>

            {!isLocked && (
              <button
                type="button"
                onClick={() => setIsEditingVitals(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <Pencil className="w-3 h-3" />
                <span>{l10n("Edit")}</span>
              </button>
            )}
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
        </>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">{l10n("Edit measurements")}</span>
              <button
                type="button"
                onClick={() => setIsEditingVitals(false)}
                className="text-xs font-semibold text-teal-800 hover:text-teal-950 px-2 py-0.5 rounded hover:bg-teal-50 cursor-pointer"
              >
                {l10n("Done")}
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{l10n("Fluids (mL)")}</span>
                  <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {l10n("&ge;")}{fluidMin}
                  </span>
                </label>
                <input
                  type="number"
                  value={fluidValue ?? ''}
                  disabled={isLocked}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    onUpdateRow(row.room, {
                      mltcDetails: {
                        ...row.mltcDetails,
                        fluidIntakeMl: { value: val, isPendingConfirmation: false },
                      },
                    });
                    triggerSavedIndicator();
                  }}
                  className={`w-full font-mono tabular-nums text-sm px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                    isLowFluid
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  placeholder="1150"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {l10n("Weight (kg)")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={row.mltcDetails?.weightKg?.value ?? ''}
                  disabled={isLocked}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    onUpdateRow(row.room, {
                      mltcDetails: {
                        ...row.mltcDetails,
                        weightKg: { value: val, isPendingConfirmation: false },
                      },
                    });
                    triggerSavedIndicator();
                  }}
                  className="w-full font-mono tabular-nums text-sm px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  placeholder="68.2"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{l10n("Bowel movement")}</span>
                  <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {l10n("<")}{bmHoursMax}{l10n("h")}
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={row.mltcDetails?.bowelMovement?.value || ''}
                    disabled={isLocked}
                    onChange={(e) => {
                      onUpdateRow(row.room, {
                        mltcDetails: {
                          ...row.mltcDetails,
                          bowelMovement: { value: e.target.value, isPendingConfirmation: false },
                        },
                      });
                      triggerSavedIndicator();
                    }}
                    className={`flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                      isBmOverdue
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    placeholder="08:30"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={hoursSinceBM ?? ''}
                      disabled={isLocked}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        onUpdateRow(row.room, {
                          mltcDetails: {
                            ...row.mltcDetails,
                            hoursSinceLastBM: { value: val, isPendingConfirmation: false },
                          },
                        });
                        triggerSavedIndicator();
                      }}
                      className={`w-16 font-mono tabular-nums text-sm px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-700 ${
                        isBmOverdue
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                      title={l10n("Hours since last bowel movement")}
                      aria-label={l10n("Hours since last bowel movement")}
                      placeholder="0"
                    />
                    <span className="text-xs font-medium text-slate-500 shrink-0">{l10n("hrs")}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {l10n("Repositioned")}
                </label>
                <input
                  type="text"
                  value={row.mltcDetails?.lastRepositionTime?.value || ''}
                  disabled={isLocked}
                  onChange={(e) => {
                    onUpdateRow(row.room, {
                      mltcDetails: {
                        ...row.mltcDetails,
                        lastRepositionTime: { value: e.target.value, isPendingConfirmation: false },
                      },
                    });
                    triggerSavedIndicator();
                  }}
                  className="w-full font-mono tabular-nums text-sm px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  placeholder="13:30"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main 2-Column Workspace (Reduces vertical scrolling on desktop) */}
      <div className="cb-resident-columns">
        {/* Left Column: Completed Care + Health & Changes */}
        <div className="cb-resident-observations">
          {/* GROUP 1: Completed Care (Read-first, Edit-on-demand) */}
          <section className="cb-resident-section space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{l10n("Completed care")}</h3>

              <div className="flex items-center gap-2 shrink-0">


                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setIsEditingCare((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {isEditingCare ? (
                      <span className="text-teal-800 font-semibold">{l10n("Done")}</span>
                    ) : (
                      <>
                        <Pencil className="w-3 h-3" />
                        <span>{l10n("Edit")}</span>
                      </>
                    )}
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

            {!isEditingCare ? (
              <><button
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && setIsEditingCare(true)}
                className={`w-full text-start text-sm leading-relaxed rounded-lg transition-colors ${
                  !isLocked ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1' : 'cursor-default'
                } ${careCompletedText.trim() ? 'text-slate-800' : 'text-slate-400 italic'}`}
              >
                {careCompletedText.trim() || l10n("Add completed care...")}
              </button><ClinicalText text={careCompletedText} previewOnly /></>
            ) : (
              <div className="space-y-2.5">


                <textarea dir="auto"
                  value={careCompletedText}
                  disabled={isLocked}
                  autoFocus
                  onChange={(e) => syncFieldImmediately('done', e.target.value)}
                  rows={2}
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 leading-relaxed"
                  placeholder={l10n("Baths, meals, hygiene, assistance, and mobility completed...")}
                />

                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ADD_CARE_CHIPS.map((chip) => {
                    const chipDisplay =
                      fileLanguage !== 'en' && chip.labels[fileLanguage]
                        ? chip.labels[fileLanguage]
                        : chip.en;
                    return (
                      <button
                        key={chip.en}
                        type="button"
                        onClick={() => handleAddCareChip(chip.en)}
                        className="text-xs font-medium bg-slate-50 hover:bg-teal-50 hover:text-teal-900 text-slate-700 border border-slate-200 hover:border-teal-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        + {chipDisplay}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* GROUP 2: Health & Changes (Progressive Stop & Watch + Nurse Escalation + Notes) */}
          <section className="cb-resident-section space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {l10n("Health changes")}
              </h3>

              {!isLocked && (
                <button
                  type="button"
                  onClick={() => setIsEditingFlags((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:text-teal-950 px-2 py-0.5 rounded-md hover:bg-teal-50 transition-colors cursor-pointer shrink-0"
                >
                  {isEditingFlags ? (
                    <span className="font-semibold">{l10n("Done")}</span>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{activeCodes.length > 0 ? l10n("Edit flags") : l10n("Flag change")}</span>
                    </>
                  )}
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
            {!isEditingFlags ? (
              activeCodes.length > 0 ? (
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
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => toggleCode(codeId)}
                            className="opacity-60 hover:opacity-100 p-0.5 cursor-pointer"
                            title={l10n("Remove flag")}
                            aria-label={l10n("Remove {{p1}}", { p1: translatedPrimary })}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500">{l10n("No health changes flagged")}</div>
              )
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {STOP_AND_WATCH_CONFIG.map((item) => {
                    const isSelected = activeCodes.includes(item.id);
                    const IconComp = getStopAndWatchIcon(item.id);
                    const tier = customCodeTiers?.[item.id] || item.defaultTier;
                    const tierBadge = TIER_METADATA[tier];
                    const translatedPrimary = getTranslatedStopAndWatchLabel(
                      item.id,
                      fileLanguage,
                      item.plainLabel || item.shortLabel
                    );

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => toggleCode(item.id)}
                        className={`px-2.5 py-1.5 rounded-xl border text-start transition-colors cursor-pointer flex items-center gap-2 group ${
                          isSelected
                            ? `${tierBadge.badgeBg} ${tierBadge.badgeBorder} ${tierBadge.badgeColor} font-semibold`
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        <IconComp
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'opacity-90' : 'text-slate-500 group-hover:text-teal-700'
                          }`}
                        />
                        <span className="text-xs leading-snug flex-1">{translatedPrimary}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedExplainingCode(item.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedExplainingCode(item.id);
                            }
                          }}
                          className="text-slate-400 hover:text-teal-700 p-0.5 rounded shrink-0 opacity-70 group-hover:opacity-100"
                          title={l10n("Details")}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {activeCodes.length > 0 && !isLocked && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCodes([]);
                        onUpdateRow(row.room, {
                          changeCodes: { value: [], isPendingConfirmation: false },
                        });
                        triggerSavedIndicator();
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      {l10n("Clear all flags")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Observations & Mood (Read-first, Edit-on-demand) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="cb-observation-heading">{l10n("Observations")}</h3>
                <div className="flex items-center gap-2">

                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      {isEditingNotes ? (
                        <span className="text-teal-800 font-semibold">{l10n("Done")}</span>
                      ) : (
                        <>
                          <Pencil className="w-3 h-3" />
                          <span>{l10n("Edit")}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!isEditingNotes ? (
                <><button
                  type="button"
                  disabled={isLocked}
                  onClick={() => !isLocked && setIsEditingNotes(true)}
                  className={`w-full text-start text-sm leading-relaxed rounded-lg transition-colors ${
                    !isLocked ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 py-1' : 'cursor-default'
                  } ${additionalNotesText.trim() ? 'text-slate-800' : 'text-slate-400 italic'}`}
                >
                  {additionalNotesText.trim() || l10n("Add mood, energy, or skin observations...")}
                </button><ClinicalText text={additionalNotesText} previewOnly /></>
              ) : (
                <div className="space-y-1.5">

                  <textarea dir="auto"
                    value={additionalNotesText}
                    disabled={isLocked}
                    autoFocus
                    onChange={(e) => syncFieldImmediately('notes', e.target.value)}
                    rows={2}
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700 leading-relaxed"
                    placeholder={l10n("Energy, mood, appetite, skin checks, or family updates...")}
                  />
                </div>
              )}
            </div>

            {/* Docked Charge Nurse Notification Row */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-xs ${
                status.needsNurseAction && !toldNurse
                  ? status.isUrgent
                    ? 'bg-rose-50/70 border-rose-200'
                    : 'bg-amber-50/70 border-amber-200'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={toldNurse}
                  disabled={isLocked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setToldNurse(checked);
                    onUpdateRow(row.room, {
                      toldNurse: { value: checked, isPendingConfirmation: false },
                      nurseInitials: {
                        value: checked ? nurseInitials || 'RN (KL)' : '',
                        isPendingConfirmation: false,
                      },
                    });
                    triggerSavedIndicator();
                  }}
                  className="w-4 h-4 text-teal-700 rounded border-slate-300 focus:ring-teal-700"
                />
                <span className="font-semibold text-slate-900">{l10n("Told Charge Nurse")}</span>
                {status.needsNurseAction && !toldNurse && (
                  <span
                    className={`font-medium ${
                      status.isUrgent ? 'text-rose-800' : 'text-amber-800'
                    }`}
                  >
                    · {status.isUrgent ? l10n("Required now") : l10n("Required this shift")}
                  </span>
                )}
              </label>

              {toldNurse && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">{l10n("Nurse")}</span>
                  <input
                    type="text"
                    value={nurseInitials}
                    disabled={isLocked}
                    onChange={(e) => {
                      setNurseInitials(e.target.value);
                      onUpdateRow(row.room, {
                        nurseInitials: { value: e.target.value, isPendingConfirmation: false },
                      });
                      triggerSavedIndicator();
                    }}
                    className="w-24 px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono font-semibold text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-teal-700"
                    placeholder={l10n("RN (KL)")}
                    aria-label={l10n("Charge nurse initials")}
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Unified Next Shift (Notes + Actionable Tasks) */}
        <section className="cb-resident-section cb-resident-next space-y-3">
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
                          onClick={() => setIsEditingNextSummary((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          {isEditingNextSummary ? (
                            <span className="text-teal-800 font-semibold">{l10n("Done")}</span>
                          ) : (
                            <>
                              <Pencil className="w-3 h-3" />
                              <span>{hasNextNote ? l10n("Edit note") : l10n("Add note")}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowAddTask((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:text-teal-950 px-2 py-0.5 rounded-md hover:bg-teal-50 transition-colors cursor-pointer"
                        >
                          {showAddTask ? (
                            <span className="font-semibold">{l10n("Done")}</span>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{l10n("Add task")}</span>
                            </>
                          )}
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
                {isEditingNextSummary ? (
                  <div className="space-y-1.5">

                    <input
                      type="text"
                      value={notDoneText === '—' ? '' : notDoneText}
                      disabled={isLocked}
                      autoFocus
                      onChange={(e) => syncFieldImmediately('notDone', e.target.value)}
                      placeholder={l10n("Carry-over note for incoming shift (e.g. Offer snack at 15:30)...")}
                      className="w-full text-sm px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                  </div>
                ) : hasNextNote ? (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setIsEditingNextSummary(true)}
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
                              setCareRequirements(nextReqs);
                              setNotDoneText('—');
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
                                onClick={() => handleRemoveRequirement(req.id)}
                                className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer opacity-70 group-hover:opacity-100"
                                title={l10n("Remove task")}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Progressive Inline Task Composer */}
                {showAddTask && !isLocked && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <SelectPopover label={l10n('Task category')} value={newReqCategory} onChange={setNewReqCategory}
                      options={(['Mobility', 'Dietary', 'Medication', 'Hygiene', 'Other'] as const)
                        .map((value) => ({ value, label: l10n(value) }))} />
                    <input
                      type="text"
                      value={newReqText}
                      onChange={(e) => setNewReqText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddManualRequirement();
                        }
                      }}
                      autoFocus
                      placeholder={l10n("Add follow-up task...")}
                      className="flex-1 min-w-[140px] text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualRequirement}
                      disabled={!newReqText.trim()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{l10n("Add")}</span>
                    </button>
                  </div>
                )}

                {/* Single Unified Empty State */}
                {!hasNextNote &&
                  !isEditingNextSummary &&
                  careRequirements.length === 0 &&
                  !showAddTask && (
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setIsEditingNextSummary(true)}
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
