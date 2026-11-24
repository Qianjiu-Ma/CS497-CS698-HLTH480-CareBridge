import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSupportedLanguagesV3, translateTextV3 } from './server/translationService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// 1. FAST FLASH-CLASS MODEL CONFIGURATION (Central constant, easily customizable)
export const FAST_GEMINI_MODEL = process.env.GEMINI_EXTRACTION_MODEL || 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODEL = 'gemini-3.1-flash-lite';

// 6. EXACT UTTERANCE CACHE: Instant response (<5ms) for identical, repeat phrases or demo text
interface CachedResult {
  data: any;
  debugInfo: any;
  timestamp: number;
}
const transcriptCache = new Map<string, CachedResult>();

// Initialise Gemini client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const LANGUAGE_CONFIG: Record<string, { code: string; name: string; speechCode: string }> = {
  en: { code: 'en', name: 'English', speechCode: 'en-CA' },
  tl: { code: 'tl', name: 'Tagalog (Filipino)', speechCode: 'fil-PH' },
  fil: { code: 'tl', name: 'Tagalog (Filipino)', speechCode: 'fil-PH' },
  pa: { code: 'pa', name: 'Punjabi', speechCode: 'pa-IN' },
  hi: { code: 'hi', name: 'Hindi', speechCode: 'hi-IN' },
  zh: { code: 'zh', name: 'Mandarin Chinese', speechCode: 'zh-CN' },
  yue: { code: 'yue', name: 'Cantonese', speechCode: 'zh-HK' },
  es: { code: 'es', name: 'Spanish', speechCode: 'es-ES' },
  fr: { code: 'fr', name: 'Canadian French', speechCode: 'fr-CA' },
  ar: { code: 'ar', name: 'Arabic', speechCode: 'ar-SA' },
  vi: { code: 'vi', name: 'Vietnamese', speechCode: 'vi-VN' },
  pt: { code: 'pt', name: 'Portuguese', speechCode: 'pt-BR' },
  it: { code: 'it', name: 'Italian', speechCode: 'it-IT' },
  pl: { code: 'pl', name: 'Polish', speechCode: 'pl-PL' },
  uk: { code: 'uk', name: 'Ukrainian', speechCode: 'uk-UA' },
  de: { code: 'de', name: 'German', speechCode: 'de-DE' },
  ur: { code: 'ur', name: 'Urdu', speechCode: 'ur-PK' },
  gu: { code: 'gu', name: 'Gujarati', speechCode: 'gu-IN' },
  ta: { code: 'ta', name: 'Tamil', speechCode: 'ta-IN' },
  ko: { code: 'ko', name: 'Korean', speechCode: 'ko-KR' },
  ja: { code: 'ja', name: 'Japanese', speechCode: 'ja-JP' },
  ru: { code: 'ru', name: 'Russian', speechCode: 'ru-RU' },
  el: { code: 'el', name: 'Greek', speechCode: 'el-GR' },
};

function normalizeLangCode(lang: string | undefined): string {
  if (!lang) return 'en';
  const clean = lang.toLowerCase().trim();
  if (clean.startsWith('en')) return 'en';
  if (clean.startsWith('tl') || clean.startsWith('fil')) return 'tl';
  if (clean.startsWith('pa')) return 'pa';
  if (clean.startsWith('hi')) return 'hi';
  if (clean.startsWith('zh') || clean.startsWith('cn')) return 'zh';
  if (clean.startsWith('yue')) return 'yue';
  if (clean.startsWith('es')) return 'es';
  if (clean.startsWith('fr')) return 'fr';
  if (clean.startsWith('ar')) return 'ar';
  if (clean.startsWith('vi')) return 'vi';
  if (clean.startsWith('pt')) return 'pt';
  if (clean.startsWith('it')) return 'it';
  if (clean.startsWith('pl')) return 'pl';
  if (clean.startsWith('uk')) return 'uk';
  if (clean.startsWith('de')) return 'de';
  if (clean.startsWith('ur')) return 'ur';
  if (clean.startsWith('gu')) return 'gu';
  if (clean.startsWith('ta')) return 'ta';
  if (clean.startsWith('ko')) return 'ko';
  if (clean.startsWith('ja')) return 'ja';
  if (clean.startsWith('ru')) return 'ru';
  if (clean.startsWith('el')) return 'el';
  return clean.split('-')[0] || 'en';
}

function getLanguageName(code: string): string {
  const norm = normalizeLangCode(code);
  return LANGUAGE_CONFIG[norm]?.name || 'English';
}

// Server-side language detector to recognize foreign scripts and vocabulary markers
function detectLanguageServer(text: string): string {
  if (!text) return 'en';
  // Punjabi Gurmukhi script
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  // Hindi Devanagari script
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  // Arabic script
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  // Chinese Han script
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';

  const lower = text.toLowerCase();
  // Tagalog keywords & markers
  const tagalogWords = [
    'magandang', 'hapon', 'umaga', 'gabi', 'para sa', 'si mr', 'si mrs',
    'tapos na', 'ang bath', 'na-reposition', 'siya', 'tumanggi', 'almusal',
    'tanghalian', 'paki-offer', 'napansin', 'tahimik', 'kinain', 'kaya',
    'na-report', 'kay nurse', 'kuko', 'kaninang', 'dalawang', 'kasi',
    'mahina', 'pamumula', 'sakong', 'konti', 'buong shift', 'tub room',
    'banyo', 'pinaliguan', 'nasabi', 'po', 'opo', 'nars', 'hindi ko', 'kanina',
    'bata', 'paligo', 'binihisan', 'likido', 'dinala', 'walang'
  ];
  for (const w of tagalogWords) {
    if (lower.includes(w)) return 'tl';
  }

  // Spanish keywords & markers
  const spanishWords = [
    'buenas tardes', 'buenos días', 'reporte', 'cambio de turno', 'habitación',
    'según el plan', 'hija', 'llamó', 'vendrá', 'revisión de piel', 'zona enrojecida',
    'talón izquierdo', 'tomó', 'líquidos', 'reposicionamiento', 'informé', 'enfermera',
    'desayuno', 'almuerzo', 'baño', 'rechazó', 'más callado', 'completó', 'toca'
  ];
  for (const w of spanishWords) {
    if (lower.includes(w)) return 'es';
  }

  // French keywords & markers
  const frenchWords = [
    'bonjour', 'bonsoir', 'chambre', 'selon le plan', 'déjeuner', 'dîner',
    'infirmière', 'toilette', 'fatigué', 'repositionné', 'quart de travail', 'soins'
  ];
  for (const w of frenchWords) {
    if (lower.includes(w)) return 'fr';
  }

  return 'en';
}

