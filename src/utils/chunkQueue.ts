import { SubtitleSegment, ChunkStatus, ChunkProgress, GenerationSettings } from '../types/subtitles';
import { AudioChunk } from './audioExtractor';
import { normalizeKhmerSubtitleText } from './srtFormatter';

export interface ChunkQueueItem {
  id: string;
  index: number;
  total: number;
  startTime: number;
  endTime: number;
  duration: number;
  audioBase64: string;
  mimeType: string;
  status: ChunkStatus;
  retries: number;
  maxRetries: number;
  nextRetryTimestamp?: number;
  error?: string;
  modelUsed?: string;
  segments?: SubtitleSegment[];
}

export interface QueueProgressCallbackData {
  items: ChunkProgress[];
  completedCount: number;
  totalCount: number;
  activeChunkIndex: number;
  retryWaitCount: number;
  concurrency: number;
  statusText: string;
  isBusyWaiting: boolean;
  estSecondsLeft: number;
}

/**
 * Calculates exponential backoff delay with random jitter (0-5s)
 */
export function calculateBackoffDelayMs(
  attempt: number,
  serverRetryAfterSec?: number
): number {
  if (serverRetryAfterSec && serverRetryAfterSec > 0) {
    return serverRetryAfterSec * 1000 + Math.random() * 3000;
  }

  // Recommended delays: 5s, 10s, 20s, 40s, 80s, 160s
  const baseDelays = [5000, 10000, 20000, 40000, 80000, 160000];
  const idx = Math.min(Math.max(0, attempt - 1), baseDelays.length - 1);
  const baseDelay = baseDelays[idx];
  const jitter = Math.random() * 5000; // 0 to 5 seconds jitter

  return Math.round(baseDelay + jitter);
}

/**
 * Deduplicates overlapping words and segments across chunk boundaries (Rule 8)
 * 1. detects duplicate words across chunk boundaries
 * 2. compares timestamps
 * 3. keeps the most accurate occurrence
 * 4. removes duplicate transcription
 * 5. preserves the original global timeline
 */
export function deduplicateOverlappingChunkSegments(
  chunkItems: ChunkQueueItem[]
): SubtitleSegment[] {
  const sortedItems = [...chunkItems].sort((a, b) => a.startTime - b.startTime);
  const collectedSegments: SubtitleSegment[] = [];

  for (let c = 0; c < sortedItems.length; c++) {
    const item = sortedItems[c];
    if (!item.segments || item.segments.length === 0) continue;

    for (const seg of item.segments) {
      if (!seg.text || !seg.text.trim()) continue;

      if (collectedSegments.length === 0) {
        collectedSegments.push(seg);
        continue;
      }

      const last = collectedSegments[collectedSegments.length - 1];
      const timeOverlap = last.end - seg.start;
      const isBoundaryRegion = timeOverlap > -0.4; // overlapping or within 400ms

      if (isBoundaryRegion) {
        const normA = normalizeKhmerSubtitleText(last.text);
        const normB = normalizeKhmerSubtitleText(seg.text);

        const isExactMatch = normA === normB;
        const isSubstring = (normA.length > 3 && normB.includes(normA)) || (normB.length > 3 && normA.includes(normB));

        let isWordOverlap = false;
        if (last.words && seg.words && last.words.length > 0 && seg.words.length > 0) {
          const matchedWords = seg.words.filter((wb) =>
            last.words!.some(
              (wa) => wa.word === wb.word && Math.abs(wa.start - wb.start) < 0.8
            )
          );
          if (matchedWords.length > 0 && matchedWords.length >= Math.min(last.words.length, seg.words.length) / 2) {
            isWordOverlap = true;
          }
        }

        if (isExactMatch || isSubstring || isWordOverlap) {
          // Compare accuracy: keep occurrence with higher confidence or better timing score
          if ((seg.confidence || 0) > (last.confidence || 0)) {
            collectedSegments[collectedSegments.length - 1] = seg;
          }
          // Duplicate dropped
          continue;
        }
      }

      collectedSegments.push(seg);
    }
  }

  // Sort globally by start time
  collectedSegments.sort((a, b) => a.start - b.start);
  collectedSegments.forEach((s, idx) => {
    s.id = idx + 1;
  });

  return collectedSegments;
}

/**
 * Robust, fault-tolerant Chunk Queue Runner
 */
