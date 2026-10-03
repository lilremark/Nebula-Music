import React, { useEffect, useState } from 'react';
import { Headphones, Play, Square, SkipForward, RotateCcw } from 'lucide-react';
import { useStore } from '../../context/Store';
import { usePlatform } from '../../platform/PlatformContext';

function VoiceWaveform() {
  const { dj, isPlaying } = useStore();
  const [points, setPoints] = useState('0,24 320,24');
  useEffect(() => {
    const analyser = dj.voiceAnalyser;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!analyser || dj.state.phase !== 'speaking' || !dj.voicePlaying) { setPoints('0,24 320,24'); return; }
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0, last = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 50) return;
      last = time; analyser.getByteTimeDomainData(samples);
      setPoints(Array.from({ length: 64 }, (_, index) => (index * 320 / 63).toFixed(1) + ',' + (24 + (samples[Math.floor(index * samples.length / 64)] - 128) / 128 * 22).toFixed(1)).join(' '));
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState !== 'visible' || reduced.matches) { setPoints('0,24 320,24'); return; }
      frame = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', refresh); reduced.addEventListener('change', refresh); refresh();
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', refresh); reduced.removeEventListener('change', refresh); };
  }, [dj.voiceAnalyser, dj.state.phase, dj.voicePlaying]);
  return <svg viewBox="0 0 320 48" className="nebula-dj-waveform" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
}

export function DjStatusButton({ onOpen }: { onOpen?: () => void }) {
  const { dj, setDjPanelOpen } = useStore(); const platform = usePlatform();
  if (!platform?.aiDj) return null;
  return <button type="button" className={'nebula-dj-launch ' + (dj.state.active ? 'is-active' : '')} onClick={() => { setDjPanelOpen(true); onOpen?.(); }} aria-label={dj.state.active ? 'Open active AI DJ session' : 'Open AI DJ'} aria-pressed={dj.state.active} title="AI DJ"><Headphones size={18} /><span>DJ</span></button>;
}

export function DjPanel() {
  const { dj, service, isPlaying, togglePlay } = useStore(); const platform = usePlatform();
  const active = dj.state.active; const speaking = dj.state.phase === 'speaking';
  return <section className="nebula-dj-panel" aria-label="AI DJ session">
    <div className="nebula-dj-heading"><span><Headphones size={18} /> AI DJ</span><small>On your device</small></div>
    <p className="nebula-dj-status" role="status">{!platform?.aiDj ? 'Available in the Windows desktop app' : dj.state.phase === 'preparing' ? 'Preparing your session…' : speaking ? dj.voicePlaying ? 'Your DJ is speaking' : 'DJ paused' : active ? dj.state.completed + ' of ' + dj.config.interval + ' tracks · ' + (isPlaying ? 'Listening' : 'Paused') : 'A personal mix, with a voice between sets.'}</p>
    {active && dj.state.preparingNext && <p className="nebula-dj-status" role="status">Preparing the next voice interlude…</p>}
    <VoiceWaveform />
    {dj.state.transcript && <blockquote className="nebula-dj-transcript">{dj.state.transcript}</blockquote>}
    <div className="nebula-dj-actions">
      {active ? <><button type="button" onClick={togglePlay}>{isPlaying ? 'Pause session' : 'Resume session'}</button><button type="button" onClick={() => dj.stop()}><Square size={14} /> Stop DJ</button></> : <button type="button" className="nebula-dj-primary" disabled={!platform?.aiDj || dj.state.phase === 'preparing'} onClick={() => void dj.start()}><Play size={14} /> Start AI DJ</button>}
      {speaking && <button type="button" onClick={dj.skipInterlude}><SkipForward size={14} /> Skip voice</button>}
      {dj.canRestore && <button type="button" onClick={dj.restore}><RotateCcw size={14} /> Return to previous queue</button>}
    </div>
    {dj.state.error && <p className="nebula-dj-error" role="status">{dj.state.error}</p>}
    <p className="nebula-dj-taste">{dj.state.taste || 'Your listening history and likes shape each set. Start a session to hear your mix.'}</p>
    {dj.state.upcoming.length > 0 && <div className="nebula-dj-next"><h3>Next set</h3>{dj.state.upcoming.map((song, index) => <div key={song.id + ':' + index}><img src={service.getCoverArtUrl(song.coverArt || song.id, 80)} alt="" /><span><strong>{song.title}</strong><small>{song.artist}</small></span></div>)}</div>}
  </section>;
}
