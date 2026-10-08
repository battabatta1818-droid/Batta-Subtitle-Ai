export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface SubtitleSegment {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  confidence: number; // 0 - 100
  speaker?: string;
  flaggedForReview?: boolean;
  reviewReason?: string;
  timingScore?: number; // 0 - 100% Timing accuracy score
  timingWarnings?: string[]; // Specific warnings, e.g. "Starts before speech", "Pause gap"
  speechOnset?: number; // Actual first spoken sound timestamp
  speechOffset?: number; // Actual last spoken sound timestamp
  startDelayMs?: number; // Milliseconds subtitle start differs from speechOnset (positive = lagging)
  endDelayMs?: number;   // Milliseconds subtitle end differs from speechOffset
  words?: WordTimestamp[];
}

export interface TimingVerificationReport {
  overallAccuracyScore: number; // 0 - 100%
  earlySubtitlesCount: number;
  lateSubtitlesCount: number;
  prematureEndsCount: number;
  overlappingCount: number;
  largeGapsCount: number;
  verifiedCount: number;
  laggingCorrectedCount?: number;
  avgStartDelayMs?: number;
  warnings: string[];
}

export type ProcessingStage =
  | 'idle'
  | 'extracting'
  | 'detecting'
  | 'transcribing'
  | 'correcting'
  | 'synchronizing'
  | 'validating'
  | 'ready'
  | 'error';

export type ChunkStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'retry_wait'
  | 'failed';

export interface ChunkProgress {
  id: string; // e.g. "chunk-1"
  index: number;
  total: number;
  status: ChunkStatus;
  timeRange: [number, number]; // [start, end]
  duration: number;
  retries: number;
  maxRetries: number;
  nextRetryTimestamp?: number;
  error?: string;
  modelUsed?: string;
  segments?: SubtitleSegment[];
}

export interface QueueStats {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  retryWait: number;
  activeChunkIndex: number;
  concurrency: number;
  activeModelName?: string;
}

export interface GenerationSettings {
  mode: 'accuracy' | 'balanced' | 'fast';
  subtitleLength: 'short' | 'medium' | 'long';
  maxCharsPerLine: number;
  minDuration: number;
  maxDuration: number;
  speakerDetection: boolean;
  punctuation: boolean;
  autoKhmerCorrection: boolean;
  capCutOptimization: boolean;
  showSpeakerNames: boolean;
}

export interface VideoMetadata {
  file?: File;
  filename: string;
  duration: number; // seconds
  resolution: string; // e.g. "1920x1080"
  fps: number;
  fileSize: number; // bytes
  hasAudio: boolean;
  speechDetected: boolean;
  videoUrl: string;
  audioBuffer?: AudioBuffer;
  audioOffset?: number; // calibrated audio track offset in seconds
}

export interface CapCutValidationResult {
  isValid: boolean;
  capCutReady: boolean;
  issues: string[];
  repairsApplied: string[];
  totalSubtitles: number;
  overlappingCount: number;
  invalidDurationCount: number;
  emptyCount: number;
}
