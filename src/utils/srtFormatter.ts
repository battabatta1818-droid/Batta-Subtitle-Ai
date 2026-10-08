import { SubtitleSegment, CapCutValidationResult } from '../types/subtitles';
import { calibrateAndAntiLagSubtitles, validateAndEnforceCriticalAudioSync } from './timingRefiner';

/**
 * Normalizes Khmer subtitle text by removing unnecessary spaces between Khmer words,
 * while preserving spaces inside English phrases and between Khmer and English words.
 *
 * Example:
 * "សួស្តី បងប្អូន ទាំងអស់គ្នា" -> "សួស្តីបងប្អូនទាំងអស់គ្នា"
 * "សួស្តី | បងប្អូន" -> "សួស្តីបងប្អូន"
 * "Hello everyone" -> "Hello everyone"
 * "ខ្ញុំប្រើ CapCut" -> "ខ្ញុំប្រើ CapCut"
 */
export function normalizeKhmerSubtitleText(text: string): string {
  if (!text) return '';
  let result = text.trim();

  // Strip pipe / vertical bar separators used in segmentation
  result = result.replace(/\s*\|\s*/g, '');

  // Strip spaces between Khmer Unicode characters (\u1780-\u17FF and \u19E0-\u19FF)
  // Run repeatedly to handle chained words ("A B C")
  const khmerBetweenRegex = /([\u1780-\u17FF\u19E0-\u19FF])\s+([\u1780-\u17FF\u19E0-\u19FF])/g;
  while (khmerBetweenRegex.test(result)) {
    result = result.replace(khmerBetweenRegex, '$1$2');
  }

  // Remove invisible zero-width spaces
  result = result.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // Clean redundant whitespace between non-Khmer words
  result = result.replace(/[ \t]+/g, ' ').trim();

  return result;
}

/**
 * Joins a list of 2-3 words into a single subtitle text string.
 * Khmer words are joined WITHOUT spaces; non-Khmer or mixed words preserve standard space.
 */
export function joinKhmerWords(words: string[]): string {
  if (!words || words.length === 0) return '';
  const filtered = words.map(w => w.trim()).filter(Boolean);
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
        // NO SPACE between Khmer words
        combined += curr;
      } else {
        // Keep space between English words or Khmer-English transition
        combined += ' ' + curr;
      }
    }
  }

  return normalizeKhmerSubtitleText(combined);
}

/**
 * Formats seconds into SRT timestamp: HH:MM:SS,mmm
 */
