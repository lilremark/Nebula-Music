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
import { db } from '../services/db';
import { createSanitizedArtwork } from '../services/streamDeckArtwork';
import {
  StreamDeckBridge,
  type StreamDeckBridgeStatus,
} from '../services/streamDeckBridge';
import { createStreamDeckCommandHandler } from '../services/streamDeckCommands';
import {
  STREAM_DECK_DEFAULT_PORT,
  toPlaylistSummary,
  toTrackSummary,
  type StreamDeckSnapshot,
} from '../services/streamDeckProtocol';

const TOKEN_KEY = 'stream_deck_pairing_token';
const NEBULA_VERSION = '2.1.3';

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

const StreamDeckBridgeContext = createContext<StreamDeckBridgeContextValue | undefined>(
  undefined,
);

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

export const StreamDeckBridgeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const {
    settings,
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playlists,
    togglePlay,
    nextSong,
    prevSong,
    setVolume,
    playSong,
    service,
    audioRef,
  } = useStore();

  const [status, setStatus] = useState<StreamDeckBridgeStatus>(defaultStatus);
  const sessionIdRef = useRef(getSessionId());
  const clientIdRef = useRef(getClientId());
  const connectedAtRef = useRef(Date.now());
  const lastActiveAtRef = useRef(Date.now());
  const artworkRef = useRef<{ trackId: string | null; data?: string }>({ trackId: null });
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
    track: null,
    playlists: [],
  });

  const stateRef = useRef({
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playlists,
    togglePlay,
    nextSong,
    prevSong,
    setVolume,
    playSong,
    service,
    audioRef,
  });
  stateRef.current = {
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playlists,
    togglePlay,
    nextSong,
    prevSong,
    setVolume,
    playSong,
    service,
    audioRef,
  };

  const buildSnapshot = useCallback((): StreamDeckSnapshot => {
    const current = stateRef.current;
    const song =
      current.currentSongIndex >= 0 ? current.queue[current.currentSongIndex] ?? null : null;
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
        togglePlay: () => stateRef.current.togglePlay(),
        nextSong: () => stateRef.current.nextSong(),
        prevSong: () => stateRef.current.prevSong(),
        setVolume: (value) => stateRef.current.setVolume(value),
        playSong: (song, playlistQueue) => stateRef.current.playSong(song, playlistQueue),
        getPlaylist: (id) => stateRef.current.service.getPlaylist(id),
        audioRef,
      }),
    [audioRef],
  );

  const bridge = useMemo(
    () =>
      new StreamDeckBridge({
        sessionId: sessionIdRef.current,
        clientId: clientIdRef.current,
        origin: window.location.origin,
        nebulaVersion: NEBULA_VERSION,
        tokenStore: {
          get: async () => (await db.get('settings', TOKEN_KEY)) ?? null,
          set: (token) => db.set('settings', TOKEN_KEY, token),
          clear: () => db.set('settings', TOKEN_KEY, null),
        },
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
    [buildSnapshot, executeCommand],
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
    currentSongIndex >= 0 && currentSongIndex < queue.length
      ? queue[currentSongIndex]
      : undefined;

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
    <StreamDeckBridgeContext.Provider value={value}>
      {children}
    </StreamDeckBridgeContext.Provider>
  );
};

export const useStreamDeckBridge = (): StreamDeckBridgeContextValue => {
  const context = useContext(StreamDeckBridgeContext);
  if (!context) {
    throw new Error('useStreamDeckBridge must be used within StreamDeckBridgeProvider');
  }
  return context;
};
