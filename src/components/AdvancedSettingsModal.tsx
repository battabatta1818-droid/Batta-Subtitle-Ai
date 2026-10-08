import React from 'react';
import { X, Sliders, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { GenerationSettings } from '../types/subtitles';

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GenerationSettings;
  onSaveSettings: (settings: GenerationSettings) => void;
}

export const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [form, setForm] = React.useState<GenerationSettings>(settings);

  React.useEffect(() => {
    setForm(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Advanced Settings</h3>
              <p className="text-xs text-slate-400 font-khmer">
                ការកំណត់កម្រិតខ្ពស់សម្រាប់ម៉ាស៊ីនបំប្លែងសំឡេងខ្មែរ
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

        {/* Settings Body */}
        <div className="space-y-5 text-xs max-h-[60vh] overflow-y-auto pr-1">
          {/* Subtitle Mode */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Subtitle Mode (កម្រិតភាពជាក់លាក់)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'accuracy', label: 'Maximum Accuracy', desc: 'Highest precision (Default)' },
                { key: 'balanced', label: 'Balanced', desc: 'Optimal speed & precision' },
                { key: 'fast', label: 'Fast', desc: 'Rapid generation' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setForm({ ...form, mode: opt.key as any })}
                  className={`flex flex-col rounded-xl border p-2.5 text-left transition-all ${
                    form.mode === opt.key
                      ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500/40'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs">{opt.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Length */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-300">
                Subtitle Length (ប្រវែងអក្សររត់ក្នុងមួយបន្ទាត់)
              </label>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                Target: 2–3 Words
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'short', label: '2–3 Words (Default)', desc: 'CapCut / TikTok Style', chars: 20 },
                { key: 'medium', label: '4–5 Words', desc: 'Balanced', chars: 36 },
                { key: 'long', label: 'Full Sentence', desc: 'Extended', chars: 55 },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      subtitleLength: opt.key as any,
                      maxCharsPerLine: opt.chars,
                    })
                  }
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                    form.subtitleLength === opt.key
                      ? 'border-amber-500 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-xs">{opt.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Max Characters & Duration Constraints */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-400 mb-1">
                Max Characters / Subtitle
              </label>
              <input
                type="number"
                min={20}
                max={90}
                value={form.maxCharsPerLine}
                onChange={(e) => setForm({ ...form, maxCharsPerLine: parseInt(e.target.value) || 42 })}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-400 mb-1">
                Min Duration (Seconds)
              </label>
              <input
                type="number"
                step="0.1"
                min={0.3}
                max={3.0}
                value={form.minDuration}
                onChange={(e) => setForm({ ...form, minDuration: parseFloat(e.target.value) || 0.8 })}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-400 mb-1">
                Max Duration (Seconds)
              </label>
              <input
                type="number"
                step="0.5"
                min={2.0}
                max={15.0}
                value={form.maxDuration}
                onChange={(e) => setForm({ ...form, maxDuration: parseFloat(e.target.value) || 6.0 })}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            {/* Automatic Khmer Correction */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div>
                <span className="font-semibold text-slate-200 block">Automatic Khmer Correction</span>
                <span className="text-[11px] text-slate-400">
                  Fixes homophones, coeng placement, and unnatural phrasing
                </span>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, autoKhmerCorrection: !form.autoKhmerCorrection })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  form.autoKhmerCorrection ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    form.autoKhmerCorrection ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* CapCut Optimization */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div>
                <span className="font-semibold text-slate-200 block">CapCut Optimization</span>
                <span className="text-[11px] text-slate-400">
                  Enforces strict SRT sequential index, comma ms, and zero timestamp overlap
                </span>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, capCutOptimization: !form.capCutOptimization })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  form.capCutOptimization ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    form.capCutOptimization ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Speaker Detection */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div>
                <span className="font-semibold text-slate-200 block">Speaker Detection</span>
                <span className="text-[11px] text-slate-400">
                  Differentiates between Speaker 1 and Speaker 2 (Default: OFF)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, speakerDetection: !form.speakerDetection })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  form.speakerDetection ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    form.speakerDetection ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Punctuation */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div>
                <span className="font-semibold text-slate-200 block">Punctuation & Clean Spacing</span>
                <span className="text-[11px] text-slate-400">
                  Natural sentence boundaries with modern Khmer punctuation (Default: ON)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, punctuation: !form.punctuation })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  form.punctuation ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    form.punctuation ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
