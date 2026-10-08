import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoUploader } from './components/VideoUploader';
import { ProcessingProgress } from './components/ProcessingProgress';
import { VideoPlayerPreview } from './components/VideoPlayerPreview';
import { SubtitleEditor } from './components/SubtitleEditor';
import { AdvancedSettingsModal } from './components/AdvancedSettingsModal';
import { CapCutGuideModal } from './components/CapCutGuideModal';
import {
  SubtitleSegment,
  ProcessingStage,
  ChunkProgress,
  GenerationSettings,
  VideoMetadata,
  CapCutValidationResult,
} from './types/subtitles';
import { extractAndChunkAudio } from './utils/audioExtractor';
import {
  generateSRT,
  generateTXT,
  generateVTT,
  validateForCapCut,
  repairSubtitlesForCapCut,
  downloadSubtitleFile,
} from './utils/srtFormatter';
import { calibrateAndAntiLagSubtitles } from './utils/timingRefiner';
import { SampleVideoOption } from './utils/sampleData';
import { ChunkQueueManager, QueueProgressCallbackData } from './utils/chunkQueue';

const DEFAULT_SETTINGS: GenerationSettings = {
  mode: 'accuracy',
  subtitleLength: 'short', // Target: 2–3 words per line
  maxCharsPerLine: 20,
  minDuration: 0.6,
  maxDuration: 2.5,
  speakerDetection: false,
  punctuation: true,
  autoKhmerCorrection: true,
  capCutOptimization: true,
  showSpeakerNames: false,
};

