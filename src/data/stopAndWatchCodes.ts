/**
 * Central Configuration for the Stop and Watch Early Warning Tool (INTERACT™)
 *
 * NOTE: Severity tiers are a prototype proposal and must be reviewed and approved
 * by Schlegel Villages nursing leadership. They are not part of the official INTERACT tool.
 *
 * All alerts and tiers are decision support only. The charge nurse makes all clinical decisions.
 */

export type SeverityTier = 1 | 2 | 3;

export interface StopAndWatchCodeConfig {
  id: string; // Disambiguated unique internal ID
  letter: string; // Base INTERACT letter
  shortLabel: string; // e.g. "Ate less", "Agitated"
  label: string; // Full human-readable label
  plainLabel: string; // Visual Grade 5 label e.g. "Ate less", "Drank less"
  emoji: string; // Friendly visual picture emoji
  plainLanguageDescription: string;
  examplePhrase: string;
  defaultTier: SeverityTier;
  category: 'observation' | 'nutrition' | 'mobility' | 'cognition' | 'vitals';
  iconName: 'Info' | 'AlertTriangle' | 'OctagonAlert';
}

export interface TierMetadata {
  tier: SeverityTier;
  name: string;
  heading: string;
  label: string;
  sublabel: string;
  shortAction: string;
  badgeClass: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  chipClass: string;
  borderClass: string;
  bgRowHighlight: string;
  actionSummary: string;
  nurseRequirement: 'optional' | 'shift_required' | 'now_blocking';
}

export const TIER_METADATA: Record<SeverityTier, TierMetadata> = {
  1: {
    tier: 1,
    name: 'MONITOR',
    heading: 'Tier 1 – MONITOR',
    label: 'Tier 1: Monitor',
    sublabel: 'Keep watching, mention at handoff',
    shortAction: 'Keep watching; mention at handoff',
    badgeClass: 'bg-sky-50 text-sky-900 border border-sky-200',
    badgeBg: 'bg-sky-50',
    badgeColor: 'text-sky-900',
    badgeBorder: 'border-sky-200',
    chipClass: 'bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100',
    borderClass: 'border-sky-200',
    bgRowHighlight: 'bg-sky-50/25',
    actionSummary: 'Keep watching and monitor resident status. Mention at shift handoff; nurse notification is optional.',
    nurseRequirement: 'optional',
  },
  2: {
    tier: 2,
    name: 'REPORT THIS SHIFT',
    heading: 'Tier 2 – REPORT TO NURSE THIS SHIFT',
    label: 'Tier 2: Report This Shift',
    sublabel: 'Report to charge nurse this shift',
    shortAction: 'Report to charge nurse this shift',
    badgeClass: 'bg-amber-50 text-amber-950 border border-amber-300',
    badgeBg: 'bg-amber-50',
    badgeColor: 'text-amber-950',
    badgeBorder: 'border-amber-300',
    chipClass: 'bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100/80',
    borderClass: 'border-amber-300',
    bgRowHighlight: 'bg-amber-50/35',
    actionSummary: 'Notify charge nurse during this shift. "Told nurse?" must be completed before submit, or a logged override reason must be provided.',
    nurseRequirement: 'shift_required',
  },
  3: {
    tier: 3,
    name: 'REPORT NOW',
    heading: 'Tier 3 – REPORT TO NURSE NOW',
    label: 'Tier 3: Report Now',
    sublabel: 'Report to charge nurse NOW (high priority)',
    shortAction: 'Report to charge nurse NOW (high priority)',
    badgeClass: 'bg-purple-50 text-purple-950 border border-purple-300',
    badgeBg: 'bg-purple-50',
    badgeColor: 'text-purple-950',
    badgeBorder: 'border-purple-300',
    chipClass: 'bg-purple-50 text-purple-950 border border-purple-300 hover:bg-purple-100/80',
    borderClass: 'border-purple-300',
    bgRowHighlight: 'bg-purple-50/35',
    actionSummary: 'High priority alert! Notify charge nurse immediately. Submission is blocked until "Told nurse?" is confirmed with initials (no override allowed).',
    nurseRequirement: 'now_blocking',
  },
};

