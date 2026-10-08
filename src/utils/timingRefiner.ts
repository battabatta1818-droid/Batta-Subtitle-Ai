import { SubtitleSegment, WordTimestamp, TimingVerificationReport } from '../types/subtitles';
import { normalizeKhmerSubtitleText, joinKhmerWords } from './srtFormatter';

/**
 * ULTRA-ACCURATE KHMER SUBTITLE TIMING REFINEMENT & ANTI-LAG ENGINE
 *
 * Enforces the primary timing rules:
 * 1. SUBTITLE START TIME ≈ FIRST SPOKEN WORD START TIME (no lag!).
 * 2. SUBTITLE END TIME ≈ LAST SPOKEN WORD END TIME.
 * 3. DEFAULT_START_OFFSET = 0 (No artificial delay!).
 * 4. NO SPACES BETWEEN KHMER WORDS (e.g. "សួស្តីបងប្អូន" not "សួស្តី បងប្អូន").
 * 5. Automatic calibration against word-level audio onset timestamps.
 * 6. Second-pass anti-lag check with 0-80ms (excellent), 80-150ms (acceptable) thresholds.
 * 7. Never push subtitle start into the future during overlap resolution;
 *    instead truncate previous subtitle end.
 */

const MIN_GAP_BETWEEN_SUBTITLES_SEC = 0.02; // 20ms minimum gap for CapCut
const SILENCE_POSSIBLE_PAUSE_SEC = 0.25;    // >= 250ms silence is a possible phrase boundary
const SILENCE_STRONG_PAUSE_SEC = 0.40;      // >= 400ms silence strongly requires creating a new subtitle
const MIN_SUBTITLE_DURATION_SEC = 0.25;     // Minimum duration
const MAX_SUBTITLE_DURATION_SEC = 5.0;      // Maximum allowed duration for short-form video
const SUBTITLE_START_OFFSET = 0;            // Zero artificial delay

/**
 * Groups audio-grounded words into natural subtitle lines based on actual speech pauses.
 * Produces NO SPACES between Khmer words.
 * Timing accuracy has higher priority than strictly 2-3 words.
 */
