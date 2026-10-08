import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileVideo,
  Play,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Layers,
  CheckCircle,
  HelpCircle,
  Wand2,
  AlertCircle
} from 'lucide-react';
import { VideoMetadata } from '../types/subtitles';
import { SAMPLE_VIDEOS, SampleVideoOption, createDemoVideoFile } from '../utils/sampleData';

interface VideoUploaderProps {
  metadata: VideoMetadata | null;
  onVideoSelected: (file: File) => void;
  onGenerate: () => void;
  isProcessing: boolean;
  onSelectSample: (sample: SampleVideoOption) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  metadata,
  onVideoSelected,
  onGenerate,
  isProcessing,
  onSelectSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generatingDemo, setGeneratingDemo] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const validateAndSelect = (file: File) => {
    const validExtensions = ['.mp4', '.mov', '.webm', '.mkv'];
    const fileNameLower = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileNameLower.endsWith(ext)) || file.type.startsWith('video/');

    if (!isValid) {
      alert('Please upload an MP4 video (or MOV, WebM, MKV).');
      return;
    }
    onVideoSelected(file);
  };

  const handleSampleClick = async (sample: SampleVideoOption) => {
    try {
      setGeneratingDemo(true);
      const demoFile = await createDemoVideoFile(sample);
      onVideoSelected(demoFile);
      onSelectSample(sample);
    } catch (err) {
      console.error('Error generating demo video:', err);
    } finally {
      setGeneratingDemo(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full space-y-6">
      {!metadata ? (
        /* Upload Area */
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex min-h-[290px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
              onChange={handleFileInput}
              className="hidden"
            />

            {/* Glowing Icon */}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 via-red-500/10 to-indigo-500/20 ring-1 ring-amber-500/30 transition-transform group-hover:scale-110">
              <UploadCloud className="h-8 w-8 text-amber-400" />
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">
              Drag & Drop MP4 Video Here
            </h3>

            <p className="mt-1 text-sm text-slate-400 font-khmer">
              ឬចុចដើម្បីជ្រើសរើសវីដេអូ MP4 ពីកុំព្យូទ័ររបស់អ្នក
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-300 ring-1 ring-amber-500/30">
                Primary: MP4
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400">MOV</span>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400">WebM</span>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400">MKV</span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
                No MP3 conversion needed
              </span>
            </div>

            <button
              type="button"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all group-hover:from-amber-400 group-hover:to-amber-500"
            >
              <UploadCloud className="h-4 w-4" />
              Upload Video
            </button>
          </div>

          {/* Quick Sample Demo Video Section */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Or Test Instantly with Cambodian Sample Videos
                </span>
              </div>
              <span className="text-[11px] text-slate-400">1-Click Test</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SAMPLE_VIDEOS.map((sample) => (
                <button
                  key={sample.id}
                  disabled={generatingDemo}
                  onClick={() => handleSampleClick(sample)}
                  className="group relative flex flex-col rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left transition-all hover:border-amber-500/40 hover:bg-slate-800/80 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                      {sample.category}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {sample.duration}s
                    </span>
                  </div>

                  <h4 className="mt-2 text-xs font-bold text-white group-hover:text-amber-300">
                    {sample.title}
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                    {sample.description}
                  </p>

                  <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                    <Play className="h-3 w-3 fill-amber-400" />
                    <span>{generatingDemo ? 'Loading...' : 'Load Sample'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Video Metadata & Action Panel */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
                <FileVideo className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white truncate max-w-md">
                  {metadata.filename}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Duration: <strong className="text-slate-200">{formatDuration(metadata.duration)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Resolution: <strong className="text-slate-200">{metadata.resolution}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    FPS: <strong className="text-slate-200">{metadata.fps}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Size: <strong className="text-slate-200">{formatFileSize(metadata.fileSize)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Change video button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors self-start sm:self-auto"
            >
              Change Video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {/* Diagnostics Badges */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              {metadata.hasAudio ? (
                <Volume2 className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <VolumeX className="h-5 w-5 text-red-400 shrink-0" />
              )}
              <div>
                <span className="block text-[11px] text-slate-400">Audio Track</span>
                <span className={`text-xs font-bold ${metadata.hasAudio ? 'text-emerald-400' : 'text-red-400'}`}>
                  {metadata.hasAudio ? 'Detected' : 'No Audio'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400 shrink-0">
                ខ្មែរ
              </span>
              <div>
                <span className="block text-[11px] text-slate-400">Target Language</span>
                <span className="text-xs font-bold text-blue-300">
                  Khmer (ភាសាខ្មែរ)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <CheckCircle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-400">CapCut Export</span>
                <span className="text-xs font-bold text-amber-300">
                  Optimized SRT
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <Layers className="h-5 w-5 text-indigo-400 shrink-0" />
              <div>
                <span className="block text-[11px] text-slate-400">Long Video Engine</span>
                <span className="text-xs font-bold text-indigo-300">
                  {metadata.duration > 60 ? 'Intelligent Chunks' : 'Single Stream'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-400 font-khmer">
              ចុចប៊ូតុងខាងក្រោមដើម្បីដំណើរការស្រង់សំឡេង និងបង្កើតអក្សររត់ស្វ័យប្រវត្ត
            </div>

            <button
              onClick={onGenerate}
              disabled={isProcessing}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-red-500 px-8 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.02] hover:shadow-amber-500/30 disabled:opacity-50 disabled:scale-100"
            >
              <Wand2 className="h-4 w-4" />
              <span>Generate Khmer Subtitles</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
