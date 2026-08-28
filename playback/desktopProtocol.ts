import { z } from 'zod';
import type { RepeatMode } from '../types';
import { STREAM_DECK_MAX_ARTWORK_LENGTH } from '../services/streamDeckProtocol';

/**
 * Desktop playback protocol (v1).
 *
 * The main React window is the playback owner. Tray, media keys, taskbar
 * controls, and the mini-player are remote clients that send command envelopes
 * over IPC and consume snapshots. This module is the shared contract and is
 * bundled into both the renderer and the main process.
 */

export const DESKTOP_PROTOCOL_VERSION = 1 as const;

const REPEAT_MODES = ['OFF', 'ALL', 'ONE'] as const;

export const desktopCommandSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('setPlayback'), playing: z.boolean() }),
  z.object({ name: z.literal('togglePlayback') }),
  z.object({ name: z.literal('previous') }),
  z.object({ name: z.literal('next') }),
  z.object({
    name: z.literal('setVolume'),
    volume: z.number().min(0).max(1),
  }),
  z.object({
    name: z.literal('setPlaybackRate'),
    playbackRate: z.number().min(0.5).max(2),
  }),
  z.object({
    name: z.literal('seekRelative'),
    seconds: z.number().min(-86_400).max(86_400),
  }),
  z.object({
    name: z.literal('seekAbsolute'),
    seconds: z.number().min(0).max(86_400),
    trackId: z.string().min(1).max(256),
  }),
  z.object({ name: z.literal('setRepeatMode'), repeatMode: z.enum(REPEAT_MODES) }),
  z.object({
    name: z.literal('playQueueIndex'),
    index: z.number().int().min(0).max(65_535),
  }),
]);

export type DesktopCommand = z.infer<typeof desktopCommandSchema>;

export const desktopCommandEnvelopeSchema = z.object({
  v: z.literal(DESKTOP_PROTOCOL_VERSION),
  clientId: z.string().min(1).max(64),
  epoch: z.number().int().min(0),
  seq: z.number().int().min(1),
  issuedAt: z.number().int().min(0),
  command: desktopCommandSchema,
});

export type DesktopCommandEnvelope = z.infer<typeof desktopCommandEnvelopeSchema>;

const desktopCoverArtUrlSchema = z
  .string()
  .max(STREAM_DECK_MAX_ARTWORK_LENGTH)
  .regex(
    /^data:image\/jpeg;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/,
  );

export const desktopTrackSchema = z
  .object({
    id: z.string().min(1).max(256),
    title: z.string().min(1).max(512),
    artist: z.string().min(1).max(512),
    album: z.string().max(512).optional(),
    coverArtUrl: desktopCoverArtUrlSchema.optional(),
  })
  .nullable();

export type DesktopTrack = z.infer<typeof desktopTrackSchema>;

/** A track queued ahead of the current one, for the mini-player "Up Next" list. */
export const desktopUpcomingTrackSchema = z.object({
  id: z.string().min(1).max(256),
  title: z.string().min(1).max(512),
  artist: z.string().min(1).max(512),
  album: z.string().max(512).optional(),
  durationSeconds: z.number().min(0),
  coverArtUrl: desktopCoverArtUrlSchema.optional(),
});

export type DesktopUpcomingTrack = z.infer<typeof desktopUpcomingTrackSchema>;

export const desktopSnapshotSchema = z.object({
  v: z.literal(DESKTOP_PROTOCOL_VERSION),
  ownerId: z.string().min(1).max(64),
  epoch: z.number().int().min(0),
  playing: z.boolean(),
  track: desktopTrackSchema,
  positionSeconds: z.number().min(0),
  durationSeconds: z.number().min(0),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  playbackRate: z.number().min(0.5).max(2),
  repeatMode: z.enum(REPEAT_MODES),
  updatedAt: z.number().int().min(0),
  /** Upcoming queue entries (mini-player "Up Next" list). Empty when nothing is queued. */
  upcoming: z.array(desktopUpcomingTrackSchema).default([]),
});

export type DesktopSnapshot = z.infer<typeof desktopSnapshotSchema>;

export type RepeatModeValue = (typeof REPEAT_MODES)[number];

export const toRepeatMode = (value: RepeatMode | undefined): RepeatModeValue =>
  value && REPEAT_MODES.includes(value) ? value : 'OFF';

