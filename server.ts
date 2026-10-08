import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Set payload limit for audio chunks (up to 60MB base64)
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Always ensure JSON responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Initialize shared Gemini client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Models configuration with fallback support
const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];

// Circuit Breaker State for API resilience
interface CircuitBreakerState {
  consecutive503s: number;
  openUntil: number; // timestamp ms
  threshold: number;
  coolDownDurationMs: number;
}

const circuitBreaker: CircuitBreakerState = {
  consecutive503s: 0,
  openUntil: 0,
  threshold: 3,
  coolDownDurationMs: 15000, // 15s cool-down when tripped
};

export interface SubtitleSegment {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  confidence: number;
  speaker?: string;
  flaggedForReview?: boolean;
  reviewReason?: string;
  timingScore?: number;
  timingWarnings?: string[];
  speechOnset?: number;
  speechOffset?: number;
  startDelayMs?: number;
  endDelayMs?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

/**
 * Classifies any error (from SDK, fetch, or HTTP) into Retryable vs Non-retryable
 */
function classifyError(error: any): {
  isRetryable: boolean;
  code: number;
  status: string;
  message: string;
  retryAfterSeconds: number;
} {
  const errStr = (error?.message || String(error) || '').toLowerCase();
  const statusCode =
    error?.status ||
    error?.statusCode ||
    error?.response?.status ||
    error?.error?.code ||
    500;

  // Check for HTTP 429 Rate Limit
  if (
    statusCode === 429 ||
    errStr.includes('429') ||
    errStr.includes('resource_exhausted') ||
    errStr.includes('quota')
  ) {
    const retryHeader = error?.response?.headers?.get?.('retry-after');
    const retryAfter = retryHeader ? parseInt(retryHeader, 10) : 10;
    return {
      isRetryable: true,
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: 'Rate limit encountered. Retrying with backoff.',
      retryAfterSeconds: isNaN(retryAfter) ? 10 : Math.max(5, retryAfter),
    };
  }

  // Check for 503 / Model Unavailability / Server Busy
  if (
    statusCode === 503 ||
    errStr.includes('503') ||
    errStr.includes('unavailable') ||
    errStr.includes('high demand') ||
    errStr.includes('spikes in demand') ||
    errStr.includes('overloaded') ||
    errStr.includes('server busy') ||
    errStr.includes('temporarily unavailable')
  ) {
    return {
      isRetryable: true,
      code: 503,
      status: 'UNAVAILABLE',
      message: 'This model is currently experiencing high demand. Retrying automatically...',
      retryAfterSeconds: 6,
    };
  }

  // Check other temporary network or gateway errors (500, 502, 504, socket errors)
  if (
    statusCode === 502 ||
    statusCode === 504 ||
    statusCode === 500 ||
    errStr.includes('econnreset') ||
    errStr.includes('etimedout') ||
    errStr.includes('socket hang up') ||
    errStr.includes('fetch failed') ||
    errStr.includes('network error') ||
    errStr.includes('timeout')
  ) {
    return {
      isRetryable: true,
      code: statusCode || 500,
      status: 'SERVER_ERROR',
      message: 'Temporary server or network hiccup. Retrying...',
      retryAfterSeconds: 5,
    };
  }

  // Non-retryable client errors (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found)
  if ([400, 401, 403, 404].includes(statusCode)) {
    return {
      isRetryable: false,
      code: statusCode,
      status: 'INVALID_REQUEST',
      message: error?.message || 'Invalid request configuration.',
      retryAfterSeconds: 0,
    };
  }

  // Default to retryable with standard backoff for unknown SDK exceptions
  return {
    isRetryable: true,
    code: 500,
    status: 'TEMPORARY_ERROR',
    message: error?.message || 'Temporary AI processing error.',
    retryAfterSeconds: 5,
  };
}

// Normalizes Khmer subtitle text by removing spaces between Khmer words
function normalizeKhmerSubtitleText(text: string): string {
  if (!text) return '';
  let result = text.trim();
  result = result.replace(/\s*\|\s*/g, '');
  const khmerBetweenRegex = /([\u1780-\u17FF\u19E0-\u19FF])\s+([\u1780-\u17FF\u19E0-\u19FF])/g;
  while (khmerBetweenRegex.test(result)) {
    result = result.replace(khmerBetweenRegex, '$1$2');
  }
  result = result.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  result = result.replace(/[ \t]+/g, ' ').trim();
  return result;
}

// Joins words: NO space between Khmer words, standard space for English/mixed words
function joinKhmerWords(words: string[]): string {
  if (!words || words.length === 0) return '';
  const filtered = words.map((w) => String(w || '').trim()).filter(Boolean);
  if (filtered.length === 0) return '';

  let combined = '';
  for (let i = 0; i < filtered.length; i++) {
    const curr = filtered[i];
    if (i === 0) {
      combined = curr;
    } else {
      const prev = filtered[i - 1];
      const prevIsKhmer = /[\u1780-\u17FF\u19E0-\u19FF]$/.test(prev);
      const currIsKhmer = /^[\u1780-\u17FF\u19E0-\u19FF]/.test(curr);
      if (prevIsKhmer && currIsKhmer) {
        combined += curr;
      } else {
        combined += ' ' + curr;
      }
    }
  }
  return normalizeKhmerSubtitleText(combined);
}

// Constants for ultra-accurate speech-grounded timing (User timing rules 1, 3, 4, 5, 9, 11, 12, 13)
const MIN_GAP_BETWEEN_SUBTITLES_SEC = 0.02; // 20ms minimal clearance for CapCut
const SILENCE_POSSIBLE_PAUSE_SEC = 0.25;    // >= 250ms silence is a possible phrase boundary
const SILENCE_STRONG_PAUSE_SEC = 0.40;      // >= 400ms silence strongly requires creating a new subtitle
const SUBTITLE_START_OFFSET = 0;            // Zero artificial delay

// Splits a segment into natural 2-3 Khmer words based strictly on actual spoken audio word timestamps
function splitIntoShortSegments(seg: any, timeOffset: number): any[] {
  // Case 1: Word-level timestamps directly from speech recognition
  if (Array.isArray(seg.words) && seg.words.length > 0) {
    const rawWords = seg.words
      .filter((w: any) => w && (w.word || w.text) && String(w.word || w.text).trim())
      .map((w: any) => ({
        word: String(w.word || w.text).trim(),
        start: Math.round(((Number(w.start) || 0) + timeOffset) * 1000) / 1000,
        end: Math.round(((Number(w.end) || 0) + timeOffset) * 1000) / 1000,
        confidence: typeof w.confidence === 'number' ? Math.round(w.confidence) : 95,
      }))
      .sort((a: any, b: any) => a.start - b.start);

    if (rawWords.length === 0) return [seg];

    // Detect silence between words:
    // >= 400ms: hard boundary
    // >= 250ms: boundary if current cluster already has words
    const phraseClusters: any[][] = [];
    let currentCluster: any[] = [rawWords[0]];

    for (let w = 1; w < rawWords.length; w++) {
      const prevWord = rawWords[w - 1];
      const currWord = rawWords[w];
      const pauseGap = currWord.start - prevWord.end;

      if (pauseGap >= SILENCE_STRONG_PAUSE_SEC || (pauseGap >= SILENCE_POSSIBLE_PAUSE_SEC && currentCluster.length >= 1)) {
        phraseClusters.push(currentCluster);
        currentCluster = [currWord];
      } else {
        currentCluster.push(currWord);
      }
    }
    if (currentCluster.length > 0) {
      phraseClusters.push(currentCluster);
    }

    // Within each cluster:
    // Target is approximately 2-3 words.
    // BUT TIMING ACCURACY HAS HIGHER PRIORITY:
    // - If speaker says only 1 word before a pause, keep 1 word.
    // - If 4 words spoken continuously without a pause (< 2.0s duration), keep them together!
    const result: any[] = [];
    for (const cluster of phraseClusters) {
      if (cluster.length <= 3) {
        // 1, 2, or 3 words - keep as a single subtitle
        const speechOnset = cluster[0].start;
        const speechOffset = cluster[cluster.length - 1].end;
        const text = joinKhmerWords(cluster.map((w: any) => w.word));
        const avgConf = Math.round(
          cluster.reduce((acc: number, w: any) => acc + (w.confidence || 90), 0) / cluster.length
        );

        result.push({
          start: speechOnset,
          end: Math.max(speechOnset + 0.25, speechOffset),
          speechOnset,
          speechOffset,
          startDelayMs: 0,
          endDelayMs: 0,
          text,
          confidence: avgConf,
          speaker: seg.speaker,
          words: cluster,
        });
        continue;
      }

      if (cluster.length === 4) {
        const clusterDuration = cluster[3].end - cluster[0].start;
        if (clusterDuration <= 2.2) {
          // 4 words spoken continuously without natural pause: remain together
          const speechOnset = cluster[0].start;
          const speechOffset = cluster[3].end;
          const text = joinKhmerWords(cluster.map((w: any) => w.word));
          const avgConf = Math.round(
            cluster.reduce((acc: number, w: any) => acc + (w.confidence || 90), 0) / 4
          );

          result.push({
            start: speechOnset,
            end: Math.max(speechOnset + 0.25, speechOffset),
            speechOnset,
            speechOffset,
            startDelayMs: 0,
            endDelayMs: 0,
            text,
            confidence: avgConf,
            speaker: seg.speaker,
            words: cluster,
          });
          continue;
        }
      }

      // Divide longer clusters into 2-3 word segments
      let i = 0;
      while (i < cluster.length) {
        const remaining = cluster.length - i;
        const take = remaining === 4 ? 2 : Math.min(3, remaining);
        const slice = cluster.slice(i, i + take);
        const text = joinKhmerWords(slice.map((w: any) => w.word));

        // PRIMARY TIMING RULE (Rule 3 & 4):
        // subtitle.start = exact start timestamp of the FIRST spoken word
        // subtitle.end   = exact end timestamp of the LAST spoken word
        const speechOnset = slice[0].start;
        const speechOffset = slice[slice.length - 1].end;

        const start = speechOnset + SUBTITLE_START_OFFSET;
        let end = speechOffset;
        if (end - start < 0.25) end = start + 0.25;

        const avgConf = Math.round(
          slice.reduce((acc: number, w: any) => acc + (w.confidence || 90), 0) / slice.length
        );

        result.push({
          start: Math.round(start * 1000) / 1000,
          end: Math.round(end * 1000) / 1000,
          speechOnset,
          speechOffset,
          startDelayMs: 0,
          endDelayMs: 0,
          text,
          confidence: avgConf,
          speaker: seg.speaker,
          words: slice,
        });

        i += take;
      }
    }
    return result;
  }

  // Case 2: Text has spaces separating words (fallback if words array omitted)
  const text = (seg.text || '').trim();
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length > 3) {
    const result: any[] = [];
    const totalChars = Math.max(1, text.length);
    const duration = Math.max(0.6, seg.end - seg.start);
    let i = 0;
    let currentStart = seg.start;

    while (i < tokens.length) {
      const remaining = tokens.length - i;
      const take = remaining === 4 ? 2 : Math.min(3, remaining);
      const slice = tokens.slice(i, i + take);
      const subText = joinKhmerWords(slice);
      const portion = Math.max(0.2, subText.length / totalChars);
      const subDuration = Math.max(0.4, duration * portion);
      const subEnd = Math.min(seg.end, currentStart + subDuration);

      result.push({
        start: Math.round(currentStart * 1000) / 1000,
        end: Math.round(subEnd * 1000) / 1000,
        speechOnset: currentStart,
        speechOffset: subEnd,
        startDelayMs: 0,
        endDelayMs: 0,
        text: subText,
        confidence: seg.confidence,
        speaker: seg.speaker,
      });

      currentStart = subEnd;
      i += take;
    }
    return result;
  }