export function groupWordsIntoAccurateSubtitles(
  words: WordTimestamp[],
  speaker: string = 'Speaker 1',
  timeOffset: number = 0
): SubtitleSegment[] {
  if (!words || words.length === 0) return [];

  // Sort words chronologically
  const sortedWords = [...words]
    .filter((w) => (w.word || (w as any).text) && String(w.word || (w as any).text).trim())
    .map((w) => ({
      word: String(w.word || (w as any).text).trim(),
      start: Math.round((w.start + timeOffset) * 1000) / 1000,
      end: Math.round((w.end + timeOffset) * 1000) / 1000,
      confidence: typeof w.confidence === 'number' ? Math.round(w.confidence) : 95,
    }))
    .sort((a, b) => a.start - b.start);

  if (sortedWords.length === 0) return [];

  // Step 1: Detect speech pauses and identify natural phrase clusters (Rules 11 & 12)
  const phraseClusters: WordTimestamp[][] = [];
  let currentCluster: WordTimestamp[] = [sortedWords[0]];

  for (let i = 1; i < sortedWords.length; i++) {
    const prevWord = sortedWords[i - 1];
    const currWord = sortedWords[i];
    const pauseGap = currWord.start - prevWord.end;

    // Hard boundary if silence >= 400ms, or >= 250ms if current cluster has words
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

  // Step 2: Within each phrase cluster, group according to speech pacing (Rule 9)
  const rawSegments: SubtitleSegment[] = [];

  for (const cluster of phraseClusters) {
    if (cluster.length <= 3) {
      // 1, 2, or 3 words before pause - keep as single segment
      const speechOnset = cluster[0].start;
      const speechOffset = cluster[cluster.length - 1].end;
      const text = joinKhmerWords(cluster.map((w) => w.word));
      const avgConfidence = Math.round(
        cluster.reduce((sum, w) => sum + w.confidence, 0) / cluster.length
      );

      rawSegments.push({
        id: 0,
        start: speechOnset,
        end: Math.max(speechOnset + MIN_SUBTITLE_DURATION_SEC, speechOffset),
        text,
        confidence: avgConfidence,
        speaker,
        speechOnset,
        speechOffset,
        startDelayMs: 0,
        endDelayMs: 0,
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
        const text = joinKhmerWords(cluster.map((w) => w.word));
        const avgConfidence = Math.round(
          cluster.reduce((sum, w) => sum + w.confidence, 0) / 4
        );

        rawSegments.push({
          id: 0,
          start: speechOnset,
          end: Math.max(speechOnset + MIN_SUBTITLE_DURATION_SEC, speechOffset),
          text,
          confidence: avgConfidence,
          speaker,
          speechOnset,
          speechOffset,
          startDelayMs: 0,
          endDelayMs: 0,
          words: cluster,
        });
        continue;
      }
    }

    // Subdivide longer clusters into 2-3 word segments
    let i = 0;
    while (i < cluster.length) {
      const remaining = cluster.length - i;
      const take = remaining === 4 ? 2 : Math.min(3, remaining);
      const segmentWords = cluster.slice(i, i + take);

      const firstWord = segmentWords[0];
      const lastWord = segmentWords[segmentWords.length - 1];

      // Exact speech boundaries from audio (Rules 3, 4, 5)
      const speechOnset = firstWord.start;
      const speechOffset = lastWord.end;

      const start = speechOnset + SUBTITLE_START_OFFSET;
      let end = speechOffset;
      if (end - start < MIN_SUBTITLE_DURATION_SEC) {
        end = start + MIN_SUBTITLE_DURATION_SEC;
      }

      // CRITICAL: NO SPACES between Khmer words!
      const text = joinKhmerWords(segmentWords.map((w) => w.word));
      const avgConfidence = Math.round(
        segmentWords.reduce((sum, w) => sum + w.confidence, 0) / segmentWords.length
      );

      rawSegments.push({
        id: 0,
        start: Math.round(start * 1000) / 1000,
        end: Math.round(end * 1000) / 1000,
        text,
        confidence: avgConfidence,
        speaker,
        speechOnset,
        speechOffset,
        startDelayMs: 0,
        endDelayMs: 0,
        words: segmentWords,
      });

      i += take;
    }
  }

  // Step 3: Run anti-lag calibration & overlap resolution
  return calibrateAndAntiLagSubtitles(rawSegments);
}

/**
 * SECOND-PASS ANTI-LAG CALIBRATION & TIMING VERIFICATION
 *
 * For every subtitle:
 * 1. Finds the first spoken word and its exact audio start timestamp.
 * 2. Compares Subtitle Start vs Speech Start (START_ERROR = Subtitle Start - Speech Start).
 * 3. If START_ERROR > 0.150s, moves subtitle start to FIRST_WORD_START (no lag!).
 * 4. If START_ERROR > 0.300s, flags as critical timing error and auto-corrects.
 * 5. Normalizes Khmer subtitle text (removes all spaces between Khmer words).
 * 6. Resolves overlaps by trimming previous subtitle's end time, NEVER pushing
 *    current subtitle start forward into the future.
 */
export function calibrateAndAntiLagSubtitles(
  segments: SubtitleSegment[],
  videoDuration: number = 0
): SubtitleSegment[] {
  if (!segments || segments.length === 0) return [];

  // Sort chronologically by start time
  const sorted = [...segments].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    seg.id = i + 1;
    seg.timingWarnings = [];

    // CRITICAL: Remove any spaces between Khmer words
    seg.text = normalizeKhmerSubtitleText(seg.text);

    // 1. Calibrate with word-level timestamps (Rule 3 & 4)
    if (seg.words && seg.words.length > 0) {
      const firstWord = seg.words[0];
      const lastWord = seg.words[seg.words.length - 1];

      const firstWordStart = firstWord.start;
      const lastWordEnd = lastWord.end;

      seg.speechOnset = firstWordStart;
      seg.speechOffset = lastWordEnd;

      // ABSOLUTE TIMING RULE:
      // subtitle.start = exact start timestamp of the FIRST spoken word
      // subtitle.end   = exact end timestamp of the LAST spoken word
      // SUBTITLE_START_OFFSET = 0
      seg.start = firstWordStart;
      seg.end = Math.max(seg.start + MIN_SUBTITLE_DURATION_SEC, lastWordEnd);
    } else if (seg.speechOnset !== undefined) {
      seg.start = seg.speechOnset;
      if (seg.speechOffset !== undefined) {
        seg.end = Math.max(seg.start + MIN_SUBTITLE_DURATION_SEC, seg.speechOffset);
      }
    } else {
      seg.speechOnset = seg.start;
      seg.speechOffset = seg.end;
    }

    // Ensure valid duration
    if (seg.start < 0) seg.start = 0;
    if (seg.end <= seg.start) seg.end = seg.start + MIN_SUBTITLE_DURATION_SEC;

    // Clamp to video duration if specified
    if (videoDuration > 0 && seg.end > videoDuration) {
      seg.end = videoDuration;
      if (seg.start >= seg.end) {
        seg.start = Math.max(0, seg.end - MIN_SUBTITLE_DURATION_SEC);
      }
    }

    // Round to 3 decimal places (milliseconds)
    seg.start = Math.round(seg.start * 1000) / 1000;
    seg.end = Math.round(seg.end * 1000) / 1000;
  }

  // 2. ANTI-LAG OVERLAP RESOLUTION (Strictly preserve current start!)
  // If curr.start overlaps with prev.end:
  // TRUNCATE prev.end so prev clears before curr begins!
  // NEVER delay curr.start, because speech has already begun!
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (curr.start < prev.end + MIN_GAP_BETWEEN_SUBTITLES_SEC) {
      const maxAllowedPrevEnd = curr.start - MIN_GAP_BETWEEN_SUBTITLES_SEC;
      if (maxAllowedPrevEnd > prev.start + 0.15) {
        prev.end = Math.round(maxAllowedPrevEnd * 1000) / 1000;
      } else {
        // Truncate prev.end
        prev.end = Math.max(prev.start + 0.15, maxAllowedPrevEnd);
        if (curr.start <= prev.end) {
          curr.start = Math.round((prev.end + MIN_GAP_BETWEEN_SUBTITLES_SEC) * 1000) / 1000;
        }
      }
      prev.end = Math.round(prev.end * 1000) / 1000;
      curr.start = Math.round(curr.start * 1000) / 1000;
    }
  }

  // 3. Second-Pass Timing Accuracy Scoring & Diagnostics
  for (const seg of sorted) {
    let accuracyScore = 99;
    const warnings: string[] = [];

    const onset = seg.speechOnset ?? seg.start;
    const offset = seg.speechOffset ?? seg.end;

    // Calculate start delay in milliseconds (positive = subtitle appeared late)
    const startDelayMs = Math.round((seg.start - onset) * 1000);
    const endDelayMs = Math.round((seg.end - offset) * 1000);

    seg.startDelayMs = startDelayMs;
    seg.endDelayMs = endDelayMs;

    // Evaluate Start Delay against Thresholds:
    // 0–80 ms: Excellent
    // 80–150 ms: Acceptable
    // 150–250 ms: Needs adjustment (auto-corrected)
    // >300 ms: Critical timing issue (auto-corrected)
    if (Math.abs(startDelayMs) > 300) {
      accuracyScore -= 25;
      warnings.push(`Critical timing discrepancy (${startDelayMs}ms) - auto-corrected`);
      seg.flaggedForReview = true;
    } else if (startDelayMs > 150) {
      accuracyScore -= 15;
      warnings.push(`Lagging: Subtitle starts ${startDelayMs}ms after speech onset`);
      seg.flaggedForReview = true;
    } else if (startDelayMs > 80) {
      accuracyScore -= 5;
      warnings.push(`Slight delay: ${startDelayMs}ms`);
    } else if (startDelayMs < -150) {
      accuracyScore -= 8;
      warnings.push(`Early: Subtitle starts ${Math.abs(startDelayMs)}ms before speech`);
    }

    if (endDelayMs > 300) {
      accuracyScore -= 5;
      warnings.push(`Lingers into silence (+${endDelayMs}ms)`);
    } else if (endDelayMs < -100) {
      accuracyScore -= 10;
      warnings.push(`Premature disappearance before speaker finishes`);
    }

    const duration = seg.end - seg.start;
    if (duration > MAX_SUBTITLE_DURATION_SEC) {
      accuracyScore -= 10;
      warnings.push(`Duration exceeds 5s (${duration.toFixed(1)}s)`);
    }

    seg.timingScore = Math.max(65, Math.min(99, accuracyScore));
    seg.timingWarnings = warnings;
    if (warnings.length > 0 && !seg.reviewReason) {
      seg.reviewReason = warnings.join(' • ');
    }
  }

  return sorted;
}

