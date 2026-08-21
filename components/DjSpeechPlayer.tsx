import { useEffect, useRef } from 'react';
import { usePlatform } from '../platform/PlatformContext';

/**
 * Renderer-side DJ speech player. Main process synthesizes WAV bytes and
 * forwards them over IPC; this component plays them via an <audio> element.
 *
 * - Non-blocking: speech audio is a separate element and never pauses the
 *   music/radio <audio> pipeline.
 * - Supersede: a new line stops any current speech before playing.
 */
export const DjSpeechPlayer: React.FC = () => {
  const platform = usePlatform();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!platform || platform.info.kind !== 'desktop' || !platform.aiDj) return;
    const audio = new Audio();
    audio.preload = 'auto';
    // Speech should be audible over music; no ducking yet, just play at full.
    audio.volume = 1;
    audioRef.current = audio;

    const revoke = (): void => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    const stop = (): void => {
      audio.pause();
      audio.removeAttribute('src');
      try {
        audio.load();
      } catch {
        // ignore
      }
      revoke();
    };

    const unsubscribe = platform.aiDj.onAudio((payload) => {
      if (!payload.wavBase64) {
        stop();
        return;
      }
      stop();
      try {
        const binary = atob(payload.wavBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: payload.mimeType || 'audio/wav' });
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        audio.src = url;
        void audio.play().catch(() => {
          // Autoplay may be blocked until user interacts; ignore.
        });
      } catch {
        // Invalid payload; ignore.
      }
    });

    return () => {
      unsubscribe();
      stop();
      audioRef.current = null;
    };
  }, [platform]);

  return null;
};