export function formatTimestampSRT(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Formats seconds into VTT timestamp: HH:MM:SS.mmm
 */
export function formatTimestampVTT(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Parses timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS) into seconds
 */
export function parseTimestamp(str: string): number {
  if (!str) return 0;
  const cleaned = str.trim().replace(',', '.');
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else {
    return parseFloat(cleaned) || 0;
  }
}

/**
 * Generates standard CapCut-compatible UTF-8 SRT content
 * Enforces NO spaces between Khmer words and critical audio sync.
 */
export function generateSRT(
  segments: SubtitleSegment[],
  showSpeakerNames: boolean = false
): string {
  if (!segments || segments.length === 0) return '';

  // Critical Audio Sync Validation (Rule 13)
  const { syncedSegments } = validateAndEnforceCriticalAudioSync(segments);

  return syncedSegments
    .filter(s => s.text && s.text.trim())
    .map((seg, index) => {
      const idx = index + 1;
      const start = formatTimestampSRT(seg.start);
      const end = formatTimestampSRT(seg.end);
      const cleanText = normalizeKhmerSubtitleText(seg.text);
      const text = showSpeakerNames && seg.speaker
        ? `${seg.speaker}: ${cleanText}`
        : cleanText;

      return `${idx}\n${start} --> ${end}\n${text}\n`;
    })
    .join('\n');
}

/**
 * Generates standard WebVTT content
 */
export function generateVTT(
  segments: SubtitleSegment[],
  showSpeakerNames: boolean = false
): string {
  if (!segments || segments.length === 0) return 'WEBVTT\n\n';

  // Critical Audio Sync Validation (Rule 13)
  const { syncedSegments } = validateAndEnforceCriticalAudioSync(segments);

  const body = syncedSegments
    .filter(s => s.text && s.text.trim())
    .map((seg, index) => {
      const idx = index + 1;
      const start = formatTimestampVTT(seg.start);
      const end = formatTimestampVTT(seg.end);
      const cleanText = normalizeKhmerSubtitleText(seg.text);
      const text = showSpeakerNames && seg.speaker
        ? `<v ${seg.speaker}>${cleanText}`
        : cleanText;

      return `${idx}\n${start} --> ${end}\n${text}\n`;
    })
    .join('\n');

  return `WEBVTT\n\n${body}`;
}

/**
 * Generates clean text transcript
 */
export function generateTXT(
  segments: SubtitleSegment[],
  includeTimestamps: boolean = true,
  showSpeakerNames: boolean = false
): string {
  if (!segments || segments.length === 0) return '';

  // Critical Audio Sync Validation (Rule 13)
  const { syncedSegments } = validateAndEnforceCriticalAudioSync(segments);

  return syncedSegments
    .filter(s => s.text && s.text.trim())
    .map(seg => {
      const cleanText = normalizeKhmerSubtitleText(seg.text);
      const timePrefix = includeTimestamps
        ? `[${formatTimestampSRT(seg.start)} - ${formatTimestampSRT(seg.end)}] `
        : '';
      const speakerPrefix = showSpeakerNames && seg.speaker ? `${seg.speaker}: ` : '';
      return `${timePrefix}${speakerPrefix}${cleanText}`;
    })
    .join('\n');
}

/**
 * Validates a list of segments for CapCut compatibility
 */
export function validateForCapCut(
  segments: SubtitleSegment[],
  videoDuration: number = 0
): CapCutValidationResult {
  const issues: string[] = [];
  const repairsApplied: string[] = [];
  let overlappingCount = 0;
  let invalidDurationCount = 0;
  let emptyCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];

    if (!s.text || !s.text.trim()) {
      emptyCount++;
      issues.push(`Subtitle #${s.id} is empty.`);
    }

    if (s.start < 0) {
      invalidDurationCount++;
      issues.push(`Subtitle #${s.id} has negative start time.`);
    }

    if (s.end <= s.start) {
      invalidDurationCount++;
      issues.push(`Subtitle #${s.id} has end time (${s.end.toFixed(2)}s) earlier than or equal to start (${s.start.toFixed(2)}s).`);
    }

    const duration = s.end - s.start;
    if (duration < 0.25) {
      invalidDurationCount++;
      issues.push(`Subtitle #${s.id} duration (${duration.toFixed(2)}s) is too short for CapCut readability.`);
    }

    if (videoDuration > 0 && s.end > videoDuration + 1.0) {
      issues.push(`Subtitle #${s.id} exceeds video duration by ${(s.end - videoDuration).toFixed(2)}s.`);
    }

    if (i > 0) {
      const prev = segments[i - 1];
      if (s.start < prev.end) {
        overlappingCount++;
        issues.push(`Overlap: Subtitle #${s.id} starts at ${s.start.toFixed(2)}s before #${prev.id} ends at ${prev.end.toFixed(2)}s.`);
      }
    }
  }

  const isValid = issues.length === 0;

  return {
    isValid,
    capCutReady: isValid,
    issues,
    repairsApplied,
    totalSubtitles: segments.length,
    overlappingCount,
    invalidDurationCount,
    emptyCount,
  };
}

/**
 * Intelligently divides any subtitle segment containing > 3 words into natural
 * 2–3 Khmer word lines aligned with speech duration, for fast CapCut/Reels/TikTok readability.
 * Ensures NO SPACES between Khmer words.
 */
export function partitionInto2to3KhmerWords(segments: SubtitleSegment[]): SubtitleSegment[] {
  const result: SubtitleSegment[] = [];

  for (const seg of segments) {
    if (!seg.text || !seg.text.trim()) continue;

    // Case 1: Word-level timestamps are available
    if (Array.isArray(seg.words) && seg.words.length > 3) {
      const words = seg.words;

      // If 4 words spoken continuously without pause, keep together (Rule 9)
      if (words.length === 4 && (words[3].end - words[0].start) <= 2.2) {
        const speechOnset = words[0].start;
        const speechOffset = words[3].end;
        const text = joinKhmerWords(words.map(w => w.word));
        const avgConf = Math.round(
          words.reduce((acc, w) => acc + (w.confidence || 90), 0) / 4
        );
        result.push({
          ...seg,
          start: speechOnset,
          end: Math.max(speechOnset + 0.25, speechOffset),
          text,
          confidence: avgConf,
          speechOnset,
          speechOffset,
          startDelayMs: 0,
          endDelayMs: 0,
          words,
        });
        continue;
      }

      let i = 0;
      while (i < words.length) {
        const remaining = words.length - i;
        const take = remaining === 4 ? 2 : Math.min(3, remaining);
        const slice = words.slice(i, i + take);
        
        // NO SPACES between Khmer words!
        const text = joinKhmerWords(slice.map(w => w.word));
        
        // Exact audio speech onset & offset (Rules 3, 4, 5)
        const speechOnset = slice[0].start;
        const speechOffset = slice[slice.length - 1].end;
        const start = speechOnset;
        const end = Math.max(start + 0.25, speechOffset);

        const avgConf = Math.round(
          slice.reduce((acc, w) => acc + (w.confidence || 90), 0) / slice.length
        );
        result.push({
          id: 0,
          start: Math.round(start * 1000) / 1000,
          end: Math.round(end * 1000) / 1000,
          text,
          confidence: avgConf,
          speaker: seg.speaker,
          speechOnset,
          speechOffset,
          startDelayMs: 0,
          endDelayMs: 0,
          words: slice,
        });
        i += take;
      }
      continue;
    }

    // Case 2: Text has spaced words
    const text = seg.text.trim();
    const tokens = text.split(/\s+/).filter(Boolean);

    if (tokens.length > 3) {
      const totalChars = Math.max(1, text.length);
      const totalDuration = Math.max(0.6, seg.end - seg.start);
      let i = 0;
      let curStart = seg.start;

      while (i < tokens.length) {
        const remaining = tokens.length - i;
        const take = remaining === 4 ? 2 : Math.min(3, remaining);
        const slice = tokens.slice(i, i + take);
        // NO SPACES between Khmer words
        const subText = joinKhmerWords(slice);
        const portion = Math.max(0.2, slice.join('').length / totalChars);
        const subDuration = Math.max(0.4, totalDuration * portion);
        const subEnd = Math.min(seg.end, curStart + subDuration);

        result.push({
          id: 0,
          start: Math.round(curStart * 1000) / 1000,
          end: Math.round(Math.max(curStart + 0.35, subEnd) * 1000) / 1000,
          text: subText,
          confidence: seg.confidence,
          speaker: seg.speaker,
          speechOnset: curStart,
          speechOffset: subEnd,
          startDelayMs: 0,
          endDelayMs: 0,
        });

        curStart = subEnd;
        i += take;
      }
    } else {
      result.push({
        ...seg,
        text: normalizeKhmerSubtitleText(seg.text),
      });
    }
  }

  // Re-index sequentially 1, 2, 3...
  result.forEach((s, idx) => {
    s.id = idx + 1;
  });

  return result;
}

