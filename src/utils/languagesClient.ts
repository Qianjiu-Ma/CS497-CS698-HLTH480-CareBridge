import { useState, useEffect, useCallback } from 'react';
import { SUPPORTED_LANGUAGES } from '../data/stopAndWatchCodes';
import { SupportedLanguage } from '../types/handoff';

// Web Speech API locale mappings for dynamic Google Cloud Translation language codes
const SPEECH_LOCALE_MAP: Record<string, string> = {
  en: 'en-CA',
  tl: 'fil-PH',
  fil: 'fil-PH',
  pa: 'pa-IN',
  hi: 'hi-IN',
  zh: 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  yue: 'zh-HK',
  es: 'es-ES',
  fr: 'fr-CA',
  ar: 'ar-SA',
  vi: 'vi-VN',
  pt: 'pt-BR',
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt-PT',
  it: 'it-IT',
  pl: 'pl-PL',
  uk: 'uk-UA',
  de: 'de-DE',
  ur: 'ur-PK',
  gu: 'gu-IN',
  ta: 'ta-IN',
  ko: 'ko-KR',
  ja: 'ja-JP',
  ru: 'ru-RU',
  el: 'el-GR',
  bn: 'bn-IN',
  fa: 'fa-IR',
  he: 'he-IL',
  id: 'id-ID',
  ms: 'ms-MY',
  nl: 'nl-NL',
  ro: 'ro-RO',
  sv: 'sv-SE',
  th: 'th-TH',
  tr: 'tr-TR',
};

const PRIORITY_LTC_CODES = ['en', 'tl', 'pa', 'hi', 'zh', 'zh-CN', 'es', 'fr', 'ar'];

const PRIORITY_NATIVE_MAP: Record<string, string> = {
  en: 'English (Canada)',
  tl: 'Tagalog / Filipino',
  fil: 'Tagalog / Filipino',
  pa: 'ਪੰਜਾਬੀ (Punjabi)',
  hi: 'हिन्दी (Hindi)',
  zh: '普通话 (Mandarin)',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  es: 'Español',
  fr: 'Français (Canada)',
  ar: 'العربية (Arabic)',
};

export interface LanguagesState {
  languages: SupportedLanguage[];
  priorityLanguages: SupportedLanguage[];
  otherLanguages: SupportedLanguage[];
  isLoading: boolean;
  source: string;
  latencyMs: number | null;
}

const initialSeedLanguages: SupportedLanguage[] = SUPPORTED_LANGUAGES.map((l) => ({
  ...l,
  supportSource: true,
  supportTarget: true,
  isPriority: true,
}));

let cachedLanguagesState: LanguagesState | null = null;
let inflightFetch: Promise<LanguagesState> | null = null;

function buildLanguageEntry(code: string, name: string): SupportedLanguage {
  const seedMatch = SUPPORTED_LANGUAGES.find(
    (s) => s.code.toLowerCase() === code.toLowerCase()
  );
  const normalizedKey = code === 'fil' ? 'tl' : code;
  const isPriority = PRIORITY_LTC_CODES.includes(code) || PRIORITY_LTC_CODES.includes(normalizedKey);

  return {
    code,
    name: seedMatch?.name || name || code,
    nativeName: seedMatch?.nativeName || PRIORITY_NATIVE_MAP[code] || name || code,
    speechCode: seedMatch?.speechCode || SPEECH_LOCALE_MAP[code] || code,
    supportSource: true,
    supportTarget: true,
    isPriority,
  };
}

/**
 * Fetches all supported languages dynamically from `/api/translate/languages`
 * (backed by Google Cloud Translation API v3 `getSupportedLanguages`).
 */