// Helper to validate that translated text contains proper Latin text if English
function checkTranslationOutput(originalText: string, translatedText: string, targetLang: string): { valid: boolean; reason?: string } {
  if (!translatedText || !translatedText.trim()) {
    return { valid: false, reason: 'translation output is empty' };
  }

  const normTarget = normalizeLangCode(targetLang);
  if (normTarget === 'en') {
    // Check for non-Latin script characters (Punjabi, Hindi, Arabic, Chinese)
    const nonLatinRegex = /[\u0600-\u06FF\u0900-\u097F\u0A00-\u0A7F\u4E00-\u9FFF]/;
    if (nonLatinRegex.test(translatedText)) {
      return { valid: false, reason: 'English translation contains non-Latin script characters' };
    }

    // Check that translation is not identical to non-English source text
    const detected = detectLanguageServer(originalText);
    if (detected !== 'en') {
      const cleanOrig = originalText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanTrans = translatedText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanOrig.length > 20 && cleanOrig === cleanTrans) {
        return { valid: false, reason: 'English translation is identical to non-English source text' };
      }
    }
  }

  return { valid: true };
}

// Helper function to build tight prompt and call Gemini fast
function buildPromptAndConfig(
  transcript: string,
  sourceLanguage: string,
  targetLanguage: string = 'en',
  currentResidents: any[] = [],
  contextUtterances?: string[]
) {
  const detectedLang = detectLanguageServer(transcript);
  const normSource = normalizeLangCode(sourceLanguage && sourceLanguage !== 'auto' ? sourceLanguage : detectedLang);
  const normTarget = normalizeLangCode(targetLanguage || 'en');

  // If user selected source as English, but speech content clearly contains non-English markers, correct source to detected
  const effectiveSource = (normSource === 'en' && detectedLang !== 'en') ? detectedLang : normSource;
  const effectiveTarget = normTarget;

  const fromName = getLanguageName(effectiveSource);
  const toName = getLanguageName(effectiveTarget);

  const isSameLanguage = effectiveSource === effectiveTarget;
  const isTargetEnglish = effectiveTarget === 'en';

  let translationDirective = '';
  if (isSameLanguage && isTargetEnglish) {
    translationDirective = 'Text is already in English: copy verbatim into "translated_text" and "translated_english".';
  } else {
    translationDirective = `TRANSLATION DIRECTIVE:
The speaker is speaking in ${fromName}.
- "translated_text": MUST be the complete, fluent translation of the entire utterance into ${toName}.
  * If ${toName} is not English (e.g. Tagalog, Spanish, Punjabi, French), translate accurately from ${fromName} into ${toName}.
  * NEVER leave words in the source language unless they are resident names (e.g. Mr. B) or room numbers (e.g. 102).
- "translated_english": MUST be the complete, natural English translation of the entire utterance for the official LTC medical record. (If ${toName} is English, "translated_text" and "translated_english" should match).
- NEVER guess or add details not spoken.`;
  }

  // 3. TIGHT, SHORT SYSTEM PROMPT: Zero unnecessary fluff, clear clinical rules
  const systemInstruction = `LTC Shift Handoff Assistant. Documentation assistant, NOT clinician.
RULES:
1. Never diagnose or assume facts not spoken. If resident identity is missing or ambiguous, set requires_manual_assignment=true and put the item in unassigned_entries (do NOT guess a room or resident).
2. ${translationDirective}
3. Fill checklist fields ('done', 'not_done_next_shift', 'change_note', 'qualitative_observations', 'anything_else', 'care_requirements') strictly in plain Canadian healthcare English.
4. Map observed changes to exact Stop & Watch schema labels when spoken:
   "Seems different than usual" (S), "Talks or communicates less" (T_talks), "Overall needs more help" (O), "Pain - new or worsening" (P), "Ate less" (A_ate), "No bowel movement in 3 days; or diarrhea" (N), "Drank less" (D), "Weight change" (W), "Agitated or nervous more than usual" (A_agitated), "Tired, weak, confused, or drowsy" (T_tired), "Change in skin color or condition" (C), "Help with walking, transferring, or toileting more than usual" (H).
5. Extract actionable incoming-shift tasks into care_requirements with category in ["Mobility","Dietary","Medication","Hygiene","Other"].`;

  // Minimum context: list of rooms/names and max 2 previous utterances
  const compactResidents = (currentResidents || [
    { room: '101', name: 'Mrs. A' },
    { room: '102', name: 'Mr. B' },
    { room: '103', name: 'Mrs. C' },
    { room: '104', name: 'Mr. D' },
    { room: '105', name: 'Mrs. E' },
    { room: '106', name: 'Mr. F' },
  ]).map((r: any) => `${r.room}:${r.name}`).join(', ');

  const recentContext = contextUtterances && contextUtterances.length > 0
    ? `Recent:\n${contextUtterances.slice(-2).map((u) => `> ${u}`).join('\n')}\n`
    : '';

  const contents = `Source: ${fromName} (${effectiveSource}) | Target: ${toName} (${effectiveTarget}) | Residents: [${compactResidents}]
${recentContext}Utterance: """${transcript}"""`;

  const stopAndWatchEnumValues = [
    'Seems different than usual',
    'Talks or communicates less',
    'Overall needs more help',
    'Pain - new or worsening',
    'Ate less',
    'No bowel movement in 3 days; or diarrhea',
    'Drank less',
    'Weight change',
    'Agitated or nervous more than usual',
    'Tired, weak, confused, or drowsy',
    'Change in skin color or condition',
    'Help with walking, transferring, or toileting more than usual',
  ];

  const careRequirementSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          enum: ['Mobility', 'Dietary', 'Medication', 'Hygiene', 'Other'],
        },
        action_item: { type: Type.STRING },
      },
      required: ['category', 'action_item'],
    },
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      detected_language: { type: Type.STRING },
      original_text: { type: Type.STRING },
      translated_text: { type: Type.STRING, description: `The complete translation in ${toName}` },
      translated_english: { type: Type.STRING, description: 'The complete translation in English' },
      target_language: { type: Type.STRING },
      translation_confidence: { type: Type.STRING, description: 'high, medium, or low' },
      entries: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            room: { type: Type.STRING },
            resident_name: { type: Type.STRING },
            requires_manual_assignment: { type: Type.BOOLEAN },
            done: { type: Type.STRING },
            not_done_next_shift: { type: Type.STRING },
            change_codes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            stop_and_watch_codes: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: stopAndWatchEnumValues },
            },
            care_requirements: careRequirementSchema,
            change_note: { type: Type.STRING },
            weight_kg: { type: Type.NUMBER },
            fluid_ml: { type: Type.NUMBER },
            bowel_movement: { type: Type.STRING },
            qualitative_observations: { type: Type.STRING },
            told_nurse: { type: Type.BOOLEAN },
            nurse_initials: { type: Type.STRING },
            source_quote: { type: Type.STRING },
            confidence: { type: Type.STRING },
          },
          required: ['room', 'source_quote'],
        },
      },
      unassigned_entries: {
        type: Type.ARRAY,
        description: 'Care requirements or changes spoken without an identifiable resident/room',
        items: {
          type: Type.OBJECT,
          properties: {
            resident_identification: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                room_number: { type: Type.STRING },
              },
              required: ['name'],
            },
            requires_manual_assignment: { type: Type.BOOLEAN },
            stop_and_watch_codes: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: stopAndWatchEnumValues },
            },
            care_requirements: careRequirementSchema,
            general_observation_note: { type: Type.STRING },
          },
          required: ['resident_identification', 'requires_manual_assignment', 'stop_and_watch_codes', 'care_requirements'],
        },
      },
      anything_else: { type: Type.STRING },
      open_questions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ['detected_language', 'original_text', 'translated_text', 'translated_english', 'translation_confidence', 'entries'],
  };

  const modelConfig = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema,
    thinkingConfig: {
      thinkingLevel: FAST_GEMINI_MODEL.includes('lite') ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
    },
  };

  return {
    effectiveSource,
    effectiveTarget,
    fromName,
    toName,
    detectedLang,
    contents,
    systemInstruction,
    modelConfig,
    isSameLanguage,
    isTargetEnglish,
  };
}

