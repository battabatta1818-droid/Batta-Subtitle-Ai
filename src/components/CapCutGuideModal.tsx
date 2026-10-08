import React, { useState } from 'react';
import { X, Film, CheckCircle2, Copy, Check, Download, Monitor, Smartphone } from 'lucide-react';

interface CapCutGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CapCutGuideModal: React.FC<CapCutGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [platform, setPlatform] = useState<'desktop' | 'mobile'>('desktop');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-500 text-slate-950 font-bold">
              <Film className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">How to Import Subtitles into CapCut</h3>
              <p className="text-xs text-slate-400 font-khmer">
                របៀបបញ្ចូលឯកសារ Subtitle (.srt) ទៅក្នុង CapCut Desktop និងទូរស័ព្ទ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Platform switcher tabs */}
        <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setPlatform('desktop')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
              platform === 'desktop'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="h-4 w-4" />
            <span>CapCut Desktop (PC & Mac)</span>
          </button>

          <button
            onClick={() => setPlatform('mobile')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
              platform === 'mobile'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>CapCut Mobile (iOS & Android)</span>
          </button>
        </div>

        {/* Instructions content */}
        <div className="space-y-3.5 text-xs text-slate-300">
          {platform === 'desktop' ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                  1
                </span>
                <div>
                  <strong className="text-white block font-semibold">Download the .SRT file</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Click "Download SRT" from Batta Subtitle AI. The file is saved in standard UTF-8 format.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                  2
                </span>
                <div>
                  <strong className="text-white block font-semibold">Open CapCut Desktop & Create Project</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Open your video in CapCut Desktop and drop the video onto the timeline.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                  3
                </span>
                <div>
                  <strong className="text-white block font-semibold">Import Subtitle</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-khmer">
                    ចូលទៅកាន់ផ្ទាំង <strong>Text</strong> (អក្សរ) &gt; ចុចលើ <strong>Auto captions</strong> ឬ <strong>Local captions (Import)</strong> &gt; ជ្រើសរើសឯកសារ <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">.srt</code> ដែលទើបដោនឡូត។
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                  4
                </span>
                <div>
                  <strong className="text-white block font-semibold">Choose Khmer Font</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-khmer">
                    ជ្រើសរើសពុម្ពអក្សរខ្មែរដូចជា <strong>Kantumruy Pro</strong>, <strong>Battambang</strong>, ឬ <strong>Khmer OS Siemreap</strong> ក្នុង CapCut ដើម្បីឱ្យអក្សរចេញមកស្អាតគ្មានកំហុសជើង។
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                  1
                </span>
                <div>
                  <strong className="text-white block font-semibold">Save SRT to Files / Google Drive</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Download the `.srt` file to your iPhone Files app or Android Downloads folder.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                  2
                </span>
                <div>
                  <strong className="text-white block font-semibold">Open CapCut App</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Open your video project in CapCut Mobile.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                  3
                </span>
                <div>
                  <strong className="text-white block font-semibold">Import Subtitles</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5 font-khmer">
                    ចុចលើ <strong>Text</strong> &gt; <strong>Auto captions</strong> &gt; <strong>Upload subtitle file (.srt)</strong>។
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tip banner */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            Every exported file is automatically validated for CapCut with zero overlaps, sequential indexes, and verified milliseconds.
          </span>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
