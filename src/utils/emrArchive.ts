import { formatUiDate, l10n } from './localization';
import { EMRRecord, HandoffRow, NurseEscalation } from '../types/handoff';
import { getCodeConfig, getTranslatedStopAndWatchLabel } from '../data/stopAndWatchCodes';
import type { InterfaceLanguage } from './localization';

export function archivedCodeLabels(codes: string[], language: InterfaceLanguage = 'en'): string[] {
  return codes.map((code) => {
    const config = getCodeConfig(code);
    return getTranslatedStopAndWatchLabel(code, language, config?.plainLabel || config?.shortLabel || code);
  });
}

export function hasArchivedChange(record: EMRRecord, row: HandoffRow): boolean {
  const note = row.changeNote?.value?.trim();
  return Boolean(row.changeCodes?.value?.length || (note && !/^(?:no change(?: recorded)?|—)$/i.test(note)) ||
    record.escalations?.some((escalation) => escalation.room === row.room));
}

export function archivedShiftParts(record: EMRRecord) {
  const [shift, hours] = record.header.shift.split(' (');
  const date = new Date(record.header.date + 'T00:00:00Z');
  const day = Number.isNaN(date.valueOf()) ? record.header.date : formatUiDate(date, {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  const archiveDate = new Date(record.submittedAt);
  const archivedAt = Number.isNaN(archiveDate.valueOf()) ? record.submittedAt : formatUiDate(archiveDate, {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  return {
    shift,
    title: l10n('{{date}} · {{shift}}', { date: day, shift: l10n(shift + ' shift') }),
    hours: hours?.replace(/\)$/, '').replace(/\s+-\s+/g, '–'),
    archivedAt,
  };
}

export function archivedEscalationLines(item: NurseEscalation): string[] {
  const lines = [
    item.note,
    [item.outgoingPsw, item.timestamp].filter(Boolean).join(' · '),
    'Recorded status: ' + (item.resolutionStatus || item.status),
    [...archivedCodeLabels(item.codes || [])].join(' · '),
  ];
  if (item.acknowledgedBy || item.acknowledgedAt || item.nurseComment) {
    lines.push('Nurse assessment: ' + [item.acknowledgedBy, item.acknowledgedAt, item.nurseComment].filter(Boolean).join(' · '));
  }
  if (item.resolvedBy || item.resolvedAt || item.resolutionNote) {
    lines.push('Recorded resolution: ' + [item.resolvedBy, item.resolvedAt, item.resolutionNote].filter(Boolean).join(' · '));
  }
  return lines.filter(Boolean);
}

export function archivedMeasurements(row: HandoffRow) {
  const detail = row.mltcDetails;
  return [
    { label: 'Fluid intake', cell: detail?.fluidIntakeMl, unit: 'mL' },
    { label: 'Weight', cell: detail?.weightKg, unit: 'kg' },
    { label: 'Bowel movement', cell: detail?.bowelMovement },
    { label: 'Hours since last bowel movement', cell: detail?.hoursSinceLastBM, unit: 'h' },
    { label: 'Last repositioned', cell: detail?.lastRepositionTime },
  ];
}

export function archivedValue(value: string | number | null | undefined, unit?: string) {
  return value === null || value === undefined || value === '' ? 'Not recorded' : String(value) + (unit ? ' ' + unit : '');
}

export function archivedNurseNotification(row: HandoffRow): string {
  if (row.toldNurse?.isPendingConfirmation || row.nurseInitials?.isPendingConfirmation) return 'Notification unverified in archive';
  if (row.toldNurse?.value === true) return row.nurseInitials?.value || 'RN notified';
  return row.toldNurse?.value === false ? 'RN not notified at submission' : 'Not recorded';
}

export function archivedResidentSources(row: HandoffRow): [string, string][] {
  const fields = [
    { label: 'Completed care', cell: row.done },
    { label: 'Next shift', cell: row.notDoneNextShift },
    { label: 'Stop & Watch codes', cell: row.changeCodes },
    { label: 'Stop & Watch note', cell: row.changeNote },
    { label: 'Observations', cell: row.mltcDetails?.qualitativeObservations },
    { label: 'Nurse notification', cell: row.toldNurse },
    { label: 'Nurse initials', cell: row.nurseInitials },
    ...archivedMeasurements(row),
  ];
  return fields.flatMap(({ label, cell }) => {
    const details = [
      cell?.sourceQuote,
      cell?.lastEditedBy ? 'Recorded by ' + cell.lastEditedBy : '',
      cell?.isPendingConfirmation ? 'Unverified at submission' : '',
      cell?.needsTranslationCheck ? 'Translation review flagged' : '',
    ].filter(Boolean);
    return details.length ? [[label, details.join('\n')]] : [];
  });
}

function normalized(text: unknown): string {
  return String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function archivedSearchTerms(query: string): string[] {
  return normalized(query).split(' ').filter(Boolean);
}

export function archiveEntries(record: EMRRecord, terms: string[], translate: (text: string) => string) {
  if (!terms.length) return { rows: record.rows, sharedMatch: true };
  const { title } = archivedShiftParts(record);
  const metadata = normalized([
    title, record.header.date, record.header.shift, record.header.unit, record.header.outgoingPsw,
    record.header.incomingPsw, record.submittedBy, record.acknowledgedByNurse,
  ].join(' ')).split(' ');
  const includes = (words: string[], term: string) => words.some((word) =>
    term.length === 1 || /^\d+$/.test(term) ? word === term : word.startsWith(term));
  if (terms.every((term) => includes(metadata, term))) return { rows: record.rows, sharedMatch: true };
  const notes = normalized([
    record.anythingElse, record.rawTranscript, record.translatedTranscript, record.overrideReason,
    ...(record.auditTrail || []).flatMap((item) => [item.actor, item.role, item.action, item.details]),
  ].join(' ')).split(' ');
  const shared = [...metadata, ...notes];
  const sharedMatch = terms.every((term) => includes(shared, term));
  const rows = record.rows.filter((row) => {
    const text = [
      'Room ' + row.room, row.residentName, row.done?.value, row.notDoneNextShift?.value,
      row.changeNote?.value, row.mltcDetails?.qualitativeObservations?.value, row.nurseInitials?.value,
      ...archivedCodeLabels(row.changeCodes?.value || []), ...archivedMeasurements(row).map(({ cell, unit }) => archivedValue(cell?.value, unit)),
      ...archivedResidentSources(row).flat(),
      ...(row.careRequirements || []).flatMap((item) => [item.action_item, item.category, item.sourceQuote]),
      ...(record.escalations || []).filter((item) => item.room === row.room).flatMap(archivedEscalationLines),
    ];
    const resident = normalized([...text, ...text.filter((item): item is string => Boolean(item)).map(translate)].join(' ')).split(' ');
    return terms.some((term) => !includes(metadata, term) && includes(resident, term)) &&
      terms.every((term) => includes(metadata, term) || includes(resident, term));
  });
  return { rows: rows.length || !sharedMatch ? rows : record.rows, sharedMatch };
}

export function plainArchivedRecord(record: EMRRecord) {
  const { title, archivedAt } = archivedShiftParts(record);
  return [
    'CareBridge · Simulated EMR archive',
    title + ' · ' + record.header.date + ' · ' + record.header.unit,
    'Shift: ' + record.header.shift,
    'Archived at ' + archivedAt + ' (' + record.submittedAt + ')',
    'Outgoing: ' + record.header.outgoingPsw,
    'Incoming: ' + record.header.incomingPsw,
    'Submitted by: ' + record.submittedBy,
    'Nurse signature: ' + (record.acknowledgedByNurse || 'Unsigned'),
    record.overrideReason ? 'Override reason: ' + record.overrideReason : '',
    ...record.rows.map((row) => [
      '\nRoom ' + row.room + ' · ' + row.residentName,
      'Completed care: ' + archivedValue(row.done?.value),
      'Next shift: ' + archivedValue(row.notDoneNextShift?.value),
      'Stop & Watch: ' + archivedCodeLabels(row.changeCodes?.value || []).join(' · '),
      'Change note: ' + archivedValue(row.changeNote?.value),
      'Observations: ' + archivedValue(row.mltcDetails?.qualitativeObservations?.value),
      ...archivedMeasurements(row).map(({ label, cell, unit }) => label + ': ' + archivedValue(cell?.value, unit)),
      'Nurse notification: ' + archivedNurseNotification(row),
      ...(row.careRequirements || []).map((item) => item.category + ': ' + item.action_item +
        (item.completed ? ' · Completed' : '') + (item.isPendingConfirmation ? ' · Unverified' : '') +
        (item.sourceQuote ? '\nOriginal wording: ' + item.sourceQuote : '')),
      ...archivedResidentSources(row).map(([label, value]) => label + ' source: ' + value),
    ].join('\n')),
    '\nUnit note\n' + archivedValue(record.anythingElse),
    '\nOriginal transcript\n' + archivedValue(record.rawTranscript),
    record.translatedTranscript && '\nRecorded translation\n' + record.translatedTranscript,
    '\nArchived escalations',
    ...(record.escalations || []).map((item) => [item.residentName + ' · Room ' + item.room, ...archivedEscalationLines(item)].join('\n')),
    '\nActivity log',
    ...(record.auditTrail || []).map((item) => [item.timestamp, item.actor, item.role, item.action, item.details].filter(Boolean).join(' · ')),
  ].filter(Boolean).join('\n');
}
