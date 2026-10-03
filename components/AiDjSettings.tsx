import React, { useEffect, useState } from 'react';
import { Headphones } from 'lucide-react';
import { useStore } from '../context/Store';
import { usePlatform } from '../platform/PlatformContext';
import { SettingPanel } from './ui';
import type { DjReadiness } from '../electron/aiDj/localProtocol';
import type { DjLocalSettings } from '../playback/djTypes';

export function AiDjSettings() {
  const { dj } = useStore(); const platform = usePlatform();
  const [readiness, setReadiness] = useState<DjReadiness | null>(null);
  const [error, setError] = useState(''); const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { let live = true; void platform?.aiDj?.readiness().then(result => { if (live) setReadiness(result); }).catch(error => { if (live) setReadiness({ ready: false, error: String(error) }); }); return () => { live = false; }; }, [platform]);
  const save = (patch: Partial<DjLocalSettings>) => { setError(''); void dj.saveConfig(patch).catch(error => setError(String(error))); };
  return <SettingPanel icon={Headphones} title="AI DJ" description="Personalize your DJ’s voice and listening preferences.">
    <div className="nebula-dj-settings-status" role="status">{!platform?.aiDj ? 'AI DJ requires the Windows desktop app.' : !readiness ? 'Checking local models…' : readiness.ready ? 'Local models ready · no model downloads or API keys needed' : readiness.error}</div>
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
