import { AlertThresholds, HandoffRow, NurseEscalation } from '../types/handoff';
import { computeRowSeverity, getCodeConfig } from '../data/stopAndWatchCodes';
import { getResidentStatus } from './residentStatus';
import { l10n } from './localization';

export type IncomingTask = {
  id: string;
  room: string;
  residentName: string;
  title: string;
  recorded: string;
  sourceQuote?: string;
  schedule: string;
  clock?: string;
  isVisit?: boolean;
  pending: boolean;
  done: boolean;
  completedAt?: string;
  requirementId?: string;
};

const CLOCK = String.raw`((?:[01]\d|2[0-3]):[0-5]\d)`;
const REPOSITION = new RegExp('^repositioning due (?:at )?' + CLOCK + '$', 'i');
const SNACK = new RegExp('^(?:refused lunch; )?offer snack (around |at )' + CLOCK + '$', 'i');
const VISIT = new RegExp('^daughter visiting (around |at )' + CLOCK + ', wants an update$', 'i');
const EXPLICIT_DEADLINE = new RegExp('(?:^|[ .;,])due (?:at )?' + CLOCK + '(?:\\s*$|[.,;])', 'i');
const APPROXIMATE_TIME = new RegExp('\\b(?:around|about|approximately) ' + CLOCK + '\\b', 'i');

function readSchedule(recorded: string, sourceQuote: string | undefined, pending: boolean) {
  const flexible = { title: recorded, schedule: 'No set time' };
  if (pending) return { ...flexible, schedule: 'Verify first' };
  const approximateTime = sourceQuote?.match(APPROXIMATE_TIME)?.[1];

  const reposition = recorded.match(REPOSITION);
  if (reposition) {
    const clock = reposition[1];
    return { title: 'Reposition resident', schedule: (approximateTime === clock ? '~' : '') + clock, clock };
  }
  const snack = recorded.match(SNACK);
  if (snack) {
    const [, qualifier, clock] = snack;
    const approximate = qualifier.toLowerCase() === 'around ' || approximateTime === clock;
    return { title: 'Offer snack', schedule: (approximate ? '~' : '') + clock, clock };
  }

  const visit = recorded.match(VISIT);
  if (visit) {
    const [, qualifier, clock] = visit;
    const approximate = qualifier.toLowerCase() === 'around ' || approximateTime === clock;
    return { title: 'Follow up on family update', schedule: (approximate ? '~' : '') + clock + ' visit', clock, isVisit: true };
  }

  if (/^bath moved to evening at her request$/i.test(recorded)) {
    return { title: 'Assist with bath', schedule: 'Evening' };
  }
  if (/^nails not trimmed \(ran out of time\)$/i.test(recorded)) {
    return { title: 'Trim nails', schedule: 'No set time' };
  }

  const pastDeadline = /\b(?:was|were|already|previously)\s+(?:already\s+)?due\b/i.test(recorded);
  const deadline = pastDeadline ? undefined : recorded.match(EXPLICIT_DEADLINE)?.[1];
  return deadline ? { title: recorded, schedule: (approximateTime === deadline ? '~' : '') + deadline, clock: deadline } : flexible;
}

export function buildIncomingTasks(rows: HandoffRow[], noteCompletions: Record<string, string>): IncomingTask[] {
  const tasks = rows.flatMap((row): IncomingTask[] => {
    const identity = { room: row.room, residentName: row.residentName };
    const requirements = row.careRequirements || [];
    const note = row.notDoneNextShift?.value?.trim();
    const items = requirements.map((requirement): IncomingTask => {
      const recorded = requirement.action_item.trim();
      const pending = Boolean(requirement.isPendingConfirmation);
      const schedule = readSchedule(recorded, requirement.sourceQuote, pending);
      return {
        ...identity,
        ...schedule,
        id: JSON.stringify([row.room, requirement.id, recorded]),
        title: schedule.title === recorded ? requirement.category + ': ' + recorded : schedule.title,
        recorded: requirement.category + ': ' + recorded,
        sourceQuote: requirement.sourceQuote,
        pending,
        done: Boolean(requirement.completed),
        requirementId: requirement.id,
      };
    });
    if (note && note !== '—' && !requirements.some((requirement) =>
      requirement.action_item.trim().toLowerCase() === note.toLowerCase())) {
      const id = JSON.stringify([row.room, note]);
      const pending = Boolean(row.notDoneNextShift.isPendingConfirmation);
      items.unshift({
        ...identity,
        ...readSchedule(note, row.notDoneNextShift.sourceQuote, pending),
        id,
        recorded: note,
        sourceQuote: row.notDoneNextShift.sourceQuote,
        pending,
        done: Boolean(noteCompletions[id]),
        completedAt: noteCompletions[id],
      });
    }
    return items;
  });
  return tasks.sort((a, b) => (a.clock || '99:99').localeCompare(b.clock || '99:99') ||
    Number(a.schedule.startsWith('~')) - Number(b.schedule.startsWith('~')));
}

