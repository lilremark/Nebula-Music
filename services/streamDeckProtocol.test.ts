import { describe, expect, it } from 'vitest';
import {
  isValidCommand,
  parsePluginMessage,
  STREAM_DECK_PROTOCOL,
  STREAM_DECK_MAX_MESSAGE_BYTES,
  serializeBrowserMessage,
  toPlaylistSummary,
  toTrackSummary,
} from './streamDeckProtocol';

describe('Stream Deck protocol', () => {
  it('accepts all supported command shapes', () => {
    expect(isValidCommand({ name: 'togglePlayback' })).toBe(true);
    expect(isValidCommand({ name: 'setPlayback', playing: true })).toBe(true);
    expect(isValidCommand({ name: 'setVolume', volume: 0.42 })).toBe(true);
    expect(isValidCommand({ name: 'seekRelative', seconds: -5 })).toBe(true);
    expect(
      isValidCommand({ name: 'seekAbsolute', seconds: 125, trackId: 'song-1' }),
    ).toBe(true);
    expect(isValidCommand({ name: 'startPlaylist', playlistId: 'road-trip' })).toBe(
      true,
    );
  });

  it('rejects malformed, unknown, and non-finite commands', () => {
    expect(isValidCommand(null)).toBe(false);
    expect(isValidCommand({ name: 'deletePlaylist', payload: {} })).toBe(false);
    expect(isValidCommand({ name: 'setVolume', volume: Number.NaN })).toBe(false);
    expect(isValidCommand({ name: 'setPlayback', playing: 'yes' })).toBe(false);
    expect(isValidCommand({ name: 'seekAbsolute', seconds: -1, trackId: 'song-1' })).toBe(false);
    expect(isValidCommand({ name: 'seekAbsolute', seconds: 1, trackId: '' })).toBe(false);
    expect(isValidCommand({ name: 'startPlaylist', playlistId: '' })).toBe(false);
  });

  it('classifies malformed JSON and protocol mismatch', () => {
    expect(parsePluginMessage('{').ok).toBe(false);
    expect(
      parsePluginMessage(JSON.stringify({ protocol: 'nebula-streamdeck/2', type: 'requestSnapshot' })),
    ).toEqual({
      ok: false,
      code: 'protocol_mismatch',
      message: `Expected protocol ${STREAM_DECK_PROTOCOL}.`,
    });
  });

  it('parses every plugin handshake message using the exact schema', () => {
    expect(
      parsePluginMessage(
        JSON.stringify({ protocol: STREAM_DECK_PROTOCOL, type: 'requestSnapshot' }),
      ).ok,
    ).toBe(true);
    expect(
      parsePluginMessage(
        JSON.stringify({
          protocol: STREAM_DECK_PROTOCOL,
          type: 'authChallenge',
          nonce: 'n'.repeat(43),
        }),
      ).ok,
    ).toBe(true);
    expect(
      parsePluginMessage(
        JSON.stringify({
          protocol: STREAM_DECK_PROTOCOL,
          type: 'revocationResult',
          ok: true,
        }),
      ).ok,
    ).toBe(true);
    expect(
      parsePluginMessage(
        JSON.stringify({
          protocol: STREAM_DECK_PROTOCOL,
          type: 'authChallenge',
          nonce: 'not-base64url',
        }),
      ).ok,
    ).toBe(false);
    expect(
      parsePluginMessage(
        JSON.stringify({
          protocol: STREAM_DECK_PROTOCOL,
          type: 'command',
          requestId: 'request-1',
          command: { name: 'next' },
        }),
      ).ok,
    ).toBe(true);
    expect(
      parsePluginMessage(
        JSON.stringify({
          protocol: STREAM_DECK_PROTOCOL,
          type: 'pairingResult',
          ok: true,
          token: 'a'.repeat(43),
        }),
      ).ok,
    ).toBe(true);
  });

  it('fits state messages to the serialized 512 KiB budget', () => {
    const serialized = serializeBrowserMessage({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'state',
      snapshot: {
        sessionId: 'session-1',
        clientId: 'client-1',
        origin: 'https://music.example.com',
        nebulaVersion: '2.1.3',
        visible: true,
        lastActiveAt: 1,
        connectedAt: 1,
        playing: true,
        positionSeconds: 10,
        durationSeconds: 200,
        volume: 0.5,
        muted: false,
        track: {
          id: 'song-1',
          title: 'Nebula',
          artist: 'The Orbits',
          artworkDataUrl: `data:image/jpeg;base64,${'a'.repeat(511_900)}`,
        },
        playlists: Array.from({ length: 1000 }, (_, index) => ({
          id: `playlist-${index}-${'i'.repeat(230)}`,
          name: `Playlist ${index} ${'n'.repeat(490)}`,
          trackCount: index,
        })),
      },
    });
    const parsed = JSON.parse(serialized);
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(
      STREAM_DECK_MAX_MESSAGE_BYTES,
    );
    expect(parsed.snapshot.track).not.toHaveProperty('artworkDataUrl');
    expect(parsed.snapshot.playlists.length).toBeLessThan(1000);
  });

  it('creates public summaries without private song or playlist fields', () => {
    const track = toTrackSummary({
      id: 'song-1',
      title: 'Nebula',
      artist: 'The Orbits',
      album: 'Night Sky',
      duration: 215,
      path: '/private/music/file.flac',
    });
    expect(track).toEqual({
      id: 'song-1',
      title: 'Nebula',
      artist: 'The Orbits',
      album: 'Night Sky',
    });
    expect(track).not.toHaveProperty('path');

    const playlist = toPlaylistSummary({
      id: 'playlist-1',
      name: 'Favorites',
      songCount: 0,
      duration: 0,
      created: '2026-01-01',
      songs: [{
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album ?? '',
        duration: 215,
        path: '/private/file',
      }],
    });
    expect(playlist).toEqual({
      id: 'playlist-1',
      name: 'Favorites',
      trackCount: 1,
    });
    expect(playlist).not.toHaveProperty('songs');
  });
});
