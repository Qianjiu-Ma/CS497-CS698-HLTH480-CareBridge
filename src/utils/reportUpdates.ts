import type { HandoffRow } from '../types/handoff';

function sameValue(left: unknown, right: unknown) {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

function applyField<T>(atRequest: T, current: T, extracted: T): T {
  return sameValue(atRequest, current) && !sameValue(atRequest, extracted) ? extracted : current;
}

// Apply a report to the residents it was parsed for, preserving newer edits to each field.
export function mergeReportUpdates(current: HandoffRow[], atRequest: HandoffRow[], extracted: HandoffRow[]): HandoffRow[] {
  return current.map((row) => {
    const original = atRequest.find(({ room, residentName }) => room === row.room && residentName === row.residentName);
    const parsed = extracted.find(({ room, residentName }) => room === row.room && residentName === row.residentName);
    if (!original || !parsed) return row;

    const before = original.mltcDetails;
    const live = row.mltcDetails;
    const result = parsed.mltcDetails;
    const notificationUnchanged = sameValue(original.toldNurse, row.toldNurse) &&
      sameValue(original.nurseInitials, row.nurseInitials);

    return {
      ...row,
      done: applyField(original.done, row.done, parsed.done),
      notDoneNextShift: applyField(original.notDoneNextShift, row.notDoneNextShift, parsed.notDoneNextShift),
      changeCodes: applyField(original.changeCodes, row.changeCodes, parsed.changeCodes),
      changeNote: applyField(original.changeNote, row.changeNote, parsed.changeNote),
      toldNurse: notificationUnchanged ? applyField(original.toldNurse, row.toldNurse, parsed.toldNurse) : row.toldNurse,
      nurseInitials: notificationUnchanged ? applyField(original.nurseInitials, row.nurseInitials, parsed.nurseInitials) : row.nurseInitials,
      careRequirements: applyField(original.careRequirements, row.careRequirements, parsed.careRequirements),
      mltcDetails: {
        ...live,
        weightKg: applyField(before.weightKg, live.weightKg, result.weightKg),
        fluidIntakeMl: applyField(before.fluidIntakeMl, live.fluidIntakeMl, result.fluidIntakeMl),
        bowelMovement: applyField(before.bowelMovement, live.bowelMovement, result.bowelMovement),
        hoursSinceLastBM: applyField(before.hoursSinceLastBM, live.hoursSinceLastBM, result.hoursSinceLastBM),
        qualitativeObservations: applyField(before.qualitativeObservations, live.qualitativeObservations, result.qualitativeObservations),
        lastRepositionTime: applyField(before.lastRepositionTime, live.lastRepositionTime, result.lastRepositionTime),
      },
    };
  });
}
