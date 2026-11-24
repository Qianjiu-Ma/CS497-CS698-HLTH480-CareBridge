import { v3 } from '@google-cloud/translate';
import { GoogleGenAI } from '@google/genai';
import { performance } from 'perf_hooks';

const { TranslationServiceClient } = v3;

export interface SupportedLanguageDTO {
  code: string;
  name: string;
  supportSource: boolean;
  supportTarget: boolean;
}

export interface TranslationV3Response {
  translated_text: string;
  detected_source_language: string;
  translation_latency_ms: number;
  target_language: string;
  provider:
    | 'google-cloud-translation-v3'
    | 'google-cloud-translation-rest'
    | 'google-translate-service'
    | 'gemini-fallback';
  cached: boolean;
  fallback: boolean;
  warning?: string;
}

export interface SupportedLanguagesResponse {
  languages: SupportedLanguageDTO[];
  source: 'google-cloud-translation-v3' | 'google-cloud-translation-v2' | 'universal-catalog-fallback';
  cached: boolean;
  latency_ms: number;
}

// Configurable timeout & retry policy for Cloud Translation calls
const DEFAULT_TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS || 4500);
const DEFAULT_MAX_RETRIES = 2;

// In-memory cache for supported languages (1 hour TTL) to eliminate UI lag
let languagesCache: {
  data: SupportedLanguagesResponse | null;
  displayLang: string;
  expiresAt: number;
} = {
  data: null,
  displayLang: 'en',
  expiresAt: 0,
};

// In-memory LRU-like translation cache (max 500 entries, 30 min TTL)
const translationCache = new Map<
  string,
  {
    translated_text: string;
    detected_source_language: string;
    provider: TranslationV3Response['provider'];
    expiresAt: number;
  }
>();
const TRANSLATION_CACHE_MAX = 500;
const TRANSLATION_CACHE_TTL_MS = 30 * 60 * 1000;

// Lazily initialized Cloud Translation v3 client & circuit-breakers for unconfigured/unauthorized tiers
let v3Client: InstanceType<typeof TranslationServiceClient> | null = null;
let v3ClientInitAttempted = false;
let v3ClientDisabled = false;
let restApiKeyDisabled = false;

function isPlaceholderEnv(val?: string | null): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return /^(MY_|YOUR_|TODO|PLACEHOLDER|REPLACE_|CHANGEME|NONE|NULL|UNDEFINED)/i.test(trimmed);
}

function getProjectId(): string {
  const raw =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_PROJECT_ID ||
    '';
  return isPlaceholderEnv(raw) ? '' : raw.trim();
}

function getLocation(): string {
  const raw = process.env.GOOGLE_TRANSLATE_LOCATION || 'global';
  return isPlaceholderEnv(raw) ? 'global' : raw.trim();
}

function getValidTranslateApiKey(): string {
  if (restApiKeyDisabled) return '';
  const raw = process.env.GOOGLE_TRANSLATE_API_KEY || '';
  if (isPlaceholderEnv(raw)) return '';
  const trimmed = raw.trim();
  // Google API keys start with AIza; reject obvious non-key tokens/placeholders cleanly
  if (!trimmed.startsWith('AIza')) return '';
  return trimmed;
}

