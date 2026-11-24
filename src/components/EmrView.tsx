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
import { getInstantLtcTranslation, translateBidirectional } from '../utils/translator';
import { InterfaceLanguage } from '../utils/uiTranslations';
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
        <div><strong>{item.action}</strong><span className="muted">
          {[item.actor, item.role, item.timestamp].filter(Boolean).join(' · ')}
        </span>{item.details && <p>{item.details}</p>}</div>
      </li>
    ))}</ol>
  ) : <p className="muted">No activity recorded.</p>;
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
    <Detail title="Completed care" icon={FileText}><p>{field(row.done?.value)}</p></Detail>
    <Detail title="Stop & Watch" icon={AlertCircle}>
      {changes.length > 0 && <p className="change-text">{changes.join(' · ')}</p>}
      <p>{field(row.changeNote?.value || 'No change recorded')}</p>
    </Detail>
    <Detail title="Observations" icon={MessageSquareText}>
      <p>{field(row.mltcDetails?.qualitativeObservations?.value)}</p>
    </Detail>
    <Detail title="Fluid intake" icon={Droplet}>
      <p>{typeof fluid.cell?.value === 'number' ? <><span className="metric">{fluid.cell.value}</span> mL</>
        : archivedValue(fluid.cell?.value, fluid.unit)}</p>
    </Detail>
    <Detail title="Next shift" icon={FileText}>
      <p>{field(row.notDoneNextShift?.value)}</p>
      {!!row.careRequirements?.length && <ul className="detail-list">{row.careRequirements.map((task) => (
        <li key={task.id}>
          <strong>{task.category}</strong> · {field(task.action_item)}
          {task.completed && ' · Completed'}
          {task.isPendingConfirmation && ' · Unverified at submission'}
          {task.sourceQuote && <p className="muted">{task.sourceQuote}</p>}
          {task.lastEditedBy && <p className="muted">Recorded by {task.lastEditedBy}</p>}
        </li>
      ))}</ul>}
    </Detail>
    <Detail title="Nurse notification" icon={CheckCircle2}>
      <p>{archivedNurseNotification(row)}</p>
      {row.nurseInitials?.value && archivedNurseNotification(row) !== row.nurseInitials.value && (
        <p className="muted">Recorded nurse initials: {row.nurseInitials.value}</p>
      )}
    </Detail>
    {episodes.length > 0 && <Detail title="Archived escalations" icon={AlertCircle}>
      <ul className="detail-list">{episodes.map((item) =>
        <li key={item.id}><p>{archivedEscalationLines(item).join('\n')}</p></li>
      )}</ul>
    </Detail>}
    <details className="detail">
      <summary>Other measurements and source notes</summary>
      <dl className="sources">{otherMeasurements.map(({ label, cell, unit }) =>
        <React.Fragment key={label}><dt>{label}</dt><dd>{archivedValue(cell?.value, unit)}</dd></React.Fragment>
      )}</dl>
      {!!sources.length && <dl className="sources">{sources.map(([label, value]) => (
        <React.Fragment key={label}><dt>{label} source</dt><dd>{value}</dd></React.Fragment>
      ))}</dl>}
    </details>
    <Detail title="Record source" icon={History}>
      <p>Submitted by {record.submittedBy} · {record.acknowledgedByNurse ? 'Signed by ' + record.acknowledgedByNurse : 'Unsigned'}</p>
    </Detail>
  </>;
}

