import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Languages,
  AlertCircle,
  HelpCircle,
  Volume2,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Copy,
  Check,
  RefreshCw,
  ArrowLeftRight,
  Loader2,
  UserPlus,
  ListChecks,
  CheckCircle2,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { useSupportedLanguages } from '../utils/languagesClient';
import { DEMO_SCENARIOS, DemoScenario } from '../data/seedData';
import {
  TranscriptSegment,
  HandoffRow,
  ExtractedResidentHandoff,
  ClinicalTranscriptionRecord,
} from '../types/handoff';
import { translateBidirectional, detectLanguage } from '../utils/translator';
import {
  clinicalTranscribeSingleResident,
  mergeCareRequirementsIntoRow,
} from '../utils/geminiParser';
import { StopAndWatchIconBadge, findCodeIdFromFlagText } from './StopAndWatchIconBadge';
import { InterfaceLanguage } from '../utils/uiTranslations';

interface VoiceControlPanelProps {
  onProcessTranscript: (
    text: string,
    language: string,
    callbacks?: {
      onFirstToken?: (ttft: number) => void;
      onEarlyTranslation?: (text: string) => void;
    },
    speechEndTime?: number,
    targetLanguage?: string
  ) => Promise<any>;
  isProcessing: boolean;
  liveTranscript: string;
  translatedTranscript: string;
  translationConfidence: 'high' | 'medium' | 'low';
  openQuestions: string[];
  onLoadScenario: (scenario: DemoScenario) => void;
  onClearSheet: () => void;
  onAnswerQuestion: (question: string, answer: string) => void;
  silenceBufferSeconds?: number;
  rows?: HandoffRow[];
  onSelectResident?: (room: string) => void;
  unassignedExtractions?: ExtractedResidentHandoff[];
  onAssignExtraction?: (index: number, targetRoom: string | 'unit_note') => void;
  onDismissExtraction?: (index: number) => void;
  lastAutoFilledRooms?: string[];
  onOpenGuide?: () => void;
  focusedRow?: HandoffRow | null;
  staffStamp?: string;
  onUpdateRow?: (room: string, updated: Partial<HandoffRow>) => void;
  interfaceLanguage?: InterfaceLanguage;
  resetVersion?: number;
}

const VOICE_DRAFTS_STORAGE_KEY = 'carebridge_voice_drafts_v1';
const VOICE_SEGMENTS_STORAGE_KEY = 'carebridge_voice_segments_v1';
const VOICE_EXPANDED_STORAGE_KEY = 'carebridge_voice_expanded_v1';

interface ScopeDraft {
  inputText: string;
  liveTranslationText: string;
  detectedSourceLanguage: string | null;
  selectedLanguage: string;
  targetLanguage: string;
}

function getScopeKey(scope: 'resident' | 'unit', room?: string | null): string {
  return scope === 'resident' && room ? `resident:${room}` : 'unit';
}

