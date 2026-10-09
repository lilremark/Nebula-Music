import React from 'react';
import { Play, Pause, Square, SkipForward, RotateCcw, Settings2 } from 'lucide-react';
import { useStore } from '../context/Store';
import { usePlatform } from '../platform/PlatformContext';
import { DjCover } from '../components/player/DjCover';
import { CollectionHeader } from '../components/CollectionHeader';

const primaryClass = 'flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition text-sm dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed';
const actionClass = 'flex items-center justify-center rounded-lg bg-neutral-200 text-neutral-700 transition hover:bg-neutral-300 hover:text-neutral-900 dark:bg-white/10 dark:text-white dark:hover:bg-white/20';

export function AiDjView() {
  const { dj, service, queue, currentSongIndex, playQueueIndex, setView, isPlaying, togglePlay } = useStore();
  const platform = usePlatform();
  const { state, presentation } = dj;
  const tracks = state.active ? queue : [];
  const duration = tracks.reduce((total, song) => total + song.duration, 0);
  const status = state.phase === 'preparing' ? 'Preparing your session…'
    : presentation.speech ? presentation.playing ? 'Your DJ is speaking' : 'DJ paused'
    : state.active ? `${state.completed} of ${dj.config.interval} tracks · ${isPlaying ? 'Listening' : 'Paused'}`
    : 'Ready to play';

  return <div className="nebula-dj-view min-h-full w-full pb-32" data-nebula-view="ai-dj" style={{ '--album-color': '#6d3aa5' } as React.CSSProperties}>
    <CollectionHeader title="AI DJ" artwork={<DjCover animateIdle playing={presentation.playing} analyser={dj.voiceAnalyser} />} metadata={
      <div data-nebula-album-meta className="text-neutral-600 dark:text-white/60">
        <p>A mix based on your listening and likes.</p>
        {tracks.length > 0 && <p className="mt-2 text-sm">{tracks.length} tracks · {Math.floor(duration / 60)} min</p>}
      </div>
    } actions={
      <div data-nebula-album-options className="nebula-dj-collection-actions flex items-center gap-3">
        {state.active ? <>
          <button type="button" className={primaryClass} onClick={togglePlay}>{isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}{isPlaying ? 'Pause' : 'Resume'}</button>
          <button type="button" className={actionClass} aria-label="Stop DJ" title="Stop DJ" onClick={() => dj.stop()}><Square /><span className="sr-only">Stop DJ</span></button>
        </> : <button type="button" className={primaryClass} disabled={!platform?.aiDj || !dj.readiness?.ready || state.phase === 'preparing' || presentation.speech} onClick={() => void dj.start()}><Play className="fill-current" />Start AI DJ</button>}
        {state.active && presentation.speech && <button type="button" className={actionClass} aria-label="Skip interlude" title="Skip interlude" onClick={dj.skipInterlude}><SkipForward /><span className="sr-only">Skip interlude</span></button>}
        {dj.canRestore && <button type="button" className={actionClass} aria-label="Return to previous queue" title="Return to previous queue" onClick={dj.restore}><RotateCcw /><span className="sr-only">Return to previous queue</span></button>}
        <button type="button" className={actionClass} aria-label="DJ settings" title="DJ settings" onClick={() => setView('SETTINGS', 'settings-ai-dj')}><Settings2 /><span className="sr-only">DJ settings</span></button>
      </div>
    } />
    <div data-nebula-detail-content className="px-6 lg:px-10">
      <div className="nebula-dj-view-status" role="status">{platform?.aiDj ? !state.active && !dj.readiness?.ready ? dj.readiness?.error || 'Checking local models…' : status : 'AI DJ is available in the Windows desktop app.'}</div>
      {state.active && state.preparingNext && <p className="nebula-dj-status">Preparing the next interlude…</p>}
      {state.error && <p className="nebula-dj-error" role="status">{state.error}</p>}
      {dj.config.showTranscript && state.transcript && <section className="nebula-dj-caption" aria-label="DJ transcription"><h2>Your DJ</h2><blockquote>{state.transcript}</blockquote></section>}
      <section aria-label="AI DJ queue" data-nebula-track-section className="nebula-dj-view-queue mb-8">
        <div data-nebula-track-section-inner>
          <h2 className="nebula-dj-mix-heading text-sm font-semibold uppercase tracking-wide text-neutral-700 dark:text-white/60">Your mix<span className="text-xs font-normal normal-case tracking-normal">{tracks.length} tracks</span></h2>
          <div data-nebula-track-list>
            {tracks.map((song, index) => <button type="button" key={song.id + ':' + index} className="nebula-dj-track-row group flex w-full items-center gap-4 text-left" data-nebula-track-row data-current={index === currentSongIndex} aria-label={`Play ${song.title} by ${song.artist}`} aria-current={index === currentSongIndex ? 'true' : undefined} onClick={() => playQueueIndex(index)}>
              <span data-nebula-track-play className="nebula-dj-track-number relative flex shrink-0 items-center justify-center">
                {index === currentSongIndex && isPlaying ? <Play className="text-primary" fill="currentColor" /> : <><span className="group-hover:opacity-0">{index + 1}</span><Play className="absolute opacity-0 group-hover:opacity-100" fill="currentColor" /></>}
              </span>
              <img className="nebula-dj-track-art" src={service.getCoverArtUrl(song.coverArt || song.id, 80)} alt="" loading="lazy" />
              <span className="nebula-dj-track-copy"><strong data-nebula-track-title className={index === currentSongIndex ? 'text-primary' : ''}>{song.title}</strong><small>{song.artist}</small></span>
              <span className="nebula-dj-track-album">{song.album}</span>
              <span data-nebula-track-duration className="nebula-dj-track-duration shrink-0 text-right font-mono">{Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, '0')}</span>
            </button>)}
            {!tracks.length && <p className="nebula-dj-empty px-8 py-12 text-center">Your mix will appear here.</p>}
          </div>
        </div>
      </section>
    </div>
  </div>;
}
