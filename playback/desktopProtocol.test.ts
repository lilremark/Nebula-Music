import { describe, expect, it } from 'vitest';
import {
  acceptEnvelope,
  desktopCommandEnvelopeSchema,
  desktopSnapshotSchema,
  DESKTOP_PROTOCOL_VERSION,
  parseCommandEnvelope,
  toRepeatMode,
  toTrackSummary,
  type DesktopCommandEnvelope,
} from './desktopProtocol';
import { STREAM_DECK_MAX_ARTWORK_LENGTH } from '../services/streamDeckProtocol';

const envelope = (
  command: DesktopCommandEnvelope['command'] = { name: 'togglePlayback' },
  overrides: Partial<Omit<DesktopCommandEnvelope, 'command'>> = {},
): DesktopCommandEnvelope => ({
  v: DESKTOP_PROTOCOL_VERSION,
  clientId: 'tray',
  epoch: 7,
  seq: 1,
  issuedAt: 1_000,
  command,
  ...overrides,
});

describe('Desktop playback protocol', () => {
  it('parses valid command envelopes', () => {
    const result = parseCommandEnvelope(envelope());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.command.name).toBe('togglePlayback');
    }
  });

  it('rejects envelopes with the wrong protocol version', () => {
    const result = parseCommandEnvelope({ ...envelope(), v: 2 });
    expect(result).toMatchObject({ ok: false, code: 'protocol_mismatch' });
  });

  it('rejects malformed and unknown commands', () => {
    expect(
      parseCommandEnvelope({ ...envelope(), command: { name: 'ejectTray' } }).ok,
    ).toBe(false);
    expect(parseCommandEnvelope({ ...envelope(), command: { name: 'setVolume' } }).ok).toBe(
      false,
    );
    expect(parseCommandEnvelope(envelope({ name: 'togglePlayback' }, { seq: 0 })).ok).toBe(
      false,
    );
    expect(parseCommandEnvelope(envelope({ name: 'togglePlayback' }, { epoch: -1 })).ok).toBe(
      false,
    );
    expect(parseCommandEnvelope(envelope({ name: 'togglePlayback' }, { clientId: '' })).ok).toBe(
      false,
    );
    expect(parseCommandEnvelope(null).ok).toBe(false);
    expect(parseCommandEnvelope('not an object').ok).toBe(false);
  });

  it('drops unknown fields while keeping valid ones', () => {
    const result = parseCommandEnvelope({ ...envelope(), injected: 'ignored' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope).not.toHaveProperty('injected');
    }
  });

  it('validates the full command vocabulary', () => {
    const commands: DesktopCommandEnvelope['command'][] = [
      { name: 'setPlayback', playing: false },
      { name: 'togglePlayback' },
      { name: 'previous' },
      { name: 'next' },
      { name: 'setVolume', volume: 0.5 },
      { name: 'setPlaybackRate', playbackRate: 1.5 },
      { name: 'seekRelative', seconds: -10 },
      { name: 'seekAbsolute', seconds: 60, trackId: 'abc' },
      { name: 'setRepeatMode', repeatMode: 'ALL' },
    ];
    for (const command of commands) {
      expect(parseCommandEnvelope(envelope(command)).ok).toBe(true);
    }
  });

  it('accepts a valid snapshot shape', () => {
    const parsed = desktopSnapshotSchema.safeParse({
      v: DESKTOP_PROTOCOL_VERSION,
      ownerId: 'owner',
      epoch: 0,
      playing: true,
      track: null,
      positionSeconds: 12,
      durationSeconds: 210,
      volume: 0.8,
      muted: false,
      playbackRate: 1,
      repeatMode: 'OFF',
      updatedAt: 1_234,
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts JPEG base64 cover art data URLs', () => {
    const parsed = desktopSnapshotSchema.safeParse({
      v: DESKTOP_PROTOCOL_VERSION,
      ownerId: 'owner',
      epoch: 0,
      playing: true,
      track: {
        id: 'song-1',
        title: 'Nebula',
        artist: 'Drift',
        coverArtUrl: 'data:image/jpeg;base64,/9j/2Q==',
      },
      positionSeconds: 12,
      durationSeconds: 210,
      volume: 0.8,
      muted: false,
      playbackRate: 1,
      repeatMode: 'OFF',
      updatedAt: 1_234,
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    'https://music.example/cover.jpg',
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/jpeg,/9j/2Q==',
    'data:image/jpeg;base64,not valid base64!',
  ])('rejects cover art outside the sanitized JPEG contract: %s', (coverArtUrl) => {
    const parsed = desktopSnapshotSchema.safeParse({
      v: DESKTOP_PROTOCOL_VERSION,
      ownerId: 'owner',
      epoch: 0,
      playing: true,
      track: { id: 'song-1', title: 'Nebula', artist: 'Drift', coverArtUrl },
      positionSeconds: 12,
      durationSeconds: 210,
      volume: 0.8,
      muted: false,
      playbackRate: 1,
      repeatMode: 'OFF',
      updatedAt: 1_234,
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects cover art above the sanitizer output limit', () => {
    const prefix = 'data:image/jpeg;base64,';
    const coverArtUrl = prefix + 'AAAA'.repeat(Math.ceil(STREAM_DECK_MAX_ARTWORK_LENGTH / 4));
    expect(coverArtUrl.length).toBeGreaterThan(STREAM_DECK_MAX_ARTWORK_LENGTH);

    const parsed = desktopSnapshotSchema.safeParse({
      v: DESKTOP_PROTOCOL_VERSION,
      ownerId: 'owner',
      epoch: 0,
      playing: true,
      track: { id: 'song-1', title: 'Nebula', artist: 'Drift', coverArtUrl },
      positionSeconds: 12,
      durationSeconds: 210,
      volume: 0.8,
      muted: false,
      playbackRate: 1,
      repeatMode: 'OFF',
      updatedAt: 1_234,
    });

    expect(parsed.success).toBe(false);
  });
});

describe('Epoch and sequence validation', () => {
  it('accepts commands in sequence order for a client', () => {
    const cursor = { epoch: 7, lastSeqByClient: new Map<string, number>() };
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { seq: 1 }), cursor)).toEqual({
      accepted: true,
    });
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { seq: 2 }), cursor)).toEqual({
      accepted: true,
    });
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { seq: 3 }), cursor)).toEqual({
      accepted: true,
    });
  });

  it('rejects commands from a stale epoch', () => {
    const cursor = { epoch: 8, lastSeqByClient: new Map<string, number>() };
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { epoch: 7, seq: 1 }), cursor)).toEqual(
      {
        accepted: false,
        reason: 'stale_epoch',
      },
    );
  });

  it('rejects replayed or out-of-order sequences', () => {
    const cursor = { epoch: 7, lastSeqByClient: new Map<string, number>() };
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { seq: 5 }), cursor)).toEqual({
      accepted: true,
    });
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { seq: 5 }), cursor)).toEqual({
      accepted: false,
      reason: 'duplicate_seq',
    });
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { seq: 4 }), cursor)).toEqual({
      accepted: false,
      reason: 'duplicate_seq',
    });
  });

  it('tracks sequence per client independently', () => {
    const cursor = { epoch: 7, lastSeqByClient: new Map<string, number>() };
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { clientId: 'tray', seq: 1 }), cursor)).toEqual(
      {
        accepted: true,
      },
    );
    expect(
      acceptEnvelope(envelope({ name: 'togglePlayback' }, { clientId: 'media-keys', seq: 1 }), cursor),
    ).toEqual({
      accepted: true,
    });
    expect(acceptEnvelope(envelope({ name: 'togglePlayback' }, { clientId: 'tray', seq: 2 }), cursor)).toEqual(
      {
        accepted: true,
      },
    );
  });
});