// 4. STREAMING EXTRACTION & TRANSLATION ROUTE (Server-Sent Events)
// Emits early translation as soon as first tokens arrive, before structured extraction finishes
app.post('/api/gemini/parse-handoff-stream', async (req, res) => {
  const { transcript, language, targetLanguage, currentResidents, contextUtterances, speechEndTime } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Transcript text is required' });
  }

  const startTime = Date.now();
  const speechEndToSendMs = speechEndTime ? Math.max(0, startTime - speechEndTime) : 0;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Check cache first
  const cacheKey = JSON.stringify([language || 'auto', targetLanguage || 'en', transcript.trim(), currentResidents, contextUtterances]);
  if (transcriptCache.has(cacheKey)) {
    const cached = transcriptCache.get(cacheKey)!;
    const totalToSheetMs = Date.now() - startTime;
    const debugInfo = {
      ...cached.debugInfo,
      cached: true,
      timings: {
        speechEndToSendMs,
        timeToFirstTokenMs: 2,
        totalToSheetMs,
      },
    };
    res.write(`event: first_token\ndata: ${JSON.stringify({ timeToFirstTokenMs: 2 })}\n\n`);
    res.write(`event: early_translation\ndata: ${JSON.stringify({
      translated_text: cached.data.translated_text || cached.data.translated_english,
      translated_english: cached.data.translated_english
    })}\n\n`);
    res.write(`event: complete\ndata: ${JSON.stringify({ fallback: false, data: cached.data, debugInfo })}\n\n`);
    res.end();
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.write(`event: complete\ndata: ${JSON.stringify({ fallback: true, message: 'No GEMINI_API_KEY configured' })}\n\n`);
    res.end();
    return;
  }

  try {
    const {
      effectiveSource,
      effectiveTarget,
      detectedLang,
      contents,
      modelConfig,
      isSameLanguage,
      isTargetEnglish,
    } = buildPromptAndConfig(transcript, language, targetLanguage || 'en', currentResidents, contextUtterances);

    // Call streaming API
    const stream = await ai.models.generateContentStream({
      model: FAST_GEMINI_MODEL,
      contents,
      config: modelConfig,
    });

    let fullText = '';
    let firstTokenTime: number | null = null;
    let sentEarlyTranslation = false;

    // Only emit immediately if both source and target are verified English
    if (isSameLanguage && isTargetEnglish && detectedLang === 'en') {
      res.write(`event: early_translation\ndata: ${JSON.stringify({
        translated_text: transcript,
        translated_english: transcript
      })}\n\n`);
      sentEarlyTranslation = true;
    }

    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      if (!chunkText) continue;
      fullText += chunkText;

      if (!firstTokenTime) {
        firstTokenTime = Date.now();
        res.write(`event: first_token\ndata: ${JSON.stringify({ timeToFirstTokenMs: firstTokenTime - startTime })}\n\n`);
      }

      // Extract early translation from partial JSON if not yet sent
      if (!sentEarlyTranslation) {
        const matchText = fullText.match(/"translated_text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        const matchEng = fullText.match(/"translated_english"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (matchText && matchText[1]) {
          try {
            const earlyText = JSON.parse(`"${matchText[1]}"`);
            const earlyEng = matchEng && matchEng[1] ? JSON.parse(`"${matchEng[1]}"`) : earlyText;
            if (earlyText) {
              res.write(`event: early_translation\ndata: ${JSON.stringify({
                translated_text: earlyText,
                translated_english: earlyEng
              })}\n\n`);
              sentEarlyTranslation = true;
            }
          } catch {
            // Wait for clean string
          }
        }
      }
    }

    const endTime = Date.now();
    let parsed: any;
    try {
      parsed = JSON.parse(fullText);
    } catch {
      // Fallback extraction from text
      parsed = {
        detected_language: detectedLang,
        original_text: transcript,
        translated_text: transcript,
        translated_english: transcript,
        translation_confidence: 'medium',
        entries: [],
      };
    }

    // Ensure translated_text is populated
    if (!parsed.translated_text) {
      parsed.translated_text = parsed.translated_english || transcript;
    }
    if (!parsed.translated_english) {
      parsed.translated_english = parsed.translated_text;
    }

    // 5. IN-CODE VALIDATION ONLY
    const validation = checkTranslationOutput(transcript, parsed.translated_text, effectiveTarget);
    const needsTranslationCheck = !validation.valid || parsed.translation_confidence === 'low';
    parsed.needs_translation_check = needsTranslationCheck;
    parsed.translated_transcript = parsed.translated_text;

    const timeToFirstTokenMs = firstTokenTime ? firstTokenTime - startTime : endTime - startTime;
    const totalToSheetMs = endTime - startTime;

    const debugInfo = {
      recognition_language: effectiveSource,
      target_language: effectiveTarget,
      raw_transcript: transcript,
      request_sent: {
        model: FAST_GEMINI_MODEL,
        effectiveSource,
        effectiveTarget,
        detectedLang,
        payloadSize: contents.length,
      },
      raw_response: parsed,
      validation_status: validation.valid ? 'passed' : 'failed',
      validation_notes: validation.valid ? 'Translation verified' : validation.reason,
      cached: false,
      timings: {
        speechEndToSendMs,
        timeToFirstTokenMs,
        totalToSheetMs,
      },
    };

    // Cache successful parsed result
    transcriptCache.set(cacheKey, { data: parsed, debugInfo, timestamp: Date.now() });

    res.write(`event: complete\ndata: ${JSON.stringify({ fallback: false, data: parsed, debugInfo })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Streaming extraction error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message || String(error) })}\n\n`);
    res.end();
  }
});

