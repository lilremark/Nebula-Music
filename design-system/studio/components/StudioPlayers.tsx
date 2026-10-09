import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity, ChevronUp, Focus, Gauge, Heart, ListMusic, Maximize2, PanelRightClose,
  Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, X,
} from 'lucide-react';
import { useStore } from '../../../context/Store';
import { Visualizer } from '../../../components/Visualizer';
import { VISUALIZER_MODES, type ISong } from '../../../types';
import { AnimatedSwitch, ArtworkTrackCard, SegmentedControl, useDialogFocus } from './StudioKit';

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
};

function usePlaybackClock() {
  const { audioRef, queue, currentSongIndex } = useStore();
  const [clock, setClock] = useState({ current: 0, duration: queue[currentSongIndex]?.duration ?? 0 });
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const sync = () => setClock({ current: audio.currentTime || 0, duration: audio.duration || queue[currentSongIndex]?.duration || 0 });
    sync();
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('durationchange', sync);
    return () => { audio.removeEventListener('timeupdate', sync); audio.removeEventListener('durationchange', sync); };
  }, [audioRef, currentSongIndex, queue]);
  const seek = (value: number) => { if (audioRef.current) audioRef.current.currentTime = value; };
  return { ...clock, seek };
}

function PlayerButtons({ compact = false }: { compact?: boolean }) {
  const reduced = useReducedMotion();
  const { isPlaying, togglePlay, nextSong, prevSong, repeatMode, toggleRepeat, queue, playSong } = useStore();
  const shuffleQueue = () => {
    if (!queue.length) return;
    const shuffled = [...queue].sort(() => Math.random() - .5);
    playSong(shuffled[0], shuffled);
  };
  return <div className="studio-player-buttons" data-compact={compact}>
    {!compact && <button type="button" className="is-secondary" aria-label="Shuffle queue" title="Shuffle queue" onClick={shuffleQueue}><Shuffle /></button>}
    <div className="studio-transport-core">
      <button type="button" aria-label="Previous track" title="Previous track" onClick={prevSong}><SkipBack /></button>
      <button type="button" className="is-primary" aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}><AnimatePresence mode="wait" initial={false}><motion.span key={isPlaying ? 'pause' : 'play'} initial={reduced ? false : { opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? undefined : { opacity: 0, scale: .7 }} transition={{ duration: reduced ? 0 : .14 }}>{isPlaying ? <Pause /> : <Play />}</motion.span></AnimatePresence></button>
      <button type="button" aria-label="Next track" title="Next track" onClick={nextSong}><SkipForward /></button>
    </div>
    {!compact && <button type="button" className="is-secondary" aria-label={`Repeat ${repeatMode.toLowerCase()}`} title={`Repeat ${repeatMode.toLowerCase()}`} data-active={repeatMode !== 'OFF'} onClick={toggleRepeat}><Repeat2 /></button>}
  </div>;
}

function Timeline({ compact = false }: { compact?: boolean }) {
  const { current, duration, seek } = usePlaybackClock();
  return <div className="studio-timeline" data-compact={compact}>
    {!compact && <span>{formatTime(current)}</span>}
    <span className="studio-timeline-track">
      <input type="range" aria-label="Track position" min={0} max={Math.max(duration, 1)} step={.1} value={Math.min(current, duration || 1)} onChange={event => seek(Number(event.target.value))} style={{ '--progress': `${duration ? current / duration * 100 : 0}%` } as React.CSSProperties} />
    </span>
    {!compact && <span>{formatTime(duration)}</span>}
  </div>;
}