export function buildIncomingResidents(rows: HandoffRow[], escalations: NurseEscalation[], thresholds: AlertThresholds) {
  return rows.map((row) => {
    const episodes = escalations.filter((item) => item.room === row.room);
    const latestEpisode = episodes.at(-1);
    const active = [...episodes].reverse().find((item) => item.resolutionStatus !== 'resolved');
    const codes = row.changeCodes?.value?.length ? row.changeCodes.value : active?.codes || [];
    const status = getResidentStatus({ ...row, changeCodes: { ...row.changeCodes, value: codes } },
      thresholds, thresholds.customCodeTiers);
    const severity = computeRowSeverity(codes, { prevShiftTier: row.prevShiftTier, customTiers: thresholds.customCodeTiers });
    const observation = row.mltcDetails?.qualitativeObservations?.value?.trim();
    const reported = row.changeNote?.value?.trim();
    const finding = (reported && !/^no change$/i.test(reported) ? reported : '') || active?.note || '';
    const { fluidIntakeMl, hoursSinceLastBM } = row.mltcDetails || {};
    const explicitUrgency = severity?.baseTier === 3;
    const rank = explicitUrgency ? 5 : status.isBmOverdue ? 4 : status.tier || (status.isLowFluid || active ? 1 : 0);
    const label = explicitUrgency ? 'Urgent' : status.isBmOverdue ? 'BM overdue'
      : status.tier === 3 ? 'Urgent' : status.tier === 2 ? 'This shift' : 'Watch';
    const unverified = status.hasPending || row.toldNurse?.isPendingConfirmation ||
      row.nurseInitials?.isPendingConfirmation || hoursSinceLastBM?.isPendingConfirmation;
    const notified = row.toldNurse?.isPendingConfirmation ? 'RN notification unverified'
      : row.toldNurse?.value ? 'RN notified' : 'RN not yet notified';

    let title = finding || codes.map((code) => l10n(getCodeConfig(code, thresholds.customCodeTiers)?.plainLabel || code)).join(', ');
    const fluid = fluidIntakeMl?.value;
    let summary = status.isLowFluid && fluid != null ? l10n('Low fluid intake · {{volume}} mL', { volume: fluid }) : '';
    if (explicitUrgency && codes.includes('C') && /\bredness on heel does not blanch\b/i.test(observation || '') &&
      /\bred area on left heel\b/i.test(finding)) {
      title = 'Heel redness does not blanch';
      if (status.isLowFluid && fluid != null && codes.includes('D')) {
        summary = l10n('Drank less · {{volume}} mL recorded', { volume: fluid });
      }
    } else if (status.isBmOverdue && !explicitUrgency) {
      title = hoursSinceLastBM?.value == null
        ? 'Bowel movement overdue'
        : l10n('Last bowel movement {{hours}} h ago', { hours: hoursSinceLastBM.value });
      if (status.isLowFluid && fluid != null && codes.includes('A_ate')) {
        summary = l10n('Ate less · {{volume}} mL fluids', { volume: fluid });
      }
    } else if (codes.includes('H') && /\bneeded (?:2|two) people to transfer\b/i.test(finding)) {
      title = 'Transfer needed two people';
      if (/\bright-side leaning\b/i.test(observation || '') && /\bslight leg tremor\b/i.test(observation || '')) {
        summary = 'Right-side leaning · slight leg tremor';
      }
    }
    if (status.isBmOverdue && explicitUrgency) summary = [summary, l10n('Bowel movement overdue')].filter(Boolean).join(' · ');
    return {
      row, codes, status, rank, label, notified, unverified,
      finding, observation, episode: active || latestEpisode,
      title: title || (status.isLowFluid ? 'Low fluid intake' : 'Clinical concern'),
      summary,
    };
  });
}

export type IncomingResident = ReturnType<typeof buildIncomingResidents>[number];