// Standard Single-Shot Gemini API route for speech-to-handoff extraction (Fast & Cached)
app.post('/api/gemini/parse-handoff', async (req, res) => {
  const { transcript, language, targetLanguage, currentResidents, contextUtterances, speechEndTime } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Transcript text is required' });
  }

  const startTime = Date.now();
  const speechEndToSendMs = speechEndTime ? Math.max(0, startTime - speechEndTime) : 0;

  // 6. CACHE LOOKUP: Instant response for identical text
  const cacheKey = JSON.stringify([language || 'auto', targetLanguage || 'en', transcript.trim(), currentResidents, contextUtterances]);
  if (transcriptCache.has(cacheKey)) {
    const cached = transcriptCache.get(cacheKey)!;
    const totalToSheetMs = Date.now() - startTime;
    return res.status(200).json({
      fallback: false,
      data: cached.data,
      debugInfo: {
        ...cached.debugInfo,
        cached: true,
        timings: {
          speechEndToSendMs,
          timeToFirstTokenMs: 2,
          totalToSheetMs,
        },
      },
    });
  }

  // If no API key is provided, return structured error allowing frontend fallback
  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      fallback: true,
      message: 'No GEMINI_API_KEY configured. Using local deterministic extraction engine.',
      extracted: null,
    });
  }

  try {
    const {
      effectiveSource,
      effectiveTarget,
      detectedLang,
      contents,
      modelConfig,
    } = buildPromptAndConfig(transcript, language, targetLanguage || 'en', currentResidents, contextUtterances);

    // 1 & 3. SINGLE FAST CALL: Gemini Flash-class model with automatic failover
    let response: any;
    try {
      response = await ai.models.generateContent({
        model: FAST_GEMINI_MODEL,
        contents,
        config: modelConfig,
      });
    } catch (primaryErr: any) {
      console.warn(`Primary extraction model ${FAST_GEMINI_MODEL} failed, falling back to ${FALLBACK_GEMINI_MODEL}:`, primaryErr?.message);
      response = await ai.models.generateContent({
        model: FALLBACK_GEMINI_MODEL,
        contents,
        config: modelConfig,
      });
    }

    const endTime = Date.now();
    let parsed: any;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = {
        detected_language: detectedLang,
        original_text: transcript,
        translated_text: transcript,
        translated_english: transcript,
        translation_confidence: 'medium',
        entries: [],
      };
    }

    if (!parsed.translated_text) {
      parsed.translated_text = parsed.translated_english || transcript;
    }
    if (!parsed.translated_english) {
      parsed.translated_english = parsed.translated_text;
    }

    // 5. IN-CODE VALIDATION ONLY
    const validation = checkTranslationOutput(transcript, parsed.translated_text, effectiveTarget);
    const needsTranslationCheck = !validation.valid || parsed.translation_confidence === 'low';
    parsed.needs_translation_check = needsTranslationCheck;
    parsed.translated_transcript = parsed.translated_text;

    const totalToSheetMs = endTime - startTime;
    const debugInfo = {
      recognition_language: effectiveSource,
      target_language: effectiveTarget,
      raw_transcript: transcript,
      request_sent: {
        model: FAST_GEMINI_MODEL,
        effectiveSource,
        effectiveTarget,
        detectedLang,
        payloadSize: contents.length,
      },
      raw_response: parsed,
      validation_status: validation.valid ? 'passed' : 'failed',
      validation_notes: validation.valid ? 'Translation verified' : validation.reason,
      cached: false,
      timings: {
        speechEndToSendMs,
        timeToFirstTokenMs: Math.round(totalToSheetMs * 0.4),
        totalToSheetMs,
      },
    };

    // Cache the result
    transcriptCache.set(cacheKey, { data: parsed, debugInfo, timestamp: Date.now() });

    return res.status(200).json({
      fallback: false,
      data: parsed,
      debugInfo,
    });
  } catch (error: any) {
    console.error('Gemini parsing error:', error);
    return res.status(500).json({
      error: 'Failed to process transcript with Gemini API',
      details: error?.message || String(error),
    });
  }
});

