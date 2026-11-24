import { SelectPopover } from './SelectPopover';
import { detectLanguage, speechLocaleFor } from '../utils/translator';
import { formatUiDate, l10n, localizedShift } from '../utils/localization';
import { ClinicalText } from './ClinicalText';
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ClipboardCopy,
  Droplet, FileText, History, Loader2, MessageSquareText, Mic, Printer, RefreshCcw,
  Search, SlidersHorizontal, Volume2, X,
} from 'lucide-react';
import { EMRRecord, HandoffRow } from '../types/handoff';
import {
  archivedCodeLabels, archivedEscalationLines, archivedMeasurements, archivedNurseNotification,
  archivedResidentSources, archivedSearchTerms, archivedShiftParts, archivedValue, archiveEntries,
  hasArchivedChange, plainArchivedRecord,
} from '../utils/emrArchive';
import type { InterfaceLanguage } from '../utils/localization';
import './EmrView.css';
import { Button, PageHeader, StatusToast, WorkspaceFooter } from './WorkspaceUi';

interface EmrViewProps {
  records: EMRRecord[];
  interfaceLanguage?: InterfaceLanguage;
}

type ArchiveDialog =
  | { type: 'resident'; recordId: string; room: string }
  | { type: 'full' | 'unit' | 'transcript' | 'activity'; recordId: string };

type ArchiveField = (text: string | undefined) => React.ReactNode;

function Detail({ title, icon: Icon, children }: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return <section className="detail"><h3><Icon /> {title}</h3>{children}</section>;
}

function ActivityLog({ record }: { record: EMRRecord }) {
  return record.auditTrail?.length ? (
    <ol>{record.auditTrail.map((item, index) => (
      <li className="log" key={index}>
        <CheckCircle2 />
        <div><strong>{l10n(item.action)}</strong><span className="muted">
          {[item.actor, l10n(item.role), item.timestamp].filter(Boolean).join(' · ')}
        </span>{item.details && <p>{l10n(item.details)}</p>}</div>
      </li>
    ))}</ol>
  ) : <p className="muted">{l10n("No activity recorded.")}</p>;
}

function ResidentDetails({ record, row, field, language }: {
  record: EMRRecord;
  row: HandoffRow;
  field: ArchiveField;
  language: InterfaceLanguage;
}) {
  const sources = archivedResidentSources(row);
  const [fluid, ...otherMeasurements] = archivedMeasurements(row);
  const changes = archivedCodeLabels(row.changeCodes?.value || [], language);
  const episodes = (record.escalations || []).filter((item) => item.room === row.room);
  return <>
    <Detail title={l10n("Completed care")} icon={FileText}><p>{field(row.done?.value)}</p></Detail>
    <Detail title={l10n("Stop & Watch")} icon={AlertCircle}>
      {changes.length > 0 && <p className="change-text">{changes.join(' · ')}</p>}
      <p>{row.changeNote?.value ? field(row.changeNote.value) : l10n('No change recorded')}</p>
    </Detail>
    <Detail title={l10n("Observations")} icon={MessageSquareText}>
      <p>{field(row.mltcDetails?.qualitativeObservations?.value)}</p>
    </Detail>
    <Detail title={l10n("Fluid intake")} icon={Droplet}>
      <p>{typeof fluid.cell?.value === 'number' ? <><span className="metric">{fluid.cell.value}</span>{" " + l10n("mL")}</>
        : archivedValue(fluid.cell?.value, fluid.unit)}</p>
    </Detail>
    <Detail title={l10n("Next shift")} icon={FileText}>
      <p>{field(row.notDoneNextShift?.value)}</p>
      {!!row.careRequirements?.length && <ul className="detail-list">{row.careRequirements.map((task) => (
        <li key={task.id}>
          <strong>{l10n(task.category)}</strong> · {field(task.action_item)}
          {task.completed && l10n(" · Completed")}
          {task.isPendingConfirmation && l10n(" · Unverified at submission")}
          {task.sourceQuote && <p className="muted">{task.sourceQuote}</p>}
          {task.lastEditedBy && <p className="muted">{l10n("Recorded by") + " "}{task.lastEditedBy}</p>}
        </li>
      ))}</ul>}
    </Detail>
    <Detail title={l10n("Nurse notification")} icon={CheckCircle2}>
      <p>{l10n(archivedNurseNotification(row))}</p>
      {row.nurseInitials?.value && archivedNurseNotification(row) !== row.nurseInitials.value && (
        <p className="muted">{l10n("Recorded nurse initials:") + " "}{row.nurseInitials.value}</p>
      )}
    </Detail>
    {episodes.length > 0 && <Detail title={l10n("Archived escalations")} icon={AlertCircle}>
      <ul className="detail-list">{episodes.map((item) =>
        <li key={item.id}><p>{field(item.note)}</p><p>{archivedEscalationLines(item).slice(1).join("\n")}</p></li>
      )}</ul>
    </Detail>}
    <details className="detail">
      <summary>{l10n("Other measurements and source notes")}</summary>
      <dl className="sources">{otherMeasurements.map(({ label, cell, unit }) =>
        <React.Fragment key={label}><dt>{l10n(label)}</dt><dd>{cell?.value == null || cell.value === '' ? l10n('Not recorded') : archivedValue(cell.value, unit)}</dd></React.Fragment>
      )}</dl>
      {!!sources.length && <dl className="sources">{sources.map(([label, value]) => (
        <React.Fragment key={label}><dt>{label}{" " + l10n("source")}</dt><dd>{value}</dd></React.Fragment>
      ))}</dl>}
    </details>
    <Detail title={l10n("Record source")} icon={History}>
      <p>{l10n("Submitted by") + " "}{record.submittedBy} · {record.acknowledgedByNurse ? 'Signed by ' + record.acknowledgedByNurse : l10n("Unsigned")}</p>
    </Detail>
  </>;
}

