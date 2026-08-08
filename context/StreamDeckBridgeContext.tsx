import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStore } from './Store';
import { usePlatform } from '../platform/PlatformContext';
import type { Platform } from '../platform/types';
import { db } from '../services/db';
import { APP_VERSION } from '../constants';
import { createSanitizedArtwork } from '../services/streamDeckArtwork';
import {
  StreamDeckBridge,
  type StreamDeckBridgeStatus,
  type StreamDeckTokenStore,
} from '../services/streamDeckBridge';
import { createStreamDeckCommandHandler } from '../services/streamDeckCommands';
import {
  STREAM_DECK_DEFAULT_PORT,
  toPlaylistSummary,
  toTrackSummary,
  type StreamDeckSnapshot,
} from '../services/streamDeckProtocol';

const TOKEN_KEY = 'stream_deck_pairing_token';
const NEBULA_VERSION = APP_VERSION;

interface StreamDeckBridgeContextValue {
  status: StreamDeckBridgeStatus;
  pair: (code: string) => Promise<void>;
  unpair: () => Promise<void>;
  reconnect: () => void;
}

const defaultStatus: StreamDeckBridgeStatus = {
  state: 'disabled',
  endpoint: `ws://127.0.0.1:${STREAM_DECK_DEFAULT_PORT}/nebula/v1`,
};

const StreamDeckBridgeContext = createContext<StreamDeckBridgeContextValue | undefined>(undefined);

const getSessionId = (): string => {
  const key = 'nebula_stream_deck_session_id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return id;
};

