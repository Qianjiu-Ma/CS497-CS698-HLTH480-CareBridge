export interface StopAndWatchCode {
  id: string; // unique internal ID: 'S', 'T_talks', 'O', 'P', 'A_ate', 'N', 'D', 'W', 'A_agitated', 'T_tired', 'C', 'H'
  letter: string; // standard display letter: 'S', 'T', 'O', 'P', 'A', 'N', 'D', 'W', 'C', 'H'
  label: string; // short human label
  category: 'observation' | 'nutrition' | 'mobility' | 'cognition' | 'vitals';
}

export interface CellValue<T = string> {
  value?: T;
  isPendingConfirmation?: boolean;
  sourceQuote?: string;
  confidence?: 'high' | 'medium' | 'low';
  lastEditedBy?: string;
  needsTranslationCheck?: boolean; // Highlight with yellow badge if translation check failed or confidence is low
  isUpdating?: boolean; // Small inline spinner while data is being structured
}

export interface MLTCDetails {
  weightKg?: CellValue<number | null | undefined>;
  fluidIntakeMl?: CellValue<number | null | undefined>;
  bowelMovement?: CellValue<string>;
  hoursSinceLastBM?: CellValue<number | null | undefined>;
  qualitativeObservations: CellValue<string>; // Required by MLTC
  lastRepositionTime?: CellValue<string>;
}

export type CareRequirementCategory = 'Mobility' | 'Dietary' | 'Medication' | 'Hygiene' | 'Other';

export interface CareRequirementItem {
  id: string;
  category: CareRequirementCategory;
  action_item: string;
  completed?: boolean;
  isPendingConfirmation?: boolean;
  sourceQuote?: string;
  lastEditedBy?: string;
}

export interface ExtractedResidentHandoff {
  resident_identification: {
    name: string;
    room_number?: string;
  };
  requires_manual_assignment: boolean;
  stop_and_watch_codes: string[];
  care_requirements: {
    category: CareRequirementCategory;
    action_item: string;
  }[];
  general_observation_note?: string;
}

export interface HandoffRow {
  room: string;
  residentName: string;
  done: CellValue<string>;
  notDoneNextShift: CellValue<string>;
  changeCodes: CellValue<string[]>; // internal code IDs
  changeNote: CellValue<string>;
  toldNurse: CellValue<boolean>;
  nurseInitials: CellValue<string>;
  careRequirements?: CareRequirementItem[];
  mltcDetails: MLTCDetails;
  isExpanded?: boolean;
  prevShiftTier?: 1 | 2 | 3;
}

export interface ShiftHeader {
  unit: string;
  date: string;
  shift: 'Day (07:00 - 15:00)' | 'Evening (15:00 - 23:00)' | 'Night (23:00 - 07:00)';
  outgoingPsw: string;
  incomingPsw: string;
}

export interface AlertThresholds {
  bowelMovementHoursThreshold: number; // default: 48
  fluidIntakeMinMl: number; // default: 1000
  weightChangeKgThreshold: number; // default: 2.0
  repositioningMaxHours: number; // default: 2.0
  silenceBufferSeconds?: number; // default: 0.8 (configurable 0.5 to 2.0s)
  customCodeTiers?: Record<string, 1 | 2 | 3>;
}

export type AlertSeverity = 'critical_nurse' | 'warning' | 'info_missing';

export interface DeterministicAlert {
  id: string;
  room: string;
  residentName: string;
  severity: AlertSeverity;
  type: 'missing_care' | 'missing_required' | 'nurse_escalation' | 'fluid_low' | 'bm_overdue' | 'reposition_overdue' | 'weight_change';
  title: string;
  message: string;
  actionRequired: string;
}

export interface NurseEscalation {
  id: string;
  room: string;
  residentName: string;
  codes: string[];
  note: string;
  timestamp: string;
  outgoingPsw: string;
  status: 'pending' | 'acknowledged';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  nurseComment?: string;
  resolutionStatus?: 'monitoring' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  details: string;
}

export interface EMRRecord {
  id: string;
  submittedAt: string;
  header: ShiftHeader;
  rows: HandoffRow[];
  anythingElse: string;
  escalations: NurseEscalation[];
  rawTranscript: string;
  transcriptLanguage?: string;
  translatedTranscript?: string;
  auditTrail: AuditLogEntry[];
  submittedBy: string;
  acknowledgedByNurse?: string;
  overrideReason?: string;
}

export interface SupportedLanguage {
  code: string;
  speechCode: string;
  name: string;
  nativeName: string;
  supportSource?: boolean;
  supportTarget?: boolean;
  isPriority?: boolean;
}

export interface TranscriptSegment {
  id: string;
  originalText: string;
  translatedText?: string;
  translatedEnglish: string;
  isTranslating: boolean;
  language: string;
  targetLanguage?: string;
  detectedSourceLanguage?: string;
  translationLatencyMs?: number;
  confidence?: 'high' | 'medium' | 'low';
  provider?:
    | 'google-cloud-translation-v3'
    | 'google-cloud-translation-rest'
    | 'google-translate-service'
    | 'google_translate'
    | 'gemini'
    | 'local_clinical_dictionary';
  needsCheck?: boolean;
  timestamp: string;
}

export interface TranslationDebugLog {
  id: string;
  timestamp: string;
  recognitionLanguage: string;
  rawTranscript: string;
  requestSent: any;
  rawResponse: any;
  validationStatus: 'passed' | 'retried' | 'failed';
  retryPrompt?: string;
  validationNotes?: string;
  provider?: 'google_translate' | 'gemini' | 'local_clinical_dictionary';
  cached?: boolean;
  timings?: {
    speechEndToSendMs: number;
    timeToFirstTokenMs: number | null;
    totalToSheetMs: number;
  };
}

export interface ClinicalTranscriptionRecord {
  resident_name: string;
  staff_stamp: string;
  timestamp: string;
  stop_and_watch_flags: string[];
  care_completed: string;
  additional_observations: string;
  pending_tasks_for_next_shift: string;
  care_requirements?: {
    category: CareRequirementCategory;
    action_item: string;
  }[];
  requires_clarification: boolean;
  raw_transcript?: string;
  source_language?: string;
  translated_english?: string;
}