function FullShiftTable({ record, field, language }: {
  record: EMRRecord;
  field: ArchiveField;
  language: InterfaceLanguage;
}) {
  return <div className="tablewrap" role="region" aria-label="Archived resident table" tabIndex={0}>
    <table className="fulltable"><thead><tr>
      {['Resident', 'Care done', 'Next shift', 'Stop & Watch', 'Observations & fluids', 'Nurse'].map((label) =>
        <th key={label} scope="col">{label}</th>)}
    </tr></thead>
      <tbody>{record.rows.map((row) => (
        <tr key={row.room}>
          <th scope="row">{row.room} · {row.residentName}</th>
          <td>{field(row.done?.value)}</td>
          <td>{field(row.notDoneNextShift?.value)}</td>
          <td>
            {archivedCodeLabels(row.changeCodes?.value || [], language).join(' · ')}
            <p>{field(row.changeNote?.value || 'No change recorded')}</p>
          </td>
          <td>{field(row.mltcDetails?.qualitativeObservations?.value)}
            <p><strong>Fluids: </strong>{archivedValue(row.mltcDetails?.fluidIntakeMl?.value, 'mL')}</p></td>
          <td>{archivedNurseNotification(row)}</td>
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
  const [showOriginal, setShowOriginal] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const cache = useRef(new Map<string, string>());
  const dialog = useRef<HTMLDialogElement>(null);
  const focusPrint = useRef(false);
  const printButton = useRef<HTMLButtonElement>(null);
  const shiftFilter = useRef<HTMLSelectElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (interfaceLanguage === 'en') {
      setTranslating(false);
      setShowOriginal(false);
      return;
    }
    const values = new Set(records.flatMap((record) => record.rows.flatMap((row) => [
      row.done?.value, row.notDoneNextShift?.value, row.changeNote?.value,
      row.mltcDetails?.qualitativeObservations?.value,
    ])));
    const missing = [...values].filter((text): text is string => !!text && text !== '—' &&
      !cache.current.has(interfaceLanguage + '::' + text));
    if (!missing.length) {
      setTranslating(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setTranslating(true);
      const results = await Promise.allSettled(missing.map(async (text) => {
        const result = await translateBidirectional(text, 'en', interfaceLanguage);
        return [interfaceLanguage + '::' + text, result?.translatedText?.trim() ||
          getInstantLtcTranslation(text, interfaceLanguage, 'en')] as const;
      }));
      if (cancelled) return;
      const updates: Record<string, string> = {};
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const [key, value] = result.value;
        cache.current.set(key, value);
        updates[key] = value;
      }
      setTranslations((previous) => ({ ...previous, ...updates }));
      setTranslating(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [interfaceLanguage, records]);

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

  const translate = (text: string) => interfaceLanguage === 'en' ? text
    : translations[interfaceLanguage + '::' + text] || getInstantLtcTranslation(text, interfaceLanguage, 'en');

  const field: ArchiveField = (text) => {
    if (!text) return 'Not recorded';
    const translated = translate(text);
    return <>{translated}{showOriginal && translated !== text && <small className="muted original" lang="en">EN: {text}</small>}</>;
  };

  const terms = archivedSearchTerms(query);
  const filtersActive = Boolean(terms.length || shift || room || changesOnly);
  const totalResidents = records.reduce((total, record) => total + record.rows.length, 0);
  const units = [...new Set(records.map((record) => record.header.unit).filter(Boolean))];
  const rooms = [...new Set(records.flatMap((record) => record.rows.map((row) => row.room)))].sort(
    (a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const archive = records.flatMap((record) => {
    const meta = archivedShiftParts(record);
    if (shift && meta.shift !== shift) return [];
    const result = archiveEntries(record, terms, translate);
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

  const readAloud = (text: string) => {
    if (speaking) {
      stopSpeech();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
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
      ? record.header.unit + ' · All ' + record.rows.length + ' residents' : 'Archived record');
    let title = '';
    let body: React.ReactNode;
    switch (type) {
      case 'resident':
        if (!selectedResident) return null;
        title = selectedResident.residentName + ' · Room ' + selectedResident.room;
        body = <ResidentDetails record={record} row={selectedResident} field={field} language={interfaceLanguage} />;
        break;
      case 'unit':
        title = 'Unit note';
        body = <Detail title="Archived note" icon={MessageSquareText}><p>{archivedValue(record.anythingElse)}</p></Detail>;
        break;
      case 'transcript':
        title = 'Original transcript';
        body = <>
          <Detail title="Source record" icon={Mic}><p>{archivedValue(record.rawTranscript)}</p></Detail>
          {record.rawTranscript && <div className="archive-buttons">
            <Button onClick={() => copy(record.rawTranscript)}><ClipboardCopy /> Copy transcript</Button>
            {'speechSynthesis' in window && <Button onClick={() => readAloud(record.rawTranscript)}>
              <Volume2 /> {speaking ? 'Stop reading' : 'Read aloud'}
            </Button>}
          </div>}
          {record.translatedTranscript && <Detail title="Recorded translation" icon={MessageSquareText}>
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
              <Button ref={printButton} onClick={() => print(record)}><Printer /> Print full shift</Button>
              <Button onClick={() => copy(plainArchivedRecord(record))}><ClipboardCopy /> Copy record</Button>
            </div>
            <dl className="sources full-meta">
              <dt>Shift</dt><dd>{record.header.date} · {record.header.shift}</dd>
              <dt>Archived</dt><dd><time dateTime={record.submittedAt}>{new Date(record.submittedAt).toLocaleString()}</time></dd>
              <dt>Submitted by</dt><dd>{record.submittedBy}</dd>
              <dt>Outgoing staff</dt><dd>{record.header.outgoingPsw}</dd>
              <dt>Incoming staff</dt><dd>{record.header.incomingPsw}</dd>
              <dt>Nurse signature</dt><dd>{record.acknowledgedByNurse || 'Unsigned'}</dd>
              {record.overrideReason && <><dt>Override reason</dt><dd>{record.overrideReason}</dd></>}
            </dl>
          </div>
          <FullShiftTable record={record} field={field} language={interfaceLanguage} />
          {record.rows.length > 0 && <details className="detail">
            <summary>Resident documentation</summary>
            {record.rows.map((row) => <details className="resident-documentation" key={row.room}>
              <summary>{row.residentName} · Room {row.room}</summary>
              <ResidentDetails record={record} row={row} field={field} language={interfaceLanguage} />
            </details>)}
          </details>}
          <Detail title="Unit note" icon={MessageSquareText}><p>{archivedValue(record.anythingElse)}</p></Detail>
          <Detail title="Original transcript" icon={Mic}><p>{archivedValue(record.rawTranscript)}</p></Detail>
          {record.translatedTranscript && <Detail title="Recorded translation" icon={MessageSquareText}><p>{record.translatedTranscript}</p></Detail>}
          {!!record.escalations?.length && <Detail title="Archived escalations" icon={AlertCircle}>
            <ul className="detail-list">{record.escalations.map((item) => <li key={item.id}>
              <strong>{item.residentName} · Room {item.room}</strong><p>{archivedEscalationLines(item).join('\n')}</p>
            </li>)}</ul>
          </Detail>}
          <Detail title="Activity log" icon={History}><ActivityLog record={record} /></Detail>
        </>;
        break;
    }
    return <>
      <div className="modalhead">
        <div><h2 id="archive-modal-title">{title}</h2><p className="muted">{subtitle}</p></div>
        <button type="button" autoFocus className="close" aria-label="Close" onClick={() => dialog.current?.close()}><X /></button>
      </div>
      <div className="archive-body">{body}<p className="muted" role="status">{copyMessage}</p></div>
    </>;
  };

  return (
    <div className="emr-archive">
      <PageHeader title="Records" subtitle={(units.length === 1 ? units[0] + ' · ' : '') + 'Handoff archive'}
        actions={<Button disabled={syncing} onClick={simulateSync}>
          <RefreshCcw className={syncing ? 'cb-pending' : undefined} /> {syncing ? 'Simulating sync…' : 'Simulate sync'}
        </Button>} />
      <div className="tools">
        <label className="search"><Search /><span className="sr-only">Search records</span>
          <input type="search" placeholder="Search residents, notes, or staff…" value={query} onChange={(event) => {
            setQuery(event.target.value);
            setExpanded({});
          }} />
        </label>
        <Button aria-expanded={filtersOpen} aria-controls={panelId} onClick={() => {
          setFiltersOpen(!filtersOpen);
          if (!filtersOpen) requestAnimationFrame(() => shiftFilter.current?.focus());
        }}><SlidersHorizontal /> Filter{filterCount ? ' (' + filterCount + ')' : ''}</Button>
      </div>
      <div className="filterpanel" id={panelId} hidden={!filtersOpen}>
        <label>Shift<select className="cb-field" ref={shiftFilter} value={shift} onChange={(event) => { setShift(event.target.value); setExpanded({}); }}>
          <option value="">All shifts</option>
          {['Day', 'Evening', 'Night'].map((option) => <option key={option}>{option}</option>)}
        </select></label>
        <label>Room<select className="cb-field" value={room} onChange={(event) => { setRoom(event.target.value); setExpanded({}); }}>
          <option value="">All rooms</option>
          {rooms.map((option) => <option value={option} key={option}>Room {option}</option>)}
        </select></label>
        <label className="filter-check"><input type="checkbox" checked={changesOnly} onChange={(event) => {
          setChangesOnly(event.target.checked);
          setExpanded({});
        }} /> Changes only</label>
        {!!filterCount && <button type="button" className="action quiet" onClick={clearFilters}>Clear filters</button>}
      </div>
      <div className="sectionlabel">
        <strong>Shift history</strong>
        <div className="history-meta">
          {interfaceLanguage !== 'en' && <button type="button" className="action quiet" aria-pressed={showOriginal}
            onClick={() => setShowOriginal(!showOriginal)}>{translating && <Loader2 className="cb-pending" />}
            {showOriginal ? 'Hide EN' : 'Show EN'}
          </button>}
          <span className="muted" aria-live="polite">{archive.length
            ? matchCount + ' of ' + totalResidents + ' residents · ' + archive.length + (archive.length === 1 ? ' shift' : ' shifts')
            : '0 records'}</span>
        </div>
      </div>
      {archive.length ? archive.map(({ record, rows, meta }, index) => {
        const visible = expanded[record.id] ?? (filtersActive || index === 0);
        const rowListId = panelId + '-rows-' + index;
        return <section className="cb-panel archive" key={record.id}>
          <header className="shift">
            <span className="docicon"><FileText /></span>
            <div className="shiftmeta"><h2>{meta.title}</h2>
              <p className="muted">{meta.hours ? meta.hours + ' · ' : ''}Archived at <time dateTime={record.submittedAt}>{meta.archivedAt}</time>
                {units.length > 1 && ' · ' + record.header.unit}</p>
              {record.acknowledgedByNurse ? <span className="signed"><CheckCircle2 /> Signed · {record.acknowledgedByNurse}</span>
                : <span className="muted">Unsigned</span>}
            </div>
            <div className="shiftlinks">
              <button type="button" aria-haspopup="dialog" onClick={(event) => open({ type: 'full', recordId: record.id }, event.currentTarget)}>Full record</button>
              <button type="button" aria-expanded={visible} aria-controls={rowListId}
                aria-label={visible ? 'Collapse resident list' : 'Expand resident list'}
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
                  ? field(resident.changeNote.value) : 'Archived escalation')
                : next && next !== '—' ? field(next) : 'Per care plan';
              return <button type="button" key={resident.room} className="record" aria-haspopup="dialog"
                aria-label={'Open record for ' + resident.residentName + ', room ' + resident.room}
                onClick={(event) => open({ type: 'resident', recordId: record.id, room: resident.room }, event.currentTarget)}>
                <span className={changed ? 'room change' : 'room'}>{resident.room}</span>
                <span><span className="name">{resident.residentName}</span>
                  <span className="muted">{changed ? 'Changes recorded' : 'No change recorded'}</span></span>
                <span className={changed ? 'finding change' : 'finding'}>{summary}</span>
                <ChevronRight className="chev" />
              </button>;
            }) : <p className="empty">No resident entries in this shift.</p>}
          </div>
          <footer className="archivefooter">
            <button type="button" className="action" aria-haspopup="dialog" onClick={(event) => open({ type: 'unit', recordId: record.id }, event.currentTarget)}><MessageSquareText /> Unit note</button>
            <button type="button" className="action" aria-haspopup="dialog" onClick={(event) => open({ type: 'transcript', recordId: record.id }, event.currentTarget)}><Mic /> Original transcript</button>
            <button type="button" className="action" aria-haspopup="dialog" onClick={(event) => open({ type: 'activity', recordId: record.id }, event.currentTarget)}><History /> Activity log</button>
            <button type="button" className="action last" aria-haspopup="dialog" onClick={(event) => open({ type: 'full', recordId: record.id }, event.currentTarget, true)}><Printer /> Print all</button>
          </footer>
        </section>;
      }) : <p className="empty">{records.length ? 'No matching records.' : 'No shifts archived yet.'}</p>}
      <WorkspaceFooter notice={(lastSync ? 'Simulated sync at ' + lastSync : 'Read-only archive') + ' · No connection to a live EMR'} />
      <StatusToast>{syncMessage ? 'Simulated sync complete · Local records only' : ''}</StatusToast>
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
        <h1>Full shift record</h1><pre>{plainArchivedRecord(printingRecord)}</pre>
      </article>, document.body)}
    </div>
  );
};