export async function fetchSupportedLanguages(forceRefresh = false): Promise<LanguagesState> {
  if (cachedLanguagesState && !forceRefresh) {
    return cachedLanguagesState;
  }
  if (inflightFetch && !forceRefresh) {
    return inflightFetch;
  }

  inflightFetch = (async () => {
    try {
      const res = await fetch('/api/translate/languages?displayLanguageCode=en');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const rawList: { code: string; name: string; supportSource?: boolean; supportTarget?: boolean }[] =
        Array.isArray(data?.languages) ? data.languages : [];

      if (rawList.length === 0) {
        throw new Error('Empty language list returned');
      }

      const seen = new Set<string>();
      const allMapped: SupportedLanguage[] = [];

      // Normalize 'fil' to 'tl' only if 'tl' isn't present; otherwise preserve API code
      for (const item of rawList) {
        if (!item?.code || seen.has(item.code)) continue;
        seen.add(item.code);
        const entry = buildLanguageEntry(item.code, item.name);
        entry.supportSource = item.supportSource ?? true;
        entry.supportTarget = item.supportTarget ?? true;
        allMapped.push(entry);
      }

      // Ensure core LTC languages (with speechCode mappings) are always present
      for (const seed of initialSeedLanguages) {
        const hasExact = allMapped.some((l) => l.code === seed.code);
        const hasAlias =
          (seed.code === 'zh' && allMapped.some((l) => l.code === 'zh-CN')) ||
          (seed.code === 'tl' && allMapped.some((l) => l.code === 'fil'));
        if (!hasExact && !hasAlias) {
          allMapped.push(seed);
        }
      }

      const priorityLanguages: SupportedLanguage[] = [];
      const otherLanguages: SupportedLanguage[] = [];

      for (const lang of allMapped) {
        if (lang.isPriority) {
          priorityLanguages.push(lang);
        } else {
          otherLanguages.push(lang);
        }
      }

      // Sort priority languages in familiar LTC order
      priorityLanguages.sort((a, b) => {
        const idxA = PRIORITY_LTC_CODES.indexOf(a.code);
        const idxB = PRIORITY_LTC_CODES.indexOf(b.code);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      otherLanguages.sort((a, b) => a.name.localeCompare(b.name));

      const nextState: LanguagesState = {
        languages: [...priorityLanguages, ...otherLanguages],
        priorityLanguages,
        otherLanguages,
        isLoading: false,
        source: data.source || 'google-cloud-translation-v3',
        latencyMs: typeof data.latency_ms === 'number' ? data.latency_ms : null,
      };

      cachedLanguagesState = nextState;
      return nextState;
    } catch (err) {
      console.warn('Failed to fetch dynamic languages from /api/translate/languages, using seed:', err);
      const fallbackState: LanguagesState = {
        languages: initialSeedLanguages,
        priorityLanguages: initialSeedLanguages,
        otherLanguages: [],
        isLoading: false,
        source: 'local-seed',
        latencyMs: null,
      };
      cachedLanguagesState = fallbackState;
      return fallbackState;
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

/**
 * React hook for dynamically populating language dropdowns from Google Cloud Translation v3.
 */
export function useSupportedLanguages() {
  const [state, setState] = useState<LanguagesState>(() => {
    if (cachedLanguagesState) return cachedLanguagesState;
    return {
      languages: initialSeedLanguages,
      priorityLanguages: initialSeedLanguages,
      otherLanguages: [],
      isLoading: true,
      source: 'loading',
      latencyMs: null,
    };
  });

  useEffect(() => {
    let mounted = true;
    fetchSupportedLanguages().then((res) => {
      if (mounted) setState(res);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const res = await fetchSupportedLanguages(true);
    setState(res);
  }, []);

  const getLanguageByCode = useCallback(
    (code: string): SupportedLanguage => {
      if (code === 'auto') {
        return {
          code: 'auto',
          speechCode: 'en-CA',
          name: 'Auto-Detect',
          nativeName: 'Auto-Detect Language',
        };
      }
      const found = state.languages.find(
        (l) => l.code.toLowerCase() === code.toLowerCase()
      );
      if (found) return found;
      return buildLanguageEntry(code, code.toUpperCase());
    },
    [state.languages]
  );

  return {
    ...state,
    refresh,
    getLanguageByCode,
  };
}
