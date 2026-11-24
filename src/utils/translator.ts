import { ALL_LANGUAGES, LTC_PHRASEBOOK } from '../data/languages';

export interface GlossaryItem {
  sourceTerm: string;
  targetTerm: string;
  category?: string;
  note?: string;
}

export interface TranslationResponse {
  status: 'original' | 'phrase' | 'machine' | 'unavailable';
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  confidence: 'high' | 'medium' | 'low';
  detectedSourceLanguage?: string;
  translationLatencyMs?: number;
  provider?: string;
  cached?: boolean;
}
export function detectLanguage(text: string): string {
  if (!text || !text.trim()) return 'en';

  // 1. Script checks
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa'; // Punjabi (Gurmukhi)
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi (Devanagari)
  if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'; // Mandarin Chinese
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko'; // Korean
  if (/[\u3040-\u30FF]/.test(text)) return 'ja'; // Japanese
  if (/[\u0400-\u04FF]/.test(text)) return 'ru'; // Cyrillic (Russian/Ukrainian)

  const lower = text.toLowerCase();

  // 2. Tagalog markers (common clinical and conversational words in LTC)
  const tagalogMarkers = [
    'magandang', 'hapon', 'umaga', 'gabi', 'para sa', 'si mr', 'si mrs',
    'tapos na', 'ang bath', 'na-reposition', 'siya', 'tumanggi', 'almusal',
    'tanghalian', 'paki-offer', 'napansin', 'tahimik', 'kinain', 'kaya',
    'na-report', 'kay nurse', 'kuko', 'kaninang', 'dalawang', 'kasi',
    'mahina', 'pamumula', 'sakong', 'konti', 'buong shift',
    'banyo', 'pinaliguan', 'nasabi', 'po', 'opo', 'nars', 'hindi ko',
    'kanina', 'bata', 'paligo', 'binihisan', 'likido', 'dinala', 'walang'
  ];
  let tlCount = 0;
  for (const m of tagalogMarkers) {
    if ((' ' + lower.replace(/[^\\p{L}]+/gu, ' ') + ' ').includes(' ' + m + ' ')) tlCount++;
  }
  if (tlCount >= 1) return 'tl';

  // 3. Spanish markers
  const spanishMarkers = [
    'buenas tardes', 'buenos días', 'reporte', 'cambio de turno', 'habitación',
    'según el plan', 'hija', 'llamó', 'vendrá', 'revisión de piel', 'zona enrojecida',
    'talón izquierdo', 'tomó', 'líquidos', 'reposicionamiento', 'informé', 'enfermera',
    'desayuno', 'almuerzo', 'baño', 'rechazó', 'más callado', 'completó', 'toca'
  ];
  let esCount = 0;
  for (const m of spanishMarkers) {
    if (lower.includes(m)) esCount++;
  }
  if (esCount >= 1) return 'es';

  // 4. French markers
  const frenchMarkers = [
    'bonjour', 'bonsoir', 'chambre', 'selon le plan', 'déjeuner', 'dîner',
    'infirmière', 'toilette', 'fatigué', 'repositionné', 'quart de travail', 'soins'
  ];
  let frCount = 0;
  for (const m of frenchMarkers) {
    if (lower.includes(m)) frCount++;
  }
  if (frCount >= 1) return 'fr';

  return 'en';
}

const MAX_ENTRIES = 250;
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { result: TranslationResponse; expiresAt: number }>();
const pending = new Map<string, Promise<TranslationResponse>>();

export function normalizeTranslationLanguage(language: string): string {
  const lower = language.trim().toLowerCase();
  if (lower === 'fil' || lower === 'fil-ph' || lower === 'tl-ph') return 'tl';
  if (['zh', 'zh-cn', 'zh-hans'].includes(lower)) return 'zh';
  if (['zh-tw', 'zh-hant'].includes(lower)) return 'zh-TW';
  return ALL_LANGUAGES.find(({ code, speechCode }) =>
    code.toLowerCase() === lower || speechCode.toLowerCase() === lower)?.code || language.trim();
}

export function speechLocaleFor(language: string): string | undefined {
  const code = normalizeTranslationLanguage(language);
  if (!code || code === 'auto' || code === 'und') return undefined;
  const known = ALL_LANGUAGES.find((entry) => entry.code === code)?.speechCode;
  if (known) return known;
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(code)[0];
  } catch {
    return undefined;
  }
}

export function findClinicalPhrase(text: string, target: string, source = 'auto') {
  const normalized = text.trim().toLocaleLowerCase('en');
  for (const phrase of LTC_PHRASEBOOK) {
    const languages: Record<string, string> = { en: phrase.english, ...phrase.translations };
    const match = Object.entries(languages).find(([code, value]) =>
      (source === 'auto' || source === code) && value.trim().toLocaleLowerCase('en') === normalized);
    if (match && languages[target]) return { text: languages[target], source: match[0] };
  }
  return undefined;
}

export function translateBidirectional(text: string, fromLang: string, toLang: string): Promise<TranslationResponse> {
  const sourceLang = normalizeTranslationLanguage(fromLang || 'auto');
  const targetLang = normalizeTranslationLanguage(toLang || 'en');
  const original: TranslationResponse = { status: 'original', translatedText: text, sourceLang, targetLang, confidence: 'high' };
  if (!text.trim() || sourceLang === targetLang) return Promise.resolve(original);

  const phrase = findClinicalPhrase(text, targetLang, sourceLang);
  if (phrase) return Promise.resolve({
    ...original,
    status: phrase.source === targetLang ? 'original' : 'phrase',
    translatedText: phrase.text,
    detectedSourceLanguage: phrase.source,
    provider: 'phrasebook',
  });

  const key = JSON.stringify([sourceLang, targetLang, text]);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve({ ...cached.result, cached: true });
  cache.delete(key);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const work = requestTranslation(text, original).then((result) => {
    if (result.status === 'machine' || result.status === 'original') {
      if (cache.size >= MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, { result, expiresAt: Date.now() + TTL_MS });
    }
    return result;
  }).finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}

async function requestTranslation(text: string, original: TranslationResponse): Promise<TranslationResponse> {
  const { sourceLang, targetLang } = original;
  try {
    const response = await fetch('/api/translate/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang }),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) {
      const data = await response.json();
      const translated = typeof data.translated_text === 'string' ? data.translated_text.trim() : '';
      const detected = typeof data.detected_source_language === 'string'
        ? normalizeTranslationLanguage(data.detected_source_language) : sourceLang;
      const responseTarget = typeof data.target_language === 'string'
        ? normalizeTranslationLanguage(data.target_language) : targetLang;
      if (translated && responseTarget === targetLang) {
        if (detected === targetLang && translated === text.trim()) {
          return { ...original, detectedSourceLanguage: detected };
        }
        if (translated !== text.trim()) return {
          ...original,
          status: 'machine',
          confidence: 'medium',
          translatedText: translated,
          detectedSourceLanguage: detected,
          translationLatencyMs: data.translation_latency_ms,
          provider: data.provider,
          cached: data.cached === true,
        };
      }
    }
  } catch {
    // The caller retains the source and can retry. Failures never enter the cache.
  }
  return { ...original, status: 'unavailable', translatedText: '', confidence: 'low' };
}