const getClientId = (): string => {
  const key = 'nebula_stream_deck_client_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Stream Deck token storage. On desktop the token lives in the OS-backed
 * credential vault; the IndexedDB `settings` store is kept as a fallback for
 * the web build and as the migration source for tokens paired by older
 * desktop builds. The token is the 32-byte pairing secret, so it must never
 * be written to a store that is not encrypted at rest.
 */
const createTokenStore = (platform: Platform | null): StreamDeckTokenStore => {
  const vault = platform !== null && platform.info.kind === 'desktop' ? platform.vault : null;
  return {
    get: async () => {
      if (vault) {
        const stored = await vault.getSecret(TOKEN_KEY);
        if (stored) return stored;
      }
      const legacy = (await db.get('settings', TOKEN_KEY)) ?? null;
      if (vault && legacy) {
        await vault.setSecret(TOKEN_KEY, legacy);
        await db.set('settings', TOKEN_KEY, null);
      }
      return legacy;
    },
    set: (token) =>
      vault ? vault.setSecret(TOKEN_KEY, token) : db.set('settings', TOKEN_KEY, token),
    clear: () => (vault ? vault.clearSecret(TOKEN_KEY) : db.set('settings', TOKEN_KEY, null)),
  };
};

export const StreamDeckBridgeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const platform = usePlatform();
  const {
    settings,
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playbackRate,
    pitch,
    pitchCorrection,
    playlists,
    togglePlay,
    nextSong,
    prevSong,
    setVolume,
    setPlaybackRate,
    setPitch,
    setPitchCorrection,
    playSong,
    service,
    audioRef,
  } = useStore();

  const [status, setStatus] = useState<StreamDeckBridgeStatus>(defaultStatus);
  const sessionIdRef = useRef(getSessionId());
  const clientIdRef = useRef(getClientId());
  const connectedAtRef = useRef(Date.now());
  const lastActiveAtRef = useRef(Date.now());
  const artworkRef = useRef<{ trackId: string | null; data?: string }>({
    trackId: null,
  });
  const snapshotRef = useRef<StreamDeckSnapshot>({
    sessionId: sessionIdRef.current,
    clientId: clientIdRef.current,
    origin: window.location.origin,
    nebulaVersion: NEBULA_VERSION,
    visible: document.visibilityState === 'visible',
    lastActiveAt: lastActiveAtRef.current,
    connectedAt: connectedAtRef.current,
    playing: false,
    positionSeconds: 0,
    durationSeconds: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    pitchSemitones: 0,
    pitchCorrection: true,
    track: null,
    playlists: [],
  });

  const stateRef = useRef({
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playbackRate,
    pitch,
    pitchCorrection,
    playlists,
    togglePlay,
    nextSong,
    prevSong,
    setVolume,
    setPlaybackRate,
    setPitch,
    setPitchCorrection,
    playSong,
    service,
    audioRef,
  });
  stateRef.current = {
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playbackRate,
    pitch,
    pitchCorrection,
    playlists,
    togglePlay,
    nextSong,
    prevSong,
    setVolume,
    setPlaybackRate,
    setPitch,
    setPitchCorrection,
    playSong,
    service,
    audioRef,
  };

  const buildSnapshot = useCallback((): StreamDeckSnapshot => {
    const current = stateRef.current;
    const song =
      current.currentSongIndex >= 0 ? (current.queue[current.currentSongIndex] ?? null) : null;
    const audio = current.audioRef.current;
    const songDuration = Number.isFinite(song?.duration) ? Math.max(0, song?.duration ?? 0) : 0;
    const duration = Number.isFinite(audio?.duration)
      ? Math.max(0, audio?.duration ?? 0)
      : songDuration;
    return {
      sessionId: sessionIdRef.current,
      clientId: clientIdRef.current,
      origin: window.location.origin,
      nebulaVersion: NEBULA_VERSION,
      visible: document.visibilityState === 'visible',
      lastActiveAt: lastActiveAtRef.current,
      connectedAt: connectedAtRef.current,
      playing: current.isPlaying,
      positionSeconds: clamp(
        Number(audio?.currentTime) || 0,
        0,
        duration || Number.MAX_SAFE_INTEGER,
      ),
      durationSeconds: duration,
      volume: clamp(current.volume, 0, 1),
      muted: current.volume === 0,
      playbackRate: clamp(current.playbackRate, 0.5, 2),
      pitchSemitones: clamp(current.pitch, -12, 12),
      pitchCorrection: current.pitchCorrection,
      track: song
        ? toTrackSummary(
            song,
            artworkRef.current.trackId === song.id ? artworkRef.current.data : undefined,
          )
        : null,
      playlists: current.playlists.slice(0, 1000).map(toPlaylistSummary),
    };
  }, []);

  const executeCommand = useMemo(
    () =>
      createStreamDeckCommandHandler({
        getState: () => ({
          isPlaying: stateRef.current.isPlaying,
          playlists: stateRef.current.playlists,
          trackId:
            stateRef.current.currentSongIndex >= 0
              ? stateRef.current.queue[stateRef.current.currentSongIndex]?.id
              : undefined,
        }),
        togglePlay: () => {
          stateRef.current.isPlaying = !stateRef.current.isPlaying;
          stateRef.current.togglePlay();
        },
        nextSong: () => stateRef.current.nextSong(),
        prevSong: () => stateRef.current.prevSong(),
        setVolume: (value) => {
          stateRef.current.volume = value;
          stateRef.current.setVolume(value);
        },
        setPlaybackRate: (value) => {
          stateRef.current.playbackRate = value;
          stateRef.current.setPlaybackRate(value);
        },
        setPitch: (value) => {
          stateRef.current.pitch = value;
          stateRef.current.setPitch(value);
        },
        setPitchCorrection: (enabled) => {
          stateRef.current.pitchCorrection = enabled;
          stateRef.current.setPitchCorrection(enabled);
        },
        playSong: (song, playlistQueue) => {
          stateRef.current.queue = playlistQueue;
          stateRef.current.currentSongIndex = 0;
          stateRef.current.isPlaying = true;
          stateRef.current.playSong(song, playlistQueue);
        },
        getPlaylist: (id) => stateRef.current.service.getPlaylist(id),
        audioRef,
      }),
    [audioRef],
  );

  const tokenStore = useMemo(() => createTokenStore(platform), [platform]);

  const bridge = useMemo(
    () =>
      new StreamDeckBridge({
        sessionId: sessionIdRef.current,
        clientId: clientIdRef.current,
        origin: window.location.origin,
        nebulaVersion: NEBULA_VERSION,
        tokenStore,
        onSocketOpen: (connectedAt) => {
          connectedAtRef.current = connectedAt;
        },
        onStatus: setStatus,
        onCommand: executeCommand,
        getSnapshot: () => {
          snapshotRef.current = buildSnapshot();
          return snapshotRef.current;
        },
      }),
    [buildSnapshot, executeCommand, tokenStore],
  );

  const streamDeckSettings = settings.streamDeck ?? {
    enabled: false,
    port: STREAM_DECK_DEFAULT_PORT,
  };

  useEffect(() => {
    bridge.configure(streamDeckSettings.enabled, streamDeckSettings.port);
  }, [bridge, streamDeckSettings.enabled, streamDeckSettings.port]);

  useEffect(() => () => bridge.destroy(), [bridge]);

  useEffect(() => {
    const noteActivity = () => {
      lastActiveAtRef.current = Date.now();
      bridge.notifyActivity();
    };
    window.addEventListener('focus', noteActivity);
    document.addEventListener('visibilitychange', noteActivity);
    window.addEventListener('pointerdown', noteActivity);
    window.addEventListener('keydown', noteActivity);
    return () => {
      window.removeEventListener('focus', noteActivity);
      document.removeEventListener('visibilitychange', noteActivity);
      window.removeEventListener('pointerdown', noteActivity);
      window.removeEventListener('keydown', noteActivity);
    };
  }, [bridge]);

  const song =
    currentSongIndex >= 0 && currentSongIndex < queue.length ? queue[currentSongIndex] : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const trackId = song?.id ?? null;
    artworkRef.current = { trackId };
    bridge.notifyStateChanged(true, true);
    if (!song) return () => controller.abort();
    void createSanitizedArtwork(
      service.getCoverArtUrl(song.coverArt || song.id, 256),
      controller.signal,
    ).then((data) => {
      if (controller.signal.aborted || artworkRef.current.trackId !== trackId) return;
      artworkRef.current = { trackId, data };
      bridge.notifyStateChanged(true, true, true);
    });
    return () => controller.abort();
  }, [bridge, service, song?.id]);

  useEffect(() => {
    bridge.notifyStateChanged();
  }, [bridge, isPlaying, volume]);

  useEffect(() => {
    bridge.notifyStateChanged(true, true);
  }, [bridge, playbackRate, pitch, pitchCorrection]);

  useEffect(() => {
    bridge.notifyStateChanged(false, true);
  }, [bridge, playlists]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const notifyProgress = () => bridge.notifyStateChanged();
    audio.addEventListener('timeupdate', notifyProgress);
    audio.addEventListener('durationchange', notifyProgress);
    audio.addEventListener('seeked', notifyProgress);
    return () => {
      audio.removeEventListener('timeupdate', notifyProgress);
      audio.removeEventListener('durationchange', notifyProgress);
      audio.removeEventListener('seeked', notifyProgress);
    };
  }, [audioRef, bridge]);

  const value = useMemo<StreamDeckBridgeContextValue>(
    () => ({
      status,
      pair: (code) => bridge.pair(code),
      unpair: () => bridge.unpair(),
      reconnect: () => bridge.reconnect(),
    }),
    [bridge, status],
  );

  return (
    <StreamDeckBridgeContext.Provider value={value}>{children}</StreamDeckBridgeContext.Provider>
  );
};

export const useStreamDeckBridge = (): StreamDeckBridgeContextValue => {
  const context = useContext(StreamDeckBridgeContext);
  if (!context) {
    throw new Error('useStreamDeckBridge must be used within StreamDeckBridgeProvider');
  }
  return context;
};
