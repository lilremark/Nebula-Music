import type { IPlaylist, ISong } from '../types';

export const STREAM_DECK_PROTOCOL = 'nebula-streamdeck/1' as const;
export const STREAM_DECK_DEFAULT_PORT = 37921;
export const STREAM_DECK_MAX_MESSAGE_BYTES = 512 * 1024;
export const STREAM_DECK_MAX_ARTWORK_LENGTH = 512_000;

export type StreamDeckErrorCode =
  | 'unauthorized'
  | 'disconnected'
  | 'stale_playlist'
  | 'empty_playlist'
  | 'playback_failed'
  | 'invalid_command'
  | 'internal_error';

export type PairingErrorCode =
  | 'invalid_code'
  | 'expired_code'
  | 'rate_limited'
  | 'protocol_mismatch'
  | 'unauthorized';

export interface StreamDeckTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artworkDataUrl?: string;
}

export interface StreamDeckPlaylist {
  id: string;
  name: string;
  trackCount?: number;
}

export interface StreamDeckSnapshot {
  sessionId: string;
  clientId: string;
  origin: string;
  nebulaVersion: string;
  visible: boolean;
  lastActiveAt: number;
  connectedAt: number;
  playing: boolean;
  positionSeconds: number;
  durationSeconds: number;
  volume: number;
  muted: boolean;
  track: StreamDeckTrack | null;
  playlists: StreamDeckPlaylist[];
}

export type StreamDeckCommand =
  | { name: 'setPlayback'; playing: boolean }
  | { name: 'togglePlayback' }
  | { name: 'previous' }
  | { name: 'next' }
  | { name: 'setVolume'; volume: number }
  | { name: 'seekRelative'; seconds: number }
  | { name: 'seekAbsolute'; seconds: number; trackId: string }
  | { name: 'startPlaylist'; playlistId: string };

export type PluginToBrowserMessage =
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'authChallenge';
      nonce: string;
    }
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'pairingResult';
      ok: boolean;
      token?: string;
      error?: PairingErrorCode;
    }
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'revocationResult';
      ok: boolean;
    }
  | { protocol: typeof STREAM_DECK_PROTOCOL; type: 'requestSnapshot' }
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'command';
      requestId: string;
      command: StreamDeckCommand;
    };

export type BrowserToPluginMessage =
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'hello';
      sessionId: string;
      clientId: string;
      origin: string;
      nebulaVersion: string;
      visible: boolean;
      lastActiveAt: number;
      capabilities?: Array<'seekAbsolute' | 'progressVolume'>;
    }
  | { protocol: typeof STREAM_DECK_PROTOCOL; type: 'pair'; clientId: string; code: string }
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'authenticate';
      clientId: string;
      proof: string;
    }
  | { protocol: typeof STREAM_DECK_PROTOCOL; type: 'revoke'; clientId: string }
  | { protocol: typeof STREAM_DECK_PROTOCOL; type: 'state'; snapshot: StreamDeckSnapshot }
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'progress';
      sessionId: string;
      positionSeconds: number;
      durationSeconds: number;
      playing: boolean;
      volume?: number;
      muted?: boolean;
    }
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'commandResult';
      requestId: string;
      ok: boolean;
      error?: { code: StreamDeckErrorCode; message: string };
    }
  | {
      protocol: typeof STREAM_DECK_PROTOCOL;
      type: 'heartbeat';
      sessionId: string;
      visible: boolean;
      lastActiveAt: number;
    };

export const toPlaylistSummary = (playlist: IPlaylist): StreamDeckPlaylist => {
  const count = Number(playlist.songCount) || playlist.songs?.length || 0;
  return {
    id: (playlist.id || 'unknown-playlist').slice(0, 256),
    name: (playlist.name || 'Untitled playlist').slice(0, 512),
    trackCount: Number.isFinite(count) ? Math.floor(Math.max(0, count)) : 0,
  };
};