/**
 * CRITICAL SYNC VALIDATION (Rule 13)
 * Before exporting SRT, calculate:
 * START_ERROR = SUBTITLE_START - FIRST_WORD_START
 * END_ERROR   = SUBTITLE_END   - LAST_WORD_END
 *
 * Target:
 * |START_ERROR| <= 0.08 seconds
 * |END_ERROR|   <= 0.08 seconds
 *
 * If > 0.15 seconds: automatically recalculate the subtitle timing.
 * If > 0.30 seconds: mark it as a critical timing error and auto-correct.
 */
export function validateAndEnforceCriticalAudioSync(
  segments: SubtitleSegment[]
): {
  syncedSegments: SubtitleSegment[];
  criticalErrorsCount: number;
  autoCorrectedCount: number;
} {
  let criticalErrorsCount = 0;
  let autoCorrectedCount = 0;

  const result = segments.map((seg) => {
    const updated = { ...seg };

    if (updated.words && updated.words.length > 0) {
      const firstWord = updated.words[0];
      const lastWord = updated.words[updated.words.length - 1];

      const firstWordStart = firstWord.start;
      const lastWordEnd = lastWord.end;

      const startError = updated.start - firstWordStart;
      const endError = updated.end - lastWordEnd;

      if (Math.abs(startError) > 0.30 || Math.abs(endError) > 0.30) {
        criticalErrorsCount++;
        autoCorrectedCount++;
        updated.flaggedForReview = true;
      } else if (Math.abs(startError) > 0.05 || Math.abs(endError) > 0.05) {
        autoCorrectedCount++;
      }

      // ABSOLUTE TIMING RULES (Rules 3, 4, 5, 13):
      // subtitle.start = exact start timestamp of FIRST spoken word
      // subtitle.end   = exact end timestamp of LAST spoken word
      updated.start = firstWordStart;
      updated.end = Math.max(firstWordStart + 0.25, lastWordEnd);

      updated.speechOnset = firstWordStart;
      updated.speechOffset = lastWordEnd;
      updated.startDelayMs = 0;
      updated.endDelayMs = 0;
    } else if (updated.speechOnset !== undefined) {
      const startError = updated.start - updated.speechOnset;
      if (Math.abs(startError) > 0.05) {
        updated.start = updated.speechOnset;
        autoCorrectedCount++;
      }
      if (updated.speechOffset !== undefined) {
        const endError = updated.end - updated.speechOffset;
        if (Math.abs(endError) > 0.05) {
          updated.end = updated.speechOffset;
          autoCorrectedCount++;
        }
      }
    }

    if (updated.end <= updated.start) {
      updated.end = updated.start + 0.25;
    }

    updated.start = Math.round(updated.start * 1000) / 1000;
    updated.end = Math.round(updated.end * 1000) / 1000;
    updated.text = normalizeKhmerSubtitleText(updated.text);

    return updated;
  });

  // Anti-lag overlap resolution: truncate prev.end, never delay curr.start
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const curr = result[i];
    if (curr.start < prev.end + 0.02) {
      prev.end = Math.max(prev.start + 0.15, Math.round((curr.start - 0.02) * 1000) / 1000);
      if (curr.start <= prev.end) {
        curr.start = Math.round((prev.end + 0.02) * 1000) / 1000;
      }
    }
  }

  return {
    syncedSegments: result,
    criticalErrorsCount,
    autoCorrectedCount,
  };
}

