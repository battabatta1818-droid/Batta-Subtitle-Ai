import React from 'react';
import { Sparkles, Sliders, HelpCircle, Film, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  subtitlesCount: number;
  capCutReady: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenGuide,
  subtitlesCount,
  capCutReady,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-red-500 to-indigo-600 shadow-lg shadow-amber-500/20">
            <Film className="h-5 w-5 text-white" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white ring-2 ring-slate-950">
              ខ្មែរ
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">
                Batta Subtitle AI
              </span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                CapCut Ready
              </span>
            </div>
            <p className="text-xs text-amber-400/90 font-medium">
              Professional Khmer Subtitle Generator
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {subtitlesCount > 0 && (
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 md:flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{subtitlesCount} Lines</span>
              {capCutReady && <span className="font-semibold">• CapCut Ready</span>}
            </div>
          )}

          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            title="CapCut Import Guide"
          >
            <HelpCircle className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">CapCut Guide</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            title="Advanced Settings"
          >
            <Sliders className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