function HoldVolume({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; value: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const clamp = (next: number) => Math.min(1, Math.max(0, next));
  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, value };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const width = trackRef.current?.getBoundingClientRect().width;
    if (!drag || drag.pointerId !== event.pointerId || !width) return;
    onChange(clamp(drag.value + (event.clientX - drag.x) / width));
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? .1 : .05;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); onChange(clamp(value - step)); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); onChange(clamp(value + step)); }
    if (event.key === 'Home') { event.preventDefault(); onChange(0); }
    if (event.key === 'End') { event.preventDefault(); onChange(1); }
  };
  return <div className="studio-hold-volume" data-dragging={dragging}>
    <Volume2 aria-hidden />
    <div
      ref={trackRef}
      className="studio-hold-volume-track"
      role="slider"
      tabIndex={0}
      aria-label="Volume"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)} percent`}
      title="Hold and drag to adjust volume"
      style={{ '--volume': `${value * 100}%` } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
      onKeyDown={onKeyDown}
    ><span aria-hidden /></div>
  </div>;
}

function SongIdentity({ song, onExpand, compact = false }: { song: ISong; onExpand: () => void; compact?: boolean }) {
  const { service, setView, toggleLike } = useStore();
  const art = service.getCoverArtUrl(song.coverArt || song.id, compact ? 160 : 500);
  return <div className="studio-song-identity" data-compact={compact}>
    <button type="button" className="studio-song-art" onClick={onExpand} aria-label="Open full player"><img src={art} alt="" /><Maximize2 /></button>
    <div>
      <button type="button" onClick={() => song.albumId && setView('ALBUM_DETAIL', song.albumId)}><strong>{song.title}</strong></button>
      <button type="button" onClick={() => song.artistId && setView('ARTIST_DETAIL', song.artistId)}><span>{song.artist}</span></button>
    </div>
    {!compact && <button type="button" className="studio-icon-button" aria-label={song.starred ? 'Unlike track' : 'Like track'} data-active={song.starred} onClick={() => toggleLike(song)}><Heart /></button>}
  </div>;
}

export function SidebarPlayer({ onExpand, onCollapse }: { onExpand: () => void; onCollapse: () => void }) {
  const { queue, currentSongIndex, isPlaying, togglePlay, playSong, volume, setVolume, playbackRate, setPlaybackRate, pitch, setPitch, pitchCorrection, setPitchCorrection, toggleLike, service } = useStore();
  const song = queue[currentSongIndex];
  const [tab, setTab] = useState<'queue' | 'sound'>('queue');
  if (!song) return null;
  const art = service.getCoverArtUrl(song.coverArt || song.id, 600);
  return <aside className="studio-sidebar-player" aria-label="Now playing sidebar">
    <img className="studio-sidebar-ambient" src={art} alt="" aria-hidden />
    <header><span>Now Playing</span><div><button type="button" aria-label="Open full player" onClick={onExpand}><Maximize2 /></button><button type="button" aria-label="Collapse player" onClick={onCollapse}><PanelRightClose /></button></div></header>
    <ArtworkTrackCard
      art={art} title={song.title} artist={song.artist}
      active={isPlaying} onPlay={togglePlay} onOpen={onExpand}
      action={<button type="button" className="studio-icon-button" data-active={song.starred} onClick={() => toggleLike(song)} aria-label={song.starred ? 'Unlike track' : 'Like track'}><Heart /></button>}
    />
    <div className="studio-sidebar-controls"><Timeline /><PlayerButtons /></div>
    <SegmentedControl value={tab} onChange={setTab} label="Player details" options={[{ value: 'queue', label: 'Up Next' }, { value: 'sound', label: 'Sound' }]} />
    {tab === 'queue' ? <div className="studio-queue-list">
      {queue.slice(currentSongIndex + 1, currentSongIndex + 6).map((item, index) => <button type="button" key={`${item.id}-${index}`} onClick={() => playSong(item, queue)}>
        <img src={service.getCoverArtUrl(item.coverArt || item.id, 80)} alt="" /><span><strong>{item.title}</strong><small>{item.artist}</small></span><span>{formatTime(item.duration)}</span>
      </button>)}
      {queue.length <= currentSongIndex + 1 && <p className="studio-queue-empty">The queue ends here.</p>}
    </div> : <div className="studio-sound-panel">
      <label><span><Volume2 />Volume</span><strong>{Math.round(volume * 100)}%</strong></label>
      <input type="range" min={0} max={1} step={.01} value={volume} onChange={event => setVolume(Number(event.target.value))} aria-label="Volume" />
      <label><span><Gauge />Playback Speed</span><strong>{playbackRate.toFixed(2)}×</strong></label>
      <input type="range" min={.5} max={2} step={.05} value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))} aria-label="Playback speed" />
      <label><span><Activity />Pitch</span><strong>{pitch > 0 ? '+' : ''}{pitch} st</strong></label>
      <input type="range" min={-12} max={12} step={1} value={pitch} onChange={event => setPitch(Number(event.target.value))} aria-label="Pitch in semitones" />
      <div className="studio-setting-inline"><span><strong>Pitch Correction</strong><small>Keep voices natural while changing speed.</small></span><AnimatedSwitch label="Pitch correction" checked={pitchCorrection} onCheckedChange={setPitchCorrection} /></div>
    </div>}
  </aside>;
}

export function FloatingPlayer({ onExpand, onRestore }: { onExpand: () => void; onRestore: () => void }) {
  const { queue, currentSongIndex, volume, setVolume } = useStore();
  const song = queue[currentSongIndex];
  if (!song) return null;
  return <div className="studio-floating-player" role="region" aria-label="Compact player">
    <SongIdentity song={song} onExpand={onExpand} compact />
    <Timeline compact />
    <PlayerButtons compact />
    <div className="studio-floating-volume"><Volume2 /><input type="range" min={0} max={1} step={.01} value={volume} onChange={event => setVolume(Number(event.target.value))} aria-label="Volume" /></div>
    <button type="button" className="studio-icon-button" onClick={onRestore} aria-label="Restore sidebar player"><ChevronUp /></button>
  </div>;
}

export function LargeNowPlaying({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduced = useReducedMotion();
  const {
    queue, currentSongIndex, isPlaying, service, setView, playQueueIndex, openPlaylistModal,
    toggleLike, volume, setVolume, playbackRate, setPlaybackRate, pitch, setPitch,
    pitchCorrection, setPitchCorrection, visualizerMode, setVisualizerMode, isZenMode, setZenMode, settings,
  } = useStore();
  const song = queue[currentSongIndex];
  const [panel, setPanel] = useState<'queue' | 'lyrics' | 'details'>('queue');
  const [lyrics, setLyrics] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [vinylOpen, setVinylOpen] = useState(false);
  const art = song ? service.getCoverArtUrl(song.coverArt || song.id, 900) : '';
  const closePlayer = useCallback(() => { setZenMode(false); onClose(); }, [onClose, setZenMode]);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, closePlayer, 'container');
  useEffect(() => {
    if (!open || !song || panel !== 'lyrics') return;
    let live = true;
    setLyricsLoading(true);
    void service.getLyrics(song.artist, song.title, song.album, song.duration, song.id)
      .then(value => { if (live) setLyrics(value || 'No lyrics found for this track.'); })
      .finally(() => { if (live) setLyricsLoading(false); });
    return () => { live = false; };
  }, [open, panel, service, song]);
  useEffect(() => { setVinylOpen(false); }, [song?.id]);
  const cycleVisualizer = () => setVisualizerMode(VISUALIZER_MODES[(VISUALIZER_MODES.indexOf(visualizerMode) + 1) % VISUALIZER_MODES.length]);
  return <AnimatePresence>
    {open && song && <motion.div ref={dialogRef} tabIndex={-1} className="studio-large-player" data-zen={isZenMode} role="dialog" aria-modal="true" aria-label="Now playing" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <img className="studio-large-backdrop" src={art} alt="" aria-hidden />
      <div className="studio-large-scrim" />
      <div className="studio-large-visualizer" aria-label={`Visualizer: ${visualizerMode}`}><Visualizer primaryColor={settings.theme.primaryColor} secondaryColor={settings.theme.secondaryColor} /></div>
      <header><strong>Now Playing</strong><button type="button" aria-label="Close player" onClick={closePlayer}><X /></button></header>
      <motion.div className="studio-large-layout" initial={reduced ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: .45, ease: [.16, 1, .3, 1] }}>
        <section className="studio-large-primary">
          <div className="studio-large-cover"><span className={`studio-large-record-wrap${vinylOpen ? ' is-open' : ''}`} aria-hidden><span className="studio-large-record" data-playing={vinylOpen && isPlaying} /></span><button type="button" className="studio-large-cover-toggle" aria-pressed={vinylOpen} aria-label={vinylOpen ? 'Hide vinyl record' : 'Show vinyl record'} title={vinylOpen ? 'Hide vinyl record' : 'Show vinyl record'} onClick={() => setVinylOpen(value => !value)}><img src={art} alt={`Cover for ${song.album}`} /></button></div>
          <div className="studio-large-control-rail">
            <div className="studio-large-meta"><div className="studio-large-meta-copy"><button onClick={() => song.albumId && setView('ALBUM_DETAIL', song.albumId)}><h1>{song.title}</h1></button><button onClick={() => song.artistId && setView('ARTIST_DETAIL', song.artistId)}>{song.artist}</button></div><div className="studio-large-meta-actions"><button type="button" className="studio-icon-button" data-active={song.starred} onClick={() => toggleLike(song)} aria-label={song.starred ? 'Unlike track' : 'Like track'}><Heart /></button><button type="button" className="studio-icon-button" onClick={() => openPlaylistModal(song)} aria-label="Add to playlist"><ListMusic /></button></div></div>
            <Timeline />
            <PlayerButtons />
            <div className="studio-large-tools">
              <button type="button" onClick={cycleVisualizer} aria-label={`Change visualizer mode. Current mode: ${visualizerMode}`}><Activity /><span>{visualizerMode.charAt(0) + visualizerMode.slice(1).toLowerCase()}</span></button>
              <button type="button" data-active={isZenMode} onClick={() => setZenMode(!isZenMode)} aria-label={isZenMode ? 'Exit Zen mode' : 'Enter Zen mode'}><Focus /><span>Zen</span></button>
              <HoldVolume value={volume} onChange={setVolume} />
            </div>
          </div>
        </section>
        <aside className="studio-large-aside">
          <SegmentedControl value={panel} onChange={setPanel} label="Now playing information" options={[{ value: 'queue', label: 'Queue' }, { value: 'lyrics', label: 'Lyrics' }, { value: 'details', label: 'Sound' }]} />
          {panel === 'queue' && <div className="studio-large-queue">{queue.map((item, index) => <button key={`${item.id}-${index}`} type="button" data-active={index === currentSongIndex} onClick={() => playQueueIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span><img src={service.getCoverArtUrl(item.coverArt || item.id, 100)} alt=""/><span><strong>{item.title}</strong><small>{item.artist}</small></span><span>{formatTime(item.duration)}</span></button>)}</div>}
          {panel === 'lyrics' && <div className="studio-large-lyrics" aria-live="polite">{lyricsLoading ? <p>Loading lyrics…</p> : lyrics.split('\n').filter(Boolean).map((line, index) => <p key={`${line}-${index}`}>{line.replace(/^\[[^\]]+\]\s*/, '')}</p>)}</div>}
          {panel === 'details' && <div className="studio-large-sound"><dl className="studio-track-facts"><div><dt>Album</dt><dd>{song.album}</dd></div><div><dt>Format</dt><dd>{song.suffix?.toUpperCase() || 'Unknown'}</dd></div><div><dt>Bitrate</dt><dd>{song.bitRate ? `${song.bitRate} kbps` : 'Server Managed'}</dd></div><div><dt>Duration</dt><dd>{formatTime(song.duration)}</dd></div></dl><label><span>Speed</span><strong>{playbackRate.toFixed(2)}×</strong><input type="range" min={.5} max={2} step={.05} value={playbackRate} onChange={event => setPlaybackRate(Number(event.target.value))} aria-label="Playback speed" /></label><label><span>Pitch</span><strong>{pitch > 0 ? '+' : ''}{pitch} st</strong><input type="range" min={-12} max={12} step={1} value={pitch} onChange={event => setPitch(Number(event.target.value))} aria-label="Pitch in semitones" /></label><div className="studio-setting-inline"><span><strong>Pitch Correction</strong><small>Keep tempo and pitch independent.</small></span><AnimatedSwitch label="Pitch correction" checked={pitchCorrection} onCheckedChange={setPitchCorrection} /></div></div>}
        </aside>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}