export const DEFAULT_CODE_TIERS: Record<string, SeverityTier> = {
  S: 1,
  T_talks: 1,
  A_ate: 1,
  O: 2,
  D: 2,
  N: 2,
  W: 2,
  A_agitated: 2,
  H: 2,
  P: 3,
  T_tired: 3,
  C: 3,
};

export const STOP_AND_WATCH_CONFIG: StopAndWatchCodeConfig[] = [
  // --- Tier 1: Monitor ---
  {
    id: 'S',
    letter: 'S',
    shortLabel: 'Seems different',
    label: 'Seems different than usual',
    plainLabel: 'Seems different',
    emoji: '😟',
    plainLanguageDescription: 'Resident is acting, responding, or appearing different from their usual daily baseline.',
    examplePhrase: '"Appeared hesitant during morning routine, not quite herself today."',
    defaultTier: 1,
    category: 'observation',
    iconName: 'Info',
  },
  {
    id: 'T_talks',
    letter: 'T',
    shortLabel: 'Talks less',
    label: 'Talks or communicates less',
    plainLabel: 'Talks less',
    emoji: '🗣',
    plainLanguageDescription: 'Speaking significantly fewer words, withdrawn, or giving minimal one-word answers.',
    examplePhrase: '"Usually chats during coffee; sat quietly with head down today."',
    defaultTier: 1,
    category: 'cognition',
    iconName: 'Info',
  },
  {
    id: 'A_ate',
    letter: 'A',
    shortLabel: 'Ate less',
    label: 'Ate less',
    plainLabel: 'Ate less',
    emoji: '🍽',
    plainLanguageDescription: 'Finished less than 50% of regular meals, skipped snack, or refused main meal tray.',
    examplePhrase: '"Finished only half of breakfast porridge, pushed lunch away."',
    defaultTier: 1,
    category: 'nutrition',
    iconName: 'Info',
  },

  // --- Tier 2: Report to Nurse This Shift ---
  {
    id: 'O',
    letter: 'O',
    shortLabel: 'Needs more help',
    label: 'Overall needs more help',
    plainLabel: 'Needs more help',
    emoji: '🦽',
    plainLanguageDescription: 'Requiring more physical assistance or time with activities of daily living than typical.',
    examplePhrase: '"Needed hands-on help putting on cardigan and managing utensils."',
    defaultTier: 2,
    category: 'mobility',
    iconName: 'AlertTriangle',
  },
  {
    id: 'D',
    letter: 'D',
    shortLabel: 'Drank less',
    label: 'Drank less',
    plainLabel: 'Drank less',
    emoji: '💧',
    plainLanguageDescription: 'Fluid intake significantly below daily target (under 1000 mL) or refusing fluids.',
    examplePhrase: '"Drank only half of fluids offered; total intake 550 mL."',
    defaultTier: 2,
    category: 'nutrition',
    iconName: 'AlertTriangle',
  },
  {
    id: 'N',
    letter: 'N',
    shortLabel: 'No BM / Diarrhea',
    label: 'No bowel movement in 3 days, or diarrhea',
    plainLabel: 'Bowel problem',
    emoji: '🚽',
    plainLanguageDescription: 'No bowel movement recorded in past 48–72 hours, or loose/watery stools present.',
    examplePhrase: '"No bowel movement logged since Tuesday (48+ hours). Formed stools absent."',
    defaultTier: 2,
    category: 'vitals',
    iconName: 'AlertTriangle',
  },
  {
    id: 'W',
    letter: 'W',
    shortLabel: 'Weight change',
    label: 'Weight change',
    plainLabel: 'Weight change',
    emoji: '⚖',
    plainLanguageDescription: 'Unexplained weight loss or rapid weight gain (fluid retention), or clothes noticeably loose/tight.',
    examplePhrase: '"Scale showed 2.2 kg decrease since last weekly weigh-in."',
    defaultTier: 2,
    category: 'vitals',
    iconName: 'AlertTriangle',
  },
  {
    id: 'A_agitated',
    letter: 'A',
    shortLabel: 'Agitated',
    label: 'Agitated or nervous more than usual',
    plainLabel: 'Upset or nervous',
    emoji: '😰',
    plainLanguageDescription: 'Restless, pacing, shouting, resisting care, or visibly more anxious than baseline.',
    examplePhrase: '"Paced hallway repeatedly; resisted guidance when returning to room."',
    defaultTier: 2,
    category: 'cognition',
    iconName: 'AlertTriangle',
  },
  {
    id: 'H',
    letter: 'H',
    shortLabel: 'Help transferring',
    label: 'Help with walking, transferring or toileting more than usual',
    plainLabel: 'Needs help walking',
    emoji: '🚶',
    plainLanguageDescription: 'Required 2-person pivot transfer instead of 1, unsteadiness, or new ambulation weakness.',
    examplePhrase: '"Needed 2 staff for lunch transfer due to right leg weakness, normally 1."',
    defaultTier: 2,
    category: 'mobility',
    iconName: 'AlertTriangle',
  },

  // --- Tier 3: Report to Nurse NOW ---
  {
    id: 'P',
    letter: 'P',
    shortLabel: 'Pain / Activities',
    label: 'Pain (new or worse), or joined in activities less',
    plainLabel: 'Pain (new or worse)',
    emoji: '😣',
    plainLanguageDescription: 'Verbalizing pain, grimacing, guarding a limb, or suddenly refusing favorite activities.',
    examplePhrase: '"Winced and touched right shoulder when dressing; declined afternoon activity."',
    defaultTier: 3,
    category: 'observation',
    iconName: 'OctagonAlert',
  },
  {
    id: 'T_tired',
    letter: 'T',
    shortLabel: 'Tired / Confused',
    label: 'Tired, weak, confused or drowsy',
    plainLabel: 'Tired or confused',
    emoji: '😴',
    plainLanguageDescription: 'Difficulty staying awake, unusually lethargic, weak grip, or sudden new disorientation.',
    examplePhrase: '"Dozed off repeatedly during lunch; difficult to rouse for fluids."',
    defaultTier: 3,
    category: 'cognition',
    iconName: 'OctagonAlert',
  },
  {
    id: 'C',
    letter: 'C',
    shortLabel: 'Skin change',
    label: 'Change in skin colour or condition',
    plainLabel: 'Skin change',
    emoji: '🩹',
    plainLanguageDescription: 'New redness, pressure mark, rash, bruising, skin tear, or non-blanching area.',
    examplePhrase: '"Noticed 2cm non-blanching red area on left heel during repositioning."',
    defaultTier: 3,
    category: 'vitals',
    iconName: 'OctagonAlert',
  },
];