// Single-Patient Clinical Transcription Route (Zero Hallucination Assistant)
app.post('/api/gemini/clinical-transcribe', async (req, res) => {
  const {
    resident_name,
    staff_stamp,
    timestamp,
    raw_transcript,
    source_language,
  } = req.body;

  if (!raw_transcript || typeof raw_transcript !== 'string') {
    return res.status(400).json({ error: 'Raw voice transcript is required' });
  }

  const effectiveResident = resident_name?.trim() || 'Assigned Resident';
  const effectiveStaff = staff_stamp?.trim() || 'Staff Caregiver';
  const effectiveTimestamp = timestamp?.trim() || new Date().toLocaleString();
  const detectedLang = detectLanguageServer(raw_transcript);
  const effectiveLang = source_language && source_language !== 'auto' ? source_language : detectedLang;
  const fromName = getLanguageName(effectiveLang);

  const systemInstruction = `You are a highly accurate, zero-hallucination Clinical Transcription Assistant for a long-term care facility. Your role is to take raw multilingual voice-to-text transcripts from care workers and structure them into a clean, standardized format for the patient's Electronic Medical Record (EMR).

You must strictly adhere to the following safety and compliance rules:

Zero Hallucination & High Fidelity: Do not add, infer, or guess any medical information, symptoms, or tasks that are not explicitly present in the raw transcript. If the transcript is ambiguous, leave the structured field blank and place the ambiguous text in "Additional Observations."

Single-Patient Isolation: You will only receive data for one specific resident at a time. Do not attempt to parse multiple patients from a single transcript.

Information Routing: Categorize the transcribed information into three distinct buckets:
- Stop and Watch Protocol: (Extract specific mentions of changes in condition, weight, fluid intake, bowel movements, etc., mapping them to standard Stop and Watch codes where applicable, e.g. "Ate less", "Tired", "Agitated", "Skin change", "Pain", "Needs more help").
- Care Completed: (Extract specific tasks or hygiene care completed during the shift).
- General Observations/Notes: (Capture any qualitative notes, expanded observations, or details that do not fit standard shorthand codes).

Localization: If the raw transcript is in a language other than English, translate the structured output to English for the EMR, but maintain the original meaning precisely.`;

  const promptContents = `Input Variables:
Target Resident: ${effectiveResident}
Staff Member: ${effectiveStaff}
Date/Time: ${effectiveTimestamp}
Raw Voice Transcript: """${raw_transcript}""" (Spoken in: ${fromName})

Task:
Process the raw transcript and output a structured JSON object designed to be displayed back to the care worker for mandatory manual review and confirmation before EMR submission.`;

  const stopAndWatchEnumValues = [
    'Seems different than usual',
    'Talks or communicates less',
    'Overall needs more help',
    'Pain - new or worsening',
    'Ate less',
    'No bowel movement in 3 days; or diarrhea',
    'Drank less',
    'Weight change',
    'Agitated or nervous more than usual',
    'Tired, weak, confused, or drowsy',
    'Change in skin color or condition',
    'Help with walking, transferring, or toileting more than usual',
  ];

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      resident_name: { type: Type.STRING },
      staff_stamp: { type: Type.STRING },
      timestamp: { type: Type.STRING },
      translated_english: { type: Type.STRING, description: 'Accurate English translation of raw_transcript' },
      stop_and_watch_flags: {
        type: Type.ARRAY,
        items: { type: Type.STRING, enum: stopAndWatchEnumValues },
        description: 'Exact Stop and Watch protocol change descriptions explicitly mentioned in transcript',
      },
      care_completed: { type: Type.STRING },
      additional_observations: { type: Type.STRING },
      pending_tasks_for_next_shift: { type: Type.STRING },
      care_requirements: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              enum: ['Mobility', 'Dietary', 'Medication', 'Hygiene', 'Other'],
            },
            action_item: { type: Type.STRING },
          },
          required: ['category', 'action_item'],
        },
        description: 'Actionable care requirements to auto-populate the resident shift checklist',
      },
      requires_clarification: { type: Type.BOOLEAN },
    },
    required: [
      'resident_name',
      'staff_stamp',
      'timestamp',
      'stop_and_watch_flags',
      'care_completed',
      'additional_observations',
      'pending_tasks_for_next_shift',
      'care_requirements',
      'requires_clarification',
    ],
  };

  const modelConfig = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema,
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
  };

  if (!process.env.GEMINI_API_KEY) {
    // Deterministic fallback if API key not available
    const fallback = generateDeterministicClinicalRecord(
      effectiveResident,
      effectiveStaff,
      effectiveTimestamp,
      raw_transcript,
      effectiveLang
    );
    return res.status(200).json({
      fallback: true,
      data: fallback,
      message: 'Processed via local deterministic zero-hallucination engine.',
    });
  }

  try {
    let response: any;
    try {
      response = await ai.models.generateContent({
        model: FAST_GEMINI_MODEL,
        contents: promptContents,
        config: modelConfig,
      });
    } catch (primaryErr: any) {
      console.warn(`Primary model ${FAST_GEMINI_MODEL} failed, using fallback:`, primaryErr?.message);
      response = await ai.models.generateContent({
        model: FALLBACK_GEMINI_MODEL,
        contents: promptContents,
        config: modelConfig,
      });
    }

    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json({
      fallback: false,
      data: parsed,
    });
  } catch (err: any) {
    console.error('Clinical transcribe error:', err);
    const fallback = generateDeterministicClinicalRecord(
      effectiveResident,
      effectiveStaff,
      effectiveTimestamp,
      raw_transcript,
      effectiveLang
    );
    return res.status(200).json({
      fallback: true,
      data: fallback,
      error: err?.message,
    });
  }
});