describe('Snapshot helpers', () => {
  it('truncates track metadata to bounded fields', () => {
    expect(
      toTrackSummary({ id: 'song-1', title: 'Nebula', artist: 'Drift', album: 'Sky' }),
    ).toEqual({ id: 'song-1', title: 'Nebula', artist: 'Drift', album: 'Sky' });
    expect(toTrackSummary({ id: 'song-1', title: 'Nebula', artist: 'Drift' })).toEqual({
      id: 'song-1',
      title: 'Nebula',
      artist: 'Drift',
    });
  });

  it('keeps only cover art that satisfies the sanitizer output contract', () => {
    const validCoverArtUrl = 'data:image/jpeg;base64,/9j/2Q==';
    expect(
      toTrackSummary({
        id: 'song-1',
        title: 'Nebula',
        artist: 'Drift',
        coverArtUrl: validCoverArtUrl,
      }),
    ).toHaveProperty('coverArtUrl', validCoverArtUrl);

    const prefix = 'data:image/jpeg;base64,';
    const overLimit = prefix + 'AAAA'.repeat(Math.ceil(STREAM_DECK_MAX_ARTWORK_LENGTH / 4));
    expect(
      toTrackSummary({
        id: 'song-1',
        title: 'Nebula',
        artist: 'Drift',
        coverArtUrl: overLimit,
      }),
    ).not.toHaveProperty('coverArtUrl');
  });

  it('normalizes repeat modes to the protocol vocabulary', () => {
    expect(toRepeatMode('ALL')).toBe('ALL');
    expect(toRepeatMode('ONE')).toBe('ONE');
    expect(toRepeatMode(undefined)).toBe('OFF');
    expect(toRepeatMode('unknown' as never)).toBe('OFF');
  });

  it('round-trips valid envelopes through the schema', () => {
    const input = envelope({ name: 'setVolume', volume: 0.4 });
    const parsed = desktopCommandEnvelopeSchema.safeParse(JSON.parse(JSON.stringify(input)));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(input);
  });
});