function FullShiftTable({ record, field, language }: {
  record: EMRRecord;
  field: ArchiveField;
  language: InterfaceLanguage;
}) {
  return <div className="tablewrap" role="region" aria-label={l10n("Archived resident table")} tabIndex={0}>
    <table className="fulltable"><thead><tr>
      {['Resident', 'Care done', 'Next shift', 'Stop & Watch', 'Observations & fluids', 'Nurse'].map((label) =>
        <th key={label} scope="col">{l10n(label)}</th>)}
    </tr></thead>
      <tbody>{record.rows.map((row) => (
        <tr key={row.room}>
          <th scope="row">{row.room} · {row.residentName}</th>
          <td>{field(row.done?.value)}</td>
          <td>{field(row.notDoneNextShift?.value)}</td>
          <td>
            {archivedCodeLabels(row.changeCodes?.value || [], language).join(' · ')}
            <p>{row.changeNote?.value ? field(row.changeNote.value) : l10n('No change recorded')}</p>
          </td>
          <td>{field(row.mltcDetails?.qualitativeObservations?.value)}
            <p><strong>{l10n("Fluids:") + " "}</strong>{archivedValue(row.mltcDetails?.fluidIntakeMl?.value, 'mL')}</p></td>
          <td>{l10n(archivedNurseNotification(row))}</td>
        </tr>
      ))}</tbody>
    </table>
  </div>;
}

