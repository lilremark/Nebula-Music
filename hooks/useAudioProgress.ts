import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface AudioProgress {
  currentTime: number;
  duration: number;
}

export interface AudioProgressState extends AudioProgress {
  /** Optimistically shows a new position (e.g. while scrubbing) until the element reports it. */
  setCurrentTime: (time: number) => void;
}

interface UseAudioProgressOptions {
  /** When false, no listeners are attached (e.g. live radio). */
  enabled?: boolean;
  /** Used while the element has no finite duration yet (metadata loading). */
  fallbackDuration?: number;
  /** Changing this re-reads the element, e.g. when the current song changes. */
  resetKey?: unknown;
}

const PROGRESS_EVENTS = ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked', 'emptied'] as const;

/**
 * Tracks an audio element's position from its own media events (~4Hz while
 * playing) instead of polling every animation frame. Updates are skipped while
 * the document is hidden and re-synced when it becomes visible, so a window in
 * the tray does no React work for playback progress.
 */
export const useAudioProgress = (
  audioRef: RefObject<HTMLAudioElement | null>,
  { enabled = true, fallbackDuration = 0, resetKey }: UseAudioProgressOptions = {},
): AudioProgressState => {
  const [progress, setProgress] = useState<AudioProgress>({ currentTime: 0, duration: 0 });

  useEffect(() => {
    const audio = audioRef.current;
    if (!enabled || !audio) return;
    const sync = () => {
      if (document.visibilityState === 'hidden') return;
      const currentTime = audio.currentTime || 0;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
      setProgress(prev => (
        prev.currentTime === currentTime && prev.duration === duration ? prev : { currentTime, duration }
      ));
    };
    sync();
    for (const type of PROGRESS_EVENTS) audio.addEventListener(type, sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      for (const type of PROGRESS_EVENTS) audio.removeEventListener(type, sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [audioRef, enabled, fallbackDuration, resetKey]);

  const setCurrentTime = useCallback((currentTime: number) => {
    setProgress(prev => (prev.currentTime === currentTime ? prev : { ...prev, currentTime }));
  }, []);

  return { ...progress, setCurrentTime };
};