  // Already 1-3 words
  return [{ ...seg, text: normalizeKhmerSubtitleText(seg.text || '') }];
}

// Validation and timing refinement helper for Khmer text & timestamps
function validateAndCleanSegments(
  rawSegments: any[],
  timeOffset: number,
  chunkDuration: number
): SubtitleSegment[] {
  // First, decompose any segment into natural 2-3 word segments aligned with speech
  const decomposed: any[] = [];
  for (const raw of rawSegments) {
    if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) continue;
    const subList = splitIntoShortSegments(raw, timeOffset);
    decomposed.push(...subList);
  }

  const cleaned: SubtitleSegment[] = [];

  for (let i = 0; i < decomposed.length; i++) {
    const raw = decomposed[i];
    if (!raw || typeof raw.text !== 'string' || !raw.text.trim()) continue;

    let start = Number(raw.start);
    let end = Number(raw.end);

    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end <= start) end = start + 0.8;

    const confidence =
      typeof raw.confidence === 'number'
        ? Math.min(100, Math.max(10, Math.round(raw.confidence)))
        : 92;
    const text = normalizeKhmerSubtitleText(raw.text);
    const speaker = raw.speaker ? String(raw.speaker).trim() : 'Speaker 1';
    const flagged = Boolean(raw.flaggedForReview || confidence < 75);
    const reason =
      raw.reviewReason ||
      (flagged ? 'Low audio clarity or ambiguous Khmer phonetics' : undefined);

    let speechOnset = typeof raw.speechOnset === 'number' ? raw.speechOnset : start;
    let speechOffset = typeof raw.speechOffset === 'number' ? raw.speechOffset : end;

    let words = raw.words;
    if (Array.isArray(words) && words.length > 0) {
      words = words.map((w: any) => ({
        word: String(w.word || w.text || ''),
        start: Math.round(Number(w.start || start) * 1000) / 1000,
        end: Math.round(Number(w.end || end) * 1000) / 1000,
        confidence: Number(w.confidence) || confidence,
      }));

      // ABSOLUTE TIMING RULE (Rule 3 & 4):
      // subtitle.start = exact start timestamp of the FIRST spoken word
      // subtitle.end   = exact end timestamp of the LAST spoken word
      speechOnset = words[0].start;
      speechOffset = words[words.length - 1].end;
      start = speechOnset;
      end = speechOffset;
    }

    const startDelayMs = Math.round((start - speechOnset) * 1000);
    const endDelayMs = Math.round((end - speechOffset) * 1000);

    cleaned.push({
      id: i + 1,
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
      text,
      confidence,
      speaker,
      flaggedForReview: flagged,
      reviewReason: reason,
      speechOnset,
      speechOffset,
      startDelayMs,
      endDelayMs,
      words,
    });
  }

  // Sort by start time
  cleaned.sort((a, b) => a.start - b.start);

  // ANTI-LAG OVERLAP RESOLUTION:
  // Subtitle start time must ALWAYS match the first spoken word start time.
  // NEVER delay curr.start into the future. Instead, truncate prev.end so prev subtitle
  // cleanly clears before curr starts!
  for (let i = 1; i < cleaned.length; i++) {
    const prev = cleaned[i - 1];
    const curr = cleaned[i];

    if (curr.start < prev.end + MIN_GAP_BETWEEN_SUBTITLES_SEC) {
      const maxAllowedPrevEnd = curr.start - MIN_GAP_BETWEEN_SUBTITLES_SEC;
      if (maxAllowedPrevEnd > prev.start + 0.15) {
        prev.end = Math.round(maxAllowedPrevEnd * 1000) / 1000;
      } else {
        prev.end = Math.max(prev.start + 0.15, maxAllowedPrevEnd);
        if (curr.start <= prev.end) {
          curr.start = Math.round((prev.end + MIN_GAP_BETWEEN_SUBTITLES_SEC) * 1000) / 1000;
        }
      }
      prev.end = Math.round(prev.end * 1000) / 1000;
      curr.start = Math.round(curr.start * 1000) / 1000;
    }
  }

  // CRITICAL SYNC VALIDATION (Rule 13)
  for (const seg of cleaned) {
    let accuracyScore = 99;
    const warnings: string[] = [];

    const onset = seg.speechOnset ?? seg.start;
    const offset = seg.speechOffset ?? seg.end;

    // START_ERROR = SUBTITLE_START - FIRST_WORD_START
    // END_ERROR   = SUBTITLE_END   - LAST_WORD_END
    const startError = seg.start - onset;
    const endError = seg.end - offset;

    // If > 0.15s: automatically recalculate the subtitle timing
    // If > 0.30s: mark as critical timing error and auto-correct
    if (Math.abs(startError) > 0.30 || Math.abs(endError) > 0.30) {
      accuracyScore -= 30;
      warnings.push(`Critical timing discrepancy (|start_err|=${(Math.abs(startError)*1000).toFixed(0)}ms) - auto-corrected`);
      seg.start = onset;
      seg.end = offset;
      seg.flaggedForReview = true;
    } else if (Math.abs(startError) > 0.15 || Math.abs(endError) > 0.15) {
      accuracyScore -= 15;
      warnings.push(`Timing adjusted to audio onset (${(startError*1000).toFixed(0)}ms)`);
      seg.start = onset;
      seg.end = offset;
    } else if (Math.abs(startError) > 0.08) {
      accuracyScore -= 5;
      warnings.push(`Minor offset (${(startError*1000).toFixed(0)}ms)`);
      seg.start = onset;
    }

    if (seg.end <= seg.start) {
      seg.end = seg.start + 0.25;
    }

    seg.start = Math.round(seg.start * 1000) / 1000;
    seg.end = Math.round(seg.end * 1000) / 1000;
    seg.startDelayMs = Math.round((seg.start - onset) * 1000);
    seg.endDelayMs = Math.round((seg.end - offset) * 1000);
    seg.timingScore = Math.max(65, Math.min(99, accuracyScore));
    seg.timingWarnings = warnings;
  }

  return cleaned;
}