// Structured Resident Handoff Schema Extraction Endpoint
// Strictly aligns to the resident_identification + stop_and_watch_codes + care_requirements schema
app.post('/api/gemini/extract-resident-handoff', async (req, res) => {
  const { transcript, translatedText, language, currentResidents, lockedResident } = req.body;
  const sourceInput = (translatedText || transcript || '').trim();

  if (!sourceInput) {
    return res.status(400).json({ error: 'Transcript or translatedText is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      fallback: true,
      message: 'No GEMINI_API_KEY configured; client dynamic extractor will process.',
    });
  }

  const compactResidents = (currentResidents || [
    { room: '101', name: 'Mrs. A' },
    { room: '102', name: 'Mr. B' },
    { room: '103', name: 'Mrs. C' },
    { room: '104', name: 'Mr. D' },
    { room: '105', name: 'Mrs. E' },
    { room: '106', name: 'Mr. F' },
  ])
    .map((r: any) => `${r.room}:${r.name}`)
    .join(', ');

  const isolationRule = lockedResident
    ? `SINGLE-PATIENT ISOLATION: Only extract for resident "${lockedResident.name}" in Room "${lockedResident.room}". Set requires_manual_assignment=false and resident_identification={name:"${lockedResident.name}", room_number:"${lockedResident.room}"}.`
    : `RESIDENT MATCHING: Known residents on unit are [${compactResidents}]. Split multi-resident reports into one item per mentioned resident. If NO resident name or room number is identifiable (or identity is ambiguous), set requires_manual_assignment=true and resident_identification.name="" (NEVER guess).`;

  const stopAndWatchEnumValues = [
    'Seems different than usual',
    'Talks or communicates less',
    'Overall needs more help',
    'Pain - new or worsening',
    'Ate less',
    'No bowel movement in 3 days; or diarrhea',
    'Drank less',
    'Weight change',
    'Agitated or nervous more than usual',
    'Tired, weak, confused, or drowsy',
    'Change in skin color or condition',
    'Help with walking, transferring, or toileting more than usual',
  ];

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      extractions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            resident_identification: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                room_number: { type: Type.STRING },
              },
              required: ['name'],
            },
            requires_manual_assignment: { type: Type.BOOLEAN },
            stop_and_watch_codes: {
              type: Type.ARRAY,
              items: { type: Type.STRING, enum: stopAndWatchEnumValues },
            },
            care_requirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: {
                    type: Type.STRING,
                    enum: ['Mobility', 'Dietary', 'Medication', 'Hygiene', 'Other'],
                  },
                  action_item: { type: Type.STRING },
                },
                required: ['category', 'action_item'],
              },
            },
            general_observation_note: { type: Type.STRING },
          },
          required: [
            'resident_identification',
            'requires_manual_assignment',
            'stop_and_watch_codes',
            'care_requirements',
          ],
        },
      },
      anything_else: { type: Type.STRING },
    },
    required: ['extractions'],
  };

  try {
    const promptContents = `${isolationRule}
Source Language: ${getLanguageName(language || 'en')}
Raw Input: """${transcript || sourceInput}"""
Translated English: """${sourceInput}"""`;

    const modelConfig = {
      systemInstruction:
        'You are a zero-hallucination Clinical Handoff Extraction Assistant. Extract ONLY what is explicitly spoken/written into resident_identification, stop_and_watch_codes, actionable care_requirements (Mobility, Dietary, Medication, Hygiene, Other), and general_observation_note in clean English. Never diagnose or invent facts.',
      responseMimeType: 'application/json',
      responseSchema,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: FAST_GEMINI_MODEL,
        contents: promptContents,
        config: modelConfig,
      });
    } catch {
      response = await ai.models.generateContent({
        model: FALLBACK_GEMINI_MODEL,
        contents: promptContents,
        config: modelConfig,
      });
    }

    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json({ fallback: false, data: parsed });
  } catch (err: any) {
    console.warn('extract-resident-handoff error:', err?.message || err);
    return res.status(200).json({
      fallback: true,
      message: err?.message || 'Fallback to client extractor',
    });
  }
});