/**
 * Auto-repairs subtitle segments to guarantee 100% CapCut compatibility
 * and ensures 2-3 words per line whenever possible, with NO spaces between Khmer words.
 */
export function repairSubtitlesForCapCut(
  segments: SubtitleSegment[],
  videoDuration: number = 0
): {
  repairedSegments: SubtitleSegment[];
  repairsApplied: string[];
} {
  const repairsApplied: string[] = [];

  // 1. First enforce 2-3 words per line and normalize Khmer spacing
  const partitioned = partitionInto2to3KhmerWords(segments);
  if (partitioned.length > segments.length) {
    repairsApplied.push(`Divided longer sentences into ${partitioned.length} short 2–3 word lines for CapCut`);
  }

  // Filter out completely empty entries and normalize Khmer Unicode text
  let list = partitioned
    .filter(s => s.text && s.text.trim())
    .map(s => ({
      ...s,
      text: normalizeKhmerSubtitleText(s.text),
    }));

  if (list.length === 0) {
    return { repairedSegments: [], repairsApplied };
  }

  // Sort chronologically
  list.sort((a, b) => a.start - b.start);

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    s.id = i + 1; // Sequential 1-based indexing

    if (s.start < 0) {
      s.start = 0;
      repairsApplied.push(`Reset negative start time on #${s.id}`);
    }

    if (s.end <= s.start) {
      s.end = s.start + 1.0;
      repairsApplied.push(`Fixed inverted timing on #${s.id} to +1.0s`);
    }

    if (s.end - s.start < 0.3) {
      s.end = s.start + 0.35;
      repairsApplied.push(`Extended minimum duration to 0.35s for #${s.id}`);
    }

    if (videoDuration > 0 && s.end > videoDuration) {
      s.end = videoDuration;
      if (s.start >= s.end) {
        s.start = Math.max(0, s.end - 0.35);
      }
      repairsApplied.push(`Clamped #${s.id} inside video duration`);
    }
  }

  // Fix overlaps strictly with ANTI-LAG preservation:
  // Never push curr.start into the future. Instead truncate prev.end.
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const curr = list[i];

    if (curr.start < prev.end + 0.02) {
      const maxAllowedPrevEnd = curr.start - 0.02;
      if (maxAllowedPrevEnd > prev.start + 0.15) {
        prev.end = Math.round(maxAllowedPrevEnd * 1000) / 1000;
        repairsApplied.push(`Truncated #${prev.id} to avoid overlap with #${curr.id} (preserving speech onset)`);
      } else {
        prev.end = Math.max(prev.start + 0.15, maxAllowedPrevEnd);
        if (curr.start <= prev.end) {
          curr.start = Math.round((prev.end + 0.02) * 1000) / 1000;
        }
        repairsApplied.push(`Resolved tight overlap between #${prev.id} and #${curr.id}`);
      }
    }
  }

  // Second pass anti-lag audio alignment
  const calibrated = calibrateAndAntiLagSubtitles(list, videoDuration);

  return { repairedSegments: calibrated, repairsApplied };
}

/**
 * Triggers browser download for SRT, VTT, or TXT with UTF-8 encoding
 */
export function downloadSubtitleFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8'
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
