import { useEffect, useRef, useState } from 'react';
import type { ISong, RepeatMode } from '../types';
import type { Platform } from '../platform/types';
import type { SubsonicService } from '../services/subsonicService';
import type { DjPreparedAudio } from '../electron/aiDj/localProtocol';
import { db } from '../services/db';
import { DEFAULT_LOCAL_DJ, EMPTY_DJ, type DjLocalSettings, type DjSessionState, type DjPresentation } from '../playback/djTypes';
import { selectDjBlock, summarizeTaste } from '../playback/djSelection';

interface Inputs {
  platform: Platform | null; profile: string | null; service: SubsonicService;
  queue: ISong[]; index: number; playing: boolean; volume: number; repeat: RepeatMode;
  finishListening?: () => void; getPosition: () => number; restorePosition: (time: number) => void;
  setQueue: React.Dispatch<React.SetStateAction<ISong[]>>; setIndex: (index: number) => void;
  setPlaying: (playing: boolean) => void; setRepeat: (repeat: RepeatMode) => void;
  initAudio: () => Promise<void>; context: () => AudioContext | null;
  musicGain: () => GainNode | null; stopRadio: () => void; cancelCrossfade: () => void;
}

export function useDjSession(inputs: Inputs) {
  const latest = useRef(inputs); latest.current = inputs;
  const [state, setState] = useState<DjSessionState>(EMPTY_DJ);
  const stateRef = useRef(state);
  const [config, setConfig] = useState<DjLocalSettings>(DEFAULT_LOCAL_DJ);
  const configRef = useRef(config); configRef.current = config;
  const [holdMusic, setHoldMusicState] = useState(false);
  const holding = useRef(false);
  const setHoldMusic = (value: boolean) => { holding.current = value; setHoldMusicState(value); };
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [speechPreview, setSpeechPreview] = useState(false);
  const [speechProgress, setSpeechProgress] = useState({ position: 0, duration: 0 });
  const previewPaused = useRef(false);
  const [voiceAnalyser, setVoiceAnalyser] = useState<AnalyserNode | null>(null);
  const speechRef = useRef<HTMLAudioElement>(null);
  const voiceSource = useRef<MediaElementAudioSourceNode | null>(null);
  const voiceGain = useRef<GainNode | null>(null);
  const speechUrl = useRef<string | null>(null);
  const speechPending = useRef(false);
  const resumeAfterSpeech = useRef<(() => void) | null>(null);
  const welcomeObsolete = useRef(false);
  const session = useRef<string | null>(null);
  const prepared = useRef<{ key: string; audio: DjPreparedAudio } | null>(null);
  const pendingKey = useRef('');
  const epoch = useRef(0);
  const restoring = useRef<{ queue: ISong[]; index: number; time: number; repeat: RepeatMode } | null>(null);
  const previousProfile = useRef(inputs.profile);
  const musicPosition = useRef(0);
  const filling = useRef(false);
  const [canRestore, setCanRestore] = useState(false);
  const publish = (patch: Partial<DjSessionState>) => {
    stateRef.current = { ...stateRef.current, ...patch }; setState(stateRef.current);
  };
  const restoreGain = () => {
    const ctx = latest.current.context(); const gain = latest.current.musicGain();
    if (ctx && gain) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setTargetAtTime(1, ctx.currentTime, 0.08); }
  };
  const clearSpeech = () => {
    const audio = speechRef.current;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); }
    setVoicePlaying(false); setSpeechPreview(false); previewPaused.current = false; setSpeechProgress({ position: 0, duration: 0 });
    if (speechUrl.current) URL.revokeObjectURL(speechUrl.current);
    speechPending.current = false; speechUrl.current = null; setHoldMusic(false); restoreGain();
  };
  const finishSpeech = () => {
    clearSpeech();
    publish({ phase: stateRef.current.active ? 'playing' : 'idle' });
    const resume = resumeAfterSpeech.current; resumeAfterSpeech.current = null; resume?.();
    if (!stateRef.current.active) void latest.current.platform?.aiDj?.cancel().catch(() => {});
  };
  const skipInterlude = () => { if (!speechUrl.current && !holding.current && !speechPending.current) return false; epoch.current++; finishSpeech(); return true; };
  const stop = (continueMusic = true) => {
    const resume = resumeAfterSpeech.current;
    if (continueMusic && session.current && stateRef.current.phase === 'preparing') latest.current.setPlaying(true);
    epoch.current++; session.current = null; pendingKey.current = ''; prepared.current = null;
    resumeAfterSpeech.current = null; clearSpeech();
    void latest.current.platform?.aiDj?.cancel().catch(() => {});
    if (stateRef.current.active && restoring.current) latest.current.setRepeat(restoring.current.repeat);
    publish({ ...EMPTY_DJ });
    if (continueMusic) resume?.();
  };

  useEffect(() => {
    if (!inputs.platform?.aiDj) return;
    let live = true;
    void inputs.platform.settings.get('aiDj').then((stored: unknown) => {
      if (live) setConfig({ ...DEFAULT_LOCAL_DJ, ...(stored as { local?: DjLocalSettings })?.local });
    }).catch(() => {});
    return () => { live = false; };
  }, [inputs.platform]);
  const saveConfig = async (patch: Partial<DjLocalSettings>) => {
    const next = { ...configRef.current, ...patch };
    const platform = latest.current.platform; if (!platform?.aiDj) return;
    const stored = await platform.settings.get('aiDj') as Record<string, unknown>;
    await platform.settings.set('aiDj', { ...stored, local: next });
    configRef.current = next; setConfig(next);
    if (Object.keys(patch).some(key => key !== 'showTranscript' && key !== 'voiceLevel')) { pendingKey.current = ''; prepared.current = null; }
  };

  async function candidates() {
    const input = latest.current;
    if (!input.profile) throw new Error('Connect a music library to start AI DJ.');
    const events = await db.getListeningEvents(input.profile);
    const frequent = await db.getMostPlayed(input.profile, 40) as ISong[];
    const starred = await input.service.getStarred().catch(() => ({ songs: [] }));
    const favorites = starred.songs || [];
    const seeds = [...events.filter(event => event.qualified).slice(-20).reverse().map(event => event.song), ...favorites, ...frequent];
    const genres = [...new Set(seeds.map(song => song.genre).filter(Boolean))] as string[];
    const artists = [...new Set(seeds.map(song => song.artist).filter(Boolean))].slice(0, 3);
    const [random, genre, similar, searched] = await Promise.all([
      input.service.getRandomSongs(60).catch(() => []),
      genres[0] ? input.service.getRandomSongs(30, { genre: genres[0] }).catch(() => []) : Promise.resolve([]),
      seeds[0] ? input.service.getSimilarSongs(seeds[0].id, 30).catch(() => []) : Promise.resolve([]),
      Promise.all(artists.map(artist => input.service.searchSongs(artist, 25).catch(() => []))),
    ]);
    const live = [...favorites, ...similar, ...genre, ...random, ...searched.flat()];
    const known = new Set([...favorites, ...frequent, ...events.filter(event => event.qualified).map(event => event.song)].map(song => song.id));
    // Statistics seed taste, but only current library results can enter a queue.
    return { events, familiar: live.filter(song => known.has(song.id)), pool: live, taste: summarizeTaste(events, favorites, frequent) };
  }

  async function speak(audio: DjPreparedAudio, continuation?: () => void, preview = false) {
    const token = epoch.current;
    resumeAfterSpeech.current = continuation ?? null;
    speechPending.current = true;
    if (!audio.wavBase64) { setHoldMusic(false); publish({ phase: 'playing', error: audio.error }); continuation?.(); return; }
    try {
      await latest.current.initAudio();
      if (epoch.current !== token) return;
      const ctx = latest.current.context(); const element = speechRef.current;
      if (!ctx || !element) throw new Error('Audio output is unavailable.');
      if (!voiceSource.current) {
        voiceSource.current = ctx.createMediaElementSource(element);
        voiceGain.current = ctx.createGain();
        const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
        voiceSource.current.connect(voiceGain.current); voiceGain.current.connect(analyser); analyser.connect(ctx.destination);
        setVoiceAnalyser(analyser);
      }
      clearSpeech();
      const bytes = Uint8Array.from(atob(audio.wavBase64), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })); speechUrl.current = url;
      element.src = url; element.volume = 1;
      resumeAfterSpeech.current = continuation ?? null;
      const standalone = !preview && configRef.current.style === 'standalone';
      setHoldMusic(standalone);
      if (!standalone) latest.current.musicGain()?.gain.setTargetAtTime(10 ** (-12 / 20), ctx.currentTime, 0.08);
      voiceGain.current!.gain.value = latest.current.volume * configRef.current.voiceLevel;
      setSpeechPreview(preview);
      publish({ phase: 'speaking', transcript: audio.text, error: audio.error });
      element.onended = finishSpeech;
      element.onerror = () => { publish({ error: 'DJ audio could not play; continuing music.' }); finishSpeech(); };
      if (preview || latest.current.playing) { await element.play(); setVoicePlaying(true); }
    } catch (error) { if (epoch.current === token) { publish({ error: error instanceof Error ? error.message : 'DJ audio unavailable.' }); finishSpeech(); } }
  }

  async function start() {
    if (stateRef.current.active) return;
    const input = latest.current;
    if (!input.platform?.aiDj || !input.profile) { publish({ error: 'AI DJ requires the desktop app and a connected library.' }); return; }
    const token = ++epoch.current; welcomeObsolete.current = false;
    resumeAfterSpeech.current = null; clearSpeech();
    publish({ active: true, phase: 'preparing', error: undefined, completed: 0 });
    try {
      const readiness = await input.platform.aiDj.readiness();
      if (!readiness.ready) throw new Error(readiness.error || 'Local models are unavailable.');
      const data = await candidates();
      if (epoch.current !== token) return;
      const first = selectDjBlock(data.pool, data.familiar, data.events, configRef.current);
      if (!first.length) throw new Error('No playable tracks found in your library.');
      const second = selectDjBlock(data.pool, data.familiar, data.events, configRef.current, first.map(song => song.id));
      restoring.current = { queue: input.queue, index: input.index, time: input.getPosition(), repeat: input.repeat }; setCanRestore(input.queue.length > 0);
      input.finishListening?.(); input.restorePosition(0);
      input.cancelCrossfade(); input.stopRadio(); input.setRepeat('OFF'); input.setPlaying(false);
      input.setQueue([...first, ...second]); input.setIndex(0);
      session.current = crypto.randomUUID();
      publish({ taste: data.taste, upcoming: first });
      let welcome: DjPreparedAudio | undefined;
      try {
        welcome = await input.platform.aiDj.prepare({ requestId: crypto.randomUUID(), sessionId: session.current, tracks: first.map(song => ({ id: song.id, title: song.title.slice(0, 256), artist: song.artist.slice(0, 256), genre: song.genre?.slice(0, 128) })), taste: data.taste, welcome: true, voice: configRef.current.voice });
      } catch (error) { if (epoch.current === token) publish({ error: error instanceof Error ? error.message : 'Welcome unavailable; starting music.' }); }
      if (epoch.current !== token) return;
      if (welcomeObsolete.current) { publish({ phase: 'playing' }); return; }
      if (welcome && configRef.current.style === 'standalone') { setHoldMusic(true); input.setPlaying(true); await speak(welcome, () => input.setPlaying(true)); }
      else { input.setPlaying(true); publish({ phase: 'playing' }); if (welcome) await speak(welcome); }
    } catch (error) {
      if (epoch.current === token) { stop(); publish({ error: error instanceof Error ? error.message : 'AI DJ could not start.' }); }
    }
  }

  async function prepareNext() {
    const input = latest.current; const id = session.current;
    if (!id || !stateRef.current.active || stateRef.current.phase === 'preparing' || holding.current) return;
    const boundary = input.index + configRef.current.interval - stateRef.current.completed;
    const tracks = input.queue.slice(boundary, boundary + configRef.current.interval);
    if (!tracks.length) return;
    const key = id + ':' + boundary + ':' + tracks.map(song => song.id).join(',') + ':' + JSON.stringify({ interval: configRef.current.interval, voice: configRef.current.voice, style: configRef.current.style, discovery: configRef.current.discovery });
    if (pendingKey.current === key) return;
    pendingKey.current = key; prepared.current = null;
    publish({ upcoming: tracks, preparingNext: true });
    try {
      const audio = await input.platform!.aiDj!.prepare({ requestId: crypto.randomUUID(), sessionId: id, tracks: tracks.map(song => ({ id: song.id, title: song.title.slice(0, 256), artist: song.artist.slice(0, 256), genre: song.genre?.slice(0, 128) })), taste: stateRef.current.taste, welcome: false, voice: configRef.current.voice });
      if (session.current === id && pendingKey.current === key) { prepared.current = { key, audio }; publish({ preparingNext: false }); }
    } catch (error) { if (session.current === id && pendingKey.current === key) publish({ preparingNext: false, error: error instanceof Error ? error.message : 'Next interlude unavailable.' }); }
  }

  // Called synchronously by the Store before advancing either media owner.
  function boundary(completed: boolean, advance: () => void): boolean {
    if (!stateRef.current.active) return false;
    if (holding.current) return true;
    if (!completed) return false;
    const count = stateRef.current.completed + 1;
    if (count < configRef.current.interval) { publish({ completed: count }); return false; }
    const ready = prepared.current; prepared.current = null; pendingKey.current = '';
    publish({ completed: 0 });
    if (!ready) { publish({ error: 'This interlude was not ready; music continues.' }); return false; }
    // Never wait for inference at a boundary. Only already-prepared audio plays.
    if (configRef.current.style === 'standalone') { setHoldMusic(true); latest.current.cancelCrossfade(); void speak(ready.audio, advance); return true; }
    void speak(ready.audio); return false;
  }

  useEffect(() => {
    if (previousProfile.current !== inputs.profile) { stop(false); restoring.current = null; setCanRestore(false); previousProfile.current = inputs.profile; }
    if (!stateRef.current.active || !session.current) return;
    if (inputs.queue.length - inputs.index < config.interval * 2 && !filling.current) {
      filling.current = true; const id = session.current;
      void candidates().then(data => {
        if (session.current !== id) return;
        const songs = selectDjBlock(data.pool, data.familiar, data.events, configRef.current, latest.current.queue.map(song => song.id));
        if (!songs.length) { publish({ error: 'No more playable tracks are available.' }); return; }
        latest.current.setQueue(queue => [...queue, ...songs]); publish({ taste: data.taste });
      }).catch(error => { if (session.current === id) publish({ error: String(error) }); }).finally(() => { filling.current = false; });
    }
    void prepareNext();
  }, [inputs.index, inputs.queue, inputs.profile, config, state.completed, state.phase]);

  useEffect(() => {
    if (stateRef.current.phase === 'preparing' && session.current && (inputs.playing || inputs.index !== 0)) welcomeObsolete.current = true;
  }, [inputs.playing, inputs.index]);

  useEffect(() => {
    const element = speechRef.current;
    if (element && speechUrl.current) {
      const playSpeech = stateRef.current.active ? inputs.playing : !previewPaused.current;
      if (playSpeech) void element.play().then(() => setVoicePlaying(true)).catch(() => finishSpeech());
      else { element.pause(); setVoicePlaying(false); restoreGain(); }
      if (playSpeech && (!stateRef.current.active || configRef.current.style === 'over-music')) { const ctx = latest.current.context(); if (ctx) latest.current.musicGain()?.gain.setTargetAtTime(10 ** (-12 / 20), ctx.currentTime, 0.08); }
    }
    if (voiceGain.current) voiceGain.current.gain.value = inputs.volume * config.voiceLevel;
  }, [inputs.playing, inputs.volume, config.voiceLevel]);
  useEffect(() => () => { epoch.current++; resumeAfterSpeech.current = null; clearSpeech(); void latest.current.platform?.aiDj?.cancel().catch(() => {}); }, []);

  useEffect(() => {
    const audio = speechRef.current;
    if (!audio || state.phase !== 'speaking') return;
    const sync = () => setSpeechProgress({ position: Number.isFinite(audio.currentTime) ? audio.currentTime : 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
    audio.addEventListener('timeupdate', sync); audio.addEventListener('loadedmetadata', sync); sync();
    return () => { audio.removeEventListener('timeupdate', sync); audio.removeEventListener('loadedmetadata', sync); };
  }, [state.phase]);
  const togglePreview = () => {
    if (!speechPreview || !speechUrl.current || !speechRef.current) return false;
    const audio = speechRef.current;
    previewPaused.current = !audio.paused;
    if (previewPaused.current) { audio.pause(); setVoicePlaying(false); restoreGain(); }
    else { const ctx = latest.current.context(); if (ctx) latest.current.musicGain()?.gain.setTargetAtTime(10 ** (-12 / 20), ctx.currentTime, 0.08); void audio.play().then(() => setVoicePlaying(true)).catch(finishSpeech); }
    return true;
  };
  const presentation: DjPresentation = { sessionId: session.current, active: state.active, speech: state.phase === 'speaking', preview: speechPreview, playing: voicePlaying, ...speechProgress };
  const restore = () => {
    const saved = restoring.current; stop(false); if (!saved) return;
    latest.current.finishListening?.(); latest.current.stopRadio(); latest.current.cancelCrossfade();
    latest.current.setQueue(saved.queue); latest.current.setIndex(saved.index); latest.current.setRepeat(saved.repeat); latest.current.setPlaying(true);
    latest.current.restorePosition(saved.time);
    restoring.current = null; setCanRestore(false);
  };
  const preview = async () => {
    if (stateRef.current.active) return;
    const token = ++epoch.current;
    try {
      publish({ phase: 'preparing', error: undefined });
      const audio = await latest.current.platform!.aiDj!.preview(configRef.current.voice);
      if (epoch.current === token) await speak(audio, undefined, true);
    } catch (error) { if (epoch.current === token) publish({ phase: 'idle', error: String(error) }); }
  };
  const resetLearning = async () => { stop(); if (latest.current.profile) await db.resetDjLearning(latest.current.profile); publish({ taste: 'DJ listening history reset. Your likes and play counts are preserved.' }); };
  return { state, config, presentation, togglePreview, holdMusic, isHolding: () => holding.current, voicePlaying, voiceAnalyser, speechRef, canRestore, start, stop, boundary, skipInterlude, restore, preview, saveConfig, resetLearning, musicPosition };
}