/**
 * Retrieve configuration object for a specific code ID.
 */
export function getCodeConfig(
  id: string,
  customTiers?: Record<string, SeverityTier>
): StopAndWatchCodeConfig | undefined {
  const found = STOP_AND_WATCH_CONFIG.find((c) => c.id === id);
  if (!found) return undefined;
  if (customTiers && customTiers[id]) {
    return { ...found, defaultTier: customTiers[id] };
  }
  return found;
}

/**
 * Format code as a small chip label.
 * Always shows the letter plus its short label (e.g. "A · Ate less", "A · Agitated").
 * NEVER shows a bare "A" or "T".
 */
export function formatCodeChip(id: string): string {
  const config = getCodeConfig(id);
  if (!config) return id;
  return `${config.letter} · ${config.shortLabel}`;
}

/**
 * Drop-in replacement for formatCodeDisplay across all components.
 */
export function formatCodeDisplay(id: string): string {
  return formatCodeChip(id);
}

export const STOP_AND_WATCH_CODES = STOP_AND_WATCH_CONFIG;

export interface SeverityEvaluation {
  tier: SeverityTier;
  effectiveTier: SeverityTier;
  baseTier: SeverityTier;
  escalatedByCount: boolean; // 3+ codes raised tier by 1
  escalatedByRepeat: boolean; // Flagged Tier 2+ on previous shift raised tier by 1
  codes: StopAndWatchCodeConfig[];
}

