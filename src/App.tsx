import { l10n } from './utils/localization';
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Navigation, ScreenTab } from './components/Navigation';
import { ShiftHeaderForm } from './components/ShiftHeaderForm';
import { VoiceControlPanel } from './components/VoiceControlPanel';
import { StopAndWatchLegend } from './components/StopAndWatchLegend';
import { HandoffTable } from './components/HandoffTable';
import { AnythingElseSection } from './components/AnythingElseSection';
import { AlertsPanel } from './components/AlertsPanel';
import { ConfirmSubmitModal } from './components/ConfirmSubmitModal';
import { NurseDashboardView } from './components/NurseDashboardView';
import { EmrView } from './components/EmrView';
import { IncomingShiftView } from './components/IncomingShiftView';
import { SettingsView } from './components/SettingsView';
import { PrintablePaperSheet } from './components/PrintablePaperSheet';
import { ResidentRibbon } from './components/ResidentRibbon';
import { ResidentFocusView } from './components/ResidentFocusView';
import { ResidentEditor, type OpenResidentEditor, type ResidentSection } from './components/ResidentEditor';
import { clearHandoffEditorDrafts } from './utils/handoffEditorDraft';
import { Button, WorkspaceFooter } from './components/WorkspaceUi';
import { interfaceLocale, loadInterfaceLocale, setInterfaceLocale, useInterfaceLanguage } from './utils/localization';
import { useCompactLayout } from './utils/useCompactLayout';
import type { InterfaceLanguage } from './utils/localization';

import {
  HandoffRow,
  ShiftHeader,
  AlertThresholds,
  NurseEscalation,
  EMRRecord,
  AuditLogEntry,
  ExtractedResidentHandoff,
} from './types/handoff';
import {
  DEFAULT_HEADER,
  DEFAULT_THRESHOLDS,
  SEED_HANDOFF_ROWS,
  SEED_ANYTHING_ELSE,
  DemoScenario,
  INITIAL_EMR_HISTORY,
} from './data/seedData';
import { evaluateDeterministicAlerts } from './utils/alerts';
import type { IncomingTask } from './utils/incomingShift';
import { mapStopAndWatchTextToCodeId } from './data/stopAndWatchCodes';
import {
  parseTranscriptToHandoffStream,
  StreamCallbacks,
  extractDynamicRequirementsFromEnglish,
  mergeCareRequirementsIntoRow,
} from './utils/geminiParser';
import {
  CheckCircle,
  RotateCcw,
  FileText,
  CheckCheck,
} from 'lucide-react';

const INITIAL_ESCALATIONS: NurseEscalation[] = [
  {
    id: 'esc-102',
    room: '102',
    residentName: 'Mr. B',
    codes: ['T_talks', 'A_ate'],
    note: 'quieter than usual, ate about half of breakfast',
    timestamp: '11:45',
    outgoingPsw: 'J. Santos, PSW',
    status: 'acknowledged',
    resolutionStatus: 'monitoring',
    acknowledgedBy: 'K. Lewis, RN',
    acknowledgedAt: '11:50',
    nurseComment: 'Noted; monitor intake at lunch and encourage fluids.',
  },
  {
    id: 'esc-104',
    room: '104',
    residentName: 'Mr. D',
    codes: ['H'],
    note: 'needed 2 people to transfer at lunch, usually 1',
    timestamp: '12:30',
    outgoingPsw: 'J. Santos, PSW',
    status: 'pending',
  },
  {
    id: 'esc-106',
    room: '106',
    residentName: 'Mr. F',
    codes: ['D', 'C'],
    note: 'drank less (550 mL), red area on left heel',
    timestamp: '13:15',
    outgoingPsw: 'J. Santos, PSW',
    status: 'acknowledged',
    resolutionStatus: 'monitoring',
    acknowledgedBy: 'K. Lewis, RN',
    acknowledgedAt: '13:20',
    nurseComment: 'Assessed heel redness; pressure-relieving boot applied.',
  },
];

