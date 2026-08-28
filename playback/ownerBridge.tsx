import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useStore } from '../context/Store';
import { usePlatform } from '../platform/PlatformContext';
import { createSanitizedArtwork } from '../services/streamDeckArtwork';
import {
  cancelCoverArtLoad,
  completeCoverArtLoad,
  startCoverArtLoad,
  type CoverArtLoadState,
} from './coverArtLoadState';
import {
  acceptEnvelope,
  buildUpcomingList,
  clamp,
  DESKTOP_PROTOCOL_VERSION,
  parseCommandEnvelope,
  toRepeatMode,
  toTrackSummary,
  type CommandCursor,
  type DesktopCommandEnvelope,
  type DesktopSnapshot,
} from './desktopProtocol';

const OWNER_ID = 'nebula-desktop-owner';
const SNAPSHOT_INTERVAL_MS = 1_000;

interface DesktopOwnerBridgeContextValue {
  snapshotEpoch: number;
  isConnected: boolean;
}

const DesktopOwnerBridgeContext = createContext<DesktopOwnerBridgeContextValue>({
  snapshotEpoch: 0,
  isConnected: false,
});

/**
 * The renderer-side playback owner for desktop remote clients (tray, media
 * keys, later mini-player). Registers the command handler on the platform's
 * playback transport, validates command envelopes against the epoch/sequence
 * cursor, applies them to the existing store, and publishes snapshots.
 *
 * In the web build the platform transport is a no-op, so this provider is
 * harmless and the web app is unchanged.
 */
