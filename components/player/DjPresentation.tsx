import React from 'react';
import { useStore } from '../../context/Store';
import { DjCover } from './DjCover';

export function DjBadge() {
  const { dj } = useStore();
  return dj.state.active ? <span className="nebula-dj-badge">AI DJ</span> : null;
}

export function PlayerCover({ src, alt = '', className = '' }: { src?: string; alt?: string; className?: string }) {
  const { dj } = useStore();
  return dj.presentation.speech
    ? <DjCover playing={dj.presentation.playing} analyser={dj.voiceAnalyser} className={className} />
    : <img src={src} alt={alt} className={className} />;
}

export function DjHaze({ speech }: { speech: boolean }) {
  return <div className="nebula-dj-haze" data-speaking={speech} aria-hidden="true" />;
}

export function useDjPlayback() {
  const { dj, isPlaying, togglePlay } = useStore();
  const speech = dj.presentation.speech;
  return { dj, speech, position: dj.presentation.position, duration: dj.presentation.duration,
    progress: dj.presentation.duration ? dj.presentation.position / dj.presentation.duration * 100 : 0,
    playing: speech ? dj.presentation.playing : isPlaying, togglePlay,
    subtitle: dj.presentation.preview ? 'Voice preview' : dj.presentation.playing ? 'Introducing your next set' : 'DJ paused' };
}
