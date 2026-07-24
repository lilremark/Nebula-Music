import { describe, expect, it, vi } from 'vitest';
import type { IPlaylist, ISong } from '../types';
import { createStreamDeckCommandHandler } from './streamDeckCommands';

const song: ISong = {
  id: 'song-1',
  title: 'Nebula',
  artist: 'The Orbits',
  album: 'Night Sky',
  duration: 200,
};

const makeDependencies = (playlist?: IPlaylist) => {
  const audio = { currentTime: 10, duration: 100 } as HTMLAudioElement;
  const dependencies = {
    getState: vi.fn(() => ({
      isPlaying: false,
      playlists: playlist ? [playlist] : [],
      trackId: song.id,
    })),
    togglePlay: vi.fn(),
    nextSong: vi.fn(),
    prevSong: vi.fn(),
    setVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    setPitch: vi.fn(),
    setPitchCorrection: vi.fn(),
    playSong: vi.fn(),
    getPlaylist: vi.fn(async () => playlist ?? null),
    audioRef: { current: audio } as { current: HTMLAudioElement | null },
  };
  return { dependencies, audio };
};

describe('Stream Deck command routing', () => {
  it('routes playback and transport commands', async () => {
    const { dependencies } = makeDependencies();
    const handle = createStreamDeckCommandHandler(dependencies);
    await handle({ name: 'setPlayback', playing: true });
    await handle({ name: 'togglePlayback' });
    await handle({ name: 'previous' });
    await handle({ name: 'next' });
    expect(dependencies.togglePlay).toHaveBeenCalledTimes(2);
    expect(dependencies.prevSong).toHaveBeenCalledOnce();
    expect(dependencies.nextSong).toHaveBeenCalledOnce();
  });

  it('does not toggle when explicit playback state already matches', async () => {
    const { dependencies } = makeDependencies();
    dependencies.getState.mockReturnValue({
      isPlaying: true,
      playlists: [],
      trackId: song.id,
    });
    await createStreamDeckCommandHandler(dependencies)({
      name: 'setPlayback',
      playing: true,
    });
    expect(dependencies.togglePlay).not.toHaveBeenCalled();
  });

  it('uses synchronously mirrored state for consecutive playback commands', async () => {
    let isPlaying = false;
    const { dependencies } = makeDependencies();
    dependencies.getState.mockImplementation(() => ({
      isPlaying,
      playlists: [],
      trackId: song.id,
    }));
    dependencies.togglePlay.mockImplementation(() => {
      isPlaying = !isPlaying;
    });
    const handle = createStreamDeckCommandHandler(dependencies);
    await handle({ name: 'setPlayback', playing: true });
    await handle({ name: 'setPlayback', playing: false });
    expect(dependencies.togglePlay).toHaveBeenCalledTimes(2);
    expect(isPlaying).toBe(false);
  });

  it('clamps volume and relative seeks', async () => {
    const { dependencies, audio } = makeDependencies();
    const handle = createStreamDeckCommandHandler(dependencies);
    await handle({ name: 'setVolume', volume: 1.5 });
    await handle({ name: 'seekRelative', seconds: -50 });
    expect(dependencies.setVolume).toHaveBeenCalledWith(1);
    expect(audio.currentTime).toBe(0);
    audio.currentTime = 95;
    await handle({ name: 'seekRelative', seconds: 20 });
    expect(audio.currentTime).toBe(100);
    await handle({ name: 'seekAbsolute', seconds: 42, trackId: song.id });
    expect(audio.currentTime).toBe(42);
    await expect(
      handle({ name: 'seekAbsolute', seconds: 10, trackId: 'different-track' }),
    ).rejects.toMatchObject({ code: 'playback_failed' });
  });

  it('routes playback tuning controls', async () => {
    const { dependencies } = makeDependencies();
    const handle = createStreamDeckCommandHandler(dependencies);
    await handle({ name: 'setPlaybackRate', playbackRate: 1.4 });
    await handle({ name: 'setPitch', pitchSemitones: -3 });
    await handle({ name: 'setPitchCorrection', enabled: false });
    expect(dependencies.setPlaybackRate).toHaveBeenCalledWith(1.4);
    expect(dependencies.setPitch).toHaveBeenCalledWith(-3);
    expect(dependencies.setPitchCorrection).toHaveBeenCalledWith(false);
  });

  it('acknowledges high-frequency controls without scheduling a browser timer', async () => {
    vi.useFakeTimers();
    try {
      const { dependencies } = makeDependencies();
      const handle = createStreamDeckCommandHandler(dependencies);
      await expect(handle({ name: 'setVolume', volume: 0.4 })).resolves.toBeUndefined();
      await expect(
        handle({ name: 'setPlaybackRate', playbackRate: 1.3 }),
      ).resolves.toBeUndefined();
      await expect(handle({ name: 'setPitch', pitchSemitones: 2 })).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads a remote playlist and replaces the queue', async () => {
    const playlist: IPlaylist = {
      id: 'playlist-1',
      name: 'Favorites',
      songCount: 1,
      duration: 200,
      created: '2026-01-01',
    };
    const loaded = { ...playlist, songs: [song] };
    const { dependencies } = makeDependencies(playlist);
    dependencies.getPlaylist.mockResolvedValue(loaded);
    await createStreamDeckCommandHandler(dependencies)({
      name: 'startPlaylist',
      playlistId: playlist.id,
    });
    expect(dependencies.getPlaylist).toHaveBeenCalledWith(playlist.id);
    expect(dependencies.playSong).toHaveBeenCalledWith(song, [song]);
  });

  it('reports stale and empty playlists using structured failures', async () => {
    const missing = makeDependencies();
    await expect(
      createStreamDeckCommandHandler(missing.dependencies)({
        name: 'startPlaylist',
        playlistId: 'missing',
      }),
    ).rejects.toMatchObject({ code: 'stale_playlist' });

    const emptyPlaylist: IPlaylist = {
      id: 'local-empty',
      name: 'Empty',
      songCount: 0,
      duration: 0,
      created: '2026-01-01',
      songs: [],
    };
    const empty = makeDependencies(emptyPlaylist);
    await expect(
      createStreamDeckCommandHandler(empty.dependencies)({
        name: 'startPlaylist',
        playlistId: emptyPlaylist.id,
      }),
    ).rejects.toMatchObject({ code: 'empty_playlist' });
  });

  it('rejects seek when there is no active audio element', async () => {
    const { dependencies } = makeDependencies();
    dependencies.audioRef.current = null;
    await expect(
      createStreamDeckCommandHandler(dependencies)({
        name: 'seekRelative',
        seconds: 5,
      }),
    ).rejects.toMatchObject({ code: 'playback_failed' });
  });
});