export const DesktopOwnerBridgeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const {
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playbackRate,
    repeatMode,
    credentials,
    togglePlay,
    nextSong,
    prevSong,
    playQueueIndex,
    setVolume,
    setPlaybackRate,
    setRepeatMode,
    audioRef,
    service,
  } = useStore();

  const platform = usePlatform();
  const [snapshotEpoch, setSnapshotEpoch] = useState(0);

  const cursorRef = useRef<CommandCursor>({ epoch: 0, lastSeqByClient: new Map() });
  const epochRef = useRef(0);
  const platformRef = useRef(platform);
  platformRef.current = platform;
  const coverArtRef = useRef<CoverArtLoadState>({ status: 'idle' });
  const coverArtRequestIdRef = useRef(0);
  const upcomingCoverArtRef = useRef(new Map<string, string | undefined>());

  const stateRef = useRef({
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playbackRate,
    repeatMode,
    togglePlay,
    nextSong,
    prevSong,
    playQueueIndex,
    setVolume,
    setPlaybackRate,
    setRepeatMode,
    audioRef,
  });
  stateRef.current = {
    queue,
    currentSongIndex,
    isPlaying,
    volume,
    playbackRate,
    repeatMode,
    togglePlay,
    nextSong,
    prevSong,
    playQueueIndex,
    setVolume,
    setPlaybackRate,
    setRepeatMode,
    audioRef,
  };

  const bumpEpoch = () => {
    epochRef.current += 1;
    cursorRef.current.epoch = epochRef.current;
    cursorRef.current.lastSeqByClient.clear();
    setSnapshotEpoch(epochRef.current);
  };

  const buildSnapshot = (): DesktopSnapshot => {
    const state = stateRef.current;
    const song =
      state.currentSongIndex >= 0 && state.currentSongIndex < state.queue.length
        ? state.queue[state.currentSongIndex]
        : null;
    const audio = state.audioRef.current;
    const songDuration = Number.isFinite(song?.duration) ? Math.max(0, song?.duration ?? 0) : 0;
    const duration = Number.isFinite(audio?.duration)
      ? Math.max(0, audio?.duration ?? 0)
      : songDuration;
    const coverArt = coverArtRef.current;
    const upcoming = buildUpcomingList(
      state.queue,
      state.currentSongIndex,
      state.repeatMode,
      upcomingCoverArtRef.current,
    );
    return {
      v: DESKTOP_PROTOCOL_VERSION,
      ownerId: OWNER_ID,
      epoch: epochRef.current,
      playing: state.isPlaying,
      track: song
        ? toTrackSummary({
            id: song.id,
            title: song.title,
            artist: song.artist,
            ...(song.album ? { album: song.album } : {}),
            coverArtUrl:
              coverArt.status === 'completed' && coverArt.songId === song.id
                ? coverArt.dataUrl
                : undefined,
          })
        : null,
      positionSeconds: clamp(
        Number(audio?.currentTime) || 0,
        0,
        duration || Number.MAX_SAFE_INTEGER,
      ),
      durationSeconds: duration,
      volume: clamp(state.volume, 0, 1),
      muted: state.volume === 0,
      playbackRate: clamp(state.playbackRate, 0.5, 2),
      repeatMode: toRepeatMode(state.repeatMode),
      updatedAt: Date.now(),
      upcoming,
    };
  };

  const publishSnapshot = () => {
    platformRef.current?.playback.publishSnapshot(buildSnapshot());
  };
  const publishSnapshotRef = useRef(publishSnapshot);
  publishSnapshotRef.current = publishSnapshot;

  const handleCommand = (rawEnvelope: unknown): void => {
    const parsed = parseCommandEnvelope(rawEnvelope);
    if (!parsed.ok) return;
    const envelope = parsed.envelope;
    const acceptance = acceptEnvelope(envelope, cursorRef.current);
    if (!acceptance.accepted) return;

    const state = stateRef.current;
    switch (envelope.command.name) {
      case 'setPlayback':
        if (state.isPlaying !== envelope.command.playing) state.togglePlay();
        break;
      case 'togglePlayback':
        state.togglePlay();
        break;
      case 'previous':
        state.prevSong();
        break;
      case 'next':
        state.nextSong();
        break;
      case 'setVolume':
        state.setVolume(clamp(envelope.command.volume, 0, 1));
        break;
      case 'setPlaybackRate':
        state.setPlaybackRate(clamp(envelope.command.playbackRate, 0.5, 2));
        break;
      case 'seekRelative': {
        const audio = state.audioRef.current;
        if (!audio) break;
        const duration = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
        audio.currentTime = clamp(audio.currentTime + envelope.command.seconds, 0, duration);
        break;
      }
      case 'seekAbsolute': {
        const audio = state.audioRef.current;
        const song = state.queue[state.currentSongIndex];
        if (!audio || !song || song.id !== envelope.command.trackId) break;
        const duration = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
        audio.currentTime = clamp(envelope.command.seconds, 0, duration);
        break;
      }
      case 'setRepeatMode':
        state.setRepeatMode(envelope.command.repeatMode);
        break;
      case 'playQueueIndex':
        state.playQueueIndex(envelope.command.index);
        break;
    }
    publishSnapshot();
  };

  const handleCommandRef = useRef<(rawEnvelope: unknown) => void>(() => {});
  handleCommandRef.current = handleCommand;

  useEffect(() => {
    if (!platform) return;
    return platform.playback.onCommand((envelope) => handleCommandRef.current(envelope));
  }, [platform]);

  // Re-publish a fresh snapshot after the machine wakes from sleep so the tray,
  // media keys, and mini-player re-sync to the real audio position.
  useEffect(() => {
    if (!platform) return;
    return platform.power.onResumed(() => publishSnapshotRef.current());
  }, [platform]);

  // Bump the epoch when the playback session resets: credentials change or a
  // fresh queue/song starts. Stale-epoch commands are then rejected.
  const credentialsRef = useRef(credentials);
  useEffect(() => {
    if (credentialsRef.current !== credentials) {
      bumpEpoch();
      credentialsRef.current = credentials;
    }
  }, [credentials]);

  const queueEmptyRef = useRef(queue.length === 0);
  useEffect(() => {
    const nowEmpty = queue.length === 0;
    if (queueEmptyRef.current && !nowEmpty) bumpEpoch();
    queueEmptyRef.current = nowEmpty;
  }, [queue.length]);

  const hadSongRef = useRef(currentSongIndex >= 0);
  useEffect(() => {
    const hasSong = currentSongIndex >= 0;
    if (!hadSongRef.current && hasSong) bumpEpoch();
    hadSongRef.current = hasSong;
  }, [currentSongIndex]);

  // Publish a snapshot on any state the tray needs.
  useEffect(() => {
    publishSnapshot();
  }, [publishSnapshot, isPlaying, volume, playbackRate, repeatMode]);

  const song = currentSongIndex >= 0 && currentSongIndex < queue.length ? queue[currentSongIndex] : undefined;
  useEffect(() => {
    publishSnapshot();
  }, [publishSnapshot, song?.id]);

  // Fetch a small cover-art data URL for the tray/menu when the song changes.
  // Cached per song id; only the current song's art is ever sent.
  useEffect(() => {
    if (!song) {
      coverArtRef.current = { status: 'idle' };
      return;
    }
    const requestId = ++coverArtRequestIdRef.current;
    const pendingState = startCoverArtLoad(coverArtRef.current, song.id, requestId);
    if (pendingState === coverArtRef.current) return;
    coverArtRef.current = pendingState;
    const controller = new AbortController();
    void createSanitizedArtwork(
      service.getCoverArtUrl(song.coverArt || song.id, 96),
      controller.signal,
      96,
    ).then((dataUrl) => {
      if (controller.signal.aborted) return;
      const completedState = completeCoverArtLoad(coverArtRef.current, requestId, dataUrl);
      if (completedState === coverArtRef.current) return;
      coverArtRef.current = completedState;
      publishSnapshotRef.current();
    });
    return () => {
      controller.abort();
      coverArtRef.current = cancelCoverArtLoad(coverArtRef.current, requestId);
    };
  }, [service, song?.id]);

  // Lazy-load small cover-art data URLs for the up-to-5 upcoming tracks shown
  // in the mini-player. Cached per song id; only loaded once per unique track.
  useEffect(() => {
    const state = stateRef.current;
    const upcoming = buildUpcomingList(
      state.queue,
      state.currentSongIndex,
      state.repeatMode,
      upcomingCoverArtRef.current,
    );
    const missing = upcoming
      .map((t) => t.id)
      .filter((id) => !upcomingCoverArtRef.current.has(id));
    if (missing.length === 0) return;
    const controllers: AbortController[] = [];
    for (const id of missing) {
      const song = state.queue.find((s) => s.id === id);
      if (!song) {
        upcomingCoverArtRef.current.set(id, undefined);
        continue;
      }
      upcomingCoverArtRef.current.set(id, undefined);
      const controller = new AbortController();
      controllers.push(controller);
      void createSanitizedArtwork(
        service.getCoverArtUrl(song.coverArt || song.id, 96),
        controller.signal,
        96,
      )
        .then((dataUrl) => {
          if (controller.signal.aborted) return;
          upcomingCoverArtRef.current.set(id, dataUrl);
          publishSnapshotRef.current();
        })
        .catch(() => {
          upcomingCoverArtRef.current.set(id, undefined);
        });
    }
    // Bound the cache so long sessions do not retain every song ever queued.
    if (upcomingCoverArtRef.current.size > 100) {
      const keys = [...upcomingCoverArtRef.current.keys()];
      for (const k of keys.slice(0, keys.length - 100)) {
        upcomingCoverArtRef.current.delete(k);
      }
    }
    return () => {
      for (const controller of controllers) controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, currentSongIndex, service]);

  // Progress snapshots for future mini-player/media-key affordances.
  useEffect(() => {
    publishSnapshot();
    const interval = window.setInterval(publishSnapshot, SNAPSHOT_INTERVAL_MS);
    const audio = audioRef.current;
    if (!audio) return () => window.clearInterval(interval);
    const notify = () => publishSnapshot();
    audio.addEventListener('timeupdate', notify);
    audio.addEventListener('durationchange', notify);
    audio.addEventListener('seeked', notify);
    return () => {
      window.clearInterval(interval);
      audio.removeEventListener('timeupdate', notify);
      audio.removeEventListener('durationchange', notify);
      audio.removeEventListener('seeked', notify);
    };
  }, [audioRef, publishSnapshot]);

  const value = useMemo<DesktopOwnerBridgeContextValue>(
    () => ({ snapshotEpoch, isConnected: snapshotEpoch > 0 }),
    [snapshotEpoch],
  );

  return (
    <DesktopOwnerBridgeContext.Provider value={value}>
      {children}
    </DesktopOwnerBridgeContext.Provider>
  );
};

export const useDesktopOwnerBridge = (): DesktopOwnerBridgeContextValue => {
  const context = useContext(DesktopOwnerBridgeContext);
  if (!context) {
    throw new Error('useDesktopOwnerBridge must be used within DesktopOwnerBridgeProvider');
  }
  return context;
};
