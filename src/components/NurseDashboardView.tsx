import { cancelDialog, dismissDialog, handleDialogEscape } from '../utils/dialogMotion';
import { ClinicalText } from './ClinicalText';
import { l10n } from '../utils/localization';
import { useCompactLayout } from '../utils/useCompactLayout';
import { useOverlayScrollbars } from '../utils/overlayScrollbars';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertThresholds, HandoffRow, NurseEscalation } from '../types/handoff';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Droplet,
  HeartPulse,
  PersonStanding,
  ShieldAlert,
  SquareX,
  UserRound,
  X,
} from 'lucide-react';
import './NurseDashboardView.css';
import { Button, DraftDiscard, PageHeader, WorkspaceFooter } from './WorkspaceUi';
import {
  computeRowSeverity,
  getCodeConfig,
  SeverityTier,
  TIER_METADATA,
} from '../data/stopAndWatchCodes';
import {
  getStopAndWatchIcon,
  StopAndWatchDetailModal,
} from './StopAndWatchIconBadge';
import { getResidentStatus } from '../utils/residentStatus';

type TriageFilter = 'all' | 'pending' | 'resolved';

interface NurseDashboardViewProps {
  escalations: NurseEscalation[];
  rows: HandoffRow[];
  thresholds: AlertThresholds;
  nurseName: string;
  onNurseNameChange: (name: string) => void;
  customCodeTiers?: Record<string, SeverityTier>;
  onAcknowledgeEscalation: (
    id: string,
    nurseComment: string,
    nurseName: string,
    resolveImmediately?: boolean
  ) => void;
  onUpdateEscalationNote: (id: string, nurseComment: string) => void;
  onResolveEscalation: (id: string, nurseName: string, resolutionNote?: string) => void;
  onReopenEscalation: (id: string) => void;
  onCreateEscalationFromWatch?: (
    room: string,
    note: string,
    codes: string[],
    nurseComment: string,
    nurseName: string,
    resolveImmediately?: boolean
  ) => void;
  onOpenResidentInHandoff: (room: string) => void;
  onResetDemo: () => void;
}

interface AbnormalMetric {
  key: string;
  label: string;
  value: string;
  unit: string;
  thresholdNote: string;
  severity: 'urgent' | 'elevated';
}

interface EnrichedConcern {
  id: string;
  isUnescalatedWatch: boolean;
  esc?: NurseEscalation;
  room: string;
  residentName: string;
  timestamp: string;
  outgoingPsw: string;
  liveRow?: HandoffRow;
  codes: string[];
  baseTier: SeverityTier;
  effectiveTier: SeverityTier;
  prevShiftTier?: SeverityTier;
  escalatedByCount: boolean;
  escalatedByRepeat: boolean;
  isBmOverdue: boolean;
  hoursSinceBM: number | null | undefined;
  isLowFluid: boolean;
  fluidIntakeMl: number | null | undefined;
  fluidMinMl: number;
  bmThresholdHours: number;
  hasPendingVerification: boolean;
  stage: 'pending' | 'monitoring' | 'resolved';
  isPriorityAttention: boolean;
  priorityScore: number;
  concernHeadline: string;
  qualitativeObservation: string;
  abnormalMetrics: AbnormalMetric[];
}


function concernStatus(item: EnrichedConcern, compact = false): string {
  if (item.isUnescalatedWatch) return 'Unacknowledged watch';
  if (item.stage === 'pending') return compact ? 'This shift' : 'Needs review';
  return item.stage === 'resolved' ? 'Resolved' : 'Monitoring';
}

function bowelFinding(item: EnrichedConcern): string {
  return item.hoursSinceBM == null
    ? 'Bowel movement overdue'
    : l10n('No bowel movement for {{hours}} hours', { hours: item.hoursSinceBM });
}

function compactFinding(item: EnrichedConcern): string {
  if (item.isBmOverdue && item.effectiveTier !== 3) return bowelFinding(item);
  if (item.codes.includes('C') && /red area on left heel$/i.test(item.concernHeadline) &&
      /\bredness on heel does not blanch\b/i.test(item.qualitativeObservation)) {
    return 'Non-blanching heel redness';
  }
  if (item.codes.includes('H') && /^needed 2 people to transfer at lunch, usually 1$/i.test(item.concernHeadline)) {
    return 'Transfer now needs two people';
  }
  if (item.isUnescalatedWatch && item.isLowFluid) return 'Low fluid intake';
  return item.concernHeadline;
}

const UNFILLED_PLACEHOLDER_RE = /\[[^\]\n]+\]|_{3,}/;

function validateVerifiedClinicalNote(
  raw: string,
  emptyMessage: string
): { valid: boolean; reason?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, reason: emptyMessage };
  }
  if (UNFILLED_PLACEHOLDER_RE.test(trimmed)) {
    return {
      valid: false,
      reason:
        'Replace all bracketed placeholders ([...]) with verified bedside findings before saving.',
    };
  }
  if (trimmed.length < 6) {
    return {
      valid: false,
      reason: 'Document specific clinical findings or follow-up actions (at least 6 characters).',
    };
  }
  return { valid: true };
}