function formatShortNurseInitials(nurseName: string): string {
  const trimmed = nurseName.trim();
  if (!trimmed) return 'RN (KL)';
  if (/^RN\b/i.test(trimmed)) return trimmed;
  const namePart = trimmed.split(',')[0].trim();
  const tokens = namePart.replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const initials = `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
    return `RN (${initials})`;
  }
  return `RN (${namePart})`;
}

const STORAGE_KEY = 'carebridge_handoff_state_v1';
const DEFAULT_CHARGE_NURSE = 'K. Lewis, RN';

const EMPTY_INCOMING_PROGRESS: Record<string, string> = {};

interface PersistedHandoffState {
  incomingTaskProgress?: Record<string, Record<string, string>>;
  selectedResidentRoom?: string | 'all';
  interfaceLanguage?: InterfaceLanguage;
  header?: ShiftHeader;
  chargeNurse?: string;
  rows?: HandoffRow[];
  anythingElse?: string;
  thresholds?: AlertThresholds;
  isLocked?: boolean;
  escalations?: NurseEscalation[];
  emrRecords?: EMRRecord[];
}

function loadPersistedState(): PersistedHandoffState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PersistedHandoffState;
  } catch {
    return {};
  }
}

export function readInterfacePreference(): InterfaceLanguage {
  return interfaceLocale(loadPersistedState().interfaceLanguage);
}

export default function App() {
  const initialPersisted = useMemo(() => loadPersistedState(), []);

  const [currentTab, setCurrentTab] = useState<ScreenTab>('handoff');
  const [showUnitNotes, setShowUnitNotes] = useState(false);
  const [residentEdit, setResidentEdit] = useState<{ room: string; section: ResidentSection; changeNote?: boolean } | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentTab]);
  const [selectedResidentRoom, setSelectedResidentRoom] = useState<string | 'all'>(
    initialPersisted.selectedResidentRoom || '102'
  );
  const compactLayout = useCompactLayout();
  const residentHeading = useRef<HTMLHeadingElement>(null);
  const interfaceLanguage = useInterfaceLanguage();
  const localeRequest = useRef(0);
  const [localeError, setLocaleError] = useState(false);
  const changeInterfaceLanguage = async (language: InterfaceLanguage) => {
    const request = ++localeRequest.current;
    setLocaleError(false);
    try {
      await loadInterfaceLocale(language);
      if (request === localeRequest.current) setInterfaceLocale(language);
    } catch {
      if (request === localeRequest.current) setLocaleError(true);
    }
  };

  const [header, setHeader] = useState<ShiftHeader>(
    initialPersisted.header && initialPersisted.header.unit ? initialPersisted.header : DEFAULT_HEADER
  );
  const [chargeNurse, setChargeNurse] = useState(() =>
    typeof initialPersisted.chargeNurse === 'string' && initialPersisted.chargeNurse.trim()
      ? initialPersisted.chargeNurse.trim() : DEFAULT_CHARGE_NURSE
  );
  const [rows, setRows] = useState<HandoffRow[]>(
    Array.isArray(initialPersisted.rows) && initialPersisted.rows.length > 0
      ? initialPersisted.rows
      : SEED_HANDOFF_ROWS
  );
  const [anythingElse, setAnythingElse] = useState<string>(
    typeof initialPersisted.anythingElse === 'string'
      ? initialPersisted.anythingElse
      : SEED_ANYTHING_ELSE
  );
  const [thresholds, setThresholds] = useState<AlertThresholds>(
    initialPersisted.thresholds && typeof initialPersisted.thresholds.fluidIntakeMinMl === 'number'
      ? initialPersisted.thresholds
      : DEFAULT_THRESHOLDS
  );
  const [isLocked, setIsLocked] = useState<boolean>(Boolean(initialPersisted.isLocked));
  const [resetVersion, setResetVersion] = useState<number>(0);
  const [incomingTaskProgress, setIncomingTaskProgress] = useState(
    initialPersisted.incomingTaskProgress || {}
  );
  const incomingShiftKey = JSON.stringify([header.unit, header.date, header.shift]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const headerRef = useRef(header);
  headerRef.current = header;
  const recentUtterancesRef = useRef<string[]>([]);

  // Live voice & transcript state
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [transcriptLanguage, setTranscriptLanguage] = useState<string>();
  const [translatedTranscript, setTranslatedTranscript] = useState<string>('');
  const [translationConfidence, setTranslationConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const [openQuestions, setOpenQuestions] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [unassignedExtractions, setUnassignedExtractions] = useState<ExtractedResidentHandoff[]>([]);
  const [lastAutoFilledRooms, setLastAutoFilledRooms] = useState<string[]>([]);

  // Modals, drawers & inline confirmation
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [printIsBlank, setPrintIsBlank] = useState<boolean>(false);

  // Escalations to Charge Nurse
  const [escalations, setEscalations] = useState<NurseEscalation[]>(
    Array.isArray(initialPersisted.escalations) ? initialPersisted.escalations : INITIAL_ESCALATIONS
  );

  // Simulated EMR records
  const [emrRecords, setEmrRecords] = useState<EMRRecord[]>(
    Array.isArray(initialPersisted.emrRecords) && initialPersisted.emrRecords.length > 0
      ? initialPersisted.emrRecords
      : INITIAL_EMR_HISTORY
  );

  // Persist shift workspace across browser reloads
  useEffect(() => {
    try {
      const payload: PersistedHandoffState = {
        incomingTaskProgress,
        selectedResidentRoom,
        interfaceLanguage,
        header,
        chargeNurse,
        rows,
        anythingElse,
        thresholds,
        isLocked,
        escalations,
        emrRecords,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota or storage restriction errors
    }
  }, [
    incomingTaskProgress,
    selectedResidentRoom,
    interfaceLanguage,
    header,
    chargeNurse,
    rows,
    anythingElse,
    thresholds,
    isLocked,
    escalations,
    emrRecords,
  ]);

  // Evaluate deterministic alerts
  const alerts = useMemo(() => {
    return evaluateDeterministicAlerts(rows, thresholds);
  }, [rows, thresholds, interfaceLanguage]);

  // Count pending nurse escalations for navigation badge
  const pendingNurseCount = useMemo(() => {
    return escalations.filter((e) => e.status === 'pending').length;
  }, [escalations]);

  // Count pending confirmation fields across all residents
  const totalPendingCount = useMemo(() => {
    return rows.reduce((sum, r) => {
      let c = 0;
      if (r.done?.isPendingConfirmation) c++;
      if (r.notDoneNextShift?.isPendingConfirmation) c++;
      if (r.changeNote?.isPendingConfirmation) c++;
      if (r.changeCodes?.isPendingConfirmation) c++;
      if (r.mltcDetails.fluidIntakeMl?.isPendingConfirmation) c++;
      if (r.mltcDetails.weightKg?.isPendingConfirmation) c++;
      if (r.mltcDetails.bowelMovement?.isPendingConfirmation) c++;
      if (r.mltcDetails.qualitativeObservations?.isPendingConfirmation) c++;
      c += (r.careRequirements || []).filter((req) => req.isPendingConfirmation).length;
      return sum + c;
    }, 0);
  }, [rows]);

  // Handle updating a single row & keeping escalations synchronized cleanly
  const handleUpdateRow = (room: string, updated: Partial<HandoffRow>) => {
    const existingRow = rowsRef.current.find((r) => r.room === room);
    const mergedRow = existingRow ? { ...existingRow, ...updated } : null;

    setRows((prev) =>
      prev.map((r) => (r.room === room ? { ...r, ...updated } : r))
    );

    if (
      mergedRow &&
      (updated.toldNurse !== undefined ||
        updated.changeCodes !== undefined ||
        updated.changeNote !== undefined ||
        updated.nurseInitials !== undefined)
    ) {
      const codes = mergedRow.changeCodes?.value || [];
      const hasCodes = codes.length > 0;
      const nowTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      setEscalations((prevEsc) => {
        const existingEsc = prevEsc.find((e) => e.room === room);

        if (!hasCodes) {
          if (updated.changeCodes !== undefined && existingEsc) {
            return prevEsc.filter((e) => e.room !== room);
          }
          return prevEsc;
        }

        const isNotified = Boolean(mergedRow.toldNurse?.value);
        const noteVal =
          mergedRow.changeNote?.value && mergedRow.changeNote.value !== 'No change'
            ? mergedRow.changeNote.value
            : mergedRow.mltcDetails?.qualitativeObservations?.value || '';

        if (existingEsc) {
          return prevEsc.map((e) => {
            if (e.room !== room) return e;

            if (updated.toldNurse !== undefined) {
              if (isNotified) {
                return {
                  ...e,
                  codes,
                  note: noteVal || e.note,
                  status: 'acknowledged',
                  resolutionStatus: e.resolutionStatus || 'monitoring',
                  acknowledgedBy:
                    e.acknowledgedBy ||
                    mergedRow.nurseInitials?.value ||
                    'RN (KL)',
                  acknowledgedAt: e.acknowledgedAt || nowTime,
                };
              }
              return {
                ...e,
                codes,
                note: noteVal || e.note,
                status: 'pending',
                resolutionStatus: undefined,
                acknowledgedBy: undefined,
                acknowledgedAt: undefined,
                resolvedBy: undefined,
                resolvedAt: undefined,
                resolutionNote: undefined,
              };
            }

            return {
              ...e,
              codes,
              note: updated.changeNote !== undefined ? noteVal || e.note : e.note,
            };
          });
        }

        return [
          ...prevEsc,
          {
            id: `esc-${room}-${Date.now()}`,
            room: mergedRow.room,
            residentName: mergedRow.residentName,
            codes,
            note: noteVal,
            timestamp: nowTime,
            outgoingPsw: headerRef.current.outgoingPsw,
            status: isNotified ? 'acknowledged' : 'pending',
            resolutionStatus: isNotified ? 'monitoring' : undefined,
            acknowledgedBy: isNotified
              ? mergedRow.nurseInitials?.value || 'RN (KL)'
              : undefined,
            acknowledgedAt: isNotified ? nowTime : undefined,
          },
        ];
      });
    }
  };

  // Accept a single cell
  const handleAcceptCell = (
    room: string,
    field: 'done' | 'notDoneNextShift' | 'changeNote' | 'changeCodes' | 'mltc'
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.room !== room) return r;
        if (field === 'done') {
          return { ...r, done: { ...r.done, isPendingConfirmation: false } };
        }
        if (field === 'notDoneNextShift') {
          return {
            ...r,
            notDoneNextShift: { ...r.notDoneNextShift, isPendingConfirmation: false },
            careRequirements: (r.careRequirements || []).map((req) => ({
              ...req,
              isPendingConfirmation: false,
            })),
          };
        }
        if (field === 'changeNote' || field === 'changeCodes') {
          return {
            ...r,
            changeNote: { ...r.changeNote, isPendingConfirmation: false },
            changeCodes: { ...r.changeCodes, isPendingConfirmation: false },
          };
        }
        if (field === 'mltc') {
          return {
            ...r,
            mltcDetails: {
              ...r.mltcDetails,
              fluidIntakeMl: { ...r.mltcDetails.fluidIntakeMl, isPendingConfirmation: false },
              weightKg: { ...r.mltcDetails.weightKg, isPendingConfirmation: false },
              bowelMovement: { ...r.mltcDetails.bowelMovement, isPendingConfirmation: false },
              qualitativeObservations: {
                ...r.mltcDetails.qualitativeObservations,
                isPendingConfirmation: false,
              },
            },
          };
        }
        return r;
      })
    );
  };

  // Reject a single cell
  const handleRejectCell = (
    room: string,
    field: 'done' | 'notDoneNextShift' | 'changeNote' | 'changeCodes' | 'mltc'
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.room !== room) return r;
        if (field === 'done') {
          return { ...r, done: { value: 'Per care plan', isPendingConfirmation: false } };
        }
        if (field === 'notDoneNextShift') {
          return {
            ...r,
            notDoneNextShift: { value: '—', isPendingConfirmation: false },
            careRequirements: (r.careRequirements || []).filter(
              (req) => !req.isPendingConfirmation
            ),
          };
        }
        if (field === 'changeNote' || field === 'changeCodes') {
          return {
            ...r,
            changeNote: { value: 'No change', isPendingConfirmation: false },
            changeCodes: { value: [], isPendingConfirmation: false },
          };
        }
        if (field === 'mltc') {
          return {
            ...r,
            mltcDetails: {
              ...r.mltcDetails,
              fluidIntakeMl: { ...r.mltcDetails.fluidIntakeMl, isPendingConfirmation: false },
              weightKg: { ...r.mltcDetails.weightKg, isPendingConfirmation: false },
              bowelMovement: { ...r.mltcDetails.bowelMovement, isPendingConfirmation: false },
              qualitativeObservations: {
                ...r.mltcDetails.qualitativeObservations,
                isPendingConfirmation: false,
              },
            },
          };
        }
        return r;
      })
    );
  };

  // Accept all pending fields
  const handleAcceptAllPending = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        done: { ...r.done, isPendingConfirmation: false },
        notDoneNextShift: { ...r.notDoneNextShift, isPendingConfirmation: false },
        changeCodes: { ...r.changeCodes, isPendingConfirmation: false },
        changeNote: { ...r.changeNote, isPendingConfirmation: false },
        careRequirements: (r.careRequirements || []).map((req) => ({
          ...req,
          isPendingConfirmation: false,
        })),
        mltcDetails: {
          ...r.mltcDetails,
          fluidIntakeMl: { ...r.mltcDetails.fluidIntakeMl, isPendingConfirmation: false },
          weightKg: { ...r.mltcDetails.weightKg, isPendingConfirmation: false },
          bowelMovement: { ...r.mltcDetails.bowelMovement, isPendingConfirmation: false },
          qualitativeObservations: {
            ...r.mltcDetails.qualitativeObservations,
            isPendingConfirmation: false,
          },
        },
      }))
    );
  };

  // Process spoken or pasted transcript via Gemini API (Streaming & Fast Flash Model)
  const handleProcessTranscript = useCallback(
    async (
      transcriptText: string,
      language: string,
      callbacks?: StreamCallbacks,
      speechEndTime?: number,
      targetLanguage?: string
    ) => {
      setLiveTranscript(transcriptText);
      setIsProcessing(true);

      try {
        const result = await parseTranscriptToHandoffStream(
          transcriptText,
          language,
          rowsRef.current,
          callbacks,
          recentUtterancesRef.current,
          speechEndTime,
          targetLanguage
        );

        // Keep last 2 utterances for minimal context
        recentUtterancesRef.current = [...recentUtterancesRef.current.slice(-1), transcriptText];

        setTranscriptLanguage(result.detectedSourceLanguage || language);
        setTranslatedTranscript(result.translatedTranscript !== transcriptText.trim() ? result.translatedTranscript : '');
        setTranslationConfidence(result.translationConfidence);
        setRows(result.updatedRows);
        setUnassignedExtractions(result.unassignedExtractions || []);
        setLastAutoFilledRooms(result.matchedRooms || []);
        if (result.anythingElse) {
          setAnythingElse(result.anythingElse);
        }
        setOpenQuestions(result.openQuestions);

        // Sync Stop & Watch escalations cleanly from updated rows
        const nowTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        setEscalations((prev) => {
          let next = [...prev];
          result.updatedRows.forEach((r) => {
            const codes = r.changeCodes?.value || [];
            const existingIdx = next.findIndex((e) => e.room === r.room);
            if (codes.length > 0) {
              const noteVal =
                r.changeNote?.value && r.changeNote.value !== 'No change'
                  ? r.changeNote.value
                  : r.mltcDetails?.qualitativeObservations?.value || '';
              if (existingIdx >= 0) {
                next[existingIdx] = {
                  ...next[existingIdx],
                  codes,
                  note: noteVal || next[existingIdx].note,
                };
              } else {
                const isNotified = Boolean(r.toldNurse?.value);
                next.push({
                  id: `esc-${r.room}-${Date.now()}`,
                  room: r.room,
                  residentName: r.residentName,
                  codes,
                  note: noteVal,
                  timestamp: nowTime,
                  outgoingPsw: headerRef.current.outgoingPsw,
                  status: isNotified ? 'acknowledged' : 'pending',
                  resolutionStatus: isNotified ? 'monitoring' : undefined,
                  acknowledgedBy: isNotified
                    ? r.nurseInitials?.value || 'RN (KL)'
                    : undefined,
                  acknowledgedAt: isNotified ? nowTime : undefined,
                });
              }
            }
          });
          return next;
        });

        return result;
      } catch (err) {
        console.error('Failed to parse transcript:', err);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  // One-tap assignment for unassigned translations
  const handleAssignExtraction = (index: number, targetRoom: string | 'unit_note') => {
    const item = unassignedExtractions[index];
    if (!item) return;

    if (targetRoom === 'unit_note') {
      const noteLine =
        item.general_observation_note ||
        item.care_requirements.map((r) => `${r.category}: ${r.action_item}`).join('; ');
      setAnythingElse((prev) => (prev ? `${prev} ${noteLine}` : noteLine));
    } else {
      const mappedCodeIds = item.stop_and_watch_codes
        .map((c) => mapStopAndWatchTextToCodeId(c))
        .filter((c): c is string => Boolean(c));

      const nextTasksSummary = item.care_requirements
        .map((r) => `[${r.category}] ${r.action_item}`)
        .join('; ');

      setRows((prev) =>
        prev.map((r) => {
          if (r.room !== targetRoom) return r;
          const mergedCodes = Array.from(
            new Set([...(r.changeCodes?.value || []), ...mappedCodeIds])
          );
          const mergedReqs = mergeCareRequirementsIntoRow(
            r.careRequirements,
            item.care_requirements,
            item.general_observation_note,
            true,
            header.outgoingPsw
          );
          return {
            ...r,
            notDoneNextShift: nextTasksSummary
              ? {
                  value: nextTasksSummary,
                  isPendingConfirmation: true,
                  sourceQuote: item.general_observation_note,
                  confidence: 'high',
                }
              : r.notDoneNextShift,
            changeCodes:
              mergedCodes.length > 0
                ? {
                    value: mergedCodes,
                    isPendingConfirmation: true,
                    sourceQuote: item.general_observation_note,
                    confidence: 'high',
                  }
                : r.changeCodes,
            changeNote:
              item.general_observation_note
                ? {
                    value: item.general_observation_note,
                    isPendingConfirmation: true,
                    sourceQuote: item.general_observation_note,
                  }
                : r.changeNote,
            careRequirements: mergedReqs,
            mltcDetails: {
              ...r.mltcDetails,
              qualitativeObservations: item.general_observation_note
                ? {
                    value: item.general_observation_note,
                    isPendingConfirmation: true,
                    sourceQuote: item.general_observation_note,
                  }
                : r.mltcDetails.qualitativeObservations,
            },
          };
        })
      );

      setLastAutoFilledRooms((prev) =>
        prev.includes(targetRoom) ? prev : [...prev, targetRoom]
      );

      if (mappedCodeIds.length > 0) {
        const matchedResident = rows.find((r) => r.room === targetRoom);
        if (matchedResident) {
          setEscalations((prev) => {
            if (prev.some((e) => e.room === targetRoom)) return prev;
            return [
              ...prev,
              {
                id: `esc-${targetRoom}-${Date.now()}`,
                room: targetRoom,
                residentName: matchedResident.residentName,
                codes: mappedCodeIds,
                note: item.general_observation_note || nextTasksSummary,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                outgoingPsw: header.outgoingPsw,
                status: 'pending',
              },
            ];
          });
        }
      }
    }

    setUnassignedExtractions((prev) => prev.filter((_, i) => i !== index));
    if (unassignedExtractions.length <= 1) {
      setOpenQuestions([]);
    }
  };

  const handleDismissExtraction = (index: number) => {
    setUnassignedExtractions((prev) => prev.filter((_, i) => i !== index));
  };

  // Load a demo scenario
  const handleLoadScenario = (scenario: DemoScenario) => {
    setLiveTranscript(scenario.rawTranscript);
    setTranscriptLanguage(scenario.language);
    setTranslatedTranscript(scenario.expectedTranslation);
    setTranslationConfidence('high');
    setOpenQuestions([]);
    setUnassignedExtractions([]);
    setLastAutoFilledRooms(scenario.extractedChanges.map((c) => c.room));

    setRows((prev) =>
      prev.map((r) => {
        const found = scenario.extractedChanges.find((c) => c.room === r.room);
        if (found) {
          const dynReqs = extractDynamicRequirementsFromEnglish(
            [found.done, found.notDone, found.changeNote, found.observations].filter(Boolean).join('. ')
          ).careRequirements;
          const mergedReqs = mergeCareRequirementsIntoRow(
            r.careRequirements,
            dynReqs,
            found.sourceQuote,
            true,
            header.outgoingPsw
          );

          return {
            ...r,
            done: {
              value: found.done,
              isPendingConfirmation: true,
              sourceQuote: found.sourceQuote,
            },
            notDoneNextShift: {
              value: found.notDone,
              isPendingConfirmation: true,
              sourceQuote: found.sourceQuote,
            },
            changeCodes: {
              value: found.changeCodes,
              isPendingConfirmation: found.changeCodes.length > 0,
              sourceQuote: found.sourceQuote,
            },
            changeNote: {
              value: found.changeNote,
              isPendingConfirmation: found.changeCodes.length > 0,
              sourceQuote: found.sourceQuote,
            },
            toldNurse: {
              value: found.changeCodes.length > 0,
              isPendingConfirmation: true,
            },
            nurseInitials: {
              value: found.changeCodes.length > 0 ? 'RN (KL)' : '',
              isPendingConfirmation: false,
            },
            careRequirements: mergedReqs,
            mltcDetails: {
              ...r.mltcDetails,
              fluidIntakeMl: {
                value: found.fluidMl || r.mltcDetails.fluidIntakeMl?.value || null,
                isPendingConfirmation: true,
              },
              qualitativeObservations: {
                value: found.observations,
                isPendingConfirmation: true,
                sourceQuote: found.sourceQuote,
              },
            },
          };
        }
        return r;
      })
    );

    if (scenario.anythingElse) {
      setAnythingElse(scenario.anythingElse);
    }

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    setEscalations((prev) => {
      let next = [...prev];
      scenario.extractedChanges.forEach((found) => {
        if (found.changeCodes.length === 0) return;
        const idx = next.findIndex((e) => e.room === found.room);
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            codes: found.changeCodes,
            note: found.changeNote || next[idx].note,
            status: 'acknowledged',
            resolutionStatus: next[idx].resolutionStatus || 'monitoring',
            acknowledgedBy: next[idx].acknowledgedBy || 'K. Lewis, RN',
            acknowledgedAt: next[idx].acknowledgedAt || nowTime,
          };
        } else {
          next.push({
            id: `esc-${found.room}-${Date.now()}`,
            room: found.room,
            residentName: found.residentName,
            codes: found.changeCodes,
            note: found.changeNote,
            timestamp: nowTime,
            outgoingPsw: header.outgoingPsw,
            status: 'acknowledged',
            resolutionStatus: 'monitoring',
            acknowledgedBy: 'K. Lewis, RN',
            acknowledgedAt: nowTime,
          });
        }
      });
      return next;
    });
  };

  // Reset to initial clean state
  const handleClearSheet = () => {
    clearHandoffEditorDrafts();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setHeader(DEFAULT_HEADER);
    setChargeNurse(DEFAULT_CHARGE_NURSE);
    setRows(SEED_HANDOFF_ROWS);
    setAnythingElse(SEED_ANYTHING_ELSE);
    setIncomingTaskProgress({});
    setThresholds(DEFAULT_THRESHOLDS);
    setEscalations(INITIAL_ESCALATIONS);
    setEmrRecords(INITIAL_EMR_HISTORY);
    setLiveTranscript('');
    setTranslatedTranscript('');
    setOpenQuestions([]);
    setUnassignedExtractions([]);
    setLastAutoFilledRooms([]);
    setIsLocked(false);
    setConfirmReset(false);
    setResetVersion((v) => v + 1);
  };

  const handleSetIncomingTaskDone = (task: IncomingTask, done: boolean) => {
    if (task.requirementId) {
      if (isLocked) return;
      setRows((previous) => previous.map((row) => {
        if (row.room !== task.room) return row;
        return {
          ...row,
          careRequirements: row.careRequirements?.map((requirement) =>
            requirement.id === task.requirementId &&
            JSON.stringify([row.room, requirement.id, requirement.action_item.trim()]) === task.id &&
            !requirement.isPendingConfirmation
              ? { ...requirement, completed: done, lastEditedBy: header.incomingPsw }
              : requirement
          ),
        };
      }));
      return;
    }

    const note = rowsRef.current.find((row) => row.room === task.room)?.notDoneNextShift;
    if (!note?.value || note.isPendingConfirmation ||
        JSON.stringify([task.room, note.value.trim()]) !== task.id) return;
    setIncomingTaskProgress((previous) => {
      const current = { ...previous[incomingShiftKey] };
      if (done) {
        current[task.id] = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        delete current[task.id];
      }
      return { ...previous, [incomingShiftKey]: current };
    });
  };

  const handleResetIncomingTaskProgress = () => {
    setIncomingTaskProgress((previous) => {
      const next = { ...previous };
      delete next[incomingShiftKey];
      return next;
    });
  };

  // Quick action from alert panel
  const handleMarkPerCarePlan = (room: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.room === room ? { ...r, done: { value: 'Per care plan', isPendingConfirmation: false } } : r
      )
    );
  };

  const handleQuickNotifyNurse = (room: string) => {
    handleUpdateRow(room, {
      toldNurse: { value: true, isPendingConfirmation: false },
      nurseInitials: { value: 'RN (KL)', isPendingConfirmation: false },
    });
  };

  const handleAnswerQuestion = (question: string, answer: string) => {
    setOpenQuestions((prev) => prev.filter((q) => q !== question));
    const updated = liveTranscript ? `${liveTranscript} [Clarification]: ${answer}` : answer;
    handleProcessTranscript(updated, 'en');
  };

  // Charge Nurse acknowledges escalation (optionally resolves immediately)
  const handleAcknowledgeEscalation = (
    id: string,
    nurseComment: string,
    nurseName: string,
    resolveImmediately: boolean = false
  ) => {
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const targetEsc = escalations.find((e) => e.id === id);

    setEscalations((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'acknowledged',
              resolutionStatus: resolveImmediately ? 'resolved' : 'monitoring',
              acknowledgedBy: nurseName,
              acknowledgedAt: nowTime,
              nurseComment,
              resolvedBy: resolveImmediately ? nurseName : undefined,
              resolvedAt: resolveImmediately ? nowTime : undefined,
            }
          : e
      )
    );

    if (targetEsc) {
      const shortInitials = formatShortNurseInitials(nurseName);
      setRows((prev) =>
        prev.map((r) =>
          r.room === targetEsc.room
            ? {
                ...r,
                toldNurse: { value: true, isPendingConfirmation: false },
                nurseInitials: { value: shortInitials, isPendingConfirmation: false },
              }
            : r
        )
      );
    }
  };

  // Charge Nurse updates existing assessment note
  const handleUpdateEscalationNote = (id: string, nurseComment: string) => {
    setEscalations((prev) =>
      prev.map((e) => (e.id === id ? { ...e, nurseComment } : e))
    );
  };

  // Charge Nurse marks an acknowledged case clinically resolved
  const handleResolveEscalation = (
    id: string,
    nurseName: string,
    resolutionNote?: string
  ) => {
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const targetEsc = escalations.find((e) => e.id === id);

    setEscalations((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'acknowledged',
              resolutionStatus: 'resolved',
              acknowledgedBy: e.acknowledgedBy || nurseName,
              acknowledgedAt: e.acknowledgedAt || nowTime,
              resolvedBy: nurseName,
              resolvedAt: nowTime,
              resolutionNote: resolutionNote || e.resolutionNote,
            }
          : e
      )
    );

    if (targetEsc) {
      const shortInitials = formatShortNurseInitials(nurseName);
      setRows((prev) =>
        prev.map((r) =>
          r.room === targetEsc.room && !r.toldNurse?.value
            ? {
                ...r,
                toldNurse: { value: true, isPendingConfirmation: false },
                nurseInitials: { value: shortInitials, isPendingConfirmation: false },
              }
            : r
        )
      );
    }
  };

  // Charge Nurse reopens a resolved case back to active monitoring
  const handleReopenEscalation = (id: string) => {
    setEscalations((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'acknowledged',
              resolutionStatus: 'monitoring',
              resolvedBy: undefined,
              resolvedAt: undefined,
              resolutionNote: undefined,
            }
          : e
      )
    );
  };

  // Confirm and Submit handoff
  const handleConfirmAndSubmit = (overrideReason?: string) => {
    setIsLocked(true);
    setIsConfirmModalOpen(false);

    const confirmedRows = rows.map((r) => ({
      ...r,
      done: { ...r.done, isPendingConfirmation: false },
      notDoneNextShift: { ...r.notDoneNextShift, isPendingConfirmation: false },
      changeCodes: { ...r.changeCodes, isPendingConfirmation: false },
      changeNote: { ...r.changeNote, isPendingConfirmation: false },
      careRequirements: (r.careRequirements || []).map((req) => ({
        ...req,
        isPendingConfirmation: false,
      })),
      mltcDetails: {
        ...r.mltcDetails,
        fluidIntakeMl: { ...r.mltcDetails.fluidIntakeMl, isPendingConfirmation: false },
        weightKg: { ...r.mltcDetails.weightKg, isPendingConfirmation: false },
        bowelMovement: { ...r.mltcDetails.bowelMovement, isPendingConfirmation: false },
        qualitativeObservations: {
          ...r.mltcDetails.qualitativeObservations,
          isPendingConfirmation: false,
        },
      },
    }));

    setRows(confirmedRows);

    const auditTrail: AuditLogEntry[] = [
      {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        actor: header.outgoingPsw,
        role: 'Outgoing PSW',
        action: 'Spoken / Written Care Ingestion',
        details: 'Structured via CareBridge Voice-to-Checklist Assistant.',
      },
      {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        actor: header.outgoingPsw,
        role: 'Outgoing PSW',
        action: 'Human Verification & Confirmation',
        details: `Confirmed ${confirmedRows.length} residents.${overrideReason ? ` Override Reason: "${overrideReason}"` : ''}`,
      },
    ];

    const newRecord: EMRRecord = {
      id: `emr-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      header,
      rows: confirmedRows,
      anythingElse,
      escalations,
      rawTranscript: liveTranscript,
      transcriptLanguage,
      translatedTranscript,
      auditTrail,
      submittedBy: header.outgoingPsw,
      overrideReason,
    };

    setEmrRecords((prev) => [newRecord, ...prev]);
    setCurrentTab('incoming');
  };

  // Trigger print paper sheet
  const handlePrintPaperFallback = (blank: boolean = false) => {
    setPrintIsBlank(blank);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const focusedRow = rows.find((r) => r.room === selectedResidentRoom) || rows[0];
  const editorRow = residentEdit && rows.find((row) => row.room === residentEdit.room);
  const openResidentEditor: OpenResidentEditor = (room, section, trigger, changeNote) => {
    if (isLocked) return;
    trigger.focus({ preventScroll: true });
    setResidentEdit({ room, section, changeNote });
  };
  const unitNotesAction = (
    <Button aria-haspopup="dialog" onClick={(event) => {
      event.currentTarget.focus({ preventScroll: true });
      setShowUnitNotes(true);
    }}><FileText aria-hidden="true" /> {l10n("Unit notes")}</Button>
  );

  return (
    <div className="cb-app">
      <Navigation
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        pendingNurseEscalationsCount={pendingNurseCount}
        shiftHeader={header}
        chargeNurse={chargeNurse}
        onPrintPaperFallback={() => handlePrintPaperFallback(true)}
        interfaceLanguage={interfaceLanguage}
        onLanguageChange={changeInterfaceLanguage}
      />
      {localeError && <p className="cb-wrap cb-page-subtitle" role="status">
        {l10n('Could not load this language. Try again.')}
      </p>}

      <main className="cb-wrap cb-main no-print">
        {/* TAB 1: Main Handoff Sheet */}
        {currentTab === 'handoff' && (
          <div className="cb-handoff">
            <div className="cb-handoff-content">
              {/* Persistent Shift Context Bar */}
              <ShiftHeaderForm
                header={header}
                onChange={setHeader}
                isLocked={isLocked}
              />

              {/* Locked notification banner if already submitted */}
              {isLocked && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-950">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold">{l10n("Handoff submitted to the simulated archive.")}</span>{" " + l10n("Sheet is locked for audit integrity.")}
                    </div>
                  </div>
                  <button
                    onClick={() => setIsLocked(false)}
                    className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-semibold text-xs hover:bg-emerald-50 cursor-pointer transition-colors"
                  >
                    {l10n("Unlock for Edits")}
                  </button>
                </div>
              )}

              {/* Unified Report Entry Bar (Single-Resident Isolated or Unit-Wide) */}
              {!isLocked && (
                <VoiceControlPanel
                  onProcessTranscript={handleProcessTranscript}
                  isProcessing={isProcessing}
                  liveTranscript={liveTranscript}
                  translatedTranscript={translatedTranscript}
                  translationConfidence={translationConfidence}
                  openQuestions={openQuestions}
                  onLoadScenario={handleLoadScenario}
                  onClearSheet={handleClearSheet}
                  onAnswerQuestion={handleAnswerQuestion}
                  silenceBufferSeconds={thresholds.silenceBufferSeconds ?? 0.8}
                  rows={rows}
                  onSelectResident={(room) => setSelectedResidentRoom(room)}
                  unassignedExtractions={unassignedExtractions}
                  onAssignExtraction={handleAssignExtraction}
                  onDismissExtraction={handleDismissExtraction}
                  lastAutoFilledRooms={lastAutoFilledRooms}
                  onOpenGuide={() => setIsGuideOpen(true)}
                  focusedRow={selectedResidentRoom !== 'all' ? focusedRow : null}
                  staffStamp={header.outgoingPsw}
                  onUpdateRow={handleUpdateRow}
                  interfaceLanguage={interfaceLanguage}
                  resetVersion={resetVersion}
                  toolbarActions={unitNotesAction}
                />
              )}

              {isLocked && unitNotesAction}

              {/* Deterministic Clinical Safety & Documentation Alerts */}
              <AlertsPanel
                alerts={alerts}
                onMarkPerCarePlan={handleMarkPerCarePlan}
                onQuickNotifyNurse={handleQuickNotifyNurse}
                onSelectResident={(room) => {
                  setSelectedResidentRoom(room);
                  if (compactLayout) requestAnimationFrame(() => {
                    residentHeading.current?.focus({ preventScroll: true });
                    residentHeading.current?.scrollIntoView({ block: 'start' });
                  });
                }}
                rows={rows}
                thresholds={thresholds}
                escalations={escalations}
                isLocked={isLocked}
              />

              {/* Master-Detail Split Workspace */}
              <div className="cb-handoff-grid">
                {/* Left Master Roster Rail */}
                <div className="cb-handoff-rail">
                  <ResidentRibbon
                    rows={rows}
                    selectedRoom={selectedResidentRoom}
                    onSelectResident={setSelectedResidentRoom}
                    customCodeTiers={thresholds.customCodeTiers}
                    thresholds={thresholds}

                  />
                </div>

                {/* Right Detail Workspace */}
                <div className="cb-resident-workspace">
                  {selectedResidentRoom !== 'all' ? (
                    <ResidentFocusView
                      key={focusedRow.room}
                      headingRef={compactLayout ? residentHeading : undefined}
                      row={focusedRow}
                      allRows={rows}
                      onUpdateRow={handleUpdateRow}
                      onEdit={openResidentEditor}
                      onSelectResident={setSelectedResidentRoom}
                      staffStamp={header.outgoingPsw}

                      interfaceLanguage={interfaceLanguage}
                      customCodeTiers={thresholds.customCodeTiers}
                      thresholds={thresholds}
                      isLocked={isLocked}
                    />
                  ) : (
                    <HandoffTable
                      rows={rows}
                      onUpdateRow={handleUpdateRow}
                      onEdit={openResidentEditor}
                      onAcceptAllPending={handleAcceptAllPending}
                      onAcceptCell={handleAcceptCell}
                      onRejectCell={handleRejectCell}
                      isLocked={isLocked}
                      customTiers={thresholds.customCodeTiers}
                      thresholds={thresholds}
                      onSelectResident={setSelectedResidentRoom}

                      interfaceLanguage={interfaceLanguage}
                    />
                  )}

                </div>
              </div>
            </div>

            <WorkspaceFooter sticky>
              {confirmReset ? (
                <div className="cb-page-actions">
                  <span>{l10n("Reset all entries?")}</span>
                  <Button variant="danger" onClick={handleClearSheet}>{l10n("Confirm Reset")}</Button>
                  <Button onClick={() => setConfirmReset(false)}>{l10n("Cancel")}</Button>
                </div>
              ) : (
                <Button variant="quiet" onClick={() => setConfirmReset(true)}><RotateCcw />{" " + l10n("Reset")}</Button>
              )}
              {totalPendingCount > 0 && !isLocked && (
                <Button onClick={handleAcceptAllPending}><CheckCheck />{" " + l10n("Accept pending (")}{totalPendingCount})</Button>
              )}
              <Button variant="primary" onClick={() => setIsConfirmModalOpen(true)} disabled={isLocked}>
                <CheckCircle />{" " + l10n("Review handoff")}
              </Button>
            </WorkspaceFooter>
          </div>
        )}

        {/* TAB 2: Charge Nurse Dashboard */}
        {currentTab === 'nurse' && (
          <div>
            <NurseDashboardView
              key={resetVersion}
              onResetDemo={handleClearSheet}
              escalations={escalations}
              rows={rows}
              thresholds={thresholds}
              nurseName={chargeNurse}
              onNurseNameChange={setChargeNurse}
              customCodeTiers={thresholds.customCodeTiers}
              onAcknowledgeEscalation={handleAcknowledgeEscalation}
              onUpdateEscalationNote={handleUpdateEscalationNote}
              onResolveEscalation={handleResolveEscalation}
              onReopenEscalation={handleReopenEscalation}
              onCreateEscalationFromWatch={(room, note, codes, nurseComment, nurseName, resolveImmediately) => {
                const matchedRow = rows.find((r) => r.room === room);
                if (!matchedRow) return;
                const nowTime = new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const shortInitials = formatShortNurseInitials(nurseName);
                const newEsc: NurseEscalation = {
                  id: `esc-${room}-${Date.now()}`,
                  room,
                  residentName: matchedRow.residentName,
                  codes,
                  note,
                  timestamp: nowTime,
                  outgoingPsw: header.outgoingPsw,
                  status: 'acknowledged',
                  resolutionStatus: resolveImmediately ? 'resolved' : 'monitoring',
                  acknowledgedBy: nurseName,
                  acknowledgedAt: nowTime,
                  nurseComment,
                  resolvedBy: resolveImmediately ? nurseName : undefined,
                  resolvedAt: resolveImmediately ? nowTime : undefined,
                };
                setEscalations((prev) => {
                  if (prev.some((e) => e.room === room && e.resolutionStatus !== 'resolved')) {
                    return prev;
                  }
                  return [newEsc, ...prev];
                });
                setRows((prev) =>
                  prev.map((r) =>
                    r.room === room
                      ? {
                          ...r,
                          toldNurse: { value: true, isPendingConfirmation: false },
                          nurseInitials: { value: shortInitials, isPendingConfirmation: false },
                        }
                      : r
                  )
                );
              }}
              onOpenResidentInHandoff={(room) => {
                setSelectedResidentRoom(room);
                setCurrentTab('handoff');
              }}
            />
          </div>
        )}

        {/* TAB 3: Incoming Shift View */}
        {currentTab === 'incoming' && (
          <div>
            <IncomingShiftView
              key={incomingShiftKey}
              rows={rows}
              anythingElse={anythingElse}
              thresholds={thresholds}
              escalations={escalations}
              noteCompletions={incomingTaskProgress[incomingShiftKey] || EMPTY_INCOMING_PROGRESS}
              isLocked={isLocked}
              onSetTaskDone={handleSetIncomingTaskDone}
              onResetTaskProgress={handleResetIncomingTaskProgress}
              interfaceLanguage={interfaceLanguage}
            />
          </div>
        )}

        {/* TAB 4: Simulated EMR View */}
        {currentTab === 'emr' && (
          <div>
            <EmrView
              records={emrRecords}
              interfaceLanguage={interfaceLanguage}
            />
          </div>
        )}

        {/* TAB 5: Settings & About */}
        {currentTab === 'settings' && (
          <div>
            <SettingsView
              thresholds={thresholds}
              onUpdateThresholds={setThresholds}
              onPrintPaperFallback={() => handlePrintPaperFallback(true)}
            />
          </div>
        )}
      </main>

      {currentTab === 'handoff' && showUnitNotes && <AnythingElseSection value={anythingElse} onChange={setAnythingElse}
        onClose={() => setShowUnitNotes(false)} isLocked={isLocked} />}
      {currentTab === 'handoff' && residentEdit && editorRow && !isLocked && <ResidentEditor key={editorRow.room}
        row={editorRow} initialSection={residentEdit.section} editChangeNote={residentEdit.changeNote}
        staffStamp={header.outgoingPsw} language={interfaceLanguage} thresholds={thresholds}
        onSave={(patch) => handleUpdateRow(editorRow.room, patch)} onClose={() => setResidentEdit(null)} />}

      {/* Stop & Watch Clinical Reference Drawer */}
      <StopAndWatchLegend
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Confirmation & Submission Modal */}
      <ConfirmSubmitModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        header={header}
        rows={rows}
        anythingElse={anythingElse}
        alerts={alerts}
        customCodeTiers={thresholds.customCodeTiers}
        onConfirmAndSubmit={handleConfirmAndSubmit}
        onGoToResident={(room) => {
          setIsConfirmModalOpen(false);
          setCurrentTab('handoff');
          setSelectedResidentRoom(room);
        }}
      />

      {/* Print Fallback Paper Sheet (Hidden on screen, renders only when printing) */}
      <PrintablePaperSheet
        header={header}
        rows={rows}
        anythingElse={anythingElse}
        isBlank={printIsBlank}
      />
    </div>
  );
}