// POST /api/transcribe-chunk
// Main audio chunk speech-to-text with model fallback & circuit breaker protection
app.post('/api/transcribe-chunk', async (req: Request, res: Response) => {
  // Check Circuit Breaker
  if (Date.now() < circuitBreaker.openUntil) {
    const remainingSec = Math.ceil((circuitBreaker.openUntil - Date.now()) / 1000);
    res.status(503).json({
      success: false,
      retryable: true,
      retryAfter: Math.max(2, remainingSec),
      error: {
        code: 503,
        status: 'UNAVAILABLE',
        message: 'AI service is temporarily busy. Waiting before continuing...',
      },
    });
    return;
  }

  const {
    audioBase64,
    mimeType = 'audio/wav',
    chunkIndex = 0,
    totalChunks = 1,
    timeOffset = 0,
    chunkDuration = 45,
    settings = {},
    preferredModel,
  } = req.body;

  if (!audioBase64) {
    res.status(400).json({
      success: false,
      retryable: false,
      error: { code: 400, message: 'Missing audioBase64 in request body' },
    });
    return;
  }

  if (!apiKey) {
    res.status(500).json({
      success: false,
      retryable: false,
      error: {
        code: 500,
        message: 'GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.',
      },
    });
    return;
  }

  const {
    mode = 'accuracy',
    speakerDetection = false,
    autoKhmerCorrection = true,
    punctuation = true,
    maxCharsPerLine = 42,
    minDuration = 0.8,
    maxDuration = 6.0,
  } = settings;

  const systemInstruction = `You are an elite, specialized Khmer Speech-to-Text and Subtitle Timing Engine designed specifically for Cambodian video creators (TikTok, YouTube, Facebook Reels, CapCut).

CRITICAL ANTI-LAG TIMING RULE:
- THE SUBTITLE MUST APPEAR AT THE EXACT INSTANT THE SPEAKER STARTS UTTERING THE FIRST WORD SOUND.
- SUBTITLE START TIME = FIRST SPOKEN WORD START TIME.
- NEVER delay the start timestamp into the future (e.g. if speaker starts at 00:05.120, start MUST be 5.120, NEVER 5.700 or 5.800).
- Subtitle END TIME = LAST SPOKEN WORD END TIME.
- For EVERY spoken word, populate the 'words' array with its exact audio onset ('start') and offset ('end') in seconds.

CRITICAL REQUIREMENT — SUBTITLE LINE LENGTH MUST BE 2–3 KHMER WORDS ONLY (NO SPACES BETWEEN KHMER WORDS):
- Each subtitle segment MUST contain ONLY 2–3 Khmer words (for fast-paced CapCut/Reels/TikTok readability).
- DO NOT create long subtitle sentences.
- Avoid combining an entire sentence into a single line.
- DO NOT INSERT SPACES BETWEEN KHMER WORDS in the subtitle text.
  Example:
  Original speech: "សួស្តីបងប្អូនទាំងអស់គ្នា ថ្ងៃនេះយើងមកសាកល្បងផលិតផលថ្មីមួយ"
  Preferred subtitles:
  1: 00:00:01,000 --> 00:00:02,000 | សួស្តីបងប្អូន
  2: 00:00:02,000 --> 00:00:03,000 | ទាំងអស់គ្នា
  3: 00:00:03,000 --> 00:00:04,200 | ថ្ងៃនេះយើងមក
  4: 00:00:04,200 --> 00:00:05,500 | សាកល្បងផលិតផលថ្មី
  5: 00:00:05,500 --> 00:00:06,300 | មួយនេះ

RULES:
1. Target 2–3 Khmer words per subtitle line. Never exceed 3 words unless absolutely necessary for preserving an inseparable phrase.
2. DO NOT INSERT SPACES BETWEEN KHMER WORDS in the final subtitle text.
   CORRECT: "សួស្តីបងប្អូន", "ថ្ងៃនេះយើងមក", "សាកល្បងផលិតផលថ្មី"
   INCORRECT: "សួស្តី បងប្អូន", "ថ្ងៃនេះ យើងមក", "សាកល្បង ផលិតផល ថ្មី"
   Spaces are ONLY internal word boundaries. Remove spaces before outputting the final Khmer subtitle text.
   Preserve spaces inside English phrases ("Hello everyone") and between Khmer and English ("ខ្ញុំប្រើ CapCut").
3. Keep natural compound words and phrases together (do not awkwardly split an inseparable phrase).
4. Subtitle timing (start and end in seconds, relative to chunk: 0.000 to ${chunkDuration.toFixed(1)}s) must follow the actual spoken audio boundaries.
5. If only 1 word is spoken during a short phrase, 1 word is acceptable.
6. Target duration per 2–3 word segment: typically 0.6s to 2.2s.
7. Write strictly in valid standard Khmer Unicode (UTF-8). Do NOT translate into English.
8. If English words, brand names, or tech terms are spoken ("Americano", "Latte", "CapCut", "iPhone", "TikTok", "Facebook", "Live", "Content"), transcribe them accurately.
${speakerDetection ? '- Detect and identify speaker changes (e.g. "Speaker 1", "Speaker 2").' : '- Single speaker flow (default to "Speaker 1").'}
${autoKhmerCorrection ? '- Apply Khmer spell-checking and correct any coeng (ជើង) or vowel placement errors automatically.' : ''}

OUTPUT FORMAT:
Return JSON adhering strictly to the schema. Output short 2-3 word segments aligned with audio timing. If the audio is silent or contains no speech, return an empty segments array [].`;

  const audioPart = {
    inlineData: {
      mimeType,
      data: audioBase64,
    },
  };

  const promptText = `Transcribe this Khmer audio chunk (index ${chunkIndex + 1} of ${totalChunks}, duration ~${chunkDuration.toFixed(1)} seconds). CRITICAL ANTI-LAG: Output exact word-level start and end timestamps directly from the audio for EVERY spoken Khmer word (start = exact onset of the first sound), and segment into natural 2–3 word phrases aligned with actual speech boundaries.`;

  // Candidate models: preferred -> primary -> fallbacks
  const candidateModels: string[] = [
    preferredModel || PRIMARY_MODEL,
    ...(preferredModel === PRIMARY_MODEL ? [] : [PRIMARY_MODEL]),
    ...FALLBACK_MODELS,
  ];
  // Deduplicate candidates
  const modelsToTry = Array.from(new Set(candidateModels));

  let lastError: any = null;
  let successfulModel = '';
  let responseText = '';

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [audioPart, { text: promptText }],
        },
        config: {
          systemInstruction,
          temperature: mode === 'accuracy' ? 0.2 : 0.4,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedLanguage: {
                type: Type.STRING,
                description: 'Detected language, e.g. "km" (Khmer) or "mixed"',
              },
              speechDetected: {
                type: Type.BOOLEAN,
                description: 'True if human speech was detected in this chunk',
              },
              speakerCount: {
                type: Type.INTEGER,
                description: 'Estimated number of distinct speakers',
              },
              segments: {
                type: Type.ARRAY,
                description: 'List of synchronized subtitle segments with exact audio timing',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    start: {
                      type: Type.NUMBER,
                      description: 'Exact start time in seconds relative to chunk start (0.000 to chunk end)',
                    },
                    end: {
                      type: Type.NUMBER,
                      description: 'Exact end time in seconds relative to chunk start',
                    },
                    text: {
                      type: Type.STRING,
                      description: 'Transcribed Khmer subtitle text (2-3 words per line)',
                    },
                    confidence: {
                      type: Type.NUMBER,
                      description: 'Confidence score from 0 to 100',
                    },
                    speaker: {
                      type: Type.STRING,
                      description: 'Speaker identifier, e.g. "Speaker 1"',
                    },
                    flaggedForReview: {
                      type: Type.BOOLEAN,
                      description: 'True if transcription was uncertain or ambiguous',
                    },
                    reviewReason: {
                      type: Type.STRING,
                      description: 'Reason for review if flagged',
                    },
                    words: {
                      type: Type.ARRAY,
                      description: 'Audio-grounded word-level timestamps for every spoken word',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          word: { type: Type.STRING, description: 'Spoken Khmer word' },
                          start: { type: Type.NUMBER, description: 'Word onset in seconds' },
                          end: { type: Type.NUMBER, description: 'Word offset in seconds' },
                          confidence: { type: Type.NUMBER, description: 'Word confidence' },
                        },
                        required: ['word', 'start', 'end'],
                      },
                    },
                  },
                  required: ['start', 'end', 'text', 'confidence'],
                },
              },
            },
            required: ['detectedLanguage', 'speechDetected', 'segments'],
          },
        },
      });

      responseText = response.text || '{}';
      successfulModel = modelName;
      break; // Success! Break out of model loop
    } catch (err: any) {
      console.warn(`Model ${modelName} failed on chunk ${chunkIndex + 1}:`, err?.message);
      lastError = err;

      // If error is 503 / unavailable, check if we should try next fallback model
      const classified = classifyError(err);
      if (!classified.isRetryable) {
        // Non-retryable error (e.g. 400 Bad Request, 401), stop immediately
        break;
      }
      // If retryable, loop continues to try fallback model if available
    }
  }

  // If all candidate models failed
  if (!successfulModel) {
    const classified = classifyError(lastError);

    if (classified.code === 503 || classified.status === 'UNAVAILABLE') {
      circuitBreaker.consecutive503s++;
      if (circuitBreaker.consecutive503s >= circuitBreaker.threshold) {
        circuitBreaker.openUntil = Date.now() + circuitBreaker.coolDownDurationMs;
        console.warn(
          `Circuit breaker OPENED for ${circuitBreaker.coolDownDurationMs / 1000}s due to ${circuitBreaker.consecutive503s} consecutive 503s`
        );
      }
    }

    res.status(classified.code >= 400 && classified.code < 600 ? classified.code : 503).json({
      success: false,
      retryable: classified.isRetryable,
      retryAfter: classified.retryAfterSeconds,
      error: {
        code: classified.code,
        status: classified.status,
        message: classified.message,
      },
    });
    return;
  }

  // Request succeeded: reset circuit breaker
  circuitBreaker.consecutive503s = 0;
  circuitBreaker.openUntil = 0;

  let parsed: any = {};
  try {
    parsed = JSON.parse(responseText);
  } catch (parseErr) {
    console.error('Failed to parse Gemini response as JSON:', responseText);
    parsed = { segments: [], speechDetected: false, detectedLanguage: 'km' };
  }

  const rawSegments = Array.isArray(parsed.segments) ? parsed.segments : [];
  const cleanedSegments = validateAndCleanSegments(rawSegments, timeOffset, chunkDuration);

  res.json({
    success: true,
    modelUsed: successfulModel,
    chunkIndex,
    speechDetected: parsed.speechDetected ?? cleanedSegments.length > 0,
    detectedLanguage: parsed.detectedLanguage || 'km',
    speakerCount: parsed.speakerCount || 1,
    segments: cleanedSegments,
  });
});

