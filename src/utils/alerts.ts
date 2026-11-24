import { HandoffRow, AlertThresholds, DeterministicAlert } from '../types/handoff';

/**
 * Deterministic Clinical Rules Engine for LTC Shift Handoff.
 * Note: These are strict rule-based triggers, NOT AI guesses.
 * The nurse makes all clinical assessments and decisions.
 */
export function evaluateDeterministicAlerts(
  rows: HandoffRow[],
  thresholds: AlertThresholds
): DeterministicAlert[] {
  const alerts: DeterministicAlert[] = [];

  rows.forEach((row) => {
    const doneVal = (row.done?.value || '').trim();
    const hasPerCarePlan = doneVal.toLowerCase().includes('per care plan');
    const hasDoneCare = doneVal.length > 0 && doneVal !== '—';

    // Rule 1: Missing Care Entry
    if (!hasDoneCare && !hasPerCarePlan) {
      alerts.push({
        id: `alert-missing-done-${row.room}`,
        room: row.room,
        residentName: row.residentName,
        severity: 'info_missing',
        type: 'missing_care',
        title: 'Missing Care Documentation',
        message: `Nothing recorded for ${row.residentName} (Room ${row.room}). Was this a normal shift (Per care plan) or are there changes?`,
        actionRequired: 'Confirm "Per care plan" or specify care completed.',
      });
    }

    // Rule 2: Missing Required MLTC Fields (Qualitative observation is mandatory by regulation)
    const qualitative = (row.mltcDetails.qualitativeObservations?.value || '').trim();
    if (!qualitative || qualitative.length < 5) {
      alerts.push({
        id: `alert-missing-qual-${row.room}`,
        room: row.room,
        residentName: row.residentName,
        severity: 'info_missing',
        type: 'missing_required',
        title: 'MLTC Required: Qualitative Observation',
        message: `No qualitative observation recorded for ${row.residentName}. Ministry of Long-Term Care requires engagement/mood documentation.`,
        actionRequired: 'Add a brief note on mood, energy, or participation.',
      });
    }

    // Rule 3: Fluid Intake Below Minimum Threshold
    const fluid = row.mltcDetails.fluidIntakeMl?.value;
    if (fluid !== null && fluid !== undefined && fluid < thresholds.fluidIntakeMinMl) {
      alerts.push({
        id: `alert-fluid-${row.room}`,
        room: row.room,
        residentName: row.residentName,
        severity: 'warning',
        type: 'fluid_low',
        title: 'Low Fluid Intake Alert',
        message: `${row.residentName} recorded ${fluid} mL intake, which is below the target minimum (${thresholds.fluidIntakeMinMl} mL).`,
        actionRequired: 'Flag for next shift to encourage fluids and offer preferred beverages.',
      });
    }

    // Rule 4: Bowel Movement Overdue (>= 48 hours / approaching INTERACT Code N)
    const hoursSinceBM = row.mltcDetails.hoursSinceLastBM?.value;
    const bmText = (row.mltcDetails.bowelMovement?.value || '').toLowerCase();
    const isOverdueBM =
      (hoursSinceBM !== null && hoursSinceBM !== undefined && hoursSinceBM >= thresholds.bowelMovementHoursThreshold) ||
      bmText.includes('48h') ||
      bmText.includes('3 days') ||
      bmText.includes('none in 3 days');

    if (isOverdueBM) {
      alerts.push({
        id: `alert-bm-${row.room}`,
        room: row.room,
        residentName: row.residentName,
        severity: 'critical_nurse',
        type: 'bm_overdue',
        title: 'Bowel Movement Protocol Alert (>=48h)',
        message: `No bowel movement logged for ${row.residentName} in over ${hoursSinceBM || 48} hours. Approaching INTERACT Code N standard.`,
        actionRequired: 'Escalate to Charge Nurse for PRN bowel protocol assessment.',
      });
    }

    // Rule 5: INTERACT Stop and Watch Codes present
    const codes = row.changeCodes?.value || [];
    if (codes.length > 0) {
      const isNurseNotified = row.toldNurse?.value === true;
      if (!isNurseNotified) {
        alerts.push({
          id: `alert-nurse-s-and-w-${row.room}`,
          room: row.room,
          residentName: row.residentName,
          severity: 'critical_nurse',
          type: 'nurse_escalation',
          title: 'Stop & Watch Early Warning: Nurse Notification Required',
          message: `Change codes [${codes.join(', ')}] recorded for ${row.residentName} without confirmed Charge Nurse notification.`,
          actionRequired: 'Notify Charge Nurse and log nurse initials, or provide explicit override.',
        });
      }
    }
  });

  return alerts;
}

/**
 * Checks whether the handoff sheet has unnotified critical escalations
 */
export function hasUnnotifiedCriticalAlerts(rows: HandoffRow[]): boolean {
  return rows.some((row) => {
    const hasCodes = (row.changeCodes?.value || []).length > 0;
    const hasSkinOrNeuro = (row.changeCodes?.value || []).some((c) => ['C', 'H', 'T_tired', 'A_agitated'].includes(c));
    const toldNurse = row.toldNurse?.value === true;
    return (hasCodes || hasSkinOrNeuro) && !toldNurse;
  });
}
