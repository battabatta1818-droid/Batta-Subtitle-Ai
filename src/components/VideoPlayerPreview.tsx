import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  Eye,
  EyeOff
} from 'lucide-react';
import { SubtitleSegment } from '../types/subtitles';

interface VideoPlayerPreviewProps {
  videoUrl: string;
  segments: SubtitleSegment[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSelectSegment: (segment: SubtitleSegment) => void;
}

export const VideoPlayerPreview: React.FC<VideoPlayerPreviewProps> = ({
  videoUrl,
  segments,
  currentTime,
  onTimeUpdate,
  onSelectSegment,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState<'capcut-yellow' | 'white-boxed' | 'classic'>(
    'capcut-yellow'
  );

  // Sync with external seek requests
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // 60 FPS high-precision playback loop to eliminate browser timeupdate (250ms) lag
  useEffect(() => {
    let animId: number;
    if (isPlaying) {
      const updateFrame = () => {
        if (videoRef.current && !videoRef.current.paused) {
          onTimeUpdate(videoRef.current.currentTime);
        }
        animId = requestAnimationFrame(updateFrame);
      };
      animId = requestAnimationFrame(updateFrame);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, onTimeUpdate]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      onTimeUpdate(time);
    }
  };

  // Find active subtitle at current timestamp
  const activeSegment = segments.find(
    s => currentTime >= s.start && currentTime <= s.end
  );

  const activeIndex = segments.findIndex(
    s => currentTime >= s.start && currentTime <= s.end
  );

  const jumpToPrevious = () => {
    if (segments.length === 0) return;
    const prev = segments
      .slice()
      .reverse()
      .find(s => s.start < currentTime - 0.5);

    if (prev) {
      if (videoRef.current) videoRef.current.currentTime = prev.start;
      onSelectSegment(prev);
    } else if (segments[0]) {
      if (videoRef.current) videoRef.current.currentTime = segments[0].start;
      onSelectSegment(segments[0]);
    }
  };

  const jumpToNext = () => {
    if (segments.length === 0) return;
    const next = segments.find(s => s.start > currentTime + 0.1);
    if (next) {
      if (videoRef.current) videoRef.current.currentTime = next.start;
      onSelectSegment(next);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Video Container */}
      <div className="relative aspect-video w-full bg-black select-none flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="h-full w-full object-contain cursor-pointer"
          onClick={togglePlay}
        />

        {/* Synchronized Khmer Subtitle Overlay (CapCut Style) */}
        {showSubtitles && activeSegment && (
          <div className="pointer-events-none absolute bottom-12 left-0 right-0 z-20 flex justify-center px-6 text-center">
            <div
              className={`max-w-[85%] font-khmer font-bold transition-all ${
                subtitleStyle === 'capcut-yellow'
                  ? 'text-yellow-300 text-lg sm:text-2xl md:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] [text-shadow:_0_2px_10px_rgb(0_0_0_/_90%),_0_0_2px_rgb(0_0_0_/_100%)]'
                  : subtitleStyle === 'white-boxed'
                  ? 'bg-black/80 text-white rounded-lg px-4 py-1.5 text-base sm:text-xl md:text-2xl shadow-xl'
                  : 'text-white text-lg sm:text-2xl md:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]'
              }`}
            >
              {activeSegment.text}
            </div>
          </div>
        )}

        {/* Big Play Overlay if paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/90 text-slate-950 shadow-2xl shadow-amber-500/40 transition-transform hover:scale-110 active:scale-95 z-10"
          >
            <Play className="h-8 w-8 fill-slate-950 translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Media Controls Bar */}
      <div className="border-t border-slate-800/80 bg-slate-900/95 p-3 space-y-2">
        {/* Scrubber timeline */}
        <div className="relative flex items-center group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 group-hover:h-2 transition-all"
          />

          {/* Subtitle segment ticks on timeline */}
          {duration > 0 &&
            segments.map((seg) => (
              <div
                key={seg.id}
                title={`#${seg.id}: ${seg.text.slice(0, 20)}...`}
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = seg.start;
                  onSelectSegment(seg);
                }}
                className={`absolute top-0 bottom-0 pointer-events-none rounded-sm transition-all ${
                  currentTime >= seg.start && currentTime <= seg.end
                    ? 'bg-amber-400 opacity-90'
                    : 'bg-indigo-400/40 opacity-40'
                }`}
                style={{
                  left: `${(seg.start / duration) * 100}%`,
                  width: `${Math.max(0.4, ((seg.end - seg.start) / duration) * 100)}%`,
                  height: '4px',
                }}
              />
            ))}
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={togglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
            </button>

            <button
              onClick={jumpToPrevious}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Previous Subtitle"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={jumpToNext}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              title="Next Subtitle"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>

            <span className="font-mono text-slate-400">
              <strong className="text-white">{formatTime(currentTime)}</strong> / {formatTime(duration)}
            </span>
          </div>

          {/* Subtitle Styling & Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                showSubtitles
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
              title="Toggle Subtitle Overlay"
            >
              {showSubtitles ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>Subtitles</span>
            </button>

            {showSubtitles && (
              <select
                value={subtitleStyle}
                onChange={(e: any) => setSubtitleStyle(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="capcut-yellow">CapCut Yellow</option>
                <option value="white-boxed">White Boxed</option>
                <option value="classic">Clean White</option>
              </select>
            )}

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/60 text-slate-400 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