export const EmrView: React.FC<EmrViewProps> = ({ records, interfaceLanguage = 'en' }) => {
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shift, setShift] = useState('');
  const [room, setRoom] = useState('');
  const [changesOnly, setChangesOnly] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<ArchiveDialog | null>(null);
  const [printingRecord, setPrintingRecord] = useState<EMRRecord | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('');
  const [syncMessage, setSyncMessage] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusPrint = useRef(false);
  const printButton = useRef<HTMLButtonElement>(null);
  const shiftFilter = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const panelId = useId();

  useEffect(() => {
    const finishPrinting = () => setPrintingRecord(null);
    window.addEventListener('afterprint', finishPrinting);
    return () => {
      clearTimeout(syncTimer.current);
      window.removeEventListener('afterprint', finishPrinting);
      if (utteranceRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!syncMessage) return;
    const timer = setTimeout(() => setSyncMessage(false), 3500);
    return () => clearTimeout(timer);
  }, [syncMessage, lastSync]);

  const field: ArchiveField = (text) => text ? <ClinicalText text={text} /> : l10n("Not recorded");
  const terms = archivedSearchTerms(query);
  const filtersActive = Boolean(terms.length || shift || room || changesOnly);
  const totalResidents = records.reduce((total, record) => total + record.rows.length, 0);
  const units = [...new Set(records.map((record) => record.header.unit).filter(Boolean))];
  const rooms = [...new Set(records.flatMap((record) => record.rows.map((row) => row.room)))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const archive = records.flatMap((record) => {
    const meta = archivedShiftParts(record);
    if (shift && meta.shift !== shift) return [];
    const result = archiveEntries(record, terms, (text) => text);
    const matches = result.rows.filter((row) => (!room || row.room === room) && (!changesOnly || hasArchivedChange(record, row)));
    return matches.length || (!record.rows.length && result.sharedMatch && !room && !changesOnly) ? [{ record, rows: matches, meta }] : [];
  });
  const matchCount = archive.reduce((total, item) => total + item.rows.length, 0);
  const filterCount = Number(Boolean(shift)) + Number(Boolean(room)) + Number(changesOnly);

  const selectedRecord = details ? records.find((record) => record.id === details.recordId) : undefined;
  const selectedResident = details?.type === 'resident' ? selectedRecord?.rows.find((row) => row.room === details.room) : undefined;
  const hasDetails = Boolean(selectedRecord && (details?.type !== 'resident' || selectedResident));

  useEffect(() => {
    if (!hasDetails) {
      if (dialog.current?.open) dialog.current.close();
      return;
    }
    if (!dialog.current?.open) dialog.current?.showModal();
    if (focusPrint.current) {
      printButton.current?.focus();
      focusPrint.current = false;
    }
  }, [details, hasDetails]);

  const open = (next: ArchiveDialog, trigger: HTMLElement, preferPrint = false) => {
    opener.current = trigger;
    focusPrint.current = preferPrint;
    setCopyMessage('');
    setDetails(next);
  };

  const stopSpeech = () => {
    if (utteranceRef.current) {
      utteranceRef.current = null;
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  const readAloud = (text: string, source?: string) => {
    if (speaking) {
      stopSpeech();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocaleFor(source || detectLanguage(text)) || 'en-CA';
    utteranceRef.current = utterance;
    utterance.onend = utterance.onerror = () => {
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null;
        setSpeaking(false);
      }
    };
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage('Copied.');
    } catch {
      setCopyMessage('Clipboard unavailable. Select the text to copy it.');
    }
  };

  const simulateSync = () => {
    setSyncMessage(false);
    setSyncing(true);
    syncTimer.current = setTimeout(() => {
      setSyncing(false);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setSyncMessage(true);
    }, 600);
  };

  const print = (record: EMRRecord) => {
    flushSync(() => setPrintingRecord(record));
    try {
      window.print();
    } catch {
      setPrintingRecord(null);
      setCopyMessage('Printing unavailable.');
    }
  };

  const clearFilters = () => {
    setShift('');
    setRoom('');
    setChangesOnly(false);
    setExpanded({});
    shiftFilter.current?.focus();
  };

  const renderDialog = (record: EMRRecord, type: ArchiveDialog['type']) => {
    const meta = archivedShiftParts(record);
    const subtitle = meta.title + ' · ' + (type === 'full'
      ? l10n('{{unit}} · Residents: {{count}}', { unit: record.header.unit, count: record.rows.length }) : l10n('Archived record'));
    let title = '';
    let body: React.ReactNode;
    switch (type) {
      case 'resident':
        if (!selectedResident) return null;
        title = l10n('{{resident}} · Room {{room}}', { resident: selectedResident.residentName, room: selectedResident.room });
        body = <ResidentDetails record={record} row={selectedResident} field={field} language={interfaceLanguage} />;
        break;
      case 'unit':
        title = 'Unit note';
        body = <Detail title={l10n("Archived note")} icon={MessageSquareText}><p>{field(record.anythingElse)}</p></Detail>;
        break;
      case 'transcript':
        title = 'Original transcript';
        body = <>
          <Detail title={l10n("Source record")} icon={Mic}><p>{record.rawTranscript ? <ClinicalText text={record.rawTranscript} source={record.transcriptLanguage} /> : l10n('Not recorded')}</p></Detail>
          {record.rawTranscript && <div className="archive-buttons">
            <Button onClick={() => copy(record.rawTranscript)}><ClipboardCopy />{" " + l10n("Copy transcript")}</Button>
            {'speechSynthesis' in window && <Button onClick={() => readAloud(record.rawTranscript, record.transcriptLanguage)}>
              <Volume2 /> {speaking ? l10n("Stop reading") : l10n("Read aloud")}
            </Button>}
          </div>}
          {record.translatedTranscript && <Detail title={l10n('Recorded translation · Verify against the original')} icon={MessageSquareText}>
            <p>{record.translatedTranscript}</p>
          </Detail>}
        </>;
        break;
      case 'activity':
        title = 'Activity log';
        body = <ActivityLog record={record} />;
        break;
      case 'full':
        title = 'Full shift record';
        body = <>
          <div className="detail">
            <div className="archive-buttons">
              <Button ref={printButton} onClick={() => print(record)}><Printer />{" " + l10n("Print full shift")}</Button>
              <Button onClick={() => copy(plainArchivedRecord(record))}><ClipboardCopy />{" " + l10n("Copy record")}</Button>
            </div>
            <dl className="sources full-meta">
              <dt>{l10n("Shift")}</dt><dd>{record.header.date} · {localizedShift(record.header.shift)}</dd>
              <dt>{l10n("Archived")}</dt><dd><time dateTime={record.submittedAt}>{formatUiDate(new Date(record.submittedAt), { dateStyle: 'medium', timeStyle: 'short' })}</time></dd>
              <dt>{l10n("Submitted by")}</dt><dd>{record.submittedBy}</dd>
              <dt>{l10n("Outgoing staff")}</dt><dd>{record.header.outgoingPsw}</dd>
              <dt>{l10n("Incoming staff")}</dt><dd>{record.header.incomingPsw}</dd>
              <dt>{l10n("Nurse signature")}</dt><dd>{record.acknowledgedByNurse || l10n("Unsigned")}</dd>
              {record.overrideReason && <><dt>{l10n("Override reason")}</dt><dd>{record.overrideReason}</dd></>}
            </dl>
          </div>
          <FullShiftTable record={record} field={field} language={interfaceLanguage} />
          {record.rows.length > 0 && <details className="detail">
            <summary>{l10n("Resident documentation")}</summary>
            {record.rows.map((row) => <details className="resident-documentation" key={row.room}>
              <summary>{row.residentName}{" " + l10n("· Room") + " "}{row.room}</summary>
              <ResidentDetails record={record} row={row} field={field} language={interfaceLanguage} />
            </details>)}
          </details>}
          <Detail title={l10n("Unit note")} icon={MessageSquareText}><p>{field(record.anythingElse)}</p></Detail>
          <Detail title={l10n("Original transcript")} icon={Mic}><p>{record.rawTranscript ? <ClinicalText text={record.rawTranscript} source={record.transcriptLanguage} /> : l10n('Not recorded')}</p></Detail>
          {record.translatedTranscript && <Detail title={l10n('Recorded translation · Verify against the original')} icon={MessageSquareText}><p>{record.translatedTranscript}</p></Detail>}
          {!!record.escalations?.length && <Detail title={l10n("Archived escalations")} icon={AlertCircle}>
            <ul className="detail-list">{record.escalations.map((item) => <li key={item.id}>
              <strong>{item.residentName}{" " + l10n("· Room") + " "}{item.room}</strong><p>{field(item.note)}</p><p>{archivedEscalationLines(item).slice(1).join("\n")}</p>
            </li>)}</ul>
          </Detail>}
          <Detail title={l10n("Activity log")} icon={History}><ActivityLog record={record} /></Detail>
        </>;
        break;
    }
    return <>
      <div className="modalhead">
        <div><h2 id="archive-modal-title">{l10n(title)}</h2><p className="muted">{subtitle}</p></div>
        <button type="button" autoFocus className="close" aria-label={l10n("Close")} onClick={() => dialog.current?.close()}><X /></button>
      </div>
      <div className="archive-body">{body}<p className="muted" role="status">{l10n(copyMessage)}</p></div>
    </>;
  };

  return (
    <div className="emr-archive">
      <PageHeader title={l10n("Records")} subtitle={(units.length === 1 ? units[0] + ' · ' : '') + l10n('Handoff archive')}
        actions={<Button disabled={syncing} onClick={simulateSync}>
          <RefreshCcw className={syncing ? 'cb-pending' : undefined} /> {syncing ? l10n("Simulating sync…") : l10n("Simulate sync")}
        </Button>} />
      <div className="tools">
        <label className="search"><Search /><span className="sr-only">{l10n("Search records")}</span>
          <input type="search" placeholder={l10n("Search residents, notes, or staff…")} value={query} onChange={(event) => {
            setQuery(event.target.value);
            setExpanded({});
          }} />
        </label>
        <Button aria-expanded={filtersOpen} aria-controls={panelId} onClick={() => {
          setFiltersOpen(!filtersOpen);
          if (!filtersOpen) requestAnimationFrame(() => shiftFilter.current?.focus());
        }}><SlidersHorizontal />{" " + l10n("Filter")}{filterCount ? ' (' + filterCount + ')' : ''}</Button>
      </div>
      <div className="filterpanel" id={panelId} hidden={!filtersOpen}>
        <div className="filter-field">
          <label htmlFor={panelId + '-shift'}>{l10n('Shift')}</label>
          <SelectPopover id={panelId + '-shift'} label={l10n('Shift')} triggerRef={shiftFilter} value={shift}
            onChange={(value) => { setShift(value); setExpanded({}); }}
            options={[{ value: '', label: l10n('All shifts') },
              ...['Day', 'Evening', 'Night'].map((value) => ({ value, label: l10n(value) }))]} />
        </div>
        <div className="filter-field">
          <label htmlFor={panelId + '-room'}>{l10n('Room')}</label>
          <SelectPopover id={panelId + '-room'} label={l10n('Room')} value={room}
            onChange={(value) => { setRoom(value); setExpanded({}); }}
            options={[{ value: '', label: l10n('All rooms') },
              ...rooms.map((value) => ({ value, label: l10n('Room {{room}}', { room: value }) }))]} />
        </div>
        <label className="filter-check"><input type="checkbox" checked={changesOnly} onChange={(event) => {
          setChangesOnly(event.target.checked);
          setExpanded({});
        }} />{" " + l10n("Changes only")}</label>
        {!!filterCount && <button type="button" className="action quiet" onClick={clearFilters}>{l10n("Clear filters")}</button>}
      </div>
      <div className="sectionlabel">
        <strong>{l10n("Shift history")}</strong>
        <div className="history-meta">
          <span className="muted" aria-live="polite">{archive.length
            ? l10n('Residents: {{matches}} of {{total}} · Shifts: {{shifts}}', { matches: matchCount, total: totalResidents, shifts: archive.length })
            : l10n("0 records")}</span>
        </div>
      </div>
      {archive.length ? archive.map(({ record, rows, meta }, index) => {
        const visible = expanded[record.id] ?? (filtersActive || index === 0);
        const rowListId = panelId + '-rows-' + index;
        return <section className="cb-panel archive" key={record.id}>
          <header className="shift">
            <span className="docicon"><FileText /></span>
            <div className="shiftmeta"><h2>{meta.title}</h2>
              <p className="muted">{meta.hours ? meta.hours + ' · ' : ''}{l10n("Archived at") + " "}<time dateTime={record.submittedAt}>{meta.archivedAt}</time>
                {units.length > 1 && ' · ' + record.header.unit}</p>
              {record.acknowledgedByNurse ? <span className="signed"><CheckCircle2 />{" " + l10n("Signed ·") + " "}{record.acknowledgedByNurse}</span>
                : <span className="muted">{l10n("Unsigned")}</span>}
            </div>
            <div className="shiftlinks">
              <button type="button" aria-haspopup="dialog" onClick={(event) => open({ type: 'full', recordId: record.id }, event.currentTarget)}>{l10n("Full record")}</button>
              <button type="button" aria-expanded={visible} aria-controls={rowListId}
                aria-label={visible ? l10n("Collapse resident list") : l10n("Expand resident list")}
                onClick={() => setExpanded((previous) => ({ ...previous, [record.id]: !visible }))}>
                <ChevronDown className="cb-disclosure-icon" aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="records" id={rowListId} hidden={!visible}>
            {rows.length ? rows.map((resident) => {
              const changed = hasArchivedChange(record, resident);
              const labels = archivedCodeLabels(resident.changeCodes?.value || [], interfaceLanguage);
              const next = resident.notDoneNextShift?.value;
              const summary = changed
                ? labels.join(' · ') || (resident.changeNote?.value && !/^no change/i.test(resident.changeNote.value)
                  ? <bdi>{resident.changeNote.value}</bdi> : l10n('Archived escalation'))
                : next && next !== '—' ? <bdi>{next}</bdi> : l10n('Per care plan');
              return <button type="button" key={resident.room} className="record" aria-haspopup="dialog"
                aria-label={l10n('Open record for {{resident}}, room {{room}}', { resident: resident.residentName, room: resident.room })}
                onClick={(event) => open({ type: 'resident', recordId: record.id, room: resident.room }, event.currentTarget)}>
                <span className={changed ? 'room change' : 'room'}>{resident.room}</span>
                <span><span className="name">{resident.residentName}</span>
                  <span className="muted">{changed ? l10n("Changes recorded") : l10n("No change recorded")}</span></span>
                <span className={changed ? 'finding change' : 'finding'}>{summary}</span>
                <ChevronRight className="chev" />
              </button>;
            }) : <p className="empty">{l10n("No resident entries in this shift.")}</p>}
          </div>
          <footer className="archivefooter">
            <button type="button" className="action" aria-haspopup="dialog" onClick={(event) => open({ type: 'unit', recordId: record.id }, event.currentTarget)}><MessageSquareText />{" " + l10n("Unit note")}</button>
            <button type="button" className="action" aria-haspopup="dialog" onClick={(event) => open({ type: 'transcript', recordId: record.id }, event.currentTarget)}><Mic />{" " + l10n("Original transcript")}</button>
            <button type="button" className="action" aria-haspopup="dialog" onClick={(event) => open({ type: 'activity', recordId: record.id }, event.currentTarget)}><History />{" " + l10n("Activity log")}</button>
            <button type="button" className="action last" aria-haspopup="dialog" onClick={(event) => open({ type: 'full', recordId: record.id }, event.currentTarget, true)}><Printer />{" " + l10n("Print all")}</button>
          </footer>
        </section>;
      }) : <p className="empty">{records.length ? l10n("No matching records.") : l10n("No shifts archived yet.")}</p>}
      <WorkspaceFooter notice={lastSync ? l10n('Simulated sync at {{time}} · No connection to a live EMR', { time: lastSync }) : l10n('Read-only archive · No connection to a live EMR')} />
      <StatusToast>{syncMessage ? l10n("Simulated sync complete · Local records only") : ''}</StatusToast>
      <dialog ref={dialog} aria-labelledby="archive-modal-title" className={details?.type === 'full' ? 'cb-motion-dialog wide' : 'cb-motion-dialog'}
        onClose={() => {
          stopSpeech();
          setCopyMessage('');
          setDetails(null);
          opener.current?.focus();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
        }}>
        {selectedRecord && details && renderDialog(selectedRecord, details.type)}
      </dialog>
      {printingRecord && createPortal(<article className="emr-print-record">
        <h1>{l10n("Full shift record")}</h1><pre>{plainArchivedRecord(printingRecord)}</pre>
      </article>, document.body)}
    </div>
  );
};
