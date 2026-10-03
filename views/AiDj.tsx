import React from 'react';
import { Play, Pause, Square, SkipForward, RotateCcw, Settings2, Headphones } from 'lucide-react';
import { useStore } from '../context/Store';
import { usePlatform } from '../platform/PlatformContext';
import { DjCover } from '../components/player/DjCover';

export function AiDjView() {
  const { dj, service, queue, currentSongIndex, playQueueIndex, setView, isPlaying, togglePlay } = useStore();
  const platform = usePlatform();
  const { state, presentation } = dj;
  const tracks = state.active ? queue : [];
  const status = state.phase === 'preparing' ? 'Preparing your session…'
    : presentation.speech ? presentation.playing ? 'Your DJ is speaking' : 'DJ paused'
    : state.active ? `${state.completed} of ${dj.config.interval} tracks · ${isPlaying ? 'Listening' : 'Paused'}`
    : 'Your music, with a personal introduction between sets.';
  return <div className="nebula-dj-view" data-nebula-view="ai-dj">
    <header className="nebula-dj-view-header">
      <div className="nebula-dj-view-art"><DjCover playing={presentation.playing} analyser={dj.voiceAnalyser} /></div>
      <div className="nebula-dj-view-copy">
        <span className="nebula-dj-eyebrow"><Headphones size={15} aria-hidden /> Discover · On your device</span>
        <h1>AI DJ</h1>
        <p>{state.taste || 'A mix shaped by your listening history and likes. Familiar favorites, new discoveries, and a voice between sets.'}</p>
        <div className="nebula-dj-actions">
          {state.active ? <><button type="button" className="nebula-dj-primary" onClick={togglePlay}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}{isPlaying ? 'Pause' : 'Resume'}</button><button type="button" onClick={() => dj.stop()}><Square size={15} />Stop DJ</button></>
            : <button type="button" className="nebula-dj-primary" disabled={!platform?.aiDj || state.phase === 'preparing' || presentation.speech} onClick={() => void dj.start()}><Play size={16} />Start AI DJ</button>}
          {state.active && presentation.speech && <button type="button" onClick={dj.skipInterlude}><SkipForward size={15} />Skip interlude</button>}
          {dj.canRestore && <button type="button" onClick={dj.restore}><RotateCcw size={15} />Return to previous queue</button>}
          <button type="button" onClick={() => setView('SETTINGS', 'settings-ai-dj')}><Settings2 size={15} />DJ settings</button>
        </div>
      </div>
    </header>
    <div className="nebula-dj-view-status" role="status">{platform?.aiDj ? status : 'AI DJ is available in the Windows desktop app.'}</div>
    {state.active && state.preparingNext && <p className="nebula-dj-status">Preparing the next interlude…</p>}
    {state.error && <p className="nebula-dj-error" role="status">{state.error}</p>}
    {dj.config.showTranscript && state.transcript && <section className="nebula-dj-caption" aria-label="DJ transcription"><h2>Your DJ</h2><blockquote>{state.transcript}</blockquote></section>}
    {tracks.length > 0 ? <section aria-label="AI DJ queue" className="nebula-dj-view-queue">
      <div className="nebula-dj-queue-heading"><h2>Your mix</h2><span>{tracks.length} tracks</span></div>
      {tracks.map((song, index) => <button type="button" key={song.id + ':' + index} className="nebula-dj-track-row" data-current={index === currentSongIndex} aria-label={`Play ${song.title} by ${song.artist}`} aria-current={index === currentSongIndex ? 'true' : undefined} onClick={() => playQueueIndex(index)}>
        <span className="nebula-dj-track-number">{index === currentSongIndex && isPlaying ? <Play size={14} fill="currentColor" /> : index + 1}</span>
        <img src={service.getCoverArtUrl(song.coverArt || song.id, 80)} alt="" loading="lazy" />
        <span className="nebula-dj-track-copy"><strong>{song.title}</strong><small>{song.artist}</small></span>
        <span className="nebula-dj-track-album">{song.album}</span>
        <span className="nebula-dj-track-duration">{Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, '0')}</span>
      </button>)}
    </section> : <p className="nebula-dj-empty">Start listening to build a mix. Your DJ learns from the music you enjoy and skip.</p>}
    {state.active && state.upcoming.length > 0 && <p className="nebula-dj-next-summary">Next set · {state.upcoming.map(song => song.artist).filter((artist, index, artists) => artists.indexOf(artist) === index).join(', ')}</p>}
  </div>;
}
