import { describe, expect, it } from 'vitest';
import { DESKTOP_PROTOCOL_VERSION, type DesktopSnapshot } from './desktopProtocol';
import { getPlaybackMenuKey } from './playbackMenuKey';

const snapshot = (overrides: Partial<DesktopSnapshot> = {}): DesktopSnapshot => ({
  v: DESKTOP_PROTOCOL_VERSION,
  ownerId: 'owner',
  epoch: 1,
  playing: false,
  track: {
    id: 'song-1',
    title: 'Nebula',
    artist: 'Drift',
  },
  positionSeconds: 0,
  durationSeconds: 180,
  volume: 1,
  muted: false,
  playbackRate: 1,
  repeatMode: 'OFF',
  updatedAt: 1,
  ...overrides,
});

describe('getPlaybackMenuKey', () => {
  it('changes when the track, playback state, or artwork availability changes', () => {
    const stopped = snapshot();
    const playing = snapshot({ playing: true });
    const nextTrack = snapshot({ track: { id: 'song-2', title: 'Orbit', artist: 'Drift' } });
    const withArtwork = snapshot({
      track: {
        id: 'song-1',
        title: 'Nebula',
        artist: 'Drift',
        coverArtUrl: 'data:image/jpeg;base64,/9j/2Q==',
      },
    });

    expect(getPlaybackMenuKey(stopped)).not.toBe(getPlaybackMenuKey(playing));
    expect(getPlaybackMenuKey(stopped)).not.toBe(getPlaybackMenuKey(nextTrack));
    expect(getPlaybackMenuKey(stopped)).not.toBe(getPlaybackMenuKey(withArtwork));
  });

  it('deduplicates progress-only snapshots and artwork content changes', () => {
    const first = snapshot({ positionSeconds: 10, updatedAt: 10 });
    const progress = snapshot({ positionSeconds: 11, updatedAt: 11 });
    const firstArtwork = snapshot({
      track: {
        id: 'song-1',
        title: 'Nebula',
        artist: 'Drift',
        coverArtUrl: 'data:image/jpeg;base64,/9j/2Q==',
      },
    });
    const replacementArtwork = snapshot({
      track: {
        id: 'song-1',
        title: 'Nebula',
        artist: 'Drift',
        coverArtUrl: 'data:image/jpeg;base64,/9j/4A==',
      },
    });

    expect(getPlaybackMenuKey(first)).toBe(getPlaybackMenuKey(progress));
    expect(getPlaybackMenuKey(firstArtwork)).toBe(getPlaybackMenuKey(replacementArtwork));
  });
});