export type ParseEnvelopeResult =
  | { ok: true; envelope: DesktopCommandEnvelope }
  | { ok: false; code: 'invalid_command' | 'protocol_mismatch'; message: string };

/**
 * Parses and validates a raw command envelope (e.g. from IPC serialization).
 * Unknown fields are dropped; structurally invalid envelopes are rejected.
 */
export const parseCommandEnvelope = (raw: unknown): ParseEnvelopeResult => {
  const parsed = desktopCommandEnvelopeSchema.safeParse(raw);
  if (parsed.success) return { ok: true, envelope: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    code: issue?.path[0] === 'v' ? 'protocol_mismatch' : 'invalid_command',
    message: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid command envelope.',
  };
};

export interface CommandCursor {
  /** The owner's current epoch; commands from older epochs are stale. */
  epoch: number;
  /** Highest accepted sequence per client id, used to reject replays/orderings. */
  lastSeqByClient: Map<string, number>;
}

export type EnvelopeAcceptance =
  | { accepted: true }
  | { accepted: false; reason: 'stale_epoch' | 'duplicate_seq' };

/**
 * Validates an envelope against the owner's epoch and per-client sequence.
 * Accepting advances the cursor for that client (caller must ensure commands
 * are applied before the next one for that client).
 */
export const acceptEnvelope = (
  envelope: DesktopCommandEnvelope,
  cursor: CommandCursor,
): EnvelopeAcceptance => {
  if (envelope.epoch !== cursor.epoch) {
    return { accepted: false, reason: 'stale_epoch' };
  }
  const last = cursor.lastSeqByClient.get(envelope.clientId) ?? 0;
  if (envelope.seq <= last) {
    return { accepted: false, reason: 'duplicate_seq' };
  }
  cursor.lastSeqByClient.set(envelope.clientId, envelope.seq);
  return { accepted: true };
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const toTrackSummary = (song: {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverArtUrl?: string;
}): DesktopTrack => {
  const coverArtUrl = desktopCoverArtUrlSchema.safeParse(song.coverArtUrl);
  return {
    id: song.id.slice(0, 256),
    title: song.title.slice(0, 512),
    artist: song.artist.slice(0, 512),
    ...(song.album ? { album: song.album.slice(0, 512) } : {}),
    ...(coverArtUrl.success ? { coverArtUrl: coverArtUrl.data } : {}),
  };
};

/** Builds a summary for a queued track in the mini-player "Up Next" list. */
export const toUpcomingSummary = (song: {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  coverArtUrl?: string;
}): DesktopUpcomingTrack => {
  const coverArtUrl = desktopCoverArtUrlSchema.safeParse(song.coverArtUrl);
  return {
    id: song.id.slice(0, 256),
    title: song.title.slice(0, 512),
    artist: song.artist.slice(0, 512),
    ...(song.album ? { album: song.album.slice(0, 512) } : {}),
    durationSeconds: Math.max(0, song.durationSeconds ?? 0),
    ...(coverArtUrl.success ? { coverArtUrl: coverArtUrl.data } : {}),
  };
};

/** A minimimal track shape sufficient to derive an "Up Next" entry. */
export interface QueueSongLike {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverArt?: string;
}

/** Computes the up-to-5 tracks queued after the current one. */
export const buildUpcomingList = (
  queue: QueueSongLike[],
  currentSongIndex: number,
  repeatMode: 'OFF' | 'ALL' | 'ONE',
  coverArtById: Map<string, string | undefined>,
): DesktopUpcomingTrack[] => {
  if (queue.length === 0 || currentSongIndex < 0) return [];
  const result: DesktopUpcomingTrack[] = [];
  let index = currentSongIndex + 1;
  let guard = 0;
  const UPCOMING_LIST_SIZE = 5;
  while (result.length < UPCOMING_LIST_SIZE && guard < queue.length + UPCOMING_LIST_SIZE) {
    guard += 1;
    if (index >= queue.length) {
      if (repeatMode !== 'ALL') break;
      index = 0;
    }
    if (index === currentSongIndex) break;
    const song = queue[index];
    if (song) {
      result.push(
        toUpcomingSummary({
          id: song.id,
          title: song.title,
          artist: song.artist,
          ...(song.album ? { album: song.album } : {}),
          durationSeconds: song.duration,
          coverArtUrl: coverArtById.get(song.id),
        }),
      );
    }
    index += 1;
  }
  return result;
};