function getUrgencyLabel(item: EnrichedConcern): string {
  if (item.effectiveTier === 3 && item.isBmOverdue) {
    return 'Urgent now · Tier 3 & BM overdue';
  }
  if (item.effectiveTier === 3) {
    return 'Urgent now · Tier 3';
  }
  if (item.isBmOverdue) {
    return 'Urgent now · BM overdue';
  }
  if (item.effectiveTier === 2) {
    return 'This shift · Tier 2';
  }
  return 'Watch · Tier 1';
}

function formatConcernHeadline(
  note: string,
  codes: string[],
  isBmOverdue: boolean,
  hoursSinceBM: number | null | undefined,
  isLowFluid: boolean,
  fluidIntakeMl: number | null | undefined,
  customCodeTiers?: Record<string, SeverityTier>
): string {
  const cleaned = (note || '').trim();
  if (cleaned) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  const labels = codes
    .map((id) => getCodeConfig(id, customCodeTiers)?.plainLabel || id)
    .filter(Boolean);
  if (labels.length > 0) {
    return labels.join(', ');
  }
  const parts: string[] = [];
  if (isBmOverdue) {
    parts.push(hoursSinceBM ? l10n("No bowel movement logged for {{p1}}h", { p1: hoursSinceBM }) : 'Bowel movement overdue');
  }
  if (isLowFluid && fluidIntakeMl !== null && fluidIntakeMl !== undefined) {
    parts.push(l10n("Low fluid intake ({{p1}} mL)", { p1: fluidIntakeMl }));
  }
  return parts.length > 0 ? parts.join(' · ') : 'Clinical change reported';
}

interface AssessmentTemplate {
  label: string;
  template: string;
}

function getAssessmentTemplates(
  codes: string[],
  isBmOverdue: boolean,
  isLowFluid: boolean
): AssessmentTemplate[] {
  const templates: AssessmentTemplate[] = [];

  if (codes.includes('C')) {
    templates.push({
      label: 'Skin site template',
      template: 'Skin site inspected ([location], [size/blanching]): [action taken].',
    });
  }
  if (codes.includes('H') || codes.includes('O')) {
    templates.push({
      label: 'Mobility check template',
      template: 'Transfer/mobility checked ([1- or 2-person assist], [gait/balance]): [plan].',
    });
  }
  if (codes.includes('D') || codes.includes('A_ate') || isLowFluid) {
    templates.push({
      label: 'Hydration / intake template',
      template: 'Hydration/intake checked ([amount offered/taken], [tolerance]): [monitoring plan].',
    });
  }
  if (isBmOverdue || codes.includes('N')) {
    templates.push({
      label: 'Bowel protocol template',
      template: 'Bowel check ([abdominal findings], [hours since BM]): [protocol/intervention].',
    });
  }
  if (codes.includes('P')) {
    templates.push({
      label: 'Pain assessment template',
      template: 'Pain check ([site], [0-10 score]): [comfort/PRN action].',
    });
  }

  templates.push({
    label: 'Bedside vitals template',
    template: 'Bedside check ([BP/HR/Temp]): [observed status and follow-up plan].',
  });

  return templates.slice(0, 3);
}

