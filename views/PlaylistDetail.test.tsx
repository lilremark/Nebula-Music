// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaylistDetailView } from './PlaylistDetail';
import type { IPlaylist, ISong } from '../types';

const { store } = vi.hoisted(() => ({ store: {} as Record<string, any> }));
vi.mock('../context/Store', () => ({ useStore: () => store }));
vi.mock('../hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({
  colors: { primary: '#c06040' }, defaultColors: { primary: '#ffffff' }, isLoading: false,
}) }));

const song: ISong = { id: 'song', title: 'Track', album: 'Album', artist: 'Artist', duration: 180 };
const playlist: IPlaylist = { id: 'playlist', name: 'Playlist', songCount: 1, duration: 180, created: '', songs: [song] };

describe('playlist navigation and playback controls', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    root = createRoot(container);
    Object.assign(store, {
      viewData: 'playlist', playlists: [playlist], queue: [], currentSongIndex: 0,
      currentRadioStation: null, isPlaying: false, isDemoMode: true,
      service: { getPlaylist: vi.fn().mockResolvedValue(playlist), getCoverArtUrl: () => '/art' },
      setView: vi.fn(), playSong: vi.fn(), togglePlay: vi.fn(), toggleLike: vi.fn(),
      openPlaylistModal: vi.fn(), deletePlaylist: vi.fn(), savePlaylist: vi.fn(),
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals(); vi.clearAllMocks();
  });
  const render = () => act(async () => root.render(<PlaylistDetailView />));

  it('ignores an old playlist response after navigating to another playlist', async () => {
    let resolveOld!: (value: IPlaylist) => void;
    store.playlists = [];
    store.service.getPlaylist.mockImplementation((id: string) => id === 'old'
      ? new Promise<IPlaylist>(resolve => { resolveOld = resolve; })
      : Promise.resolve({ ...playlist, id: 'new', name: 'New playlist' }));
    store.viewData = 'old';
    await render();
    store.viewData = 'new';
    await render();
    await act(async () => resolveOld({ ...playlist, id: 'old', name: 'Old playlist' }));
    expect(container.querySelector('h1')?.textContent).toBe('New playlist');
  });

  it('uses the shared queue and keeps track actions separate from playback', async () => {
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-nebula-track-play]')!.click());
    expect(store.playSong).toHaveBeenCalledExactlyOnceWith(song, playlist.songs);
    store.playSong.mockClear();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Like song"]')!.click());
    expect(store.toggleLike).toHaveBeenCalledExactlyOnceWith(song);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add to playlist"]')!.click());
    expect(store.openPlaylistModal).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: song.id }));
    expect(store.playSong).not.toHaveBeenCalled();
  });

  it('pauses an active playlist without replacing its queue', async () => {
    store.queue = playlist.songs;
    store.isPlaying = true;
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-nebula-album-options] button')!.click());
    expect(store.togglePlay).toHaveBeenCalledOnce();
    expect(store.playSong).not.toHaveBeenCalled();
  });
});
