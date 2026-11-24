import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Bandage, BatteryLow, Check, ChevronRight, Clock,
  Droplet, Loader2, PersonStanding, Users, X,
} from 'lucide-react';
import { AlertThresholds, HandoffRow, NurseEscalation, ShiftHeader } from '../types/handoff';
import { getCodeConfig, TIER_METADATA } from '../data/stopAndWatchCodes';
import { StopAndWatchDetailModal, StopAndWatchIconBadge } from './StopAndWatchIconBadge';
import { buildIncomingResidents, buildIncomingTasks, IncomingResident, IncomingTask } from '../utils/incomingShift';
import { getInstantLtcTranslation, translateBidirectional } from '../utils/translator';
import { InterfaceLanguage } from '../utils/uiTranslations';
import './IncomingShiftView.css';
import { Button, PageHeader, StatusToast, WorkspaceFooter } from './WorkspaceUi';

interface IncomingShiftViewProps {
  header: ShiftHeader;
  rows: HandoffRow[];
  anythingElse: string;
  thresholds: AlertThresholds;
  escalations: NurseEscalation[];
  noteCompletions: Record<string, string>;
  isLocked: boolean;
  onSetTaskDone: (task: IncomingTask, done: boolean) => void;
  onResetTaskProgress: () => void;
  interfaceLanguage?: InterfaceLanguage;
}

type Details =
  | { kind: 'residents' | 'unit' | 'reset' }
  | { kind: 'resident'; room: string }
  | { kind: 'task'; id: string };

const equipmentNote = 'Lift battery in the tub room is low; spare is charging at the nursing station.';