function loadStoredDrafts(): Record<string, ScopeDraft> {
  try {
    const raw = window.sessionStorage.getItem(VOICE_DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredDrafts(drafts: Record<string, ScopeDraft>) {
  try {
    window.sessionStorage.setItem(VOICE_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // ignore storage errors
  }
}

function loadStoredSegments(): TranscriptSegment[] {
  try {
    const raw = window.sessionStorage.getItem(VOICE_SEGMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  onProcessTranscript,
  isProcessing: externalProcessing,
  liveTranscript: _liveTranscript,
  translatedTranscript: _translatedTranscript,
  translationConfidence: _translationConfidence,
  openQuestions,
  onLoadScenario,
  onClearSheet: _onClearSheet,
  onAnswerQuestion,
  silenceBufferSeconds = 0.8,
  rows = [],
  onSelectResident,
  unassignedExtractions = [],
  onAssignExtraction,
  onDismissExtraction,
  lastAutoFilledRooms = [],
  onOpenGuide,
  focusedRow = null,
  staffStamp = 'J. Santos, PSW',
  onUpdateRow,
  interfaceLanguage = 'en',
  resetVersion = 0,
}) => {
  const {
    priorityLanguages,
    otherLanguages,
    isLoading: isLoadingLanguages,
    getLanguageByCode,
  } = useSupportedLanguages();

  const initialScope: 'resident' | 'unit' = focusedRow ? 'resident' : 'unit';
  const initialScopeKey = getScopeKey(initialScope, focusedRow?.room);
  const initialDrafts = useRef<Record<string, ScopeDraft>>(loadStoredDrafts());
  const initialScopeDraft = initialDrafts.current[initialScopeKey];

  const [selectedLanguage, setSelectedLanguage] = useState(
    initialScopeDraft?.selectedLanguage || 'en'
  );
  const [targetLanguage, setTargetLanguage] = useState(
    initialScopeDraft?.targetLanguage || 'en'
  );
  const [showTwoWayTarget, setShowTwoWayTarget] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => {
    if (initialScopeDraft?.inputText?.trim()) return true;
    try {
      return window.sessionStorage.getItem(VOICE_EXPANDED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [reportScope, setReportScope] = useState<'resident' | 'unit'>(initialScope);
  const [showSegments, setShowSegments] = useState(false);

  // Audio / Speech State
  const [isListening, setIsListening] = useState(false);
  const [secondsListening, setSecondsListening] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interimText, setInterimText] = useState('');
  const [speaking, setSpeaking] = useState(false);

  // Transcript & Translation State (strictly isolated per resident / unit scope)
  const [inputText, setInputText] = useState(initialScopeDraft?.inputText || '');
  const [liveTranslationText, setLiveTranslationText] = useState(
    initialScopeDraft?.liveTranslationText || ''
  );
  const [detectedSourceLanguage, setDetectedSourceLanguage] = useState<string | null>(
    initialScopeDraft?.detectedSourceLanguage || null
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExtractingSingle, setIsExtractingSingle] = useState(false);
  const [pendingSingleRecord, setPendingSingleRecord] = useState<ClinicalTranscriptionRecord | null>(null);
  const [appliedResidentNotice, setAppliedResidentNotice] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'source' | 'target' | string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>(() => loadStoredSegments());

  // Demo Scenarios dropdown
  const [activeScenarioOpen, setActiveScenarioOpen] = useState(false);

  // Clarification response
  const [answeringQuestionIndex, setAnsweringQuestionIndex] = useState<number | null>(null);
  const [questionAnswerText, setQuestionAnswerText] = useState('');

  // Refs
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const selectedLanguageRef = useRef(selectedLanguage);
  const targetLanguageRef = useRef(targetLanguage);
  const accumulatedTranscriptRef = useRef(initialScopeDraft?.inputText || '');
  const untranslatedBufferRef = useRef('');
  const silenceTimerRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const typingDebounceTimerRef = useRef<any>(null);
  const onProcessTranscriptRef = useRef(onProcessTranscript);
  const silenceBufferSecondsRef = useRef(silenceBufferSeconds);
  const scenarioDropdownRef = useRef<HTMLDivElement | null>(null);
  const effectiveScopeRef = useRef<'resident' | 'unit'>(initialScope);
  const focusedRowRef = useRef<HandoffRow | null>(focusedRow);
  const prevFocusedRoomRef = useRef<string | null>(focusedRow?.room || null);
  const activeScopeKeyRef = useRef<string>(initialScopeKey);
  const draftsByScopeRef = initialDrafts;
  const lastResetVersionRef = useRef<number>(resetVersion);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const effectiveScope: 'resident' | 'unit' =
    focusedRow && reportScope === 'resident' ? 'resident' : 'unit';
  const effectiveScopeKey = getScopeKey(effectiveScope, focusedRow?.room);

  useEffect(() => {
    effectiveScopeRef.current = effectiveScope;
    focusedRowRef.current = focusedRow;
  }, [effectiveScope, focusedRow]);

  // Persist active draft continuously so tab switches never lose in-progress notes
  useEffect(() => {
    if (activeScopeKeyRef.current !== effectiveScopeKey) return;
    draftsByScopeRef.current[effectiveScopeKey] = {
      inputText,
      liveTranslationText,
      detectedSourceLanguage,
      selectedLanguage,
      targetLanguage,
    };
    saveStoredDrafts(draftsByScopeRef.current);
  }, [
    effectiveScopeKey,
    inputText,
    liveTranslationText,
    detectedSourceLanguage,
    selectedLanguage,
    targetLanguage,
  ]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(VOICE_SEGMENTS_STORAGE_KEY, JSON.stringify(segments));
    } catch {
      // ignore
    }
  }, [segments]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(VOICE_EXPANDED_STORAGE_KEY, String(isExpanded));
    } catch {
      // ignore
    }
  }, [isExpanded]);

  // Default back to resident scope whenever clicking a different room in the rail
  useEffect(() => {
    const nextRoom = focusedRow?.room || null;
    if (prevFocusedRoomRef.current !== nextRoom) {
      prevFocusedRoomRef.current = nextRoom;
      setReportScope(nextRoom ? 'resident' : 'unit');
    }
  }, [focusedRow?.room]);

  // Strictly isolate drafts, translation preview, and mic capture whenever scope changes
  useEffect(() => {
    const prevKey = activeScopeKeyRef.current;
    if (prevKey === effectiveScopeKey) return;

    if (typingDebounceTimerRef.current) {
      clearTimeout(typingDebounceTimerRef.current);
      typingDebounceTimerRef.current = null;
    }

    // Stop active speech recognition before switching scope to prevent cross-resident dictation
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      untranslatedBufferRef.current = '';
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    }

    draftsByScopeRef.current[prevKey] = {
      inputText,
      liveTranslationText,
      detectedSourceLanguage,
      selectedLanguage,
      targetLanguage,
    };

    const nextDraft = draftsByScopeRef.current[effectiveScopeKey];
    activeScopeKeyRef.current = effectiveScopeKey;

    setInputText(nextDraft?.inputText || '');
    accumulatedTranscriptRef.current = nextDraft?.inputText || '';
    untranslatedBufferRef.current = '';
    setLiveTranslationText(nextDraft?.liveTranslationText || '');
    setDetectedSourceLanguage(nextDraft?.detectedSourceLanguage || null);
    setSelectedLanguage(nextDraft?.selectedLanguage || 'en');
    selectedLanguageRef.current = nextDraft?.selectedLanguage || 'en';
    setTargetLanguage(nextDraft?.targetLanguage || 'en');
    targetLanguageRef.current = nextDraft?.targetLanguage || 'en';
    setInterimText('');
    setPendingSingleRecord(null);
    setAppliedResidentNotice(null);

    saveStoredDrafts(draftsByScopeRef.current);
  }, [
    effectiveScopeKey,
    inputText,
    liveTranslationText,
    detectedSourceLanguage,
    selectedLanguage,
    targetLanguage,
  ]);

  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    targetLanguageRef.current = targetLanguage;
  }, [targetLanguage]);

  useEffect(() => {
    silenceBufferSecondsRef.current = silenceBufferSeconds;
  }, [silenceBufferSeconds]);

  useEffect(() => {
    onProcessTranscriptRef.current = onProcessTranscript;
  }, [onProcessTranscript]);

  // Close scenario dropdown on outside click or Escape
  useEffect(() => {
    if (!activeScenarioOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        scenarioDropdownRef.current &&
        !scenarioDropdownRef.current.contains(e.target as Node)
      ) {
        setActiveScenarioOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveScenarioOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [activeScenarioOpen]);

  // Clear all local & stored drafts when global Reset is confirmed
  useEffect(() => {
    if (lastResetVersionRef.current !== resetVersion) {
      lastResetVersionRef.current = resetVersion;
      draftsByScopeRef.current = {};
      try {
        window.sessionStorage.removeItem(VOICE_DRAFTS_STORAGE_KEY);
        window.sessionStorage.removeItem(VOICE_SEGMENTS_STORAGE_KEY);
        window.sessionStorage.removeItem(VOICE_EXPANDED_STORAGE_KEY);
      } catch {
        // ignore
      }
      setIsExpanded(false);
      setInputText('');
      setLiveTranslationText('');
      setDetectedSourceLanguage(null);
      setInterimText('');
      setSegments([]);
      setPendingSingleRecord(null);
      setAppliedResidentNotice(null);
      setSelectedLanguage('en');
      selectedLanguageRef.current = 'en';
      setTargetLanguage('en');
      targetLanguageRef.current = 'en';
      accumulatedTranscriptRef.current = '';
      untranslatedBufferRef.current = '';
    }
  }, [resetVersion]);

  const stopAudioAnalysis = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAudioAnalysis = useCallback(async () => {
    try {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round(avg * 1.5)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (e) {
      console.warn('Microphone audio level analyzer not supported or denied:', e);
    }
  }, []);

  const processAndTranslate = useCallback(
    async (text: string, sourceLang: string, targetLang: string) => {
      if (!text.trim()) return;

      // Single-resident isolated path: translate live and wait for explicit Extract / Review
      if (effectiveScopeRef.current === 'resident' && focusedRowRef.current) {
        setIsTranslating(true);
        try {
          const trans = await translateBidirectional(text.trim(), sourceLang, targetLang);
          if (trans?.translatedText) setLiveTranslationText(trans.translatedText);
          if (trans?.detectedSourceLanguage) setDetectedSourceLanguage(trans.detectedSourceLanguage);
        } catch (err) {
          console.warn('Single-resident translation notice:', err);
        } finally {
          setIsTranslating(false);
        }
        return;
      }

      setIsTranslating(true);

      const segId = `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newSeg: TranscriptSegment = {
        id: segId,
        originalText: text.trim(),
        translatedText: '',
        translatedEnglish: '',
        isTranslating: true,
        language: sourceLang,
        targetLanguage: targetLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSegments((prev) => [newSeg, ...prev]);

      try {
        const result = await onProcessTranscriptRef.current(
          text.trim(),
          sourceLang,
          {
            onEarlyTranslation: (early) => {
              setLiveTranslationText(early);
              setSegments((prev) =>
                prev.map((s) =>
                  s.id === segId ? { ...s, translatedText: early, translatedEnglish: early } : s
                )
              );
            },
          },
          Date.now(),
          targetLang
        );

        if (result && result.translatedTranscript) {
          setLiveTranslationText(result.translatedTranscript);
          if (result.detectedSourceLanguage) {
            setDetectedSourceLanguage(result.detectedSourceLanguage);
          }
          setSegments((prev) =>
            prev.map((s) =>
              s.id === segId
                ? {
                    ...s,
                    translatedText: result.translatedTranscript,
                    translatedEnglish: result.translatedTranscript,
                    isTranslating: false,
                    confidence: result.translationConfidence || 'high',
                    needsCheck: Boolean(result.needsTranslationCheck),
                    detectedSourceLanguage: result.detectedSourceLanguage,
                  }
                : s
            )
          );
        } else {
          const trans = await translateBidirectional(text.trim(), sourceLang, targetLang);
          setLiveTranslationText(trans.translatedText);
          if (trans.detectedSourceLanguage) {
            setDetectedSourceLanguage(trans.detectedSourceLanguage);
          }
          setSegments((prev) =>
            prev.map((s) =>
              s.id === segId
                ? {
                    ...s,
                    translatedText: trans.translatedText,
                    translatedEnglish: trans.translatedText,
                    isTranslating: false,
                    confidence: trans.confidence,
                    detectedSourceLanguage: trans.detectedSourceLanguage,
                  }
                : s
            )
          );
        }
      } catch (err) {
        console.error('Translation error:', err);
        try {
          const trans = await translateBidirectional(text.trim(), sourceLang, targetLang);
          setLiveTranslationText(trans.translatedText);
          setSegments((prev) =>
            prev.map((s) =>
              s.id === segId
                ? {
                    ...s,
                    translatedText: trans.translatedText,
                    translatedEnglish: trans.translatedText,
                    isTranslating: false,
                    detectedSourceLanguage: trans.detectedSourceLanguage,
                  }
                : s
            )
          );
        } catch {
          setSegments((prev) =>
            prev.map((s) => (s.id === segId ? { ...s, isTranslating: false, needsCheck: true } : s))
          );
        }
      } finally {
        setIsTranslating(false);
      }
    },
    []
  );

  const flushFinalBuffer = useCallback(() => {
    const textToProcess = untranslatedBufferRef.current.trim();
    if (!textToProcess) return;

    untranslatedBufferRef.current = '';
    const srcLang = selectedLanguageRef.current;
    const tgtLang = targetLanguageRef.current;

    processAndTranslate(textToProcess, srcLang, tgtLang);
  }, [processAndTranslate]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const langObj = getLanguageByCode(selectedLanguage);
    recognition.lang = langObj.code === 'auto' ? 'en-CA' : langObj.speechCode;

    recognition.onresult = (event: any) => {
      let currentFinal = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i][0];
        if (event.results[i].isFinal) {
          currentFinal += item.transcript + ' ';
        } else {
          currentInterim += item.transcript;
        }
      }

      setInterimText(currentInterim);

      if (currentFinal.trim().length > 0) {
        untranslatedBufferRef.current = (untranslatedBufferRef.current + ' ' + currentFinal).trim();
        accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + ' ' + currentFinal).trim();
        setInputText(accumulatedTranscriptRef.current);

        const hasSentenceEnding = /[.?!।。！？]\s*$/.test(currentFinal.trim());

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (hasSentenceEnding) {
          flushFinalBuffer();
        } else {
          const waitMs = Math.round((silenceBufferSecondsRef.current || 0.8) * 1000);
          silenceTimerRef.current = setTimeout(() => {
            flushFinalBuffer();
          }, waitMs);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition notice:', event.error);
      const err = event.error;

      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setErrorMessage(
          'Microphone permission is blocked. Allow microphone access in your browser, or type/paste notes directly.'
        );
        isListeningRef.current = false;
        setIsListening(false);
        stopAudioAnalysis();
      } else if (err === 'network') {
        setErrorMessage(
          'Network issue with speech recognition. Type or paste notes directly.'
        );
        isListeningRef.current = false;
        setIsListening(false);
        stopAudioAnalysis();
      } else if (err === 'audio-capture') {
        setErrorMessage('No microphone detected. Check your audio input device.');
        isListeningRef.current = false;
        setIsListening(false);
        stopAudioAnalysis();
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          const currentLangObj = getLanguageByCode(selectedLanguageRef.current);
          recognition.lang = currentLangObj.code === 'auto' ? 'en-CA' : currentLangObj.speechCode;
          recognition.start();
        } catch (e) {
          console.warn('Recognition restart notice:', e);
        }
      } else {
        setIsListening(false);
        stopAudioAnalysis();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis, flushFinalBuffer, selectedLanguage, getLanguageByCode]);

  const handleLanguageChange = (newLangCode: string) => {
    setSelectedLanguage(newLangCode);
    selectedLanguageRef.current = newLangCode;
    const currentLangObj = getLanguageByCode(newLangCode);
    const newSpeechCode = currentLangObj.code === 'auto' ? 'en-CA' : currentLangObj.speechCode;

    if (recognitionRef.current) {
      recognitionRef.current.lang = newSpeechCode;

      if (isListeningRef.current) {
        flushFinalBuffer();
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.lang = newSpeechCode;
              recognitionRef.current.start();
            } catch (e) {
              console.warn('Restart after language change:', e);
            }
          }
        }, 150);
      }
    }
  };

  const handleSwapLanguages = () => {
    const prevSource = selectedLanguage;
    const prevTarget = targetLanguage;

    handleLanguageChange(prevTarget);
    setTargetLanguage(prevSource);
    targetLanguageRef.current = prevSource;

    if (liveTranslationText) {
      const prevInput = inputText;
      setInputText(liveTranslationText);
      accumulatedTranscriptRef.current = liveTranslationText;
      setLiveTranslationText(prevInput);
    }
  };

  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsExpanded(true);
      setErrorMessage(
        'Speech recognition is not supported in this browser. Type or paste shift notes directly below.'
      );
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      stopAudioAnalysis();

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      flushFinalBuffer();

      try {
        if (recognitionRef.current) recognitionRef.current.stop();
      } catch {
        // ignore
      }

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    } else {
      setIsExpanded(true);
      setErrorMessage(null);
      setSecondsListening(0);

      try {
        if (!recognitionRef.current) {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          const currentLangObj = getLanguageByCode(selectedLanguage);
          rec.lang = currentLangObj.code === 'auto' ? 'en-CA' : currentLangObj.speechCode;
          recognitionRef.current = rec;
        }

        const currentLangObj = getLanguageByCode(selectedLanguage);
        recognitionRef.current.lang = currentLangObj.code === 'auto' ? 'en-CA' : currentLangObj.speechCode;

        isListeningRef.current = true;
        setIsListening(true);
        recognitionRef.current.start();
        startAudioAnalysis();

        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
          setSecondsListening((s) => s + 1);
        }, 1000);
      } catch (err: any) {
        console.error('Failed to start speech recognition:', err);
        if (err.name === 'InvalidStateError') {
          setIsListening(true);
          isListeningRef.current = true;
        } else {
          setErrorMessage(`Could not start listening: ${err.message || 'Speech initialization error'}`);
          setIsListening(false);
          isListeningRef.current = false;
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    setAppliedResidentNotice(null);
    accumulatedTranscriptRef.current = val;

    if (typingDebounceTimerRef.current) {
      clearTimeout(typingDebounceTimerRef.current);
    }

    if (!val.trim()) {
      setLiveTranslationText('');
      setDetectedSourceLanguage(null);
      return;
    }

    let effectiveSrc = selectedLanguage;
    if (selectedLanguage === 'en') {
      const detected = detectLanguage(val);
      if (detected !== 'en' && detected !== selectedLanguage) {
        effectiveSrc = detected;
        handleLanguageChange(detected);
      }
    }

    typingDebounceTimerRef.current = setTimeout(async () => {
      try {
        setIsTranslating(true);
        const res = await translateBidirectional(val.trim(), effectiveSrc, targetLanguage);
        if (res && res.translatedText) {
          setLiveTranslationText(res.translatedText);
          if (res.detectedSourceLanguage) {
            setDetectedSourceLanguage(res.detectedSourceLanguage);
          }
        }
      } catch (err) {
        console.warn('Debounced translation preview note:', err);
      } finally {
        setIsTranslating(false);
      }
    }, 500);
  };

  // Extract either for the isolated active resident or across the unit
  const handleManualSubmit = async () => {
    const raw = inputText.trim() || liveTranslationText.trim();
    if (!raw) return;

    if (effectiveScope === 'resident' && focusedRow) {
      setIsExtractingSingle(true);
      setAppliedResidentNotice(null);
      try {
        const englishHint =
          targetLanguage === 'en' && liveTranslationText.trim()
            ? liveTranslationText.trim()
            : selectedLanguage === 'en' && inputText.trim()
            ? inputText.trim()
            : undefined;

        const res = await clinicalTranscribeSingleResident(
          raw,
          `${focusedRow.residentName} (Room ${focusedRow.room})`,
          staffStamp,
          new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
          selectedLanguage,
          englishHint
        );
        setPendingSingleRecord(res);
      } catch (err) {
        console.error('Single-resident extraction error:', err);
        setErrorMessage('Could not extract note. Try again or enter directly below.');
      } finally {
        setIsExtractingSingle(false);
      }
      return;
    }

    await processAndTranslate(raw, selectedLanguage, targetLanguage);
  };

  const handleConfirmSingleExtraction = () => {
    if (!pendingSingleRecord || !focusedRow || !onUpdateRow) return;

    const existingCodes = focusedRow.changeCodes?.value || [];
    const newCodes = [...existingCodes];
    (pendingSingleRecord.stop_and_watch_flags || []).forEach((flag) => {
      const detectedId = findCodeIdFromFlagText(flag);
      if (detectedId && !newCodes.includes(detectedId)) {
        newCodes.push(detectedId);
      }
    });

    const updatedCare =
      pendingSingleRecord.care_completed &&
      pendingSingleRecord.care_completed !== 'Per care plan routine'
        ? pendingSingleRecord.care_completed
        : focusedRow.done?.value || pendingSingleRecord.care_completed;

    const updatedNotes =
      pendingSingleRecord.additional_observations ||
      focusedRow.mltcDetails?.qualitativeObservations?.value ||
      '';

    const updatedPending =
      pendingSingleRecord.pending_tasks_for_next_shift &&
      pendingSingleRecord.pending_tasks_for_next_shift !== 'Routine follow-up next shift'
        ? pendingSingleRecord.pending_tasks_for_next_shift
        : focusedRow.notDoneNextShift?.value || pendingSingleRecord.pending_tasks_for_next_shift;

    const updatedReqs = mergeCareRequirementsIntoRow(
      focusedRow.careRequirements || [],
      pendingSingleRecord.care_requirements || [],
      pendingSingleRecord.raw_transcript,
      false,
      staffStamp
    );

    onUpdateRow(focusedRow.room, {
      done: {
        value: updatedCare,
        isPendingConfirmation: false,
        sourceQuote: pendingSingleRecord.raw_transcript,
        lastEditedBy: staffStamp,
      },
      changeNote: {
        value: updatedNotes || (newCodes.length > 0 ? 'Noted changes' : 'No change'),
        isPendingConfirmation: false,
        sourceQuote: pendingSingleRecord.raw_transcript,
        lastEditedBy: staffStamp,
      },
      notDoneNextShift: {
        value: updatedPending,
        isPendingConfirmation: false,
        sourceQuote: pendingSingleRecord.raw_transcript,
        lastEditedBy: staffStamp,
      },
      changeCodes: {
        value: newCodes,
        isPendingConfirmation: false,
        sourceQuote: pendingSingleRecord.raw_transcript,
        lastEditedBy: staffStamp,
      },
      careRequirements: updatedReqs,
      mltcDetails: {
        ...focusedRow.mltcDetails,
        qualitativeObservations: {
          value: updatedNotes,
          isPendingConfirmation: false,
          sourceQuote: pendingSingleRecord.raw_transcript,
        },
      },
    });

    setAppliedResidentNotice(`Saved to Rm ${focusedRow.room} · ${focusedRow.residentName}`);
    setPendingSingleRecord(null);
    setInputText('');
    setLiveTranslationText('');
    accumulatedTranscriptRef.current = '';
    const rKey = getScopeKey('resident', focusedRow.room);
    delete draftsByScopeRef.current[rKey];
    saveStoredDrafts(draftsByScopeRef.current);
  };

  const handleRetranslate = (segment: TranscriptSegment) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segment.id ? { ...s, isTranslating: true, needsCheck: false } : s))
    );
    processAndTranslate(
      segment.originalText,
      segment.language,
      segment.targetLanguage || targetLanguageRef.current
    );
  };

  const handleSpeakText = (text: string, langCode: string) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const langObj = getLanguageByCode(langCode);
    if (langObj && langObj.code !== 'auto') utterance.lang = langObj.speechCode;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleCopyText = (fieldId: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSelectScenario = (sc: DemoScenario) => {
    // Save outgoing resident draft before switching to unit scope for scenario
    if (activeScopeKeyRef.current !== 'unit') {
      draftsByScopeRef.current[activeScopeKeyRef.current] = {
        inputText,
        liveTranslationText,
        detectedSourceLanguage,
        selectedLanguage,
        targetLanguage,
      };
    }

    draftsByScopeRef.current['unit'] = {
      inputText: sc.rawTranscript,
      liveTranslationText: sc.expectedTranslation,
      detectedSourceLanguage: sc.language,
      selectedLanguage: sc.language,
      targetLanguage: 'en',
    };
    saveStoredDrafts(draftsByScopeRef.current);
    activeScopeKeyRef.current = 'unit';

    setReportScope('unit');
    setPendingSingleRecord(null);
    setAppliedResidentNotice(null);
    setSelectedLanguage(sc.language);
    selectedLanguageRef.current = sc.language;
    setTargetLanguage('en');
    targetLanguageRef.current = 'en';

    setInputText(sc.rawTranscript);
    accumulatedTranscriptRef.current = sc.rawTranscript;
    setLiveTranslationText(sc.expectedTranslation);
    setDetectedSourceLanguage(sc.language);
    setActiveScenarioOpen(false);
    setIsExpanded(true);

    const demoSeg: TranscriptSegment = {
      id: `demo_${Date.now()}`,
      originalText: sc.rawTranscript,
      translatedText: sc.expectedTranslation,
      translatedEnglish: sc.expectedTranslation,
      isTranslating: false,
      language: sc.language,
      targetLanguage: 'en',
      detectedSourceLanguage: sc.language,
      confidence: 'high',
      needsCheck: false,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSegments([demoSeg]);

    onLoadScenario(sc);
  };

  const handleQuestionSubmit = (_idx: number, q: string) => {
    if (!questionAnswerText.trim()) return;
    onAnswerQuestion(q, questionAnswerText.trim());
    setAnsweringQuestionIndex(null);
    setQuestionAnswerText('');
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentSourceObj = getLanguageByCode(selectedLanguage);
  const currentTargetObj = getLanguageByCode(targetLanguage);
  const hasActionItems =
    unassignedExtractions.length > 0 ||
    (openQuestions && openQuestions.length > 0) ||
    Boolean(pendingSingleRecord);
  const showDrawer =
    isExpanded || isListening || hasActionItems || Boolean(errorMessage) || Boolean(appliedResidentNotice);
  const showTranslationPane =
    showTwoWayTarget ||
    selectedLanguage !== 'en' ||
    targetLanguage !== 'en' ||
    (Boolean(detectedSourceLanguage) &&
      detectedSourceLanguage !== 'en' &&
      detectedSourceLanguage !== 'und');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 space-y-3">
      {/* Unified Single-Row Report Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Microphone Control */}
          <button
            type="button"
            onClick={toggleListening}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap active:scale-[0.98] ${
              isListening
                ? 'bg-rose-700 hover:bg-rose-800 text-white ring-2 ring-rose-200'
                : 'bg-teal-700 hover:bg-teal-800 text-white'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums">
                  Stop ({formatTimer(secondsListening)})
                </span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>
                  {effectiveScope === 'resident' && focusedRow
                    ? `Dictate · Rm ${focusedRow.room}`
                    : 'Voice Report'}
                </span>
              </>
            )}
          </button>

          {/* Live Audio Level Bars while recording */}
          {isListening && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
              <div className="flex items-end gap-0.5 h-3 w-7" aria-hidden="true">
                <span
                  className="w-1 bg-rose-600 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(20, Math.min(100, audioLevel * 1.4))}%` }}
                />
                <span
                  className="w-1 bg-rose-700 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(30, Math.min(100, audioLevel * 2.1))}%` }}
                />
                <span
                  className="w-1 bg-rose-600 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(18, Math.min(100, audioLevel * 1.2))}%` }}
                />
                <span
                  className="w-1 bg-rose-700 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(25, Math.min(100, audioLevel * 1.7))}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-rose-800">Listening</span>
            </div>
          )}

          {/* Scope Toggle (only shown when inside an individual resident file) */}
          {focusedRow && (
            <div
              className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl text-xs"
              role="group"
              aria-label="Report scope"
            >
              <button
                type="button"
                onClick={() => setReportScope('resident')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  effectiveScope === 'resident'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rm <span className="font-mono tabular-nums">{focusedRow.room}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportScope('unit');
                  setPendingSingleRecord(null);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  effectiveScope === 'unit'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
            </div>
          )}

          {/* Compact Speaking Language Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs gap-1.5">
            <Languages className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer max-w-[140px]"
              aria-label="Speaking language"
            >
              <option value="auto">Auto-Detect</option>
              <optgroup label="LTC Priority Languages">
                {priorityLanguages.map((lang) => (
                  <option key={`src-p-${lang.code}`} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </optgroup>
              {otherLanguages.length > 0 && (
                <optgroup label={`All Cloud Languages (${otherLanguages.length})`}>
                  {otherLanguages.map((lang) => (
                    <option key={`src-o-${lang.code}`} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {isLoadingLanguages && (
              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
            )}
          </div>
        </div>

        {/* Right Controls: Type Note + Consolidated More Menu */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>{showDrawer ? 'Hide input' : 'Type note'}</span>
            {showDrawer ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="relative" ref={scenarioDropdownRef}>
            <button
              type="button"
              onClick={() => setActiveScenarioOpen(!activeScenarioOpen)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]"
            >
              <span>Samples &amp; guide</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {activeScenarioOpen && (
              <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 space-y-1 text-left">
                {onOpenGuide && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScenarioOpen(false);
                        onOpenGuide();
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-purple-950">
                        <BookOpen className="w-3.5 h-3.5 text-purple-700" />
                        <span>Stop &amp; Watch clinical guide</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                  </>
                )}

                <div className="text-[11px] font-semibold text-slate-500 px-2 py-1">
                  Sample shift scenarios
                </div>
                {DEMO_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => handleSelectScenario(sc)}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-teal-800 flex items-center justify-between">
                      <span>{sc.title}</span>
                      <Play className="w-3 h-3 text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      {sc.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Dictation & Translation Workspace */}
      {showDrawer && (
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {errorMessage && (
            <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-3 text-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-amber-700 hover:text-amber-950 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {appliedResidentNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{appliedResidentNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setAppliedResidentNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Dictation & Contextual Translation */}
          <div
            className={`grid grid-cols-1 gap-3.5 ${
              showTranslationPane ? 'lg:grid-cols-2' : ''
            }`}
          >
            {/* Source Input */}
            <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-3 flex flex-col justify-between space-y-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {effectiveScope === 'resident' && focusedRow
                      ? `Note for Rm ${focusedRow.room} · ${focusedRow.residentName}`
                      : `Shift report (${currentSourceObj.name})`}
                  </span>
                  <div className="flex items-center gap-2.5">
                    {!showTranslationPane && (
                      <button
                        type="button"
                        onClick={() => setShowTwoWayTarget(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-800 hover:text-teal-950 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        <span>Translate</span>
                      </button>
                    )}
                    {inputText && (
                      <button
                        type="button"
                        onClick={() => {
                          setInputText('');
                          accumulatedTranscriptRef.current = '';
                          setLiveTranslationText('');
                          setDetectedSourceLanguage(null);
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={inputText}
                  onChange={handleInputChange}
                  rows={showTranslationPane ? 3 : 2}
                  placeholder={
                    effectiveScope === 'resident' && focusedRow
                      ? `Speak or type care notes for ${focusedRow.residentName} in ${currentSourceObj.name}...`
                      : `Speak or type multi-resident notes in ${currentSourceObj.name}...`
                  }
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-700 resize-y leading-relaxed"
                />

                {interimText && (
                  <div className="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-dashed border-slate-300">
                    <span className="font-semibold text-teal-700">Listening: </span>
                    {interimText}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono tabular-nums">
                    {inputText ? `${inputText.trim().split(/\s+/).length} words` : 'Ready'}
                  </span>
                  {inputText.trim() && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSpeakText(inputText, selectedLanguage)}
                        disabled={speaking}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-teal-800 disabled:opacity-40 px-1.5 py-0.5 rounded hover:bg-slate-200/60 cursor-pointer transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText('source', inputText)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-teal-800 px-1.5 py-0.5 rounded hover:bg-slate-200/60 cursor-pointer transition-colors"
                      >
                        {copiedField === 'source' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedField === 'source' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </>
                  )}
                </div>

                {!showTranslationPane && (
                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={
                      !inputText.trim() ||
                      isTranslating ||
                      externalProcessing ||
                      isExtractingSingle
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                  >
                    {isExtractingSingle || externalProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {effectiveScope === 'resident' && focusedRow
                            ? `Extract for Rm ${focusedRow.room}`
                            : 'Apply to Sheet'}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Translation & Extract (Shown contextually for non-English or 2-Way mode) */}
            {showTranslationPane && (
              <div className="border border-teal-200/90 rounded-xl bg-teal-50/30 p-3 flex flex-col justify-between space-y-2">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-teal-950">
                        Translation ({currentTargetObj.name})
                      </span>
                      {detectedSourceLanguage &&
                        detectedSourceLanguage !== 'und' &&
                        selectedLanguage === 'auto' && (
                          <span className="text-[11px] text-slate-600">
                            · Detected {getLanguageByCode(detectedSourceLanguage).name}
                          </span>
                        )}
                      {(isTranslating || externalProcessing || isExtractingSingle) && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSwapLanguages}
                        disabled={selectedLanguage === 'auto'}
                        className="p-1 rounded bg-white hover:bg-teal-100 disabled:opacity-40 text-teal-800 border border-teal-200 cursor-pointer"
                        title="Swap languages"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                      </button>
                      <select
                        value={targetLanguage}
                        onChange={(e) => {
                          const nextTgt = e.target.value;
                          setTargetLanguage(nextTgt);
                          targetLanguageRef.current = nextTgt;
                          if (inputText.trim()) {
                            setIsTranslating(true);
                            translateBidirectional(inputText.trim(), selectedLanguage, nextTgt)
                              .then((res) => {
                                if (res && res.translatedText) {
                                  setLiveTranslationText(res.translatedText);
                                  if (res.detectedSourceLanguage) {
                                    setDetectedSourceLanguage(res.detectedSourceLanguage);
                                  }
                                }
                              })
                              .finally(() => setIsTranslating(false));
                          }
                        }}
                        className="bg-white border border-teal-200 rounded-md px-2 py-0.5 text-[11px] font-semibold text-teal-950 focus:outline-none cursor-pointer max-w-[130px]"
                        aria-label="Target translation language"
                      >
                        <optgroup label="LTC Priority Languages">
                          {priorityLanguages.map((lang) => (
                            <option key={`tgt-p-${lang.code}`} value={lang.code}>
                              {lang.name}
                            </option>
                          ))}
                        </optgroup>
                        {otherLanguages.length > 0 && (
                          <optgroup label={`All Cloud Languages (${otherLanguages.length})`}>
                            {otherLanguages.map((lang) => (
                              <option key={`tgt-o-${lang.code}`} value={lang.code}>
                                {lang.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {showTwoWayTarget && selectedLanguage === 'en' && targetLanguage === 'en' && (
                        <button
                          type="button"
                          onClick={() => setShowTwoWayTarget(false)}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Hide translation panel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="w-full min-h-[82px] text-sm bg-white border border-teal-200/80 rounded-lg p-2.5 text-slate-900 leading-relaxed overflow-y-auto max-h-40">
                    {liveTranslationText ? (
                      <div>{liveTranslationText}</div>
                    ) : isTranslating ? (
                      <div className="text-teal-700 italic flex items-center gap-2 py-3 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Translating...</span>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic py-1 text-xs">
                        Translation appears here automatically.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1">
                    {liveTranslationText.trim() && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSpeakText(liveTranslationText, targetLanguage)}
                          disabled={speaking}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-900 hover:text-teal-700 disabled:opacity-40 px-1.5 py-0.5 rounded hover:bg-teal-100 cursor-pointer transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Listen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText('target', liveTranslationText)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-900 hover:text-teal-700 px-1.5 py-0.5 rounded hover:bg-teal-100 cursor-pointer transition-colors"
                        >
                          {copiedField === 'target' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedField === 'target' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={
                      (!inputText.trim() && !liveTranslationText.trim()) ||
                      isTranslating ||
                      externalProcessing ||
                      isExtractingSingle
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                  >
                    {isExtractingSingle || externalProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {effectiveScope === 'resident' && focusedRow
                            ? `Extract for Rm ${focusedRow.room}`
                            : 'Apply to Sheet'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Review for Single-Resident Extraction */}
          {pendingSingleRecord && focusedRow && (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-200">
                <div className="text-xs font-semibold text-amber-950">
                  Review extracted note for Rm {focusedRow.room} ({focusedRow.residentName})
                </div>
                <span className="text-[11px] text-amber-800">Human confirmation required</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 block mb-0.5">
                    Completed care
                  </span>
                  <p className="text-slate-900 font-medium leading-relaxed">
                    {pendingSingleRecord.care_completed || '—'}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-500 block mb-0.5">
                    Stop &amp; Watch
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {pendingSingleRecord.stop_and_watch_flags.length === 0 ? (
                      <span className="text-slate-500">No changes flagged</span>
                    ) : (
                      pendingSingleRecord.stop_and_watch_flags.map((flag, idx) => {
                        const detectedCodeId = findCodeIdFromFlagText(flag);
                        return detectedCodeId ? (
                          <StopAndWatchIconBadge
                            key={idx}
                            codeId={detectedCodeId}
                            size="xs"
                            language={interfaceLanguage}
                          />
                        ) : (
                          <span
                            key={idx}
                            className="bg-amber-100 text-amber-950 border border-amber-200 px-1.5 py-0.5 rounded text-[11px] font-medium"
                          >
                            {flag}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-slate-500 block mb-0.5">
                    Observations
                  </span>
                  <p className="text-slate-900 font-medium leading-relaxed">
                    {pendingSingleRecord.additional_observations || '—'}
                  </p>
                </div>
              </div>

              {(pendingSingleRecord.care_requirements?.length || 0) > 0 && (
                <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center gap-1.5 text-xs">
                  <ListChecks className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span className="font-medium text-slate-700">Next-shift tasks:</span>
                  {pendingSingleRecord.care_requirements!.map((req, rIdx) => (
                    <span
                      key={rIdx}
                      className="inline-flex items-center gap-1 bg-white border border-amber-200 text-slate-800 px-2 py-0.5 rounded text-[11px]"
                    >
                      <span className="font-semibold text-teal-800">{req.category}:</span>
                      <span>{req.action_item}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingSingleRecord(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSingleExtraction}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to Rm {focusedRow.room}</span>
                </button>
              </div>
            </div>
          )}

          {/* Auto-Filled Resident Profiles Summary */}
          {lastAutoFilledRooms.length > 0 && effectiveScope === 'unit' && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-950 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Updated {lastAutoFilledRooms.length} resident file
                  {lastAutoFilledRooms.length > 1 ? 's' : ''} (pending review)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {lastAutoFilledRooms.map((roomNum) => {
                  const matched = rows.find((r) => r.room === roomNum);
                  return (
                    <button
                      key={roomNum}
                      type="button"
                      onClick={() => onSelectResident && onSelectResident(roomNum)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-lg font-semibold text-xs cursor-pointer transition-colors"
                    >
                      <span className="font-mono tabular-nums">{roomNum}</span>
                      <span>· {matched?.residentName || 'Resident'}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-700" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unassigned Extractions Assignment */}
          {unassignedExtractions.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-800 shrink-0" />
                <span className="font-semibold text-amber-950">
                  Assign observation to a resident (no room number mentioned)
                </span>
              </div>

              <div className="space-y-2">
                {unassignedExtractions.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-amber-200 rounded-lg p-3 space-y-2"
                  >
                    {item.general_observation_note && (
                      <div className="text-sm text-slate-900 font-medium">
                        &ldquo;{item.general_observation_note}&rdquo;
                      </div>
                    )}

                    {item.stop_and_watch_codes.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.stop_and_watch_codes.map((codeText, cIdx) => {
                          const codeId = findCodeIdFromFlagText(codeText);
                          return codeId ? (
                            <StopAndWatchIconBadge key={cIdx} codeId={codeId} size="xs" />
                          ) : (
                            <span
                              key={cIdx}
                              className="text-[11px] bg-amber-100 text-amber-950 px-2 py-0.5 rounded font-medium"
                            >
                              {codeText}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-600 mr-1">
                          Assign to:
                        </span>
                        {rows.map((r) => (
                          <button
                            key={r.room}
                            type="button"
                            onClick={() => onAssignExtraction && onAssignExtraction(idx, r.room)}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-700 text-teal-950 hover:text-white border border-teal-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <span className="font-mono tabular-nums">{r.room}</span> · {r.residentName}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => onAssignExtraction && onAssignExtraction(idx, 'unit_note')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-700 text-slate-800 hover:text-white border border-slate-200 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Unit Note
                        </button>
                      </div>

                      {onDismissExtraction && (
                        <button
                          type="button"
                          onClick={() => onDismissExtraction(idx)}
                          className="text-[11px] text-slate-500 hover:text-rose-700 underline cursor-pointer"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clarification Questions */}
          {openQuestions && openQuestions.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-sky-900 font-semibold">
                <HelpCircle className="w-4 h-4 text-sky-700" />
                <span>Clarification needed</span>
              </div>
              <div className="space-y-1.5 pl-6">
                {openQuestions.map((q, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sky-950 font-medium">
                      <span>{q}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAnsweringQuestionIndex(answeringQuestionIndex === idx ? null : idx);
                          setQuestionAnswerText('');
                        }}
                        className="text-[11px] text-sky-700 hover:text-sky-900 underline font-semibold cursor-pointer"
                      >
                        {answeringQuestionIndex === idx ? 'Cancel' : 'Answer'}
                      </button>
                    </div>

                    {answeringQuestionIndex === idx && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={questionAnswerText}
                          onChange={(e) => setQuestionAnswerText(e.target.value)}
                          placeholder="e.g., 'Room 102' or 'Took 200 mL apple juice'"
                          className="flex-1 bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuestionSubmit(idx, q)}
                          className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progressive Segment History */}
          {segments.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSegments((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <span>
                  {showSegments
                    ? 'Hide shift transcript history'
                    : `Transcript history (${segments.length})`}
                </span>
                {showSegments ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showSegments && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {segments.map((seg, idx) => {
                    const segTargetCode = seg.targetLanguage || targetLanguage;
                    const segTargetObj = getLanguageByCode(segTargetCode);
                    const segSourceObj = getLanguageByCode(seg.detectedSourceLanguage || seg.language);
                    const displayTranslation = seg.translatedText || seg.translatedEnglish;

                    return (
                      <div
                        key={seg.id || idx}
                        className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2.5"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {segSourceObj.name} ·{' '}
                              <span className="font-mono tabular-nums">{seg.timestamp}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(`hist_orig_${seg.id}`, seg.originalText)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title="Copy"
                            >
                              {copiedField === `hist_orig_${seg.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-slate-800 text-xs">{seg.originalText}</div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-teal-900 font-medium">
                            <span>{segTargetObj.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleRetranslate(seg)}
                                disabled={seg.isTranslating}
                                className="text-teal-700 hover:text-teal-900 p-0.5 cursor-pointer"
                                title="Retranslate"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${seg.isTranslating ? 'animate-spin' : ''}`}
                                />
                              </button>
                              {displayTranslation && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(`hist_trans_${seg.id}`, displayTranslation)
                                  }
                                  className="text-slate-400 hover:text-teal-800 p-0.5 cursor-pointer"
                                  title="Copy"
                                >
                                  {copiedField === `hist_trans_${seg.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-slate-900 text-xs">
                            {seg.isTranslating ? (
                              <span className="text-teal-700 italic">Translating...</span>
                            ) : (
                              displayTranslation || '—'
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