export class ChunkQueueManager {
  private items: ChunkQueueItem[] = [];
  private concurrency: number = 2; // Default normal concurrency
  private minConcurrency: number = 1;
  private maxConcurrency: number = 2;
  private consecutiveSuccesses: number = 0;
  private activeWorkers: number = 0;
  private isRunning: boolean = false;
  private isCancelled: boolean = false;
  private onProgress: (data: QueueProgressCallbackData) => void;
  private settings: GenerationSettings;
  private timerIds: NodeJS.Timeout[] = [];
  private startTime: number = 0;
  private audioOffset: number = 0;

  constructor(
    initialChunks: AudioChunk[],
    settings: GenerationSettings,
    onProgress: (data: QueueProgressCallbackData) => void,
    audioOffset: number = 0
  ) {
    this.settings = settings;
    this.onProgress = onProgress;
    this.concurrency = 2;
    this.audioOffset = audioOffset;

    this.items = initialChunks.map((c) => ({
      id: `chunk-${c.index + 1}`,
      index: c.index,
      total: c.total,
      startTime: c.startTime,
      endTime: c.endTime,
      duration: c.duration,
      audioBase64: c.audioBase64,
      mimeType: c.mimeType,
      status: 'pending',
      retries: 0,
      maxRetries: 8, // Up to 8 attempts for temporary server errors
    }));
  }

  public cancel() {
    this.isCancelled = true;
    this.isRunning = false;
    this.timerIds.forEach((t) => clearTimeout(t));
    this.timerIds = [];
  }

  public async start(): Promise<SubtitleSegment[]> {
    this.isRunning = true;
    this.isCancelled = false;
    this.startTime = Date.now();

    return new Promise<SubtitleSegment[]>((resolve, reject) => {
      const checkLoop = async () => {
        if (this.isCancelled) {
          reject(new Error('Transcription cancelled by user'));
          return;
        }

        // Notify UI of current state
        this.emitProgress();

        // Check if all chunks completed
        const allCompleted = this.items.every((it) => it.status === 'completed');
        if (allCompleted) {
          this.isRunning = false;
          // Assemble all segments with deduplication across chunk boundaries (Rule 8)
          const allSegments = deduplicateOverlappingChunkSegments(this.items);
          resolve(allSegments);
          return;
        }

        // Check if any permanently failed and exceeded max retries
        const permanentlyFailed = this.items.filter(
          (it) => it.status === 'failed' && it.retries >= it.maxRetries
        );
        if (permanentlyFailed.length > 0 && this.activeWorkers === 0) {
          const firstErr = permanentlyFailed[0];
          this.isRunning = false;
          reject(
            new Error(
              `Chunk ${firstErr.index + 1} permanently failed after ${firstErr.retries} attempts: ${
                firstErr.error || 'Server error'
              }`
            )
          );
          return;
        }

        // Schedule ready items up to concurrency limit
        while (this.activeWorkers < this.concurrency && this.isRunning) {
          const nextItem = this.findNextReadyItem();
          if (!nextItem) break;

          this.dispatchItem(nextItem, checkLoop);
        }

        // If items are in retry_wait, ensure a timer runs to wake up checkLoop
        const retryWaitItems = this.items.filter((it) => it.status === 'retry_wait');
        if (retryWaitItems.length > 0 && this.activeWorkers === 0) {
          const nearest = Math.min(
            ...retryWaitItems.map((it) => it.nextRetryTimestamp || Date.now() + 5000)
          );
          const waitMs = Math.max(500, nearest - Date.now());
          const tid = setTimeout(() => {
            checkLoop();
          }, waitMs);
          this.timerIds.push(tid);
        }
      };

      checkLoop();
    });
  }

  private findNextReadyItem(): ChunkQueueItem | null {
    const now = Date.now();
    // 1. Prioritize pending chunks
    const pending = this.items.find((it) => it.status === 'pending');
    if (pending) return pending;

    // 2. Then check retry_wait chunks whose backoff timer has elapsed
    const retryReady = this.items.find(
      (it) => it.status === 'retry_wait' && (!it.nextRetryTimestamp || it.nextRetryTimestamp <= now)
    );
    if (retryReady) return retryReady;

    return null;
  }

