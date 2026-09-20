/** @vitest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISong } from '../types';
import { PlatformProvider } from '../platform/PlatformContext';
import { StoreProvider, useStore } from './Store';

vi.mock('../services/db', () => ({
  db: {
    init: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    getCredentials: vi.fn(async () => null),
    saveCredentials: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  },
}));

type Store = ReturnType<typeof useStore>;

const queue = Array.from({ length: 8 }, (_, index): ISong => ({
  id: `track-${index + 1}`,
  title: `Track ${index + 1}`,
  artist: 'Test Artist',
  album: 'Test Album',
  duration: 60,
  suffix: 'mp3',
} as ISong));

describe('StoreProvider playback transitions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestStore: Store | undefined;
  let leakedPreloads: number;
  let preloadBlockThreshold: number;
  let blockedMainAudio: HTMLMediaElement | null;
  let playing: WeakMap<HTMLMediaElement, boolean>;

  const Probe = () => {
    latestStore = useStore();
    return null;
  };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    leakedPreloads = 0;
    preloadBlockThreshold = 6;
    blockedMainAudio = null;
    playing = new WeakMap();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function load(this: HTMLMediaElement) {
      const [mainAudio, crossfadeAudio] = document.querySelectorAll('audio');
      if (!this.getAttribute('src')) return;

      if (this === crossfadeAudio) leakedPreloads += 1;
      if (this === mainAudio && leakedPreloads >= preloadBlockThreshold) blockedMainAudio = this;
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function play(this: HTMLMediaElement) {
      if (this === blockedMainAudio) return new Promise<void>(() => undefined);
      playing.set(this, true);
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function pause(this: HTMLMediaElement) {
      playing.set(this, false);
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true,
      get(this: HTMLMediaElement) {
        return !playing.get(this);
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_ENOUGH_DATA,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    latestStore = undefined;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('continues to the eighth track when the main handoff stalls after six songs', async () => {
    await act(async () => {
      root.render(
        <PlatformProvider>
          <StoreProvider>
            <Probe />
          </StoreProvider>
        </PlatformProvider>,
      );
    });

    for (let attempt = 0; attempt < 10 && !latestStore?.isInitialized; attempt += 1) {
      await act(async () => Promise.resolve());
    }
    expect(latestStore?.isInitialized).toBe(true);

    await act(async () => {
      latestStore!.playSong(queue[0], queue);
      await Promise.resolve();
    });

    const [mainAudio, crossfadeAudio] = document.querySelectorAll('audio');
    expect(mainAudio).toBeInstanceOf(HTMLAudioElement);
    expect(crossfadeAudio).toBeInstanceOf(HTMLAudioElement);

    for (let transition = 0; transition < 7; transition += 1) {
      await act(async () => {
        const playbackOwner = playing.get(crossfadeAudio) ? crossfadeAudio : mainAudio;
        playing.set(playbackOwner, false);
        playbackOwner.dispatchEvent(new Event('ended'));
        await Promise.resolve();
      });
      await act(async () => {
        await new Promise(resolve => window.setTimeout(resolve, 220));
      });
    }

    expect(latestStore?.currentSongIndex).toBe(7);
  });

  it('advances when an enabled crossfade ends before the main handoff starts', async () => {
    await act(async () => {
      root.render(
        <PlatformProvider>
          <StoreProvider>
            <Probe />
          </StoreProvider>
        </PlatformProvider>,
      );
    });

    for (let attempt = 0; attempt < 10 && !latestStore?.isInitialized; attempt += 1) {
      await act(async () => Promise.resolve());
    }
    expect(latestStore?.isInitialized).toBe(true);

    await act(async () => {
      latestStore!.playSong(queue[0], queue.slice(0, 3));
      await Promise.resolve();
    });

    preloadBlockThreshold = 1;
    await act(async () => {
      latestStore!.updateSettings({ magicCrossfade: true });
      await Promise.resolve();
    });

    const [mainAudio, crossfadeAudio] = document.querySelectorAll('audio');
    await act(async () => {
      playing.set(mainAudio, false);
      mainAudio.dispatchEvent(new Event('ended'));
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise(resolve => window.setTimeout(resolve, 220));
    });

    expect(latestStore?.currentSongIndex).toBe(1);
    expect(playing.get(crossfadeAudio)).toBe(true);

    await act(async () => {
      playing.set(crossfadeAudio, false);
      crossfadeAudio.dispatchEvent(new Event('ended'));
      await Promise.resolve();
    });

    expect(latestStore?.currentSongIndex).toBe(2);
  });
});
