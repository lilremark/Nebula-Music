// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlbumDetailView } from './AlbumDetail';
import type { IAlbum, ISong } from '../types';

const { store } = vi.hoisted(() => ({ store: {} as Record<string, any> }));
vi.mock('../context/Store', () => ({ useStore: () => store }));
vi.mock('../hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({
  colors: { primary: '#c06040' }, defaultColors: { primary: '#ffffff' }, isLoading: false,
}) }));

const song: ISong = { id: 'song', title: 'Track', album: 'Album', artist: 'Artist', duration: 180 };
const album: IAlbum = { id: 'album', name: 'Album', artist: 'Artist', songCount: 1, duration: 180, created: '', songs: [song] };

describe('album navigation and playback controls', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    root = createRoot(container);
    Object.assign(store, {
      viewData: 'album', queue: [], currentSongIndex: 0, currentRadioStation: null, isPlaying: false,
      service: { getAlbum: vi.fn().mockResolvedValue(album), getCoverArtUrl: () => '/art', toggleStar: vi.fn() },
      setView: vi.fn(), playSong: vi.fn(), togglePlay: vi.fn(), toggleLike: vi.fn(), openPlaylistModal: vi.fn(),
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals(); vi.clearAllMocks();
  });
  const render = () => act(async () => root.render(<AlbumDetailView />));

  it('ignores an old album response after navigating to another album', async () => {
    let resolveOld!: (value: IAlbum) => void;
    store.service.getAlbum.mockImplementation((id: string) => id === 'old'
      ? new Promise<IAlbum>(resolve => { resolveOld = resolve; })
      : Promise.resolve({ ...album, id: 'new', name: 'New album' }));
    store.viewData = 'old';
    await render();
    store.viewData = 'new';
    await render();
    await act(async () => resolveOld({ ...album, id: 'old', name: 'Old album' }));
    expect(container.querySelector('h1')?.textContent).toBe('New album');
  });

  it('plays through the shared queue while track actions do not trigger playback', async () => {
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-nebula-track-play]')!.click());
    expect(store.playSong).toHaveBeenCalledExactlyOnceWith(song, album.songs);
    store.playSong.mockClear();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Like song"]')!.click());
    expect(store.toggleLike).toHaveBeenCalledExactlyOnceWith(song);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add to playlist"]')!.click());
    expect(store.openPlaylistModal).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: song.id }));
    expect(store.playSong).not.toHaveBeenCalled();
  });

  it('pauses the current album queue without replacing it', async () => {
    store.queue = album.songs;
    store.isPlaying = true;
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-nebula-album-options] button')!.click());
    expect(store.togglePlay).toHaveBeenCalledOnce();
    expect(store.playSong).not.toHaveBeenCalled();
  });
});