// POST /api/correct-khmer
// Second-pass AI correction stage with fallback & resilient error handling
app.post('/api/correct-khmer', async (req: Request, res: Response) => {
  try {
    const { segments, context = 'general video' } = req.body;

    if (!Array.isArray(segments) || segments.length === 0) {
      res.json({ success: true, segments: [] });
      return;
    }

    if (!apiKey) {
      res.json({ success: true, segments: req.body.segments || [], warning: 'No API key' });
      return;
    }

    // Check circuit breaker: if busy, skip correction and return original segments gracefully
    if (Date.now() < circuitBreaker.openUntil) {
      res.json({
        success: true,
        segments: req.body.segments || [],
        warning: 'AI correction skipped due to temporary service load; original segments preserved.',
      });
      return;
    }

    const systemInstruction = `You are a master Cambodian linguist and Khmer subtitle editor.
Your duty is to review the transcribed Khmer subtitle lines for:
1. Khmer Unicode spelling errors (e.g. correct placement of subscripts/ជើង, independent vs dependent vowels, bantoc ់, samyok sanna ័).
2. Contextual homophones (fixing similar sounding Khmer words based on surrounding sentences).
3. CRITICAL: Maintain the short 2–3 Khmer words per subtitle line structure! Do NOT merge short segments into long sentences.
4. Keep natural phrasing for CapCut short-form video subtitles.
5. Do NOT aggressively rewrite or alter the speaker's original meaning. Preserve colloquial Cambodian speech and slang.
6. Keep exact timestamp start and end for each segment.
7. CRITICAL: DO NOT INSERT SPACES BETWEEN KHMER WORDS. Khmer words within the subtitle line must be contiguous without spaces (e.g. 'សួស្តីបងប្អូន', NOT 'សួស្តី បងប្អូន'). Preserve spaces in English phrases ('Hello everyone') and between Khmer and English ('ខ្ញុំប្រើ CapCut').

Return the reviewed and corrected segments in JSON matching the exact input IDs and timestamps.`;

    const promptText = `Review and correct these ${segments.length} Khmer subtitle lines. Maintain exact IDs, start, and end times. Context: ${context}.
Input:
${JSON.stringify(
  segments.map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end,
    text: s.text,
    confidence: s.confidence,
    speaker: s.speaker,
  }))
)}`;

    let responseText = '';
    const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: promptText,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                correctedSegments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      start: { type: Type.NUMBER },
                      end: { type: Type.NUMBER },
                      text: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                      correctionsMade: { type: Type.STRING },
                      flaggedForReview: { type: Type.BOOLEAN },
                    },
                    required: ['id', 'start', 'end', 'text'],
                  },
                },
              },
              required: ['correctedSegments'],
            },
          },
        });
        responseText = response.text || '{}';
        break;
      } catch (err: any) {
        console.warn(`Correction failed with model ${model}:`, err?.message);
      }
    }

    if (!responseText) {
      // Gracefully fall back to original segments if all models failed
      res.json({
        success: true,
        segments: req.body.segments || [],
        warning: 'AI correction skipped; original segments preserved.',
      });
      return;
    }

    const parsed = JSON.parse(responseText || '{}');
    const correctedList = Array.isArray(parsed.correctedSegments)
      ? parsed.correctedSegments
      : [];

    const merged = segments.map((orig: SubtitleSegment) => {
      const found = correctedList.find((c: any) => c.id === orig.id);
      if (found) {
        return {
          ...orig,
          text: normalizeKhmerSubtitleText(found.text || orig.text),
          confidence: found.confidence || orig.confidence,
          flaggedForReview: found.flaggedForReview ?? orig.flaggedForReview,
          reviewReason: found.correctionsMade || orig.reviewReason,
        };
      }
      return orig;
    });

    res.json({ success: true, segments: merged });
  } catch (error: any) {
    console.error('Error in /api/correct-khmer:', error);
    // Non-fatal fallback
    res.json({ success: true, segments: req.body.segments || [], warning: error?.message });
  }
});