export default function App() {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleSegment[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [estimatedSecondsLeft, setEstimatedSecondsLeft] = useState<number>(0);
  const [chunks, setChunks] = useState<ChunkProgress[]>([]);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [retryWaitCount, setRetryWaitCount] = useState<number>(0);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [isCorrectingKhmer, setIsCorrectingKhmer] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  const queueManagerRef = useRef<ChunkQueueManager | null>(null);

  // CapCut validation state
  const [capCutValidation, setCapCutValidation] = useState<CapCutValidationResult>({
    isValid: true,
    capCutReady: true,
    issues: [],
    repairsApplied: [],
    totalSubtitles: 0,
    overlappingCount: 0,
    invalidDurationCount: 0,
    emptyCount: 0,
  });

  // Re-run CapCut validation whenever subtitles or duration changes
  useEffect(() => {
    if (subtitles.length > 0) {
      const result = validateForCapCut(subtitles, metadata?.duration || 0);
      setCapCutValidation(result);
    }
  }, [subtitles, metadata?.duration]);

  // Handle video selection (file drop or picker)
  const handleVideoSelected = (file: File) => {
    // Cancel any running queue
    if (queueManagerRef.current) {
      queueManagerRef.current.cancel();
      queueManagerRef.current = null;
    }

    const videoUrl = URL.createObjectURL(file);
    const videoElem = document.createElement('video');
    videoElem.src = videoUrl;
    videoElem.preload = 'metadata';

    videoElem.onloadedmetadata = () => {
      const width = videoElem.videoWidth || 1920;
      const height = videoElem.videoHeight || 1080;
      const duration = videoElem.duration || 0;

      // Quick audio check with AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      file.arrayBuffer().then((buf) => {
        audioCtx
          .decodeAudioData(buf)
          .then((decoded) => {
            let sum = 0;
            const channel = decoded.getChannelData(0);
            const count = Math.min(channel.length, 48000 * 5);
            for (let i = 0; i < count; i++) sum += channel[i] * channel[i];
            const hasAudio = Math.sqrt(sum / count) > 0.0005;

            setMetadata({
              file,
              filename: file.name,
              duration,
              resolution: `${width}x${height}`,
              fps: 30,
              fileSize: file.size,
              hasAudio,
              speechDetected: hasAudio,
              videoUrl,
              audioBuffer: decoded,
            });
            audioCtx.close();
          })
          .catch(() => {
            setMetadata({
              file,
              filename: file.name,
              duration,
              resolution: `${width}x${height}`,
              fps: 30,
              fileSize: file.size,
              hasAudio: true,
              speechDetected: true,
              videoUrl,
            });
            audioCtx.close();
          });
      });
    };

    // Reset previous subtitles & stage
    setSubtitles([]);
    setProcessingStage('idle');
    setProgressPercent(0);
    setError(null);
    setChunks([]);
    setCompletedCount(0);
    setRetryWaitCount(0);
  };

  // Sample video selector
  const handleSelectSample = (sample: SampleVideoOption) => {
    // Cancel any running queue
    if (queueManagerRef.current) {
      queueManagerRef.current.cancel();
      queueManagerRef.current = null;
    }
    const calibrated = calibrateAndAntiLagSubtitles(sample.segments, sample.duration);
    setSubtitles(calibrated);
    setProcessingStage('ready');
  };

  // Main subtitle generation workflow with fault-tolerant Queue Manager
  const handleGenerate = async () => {
    if (!metadata?.file) return;

    setError(null);
    setSubtitles([]);
    setRetryAttempt(0);
    setProcessingStage('extracting');
    setStatusMessage('Extracting audio track from MP4...');
    setProgressPercent(10);

    try {
      // 1. Audio Extraction, Offset Calibration & Intelligent Chunking
      // Target chunk duration is 45-60 seconds (well within safe Gemini multimodal token limits)
      const { chunks: audioChunks, totalDuration, hasAudio, audioOffset } = await extractAndChunkAudio(
        metadata.file,
        50,
        (pct, text) => {
          setProgressPercent(Math.round(pct * 0.25));
          setStatusMessage(text);
        }
      );

      if (!hasAudio || audioChunks.length === 0) {
        throw new Error('No audible speech detected in this video file. Please check your video audio volume.');
      }

      if (audioOffset > 0) {
        setMetadata(prev => prev ? { ...prev, audioOffset } : null);
      }

      setProcessingStage('detecting');
      setStatusMessage(`Divided into ${audioChunks.length} audio chunk(s) for ${totalDuration.toFixed(1)}s video (Audio timeline calibrated).`);
      setProgressPercent(28);

      // Initialize Chunk Queue with non-blocking retry queue & adaptive concurrency
      setProcessingStage('transcribing');

      const queueManager = new ChunkQueueManager(
        audioChunks,
        settings,
        (data: QueueProgressCallbackData) => {
          setChunks(data.items);
          setCompletedCount(data.completedCount);
          setActiveChunkIndex(data.activeChunkIndex);
          setRetryWaitCount(data.retryWaitCount);
          setConcurrency(data.concurrency);
          setStatusMessage(data.statusText);
          setEstimatedSecondsLeft(data.estSecondsLeft);

          // Calculate overall percentage smoothly
          const chunkProgressRatio = data.totalCount > 0 ? data.completedCount / data.totalCount : 0;
          const currentPct = 28 + Math.round(chunkProgressRatio * 52); // from 28% to 80%
          setProgressPercent(currentPct);
        },
        audioOffset
      );

      queueManagerRef.current = queueManager;

      // Start the queue and await all completed segments
      const accumulatedSegments = await queueManager.start();

      // 3. Khmer Contextual Correction Stage (Second pass)
      if (settings.autoKhmerCorrection && accumulatedSegments.length > 0) {
        setProcessingStage('correcting');
        setStatusMessage('Running Khmer contextual spell-checker and phrase polish...');
        setProgressPercent(85);

        try {
          const corrRes = await fetch('/api/correct-khmer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              segments: accumulatedSegments,
              context: metadata.filename,
            }),
          });

          if (corrRes.ok) {
            const corrData = await corrRes.json();
            if (Array.isArray(corrData.segments) && corrData.segments.length > 0) {
              accumulatedSegments.splice(0, accumulatedSegments.length, ...corrData.segments);
            }
          }
        } catch (corrErr) {
          console.warn('Khmer correction non-fatal error:', corrErr);
        }
      }

      // 4. Timing Synchronization, Speech Onset Calibration & Anti-Lag Pass
      setProcessingStage('synchronizing');
      setStatusMessage('Calibrating speech onset timestamps and anti-lag synchronization...');
      setProgressPercent(92);

      const antiLagSegments = calibrateAndAntiLagSubtitles(
        accumulatedSegments,
        metadata.duration
      );

      // 5. CapCut Compatibility Validation & Auto-repair
      setProcessingStage('validating');
      setStatusMessage('Validating 2-3 word SRT format for CapCut...');
      setProgressPercent(97);

      const { repairedSegments, repairsApplied } = repairSubtitlesForCapCut(
        antiLagSegments,
        metadata.duration
      );

      const finalValidation = validateForCapCut(repairedSegments, metadata.duration);
      finalValidation.repairsApplied = repairsApplied;

      setSubtitles(repairedSegments);
      setCapCutValidation(finalValidation);

      // Finish!
      setProcessingStage('ready');
      setStatusMessage('✓ CapCut Ready Khmer Subtitles Generated (Zero-Lag Synced)!');
      setProgressPercent(100);
      setEstimatedSecondsLeft(0);
    } catch (err: any) {
      console.error('Generation failed:', err);
      setProcessingStage('error');
      setError(err?.message || 'Processing failed. Please check network and retry.');
    }
  };

  // Re-run second-pass Khmer AI correction from editor button
  const handleTriggerKhmerContextCorrection = async () => {
    if (subtitles.length === 0) return;
    try {
      setIsCorrectingKhmer(true);
      const res = await fetch('/api/correct-khmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: subtitles,
          context: metadata?.filename || 'Cambodian video',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.segments) && data.segments.length > 0) {
          setSubtitles(data.segments);
        }
      }
    } catch (err) {
      console.error('Manual Khmer correction error:', err);
    } finally {
      setIsCorrectingKhmer(false);
    }
  };

  // Auto-repair for CapCut button in editor
  const handleRunCapCutRepair = () => {
    const { repairedSegments, repairsApplied } = repairSubtitlesForCapCut(
      subtitles,
      metadata?.duration || 0
    );
    setSubtitles(repairedSegments);
    const newValidation = validateForCapCut(repairedSegments, metadata?.duration || 0);
    newValidation.repairsApplied = repairsApplied;
    setCapCutValidation(newValidation);
  };

  // Download handlers
  const getBaseFilename = () => {
    if (!metadata?.filename) return 'batta_subtitles';
    return metadata.filename.replace(/\.[^/.]+$/, '');
  };

  const handleDownloadSRT = () => {
    const content = generateSRT(subtitles, settings.showSpeakerNames);
    downloadSubtitleFile(content, `${getBaseFilename()}.srt`, 'application/x-subrip;charset=utf-8');
  };

  const handleDownloadTXT = () => {
    const content = generateTXT(subtitles, true, settings.showSpeakerNames);
    downloadSubtitleFile(content, `${getBaseFilename()}.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadVTT = () => {
    const content = generateVTT(subtitles, settings.showSpeakerNames);
    downloadSubtitleFile(content, `${getBaseFilename()}.vtt`, 'text/vtt;charset=utf-8');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        subtitlesCount={subtitles.length}
        capCutReady={capCutValidation.capCutReady}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section if no video uploaded yet */}
        {!metadata && (
          <div className="text-center max-w-2xl mx-auto space-y-3 pt-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CapCut Ready Khmer Subtitle Engine</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Batta Subtitle AI
            </h1>

            <p className="text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">
              Professional Khmer Subtitle Generator
            </p>

            <p className="text-sm sm:text-base text-slate-400 font-khmer max-w-xl mx-auto leading-relaxed">
              បំប្លែងសំឡេងខ្មែរពីវីដេអូ MP4 ទៅជាអក្សររត់ស្វ័យប្រវត្ត ២–៣ ពាក្យគ្មានដកឃ្លា ជាមួយនឹងពេលវេលាត្រឹមត្រូវ ១០០% ស្របតាមក្បួន CapCut នាំចេញជាឯកសារ .srt ភ្លាមៗ។
            </p>
          </div>
        )}

        {/* Video Upload & Metadata Component */}
        <VideoUploader
          metadata={metadata}
          onVideoSelected={handleVideoSelected}
          onGenerate={handleGenerate}
          isProcessing={processingStage !== 'idle' && processingStage !== 'ready' && processingStage !== 'error'}
          onSelectSample={handleSelectSample}
        />

        {/* Processing Progress Visualizer */}
        {processingStage !== 'idle' && (
          <ProcessingProgress
            stage={processingStage}
            percent={progressPercent}
            statusMessage={statusMessage}
            estimatedSecondsLeft={estimatedSecondsLeft}
            chunks={chunks}
            activeChunkIndex={activeChunkIndex}
            completedCount={completedCount}
            retryWaitCount={retryWaitCount}
            concurrency={concurrency}
            retryAttempt={retryAttempt}
            error={error}
            onManualRetry={handleGenerate}
          />
        )}

        {/* Generated Subtitles View: Video Preview & Subtitle Editor */}
        {subtitles.length > 0 && metadata && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
            {/* Left Column: Synchronized Video Player */}
            <div className="lg:col-span-5 space-y-4 sticky top-20">
              <VideoPlayerPreview
                videoUrl={metadata.videoUrl}
                segments={subtitles}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                onSelectSegment={(seg) => setCurrentTime(seg.start)}
              />

              <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs space-y-2">
                <span className="font-semibold text-slate-300 block">CapCut Export Quick Info</span>
                <p className="text-slate-400 font-khmer text-[11px] leading-relaxed">
                  ឯកសារ .SRT ត្រូវបានបង្កើនប្រសិទ្ធភាពតាមក្បួន CapCut (UTF-8, គ្មានពេលជាន់គ្នា, ចន្លោះមីលីវិនាទីត្រឹមត្រូវ)។ ចុច <strong className="text-amber-400">Download SRT</strong> រួចទាញចូល CapCut។
                </p>
              </div>
            </div>

            {/* Right Column: Interactive Subtitle Editor */}
            <div className="lg:col-span-7">
              <SubtitleEditor
                segments={subtitles}
                onUpdateSegments={setSubtitles}
                currentTime={currentTime}
                onSeekTo={(time) => setCurrentTime(time)}
                capCutValidation={capCutValidation}
                onRunCapCutRepair={handleRunCapCutRepair}
                onTriggerKhmerContextCorrection={handleTriggerKhmerContextCorrection}
                isCorrectingKhmer={isCorrectingKhmer}
                onDownloadSRT={handleDownloadSRT}
                onDownloadTXT={handleDownloadTXT}
                onDownloadVTT={handleDownloadVTT}
              />
            </div>
          </div>
        )}
      </main>

      {/* Advanced Settings Modal */}
      <AdvancedSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={setSettings}
      />

      {/* CapCut Guide Modal */}
      <CapCutGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Batta Subtitle AI</span>
            <span>•</span>
            <span className="text-amber-400">Professional Khmer Subtitle Generator</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Direct MP4 Upload</span>
            <span>•</span>
            <span>CapCut Optimized .SRT</span>
            <span>•</span>
            <span>UTF-8 Khmer Unicode</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