/**
 * Compute the resident row's deterministic overall severity tier according to clinical rules:
 * 1. Base tier equals the highest tier among the row's codes.
 * 2. If resident has 3 or more codes in one shift, raise severity by 1 tier (cap at Tier 3).
 * 3. If the same resident was flagged Tier 2 or higher on the previous shift, raise severity by 1 tier (cap at Tier 3).
 */
export function computeRowSeverity(
  codeIds: string[],
  optionsOrPrevShift?:
    | {
        prevShiftTier?: SeverityTier;
        customTiers?: Record<string, SeverityTier>;
      }
    | SeverityTier,
  customTiersArg?: Record<string, SeverityTier>
): SeverityEvaluation | null {
  if (!codeIds || codeIds.length === 0) return null;

  let prevShiftTier: SeverityTier | undefined;
  let customTiers: Record<string, SeverityTier> | undefined;

  if (typeof optionsOrPrevShift === 'number') {
    prevShiftTier = optionsOrPrevShift;
    customTiers = customTiersArg;
  } else if (optionsOrPrevShift && typeof optionsOrPrevShift === 'object') {
    prevShiftTier = optionsOrPrevShift.prevShiftTier;
    customTiers = optionsOrPrevShift.customTiers;
  }

  const validConfigs: StopAndWatchCodeConfig[] = [];
  codeIds.forEach((id) => {
    const cfg = getCodeConfig(id, customTiers);
    if (cfg) validConfigs.push(cfg);
  });

  if (validConfigs.length === 0) return null;

  // Highest tier among codes
  const baseTier = Math.max(...validConfigs.map((c) => c.defaultTier)) as SeverityTier;

  let currentTier = baseTier;
  let escalatedByCount = false;
  let escalatedByRepeat = false;

  // Escalation Rule 1: 3 or more codes in one shift raises severity by one tier
  if (validConfigs.length >= 3 && currentTier < 3) {
    currentTier = (currentTier + 1) as SeverityTier;
    escalatedByCount = true;
  }

  // Escalation Rule 2: Flagged Tier 2 or higher on previous shift raises severity by one tier
  if (prevShiftTier && prevShiftTier >= 2 && currentTier < 3) {
    currentTier = (currentTier + 1) as SeverityTier;
    escalatedByRepeat = true;
  }

  const finalTier = Math.min(3, currentTier) as SeverityTier;

  return {
    tier: finalTier,
    effectiveTier: finalTier,
    baseTier,
    escalatedByCount,
    escalatedByRepeat,
    codes: validConfigs,
  };
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', speechCode: 'en-CA', name: 'English', nativeName: 'English (Canada)' },
  { code: 'tl', speechCode: 'fil-PH', name: 'Tagalog', nativeName: 'Tagalog / Filipino' },
  { code: 'pa', speechCode: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'hi', speechCode: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी (Hindi)' },
  { code: 'zh', speechCode: 'zh-CN', name: 'Mandarin', nativeName: '普通话 (Mandarin)' },
  { code: 'es', speechCode: 'es-ES', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', speechCode: 'fr-CA', name: 'French', nativeName: 'Français (Canada)' },
  { code: 'ar', speechCode: 'ar-SA', name: 'Arabic', nativeName: 'العربية (Arabic)' },
];

export const STOP_AND_WATCH_TRANSLATIONS: Record<string, Record<string, string>> = {
  tl: {
    S: 'Iba ang kilos kaysa dati',
    T_talks: 'Mas kaunti magsalita',
    A_ate: 'Mas kaunti kumain',
    O: 'Mas kailangan ng tulong',
    D: 'Mas kaunti uminom',
    N: 'Walang dumi / pagtatae',
    W: 'Pagbabago sa timbang',
    A_agitated: 'Balisa o hindi mapakali',
    H: 'Kailangan ng tulong maglakad',
    P: 'May pananakit / masakit',
    T_tired: 'Pagod o nalilito',
    C: 'Pagbabago sa balat',
  },
  pa: {
    S: 'ਆਮ ਨਾਲੋਂ ਵੱਖਰਾ ਲੱਗਦਾ ਹੈ',
    T_talks: 'ਘੱਟ ਬੋਲਦਾ ਹੈ',
    A_ate: 'ਘੱਟ ਖਾਧਾ',
    O: 'ਵਧੇਰੇ ਮਦਦ ਦੀ ਲੋੜ',
    D: 'ਘੱਟ ਪਾਣੀ ਪੀਤਾ',
    N: 'ਟੱਟੀ ਨਾ ਆਉਣਾ / ਦਸਤ',
    W: 'ਭਾਰ ਵਿੱਚ ਤਬਦੀਲੀ',
    A_agitated: 'ਪਰੇਸ਼ਾਨ ਜਾਂ ਘਬਰਾਇਆ ਹੋਇਆ',
    H: 'ਤੁਰਨ ਵਿੱਚ ਮਦਦ ਦੀ ਲੋੜ',
    P: 'ਦਰਦ (ਨਵਾਂ ਜਾਂ ਵਧਿਆ)',
    T_tired: 'ਥੱਕਿਆ ਜਾਂ ਉਲਝਿਆ ਹੋਇਆ',
    C: 'ਚਮੜੀ ਵਿੱਚ ਬਦਲਾਅ',
  },
  hi: {
    S: 'सामान्य से अलग दिख रहा है',
    T_talks: 'कम बात कर रहा है',
    A_ate: 'कम खाया',
    O: 'अधिक मदद की ज़रूरत',
    D: 'कम पानी पिया',
    N: 'मल त्याग नहीं / दस्त',
    W: 'वज़न में बदलाव',
    A_agitated: 'बेचैन या घबराया हुआ',
    H: 'चलने में अधिक मदद की ज़रूरत',
    P: 'दर्द (नया या बढ़ा हुआ)',
    T_tired: 'थका हुआ या भ्रमित',
    C: 'त्वचा में बदलाव',
  },
  zh: {
    S: '表现与平时不同',
    T_talks: '说话减少',
    A_ate: '进食减少',
    O: '总体需要更多协助',
    D: '饮水减少',
    N: '无排便或腹泻',
    W: '体重变化',
    A_agitated: '烦躁或紧张不安',
    H: '行走或转移需更多帮助',
    P: '疼痛（新发或加重）',
    T_tired: '疲倦、虚弱或意识模糊',
    C: '皮肤颜色或状况变化',
  },
  es: {
    S: 'Parece diferente a lo habitual',
    T_talks: 'Habla menos',
    A_ate: 'Comió menos',
    O: 'Necesita más ayuda',
    D: 'Bebió menos líquidos',
    N: 'Sin evacuación / diarrea',
    W: 'Cambio de peso',
    A_agitated: 'Agitado o nervioso',
    H: 'Ayuda al caminar / trasladar',
    P: 'Dolor (nuevo o peor)',
    T_tired: 'Cansado o confundido',
    C: 'Cambio en la piel',
  },
  fr: {
    S: 'Semble différent d’habitude',
    T_talks: 'Parle moins',
    A_ate: 'A moins mangé',
    O: 'Besoin de plus d’aide',
    D: 'A moins bu',
    N: 'Pas de selles / diarrhée',
    W: 'Changement de poids',
    A_agitated: 'Agité ou nerveux',
    H: 'Aide pour marcher / transfert',
    P: 'Douleur (nouvelle ou pire)',
    T_tired: 'Fatigué ou confus',
    C: 'Changement de la peau',
  },
  ar: {
    S: 'يبدو مختلفاً عن المعتاد',
    T_talks: 'يتحدث أقل',
    A_ate: 'أكل أقل',
    O: 'يحتاج مساعدة أكثر',
    D: 'شرب سوائل أقل',
    N: 'لا إخراج / إسهال',
    W: 'تغير في الوزن',
    A_agitated: 'منزعج أو قلق',
    H: 'يحتاج مساعدة في المشي',
    P: 'ألم (جديد أو أسوأ)',
    T_tired: 'متعب أو مشوش',
    C: 'تغير في الجلد',
  },
};

export function getTranslatedStopAndWatchLabel(
  codeId: string,
  langCode: string = 'en',
  fallback?: string
): string {
  if (langCode && langCode !== 'en' && STOP_AND_WATCH_TRANSLATIONS[langCode]?.[codeId]) {
    return STOP_AND_WATCH_TRANSLATIONS[langCode][codeId];
  }
  const cfg = getCodeConfig(codeId);
  return fallback || cfg?.plainLabel || cfg?.shortLabel || codeId;
}

export const STOP_AND_WATCH_SCHEMA_ENUMS: { enumLabel: string; codeId: string }[] = [
  { enumLabel: 'Seems different than usual', codeId: 'S' },
  { enumLabel: 'Talks or communicates less', codeId: 'T_talks' },
  { enumLabel: 'Overall needs more help', codeId: 'O' },
  { enumLabel: 'Pain - new or worsening', codeId: 'P' },
  { enumLabel: 'Ate less', codeId: 'A_ate' },
  { enumLabel: 'No bowel movement in 3 days; or diarrhea', codeId: 'N' },
  { enumLabel: 'Drank less', codeId: 'D' },
  { enumLabel: 'Weight change', codeId: 'W' },
  { enumLabel: 'Agitated or nervous more than usual', codeId: 'A_agitated' },
  { enumLabel: 'Tired, weak, confused, or drowsy', codeId: 'T_tired' },
  { enumLabel: 'Change in skin color or condition', codeId: 'C' },
  { enumLabel: 'Help with walking, transferring, or toileting more than usual', codeId: 'H' },
];

export function mapStopAndWatchTextToCodeId(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Exact or near-exact schema enum match first
  const exact = STOP_AND_WATCH_SCHEMA_ENUMS.find(
    (item) => item.enumLabel.toLowerCase() === lower
  );
  if (exact) return exact.codeId;

  // 2. Direct internal code ID match
  if (STOP_AND_WATCH_CONFIG.some((c) => c.id.toLowerCase() === lower)) {
    return STOP_AND_WATCH_CONFIG.find((c) => c.id.toLowerCase() === lower)!.id;
  }

  // 3. Disambiguated specific clinical matches (check walking/transferring BEFORE overall help)
  if (lower.includes('walking') || lower.includes('transfer') || lower.includes('toileting') || lower.includes('ambulation') || lower.includes('pivot') || lower.includes('two-person') || lower.includes('2-person')) return 'H';
  if (lower.includes('ate less') || lower.includes('appetite') || lower.includes('half breakfast') || lower.includes('refused meal') || lower.includes('refused lunch')) return 'A_ate';
  if (lower.includes('tired') || lower.includes('sleeping') || lower.includes('drowsy') || lower.includes('lethargic') || lower.includes('weak') || lower.includes('confused')) return 'T_tired';
  if (lower.includes('agitated') || lower.includes('nervous') || lower.includes('restless') || lower.includes('pacing') || lower.includes('upset')) return 'A_agitated';
  if (lower.includes('talks less') || lower.includes('communicates less') || lower.includes('quieter') || lower.includes('withdrawn') || lower.includes('silent')) return 'T_talks';
  if (lower.includes('skin') || lower.includes('redness') || lower.includes('heel') || lower.includes('rash') || lower.includes('wound') || lower.includes('pressure') || lower.includes('red area')) return 'C';
  if (lower.includes('drank less') || lower.includes('fluid') || lower.includes('dehydrat') || lower.includes('550 ml')) return 'D';
  if (lower.includes('pain') || lower.includes('hurts') || lower.includes('aching') || lower.includes('wincing')) return 'P';
  if (lower.includes('weight') || lower.includes('scale') || lower.includes('kg')) return 'W';
  if (lower.includes('bowel') || lower.includes('bm') || lower.includes('diarrhea') || lower.includes('constipation') || lower.includes('stool')) return 'N';
  if (lower.includes('different than usual') || lower.includes('seems different') || lower.includes('not herself') || lower.includes('not himself')) return 'S';
  if (lower.includes('overall') || lower.includes('more help') || lower.includes('adl')) return 'O';

  return null;
}


