import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertThresholds,
  HandoffRow,
  NurseEscalation,
} from '../types/handoff';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  FileText,
  Info,
  OctagonAlert,
  Pencil,
  RotateCcw,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
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

type TriageFilter = 'all' | 'pending' | 'monitoring' | 'resolved';

interface NurseDashboardViewProps {
  escalations: NurseEscalation[];
  rows: HandoffRow[];
  thresholds: AlertThresholds;
  unit?: string;
  shift?: string;
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
    parts.push(hoursSinceBM ? `No bowel movement logged for ${hoursSinceBM}h` : 'Bowel movement overdue');
  }
  if (isLowFluid && fluidIntakeMl !== null && fluidIntakeMl !== undefined) {
    parts.push(`Low fluid intake (${fluidIntakeMl} mL)`);
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
  unit = 'Maple Neighborhood',
  shift,
  customCodeTiers,
  onAcknowledgeEscalation,
  onUpdateEscalationNote,
  onResolveEscalation,
  onReopenEscalation,
  onCreateEscalationFromWatch,
  onOpenResidentInHandoff,
}) => {
  const [filter, setFilter] = useState<TriageFilter>('all');
  const [openAssessmentIds, setOpenAssessmentIds] = useState<Record<string, boolean>>({});
  const [openRecordIds, setOpenRecordIds] = useState<Record<string, boolean>>({});
  const [showResolvedDrawer, setShowResolvedDrawer] = useState(false);

  const [nurseName, setNurseName] = useState('K. Lewis, RN');
  const [isEditingNurseName, setIsEditingNurseName] = useState(false);
  const [nurseNameDraft, setNurseNameDraft] = useState('K. Lewis, RN');

  // Drafts & validation errors keyed by concern ID
  const [assessmentDrafts, setAssessmentDrafts] = useState<Record<string, string>>({});
  const [assessmentErrors, setAssessmentErrors] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState('');
  const [editingNoteError, setEditingNoteError] = useState<string | null>(null);
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const [resolutionErrors, setResolutionErrors] = useState<Record<string, string>>({});
  const [detailCodeId, setDetailCodeId] = useState<string | null>(null);

  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const resolutionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const totalActiveCount = pendingItemsAll.length + monitoringItemsAll.length;

  // Escape closes code criteria modal
  useEffect(() => {
    if (!detailCodeId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailCodeId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailCodeId]);

  const toggleAssessment = (id: string) => {
    setOpenAssessmentIds((prev) => ({ ...prev, [id]: !prev[id] }));
    setAssessmentErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setResolutionErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleRecord = (id: string) => {
    setOpenRecordIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const saveNurseIdentity = () => {
    const trimmed = nurseNameDraft.trim();
    if (trimmed) {
      setNurseName(trimmed);
    } else {
      setNurseNameDraft(nurseName);
    }
    setIsEditingNurseName(false);
  };

  const handleInsertTemplate = (concernId: string, template: string) => {
    setAssessmentDrafts((prev) => ({ ...prev, [concernId]: template }));
    setAssessmentErrors((prev) => {
      const next = { ...prev };
      delete next[concernId];
      return next;
    });
    setTimeout(() => {
      textareaRefs.current[concernId]?.focus();
    }, 0);
  };

  const handleAcknowledge = (item: EnrichedConcern, resolveImmediately: boolean) => {
    const draft = assessmentDrafts[item.id] || '';
    const check = validateVerifiedClinicalNote(
      draft,
      resolveImmediately
        ? 'Document your verified clinical assessment and resolution findings before resolving.'
        : 'Document your verified bedside assessment or monitoring plan before acknowledging.'
    );

    if (!check.valid) {
      setAssessmentErrors((prev) => ({ ...prev, [item.id]: check.reason || '' }));
      textareaRefs.current[item.id]?.focus();
      return;
    }

    const verifiedComment = draft.trim();

    if (item.isUnescalatedWatch) {
      if (onCreateEscalationFromWatch) {
        onCreateEscalationFromWatch(
          item.room,
          item.concernHeadline,
          item.isBmOverdue && !item.codes.includes('N') ? [...item.codes, 'N'] : item.codes,
          verifiedComment,
          nurseName,
          resolveImmediately
        );
      } else {
        onOpenResidentInHandoff(item.room);
      }
    } else if (item.esc) {
      onAcknowledgeEscalation(item.esc.id, verifiedComment, nurseName, resolveImmediately);
    }

    setAssessmentDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setAssessmentErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setOpenAssessmentIds((prev) => ({ ...prev, [item.id]: false }));
  };

  const handleSaveNoteEdit = (escId: string) => {
    const check = validateVerifiedClinicalNote(
      editingNoteDraft,
      'Enter verified monitoring notes before saving.'
    );
    if (!check.valid) {
      setEditingNoteError(check.reason || 'Invalid clinical note.');
      return;
    }
    onUpdateEscalationNote(escId, editingNoteDraft.trim());
    setEditingNoteId(null);
    setEditingNoteError(null);
  };

  const handleMarkResolved = (item: EnrichedConcern) => {
    if (!item.esc) return;
    const draft = resolutionDrafts[item.id] || '';
    const check = validateVerifiedClinicalNote(
      draft,
      'Document verified clinical resolution findings before marking resolved.'
    );
    if (!check.valid) {
      setResolutionErrors((prev) => ({ ...prev, [item.id]: check.reason || '' }));
      resolutionInputRefs.current[item.id]?.focus();
      return;
    }

    onResolveEscalation(item.esc.id, nurseName, draft.trim());
    setResolutionDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setResolutionErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setOpenAssessmentIds((prev) => ({ ...prev, [item.id]: false }));
  };

  const detailCodeConfig = detailCodeId ? getCodeConfig(detailCodeId, customCodeTiers) : null;
  const detailTierMeta = detailCodeConfig ? TIER_METADATA[detailCodeConfig.defaultTier] : null;

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
              title="Inspect Stop & Watch clinical criteria"
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
    if (!openRecordIds[item.id]) return null;
    const row = item.liveRow;

    return (
      <div className="border-t border-slate-100 bg-slate-50/60 px-5 sm:px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-semibold text-slate-900">
              Complete Resident Record · Room {item.room} {item.residentName}
            </span>
            {item.hasPendingVerification && (
              <span className="text-amber-800 font-medium">
                · Unverified AI entries on Handoff Sheet
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenResidentInHandoff(item.room)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer whitespace-nowrap"
          >
            <span>Open in Handoff Sheet</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {row ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-slate-200/70">
              <div>
                <div className="text-[11px] font-medium text-slate-500">Fluids</div>
                <div
                  className={`text-sm font-semibold font-mono tabular-nums mt-0.5 ${
                    item.isLowFluid ? 'text-amber-800' : 'text-slate-900'
                  }`}
                >
                  {item.fluidIntakeMl !== null && item.fluidIntakeMl !== undefined
                    ? `${item.fluidIntakeMl} mL`
                    : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500">Bowel movement</div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${
                    item.isBmOverdue ? 'text-rose-800' : 'text-slate-900'
                  }`}
                >
                  {row.mltcDetails?.bowelMovement?.value || '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500">Weight</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                  {row.mltcDetails?.weightKg?.value !== null &&
                  row.mltcDetails?.weightKg?.value !== undefined
                    ? `${row.mltcDetails.weightKg.value} kg`
                    : '—'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-500">Last repositioned</div>
                <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 mt-0.5">
                  {row.mltcDetails?.lastRepositionTime?.value || '—'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700 leading-relaxed">
              <div>
                <span className="font-semibold text-slate-800">Care completed: </span>
                <span>{row.done?.value || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-800">Next-shift handover: </span>
                <span>{row.notDoneNextShift?.value || '—'}</span>
              </div>
            </div>

            {row.careRequirements && row.careRequirements.length > 0 && (
              <div className="pt-1 text-slate-700">
                <span className="font-semibold text-slate-800">Care requirements: </span>
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
            No live shift record found for Room {item.room}.
          </p>
        )}
      </div>
    );
  };

  const renderAssessmentFormOnDemand = (item: EnrichedConcern) => {
    if (!openAssessmentIds[item.id]) return null;

    const assessmentDraft = assessmentDrafts[item.id] || '';
    const assessmentError = assessmentErrors[item.id];
    const resolutionDraft = resolutionDrafts[item.id] || '';
    const resolutionError = resolutionErrors[item.id];
    const templates = getAssessmentTemplates(
      item.codes,
      item.isBmOverdue,
      item.isLowFluid
    );

    if (item.stage === 'pending' || item.isUnescalatedWatch) {
      return (
        <div className="border-t border-slate-100 bg-slate-50/75 px-5 sm:px-6 py-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-900">
              RN Assessment &amp; Triage Verification
            </span>
            <span className="text-slate-500">
              Syncs <span className="font-medium text-slate-700">Told RN</span> to Handoff Sheet
            </span>
          </div>

          {item.hasPendingVerification && (
            <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50/80 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                This resident has unverified AI-extracted handoff entries. Confirm findings directly at bedside or on the Handoff Sheet before signing off.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-slate-500">
              Structured documentation templates (complete bracketed fields before saving):
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {templates.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => handleInsertTemplate(item.id, tpl.template)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]"
                >
                  + {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={`rn-note-${item.id}`}
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Verified bedside assessment &amp; monitoring plan
            </label>
            <textarea
              ref={(el) => {
                textareaRefs.current[item.id] = el;
              }}
              id={`rn-note-${item.id}`}
              rows={3}
              value={assessmentDraft}
              onChange={(e) => {
                setAssessmentDrafts((prev) => ({ ...prev, [item.id]: e.target.value }));
                if (assessmentErrors[item.id]) {
                  setAssessmentErrors((prev) => {
                    const next = { ...prev };
                    delete next[item.id];
                    return next;
                  });
                }
              }}
              placeholder="Document verified bedside observations, vitals taken, or monitoring plan..."
              className={`w-full text-sm px-3.5 py-2.5 bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                assessmentError
                  ? 'border-rose-400 focus:ring-rose-500/25 focus:border-rose-500'
                  : 'border-slate-300 focus:ring-teal-700/25 focus:border-teal-700'
              }`}
            />
            {assessmentError && (
              <p className="mt-1.5 text-xs font-medium text-rose-700" role="alert">
                {assessmentError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Signing as <span className="font-semibold text-slate-800">{nurseName}</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAssessment(item.id)}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAcknowledge(item, true)}
                className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]"
              >
                Acknowledge &amp; Resolve
              </button>
              <button
                type="button"
                onClick={() => handleAcknowledge(item, false)}
                className="min-h-[40px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Acknowledge &amp; Monitor</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (item.stage === 'monitoring' && item.esc) {
      const esc = item.esc;
      return (
        <div className="border-t border-slate-100 bg-slate-50/75 px-5 sm:px-6 py-4 space-y-4">
          {/* Edit Existing Monitoring Plan */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">
                RN Monitoring Plan ({esc.acknowledgedBy || nurseName}
                {esc.acknowledgedAt ? ` · ${esc.acknowledgedAt}` : ''})
              </span>
              {editingNoteId !== esc.id && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNoteId(esc.id);
                    setEditingNoteDraft(esc.nurseComment || '');
                    setEditingNoteError(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit assessment</span>
                </button>
              )}
            </div>

            {editingNoteId === esc.id ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={editingNoteDraft}
                  onChange={(e) => {
                    setEditingNoteDraft(e.target.value);
                    if (editingNoteError) setEditingNoteError(null);
                  }}
                  aria-label="Edit nurse monitoring plan"
                  className="w-full text-sm px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700"
                />
                {editingNoteError && (
                  <p className="text-xs font-medium text-rose-700" role="alert">
                    {editingNoteError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNoteId(null);
                      setEditingNoteError(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveNoteEdit(esc.id)}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg cursor-pointer"
                  >
                    Save assessment
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed">
                {esc.nurseComment || 'No monitoring note recorded.'}
              </p>
            )}
          </div>

          {/* Resolve Episode */}
          <div className="pt-3 border-t border-slate-200/80 space-y-2">
            <label
              htmlFor={`resolve-note-${item.id}`}
              className="block text-xs font-semibold text-slate-700"
            >
              Verified clinical resolution outcome
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <input
                ref={(el) => {
                  resolutionInputRefs.current[item.id] = el;
                }}
                id={`resolve-note-${item.id}`}
                type="text"
                value={resolutionDraft}
                onChange={(e) => {
                  setResolutionDrafts((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }));
                  if (resolutionErrors[item.id]) {
                    setResolutionErrors((prev) => {
                      const next = { ...prev };
                      delete next[item.id];
                      return next;
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMarkResolved(item);
                }}
                placeholder="Document verified resolution findings (e.g., oral intake ≥1000 mL, heel blanching normal)..."
                className={`flex-1 min-w-0 text-sm px-3.5 py-2 bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  resolutionError
                    ? 'border-rose-400 focus:ring-rose-500/25 focus:border-rose-500'
                    : 'border-slate-300 focus:ring-emerald-700/25 focus:border-emerald-700'
                }`}
              />
              <button
                type="button"
                onClick={() => handleMarkResolved(item)}
                className="min-h-[40px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap active:scale-[0.98]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            </div>
            {resolutionError && (
              <p className="text-xs font-medium text-rose-700" role="alert">
                {resolutionError}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (item.stage === 'resolved' && item.esc) {
      const esc = item.esc;
      return (
        <div className="border-t border-slate-100 bg-slate-50/75 px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-1 text-slate-700">
            <div>
              <span className="font-semibold text-emerald-800">Clinically resolved</span> by{' '}
              <span className="font-semibold text-slate-900">
                {esc.resolvedBy || esc.acknowledgedBy || nurseName}
              </span>
              {esc.resolvedAt && (
                <span className="font-mono tabular-nums text-slate-500 ml-1">
                  · {esc.resolvedAt}
                </span>
              )}
            </div>
            {(esc.resolutionNote || esc.nurseComment) && (
              <p className="text-slate-700">
                {esc.resolutionNote || esc.nurseComment}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onReopenEscalation(esc.id)}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reopen to monitoring</span>
          </button>
        </div>
      );
    }

    return null;
  };

  const renderUrgencyAndContextLine = (item: EnrichedConcern) => {
    const isUrgent = item.effectiveTier === 3 || item.isBmOverdue;
    const urgencyColor = isUrgent
      ? 'text-rose-800'
      : item.effectiveTier === 2
      ? 'text-amber-800'
      : 'text-sky-800';
    const UrgencyIcon = isUrgent
      ? OctagonAlert
      : item.effectiveTier === 2
      ? AlertTriangle
      : Info;

    return (
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
        <span className={`inline-flex items-center gap-1.5 font-semibold ${urgencyColor}`}>
          <UrgencyIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{getUrgencyLabel(item)}</span>
        </span>

        {item.prevShiftTier && (
          <>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-slate-600 font-medium">
              Prior shift: Tier {item.prevShiftTier}
              {item.escalatedByRepeat ? ' (repeat escalated)' : ''}
            </span>
          </>
        )}

        {item.escalatedByCount && (
          <>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-amber-800 font-medium">
              3+ changes (Base Tier {item.baseTier} → Tier {item.effectiveTier})
            </span>
          </>
        )}

        <span className="text-slate-300" aria-hidden="true">·</span>

        {item.isUnescalatedWatch ? (
          <span className="font-semibold text-amber-800">Threshold watch · Unacknowledged</span>
        ) : item.stage === 'pending' ? (
          <span className="font-semibold text-rose-700">Awaiting RN review</span>
        ) : item.stage === 'monitoring' ? (
          <span className="font-medium text-teal-800">
            Monitoring
            {item.esc?.acknowledgedBy ? ` · ${item.esc.acknowledgedBy}` : ''}
            {item.esc?.acknowledgedAt ? ` · ${item.esc.acknowledgedAt}` : ''}
          </span>
        ) : (
          <span className="font-medium text-emerald-800">
            Resolved
            {item.esc?.resolvedBy ? ` · ${item.esc.resolvedBy}` : ''}
            {item.esc?.resolvedAt ? ` · ${item.esc.resolvedAt}` : ''}
          </span>
        )}
      </div>
    );
  };

  const renderLatestAssessmentLine = (item: EnrichedConcern) => {
    if (item.stage === 'pending' || item.isUnescalatedWatch) {
      return (
        <div className="flex items-start gap-2 text-xs text-slate-500 pt-0.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <span className="font-semibold text-slate-700">Latest RN assessment:</span> No bedside RN review recorded yet.
          </span>
        </div>
      );
    }

    if (item.stage === 'monitoring' && item.esc) {
      return (
        <div className="flex items-start gap-2 text-xs text-slate-700 pt-0.5">
          <UserCheck className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="leading-relaxed">
            <span className="font-semibold text-teal-900">
              Latest RN assessment ({item.esc.acknowledgedBy || nurseName}
              {item.esc.acknowledgedAt ? ` · ${item.esc.acknowledgedAt}` : ''}):
            </span>{' '}
            {item.esc.nurseComment || 'Monitoring in progress.'}
          </span>
        </div>
      );
    }

    if (item.stage === 'resolved' && item.esc) {
      return (
        <div className="flex items-start gap-2 text-xs text-slate-600 pt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="leading-relaxed">
            <span className="font-semibold text-emerald-800">
              Resolution ({item.esc.resolvedBy || item.esc.acknowledgedBy || nurseName}
              {item.esc.resolvedAt ? ` · ${item.esc.resolvedAt}` : ''}):
            </span>{' '}
            {item.esc.resolutionNote || item.esc.nurseComment || 'Concern resolved.'}
          </span>
        </div>
      );
    }

    return null;
  };

  const renderActionButtons = (item: EnrichedConcern) => {
    const isAssessmentOpen = Boolean(openAssessmentIds[item.id]);
    const isRecordOpen = Boolean(openRecordIds[item.id]);

    const primaryLabel =
      item.stage === 'pending' || item.isUnescalatedWatch
        ? isAssessmentOpen
          ? 'Close assessment'
          : 'Assess & Acknowledge'
        : item.stage === 'monitoring'
        ? isAssessmentOpen
          ? 'Close follow-up'
          : 'Update / Resolve'
        : isAssessmentOpen
        ? 'Close'
        : 'Review / Reopen';

    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={isAssessmentOpen}
          onClick={() => toggleAssessment(item.id)}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40 ${
            (item.stage === 'pending' || item.isUnescalatedWatch) && !isAssessmentOpen
              ? 'bg-teal-700 hover:bg-teal-800 text-white'
              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{primaryLabel}</span>
        </button>

        <button
          type="button"
          aria-expanded={isRecordOpen}
          onClick={() => toggleRecord(item.id)}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40 ${
            isRecordOpen
              ? 'bg-slate-200/80 text-slate-900'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0 opacity-75" aria-hidden="true" />
          <span>{isRecordOpen ? 'Hide record' : 'Resident record'}</span>
        </button>
      </div>
    );
  };

  // Full-width Priority Attention Card
  const renderPriorityCard = (item: EnrichedConcern) => {
    return (
      <article
        key={item.id}
        data-escalation-room={item.room}
        className="bg-white border border-rose-200/80 rounded-2xl overflow-hidden"
      >
        <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-stretch justify-between gap-6">
          {/* Primary Clinical Information */}
          <div className="min-w-0 flex-1 space-y-3">
            {renderUrgencyAndContextLine(item)}

            {/* Prominent Resident Identity */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {item.residentName}
              </h3>
              <span className="text-sm font-mono tabular-nums font-semibold text-slate-500">
                Room {item.room}
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                · Reported <span className="font-mono">{item.timestamp}</span> by {item.outgoingPsw}
              </span>
            </div>

            {/* Readable Clinical Findings & Observations */}
            <div className="space-y-1.5">
              <p className="text-[15px] sm:text-base font-semibold text-slate-900 leading-snug">
                {item.concernHeadline}
              </p>
              {item.qualitativeObservation &&
                item.qualitativeObservation.toLowerCase() !== item.concernHeadline.toLowerCase() && (
                  <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                    {item.qualitativeObservation}
                  </p>
                )}
            </div>

            {renderCodeCriteriaButtons(item.codes)}

            <div className="pt-2 border-t border-slate-100">
              {renderLatestAssessmentLine(item)}
            </div>
          </div>

          {/* Relevant Abnormal Measurements & Actions */}
          <div className="lg:w-80 shrink-0 flex flex-col justify-between gap-5 lg:border-l lg:border-slate-100 lg:pl-6">
            <div>
              {item.abnormalMetrics.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Abnormal measurements
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
                    {item.abnormalMetrics.map((metric) => (
                      <div key={metric.key} className="flex items-baseline justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium text-slate-600">{metric.label}</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {metric.thresholdNote}
                          </div>
                        </div>
                        <div
                          className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
                            metric.severity === 'urgent' ? 'text-rose-800' : 'text-amber-800'
                          }`}
                        >
                          {metric.value}
                          <span className="text-sm font-semibold ml-1">{metric.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Clinical trigger
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-rose-800">
                    Tier {item.effectiveTier}
                  </div>
                  <div className="text-xs text-slate-500">
                    Immediate RN evaluation indicated
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">{renderActionButtons(item)}</div>
          </div>
        </div>

        {renderResidentRecordOnDemand(item)}
        {renderAssessmentFormOnDemand(item)}
      </article>
    );
  };

  // Care Follow-Up Card (Used in Two-Column Layout)
  const renderFollowUpCard = (item: EnrichedConcern) => {
    return (
      <article
        key={item.id}
        data-escalation-room={item.room}
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
      >
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            {renderUrgencyAndContextLine(item)}

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  {item.residentName}
                </h3>
                <span className="text-xs font-mono tabular-nums font-semibold text-slate-500">
                  Room {item.room}
                </span>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                <span className="font-mono">{item.timestamp}</span> · {item.outgoingPsw}
              </span>
            </div>
          </div>

          {/* Clinical Findings & Observations */}
          <div className="space-y-1.5">
            <p className="text-[15px] font-semibold text-slate-900 leading-snug">
              {item.concernHeadline}
            </p>
            {item.qualitativeObservation &&
              item.qualitativeObservation.toLowerCase() !== item.concernHeadline.toLowerCase() && (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.qualitativeObservation}
                </p>
              )}
          </div>

          {renderCodeCriteriaButtons(item.codes)}

          {/* Abnormal Measurements (Larger Tabular Figures) */}
          {item.abnormalMetrics.length > 0 && (
            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100">
              {item.abnormalMetrics.map((metric) => (
                <div key={metric.key} className="flex items-baseline gap-2.5">
                  <span
                    className={`text-xl font-bold font-mono tabular-nums tracking-tight ${
                      metric.severity === 'urgent' ? 'text-rose-800' : 'text-amber-800'
                    }`}
                  >
                    {metric.value}
                    <span className="text-xs font-semibold ml-0.5">{metric.unit}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {metric.label} ({metric.thresholdNote})
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Latest Nurse Assessment */}
          <div className="pt-2 border-t border-slate-100">
            {renderLatestAssessmentLine(item)}
          </div>

          {/* On-Demand Action */}
          <div className="pt-1">{renderActionButtons(item)}</div>
        </div>

        {renderResidentRecordOnDemand(item)}
        {renderAssessmentFormOnDemand(item)}
      </article>
    );
  };

  // Resolved Row (Quiet, Accessible Without Competing)
  const renderResolvedItem = (item: EnrichedConcern) => {
    return (
      <div key={item.id} data-escalation-room={item.room} className="bg-white">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-base font-bold text-slate-900">{item.residentName}</span>
              <span className="text-xs font-mono tabular-nums font-semibold text-slate-500">
                Room {item.room}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="text-xs font-medium text-slate-600">{item.concernHeadline}</span>
            </div>
            {renderLatestAssessmentLine(item)}
          </div>

          <div className="shrink-0">{renderActionButtons(item)}</div>
        </div>

        {renderResidentRecordOnDemand(item)}
        {renderAssessmentFormOnDemand(item)}
      </div>
    );
  };

  const overviewFilters: {
    id: TriageFilter;
    label: string;
    count: number;
    toneClass: string;
  }[] = [
    {
      id: 'all',
      label: 'All active',
      count: totalActiveCount,
      toneClass: 'text-slate-900',
    },
    {
      id: 'pending',
      label: 'Needs review',
      count: pendingItemsAll.length,
      toneClass: pendingItemsAll.length > 0 ? 'text-rose-700' : 'text-slate-900',
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      count: monitoringItemsAll.length,
      toneClass: 'text-teal-800',
    },
    {
      id: 'resolved',
      label: 'Resolved',
      count: resolvedItems.length,
      toneClass: 'text-emerald-700',
    },
  ];

  const showPendingColumn = filter === 'all' || filter === 'pending';
  const showMonitoringColumn = filter === 'all' || filter === 'monitoring';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
      className="space-y-6"
    >
      {/* AREA 1: Compact Overview with Needs review, Monitoring, and Resolved counts + functional filters */}
      <section
        aria-label="Clinical overview summary"
        className="bg-white border border-slate-200 rounded-2xl px-5 py-4 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Charge Nurse Clinical Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {unit}
              {shift ? ` · ${shift}` : ''}
            </p>
          </div>

          {/* Duty RN Identity (Read-First, Edit-on-Demand) */}
          <div className="flex items-center gap-2 text-xs self-start sm:self-auto">
            {isEditingNurseName ? (
              <div className="flex items-center gap-1.5">
                <label htmlFor="duty-rn-input" className="sr-only">
                  Duty nurse name and credentials
                </label>
                <input
                  id="duty-rn-input"
                  type="text"
                  value={nurseNameDraft}
                  onChange={(e) => setNurseNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveNurseIdentity();
                    if (e.key === 'Escape') {
                      setNurseNameDraft(nurseName);
                      setIsEditingNurseName(false);
                    }
                  }}
                  autoFocus
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/30 w-36"
                />
                <button
                  type="button"
                  onClick={saveNurseIdentity}
                  className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-600">
                <span>
                  <span className="text-slate-400">Signing as </span>
                  <span className="font-semibold text-slate-900">{nurseName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNurseNameDraft(nurseName);
                    setIsEditingNurseName(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  aria-label="Edit signing nurse name"
                  title="Change signing nurse"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Functional Overview Count Filters */}
        <div
          role="tablist"
          aria-label="Filter clinical overview"
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100"
        >
          {overviewFilters.map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-baseline justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40 active:scale-[0.99] ${
                  isActive
                    ? 'bg-teal-50/70 border-teal-700/40 text-slate-900'
                    : 'bg-slate-50/60 border-slate-200/80 text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
              >
                <span className="text-xs font-semibold whitespace-nowrap">{tab.label}</span>
                <span
                  className={`text-lg font-bold font-mono tabular-nums ${
                    isActive ? tab.toneClass : 'text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* AREA 2: Full-Width Priority Attention (Highest-priority active concerns, independent of acknowledgment & filters) */}
      <section aria-label="Priority attention" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <OctagonAlert
              className={`w-4 h-4 shrink-0 ${
                priorityAttentionItems.length > 0 ? 'text-rose-700' : 'text-emerald-600'
              }`}
              aria-hidden="true"
            />
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Priority Attention
              <span className="font-mono tabular-nums text-slate-500 font-semibold ml-2">
                {priorityAttentionItems.length}
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            {filter !== 'all' && priorityAttentionItems.length > 0
              ? 'Always visible — active urgent concerns are never concealed by filters or acknowledgment status'
              : 'Highest-priority active concerns, independent of RN acknowledgment'}
          </p>
        </div>

        {priorityAttentionItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-2.5 text-sm text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>No Tier 3 or overdue bowel concerns currently require priority attention.</span>
          </div>
        ) : (
          <div className="space-y-3.5">{priorityAttentionItems.map(renderPriorityCard)}</div>
        )}
      </section>

      {/* AREA 3: Two-Column Care Follow-up (Other pending reviews & Ongoing monitoring) */}
      {filter !== 'resolved' && (
        <section aria-label="Care follow-up" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Care Follow-up</h2>
            <p className="text-xs text-slate-500">
              {filter === 'all'
                ? 'Other pending reviews and ongoing shift monitoring'
                : filter === 'pending'
                ? 'Filtered to other pending reviews'
                : 'Filtered to ongoing monitoring'}
            </p>
          </div>

          <div
            className={`grid grid-cols-1 gap-5 items-start ${
              showPendingColumn && showMonitoringColumn ? 'lg:grid-cols-2' : ''
            }`}
          >
            {/* Column 1: Other Pending Reviews */}
            {showPendingColumn && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                    <h3 className="text-[13px] font-bold text-slate-800">
                      Other pending reviews
                      <span className="font-mono tabular-nums text-slate-500 font-semibold ml-1.5">
                        {otherPendingItems.length}
                      </span>
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Awaiting RN triage</span>
                </div>

                {otherPendingItems.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl px-5 py-6 text-sm text-slate-500 space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                      <span>No other pending reviews.</span>
                    </div>
                    {pendingItemsAll.length > 0 && (
                      <p className="text-xs text-slate-500 pl-6">
                        Urgent pending reviews are surfaced in Priority Attention above.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3.5">{otherPendingItems.map(renderFollowUpCard)}</div>
                )}
              </div>
            )}

            {/* Column 2: Ongoing Monitoring */}
            {showMonitoringColumn && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                    <h3 className="text-[13px] font-bold text-slate-800">
                      Ongoing monitoring
                      <span className="font-mono tabular-nums text-slate-500 font-semibold ml-1.5">
                        {otherMonitoringItems.length}
                      </span>
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">Active this shift</span>
                </div>

                {otherMonitoringItems.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl px-5 py-6 text-sm text-slate-500 space-y-1.5">
                    {monitoringItemsAll.length > 0 ? (
                      <>
                        <p className="font-medium text-slate-700">
                          {monitoringItemsAll.length} active monitoring{' '}
                          {monitoringItemsAll.length === 1 ? 'case is' : 'cases are'} elevated in Priority Attention above.
                        </p>
                        <p className="text-xs text-slate-500">
                          Tier 1 or Tier 2 cases acknowledged for monitoring will appear here.
                        </p>
                      </>
                    ) : (
                      <p>No additional residents currently in ongoing monitoring.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3.5">{otherMonitoringItems.map(renderFollowUpCard)}</div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Accessible Resolved Cases (Does Not Compete with Active Concerns) */}
      <section
        aria-label="Resolved this shift"
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100"
      >
        {filter !== 'resolved' ? (
          <button
            type="button"
            aria-expanded={showResolvedDrawer}
            onClick={() => setShowResolvedDrawer((prev) => !prev)}
            className="w-full px-5 py-3.5 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span>
                Resolved this shift
                <span className="font-mono tabular-nums text-slate-500 font-medium ml-1.5">
                  {resolvedItems.length}
                </span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span>{showResolvedDrawer ? 'Hide' : 'Show resolved'}</span>
              {showResolvedDrawer ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </span>
          </button>
        ) : (
          <div className="px-5 py-3.5 bg-slate-50/70 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <h2 className="font-bold text-slate-900">
                Resolved this shift
                <span className="font-mono tabular-nums text-slate-500 font-semibold ml-1.5">
                  {resolvedItems.length}
                </span>
              </h2>
            </div>
            <span className="text-slate-400">Closed clinical episodes</span>
          </div>
        )}

        {(filter === 'resolved' || showResolvedDrawer) &&
          (resolvedItems.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-500">
              No escalations marked resolved yet this shift.
            </div>
          ) : (
            resolvedItems.map(renderResolvedItem)
          ))}
      </section>

      {/* Quiet Clinical Safeguard Note */}
      <p className="text-[11px] text-slate-400 px-1">
        Decision support only — the Charge Nurse retains all clinical assessment, verification, and triage decisions.
      </p>

      {/* Stop & Watch Clinical Reference Modal */}
      {detailCodeConfig && detailTierMeta && (
        <StopAndWatchDetailModal
          config={detailCodeConfig}
          tierMeta={detailTierMeta}
          onClose={() => setDetailCodeId(null)}
        />
      )}
    </motion.div>
  );
};