export const toTrackSummary = (song: ISong, artwork?: string): StreamDeckTrack => ({
  id: (song.id || 'unknown-track').slice(0, 256),
  title: song.title.slice(0, 512),
  artist: song.artist.slice(0, 512),
  ...(song.album ? { album: song.album.slice(0, 512) } : {}),
  ...(artwork ? { artworkDataUrl: artwork } : {}),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasProtocol = (value: Record<string, unknown>): boolean =>
  value.protocol === STREAM_DECK_PROTOCOL;

const isCryptographicValue = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

const serializedByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

export const parsePluginMessage = (
  raw: string,
):
  | { ok: true; message: PluginToBrowserMessage }
  | { ok: false; code: StreamDeckErrorCode | 'protocol_mismatch'; message: string } => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'invalid_command', message: 'Message is not valid JSON.' };
  }

  if (!isRecord(value)) {
    return { ok: false, code: 'invalid_command', message: 'Message must be an object.' };
  }
  if (!hasProtocol(value)) {
    return {
      ok: false,
      code: 'protocol_mismatch',
      message: `Expected protocol ${STREAM_DECK_PROTOCOL}.`,
    };
  }

  if (value.type === 'requestSnapshot') {
    return { ok: true, message: value as PluginToBrowserMessage };
  }

  if (value.type === 'authChallenge' && isCryptographicValue(value.nonce)) {
    return { ok: true, message: value as PluginToBrowserMessage };
  }

  if (value.type === 'revocationResult' && typeof value.ok === 'boolean') {
    return { ok: true, message: value as PluginToBrowserMessage };
  }

  if (value.type === 'pairingResult' && typeof value.ok === 'boolean') {
    if (value.token !== undefined && !isCryptographicValue(value.token)) {
      return { ok: false, code: 'invalid_command', message: 'Pairing token is invalid.' };
    }
    if (
      value.error !== undefined &&
      !['invalid_code', 'expired_code', 'rate_limited', 'protocol_mismatch', 'unauthorized'].includes(
        String(value.error),
      )
    ) {
      return { ok: false, code: 'invalid_command', message: 'Pairing error is invalid.' };
    }
    return { ok: true, message: value as PluginToBrowserMessage };
  }

  if (
    value.type === 'command' &&
    typeof value.requestId === 'string' &&
    value.requestId.length > 0 &&
    value.requestId.length <= 256 &&
    isValidCommand(value.command)
  ) {
    return { ok: true, message: value as PluginToBrowserMessage };
  }

  return { ok: false, code: 'invalid_command', message: 'Unsupported message shape.' };
};

export const isValidCommand = (value: unknown): value is StreamDeckCommand => {
  if (!isRecord(value) || typeof value.name !== 'string') return false;
  switch (value.name) {
    case 'togglePlayback':
    case 'previous':
    case 'next':
      return true;
    case 'setPlayback':
      return typeof value.playing === 'boolean';
    case 'setVolume':
      return (
        typeof value.volume === 'number' &&
        Number.isFinite(value.volume) &&
        value.volume >= 0 &&
        value.volume <= 1
      );
    case 'seekRelative':
      return (
        typeof value.seconds === 'number' &&
        Number.isFinite(value.seconds) &&
        value.seconds >= -86_400 &&
        value.seconds <= 86_400
      );
    case 'seekAbsolute':
      return (
        typeof value.seconds === 'number' &&
        Number.isFinite(value.seconds) &&
        value.seconds >= 0 &&
        value.seconds <= 86_400 &&
        typeof value.trackId === 'string' &&
        value.trackId.length > 0 &&
        value.trackId.length <= 256
      );
    case 'startPlaylist':
      return (
        typeof value.playlistId === 'string' &&
        value.playlistId.length > 0 &&
        value.playlistId.length <= 256
      );
    default:
      return false;
  }
};

export const serializeBrowserMessage = (message: BrowserToPluginMessage): string =>
  serializeWithinBudget(message);

const serializeWithinBudget = (message: BrowserToPluginMessage): string => {
  let serialized = JSON.stringify(message);
  if (serializedByteLength(serialized) <= STREAM_DECK_MAX_MESSAGE_BYTES) return serialized;

  if (message.type !== 'state') {
    throw new Error('Stream Deck message exceeds the 512 KiB limit.');
  }

  const withoutArtwork: BrowserToPluginMessage = {
    ...message,
    snapshot: {
      ...message.snapshot,
      track: message.snapshot.track
        ? {
            id: message.snapshot.track.id,
            title: message.snapshot.track.title,
            artist: message.snapshot.track.artist,
            ...(message.snapshot.track.album ? { album: message.snapshot.track.album } : {}),
          }
        : null,
    },
  };
  serialized = JSON.stringify(withoutArtwork);
  if (serializedByteLength(serialized) <= STREAM_DECK_MAX_MESSAGE_BYTES) return serialized;

  let low = 0;
  let high = withoutArtwork.snapshot.playlists.length;
  let best = '';
  while (low <= high) {
    const count = Math.floor((low + high) / 2);
    const candidate = JSON.stringify({
      ...withoutArtwork,
      snapshot: {
        ...withoutArtwork.snapshot,
        playlists: withoutArtwork.snapshot.playlists.slice(0, count),
      },
    });
    if (serializedByteLength(candidate) <= STREAM_DECK_MAX_MESSAGE_BYTES) {
      best = candidate;
      low = count + 1;
    } else {
      high = count - 1;
    }
  }
  if (best) return best;
  throw new Error('Stream Deck state metadata exceeds the 512 KiB limit.');
};
