import { DjBadge, DjHaze, PlayerCover, useDjPlayback } from './DjPresentation';
import React, { useEffect, useState } from 'react';
import { AudioLines, Heart, ListMusic, Maximize2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../../context/Store';
import { useAdaptiveColors } from '../../hooks/useAdaptiveColors';
import { useTrackWaveform } from '../../hooks/useTrackWaveform';
import { PlaybackProgress } from './PlaybackProgress';
import { SpeedPitchControls } from './SpeedPitchControls';

interface DesktopPlaybackBarProps {
  onExpand: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

export const DesktopPlaybackBar: React.FC<DesktopPlaybackBarProps> = ({ onExpand, onTogglePanel, panelOpen }) => {
  const {
    queue, currentSongIndex, currentRadioStation, radioMetadata, isRadioPlaying,
    isPlaying, service, audioRef, togglePlay, toggleRadioPlay,
    prevSong, nextSong, toggleLike, volume, setVolume, setView,
    settings, updateSettings,
  } = useStore();
  const voice = useDjPlayback();
  const song = queue[currentSongIndex];
  const isRadio = !!currentRadioStation;
  const streamUrl = !isRadio && song ? service.getStreamUrl(song.id, song.suffix) : null;
  const progressMode = voice.speech ? 'bar' : settings.progressVisualization;
  const waveform = useTrackWaveform(isRadio ? undefined : song?.id, progressMode === 'waveform' ? streamUrl : null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (isRadio || !song) return;
    const audio = audioRef.current;
    if (!audio) return;
    const sync = () => {
      setPosition(audio.currentTime || 0);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : song.duration || 0);
    };
    sync();
    let frame = 0;
    const animate = () => {
      // Read the Store's current owner on every frame, including crossfade handoffs.
      setPosition(audioRef.current?.currentTime || 0);
      frame = window.requestAnimationFrame(animate);
    };
    if (isPlaying && window.requestAnimationFrame) frame = window.requestAnimationFrame(animate);
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('durationchange', sync);
    audio.addEventListener('loadedmetadata', sync);
    return () => {
      window.cancelAnimationFrame?.(frame);
      audio.removeEventListener('timeupdate', sync);
      audio.removeEventListener('durationchange', sync);
      audio.removeEventListener('loadedmetadata', sync);
    };
  }, [audioRef, isRadio, song?.id, isPlaying]);

  const artwork = isRadio
    ? radioMetadata?.artworkUrl || currentRadioStation?.imageUrl
    : song ? service.getCoverArtUrl(song.coverArt || song.id, 120) : undefined;
  const { colors } = useAdaptiveColors(artwork);

  if (!song && !currentRadioStation) return null;

  const title = voice.speech ? 'AI DJ' : isRadio ? radioMetadata?.title || currentRadioStation?.name : song.title;
  const subtitle = voice.speech ? voice.subtitle : isRadio ? radioMetadata?.artist || currentRadioStation?.name : song.artist;
  const playing = voice.speech ? voice.playing : isRadio ? isRadioPlaying : isPlaying;
  const onPlayPause = isRadio ? toggleRadioPlay : togglePlay;
  const resolvedDuration = duration || song?.duration || 0;
  const seek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (voice.speech || !audio || !resolvedDuration) return;
    const nextPosition = Number(event.target.value) / 100 * resolvedDuration;
    audio.currentTime = nextPosition;
    setPosition(nextPosition);
  };

  return <footer className="nebula-transport" aria-label="Playback controls">
    <DjHaze speech={voice.speech} />
    <div className="nebula-transport-progress">
      {isRadio ? <span className="nebula-transport-live" style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary})` }} /> : <PlaybackProgress
        progress={voice.speech ? voice.progress : resolvedDuration ? position / resolvedDuration * 100 : 0}
        mode={progressMode}
        waveform={waveform}
        accentColor={colors.primary}
        secondaryColor={colors.secondary}
        baseColor="var(--next-waveform)"
        markerColor={colors.secondary}
        onScrub={seek}
        scrubbable={!voice.speech && resolvedDuration > 0}
        showHandle
        trackClassName={`nebula-transport-waveform ${progressMode === 'waveform' && waveform ? 'has-waveform' : 'has-progress-bar'}`}
      />}
      <span>{isRadio ? 'LIVE' : formatTime(voice.speech ? voice.position : position)}</span>
      <span>{isRadio ? currentRadioStation?.genre || 'RADIO' : formatTime(voice.speech ? voice.duration : resolvedDuration)}</span>
    </div>
    <div className="nebula-transport-track">
      {artwork || voice.speech ? <PlayerCover src={artwork} alt="" className="nebula-transport-art" /> : <span className="nebula-transport-art nebula-transport-art-empty"><ListMusic size={20} /></span>}
      <div className="nebula-transport-track-copy">
        <DjBadge />
        <button type="button" onClick={() => song?.albumId && setView('ALBUM_DETAIL', song.albumId)} disabled={voice.speech || !song?.albumId} title={title}>
          {title}
        </button>
        <span title={subtitle}>{subtitle}</span>
      </div>
      {!isRadio && song && <button disabled={voice.speech} type="button" className={`nebula-transport-icon nebula-transport-like ${song.starred ? 'is-liked' : ''}`} onClick={() => toggleLike(song)} aria-label={song.starred ? 'Unlike song' : 'Like song'}><Heart size={18} fill={song.starred ? 'currentColor' : 'none'} /></button>}
    </div>

    <div className="nebula-transport-center">
      <div className="nebula-transport-buttons nebula-playback-controls">
        {!isRadio && <button type="button" className="nebula-transport-icon nebula-playback-skip" onClick={prevSong} aria-label="Previous track"><SkipBack size={18} fill="currentColor" /></button>}
        <button type="button" className="nebula-transport-play nebula-playback-toggle" onClick={onPlayPause} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
        {!isRadio && <button type="button" className="nebula-transport-icon nebula-playback-skip" onClick={nextSong} aria-label="Next track"><SkipForward size={18} fill="currentColor" /></button>}
      </div>
    </div>

    <div className="nebula-transport-tools">
      {!isRadio && <>
        <button type="button" className="nebula-transport-icon" onClick={() => updateSettings({ progressVisualization: progressMode === 'waveform' ? 'bar' : 'waveform' })} aria-label={progressMode === 'waveform' ? 'Switch to progress bar' : 'Switch to waveform'} aria-pressed={progressMode === 'waveform'} title={progressMode === 'waveform' ? 'Progress bar' : 'Waveform'}><AudioLines size={18} /></button>
        <SpeedPitchControls />
      </>}

      <button type="button" className="nebula-transport-icon" onClick={onTogglePanel} aria-label={panelOpen ? 'Close now playing panel' : 'Open now playing panel'} aria-pressed={panelOpen}><ListMusic size={19} /></button>
      <button type="button" className="nebula-transport-icon" onClick={() => setVolume(volume === 0 ? 0.7 : 0)} aria-label={volume === 0 ? 'Unmute' : 'Mute'}>{volume === 0 ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
      <input type="range" min={0} max={1} step={0.01} value={volume} onChange={event => setVolume(Number(event.target.value))} aria-label="Volume" style={{ '--progress': `${volume * 100}%` } as React.CSSProperties} />
      <button type="button" className="nebula-transport-icon" onClick={onExpand} aria-label="Open full screen player"><Maximize2 size={18} /></button>
    </div>
  </footer>;
};
