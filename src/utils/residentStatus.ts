import { AlertThresholds, HandoffRow } from '../types/handoff';
import { computeRowSeverity, SeverityTier } from '../data/stopAndWatchCodes';

export type ClinicalConcernLevel = 'urgent' | 'elevated' | 'watch' | 'routine';
export type NurseNotificationState = 'notify_now' | 'notify_shift' | 'notified' | 'none';

export interface UnifiedResidentStatus {
  // Primary clinical concern (orthogonal to nurse notification)
  clinicalLevel: ClinicalConcernLevel;
  clinicalSummary: string;
  clinicalShortSummary: string;
  clinicalItems: string[];

  // Nurse notification state
  nurseState: NurseNotificationState;
  nurseLabel: string;
  nurseShortLabel: string;
  nurseInitialsDisplay: string;

  // Pending AI review state
  hasPending: boolean;
  pendingCount: number;

  // Supporting deterministic flags
  tier: SeverityTier | null;
  needsNurseAction: boolean;
  isUrgent: boolean;
  isBmOverdue: boolean;
  isLowFluid: boolean;
  codesCount: number;
}

export function formatToldNurseLabel(rawInitials?: string): string {
  const trimmed = (rawInitials || '').trim();
  if (!trimmed) return 'Told RN';

  const rnParenMatch = trimmed.match(/^RN\s*\(([^)]+)\)$/i);
  if (rnParenMatch && rnParenMatch[1].trim()) {
    return `Told RN (${rnParenMatch[1].trim()})`;
  }

  if (/^RN$/i.test(trimmed)) {
    return 'Told RN';
  }

  if (/^RN\b/i.test(trimmed) || trimmed.toLowerCase().includes('rn')) {
    return `Told ${trimmed}`;
  }

  return `Told RN (${trimmed})`;
}

export function getResidentStatus(
  row: HandoffRow,
  thresholds?: AlertThresholds,
  customCodeTiers?: Record<string, SeverityTier>
): UnifiedResidentStatus {
  const codes = row.changeCodes?.value || [];
  const codesCount = codes.length;
  const severityEval = computeRowSeverity(codes, {
    prevShiftTier: row.prevShiftTier,
    customTiers: customCodeTiers,
  });

  const toldNurse = Boolean(row.toldNurse?.value);
  const rawInitials = (row.nurseInitials?.value || '').trim();
  const nurseInitialsDisplay = rawInitials || 'RN';

  const bmHoursMax = thresholds?.bowelMovementHoursThreshold ?? 48;
  const hoursSinceBM = row.mltcDetails?.hoursSinceLastBM?.value;
  const bmText = (row.mltcDetails?.bowelMovement?.value || '').toLowerCase();
  const isBmOverdue =
    (hoursSinceBM !== null && hoursSinceBM !== undefined && hoursSinceBM >= bmHoursMax) ||
    bmText.includes('48h') ||
    bmText.includes('3 days') ||
    bmText.includes('none in 3 days');

  const fluidMin = thresholds?.fluidIntakeMinMl ?? 1000;
  const fluid = row.mltcDetails?.fluidIntakeMl?.value;
  const isLowFluid = fluid !== null && fluid !== undefined && fluid < fluidMin;

  let pendingCount = 0;
  if (row.done?.isPendingConfirmation) pendingCount++;
  if (row.notDoneNextShift?.isPendingConfirmation) pendingCount++;
  if (row.changeNote?.isPendingConfirmation) pendingCount++;
  if (row.changeCodes?.isPendingConfirmation) pendingCount++;
  if (row.mltcDetails?.fluidIntakeMl?.isPendingConfirmation) pendingCount++;
  if (row.mltcDetails?.weightKg?.isPendingConfirmation) pendingCount++;
  if (row.mltcDetails?.bowelMovement?.isPendingConfirmation) pendingCount++;
  if (row.mltcDetails?.qualitativeObservations?.isPendingConfirmation) pendingCount++;
  pendingCount += (row.careRequirements || []).filter((req) => req.isPendingConfirmation).length;
  const hasPending = pendingCount > 0;

  const tier = severityEval?.tier ?? null;

  // 1. Build independent clinical concern profile
  const clinicalItems: string[] = [];
  const shortClinicalItems: string[] = [];

  if (isBmOverdue) {
    const bmPart =
      hoursSinceBM !== null && hoursSinceBM !== undefined
        ? `BM ${hoursSinceBM}h`
        : `BM >${bmHoursMax}h`;
    clinicalItems.push(bmPart);
    shortClinicalItems.push(bmPart);
  }

  if (codesCount > 0) {
    const codePart = `${codesCount} ${codesCount === 1 ? 'change' : 'changes'}`;
    clinicalItems.push(codePart);
    shortClinicalItems.push(codePart);
  }

  if (isLowFluid) {
    clinicalItems.push(`${fluid} mL fluid`);
    shortClinicalItems.push('Low fluid');
  }

  let clinicalLevel: ClinicalConcernLevel = 'routine';
  if (tier === 3 || isBmOverdue) {
    clinicalLevel = 'urgent';
  } else if (tier === 2) {
    clinicalLevel = 'elevated';
  } else if (tier === 1 || isLowFluid) {
    clinicalLevel = 'watch';
  }

  const clinicalSummary = clinicalItems.length > 0 ? clinicalItems.join(' · ') : 'Routine';
  const clinicalShortSummary =
    shortClinicalItems.length > 0 ? shortClinicalItems.join(' · ') : 'Routine';

  // 2. Build independent nurse notification profile
  const isUrgent = tier === 3 || isBmOverdue;
  const needsNurseAction = !toldNurse && (isUrgent || tier === 2);

  let nurseState: NurseNotificationState = 'none';
  let nurseLabel = '';
  let nurseShortLabel = '';

  if (toldNurse) {
    const formatted = formatToldNurseLabel(rawInitials);
    nurseState = 'notified';
    nurseLabel = formatted;
    nurseShortLabel = formatted;
  } else if (isUrgent) {
    nurseState = 'notify_now';
    nurseLabel = 'Notify RN now';
    nurseShortLabel = 'Notify RN now';
  } else if (tier === 2) {
    nurseState = 'notify_shift';
    nurseLabel = 'Notify RN';
    nurseShortLabel = 'Notify RN';
  }

  return {
    clinicalLevel,
    clinicalSummary,
    clinicalShortSummary,
    clinicalItems,
    nurseState,
    nurseLabel,
    nurseShortLabel,
    nurseInitialsDisplay,
    hasPending,
    pendingCount,
    tier,
    needsNurseAction,
    isUrgent,
    isBmOverdue,
    isLowFluid,
    codesCount,
  };
}