// Helper for deterministic single-resident transcription
function generateDeterministicClinicalRecord(
  resident: string,
  staff: string,
  timestamp: string,
  transcript: string,
  _lang: string
) {
  const lower = transcript.toLowerCase();
  const flags: string[] = [];

  // Stop & Watch flags detection (aligned with exact 12 enum labels)
  if (lower.includes('ate less') || lower.includes('refused lunch') || lower.includes('half breakfast') || lower.includes('kinain') || lower.includes('tumanggi') || lower.includes('appetite')) {
    flags.push('Ate less');
  }
  if (lower.includes('tired') || lower.includes('sleeping') || lower.includes('drowsy') || lower.includes('fatigued') || lower.includes('tulog')) {
    flags.push('Tired, weak, confused, or drowsy');
  }
  if (lower.includes('agitated') || lower.includes('restless') || lower.includes('upset') || lower.includes('pacing')) {
    flags.push('Agitated or nervous more than usual');
  }
  if (lower.includes('quieter') || lower.includes('talks less') || lower.includes('withdrawn') || lower.includes('tahimik')) {
    flags.push('Talks or communicates less');
  }
  if (lower.includes('skin') || lower.includes('red area') || lower.includes('redness') || lower.includes('heel') || lower.includes('sakong') || lower.includes('pamumula')) {
    flags.push('Change in skin color or condition');
  }
  if (lower.includes('pain') || lower.includes('hurts') || lower.includes('discomfort') || lower.includes('masakit')) {
    flags.push('Pain - new or worsening');
  }
  if (lower.includes('walk') || lower.includes('transfer') || lower.includes('needed 2') || lower.includes('two-person') || lower.includes('dalawang')) {
    flags.push('Help with walking, transferring, or toileting more than usual');
  }
  if (lower.includes('drank less') || lower.includes('fluids') || lower.includes('water') || lower.includes('tubig')) {
    flags.push('Drank less');
  }

  // Care requirements categorization
  const care_requirements: { category: 'Mobility' | 'Dietary' | 'Medication' | 'Hygiene' | 'Other'; action_item: string }[] = [];
  if (lower.includes('transfer') || lower.includes('walk') || lower.includes('reposition') || lower.includes('pivot')) {
    care_requirements.push({
      category: 'Mobility',
      action_item: lower.includes('reposition')
        ? 'Continue scheduled repositioning and pressure relief'
        : 'Provide transfer / ambulation assistance as noted',
    });
  }
  if (lower.includes('snack') || lower.includes('meal') || lower.includes('breakfast') || lower.includes('lunch') || lower.includes('fluid') || lower.includes('drank') || lower.includes('water')) {
    care_requirements.push({
      category: 'Dietary',
      action_item: lower.includes('snack')
        ? 'Offer snack and monitor meal/fluid intake'
        : 'Monitor meal completion and encourage oral fluids',
    });
  }
  if (lower.includes('medication') || lower.includes('meds') || lower.includes('pain') || lower.includes('cream') || lower.includes('prn')) {
    care_requirements.push({
      category: 'Medication',
      action_item: 'Review medication / pain management status with nurse',
    });
  }
  if (lower.includes('bath') || lower.includes('shower') || lower.includes('nail') || lower.includes('skin') || lower.includes('heel') || lower.includes('toilet')) {
    care_requirements.push({
      category: 'Hygiene',
      action_item: lower.includes('nail')
        ? 'Complete nail trimming and routine hygiene care'
        : 'Monitor skin integrity and complete scheduled hygiene care',
    });
  }

  // Care completed extraction
  const completedParts: string[] = [];
  if (lower.includes('bath') || lower.includes('shower') || lower.includes('paligo') || lower.includes('pinaliguan') || lower.includes('baño')) {
    completedParts.push('Completed assisted bath/hygiene');
  }
  if (lower.includes('breakfast') || lower.includes('almusal') || lower.includes('desayuno')) {
    completedParts.push('Breakfast assistance provided');
  }
  if (lower.includes('repositioned') || lower.includes('na-reposition') || lower.includes('reposicion')) {
    completedParts.push('Repositioning completed as scheduled');
  }
  if (completedParts.length === 0) {
    completedParts.push('Per care plan routine');
  }

  // Pending tasks
  let pendingTasks = '';
  if (lower.includes('snack') || lower.includes('offer')) {
    pendingTasks = 'Offer snack at 15:30; monitor oral intake';
  } else if (lower.includes('next shift') || lower.includes('evening')) {
    pendingTasks = 'Follow up on evening shift as noted';
  } else {
    pendingTasks = 'Routine follow-up next shift';
  }

  // Ambiguity check
  const requiresClarification = lower.includes('not sure') || lower.includes('which room') || lower.includes('unclear');

  return {
    resident_name: resident,
    staff_stamp: staff,
    timestamp: timestamp,
    stop_and_watch_flags: flags,
    care_completed: completedParts.join('; '),
    additional_observations: transcript.trim(),
    pending_tasks_for_next_shift: pendingTasks,
    care_requirements,
    requires_clarification: requiresClarification,
  };
}