  private async dispatchItem(item: ChunkQueueItem, onWorkerDone: () => void) {
    this.activeWorkers++;
    item.status = 'processing';
    this.emitProgress();

    try {
      const response = await fetch('/api/transcribe-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: item.audioBase64,
          mimeType: item.mimeType,
          chunkIndex: item.index,
          totalChunks: item.total,
          timeOffset: item.startTime + (this.audioOffset || 0),
          chunkDuration: item.duration,
          settings: this.settings,
        }),
      });

      // Safe JSON parsing (Never crash if server returns HTML)
      let data: any = null;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw {
          isRetryable: true,
          status: 'UNAVAILABLE',
          code: response.status || 503,
          message: 'Received non-JSON response from server. AI service may be restarting.',
        };
      }

      if (!response.ok || !data.success) {
        throw data;
      }

      // Success!
      item.status = 'completed';
      item.segments = data.segments || [];
      item.modelUsed = data.modelUsed;
      item.error = undefined;

      // Increase concurrency adaptively on steady success
      this.consecutiveSuccesses++;
      if (this.consecutiveSuccesses >= 3 && this.concurrency < this.maxConcurrency) {
        this.concurrency = this.maxConcurrency;
      }
    } catch (err: any) {
      this.consecutiveSuccesses = 0;
      const isRetryable =
        err?.retryable !== false &&
        (err?.error?.code === 503 ||
          err?.error?.status === 'UNAVAILABLE' ||
          err?.code === 503 ||
          err?.status === 503 ||
          err?.isRetryable !== false);

      const serverRetryAfter = err?.retryAfter || err?.error?.retryAfter;

      item.retries++;
      item.error = err?.error?.message || err?.message || 'Temporary AI server busy';

      // Drop concurrency to 1 immediately when 503 occurs
      this.concurrency = this.minConcurrency;

      if (isRetryable && item.retries < item.maxRetries) {
        const delayMs = calculateBackoffDelayMs(item.retries, serverRetryAfter);
        item.status = 'retry_wait';
        item.nextRetryTimestamp = Date.now() + delayMs;
        item.error = `AI server temporarily busy. Retrying automatically in ${Math.round(
          delayMs / 1000
        )}s... (Attempt ${item.retries}/${item.maxRetries})`;
      } else {
        item.status = 'failed';
      }
    } finally {
      this.activeWorkers--;
      onWorkerDone();
    }
  }

  private emitProgress() {
    const completedCount = this.items.filter((it) => it.status === 'completed').length;
    const retryWaitCount = this.items.filter((it) => it.status === 'retry_wait').length;
    const processingItems = this.items.filter((it) => it.status === 'processing');
    const activeChunkIndex =
      processingItems.length > 0 ? processingItems[0].index : Math.min(completedCount, this.items.length - 1);

    const isBusyWaiting = retryWaitCount > 0 && this.activeWorkers === 0;

    // Calculate dynamic ETA based on average seconds per completed chunk
    let estSecondsLeft = 0;
    if (completedCount > 0) {
      const elapsedSec = (Date.now() - this.startTime) / 1000;
      const secPerChunk = elapsedSec / completedCount;
      const remainingChunks = this.items.length - completedCount;
      estSecondsLeft = Math.round(remainingChunks * secPerChunk);
    } else {
      estSecondsLeft = this.items.length * 12;
    }

    let statusText = '';
    if (completedCount === this.items.length) {
      statusText = 'All audio chunks transcribed successfully!';
    } else if (isBusyWaiting) {
      statusText = `Waiting for AI service... (${retryWaitCount} chunk in retry queue)`;
    } else if (processingItems.length > 0) {
      statusText = `Transcribing Khmer chunk ${activeChunkIndex + 1} of ${this.items.length}...`;
    } else {
      statusText = 'Preparing transcription queue...';
    }

    const chunkProgressList: ChunkProgress[] = this.items.map((it) => ({
      id: it.id,
      index: it.index,
      total: it.total,
      status: it.status,
      timeRange: [it.startTime, it.endTime],
      duration: it.duration,
      retries: it.retries,
      maxRetries: it.maxRetries,
      nextRetryTimestamp: it.nextRetryTimestamp,
      error: it.error,
      modelUsed: it.modelUsed,
      segments: it.segments,
    }));

    this.onProgress({
      items: chunkProgressList,
      completedCount,
      totalCount: this.items.length,
      activeChunkIndex,
      retryWaitCount,
      concurrency: this.concurrency,
      statusText,
      isBusyWaiting,
      estSecondsLeft,
    });
  }
}