// POST /api/validate-capcut
// Validates SRT format against CapCut strict requirements
app.post('/api/validate-capcut', (req: Request, res: Response) => {
  const { segments, videoDuration = 0 } = req.body;
  if (!Array.isArray(segments)) {
    res.status(400).json({
      success: false,
      retryable: false,
      error: { code: 400, message: 'segments array is required' },
    });
    return;
  }

  const issues: string[] = [];
  const repairsApplied: string[] = [];

  // 0. Enforce 2-3 words per subtitle line for CapCut
  const decomposed: any[] = [];
  for (const s of segments) {
    if (!s || !s.text || !s.text.trim()) continue;
    const parts = splitIntoShortSegments(s, 0);
    if (parts.length > 1) {
      repairsApplied.push(`Subtitle #${s.id || decomposed.length + 1} divided into ${parts.length} short 2–3 word lines`);
    }
    decomposed.push(...parts);
  }

  let repairedSegments: SubtitleSegment[] = decomposed;

  // 1. Check empty entries
  repairedSegments = repairedSegments.filter((s) => {
    if (!s.text || !s.text.trim()) {
      issues.push(`Empty subtitle entry removed at ${s.start.toFixed(2)}s`);
      repairsApplied.push(`Removed empty subtitle at ${s.start.toFixed(2)}s`);
      return false;
    }
    return true;
  });

  // 2. Sort by start time
  repairedSegments.sort((a, b) => a.start - b.start);

  // 3. Re-index sequentially 1, 2, 3...
  repairedSegments.forEach((s, idx) => {
    s.id = idx + 1;
  });

  // 4. Check & fix inverted or too-short durations
  for (let i = 0; i < repairedSegments.length; i++) {
    const s = repairedSegments[i];
    if (s.start < 0) {
      s.start = 0;
      repairsApplied.push(`Fixed negative start time at index ${s.id}`);
    }
    if (s.end <= s.start) {
      s.end = s.start + 1.2;
      issues.push(`Subtitle #${s.id} had invalid duration (start >= end); adjusted to +1.2s`);
      repairsApplied.push(`Adjusted end time for #${s.id}`);
    }
    if (s.end - s.start < 0.4) {
      s.end = s.start + 0.5;
      issues.push(`Subtitle #${s.id} was under 0.4s; increased to 0.5s for CapCut readability`);
      repairsApplied.push(`Extended minimum duration for #${s.id}`);
    }
    if (s.end - s.start > 10.0) {
      issues.push(`Subtitle #${s.id} is very long (${(s.end - s.start).toFixed(1)}s); consider splitting`);
    }
    if (videoDuration > 0 && s.end > videoDuration + 0.5) {
      s.end = Math.max(s.start + 0.5, videoDuration);
      issues.push(`Subtitle #${s.id} extended beyond video duration (${videoDuration.toFixed(1)}s)`);
      repairsApplied.push(`Clamped #${s.id} to video duration`);
    }
  }

  // 5. Check & repair overlaps
  for (let i = 1; i < repairedSegments.length; i++) {
    const prev = repairedSegments[i - 1];
    const curr = repairedSegments[i];

    if (curr.start < prev.end) {
      issues.push(
        `Overlap detected between #${prev.id} (${prev.end.toFixed(2)}s) and #${curr.id} (${curr.start.toFixed(2)}s)`
      );
      // Leave at least 30ms gap for CapCut
      prev.end = Math.max(prev.start + 0.5, curr.start - 0.03);
      if (curr.start <= prev.end) {
        curr.start = prev.end + 0.03;
      }
      repairsApplied.push(`Resolved overlap between #${prev.id} and #${curr.id}`);
    }
  }

  // 6. Check Khmer Unicode integrity
  for (const s of repairedSegments) {
    const firstChar = s.text.charCodeAt(0);
    if ((firstChar >= 0x17b6 && firstChar <= 0x17d3) || firstChar === 0x17d2) {
      issues.push(`Subtitle #${s.id} started with an unattached Khmer combining mark; corrected`);
      s.text = s.text.replace(/^[\u17B6-\u17D3\u17D2]+/, '');
      repairsApplied.push(`Trimmed unattached combining marks in #${s.id}`);
    }
  }

  res.json({
    success: true,
    capCutReady: true,
    totalSubtitles: repairedSegments.length,
    issuesFound: issues,
    repairsApplied,
    segments: repairedSegments,
  });
});

// Generic JSON Error Handler: guarantees NO HTML error pages are ever returned
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  const classified = classifyError(err);
  res.status(classified.code || 500).json({
    success: false,
    retryable: classified.isRetryable,
    retryAfter: classified.retryAfterSeconds,
    error: {
      code: classified.code,
      status: classified.status,
      message: classified.message || 'Internal server error',
    },
  });
});

// Configure Vite middleware in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Khmer Subtitle AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