export const NurseDashboardView: React.FC<NurseDashboardViewProps> = ({
  escalations,
  rows,
  thresholds,
  nurseName,
  onNurseNameChange,
  customCodeTiers,
  onAcknowledgeEscalation,
  onUpdateEscalationNote,
  onResolveEscalation,
  onReopenEscalation,
  onCreateEscalationFromWatch,
  onOpenResidentInHandoff,
  onResetDemo,
}) => {
  const [filter, setFilter] = useState<TriageFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailCodeId, setDetailCodeId] = useState<string | null>(null);
  const [isEditingNurseName, setIsEditingNurseName] = useState(false);
  const [nurseNameDraft, setNurseNameDraft] = useState(nurseName);
  const compact = useCompactLayout();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const assessmentInitial = useRef('');
  const draftFocus = useRef<HTMLElement | null>(null);
  const [assessmentDraft, setAssessmentDraft] = useState('');
  const [resolutionDraft, setResolutionDraft] = useState('');
  const [assessmentError, setAssessmentError] = useState('');
  const [resolutionError, setResolutionError] = useState('');
  const [showResolution, setShowResolution] = useState(false);
  const [checkedResolution, setCheckedResolution] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const criteriaRef = useRef<HTMLDialogElement>(null);
  const concernBody = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const resolutionRef = useRef<HTMLTextAreaElement>(null);
  const filterRef = useRef<HTMLElement>(null);
  const rowTriggerRef = useRef<HTMLButtonElement>(null);

  const bmThreshold = thresholds.bowelMovementHoursThreshold ?? 48;
  const fluidMin = thresholds.fluidIntakeMinMl ?? 1000;

  const { enrichedEscalations, unescalatedUrgentWatches, unescalatedLowFluidWatches } =
    useMemo(() => {
      const buildAbnormalMetrics = (
        isBmOverdue: boolean,
        hoursSinceBM: number | null | undefined,
        isLowFluid: boolean,
        fluidIntakeMl: number | null | undefined
      ): AbnormalMetric[] => {
        const metrics: AbnormalMetric[] = [];
        if (isBmOverdue) {
          metrics.push({
            key: 'bm',
            label: 'Since last BM',
            value: hoursSinceBM !== null && hoursSinceBM !== undefined ? `${hoursSinceBM}` : '>48',
            unit: 'h',
            thresholdNote: `Limit <${bmThreshold}h`,
            severity: 'urgent',
          });
        }
        if (isLowFluid && fluidIntakeMl !== null && fluidIntakeMl !== undefined) {
          metrics.push({
            key: 'fluid',
            label: 'Fluid intake',
            value: `${fluidIntakeMl}`,
            unit: 'mL',
            thresholdNote: `Target ≥${fluidMin} mL`,
            severity: fluidIntakeMl <= 600 ? 'urgent' : 'elevated',
          });
        }
        return metrics;
      };

      const mappedEscalations: EnrichedConcern[] = escalations.map((esc) => {
        const liveRow = rows.find((r) => r.room === esc.room);
        const codes =
          liveRow?.changeCodes?.value && liveRow.changeCodes.value.length > 0
            ? liveRow.changeCodes.value
            : esc.codes;

        const severity = computeRowSeverity(codes, {
          prevShiftTier: liveRow?.prevShiftTier,
          customTiers: customCodeTiers,
        });
        const baseTier: SeverityTier = severity?.baseTier ?? 1;
        const effectiveTier: SeverityTier = severity?.effectiveTier ?? 1;

        const hoursSinceBM = liveRow?.mltcDetails?.hoursSinceLastBM?.value;
        const bmText = (liveRow?.mltcDetails?.bowelMovement?.value || '').toLowerCase();
        const isBmOverdue =
          (hoursSinceBM !== null && hoursSinceBM !== undefined && hoursSinceBM >= bmThreshold) ||
          bmText.includes('48h') ||
          bmText.includes('3 days') ||
          bmText.includes('none in 3 days');

        const fluidIntakeMl = liveRow?.mltcDetails?.fluidIntakeMl?.value;
        const isLowFluid =
          fluidIntakeMl !== null && fluidIntakeMl !== undefined && fluidIntakeMl < fluidMin;

        const hasPendingVerification = liveRow
          ? getResidentStatus(liveRow, thresholds, customCodeTiers).hasPending
          : false;

        const stage: EnrichedConcern['stage'] =
          esc.status === 'pending'
            ? 'pending'
            : esc.resolutionStatus === 'resolved'
            ? 'resolved'
            : 'monitoring';

        // Priority Attention is strictly based on active clinical urgency, independent of acknowledgment status
        const isPriorityAttention =
          stage !== 'resolved' && (effectiveTier === 3 || isBmOverdue);

        const priorityScore =
          (effectiveTier === 3 ? 30 : effectiveTier === 2 ? 20 : 10) +
          (isBmOverdue ? 12 : 0) +
          (isLowFluid ? 3 : 0) +
          (stage === 'pending' ? 1 : 0);

        const qualitativeObservation = (
          liveRow?.mltcDetails?.qualitativeObservations?.value || ''
        ).trim();

        return {
          id: esc.id,
          isUnescalatedWatch: false,
          esc,
          room: esc.room,
          residentName: esc.residentName,
          timestamp: esc.timestamp,
          outgoingPsw: esc.outgoingPsw,
          liveRow,
          codes,
          baseTier,
          effectiveTier,
          prevShiftTier: liveRow?.prevShiftTier,
          escalatedByCount: Boolean(severity?.escalatedByCount),
          escalatedByRepeat: Boolean(severity?.escalatedByRepeat),
          isBmOverdue,
          hoursSinceBM,
          isLowFluid,
          fluidIntakeMl,
          fluidMinMl: fluidMin,
          bmThresholdHours: bmThreshold,
          hasPendingVerification,
          stage,
          isPriorityAttention,
          priorityScore,
          concernHeadline: formatConcernHeadline(
            esc.note,
            codes,
            isBmOverdue,
            hoursSinceBM,
            isLowFluid,
            fluidIntakeMl,
            customCodeTiers
          ),
          qualitativeObservation,
          abnormalMetrics: buildAbnormalMetrics(
            isBmOverdue,
            hoursSinceBM,
            isLowFluid,
            fluidIntakeMl
          ),
        };
      });

      const activeRooms = new Set(
        mappedEscalations.filter((item) => item.stage !== 'resolved').map((item) => item.room)
      );

      const unescalatedWatches: EnrichedConcern[] = rows
        .filter((r) => !activeRooms.has(r.room))
        .map((r) => {
          const hoursSinceBM = r.mltcDetails?.hoursSinceLastBM?.value;
          const bmText = (r.mltcDetails?.bowelMovement?.value || '').toLowerCase();
          const isBmOverdue =
            (hoursSinceBM !== null && hoursSinceBM !== undefined && hoursSinceBM >= bmThreshold) ||
            bmText.includes('48h') ||
            bmText.includes('3 days');
          const fluidIntakeMl = r.mltcDetails?.fluidIntakeMl?.value;
          const isLowFluid =
            fluidIntakeMl !== null && fluidIntakeMl !== undefined && fluidIntakeMl < fluidMin;

          if (!isBmOverdue && !isLowFluid) return null;

          const hasPendingVerification = getResidentStatus(
            r,
            thresholds,
            customCodeTiers
          ).hasPending;
          const effectiveTier: SeverityTier = isBmOverdue ? 2 : 1;
          const qualitativeObservation = (
            r.mltcDetails?.qualitativeObservations?.value || ''
          ).trim();

          return {
            id: `watch-${r.room}`,
            isUnescalatedWatch: true,
            room: r.room,
            residentName: r.residentName,
            timestamp: 'Active shift',
            outgoingPsw: 'Threshold rule',
            liveRow: r,
            codes: r.changeCodes?.value || [],
            baseTier: effectiveTier,
            effectiveTier,
            prevShiftTier: r.prevShiftTier,
            escalatedByCount: false,
            escalatedByRepeat: false,
            isBmOverdue,
            hoursSinceBM,
            isLowFluid,
            fluidIntakeMl,
            fluidMinMl: fluidMin,
            bmThresholdHours: bmThreshold,
            hasPendingVerification,
            stage: isBmOverdue ? 'pending' : 'monitoring',
            isPriorityAttention: isBmOverdue,
            priorityScore: isBmOverdue ? 25 : 8,
            concernHeadline: formatConcernHeadline(
              '',
              r.changeCodes?.value || [],
              isBmOverdue,
              hoursSinceBM,
              isLowFluid,
              fluidIntakeMl,
              customCodeTiers
            ),
            qualitativeObservation,
            abnormalMetrics: buildAbnormalMetrics(
              isBmOverdue,
              hoursSinceBM,
              isLowFluid,
              fluidIntakeMl
            ),
          } as EnrichedConcern;
        })
        .filter((item): item is EnrichedConcern => item !== null);

      const sortConcerns = (a: EnrichedConcern, b: EnrichedConcern) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        return a.room.localeCompare(b.room);
      };

      return {
        enrichedEscalations: mappedEscalations.sort(sortConcerns),
        unescalatedUrgentWatches: unescalatedWatches
          .filter((w) => w.isPriorityAttention)
          .sort(sortConcerns),
        unescalatedLowFluidWatches: unescalatedWatches
          .filter((w) => !w.isPriorityAttention)
          .sort(sortConcerns),
      };
    }, [escalations, rows, thresholds, customCodeTiers, bmThreshold, fluidMin]);

  // Partition items cleanly across the three architectural areas
  const priorityAttentionItems = useMemo(
    () =>
      [
        ...enrichedEscalations.filter((item) => item.isPriorityAttention),
        ...unescalatedUrgentWatches,
      ].sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        return a.room.localeCompare(b.room);
      }),
    [enrichedEscalations, unescalatedUrgentWatches]
  );

  const pendingItemsAll = useMemo(
    () => [
      ...enrichedEscalations.filter((item) => item.stage === 'pending'),
      ...unescalatedUrgentWatches,
    ],
    [enrichedEscalations, unescalatedUrgentWatches]
  );

  const monitoringItemsAll = useMemo(
    () => enrichedEscalations.filter((item) => item.stage === 'monitoring'),
    [enrichedEscalations]
  );

  const resolvedItems = useMemo(
    () => enrichedEscalations.filter((item) => item.stage === 'resolved'),
    [enrichedEscalations]
  );

  // Non-priority items for Area 3 (two-column Care Follow-up)
  const otherPendingItems = useMemo(
    () => pendingItemsAll.filter((item) => !item.isPriorityAttention),
    [pendingItemsAll]
  );

  const otherMonitoringItems = useMemo(
    () => [
      ...monitoringItemsAll.filter((item) => !item.isPriorityAttention),
      ...unescalatedLowFluidWatches,
    ],
    [monitoringItemsAll, unescalatedLowFluidWatches]
  );

  const totalActiveCount =
    pendingItemsAll.length + monitoringItemsAll.length + unescalatedLowFluidWatches.length;
  const selectedConcern = [...enrichedEscalations, ...unescalatedUrgentWatches, ...unescalatedLowFluidWatches]
    .find((item) => item.id === selectedId);
  const detailCodeConfig = detailCodeId ? getCodeConfig(detailCodeId, customCodeTiers) : null;
  const detailTierMeta = detailCodeConfig ? TIER_METADATA[detailCodeConfig.defaultTier] : null;
  useOverlayScrollbars(dialogRef, 'both', Boolean(selectedConcern) && !compact);
  useOverlayScrollbars(concernBody, 'y', Boolean(selectedConcern) && compact);
  useOverlayScrollbars(criteriaRef, 'both', Boolean(detailCodeConfig));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedConcern && !dialog?.open) dialog?.showModal();
    if (!selectedConcern && dialog?.open) dialog.close();
  }, [selectedConcern]);

  useEffect(() => {
    if (detailCodeConfig && !criteriaRef.current?.open) criteriaRef.current?.showModal();
  }, [detailCodeConfig]);

  const openConcern = (item: EnrichedConcern, trigger: HTMLButtonElement) => {
    rowTriggerRef.current = trigger;
    assessmentInitial.current = item.stage === 'monitoring' ? item.esc?.nurseComment || '' : '';
    setAssessmentDraft(assessmentInitial.current);
    setConfirmDiscard(false);
    setResolutionDraft('');
    setAssessmentError('');
    setResolutionError('');
    setShowResolution(false);
    setCheckedResolution(false);
    setAnnouncement('');
    setSelectedId(item.id);
  };

  useLayoutEffect(() => {
    if (confirmDiscard || !draftFocus.current) return;
    draftFocus.current.focus({ preventScroll: true });
    draftFocus.current = null;
  }, [confirmDiscard]);

  const resumeConcern = () => setConfirmDiscard(false);

  const requestConcernClose = () => {
    if (confirmDiscard) {
      resumeConcern();
      return;
    }
    if (assessmentDraft !== assessmentInitial.current || resolutionDraft || checkedResolution) {
      draftFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setConfirmDiscard(true);
    } else dismissDialog(dialogRef.current);
  };

  const handleDialogClose = () => {
    setSelectedId(null);
    setConfirmDiscard(false);
    draftFocus.current = null;
    setDetailCodeId(null);
    const trigger = rowTriggerRef.current;
    if (trigger?.isConnected) {
      trigger.focus();
    } else {
      filterRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    }
  };

  const saveNurseIdentity = () => {
    const trimmed = nurseNameDraft.trim();
    if (trimmed) onNurseNameChange(trimmed);
    setIsEditingNurseName(false);
    queueMicrotask(() => document.getElementById('clinical-review-nurse')?.focus());
  };

  const saveConcern = (item: EnrichedConcern, resolve: boolean) => {
    const needsReview = item.stage === 'pending' || item.isUnescalatedWatch;
    const useResolutionNote = resolve && !needsReview;
    const note = (useResolutionNote ? resolutionDraft : assessmentDraft).trim();
    const check = validateVerifiedClinicalNote(
      note,
      resolve
        ? 'Document verified clinical resolution findings before marking resolved.'
        : 'Document your verified bedside assessment or monitoring plan before saving.'
    );
    if (!check.valid) {
      (useResolutionNote ? setResolutionError : setAssessmentError)(check.reason || '');
      (useResolutionNote ? resolutionRef : noteRef).current?.focus();
      return;
    }
    if (resolve && !checkedResolution) return;

    if (item.isUnescalatedWatch) {
      if (onCreateEscalationFromWatch) {
        onCreateEscalationFromWatch(
          item.room,
          item.concernHeadline,
          item.isBmOverdue && !item.codes.includes('N') ? [...item.codes, 'N'] : item.codes,
          note,
          nurseName,
          resolve
        );
      } else {
        onOpenResidentInHandoff(item.room);
      }
    } else if (item.esc && needsReview) {
      onAcknowledgeEscalation(item.esc.id, note, nurseName, resolve);
    } else if (item.esc && resolve) {
      onResolveEscalation(item.esc.id, nurseName, note);
    } else if (item.esc) {
      onUpdateEscalationNote(item.esc.id, note);
    }

    setAnnouncement(resolve ? 'Concern resolved.' : 'Assessment saved.');
    dismissDialog(dialogRef.current);
  };

  const renderCodeCriteriaButtons = (codes: string[]) => {
    if (codes.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {codes.map((codeId) => {
          const cfg = getCodeConfig(codeId, customCodeTiers);
          const IconComponent = getStopAndWatchIcon(codeId);
          const tier = cfg?.defaultTier ?? 1;
          const styleClass =
            tier === 3
              ? 'border-rose-200 bg-rose-50/70 text-rose-900 hover:bg-rose-100/70'
              : tier === 2
              ? 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70'
              : 'border-sky-200 bg-sky-50/70 text-sky-900 hover:bg-sky-100/70';

          return (
            <button
              key={codeId}
              type="button"
              onClick={() => setDetailCodeId(codeId)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${styleClass}`}
              title={l10n("Inspect Stop & Watch clinical criteria")}
            >
              <IconComponent className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {cfg ? `${cfg.letter} · ${cfg.plainLabel || cfg.shortLabel}` : codeId}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderResidentRecordOnDemand = (item: EnrichedConcern) => {
    const row = item.liveRow;

    return (
      <div className="border-t border-slate-100 bg-slate-50/60 px-5 sm:px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-slate-900">
              {l10n("Complete Resident Record · Room") + " "}{item.room} {item.residentName}
            </span>
            {item.hasPendingVerification && (
              <span className="text-amber-800 font-medium">
                {l10n("· Unverified AI entries on Handoff Sheet")}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenResidentInHandoff(item.room)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer whitespace-nowrap"
          >
            <span>{l10n("Open in Handoff Sheet")}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {row ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-slate-200/70">
              <div>
                <div className="text-[11px] font-medium text-slate-500">{l10n("Fluids")}</div>
                <div
                  className={`text-sm font-semibold font-mono tabular-nums mt-0.5 ${
                    item.isLowFluid ? 'text-amber-800' : 'text-slate-900'
                  }`}
                >
                  {item.fluidIntakeMl !== null && item.fluidIntakeMl !== undefined
                    ? l10n("{{p1}} mL", { p1: item.fluidIntakeMl })
                    : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500">{l10n("Bowel movement")}</div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${
                    item.isBmOverdue ? 'text-rose-800' : 'text-slate-900'
                  }`}
                >
                  {row.mltcDetails?.bowelMovement?.value || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500">{l10n("Weight")}</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                  {row.mltcDetails?.weightKg?.value !== null &&
                  row.mltcDetails?.weightKg?.value !== undefined
                    ? l10n("{{p1}} kg", { p1: row.mltcDetails.weightKg.value })
                    : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500">{l10n("Last repositioned")}</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                  {row.mltcDetails?.lastRepositionTime?.value || '—'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700 leading-relaxed">
              <div>
                <span className="font-semibold text-slate-800">{l10n("Care completed:") + " "}</span>
                <span>{row.done?.value || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-800">{l10n("Next-shift handover:") + " "}</span>
                <span>{row.notDoneNextShift?.value || '—'}</span>
              </div>
            </div>

            {row.careRequirements && row.careRequirements.length > 0 && (
              <div className="pt-1 text-slate-700">
                <span className="font-semibold text-slate-800">{l10n("Care requirements:") + " "}</span>
                <span>
                  {row.careRequirements
                    .map((req) => `${req.category}: ${req.action_item}`)
                    .join(' · ')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {l10n("No live shift record found for Room") + " "}{item.room}.
          </p>
        )}
      </div>
    );
  };


  const renderSignals = (item: EnrichedConcern) => (
    <span className="clinical-review-signals">
      {item.isLowFluid && <span><Droplet />{" " + l10n("Low fluid intake ·") + " "}{item.fluidIntakeMl}{" " + l10n("mL")}</span>}
      {item.hasPendingVerification && <span><ShieldAlert />{" " + l10n("Unverified handoff entries")}</span>}
      {item.isBmOverdue && compactFinding(item) !== bowelFinding(item) && (
        <span><Clock /> {bowelFinding(item)}</span>
      )}
    </span>
  );

  const renderGroup = (
    title: string,
    Icon: typeof Clock,
    items: EnrichedConcern[],
    tone = '',
  ) => items.length > 0 && (
    <section className="clinical-review-group">
      <h2 className={tone}><Icon /> {l10n(title)} <span className="clinical-review-count">{items.length}</span></h2>
      <div className="cb-panel clinical-review-list">
        {items.map((item) => {
          const FindingIcon = item.stage === 'resolved' ? Check
            : item.isBmOverdue ? Clock
            : item.codes.includes('C') ? SquareX
            : item.codes.includes('H') ? PersonStanding
            : item.codes.length ? getStopAndWatchIcon(item.codes[0])
            : item.isLowFluid ? Droplet : HeartPulse;
          const action = item.stage === 'resolved' ? 'View'
            : item.stage === 'pending' || item.isUnescalatedWatch ? 'Review' : 'Follow up';
          return (
            <button
              key={item.id}
              type="button"
              data-escalation-room={item.room}
              className="clinical-review-row"
              aria-haspopup="dialog"
              onClick={(event) => openConcern(item, event.currentTarget)}
            >
              <span className="clinical-review-symbol" data-tone={tone}><FindingIcon /></span>
              <span className="clinical-review-row-copy min-w-0">
                <span className="clinical-review-identity">
                  <strong>{item.residentName}</strong>
                  <span>{l10n("· Room") + " "}{item.room}</span>
                  <span>· {l10n(concernStatus(item, true))}</span>
                </span>
                <span className="clinical-review-finding"><bdi>{l10n(compactFinding(item))}</bdi></span>
                {renderSignals(item)}
              </span>
              <span className="clinical-review-action">{action} <ChevronRight /></span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderConcernDetail = (item: EnrichedConcern) => {
    const needsReview = item.stage === 'pending' || item.isUnescalatedWatch;
    const resolved = item.stage === 'resolved';
    const finding = compactFinding(item);
    const esc = item.esc;
    const templates = needsReview ? getAssessmentTemplates(item.codes, item.isBmOverdue, item.isLowFluid) : [];
    const saveAction = <Button type="submit" form="clinical-review-form" variant="primary">
      {needsReview ? l10n("Save & monitor") : l10n("Save follow-up")}
    </Button>;
    return <>
      <div className="clinical-review-dialog-body" data-assessable={!resolved || undefined} ref={concernBody} hidden={confirmDiscard}>
        <div className="clinical-review-detail-head cb-adaptive-head">
          <div>
            <p className="clinical-review-sub">{l10n("Room") + " "}{item.room} · {l10n(concernStatus(item))}</p>
            <h2 id="clinical-review-dialog-title">{item.residentName}</h2>
          </div>
          <button type="button" autoFocus className="clinical-review-close" aria-label={l10n("Close clinical review")}
            onClick={requestConcernClose}><X aria-hidden="true" /></button>
        </div>
        <section className="clinical-review-block">
          <h3 className={item.isPriorityAttention ? 'priority' : undefined}>
            {item.isPriorityAttention ? l10n("Priority attention") : l10n("Reported concern")}
          </h3>
          <p><strong>{l10n(finding)}</strong></p>
          {renderSignals(item)}
          {item.esc?.note && <p><ClinicalText text={item.esc.note} /></p>}
          {item.qualitativeObservation && item.qualitativeObservation !== item.esc?.note && <p><ClinicalText text={item.qualitativeObservation} /></p>}
          <p className="clinical-review-sub">{item.outgoingPsw} · {item.timestamp}</p>
        </section>
        {esc?.nurseComment && (
          <section className="clinical-review-block">
            <h3>{l10n("Latest nurse assessment")}</h3>
            <p><ClinicalText text={esc.nurseComment} /></p>
            <p className="clinical-review-sub">{[esc.acknowledgedBy, esc.acknowledgedAt].filter(Boolean).join(' · ')}</p>
          </section>
        )}
        {resolved && esc && (
          <section className="clinical-review-block">
            <h3>{l10n("Resolution")}</h3>
            {esc.resolutionNote && <p><ClinicalText text={esc.resolutionNote} /></p>}
            <p className="clinical-review-sub">{[esc.resolvedBy || esc.acknowledgedBy, esc.resolvedAt].filter(Boolean).join(' · ')}</p>
          </section>
        )}
        <details className="clinical-review-block">
          <summary>{l10n("Clinical context")}</summary>
          <div className="space-y-3 pb-2 text-sm">
            <p>{l10n(getUrgencyLabel(item))}</p>
            {item.isPriorityAttention && item.abnormalMetrics.length === 0 && (
              <p>{l10n("Immediate RN evaluation indicated")}</p>
            )}
            {item.prevShiftTier && <p>{l10n("Prior shift: Tier") + " "}{item.prevShiftTier}{item.escalatedByRepeat ? l10n(" (repeat escalated)") : ''}</p>}
            {item.escalatedByCount && <p>{l10n("3+ changes (Base Tier") + " "}{item.baseTier}{" " + l10n("→ Tier") + " "}{item.effectiveTier})</p>}
            {item.abnormalMetrics.map((metric) => (
              <p key={metric.key}>{l10n(metric.label)}: {metric.value} {metric.unit} · {l10n(metric.thresholdNote)}</p>
            ))}
            {renderCodeCriteriaButtons(item.codes)}
          </div>
          {renderResidentRecordOnDemand(item)}
          {templates.length > 0 && (
            <details>
              <summary>{l10n("Documentation templates")}</summary>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((template) => (
                  <button type="button" key={l10n(template.label)} className="clinical-review-template" onClick={() => {
                    setAssessmentDraft(template.template);
                    setAssessmentError('');
                    setCheckedResolution(false);
                    noteRef.current?.focus();
                  }}>+ {l10n(template.label)}</button>
                ))}
              </div>
            </details>
          )}
        </details>
        {item.hasPendingVerification && (
          <p className="clinical-review-warning">
            <ShieldAlert />{" " + l10n("This resident has unverified AI-extracted handoff entries. Confirm findings directly at bedside or on the Handoff Sheet before signing off.")}
          </p>
        )}
        {resolved && esc ? (
          <div className="clinical-review-block clinical-review-actions">
            <Button variant="primary" onClick={() => {
              onReopenEscalation(esc.id);
              setAnnouncement('Concern reopened for monitoring.');
              dismissDialog(dialogRef.current);
            }}>{l10n("Reopen for monitoring")}</Button>
          </div>
        ) : (
          <form className="clinical-review-block" id="clinical-review-form" onSubmit={(event) => {
            event.preventDefault();
            saveConcern(item, false);
          }}>
            <label htmlFor="clinical-review-note"><strong>{l10n("Assessment / follow-up")}</strong></label>
            <textarea dir="auto" className="cb-field"
              ref={noteRef}
              id="clinical-review-note"
              aria-invalid={Boolean(assessmentError)}
              aria-describedby={assessmentError ? "clinical-assessment-error" : undefined}
              value={assessmentDraft}
              onChange={(event) => {
                setAssessmentDraft(event.target.value);
                setAssessmentError('');
                if (needsReview) setCheckedResolution(false);
              }}
              placeholder={l10n("Record verified findings and actions...")}
            />
            {assessmentError && <p id="clinical-assessment-error" role="alert" className="priority">{l10n(assessmentError)}</p>}
            <div className="clinical-review-actions">
              {!compact && saveAction}
              <Button aria-expanded={showResolution}
                onClick={() => {
                  setShowResolution(!showResolution);
                  setCheckedResolution(false);
                  setResolutionError('');
                }}>{l10n("Resolve concern")}</Button>
            </div>
            {showResolution && (
              <div className="clinical-review-block">
                {!needsReview && (
                  <>
                    <label htmlFor="clinical-review-resolution"><strong>{l10n("Verified clinical resolution outcome")}</strong></label>
                    <textarea dir="auto" className="cb-field" id="clinical-review-resolution" ref={resolutionRef} value={resolutionDraft}
                      aria-invalid={Boolean(resolutionError)}
                      aria-describedby={resolutionError ? "clinical-resolution-error" : undefined}
                      onChange={(event) => {
                        setResolutionDraft(event.target.value);
                        setCheckedResolution(false);
                        setResolutionError('');
                      }} />
                    {resolutionError && <p id="clinical-resolution-error" role="alert" className="priority">{l10n(resolutionError)}</p>}
                  </>
                )}
                <label className="clinical-review-verify">
                  <input type="checkbox" checked={checkedResolution}
                    onChange={(event) => setCheckedResolution(event.target.checked)} />
                  {l10n("I verified that this concern is resolved.")}
                </label>
                <div className="clinical-review-actions">
                  <Button disabled={!checkedResolution}
                    onClick={() => saveConcern(item, true)}>{l10n("Confirm resolution")}</Button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
      {compact && !resolved && !confirmDiscard && <footer className="clinical-review-footer">{saveAction}</footer>}
      {confirmDiscard && <DraftDiscard titleId="clinical-review-discard-title"
        context={<><bdi>{item.residentName}</bdi> {l10n('· Room')} <bdi>{item.room}</bdi></>}
        onKeepEditing={resumeConcern} onDiscard={() => dismissDialog(dialogRef.current)} />}
    </>;
  };

  const filters: { id: TriageFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Active', count: totalActiveCount },
    { id: 'pending', label: 'Needs review', count: pendingItemsAll.length },
    { id: 'resolved', label: 'History', count: resolvedItems.length },
  ];
  return (
    <div className="clinical-review">
      <PageHeader title={l10n("Clinical review")}
        actions={isEditingNurseName ? (
          <form className="clinical-review-nurse" onSubmit={(event) => {
            event.preventDefault();
            saveNurseIdentity();
          }}>
            <input aria-label={l10n("Duty nurse name and credentials")} autoFocus value={nurseNameDraft}
              onChange={(event) => setNurseNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsEditingNurseName(false);
                  queueMicrotask(() => document.getElementById('clinical-review-nurse')?.focus());
                }
              }} />
            <button type="submit">{l10n("Save")}</button>
          </form>
        ) : (
          <button type="button" id="clinical-review-nurse" className="clinical-review-nurse"
            aria-label={l10n('Edit signing nurse name: {{nurse}}', { nurse: nurseName })}
            onClick={() => {
              setNurseNameDraft(nurseName);
              setIsEditingNurseName(true);
            }}>
            <span className="clinical-review-avatar"><UserRound aria-hidden="true" /></span><bdi>{nurseName}</bdi>
          </button>
        )} />
      <nav className="clinical-review-tabs" aria-label={l10n("Review filters")} ref={filterRef}>
        {filters.map((tab) => (
          <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => setFilter(tab.id)}>
            {l10n(tab.label)}<span className="clinical-review-count">{tab.count}</span>
          </button>
        ))}
      </nav>
      {renderGroup('Priority attention', CircleAlert, priorityAttentionItems, 'priority')}
      {filter === 'resolved' ? (
        resolvedItems.length ? renderGroup('History', Check, resolvedItems, 'history')
          : <p className="clinical-review-empty">{l10n("No resolved concerns this shift.")}</p>
      ) : (
        <>
          {renderGroup('Needs review', Clock, otherPendingItems, 'pending')}
          {filter === 'all' && renderGroup('Monitoring', HeartPulse, otherMonitoringItems)}
          {filter === 'all' && totalActiveCount === 0 && <p className="clinical-review-empty">{l10n("No active concerns.")}</p>}
          {filter === 'pending' && !pendingItemsAll.length && !priorityAttentionItems.length && (
            <p className="clinical-review-empty">{l10n("No concerns need review.")}</p>
          )}
        </>
      )}
      <WorkspaceFooter>
        {confirmReset ? (
          <div className="clinical-review-reset">
            <span>{l10n("Reset all demo records and handoff entries?")}</span>
            <button type="button" onClick={onResetDemo}>{l10n("Confirm reset")}</button>
            <button type="button" onClick={() => setConfirmReset(false)}>{l10n("Cancel")}</button>
          </div>
        ) : (
          <Button variant="quiet" onClick={() => setConfirmReset(true)}>{l10n("Reset demo")}</Button>
        )}
      </WorkspaceFooter>
      <div className="sr-only" role="status">{l10n(announcement)}</div>
      <dialog onKeyDown={(event) => handleDialogEscape(event, requestConcernClose)}
        onCancel={(event) => { event.preventDefault(); requestConcernClose(); }}
        className="clinical-review-dialog cb-motion-dialog cb-adaptive-detail" ref={dialogRef}
        aria-labelledby={confirmDiscard ? "clinical-review-discard-title" : "clinical-review-dialog-title"} onClose={handleDialogClose}>
        {selectedConcern && renderConcernDetail(selectedConcern)}
      </dialog>
      {detailCodeConfig && detailTierMeta && (
        <dialog onCancel={cancelDialog} className="clinical-review-criteria cb-adaptive-sheet cb-motion-dialog" ref={criteriaRef} aria-label={l10n("Stop & Watch clinical criteria")}
          onClose={() => setDetailCodeId(null)}>
          <StopAndWatchDetailModal embedded config={detailCodeConfig} tierMeta={detailTierMeta}
            onClose={() => dismissDialog(criteriaRef.current)} />
        </dialog>
      )}
    </div>
  );
};
