/** @vitest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISong } from '../types';
import { PlatformProvider } from '../platform/PlatformContext';
import { StoreProvider, useStore } from './Store';
import { db } from '../services/db';

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

const mockAudioGraph = () => {
  const param = () => ({ value: 0, cancelScheduledValues: vi.fn(), cancelAndHoldAtTime: vi.fn(), setTargetAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const gains: Array<ReturnType<typeof node> & { gain: ReturnType<typeof param> }> = [];
  const filters: Array<ReturnType<typeof node> & { gain: ReturnType<typeof param> }> = [];
  const sources: Array<ReturnType<typeof node> & { mediaElement: HTMLMediaElement }> = [];
  const analyser = { ...node(), fftSize: 0, smoothingTimeConstant: 0 };
  class MockAudioContext {
    currentTime = 4;
    state = 'running';
    destination = node();
    createGain() { const result = { ...node(), gain: param() }; gains.push(result); return result; }
    createBiquadFilter() {
      const result = { ...node(), type: 'peaking', frequency: param(), Q: param(), gain: param() };
      filters.push(result);
      return result;
    }
    createDynamicsCompressor() {
      return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() };
    }
    createAnalyser() { return analyser; }
    createMediaElementSource(mediaElement: HTMLMediaElement) {
      const result = { ...node(), mediaElement }; sources.push(result); return result;
    }
  }
  vi.stubGlobal('AudioContext', MockAudioContext);
  return { gains, filters, sources, analyser };
};

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
  let mediaReadyState: number;

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
    mediaReadyState = HTMLMediaElement.HAVE_ENOUGH_DATA;
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
      get: () => mediaReadyState,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    latestStore = undefined;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  const mountStore = async () => {
    await act(async () => {
      root.render(<PlatformProvider><StoreProvider><Probe /></StoreProvider></PlatformProvider>);
    });
    for (let attempt = 0; attempt < 10 && !latestStore?.isInitialized; attempt += 1) {
      await act(async () => Promise.resolve());
    }
    expect(latestStore?.isInitialized).toBe(true);
  };

  const applyAutoEq = async (preamp: number) => {
    await act(async () => latestStore!.updateSettings({ eq: {
      ...latestStore!.settings.eq, enabled: true, preset: 'custom',
      autoEq: { name: 'Headphones', source: 'Test', path: 'Test', preamp, appliedAt: 0 },
      bands: { ...latestStore!.settings.eq.bands, '2k': 6 },
    } }));
  };

  it('routes music, crossfade, and radio through one preamp before the filters', async () => {
    const graph = mockAudioGraph();
    await mountStore();
    await applyAutoEq(-7);
    await act(async () => latestStore!.updateSettings({ magicCrossfade: true }));
    await act(async () => latestStore!.playSong(queue[0], queue));
    const [mainAudio, crossfadeAudio, radioAudio] = document.querySelectorAll('audio');
    await act(async () => mainAudio.dispatchEvent(new Event('ended')));
    vi.stubGlobal('fetch', vi.fn(async () => ({ headers: new Headers(), body: new ReadableStream() })));
    await act(async () => latestStore!.playRadioStation({
      id: 'station', name: 'Live', streamUrl: 'https://radio.example/live', created: '2026-09-30',
    }));
    expect(graph.gains).toHaveLength(2);
    const [input, preamp] = graph.gains;
    expect(input.connect).toHaveBeenCalledWith(preamp);
    expect(input.connect).toHaveBeenCalledWith(graph.analyser);
    expect(preamp.connect).toHaveBeenCalledWith(graph.filters[0]);
    expect(preamp.gain.value).toBeCloseTo(10 ** (-7 / 20));
    expect(graph.filters[6].gain.setTargetAtTime).toHaveBeenLastCalledWith(6, 4, 0.015);
    for (const audio of [mainAudio, crossfadeAudio, radioAudio]) {
      expect(graph.sources.find(source => source.mediaElement === audio)?.connect).toHaveBeenCalledWith(input);
    }
  });

  it('changes preamp live, bypasses and restores it, and clears it without changing volume or bands', async () => {
    const graph = mockAudioGraph();
    await mountStore();
    await act(async () => latestStore!.playSong(queue[0], queue));
    await act(async () => latestStore!.setVolume(0.4));
    await applyAutoEq(-6);
    const preamp = graph.gains[1].gain;
    expect(preamp.setTargetAtTime).toHaveBeenLastCalledWith(10 ** (-6 / 20), 4, 0.015);
    await applyAutoEq(-9);
    expect(preamp.setTargetAtTime).toHaveBeenLastCalledWith(10 ** (-9 / 20), 4, 0.015);
    await act(async () => latestStore!.updateSettings({ eq: { ...latestStore!.settings.eq, enabled: false } }));
    expect(preamp.setTargetAtTime).toHaveBeenLastCalledWith(1, 4, 0.015);
    expect(graph.filters[6].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 4, 0.015);
    await act(async () => latestStore!.updateSettings({ eq: { ...latestStore!.settings.eq, enabled: true } }));
    expect(preamp.setTargetAtTime).toHaveBeenLastCalledWith(10 ** (-9 / 20), 4, 0.015);
    await act(async () => latestStore!.updateSettings({ eq: { ...latestStore!.settings.eq, autoEq: null } }));
    expect(preamp.setTargetAtTime).toHaveBeenLastCalledWith(1, 4, 0.015);
    expect(latestStore!.settings.eq.bands['2k']).toBe(6);
    expect(latestStore!.volume).toBe(0.4);
    expect(document.querySelector('audio')!.volume).toBe(0.4);
    expect(graph.gains).toHaveLength(2);
  });

  it('starts with the persisted profile preamp and removes it when choosing a built-in preset', async () => {
    const graph = mockAudioGraph();
    vi.mocked(db.get).mockResolvedValueOnce({ eq: {
      enabled: true, preset: 'custom', bands: { '2k': 6 },
      autoEq: { name: 'Saved', source: 'Test', path: 'Test', preamp: -8, appliedAt: 0 },
    } });
    await mountStore();
    await act(async () => latestStore!.playSong(queue[0], queue));
    expect(graph.gains[1].gain.value).toBeCloseTo(10 ** (-8 / 20));
    await act(async () => latestStore!.updateSettings({ eq: { ...latestStore!.settings.eq, preset: 'flat' } }));
    expect(latestStore!.settings.eq.autoEq).toBeNull();
    expect(graph.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 4, 0.015);
  });

  it('does not preload another stream when crossfade is disabled', async () => {
    await mountStore();
    await act(async () => latestStore!.playSong(queue[0], queue));
    expect(leakedPreloads).toBe(0);
    expect(document.querySelectorAll('audio')[1].getAttribute('src')).toBeNull();
  });

  it('removes a pending handoff listener when the user selects a different song', async () => {
    await mountStore();
    await act(async () => latestStore!.updateSettings({ magicCrossfade: true }));
    await act(async () => latestStore!.playSong(queue[0], queue));
    const [mainAudio, crossfadeAudio] = document.querySelectorAll('audio');
    crossfadeAudio.currentTime = 10;
    mediaReadyState = 0;
    await act(async () => mainAudio.dispatchEvent(new Event('ended')));
    expect(latestStore?.currentSongIndex).toBe(1);
    await act(async () => latestStore!.playSong(queue[4], queue));
    mainAudio.currentTime = 0;
    const playCalls = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    await act(async () => mainAudio.dispatchEvent(new Event('loadedmetadata')));
    expect(mainAudio.currentTime).toBe(0);
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length).toBe(playCalls);
  });

  it('does not let an old handoff timer stop the next selected track preload', async () => {
    await mountStore();
    await act(async () => latestStore!.updateSettings({ magicCrossfade: true }));
    await act(async () => latestStore!.playSong(queue[0], queue));
    const [mainAudio, crossfadeAudio] = document.querySelectorAll('audio');
    await act(async () => mainAudio.dispatchEvent(new Event('ended')));
    await act(async () => latestStore!.playSong(queue[4], queue));
    await act(async () => new Promise(resolve => window.setTimeout(resolve, 220)));
    expect(crossfadeAudio.dataset.nebulaSongId).toBe(queue[5].id);
  });

  it('releases a radio metadata connection when the stream has no ICY headers', async () => {
    await mountStore();
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return { headers: new Headers(), body: new ReadableStream() };
    }));
    await act(async () => latestStore!.playRadioStation({
      id: 'station', name: 'Live', streamUrl: 'https://radio.example/live', created: '2026-09-30',
    }));
    expect(signal?.aborted).toBe(true);
    expect(latestStore?.isRadioMetadataLoading).toBe(false);
  });

  it('keeps the latest search results when older requests finish later', async () => {
    await mountStore();
    let resolveFirst!: (value: { artists: []; albums: []; songs: ISong[] }) => void;
    let resolveSecond!: typeof resolveFirst;
    vi.spyOn(latestStore!.service, 'search')
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
    await act(async () => { latestStore!.performSearch('old'); latestStore!.performSearch('new'); });
    await act(async () => resolveSecond({ artists: [], albums: [], songs: [queue[1]] }));
    await act(async () => resolveFirst({ artists: [], albums: [], songs: [queue[0]] }));
    expect(latestStore?.lastSearchQuery).toBe('new');
    expect(latestStore?.searchResults.songs).toEqual([queue[1]]);
    expect(latestStore?.isSearching).toBe(false);
  });

  it('clears the search loading state on a failed request', async () => {
    await mountStore();
    vi.spyOn(latestStore!.service, 'search').mockRejectedValue(new Error('offline'));
    await act(async () => latestStore!.performSearch('unavailable'));
    expect(latestStore?.isSearching).toBe(false);
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
