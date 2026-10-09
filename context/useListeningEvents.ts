import { useEffect, useRef } from 'react';
import type { ISong } from '../types';
import { db } from '../services/db';
import { ListeningClock } from '../playback/listeningClock';
import type { ListeningEvent } from '../playback/djTypes';

export function useListeningEvents(inputs: { profile: string | null; song?: ISong; playing: boolean; owner: () => HTMLAudioElement | null; onQualified: (song: ISong) => void }) {
  const latest = useRef(inputs); latest.current = inputs;
  const instance = useRef<{ id: string; profile: string; song: ISong; clock: ListeningClock } | null>(null);
  const finish = (completed = false, skipped = false): boolean => {
    const entry = instance.current; instance.current = null;
    if (!entry) return false;
    const event: ListeningEvent = { id: entry.id, profile: entry.profile, song: entry.song, at: Date.now(), listened: entry.clock.listened, qualified: entry.clock.qualified, completed, skipped };
    void db.addListeningEvent(event).catch(error => console.warn('Listening event could not be saved', error));
    return event.completed;
  };
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {
    let observedAudio: HTMLAudioElement | null = null;
    const seek = () => { const audio = observedAudio; if (audio) instance.current?.clock.sample(audio.currentTime, performance.now(), false, audio.playbackRate, true); };
    const observe = (audio: HTMLAudioElement | null) => {
      if (observedAudio === audio) return;
      observedAudio?.removeEventListener('seeking', seek); observedAudio?.removeEventListener('seeked', seek);
      observedAudio = audio;
      observedAudio?.addEventListener('seeking', seek); observedAudio?.addEventListener('seeked', seek);
    };
    const timer = window.setInterval(() => {
      const { profile, song, playing, owner, onQualified } = latest.current;
      if (instance.current && (instance.current.profile !== profile || instance.current.song.id !== song?.id)) finishRef.current();
      if (!profile || !song || !playing) return;
      const audio = owner(); observe(audio); if (!audio) return;
      if (!instance.current && (audio.paused || audio.ended)) return;
      instance.current ??= { id: crypto.randomUUID(), profile, song, clock: new ListeningClock(song.duration) };
      if (instance.current.clock.sample(audio.currentTime, performance.now(), !audio.paused, audio.playbackRate, audio.seeking)) onQualified(song);
    }, 250);
    return () => { window.clearInterval(timer); observe(null); finishRef.current(); };
  }, []);
  return { finish };
}