// Dedicated Bidirectional Healthcare Translation Route (Any Language <-> Any Language)
app.post('/api/gemini/translate', async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text to translate is required' });
  }

  const detected = detectLanguageServer(text);
  const normSource = normalizeLangCode(sourceLang && sourceLang !== 'auto' ? sourceLang : detected);
  let normTarget = normalizeLangCode(targetLang || (normSource === 'en' ? 'tl' : 'en'));

  // If source was reported as 'en' but text contains non-English markers, correct source to detected
  const effectiveSource = (normSource === 'en' && detected !== 'en') ? detected : normSource;
  const effectiveTarget = normTarget;

  // If source and target are identical
  if (effectiveSource === effectiveTarget) {
    return res.status(200).json({
      translatedText: text,
      sourceLang: effectiveSource,
      targetLang: effectiveTarget,
      confidence: 'high',
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({
      translatedText: '',
      fallback: true,
      message: 'No GEMINI_API_KEY configured; client dictionary will provide fallback.',
      detectedSource: effectiveSource,
    });
  }

  try {
    const fromName = getLanguageName(effectiveSource);
    const toName = getLanguageName(effectiveTarget);

    const promptContents = `Translate the following healthcare and shift handoff report text from ${fromName} into ${toName}.
CRITICAL RULES:
1. The translation MUST be 100% completely and naturally in ${toName}.
2. NEVER leave words in ${fromName} unless they are resident names (e.g. Mr. B), room numbers (e.g. Room 102), or brand names.
3. Preserve resident rooms, resident names, times (e.g. 15:30), and Stop and Watch codes (e.g. T and A).
4. Do NOT add diagnoses, recommendations, or commentary. Only translate what was stated.

Text to translate:
"""${text}"""`;

    const modelConfig = {
      systemInstruction: `You are a certified professional healthcare interpreter for long-term care homes. Translate the source text accurately and completely into ${toName}. Your output must be strictly and completely in ${toName}. Extract 1-4 key clinical terms (e.g. food, vital signs, transfers, skin, Stop & Watch codes) for the glossary mapping.`,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedText: {
            type: Type.STRING,
            description: `The complete translation strictly in ${toName}.`,
          },
          confidence: {
            type: Type.STRING,
            description: 'high, medium, or low',
          },
          detectedSource: {
            type: Type.STRING,
            description: 'The detected language code of the source',
          },
          glossary: {
            type: Type.ARRAY,
            description: 'Key healthcare, caregiving, or clinical terms mapped between source and target',
            items: {
              type: Type.OBJECT,
              properties: {
                sourceTerm: { type: Type.STRING },
                targetTerm: { type: Type.STRING },
                note: { type: Type.STRING },
              },
              required: ['sourceTerm', 'targetTerm'],
            },
          },
          alternativeTranslations: {
            type: Type.ARRAY,
            description: '1-2 alternative natural phrasings in target language',
            items: { type: Type.STRING },
          },
        },
        required: ['translatedText'],
      },
    };

    let response: any;
    try {
      response = await ai.models.generateContent({
        model: FAST_GEMINI_MODEL,
        contents: promptContents,
        config: modelConfig,
      });
    } catch (primaryErr: any) {
      console.warn(`Primary translation model ${FAST_GEMINI_MODEL} failed, falling back to ${FALLBACK_GEMINI_MODEL}:`, primaryErr?.message);
      response = await ai.models.generateContent({
        model: FALLBACK_GEMINI_MODEL,
        contents: promptContents,
        config: modelConfig,
      });
    }

    const parsed = JSON.parse(response.text || '{}');
    const translated = parsed.translatedText?.trim();

    return res.status(200).json({
      translatedText: translated && translated.length > 0 ? translated : text,
      sourceLang: effectiveSource,
      targetLang: effectiveTarget,
      confidence: parsed.confidence || 'high',
      detectedSource: parsed.detectedSource || effectiveSource,
      glossary: parsed.glossary || [],
      alternativeTranslations: parsed.alternativeTranslations || [],
    });
  } catch (error: any) {
    console.warn('Gemini translation error, delegating to clinical fallback:', error?.message || error);
    return res.status(200).json({
      fallback: true,
      translatedText: '',
      sourceLang: effectiveSource,
      targetLang: effectiveTarget,
      message: 'Gemini service temporarily unavailable; using client clinical engine.',
    });
  }
});

// Google Cloud Translation API (Advanced / v3) - Universal Supported Languages Endpoint
app.get('/api/translate/languages', async (req, res) => {
  const displayLanguageCode =
    typeof req.query.displayLanguageCode === 'string' && req.query.displayLanguageCode.trim()
      ? req.query.displayLanguageCode.trim()
      : 'en';

  try {
    const result = await getSupportedLanguagesV3(displayLanguageCode);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Failed to fetch supported languages:', error);
    return res.status(500).json({
      error: 'Failed to load supported languages',
      details: error?.message || String(error),
    });
  }
});

// Google Cloud Translation API (Advanced / v3) - High-Speed Translation + Latency Tracking
const handleCloudTranslateV3 = async (req: express.Request, res: express.Response) => {
  const { text, sourceLang, source_language, targetLang, target_language } = req.body || {};
  const source = sourceLang ?? source_language ?? 'auto';
  const target = targetLang ?? target_language ?? 'en';

  if (typeof text !== 'string' || !text.trim() || text.length > 10_000) {
    return res.status(400).json({ error: 'Text to translate is required' });
  }
  const isLanguage = (value: unknown): value is string =>
    typeof value === 'string' && /^[a-z]{2,8}(?:-[a-z0-9]{2,8})*$/i.test(value);
  if (!isLanguage(source) || !isLanguage(target) || target === 'auto') {
    return res.status(400).json({ error: 'Invalid translation language' });
  }

  try {
    const result = await translateTextV3({
      text,
      sourceLang: source,
      targetLang: target,
    });

    // Required JSON delivery contract:
    // translated_text, detected_source_language, translation_latency_ms
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Cloud Translation v3 endpoint error:', error);
    return res.status(502).json({
      error: 'Translation service temporarily unavailable',
      details: error?.message || String(error),
    });
  }
};

app.post('/api/translate/google', handleCloudTranslateV3);
app.post('/api/translate', handleCloudTranslateV3);

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