function getTranslationV3Client(): InstanceType<typeof TranslationServiceClient> | null {
  if (v3ClientDisabled) return null;
  if (v3Client) return v3Client;
  if (v3ClientInitAttempted) return null;
  v3ClientInitAttempted = true;

  const projectId = getProjectId();
  const credentialsPath = isPlaceholderEnv(process.env.GOOGLE_APPLICATION_CREDENTIALS)
    ? ''
    : (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  const credentialsJson = isPlaceholderEnv(process.env.GOOGLE_CLOUD_CREDENTIALS_JSON)
    ? ''
    : (process.env.GOOGLE_CLOUD_CREDENTIALS_JSON || '').trim();
  const hasAdc = Boolean(credentialsPath || credentialsJson);

  // Only instantiate the v3 gRPC/REST client if a GCP project or credentials are configured
  if (!projectId && !hasAdc) {
    return null;
  }

  try {
    const clientOptions: Record<string, any> = {};
    if (projectId) clientOptions.projectId = projectId;
    if (credentialsJson) {
      clientOptions.credentials = JSON.parse(credentialsJson);
    }
    v3Client = new TranslationServiceClient(clientOptions);
    return v3Client;
  } catch {
    v3ClientDisabled = true;
    return null;
  }
}

/**
 * Execute an async operation with a strict timeout and exponential backoff retry
 * on transient failures (timeouts, 429, 503, DEADLINE_EXCEEDED, UNAVAILABLE).
 */
async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  options: { timeoutMs?: number; maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? 150;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timer: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race<T>([
        operation(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Translation API timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      lastError = err;

      const msg = String(err?.message || err || '').toLowerCase();
      const code = err?.code;
      const isTransient =
        msg.includes('timed out') ||
        msg.includes('timeout') ||
        msg.includes('deadline_exceeded') ||
        msg.includes('unavailable') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        code === 4 || // DEADLINE_EXCEEDED
        code === 8 || // RESOURCE_EXHAUSTED
        code === 14 || // UNAVAILABLE
        code === 429 ||
        code === 503;

      if (!isTransient || attempt === maxRetries) {
        break;
      }

      const backoff = baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 60);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError;
}

/**
 * Normalize Cloud Translation language codes while preserving regional variants
 * like zh-CN, zh-TW, pt-BR, sr-Latn when explicitly returned or requested.
 */
function normalizeCloudLangCode(code?: string | null): string {
  if (!code) return '';
  const trimmed = code.trim();
  if (!trimmed || trimmed.toLowerCase() === 'auto') return 'auto';
  return trimmed;
}

/**
 * Fetch all supported languages dynamically using Google Cloud Translation API v3
 * `getSupportedLanguages`, with REST v2 and full Google Translate catalog fallbacks.
 */
export async function getSupportedLanguagesV3(
  displayLanguageCode: string = 'en'
): Promise<SupportedLanguagesResponse> {
  const now = Date.now();
  if (
    languagesCache.data &&
    languagesCache.displayLang === displayLanguageCode &&
    now < languagesCache.expiresAt
  ) {
    return {
      ...languagesCache.data,
      cached: true,
      latency_ms: 0,
    };
  }

  const startPerf = performance.now();
  const client = getTranslationV3Client();
  const projectId = getProjectId();
  const location = getLocation();

  // 1. Primary: Official Google Cloud Translation API v3 getSupportedLanguages
  if (client && projectId) {
    try {
      const [response] = await withTimeoutAndRetry(() =>
        client.getSupportedLanguages({
          parent: `projects/${projectId}/locations/${location}`,
          displayLanguageCode,
        })
      );

      const apiLanguages: SupportedLanguageDTO[] = (response.languages || [])
        .filter((l) => Boolean(l.languageCode))
        .map((l) => ({
          code: l.languageCode!,
          name: l.displayName || l.languageCode!,
          supportSource: l.supportSource ?? true,
          supportTarget: l.supportTarget ?? true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (apiLanguages.length > 0) {
        const result: SupportedLanguagesResponse = {
          languages: apiLanguages,
          source: 'google-cloud-translation-v3',
          cached: false,
          latency_ms: Math.max(1, Math.round(performance.now() - startPerf)),
        };
        languagesCache = {
          data: result,
          displayLang: displayLanguageCode,
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
        return result;
      }
    } catch (err: any) {
      const code = err?.code;
      const msg = String(err?.message || '').toLowerCase();
      if (
        code === 7 ||
        code === 16 ||
        msg.includes('unauthenticated') ||
        msg.includes('permission') ||
        msg.includes('could not load the default credentials')
      ) {
        v3ClientDisabled = true;
      } else {
        console.warn(
          '[TranslationService] Cloud Translation v3 getSupportedLanguages transient issue, using fallback:',
          err?.message || err
        );
      }
    }
  }

  // 2. Secondary: Cloud Translation v2 REST /languages if a valid GOOGLE_TRANSLATE_API_KEY is set
  const apiKey = getValidTranslateApiKey();
  if (apiKey) {
    try {
      const restLangs = await withTimeoutAndRetry(async () => {
        const controller = new AbortController();
        const url = `https://translation.googleapis.com/language/translate/v2/languages?key=${encodeURIComponent(
          apiKey
        )}&target=${encodeURIComponent(displayLanguageCode)}`;
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) {
          if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
            restApiKeyDisabled = true;
          }
          const err: any = new Error(`Translate v2 /languages HTTP ${resp.status}`);
          err.httpStatus = resp.status;
          throw err;
        }
        const json: any = await resp.json();
        return (json?.data?.languages || []).map((l: any) => ({
          code: l.language,
          name: l.name || l.language,
          supportSource: true,
          supportTarget: true,
        })) as SupportedLanguageDTO[];
      });

      if (restLangs.length > 0) {
        restLangs.sort((a, b) => a.name.localeCompare(b.name));
        const result: SupportedLanguagesResponse = {
          languages: restLangs,
          source: 'google-cloud-translation-v2',
          cached: false,
          latency_ms: Math.max(1, Math.round(performance.now() - startPerf)),
        };
        languagesCache = {
          data: result,
          displayLang: displayLanguageCode,
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
        return result;
      }
    } catch (err: any) {
      // Auth/key errors (400/401/403) disable the REST fallback cleanly so the app falls back to the universal catalog without noisy errors
      if (err?.httpStatus !== 400 && err?.httpStatus !== 401 && err?.httpStatus !== 403) {
        console.warn('[TranslationService] Translate v2 /languages fallback failed:', err?.message || err);
      }
    }
  }

  // 3. Universal Catalog Fallback (Full ISO-639 list supported by Google Cloud Translation v3)
  const fallbackLanguages = UNIVERSAL_GOOGLE_TRANSLATE_LANGUAGES.map((l) => ({
    ...l,
    supportSource: true,
    supportTarget: true,
  }));

  const result: SupportedLanguagesResponse = {
    languages: fallbackLanguages,
    source: 'universal-catalog-fallback',
    cached: false,
    latency_ms: Math.max(1, Math.round(performance.now() - startPerf)),
  };
  languagesCache = {
    data: result,
    displayLang: displayLanguageCode,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  return result;
}

/**
 * Translate text using Google Cloud Translation API (Advanced / v3) with exact latency
 * tracking (`translation_latency_ms`), timeout/retry handling, and graceful fallbacks.
 */
export async function translateTextV3(params: {
  text: string;
  sourceLang?: string;
  targetLang: string;
}): Promise<TranslationV3Response> {
  const trimmed = (params.text || '').trim();
  const rawSource = normalizeCloudLangCode(params.sourceLang || 'auto');
  const targetLang = normalizeCloudLangCode(params.targetLang || 'en') || 'en';

  if (!trimmed) {
    return {
      translated_text: '',
      detected_source_language: rawSource === 'auto' ? 'en' : rawSource,
      translation_latency_ms: 0,
      target_language: targetLang,
      provider: 'google-cloud-translation-v3',
      cached: false,
      fallback: false,
    };
  }

  // Exact cache lookup (fast path)
  const cacheKey = `${rawSource}::${targetLang}::${trimmed}`;
  const cachedEntry = translationCache.get(cacheKey);
  if (cachedEntry && Date.now() < cachedEntry.expiresAt) {
    return {
      translated_text: cachedEntry.translated_text,
      detected_source_language: cachedEntry.detected_source_language,
      translation_latency_ms: 1,
      target_language: targetLang,
      provider: cachedEntry.provider,
      cached: true,
      fallback: false,
    };
  }

  // Skip external network call if source and target are explicitly identical and not auto
  if (rawSource !== 'auto' && rawSource.toLowerCase() === targetLang.toLowerCase()) {
    return {
      translated_text: trimmed,
      detected_source_language: rawSource,
      translation_latency_ms: 1,
      target_language: targetLang,
      provider: 'google-cloud-translation-v3',
      cached: false,
      fallback: false,
    };
  }

  const client = getTranslationV3Client();
  const projectId = getProjectId();
  const location = getLocation();

  // Performance tracker starts right as the API request lifecycle begins
  const requestStartPerf = performance.now();

  // 1. Primary: Official Google Cloud Translation API v3 (`translateText`)
  if (client && projectId) {
    try {
      const request: Record<string, any> = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [trimmed],
        mimeType: 'text/plain',
        targetLanguageCode: targetLang,
      };
      if (rawSource && rawSource !== 'auto') {
        request.sourceLanguageCode = rawSource;
      }

      const [response] = await withTimeoutAndRetry(() => client.translateText(request));
      const latencyMs = Math.max(1, Math.round(performance.now() - requestStartPerf));

      const firstTranslation = response.translations?.[0];
      const translatedText = (firstTranslation?.translatedText || '').trim();
      const detectedSource =
        firstTranslation?.detectedLanguageCode || (rawSource === 'auto' ? 'und' : rawSource);

      if (translatedText) {
        setTranslationCache(cacheKey, {
          translated_text: translatedText,
          detected_source_language: detectedSource,
          provider: 'google-cloud-translation-v3',
        });

        return {
          translated_text: translatedText,
          detected_source_language: detectedSource,
          translation_latency_ms: latencyMs,
          target_language: targetLang,
          provider: 'google-cloud-translation-v3',
          cached: false,
          fallback: false,
        };
      }
    } catch (err: any) {
      const code = err?.code;
      const msg = String(err?.message || '').toLowerCase();
      if (
        code === 7 ||
        code === 16 ||
        msg.includes('unauthenticated') ||
        msg.includes('permission') ||
        msg.includes('could not load the default credentials')
      ) {
        v3ClientDisabled = true;
      } else {
        console.warn(
          '[TranslationService] Cloud Translation v3 translateText failed, invoking fallback:',
          err?.message || err
        );
      }
    }
  }

  // 2. Secondary: Google Cloud Translation REST API (when a valid GOOGLE_TRANSLATE_API_KEY is configured)
  const apiKey = getValidTranslateApiKey();
  if (apiKey) {
    try {
      const restResult = await withTimeoutAndRetry(async () => {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
          apiKey
        )}`;
        const body: Record<string, string> = {
          q: trimmed,
          target: targetLang,
          format: 'text',
        };
        if (rawSource && rawSource !== 'auto') {
          body.source = rawSource;
        }
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!resp.ok) {
          if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
            restApiKeyDisabled = true;
          }
          const err: any = new Error(`Cloud Translation REST API returned HTTP ${resp.status}`);
          err.httpStatus = resp.status;
          throw err;
        }
        const json: any = await resp.json();
        const item = json?.data?.translations?.[0];
        return {
          translatedText: (item?.translatedText || '').trim(),
          detectedSource: item?.detectedSourceLanguage || (rawSource === 'auto' ? 'und' : rawSource),
        };
      });

      const latencyMs = Math.max(1, Math.round(performance.now() - requestStartPerf));
      if (restResult.translatedText) {
        setTranslationCache(cacheKey, {
          translated_text: restResult.translatedText,
          detected_source_language: restResult.detectedSource,
          provider: 'google-cloud-translation-rest',
        });

        return {
          translated_text: restResult.translatedText,
          detected_source_language: restResult.detectedSource,
          translation_latency_ms: latencyMs,
          target_language: targetLang,
          provider: 'google-cloud-translation-rest',
          cached: false,
          fallback: false,
        };
      }
    } catch (err: any) {
      if (err?.httpStatus !== 400 && err?.httpStatus !== 401 && err?.httpStatus !== 403) {
        console.warn('[TranslationService] Cloud Translation REST fallback failed:', err?.message || err);
      }
    }
  }

  // 3. Tertiary: Official Google Translate GTX endpoint (zero-key resilience)
  try {
    const gtxResult = await withTimeoutAndRetry(async () => {
      const sl = rawSource === 'auto' ? 'auto' : rawSource;
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        sl
      )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Google Translate service returned HTTP ${resp.status}`);
      }
      const data: any = await resp.json();
      const translatedText = Array.isArray(data?.[0])
        ? data[0].map((part: any) => part?.[0] || '').join('').trim()
        : '';
      const detectedSource = data?.[2] || (rawSource === 'auto' ? 'und' : rawSource);
      return { translatedText, detectedSource };
    });

    const latencyMs = Math.max(1, Math.round(performance.now() - requestStartPerf));
    if (gtxResult.translatedText) {
      setTranslationCache(cacheKey, {
        translated_text: gtxResult.translatedText,
        detected_source_language: gtxResult.detectedSource,
        provider: 'google-translate-service',
      });

      return {
        translated_text: gtxResult.translatedText,
        detected_source_language: gtxResult.detectedSource,
        translation_latency_ms: latencyMs,
        target_language: targetLang,
        provider: 'google-translate-service',
        cached: false,
        fallback: true,
      };
    }
  } catch (err: any) {
    console.warn('[TranslationService] Google Translate service fallback failed:', err?.message || err);
  }

  // 4. Quaternary: Gemini API fallback if GEMINI_API_KEY is available
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const geminiOut = await withTimeoutAndRetry(async () => {
        const resp = await ai.models.generateContent({
          model: process.env.GEMINI_EXTRACTION_MODEL || 'gemini-2.5-flash',
          contents: `Translate the following long-term care handoff text to language code "${targetLang}". Preserve resident names, room numbers, and times. Return ONLY JSON: {"translated_text": "...", "detected_source_language": "iso-code"}.\n\nText:\n"""${trimmed}"""`,
          config: { responseMimeType: 'application/json' },
        });
        return JSON.parse(resp.text || '{}');
      });

      const latencyMs = Math.max(1, Math.round(performance.now() - requestStartPerf));
      if (geminiOut?.translated_text) {
        return {
          translated_text: String(geminiOut.translated_text).trim(),
          detected_source_language:
            geminiOut.detected_source_language || (rawSource === 'auto' ? 'und' : rawSource),
          translation_latency_ms: latencyMs,
          target_language: targetLang,
          provider: 'gemini-fallback',
          cached: false,
          fallback: true,
        };
      }
    } catch (err: any) {
      console.warn('[TranslationService] Gemini fallback failed:', err?.message || err);
    }
  }

  const finalLatency = Math.max(1, Math.round(performance.now() - requestStartPerf));
  throw new Error(`All translation providers failed after ${finalLatency}ms`);
}

function setTranslationCache(
  key: string,
  value: {
    translated_text: string;
    detected_source_language: string;
    provider: TranslationV3Response['provider'];
  }
) {
  if (translationCache.size >= TRANSLATION_CACHE_MAX) {
    const oldestKey = translationCache.keys().next().value;
    if (oldestKey) translationCache.delete(oldestKey);
  }
  translationCache.set(key, {
    ...value,
    expiresAt: Date.now() + TRANSLATION_CACHE_TTL_MS,
  });
}

/**
 * Comprehensive Google Cloud Translation v3 supported language catalog
 * used only when GCP credentials / API keys are unavailable in offline/demo environments.
 */
const UNIVERSAL_GOOGLE_TRANSLATE_LANGUAGES: { code: string; name: string }[] = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Albanian' },
  { code: 'am', name: 'Amharic' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hy', name: 'Armenian' },
  { code: 'as', name: 'Assamese' },
  { code: 'ay', name: 'Aymara' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'bm', name: 'Bambara' },
  { code: 'eu', name: 'Basque' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bho', name: 'Bhojpuri' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'yue', name: 'Cantonese' },
  { code: 'ca', name: 'Catalan' },
  { code: 'ceb', name: 'Cebuano' },
  { code: 'ny', name: 'Chichewa' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'co', name: 'Corsican' },
  { code: 'hr', name: 'Croatian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'dv', name: 'Dhivehi' },
  { code: 'doi', name: 'Dogri' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'et', name: 'Estonian' },
  { code: 'ee', name: 'Ewe' },
  { code: 'tl', name: 'Filipino (Tagalog)' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'fy', name: 'Frisian' },
  { code: 'gl', name: 'Galician' },
  { code: 'ka', name: 'Georgian' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gn', name: 'Guarani' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'ha', name: 'Hausa' },
  { code: 'haw', name: 'Hawaiian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hmn', name: 'Hmong' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'ig', name: 'Igbo' },
  { code: 'ilo', name: 'Ilocano' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ga', name: 'Irish' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jw', name: 'Javanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'km', name: 'Khmer' },
  { code: 'rw', name: 'Kinyarwanda' },
  { code: 'gom', name: 'Konkani' },
  { code: 'ko', name: 'Korean' },
  { code: 'kri', name: 'Krio' },
  { code: 'ku', name: 'Kurdish (Kurmanji)' },
  { code: 'ckb', name: 'Kurdish (Sorani)' },
  { code: 'ky', name: 'Kyrgyz' },
  { code: 'lo', name: 'Lao' },
  { code: 'la', name: 'Latin' },
  { code: 'lv', name: 'Latvian' },
  { code: 'ln', name: 'Lingala' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lg', name: 'Luganda' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'mai', name: 'Maithili' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'ms', name: 'Malay' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mt', name: 'Maltese' },
  { code: 'mi', name: 'Maori' },
  { code: 'mr', name: 'Marathi' },
  { code: 'mni-Mtei', name: 'Meiteilon (Manipuri)' },
  { code: 'lus', name: 'Mizo' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'my', name: 'Myanmar (Burmese)' },
  { code: 'ne', name: 'Nepali' },
  { code: 'no', name: 'Norwegian' },
  { code: 'or', name: 'Odia (Oriya)' },
  { code: 'om', name: 'Oromo' },
  { code: 'ps', name: 'Pashto' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'qu', name: 'Quechua' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sm', name: 'Samoan' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'gd', name: 'Scots Gaelic' },
  { code: 'nso', name: 'Sepedi' },
  { code: 'sr', name: 'Serbian' },
  { code: 'st', name: 'Sesotho' },
  { code: 'sn', name: 'Shona' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'si', name: 'Sinhala' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'so', name: 'Somali' },
  { code: 'es', name: 'Spanish' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sw', name: 'Swahili' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tg', name: 'Tajik' },
  { code: 'ta', name: 'Tamil' },
  { code: 'tt', name: 'Tatar' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'ti', name: 'Tigrinya' },
  { code: 'ts', name: 'Tsonga' },
  { code: 'tr', name: 'Turkish' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'ak', name: 'Twi' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'ug', name: 'Uyghur' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'cy', name: 'Welsh' },
  { code: 'xh', name: 'Xhosa' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'zu', name: 'Zulu' },
];
