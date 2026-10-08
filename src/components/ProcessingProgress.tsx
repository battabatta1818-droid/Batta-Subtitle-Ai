import React from 'react';
import {
  CheckCircle2,
  Loader2,
  Clock,
  Layers,
  AlertTriangle,
  RotateCcw,
  Check,
  Hourglass,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { ProcessingStage, ChunkProgress } from '../types/subtitles';

interface ProcessingProgressProps {
  stage: ProcessingStage;
  percent: number;
  statusMessage: string;
  estimatedSecondsLeft: number;
  chunks: ChunkProgress[];
  activeChunkIndex: number;
  completedCount?: number;
  retryWaitCount?: number;
  concurrency?: number;
  retryAttempt: number;
  error: string | null;
  onManualRetry?: () => void;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  stage,
  percent,
  statusMessage,
  estimatedSecondsLeft,
  chunks,
  activeChunkIndex,
  completedCount = 0,
  retryWaitCount = 0,
  concurrency = 2,
  retryAttempt,
  error,
  onManualRetry,
}) => {
  const steps: { key: ProcessingStage; label: string; desc: string }[] = [
    { key: 'extracting', label: 'Extracting Audio', desc: 'Decoding MP4 audio track without manual MP3 conversion' },
    { key: 'detecting', label: 'Detecting Speech', desc: 'Detecting Khmer voice activity and pause boundaries' },
    { key: 'transcribing', label: 'Transcribing Khmer', desc: 'Recognizing Khmer Unicode with word timestamps' },
    { key: 'correcting', label: 'Khmer Correction', desc: 'Contextual spell-check & phrase polish' },
    { key: 'synchronizing', label: 'Timing Sync', desc: 'Aligning subtitle segments with audio boundaries' },
    { key: 'validating', label: 'CapCut Validation', desc: 'Verifying UTF-8 SRT formatting and zero overlap' },
  ];

  const getStepStatus = (stepKey: ProcessingStage) => {
    const stageOrder: ProcessingStage[] = [
      'idle',
      'extracting',
      'detecting',
      'transcribing',
      'correcting',
      'synchronizing',
      'validating',
      'ready',
    ];

    const currentIndex = stageOrder.indexOf(stage);
    const stepIndex = stageOrder.indexOf(stepKey);

    if (stage === 'error') {
      if (stepIndex < currentIndex) return 'completed';
      if (stepIndex === currentIndex) return 'error';
      return 'pending';
    }

    if (currentIndex > stepIndex || stage === 'ready') {
      return 'completed';
    } else if (currentIndex === stepIndex) {
      return 'active';
    } else {
      return 'pending';
    }
  };

  const formatTime = (secs: number) => {
    if (secs <= 0 || isNaN(secs)) return 'Waiting for AI service...';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Find any active retry message
  const retryingChunk = chunks.find((c) => c.status === 'retry_wait');

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md space-y-6">
      {/* Top Header with Progress Bar and ETA */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Batta Subtitle AI Audio Pipeline
              </span>
              {chunks.length > 0 && (
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  {completedCount} / {chunks.length} chunks
                </span>
              )}
              {concurrency && (
                <span className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                  <Cpu className="h-3 w-3" />
                  {concurrency} worker{concurrency > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{statusMessage}</span>
              {stage !== 'ready' && stage !== 'error' && (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              )}
            </h3>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {stage !== 'ready' && stage !== 'error' && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>Est. remaining:</span>
                <strong className="text-slate-200">{formatTime(estimatedSecondsLeft)}</strong>
              </div>
            )}
            <div className="text-right">
              <span className="text-2xl font-black text-amber-400">{Math.round(percent)}%</span>
            </div>
          </div>
        </div>

        {/* Progress Track */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 transition-all duration-300 ease-out shadow-sm shadow-amber-500/50"
            style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
          />
        </div>
      </div>

      {/* Gentle Reassurance for Temporary AI Service Load */}
      {retryWaitCount > 0 && stage !== 'error' && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">AI server temporarily busy. Retrying automatically...</span>
            <span className="block text-[11px] text-amber-300/80 mt-0.5">
              {retryingChunk?.error || `${retryWaitCount} chunk(s) queued for automatic retry. Other chunks continue processing uninterrupted.`}
            </span>
          </div>
        </div>
      )}

      {/* Fatal Error Alert (only if non-retryable or max attempts exhausted) */}
      {stage === 'error' && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Processing paused</p>
              <p className="text-xs text-red-300/80 mt-1">
                {error || 'An unexpected error occurred during audio processing.'}
              </p>
              <p className="text-xs text-amber-300/80 mt-1 font-khmer">
                ចុចប៊ូតុងខាងក្រោមដើម្បីសាកល្បងដំណើរការឡើងវិញចំពោះផ្នែកដែលនៅសល់ (Resume missing chunks)
              </p>
            </div>
          </div>

          {onManualRetry && (
            <div className="flex justify-end">
              <button
                onClick={onManualRetry}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Resume Processing Missing Chunks</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pipeline Steps Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((st, idx) => {
          const status = getStepStatus(st.key);
          return (
            <div
              key={st.key}
              className={`relative flex flex-col rounded-xl border p-3 transition-all ${
                status === 'completed'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : status === 'active'
                  ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                  : status === 'error'
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-slate-800/80 bg-slate-900/40 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  0{idx + 1}
                </span>

                {status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : status === 'active' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                ) : status === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-slate-700" />
                )}
              </div>

              <span className="mt-2 text-xs font-bold text-white leading-tight">
                {st.label}
              </span>
              <span className="mt-1 text-[10px] text-slate-400 line-clamp-2 leading-tight">
                {st.desc}
              </span>
            </div>
          );
        })}
      </div>

      {/* Robust Chunk Queue Visualizer */}
      {chunks.length > 0 && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Layers className="h-3.5 w-3.5 text-amber-400" />
              <span>
                Transcription Queue ({completedCount} / {chunks.length} Completed)
              </span>
            </span>

            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Done ({completedCount})
              </span>
              {retryWaitCount > 0 && (
                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" /> Retry Queue ({retryWaitCount})
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {chunks.map((chk) => {
              const isCompleted = chk.status === 'completed';
              const isProcessing = chk.status === 'processing';
              const isRetryWait = chk.status === 'retry_wait';
              const isFailed = chk.status === 'failed';

              return (
                <div
                  key={chk.id || chk.index}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                    isCompleted
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : isProcessing
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-md ring-1 ring-amber-400/50'
                      : isRetryWait
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 animate-pulse'
                      : isFailed
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : 'border-slate-800 bg-slate-900/80 text-slate-400'
                  }`}
                  title={
                    isRetryWait
                      ? chk.error || 'Waiting to retry'
                      : isCompleted
                      ? `Completed (${chk.segments?.length || 0} segments)`
                      : `Chunk ${chk.index + 1}`
                  }
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 font-bold" />
                  ) : isProcessing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  ) : isRetryWait ? (
                    <RotateCcw className="h-3.5 w-3.5 text-amber-300 animate-spin" />
                  ) : (
                    <Hourglass className="h-3 w-3 text-slate-500" />
                  )}

                  <span>
                    Chunk {chk.index + 1} ({chk.timeRange[0].toFixed(0)}s–{chk.timeRange[1].toFixed(0)}s)
                  </span>

                  {chk.retries > 0 && !isCompleted && (
                    <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-300">
                      R{chk.retries}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
