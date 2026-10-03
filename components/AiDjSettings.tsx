import React, { useState } from 'react';
import { Headphones } from 'lucide-react';
import { useStore } from '../context/Store';
import { usePlatform } from '../platform/PlatformContext';
import { SettingPanel } from './ui';
import type { DjLocalSettings } from '../playback/djTypes';

export function AiDjSettings() {
  const { dj } = useStore(); const platform = usePlatform();
  const { readiness, modelStatus } = dj;
  const downloading = modelStatus?.phase === 'downloading' || modelStatus?.phase === 'installing';
  const [error, setError] = useState(''); const [confirmReset, setConfirmReset] = useState(false);
  const save = (patch: Partial<DjLocalSettings>) => { setError(''); void dj.saveConfig(patch).catch(error => setError(String(error))); };
  return <SettingPanel icon={Headphones} title="AI DJ" description="Personalize your DJ’s voice and listening preferences.">
    <div className="nebula-dj-settings-status" role="status">{!platform?.aiDj ? 'AI DJ requires the Windows desktop app.' : !readiness ? 'Checking local models…' : readiness.ready ? 'Local models ready · runs on your device' : readiness.error}</div>
    {platform?.aiDj && <div className="nebula-dj-model-download">
      <p>SmolLM3-3B and Kokoro voices · 2.01 GB download. Allow 5 GB free disk space for installation (7 GB for repair).</p>
      <p>Windows x64 · 16 GB RAM recommended · CPU supported, no GPU required.</p>
      {downloading && <><progress aria-label="AI DJ model download" max={modelStatus?.total || 1} value={modelStatus?.received || 0} /><p role="status">{modelStatus?.phase === 'installing' ? 'Installing and verifying…' : `${Math.round((modelStatus?.received || 0) / (modelStatus?.total || 1) * 100)}% downloaded`} · {modelStatus?.file}</p></>}
      <div className="nebula-dj-actions">{downloading
        ? <button type="button" onClick={() => void platform.aiDj!.cancelDownload().catch(error => setError(String(error)))}>Cancel download</button>
        : <button type="button" disabled={dj.state.active} onClick={() => void platform.aiDj!.downloadModels().catch(error => setError(String(error)))}>{readiness?.ready ? 'Repair models' : modelStatus?.phase === 'error' ? 'Retry download' : 'Download DJ models'}</button>}
      </div>
      <small>Downloaded from <a href="https://huggingface.co/ggml-org/SmolLM3-3B-GGUF" onClick={event => { event.preventDefault(); void platform.openExternal('https://huggingface.co/ggml-org/SmolLM3-3B-GGUF'); }}>ggml-org</a> and <a href="https://huggingface.co/echogarden/echogarden-packages" onClick={event => { event.preventDefault(); void platform.openExternal('https://huggingface.co/echogarden/echogarden-packages'); }}>Echogarden</a> on Hugging Face. Verified before use; no API key needed.</small>
    </div>}
    <fieldset disabled={!platform?.aiDj} className="nebula-dj-settings">
      <label className="nebula-dj-transcript-setting"><span>Show DJ transcription<small>Display commentary in the AI DJ Discover view.</small></span><input type="checkbox" checked={dj.config.showTranscript} onChange={event => save({ showTranscript: event.target.checked })} /></label>
      <label>Tracks between interludes<select disabled={dj.state.active} value={dj.config.interval} onChange={event => save({ interval: Number(event.target.value) as 4 | 5 })}><option value={4}>4 tracks</option><option value={5}>5 tracks</option></select></label>
      <label>Interlude style<select disabled={dj.state.active} value={dj.config.style} onChange={event => save({ style: event.target.value as DjLocalSettings['style'] })}><option value="standalone">Between sets</option><option value="over-music">Over lowered music</option></select></label>
      <label>Discovery<select disabled={dj.state.active} value={dj.config.discovery} onChange={event => save({ discovery: event.target.value as DjLocalSettings['discovery'] })}><option value="familiar">Familiar</option><option value="balanced">Balanced</option><option value="discover">Discover</option></select></label>
      <label>DJ voice<select disabled={dj.state.active} value={dj.config.voice} onChange={event => save({ voice: event.target.value as DjLocalSettings['voice'] })}><option value="Michael">Michael · US English</option><option value="Heart">Heart · US English</option></select></label>
      <label>Voice level<input aria-label="DJ voice level" type="range" min={0} max={1} step={0.05} value={dj.config.voiceLevel} onChange={event => save({ voiceLevel: Number(event.target.value) })} /></label>
      <div className="nebula-dj-actions"><button type="button" disabled={dj.state.active || dj.state.phase === 'preparing' || dj.state.phase === 'speaking' || !readiness?.ready} onClick={() => void dj.preview()}>Preview voice</button><button type="button" onClick={() => setConfirmReset(true)}>Reset DJ learning</button></div>
      {confirmReset && <div className="nebula-dj-reset" role="group" aria-label="Confirm DJ learning reset"><p>Clear DJ listening events for this library? Likes and play counts stay saved.</p><button type="button" onClick={() => { setConfirmReset(false); void dj.resetLearning().catch(error => setError(String(error))); }}>Confirm reset</button><button type="button" onClick={() => setConfirmReset(false)}>Cancel</button></div>}
    </fieldset>
    {error && <p className="nebula-dj-error" role="alert">{error}</p>}
  </SettingPanel>;
}