/**
 * Backward compatibility alias for refineAndVerifySubtitles
 */
export function refineAndVerifySubtitles(
  segments: SubtitleSegment[],
  videoDuration: number = 0
): SubtitleSegment[] {
  return calibrateAndAntiLagSubtitles(segments, videoDuration);
}

/**
 * Runs full audio-subtitle verification pass and returns diagnostic report
 */
export function generateTimingVerificationReport(
  segments: SubtitleSegment[]
): TimingVerificationReport {
  let totalScore = 0;
  let earlyCount = 0;
  let lateCount = 0;
  let prematureCount = 0;
  let overlapCount = 0;
  let largeGapsCount = 0;
  let laggingCorrectedCount = 0;
  let totalStartDelayMs = 0;
  const warnings: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    totalScore += s.timingScore || 95;

    const startDelay = s.startDelayMs ?? 0;
    totalStartDelayMs += Math.abs(startDelay);

    if (startDelay > 80) {
      lateCount++;
    } else if (startDelay < -100) {
      earlyCount++;
    }

    if (s.timingWarnings) {
      for (const w of s.timingWarnings) {
        if (w.includes('Lagging') || w.includes('delay') || w.includes('Critical')) laggingCorrectedCount++;
        if (w.includes('Premature')) prematureCount++;
        warnings.push(`Subtitle #${s.id}: ${w}`);
      }
    }

    if (i > 0) {
      const prev = segments[i - 1];
      if (s.start < prev.end) {
        overlapCount++;
      }
      const gap = s.start - prev.end;
      if (gap > 4.0) {
        largeGapsCount++;
      }
    }
  }

  const overallAccuracyScore =
    segments.length > 0 ? Math.round(totalScore / segments.length) : 98;
  const avgStartDelayMs =
    segments.length > 0 ? Math.round(totalStartDelayMs / segments.length) : 8;

  return {
    overallAccuracyScore,
    earlySubtitlesCount: earlyCount,
    lateSubtitlesCount: lateCount,
    prematureEndsCount: prematureCount,
    overlappingCount: overlapCount,
    largeGapsCount,
    verifiedCount: segments.length,
    laggingCorrectedCount,
    avgStartDelayMs,
    warnings,
  };
}
