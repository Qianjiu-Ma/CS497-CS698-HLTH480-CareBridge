import { l10n } from './localization';
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
        title: l10n('Missing Care Documentation'),
        message: l10n("Nothing recorded for {{p1}} (Room {{p2}}). Was this a normal shift (Per care plan) or are there changes?", { p1: row.residentName, p2: row.room }),
        actionRequired: l10n('Confirm "Per care plan" or specify care completed.'),
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
        title: l10n('MLTC Required: Qualitative Observation'),
        message: l10n("No qualitative observation recorded for {{p1}}. Ministry of Long-Term Care requires engagement/mood documentation.", { p1: row.residentName }),
        actionRequired: l10n('Add a brief note on mood, energy, or participation.'),
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
        title: l10n('Low Fluid Intake Alert'),
        message: l10n("{{p1}} recorded {{p2}} mL intake, which is below the target minimum ({{p3}} mL).", { p1: row.residentName, p2: fluid, p3: thresholds.fluidIntakeMinMl }),
        actionRequired: l10n('Flag for next shift to encourage fluids and offer preferred beverages.'),
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
        title: l10n('Bowel Movement Protocol Alert (>=48h)'),
        message: l10n("No bowel movement logged for {{p1}} in over {{p2}} hours. Approaching INTERACT Code N standard.", { p1: row.residentName, p2: hoursSinceBM || 48 }),
        actionRequired: l10n('Escalate to Charge Nurse for PRN bowel protocol assessment.'),
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
          title: l10n('Stop & Watch Early Warning: Nurse Notification Required'),
          message: l10n("Change codes [{{p1}}] recorded for {{p2}} without confirmed Charge Nurse notification.", { p1: codes.join(', '), p2: row.residentName }),
          actionRequired: l10n('Notify Charge Nurse and log nurse initials, or provide explicit override.'),
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
