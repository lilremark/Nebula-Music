import React, { useState } from 'react';
import { Download, Headphones, Volume2 } from 'lucide-react';
import { useStore } from '../context/Store';
import { usePlatform } from '../platform/PlatformContext';
import { SettingPanel, ToggleRow } from './ui';
import { CustomDropdown } from './CustomDropdown';
import type { DjLocalSettings } from '../playback/djTypes';

const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-900 transition hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10';

function PreferenceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="nebula-dj-preference-row flex items-center justify-between gap-4 px-5 py-4">
    <span className="text-sm font-semibold text-neutral-900 dark:text-white">{label}</span>
    <div className="nebula-dj-preference-control w-52 shrink-0">{children}</div>
  </div>;
}

export function AiDjSettings() {
  const { dj } = useStore();
  const platform = usePlatform();
  const { readiness, modelStatus } = dj;
  const desktopAvailable = !!platform?.aiDj;
  const downloading = modelStatus?.phase === 'downloading' || modelStatus?.phase === 'installing';
  const preferencesDisabled = !desktopAvailable || dj.state.active;
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const save = (patch: Partial<DjLocalSettings>) => { setError(''); void dj.saveConfig(patch).catch(error => setError(String(error))); };

  return <SettingPanel icon={Headphones} title="AI DJ" description="Personalize your DJ’s voice and listening preferences.">
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Local models</h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-white/50" role="status">{!desktopAvailable ? 'AI DJ requires the Windows desktop app.' : !readiness ? 'Checking local models…' : readiness.ready ? 'Ready · runs on your device' : readiness.error}</p>
        </div>
        {desktopAvailable && <button type="button" className={buttonClass} disabled={!downloading && dj.state.active} onClick={() => {
          setError('');
          void (downloading ? platform.aiDj!.cancelDownload() : platform.aiDj!.downloadModels()).catch(error => setError(String(error)));
        }}>
          {!downloading && <Download className="h-3.5 w-3.5" aria-hidden="true" />}
          {downloading ? 'Cancel download' : readiness?.ready ? 'Repair models' : modelStatus?.phase === 'error' ? 'Retry download' : 'Download DJ models'}
        </button>}
      </div>
      {desktopAvailable && <div className="nebula-dj-model-download mt-4 rounded-lg border border-neutral-200 bg-neutral-100/70 p-4 text-xs leading-relaxed text-neutral-600 dark:border-white/10 dark:bg-black/20 dark:text-white/50">
        <p className="font-semibold text-neutral-900 dark:text-white">SmolLM3-3B + Kokoro voices · 2.01 GB download</p>
        <p className="mt-1">Windows x64 · 16 GB RAM recommended · CPU supported</p>
        <p>Allow 5 GB free disk space (7 GB for repair). No GPU or API key required.</p>
        {downloading && <div className="mt-3">
          <progress aria-label="AI DJ model download" max={modelStatus?.total || 1} value={modelStatus?.received || 0} />
          <p className="mt-2 break-all" role="status">{modelStatus?.phase === 'installing' ? 'Installing and verifying…' : `${Math.round((modelStatus?.received || 0) / (modelStatus?.total || 1) * 100)}% downloaded`} · {modelStatus?.file}</p>
        </div>}
        <p className="mt-3">From <a href="https://huggingface.co/ggml-org/SmolLM3-3B-GGUF" onClick={event => { event.preventDefault(); void platform.openExternal('https://huggingface.co/ggml-org/SmolLM3-3B-GGUF'); }}>ggml-org</a> and <a href="https://huggingface.co/echogarden/echogarden-packages" onClick={event => { event.preventDefault(); void platform.openExternal('https://huggingface.co/echogarden/echogarden-packages'); }}>Echogarden</a> on Hugging Face. Verified before use.</p>
      </div>}
    </div>
    <fieldset disabled={!desktopAvailable} className="m-0 min-w-0 border-0 p-0 divide-y divide-neutral-200 dark:divide-white/10">
      <div className="nebula-dj-transcript-setting"><ToggleRow label="Show DJ transcription" description="Display commentary in the AI DJ Discover view." checked={dj.config.showTranscript} disabled={!desktopAvailable} onChange={showTranscript => save({ showTranscript })} /></div>
      <PreferenceRow label="Tracks between interludes"><CustomDropdown ariaLabel="Tracks between interludes" clearable={false} disabled={preferencesDisabled} value={String(dj.config.interval)} onChange={value => save({ interval: Number(value) as 4 | 5 })} options={[{ value: '4', label: '4 tracks' }, { value: '5', label: '5 tracks' }]} /></PreferenceRow>
      <PreferenceRow label="Interlude style"><CustomDropdown ariaLabel="Interlude style" clearable={false} disabled={preferencesDisabled} value={dj.config.style} onChange={value => save({ style: value as DjLocalSettings['style'] })} options={[{ value: 'standalone', label: 'Between sets' }, { value: 'over-music', label: 'Over lowered music' }]} /></PreferenceRow>
      <PreferenceRow label="Discovery"><CustomDropdown ariaLabel="Discovery" clearable={false} disabled={preferencesDisabled} value={dj.config.discovery} onChange={value => save({ discovery: value as DjLocalSettings['discovery'] })} options={[{ value: 'familiar', label: 'Familiar' }, { value: 'balanced', label: 'Balanced' }, { value: 'discover', label: 'Discover' }]} /></PreferenceRow>
      <PreferenceRow label="DJ voice"><CustomDropdown ariaLabel="DJ voice" clearable={false} disabled={preferencesDisabled} value={dj.config.voice} onChange={value => save({ voice: value as DjLocalSettings['voice'] })} options={[{ value: 'Michael', label: 'Michael · US English' }, { value: 'Heart', label: 'Heart · US English' }]} /></PreferenceRow>
      <PreferenceRow label="Voice level"><div className="flex items-center gap-3">
        <input className="nebula-dj-voice-level min-w-0 flex-1" aria-label="DJ voice level" type="range" min={0} max={1} step={0.05} value={dj.config.voiceLevel} onChange={event => save({ voiceLevel: Number(event.target.value) })} />
        <output className="w-9 text-right text-xs tabular-nums text-neutral-600 dark:text-white/50" aria-live="off">{Math.round(dj.config.voiceLevel * 100)}%</output>
      </div></PreferenceRow>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button type="button" className={buttonClass} disabled={dj.state.active || dj.state.phase === 'preparing' || dj.state.phase === 'speaking' || !readiness?.ready} onClick={() => void dj.preview()}><Volume2 className="h-3.5 w-3.5" aria-hidden="true" />Preview voice</button>
        <button type="button" className={buttonClass} onClick={() => setConfirmReset(true)}>Reset DJ learning</button>
      </div>
      {confirmReset && <div className="px-5 py-4" role="group" aria-label="Confirm DJ learning reset">
        <p className="mb-3 text-xs leading-relaxed text-neutral-600 dark:text-white/50">Clear DJ listening events for this library? Likes and play counts stay saved.</p>
        <div className="flex flex-wrap gap-3"><button type="button" className={buttonClass} onClick={() => { setConfirmReset(false); void dj.resetLearning().catch(error => setError(String(error))); }}>Confirm reset</button><button type="button" className={buttonClass} onClick={() => setConfirmReset(false)}>Cancel</button></div>
      </div>}
    </fieldset>
    {error && <p className="px-5 py-4 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>}
  </SettingPanel>;
}