export const IncomingShiftView: React.FC<IncomingShiftViewProps> = ({
  header, rows, anythingElse, thresholds, escalations, noteCompletions,
  isLocked, onSetTaskDone, onResetTaskProgress, interfaceLanguage = 'en',
}) => {
  const [showOriginalEn, setShowOriginalEn] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [codeId, setCodeId] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ id: string; done: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const translationsCache = useRef(new Map<string, string>());
  const dialog = useRef<HTMLDialogElement>(null);
  const criteriaDialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const completedButton = useRef<HTMLButtonElement>(null);
  const workspace = useRef<HTMLDivElement>(null);

  const tasks = useMemo(() => buildIncomingTasks(rows, noteCompletions), [rows, noteCompletions]);
  const residents = useMemo(() => buildIncomingResidents(rows, escalations, thresholds),
    [rows, escalations, thresholds]);
  const attention = residents.filter((resident) => resident.rank > 0).sort((a, b) => b.rank - a.rank);
  const roster = [...residents].sort((a, b) => a.row.room.localeCompare(b.row.room, undefined, { numeric: true }));
  const completed = tasks.filter((task) => task.done);
  const remaining = tasks.filter((task) => !task.done);
  const unitNote = anythingElse?.trim();
  const equipment = unitNote === equipmentNote;
  const unitTitle = equipment ? 'Low lift battery in tub room' : unitNote;
  const equipmentDetail = 'Spare charging at nursing station';

  // Serialize only translatable text so changing a checkbox does not restart translation.
  const briefingTexts = JSON.stringify([...new Set([
    unitNote, equipment ? unitTitle : '', equipment ? equipmentDetail : '',
    ...tasks.flatMap((task) => [task.title, task.recorded, task.schedule]),
    ...residents.flatMap(({ row, title, summary, finding, observation, episode }) => [
      row.done?.value, row.notDoneNextShift?.value, title, summary, finding, observation, episode?.nurseComment,
      episode?.resolutionNote,
    ]),
  ].filter((value): value is string => !!value && value !== '—'))]);

  useEffect(() => {
    if (interfaceLanguage === 'en') {
      setIsTranslating(false);
      setShowOriginalEn(false);
      return;
    }
    let cancelled = false;
    const texts: string[] = JSON.parse(briefingTexts);
    const missing = texts.filter((text) => !translationsCache.current.has(interfaceLanguage + '::' + text));
    if (!missing.length) {
      setIsTranslating(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsTranslating(true);
      const translated = await Promise.allSettled(missing.map(async (text) => {
        const result = await translateBidirectional(text, 'en', interfaceLanguage);
        return [interfaceLanguage + '::' + text,
          result?.translatedText?.trim() || getInstantLtcTranslation(text, interfaceLanguage, 'en')] as const;
      }));
      if (cancelled) return;
      const collected: Record<string, string> = {};
      for (const result of translated) {
        if (result.status !== 'fulfilled') continue;
        const [key, value] = result.value;
        translationsCache.current.set(key, value);
        collected[key] = value;
      }
      setTranslations((previous) => ({ ...previous, ...collected }));
      setIsTranslating(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [interfaceLanguage, briefingTexts]);

  useEffect(() => {
    if (!recent) return;
    const timer = setTimeout(() => setRecent(null), 6500);
    return () => clearTimeout(timer);
  }, [recent]);

  const detailTask = details?.kind === 'task' ? tasks.find((item) => item.id === details.id) : undefined;
  const detailResident = details?.kind === 'resident' ? residents.find((item) => item.row.room === details.room) : undefined;
  const hasDetails = Boolean(details && (details.kind !== 'task' || detailTask) &&
    (details.kind !== 'resident' || detailResident));

  useEffect(() => {
    const element = dialog.current;
    if (!hasDetails) {
      if (element?.open) element.close();
      return;
    }
    if (!element?.open) element?.showModal();
    closeButton.current?.focus();
  }, [details, hasDetails]);

  const criterion = codeId ? getCodeConfig(codeId, thresholds.customCodeTiers) : undefined;
  useEffect(() => {
    if (criterion && !criteriaDialog.current?.open) criteriaDialog.current?.showModal();
  }, [criterion]);

  const t = (text: string) => {
    if (!text || interfaceLanguage === 'en') return text;
    return translations[interfaceLanguage + '::' + text] || getInstantLtcTranslation(text, interfaceLanguage, 'en');
  };

  const textWithOriginal = (text: string) => {
    const translated = t(text);
    return <>{translated}{showOriginalEn && translated !== text && <small className="small">EN: {text}</small>}</>;
  };

  const showDetails = (next: Details, trigger?: HTMLElement) => {
    if (trigger && !dialog.current?.open) opener.current = trigger;
    setDetails(next);
  };

  const focusNextTask = () => {
    const pendingButton = workspace.current?.querySelector<HTMLButtonElement>('.taskgroup .tick:not(:disabled)');
    (pendingButton || completedButton.current)?.focus();
  };

  const returnFocus = () => {
    if (opener.current?.isConnected) opener.current.focus();
    else focusNextTask();
  };

  const isMutable = (task: IncomingTask) => !task.pending && !(isLocked && task.requirementId);

  const changeTask = (task: IncomingTask, done: boolean, undo = false) => {
    if (!isMutable(task)) return;
    onSetTaskDone(task, done);
    setRecent(undo ? null : { id: task.id, done });
    setAnnouncement(task.title + (done ? ' completed.' : ' reopened.') + ' Clinical concerns unchanged.');
  };

  const renderTask = (task: IncomingTask) => (
    <div className={'task' + (task.done ? ' done' : '')} key={task.id} data-room={task.room}>
      <button type="button" className="tick" aria-pressed={task.done} disabled={!isMutable(task)}
        aria-label={(task.done ? 'Undo completion: ' : 'Complete ') + t(task.title) + ', room ' + task.room}
        onClick={() => {
          changeTask(task, !task.done);
          requestAnimationFrame(focusNextTask);
        }}>
        <span className="check">{task.done && <Check />}</span>
      </button>
      <button type="button" className="details" aria-haspopup="dialog"
        onClick={(event) => showDetails({ kind: 'task', id: task.id }, event.currentTarget)}>
        <span className="copy">
          <span className="tasktitle">{textWithOriginal(task.title)}</span>
          <span className="small">{task.residentName} · Room {task.room}</span>
        </span>
        <span className="time">{task.clock ? task.schedule : t(task.schedule)}</span>
        <ChevronRight className="chev" />
      </button>
    </div>
  );

  const renderConcern = (resident: IncomingResident) => {
    const { row, codes, status, title, summary, label, notified, unverified } = resident;
    const Icon = codes.includes('C') && title === 'Heel redness does not blanch' ? Bandage
      : status.isBmOverdue ? Clock : codes.includes('C') ? Bandage : codes.includes('H') ? PersonStanding
      : status.isLowFluid && !codes.length ? Droplet : AlertCircle;
    return (
      <button key={row.room} type="button" className="concern" data-room={row.room} aria-haspopup="dialog"
        onClick={(event) => showDetails({ kind: 'resident', room: row.room }, event.currentTarget)}>
        <span className={'symbol' + (status.isUrgent ? ' red' : '')}>
          <Icon className={Icon === Bandage ? 'skin-icon' : undefined} />
        </span>
        <span className="copy">
          <span className="identity"><strong>{row.residentName}</strong> Room {row.room}</span>
          <span className="finding">{textWithOriginal(title)}</span>
          {summary && <span className="small">{textWithOriginal(summary)}</span>}
          <span className={'severity' + (status.isUrgent ? ' red' : '')}>{label} · {notified}</span>
          {unverified && <span className="small">Unverified handoff entries</span>}
        </span>
        <ChevronRight className="chev" />
      </button>
    );
  };

  const renderResident = ({ row, codes, status, label, notified, unverified, finding, observation, episode, rank }: IncomingResident) => {
    const nextShift = row.notDoneNextShift?.value?.trim();
    const residentTasks = tasks.filter((task) => task.room === row.room);
    const labels = status.tier ? TIER_METADATA[status.tier].label : label;
    return (
      <>
        {rank > 0 && <section className="block">
          <h3>Clinical concerns</h3>
          <p>{labels} · {notified}{notified === 'RN notified' && !row.nurseInitials?.isPendingConfirmation && row.nurseInitials?.value
            ? ' (' + row.nurseInitials.value + ')' : ''}</p>
          {unverified && <p className="severity red">Confirm unverified handoff entries with the original record before acting.</p>}
          {finding && <p>{textWithOriginal(finding)}</p>}
          {status.isBmOverdue && <p>{textWithOriginal(row.mltcDetails?.bowelMovement?.value || 'Bowel movement overdue')}</p>}
          {status.isLowFluid && <p>{row.mltcDetails?.fluidIntakeMl?.value} mL recorded</p>}
          {!!codes.length && <div className="flags">
            {codes.map((code) => <StopAndWatchIconBadge key={code} codeId={code} size="sm"
              onClick={() => setCodeId(code)} language={interfaceLanguage} customTiers={thresholds.customCodeTiers} />)}
          </div>}
          {status.tier && <p className="small">Prototype severity tiers are separate from the official INTERACT tool.</p>}
        </section>}
        {observation && <section className="block"><h3>Observations</h3><p>{textWithOriginal(observation)}</p></section>}
        {episode?.nurseComment && <section className="block">
          <h3>Last recorded nurse assessment</h3>
          <p>{textWithOriginal(episode.nurseComment)}</p>
          <p className="sub">{[episode.acknowledgedBy, episode.acknowledgedAt].filter(Boolean).join(' · ')}</p>
        </section>}
        {episode?.resolutionStatus === 'resolved' && <section className="block">
          <h3>Recorded nurse resolution</h3>
          {episode.resolutionNote && <p>{textWithOriginal(episode.resolutionNote)}</p>}
          <p className="sub">{[episode.resolvedBy, episode.resolvedAt].filter(Boolean).join(' · ')}</p>
        </section>}
        <section className="block"><h3>Completed care</h3><p>{textWithOriginal(row.done?.value || '—')}</p></section>
        {((nextShift && nextShift !== '—') || residentTasks.length > 0) && <section className="block">
          <h3>Next shift</h3>
          {nextShift && nextShift !== '—' && <p>{textWithOriginal(nextShift)}</p>}
          {residentTasks.map((task) => <button key={task.id} type="button" className="resident-row"
            onClick={() => showDetails({ kind: 'task', id: task.id })}>
            <span className="copy">{t(task.title)}<small className="small">
              {task.done ? 'Completed' : task.pending ? 'Unverified' : 'Pending'}
            </small></span><ChevronRight className="chev" />
          </button>)}
        </section>}
        <button className="link" type="button" onClick={() => showDetails({ kind: 'residents' })}>
          <Users /> All residents
        </button>
      </>
    );
  };

  const renderTaskDetail = (task: IncomingTask) => (
    <>
      <section className="block">
        <h3>Recorded handoff</h3>
        <p>{textWithOriginal(task.recorded)}</p>
        {task.sourceQuote && task.sourceQuote !== task.recorded && <blockquote className="sub">{task.sourceQuote}</blockquote>}
      </section>
      {task.isVisit && <section className="block"><h3>Context</h3>
        <p>The recorded time is the visit. Follow facility policy and your role when sharing information.</p>
      </section>}
      {task.pending && <p className="severity red">Verify this task in the Handoff Sheet before marking it complete.</p>}
      {isLocked && task.requirementId && <p className="small">This task belongs to a submitted handoff.</p>}
      {task.done && task.completedAt && <p className="small">Completed at {task.completedAt}</p>}
      <button className="link" type="button" onClick={() => showDetails({ kind: 'resident', room: task.room })}>
        Resident details <ChevronRight />
      </button>
      {isMutable(task) && <div className="actions">
        <Button variant="primary" onClick={() => {
          changeTask(task, !task.done);
          dialog.current?.close();
        }}>{task.done ? 'Undo completion' : 'Mark complete'}</Button>
      </div>}
    </>
  );

  const renderDialogBody = () => {
    let title = '';
    let subtitle = '';
    let body: React.ReactNode;
    if (details?.kind === 'residents') {
      title = 'All residents';
      subtitle = roster.length + (roster.length === 1 ? ' resident' : ' residents');
      body = <div className="cb-panel panel">{roster.map((resident) => (
        <button className="resident-row" key={resident.row.room} type="button"
          onClick={() => showDetails({ kind: 'resident', room: resident.row.room })}>
          <span className="copy"><strong>{resident.row.room} · {resident.row.residentName}</strong>
            <span className="small">{resident.rank ? resident.label : 'Per care plan'}</span>
          </span><ChevronRight className="chev" />
        </button>
      ))}</div>;
    } else if (details?.kind === 'unit') {
      title = 'Unit note';
      subtitle = equipment ? 'Equipment' : '';
      body = <section className="block"><h3>Original handoff</h3>
        <p>{textWithOriginal(unitNote)}</p>
        {interfaceLanguage !== 'en' && !showOriginalEn && t(unitNote) !== unitNote && <p className="sub">EN: {unitNote}</p>}
      </section>;
    } else if (details?.kind === 'reset') {
      title = 'Reset demo?';
      subtitle = 'Incoming free-text task progress only';
      body = <div className="actions"><Button variant="primary" onClick={() => {
        onResetTaskProgress();
        setShowCompleted(false);
        setRecent(null);
        setAnnouncement('Incoming task progress reset.');
        dialog.current?.close();
      }}>Reset tasks</Button></div>;
    } else if (detailTask) {
      title = t(detailTask.title);
      subtitle = detailTask.residentName + ' · Room ' + detailTask.room;
      body = renderTaskDetail(detailTask);
    } else if (detailResident) {
      title = detailResident.row.residentName;
      subtitle = 'Room ' + detailResident.row.room;
      body = renderResident(detailResident);
    }
    return <div className="dialogbody">
      <div className="dhead">
        <div><h2 id="incoming-dialog-title">{title}</h2><p className="sub">{subtitle}</p></div>
        <button ref={closeButton} type="button" className="close" aria-label="Close"
          onClick={() => dialog.current?.close()}><X /></button>
      </div>
      {body}
    </div>;
  };

  const recentTask = recent && tasks.find((task) => task.id === recent.id && task.done === recent.done);

  return (
    <div className="incoming-workspace" ref={workspace}>
      <PageHeader title="My shift" subtitle={<span title={header.shift}>
          {header.incomingPsw} · Handoff from {header.outgoingPsw.replace(/,\s*PSW$/i, '')}
        </span>} actions={<>
          {interfaceLanguage !== 'en' && (
            <button className="link" type="button" aria-pressed={showOriginalEn}
              onClick={() => setShowOriginalEn(!showOriginalEn)}>
              {isTranslating && <Loader2 className="cb-pending" />}
              {showOriginalEn ? 'Hide EN' : 'Show EN'}
            </button>
          )}
          <Button aria-haspopup="dialog"
            onClick={(event) => showDetails({ kind: 'residents' }, event.currentTarget)}>
            <Users /> All residents
          </Button>
        </>} />
      {unitNote && <button className="unit" type="button" aria-haspopup="dialog"
        onClick={(event) => showDetails({ kind: 'unit' }, event.currentTarget)}>
        <BatteryLow />
        <span>{equipment ? <><strong>{t(unitTitle)}</strong> · {t(equipmentDetail)}</> : textWithOriginal(unitTitle)}
          {equipment && showOriginalEn && t(unitTitle) !== unitTitle && <small className="small">EN: {unitNote}</small>}
        </span>
        <ChevronRight className="chev" />
      </button>}

      <div className="layout">
        <section className="attention" aria-labelledby="incoming-attention">
          <div className="sectionhead"><h2 id="incoming-attention">Needs attention <span className="count">{attention.length}</span></h2></div>
          <div className="cb-panel panel">
            {attention.length ? attention.map(renderConcern) : <p className="empty">No current clinical concerns.</p>}
          </div>
        </section>
        <section className="tasks" aria-labelledby="incoming-tasks">
          <div className="sectionhead">
            <h2 id="incoming-tasks">My tasks</h2>
            <div className="progress">
              {completed.length} of {tasks.length} done
              <span className="track" aria-hidden="true"><span className="cb-progress-fill" style={{ transform: `scaleX(${tasks.length ? completed.length / tasks.length : 0})` }} /></span>
            </div>
          </div>
          <div className="cb-panel panel">
            {remaining.length ? [
              { title: 'Timed', items: remaining.filter((task) => task.clock) },
              { title: 'Flexible', items: remaining.filter((task) => !task.clock) },
            ].map(({ title, items }) => !!items.length && <section className="taskgroup" aria-label={title} key={title}>
              <h3 className="groupname">{title}</h3>{items.map(renderTask)}
            </section>) : <p className="empty">{tasks.length ? 'All listed handoff tasks complete.' : 'No handoff tasks recorded.'}</p>}
          </div>
          <div className="completed">
            <button ref={completedButton} className="link cb-completed-disclosure" type="button" aria-expanded={showCompleted}
              onClick={() => setShowCompleted(!showCompleted)}>
              <Check /> Completed ({completed.length}) <ChevronRight className="cb-disclosure-icon" aria-hidden="true" />
            </button>
            {showCompleted && <div className="cb-panel panel">
              {completed.length ? completed.map(renderTask) : <p className="empty">No completed tasks yet.</p>}
            </div>}
          </div>
        </section>
      </div>
      <WorkspaceFooter>
        <Button variant="quiet" aria-haspopup="dialog" onClick={(event) => showDetails({ kind: 'reset' }, event.currentTarget)}>
          Reset demo
        </Button>
      </WorkspaceFooter>
      <dialog className="cb-motion-dialog" ref={dialog} aria-labelledby="incoming-dialog-title" onClose={() => {
        setDetails(null);
        setCodeId(null);
        returnFocus();
      }}>
        {hasDetails && renderDialogBody()}
      </dialog>
      {criterion && <dialog ref={criteriaDialog} className="criteria-dialog" aria-label="Stop & Watch criteria"
        onClose={() => setCodeId(null)}>
        <StopAndWatchDetailModal config={criterion} tierMeta={TIER_METADATA[criterion.defaultTier]}
          onClose={() => criteriaDialog.current?.close()} />
      </dialog>}
      {recentTask && isMutable(recentTask) && <StatusToast announce={false}>
        <span>{recent.done ? 'Task completed' : 'Task reopened'}</span>
        <button type="button" onClick={() => {
          changeTask(recentTask, !recent.done, true);
          requestAnimationFrame(focusNextTask);
        }}>Undo</button>
      </StatusToast>}
      <div className="sr-only" role="status">{announcement}</div>
    </div>
  );
};
