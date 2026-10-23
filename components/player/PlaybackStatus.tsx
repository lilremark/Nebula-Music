import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../../context/Store';
import './playback-status.css';

export const PlaybackStatus: React.FC = () => {
  const { playbackStatus, currentRadioStation, dj } = useStore();
  if (currentRadioStation || dj.holdMusic || playbackStatus === 'idle') return null;
  const failed = playbackStatus === 'error';
  const label = failed ? 'Can’t play track. Press Play to retry or skip.'
    : playbackStatus === 'loading' ? 'Loading track…' : 'Buffering…';
  return (
    <span className={`nebula-playback-status${failed ? ' is-error' : ''}`} role={failed ? 'alert' : 'status'}>
      {failed ? <AlertCircle size={14} aria-hidden="true" /> : <Loader2 className="nebula-buffering-spinner" size={14} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
};
