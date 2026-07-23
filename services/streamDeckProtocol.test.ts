import { describe, expect, it } from 'vitest';
import {
  isValidCommand,
  parsePluginMessage,
  STREAM_DECK_PROTOCOL,
  toPlaylistSummary,
  toTrackSummary,
} from './streamDeckProtocol';

describe('Stream Deck protocol', () => {
  it('accepts all supported command shapes', () => {
    expect(isValidCommand({ name: 'togglePlayback' })).toBe(true);
    expect(isValidCommand({ name: 'setPlayback', playing: true })).toBe(true);
    expect(isValidCommand({ name: 'setVolume', volume: 0.42 })).toBe(true);
    expect(isValidCommand({ name: 'seekRelative', seconds: -5 })).toBe(true);
    expect(isValidCommand({ name: 'startPlaylist', playlistId: 'road-trip' })).toBe(
      true,
    );
  });

  it('rejects malformed, unknown, and non-finite commands', () => {
    expect(isValidCommand(null)).toBe(false);
    expect(isValidCommand({ name: 'deletePlaylist', payload: {} })).toBe(false);
    expect(isValidCommand({ name: 'setVolume', volume: Number.NaN })).toBe(false);
    expect(isValidCommand({ name: 'setPlayback', playing: 'yes' })).toBe(false);
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

  it('parses snapshot, command, and pairing messages', () => {
    expect(
      parsePluginMessage(
        JSON.stringify({ protocol: STREAM_DECK_PROTOCOL, type: 'requestSnapshot' }),
      ).ok,
    ).toBe(true);
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
