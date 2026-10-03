/** @vitest-environment jsdom */
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDjSession } from './useDjSession';
import { db } from '../services/db';
import { DEFAULT_LOCAL_DJ } from '../playback/djTypes';
import type { ISong, RepeatMode } from '../types';
import type { Platform } from '../platform/types';
import type { SubsonicService } from '../services/subsonicService';
import type { DjPrepareRequest, DjPreparedAudio } from '../electron/aiDj/localProtocol';

vi.mock('../services/db', () => ({ db: { getListeningEvents: vi.fn(async () => []), getMostPlayed: vi.fn(async () => []), resetDjLearning: vi.fn(async () => {}) } }));
const songs = Array.from({ length: 50 }, (_, index) => ({ id: String(index), title: 'Track ' + index, artist: 'Artist ' + index, duration: 100 } as ISong));
const prepared = (request: DjPrepareRequest): DjPreparedAudio => ({ ...request, text: 'Your next set.', wavBase64: btoa('RIFF audio'), fallback: false });

describe('AI DJ shared playback session', () => {
  let root: Root, container: HTMLDivElement, dj: ReturnType<typeof useDjSession>;
  let index: number, playing: boolean, repeat: RepeatMode;
  let updateIndex: (value: number) => void, updatePlaying: (value: boolean) => void;
  let profile = 'server:alice';
  let settings = { ...DEFAULT_LOCAL_DJ };
  const prepare = vi.fn(async (request: DjPrepareRequest) => prepared(request));
  const cancel = vi.fn(async () => {});
  const restorePosition = vi.fn();
  const stopRadio = vi.fn();
  const gain = { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() };
  const audioContext = { currentTime: 1, destination: {}, createMediaElementSource: () => ({ connect: vi.fn() }), createGain: () => ({ connect: vi.fn(), gain: { value: 1 } }), createAnalyser: () => ({ connect: vi.fn(), fftSize: 0 }) } as unknown as AudioContext;
  const api = { aiDj: { readiness: vi.fn(async () => ({ ready: true })), prepare, cancel, preview: vi.fn() }, settings: { get: vi.fn(async () => ({ local: settings })), set: vi.fn(async () => {}) } } as unknown as Platform;
  const service = { getStarred: vi.fn(async () => ({ songs: [] })), getRandomSongs: vi.fn(async () => songs), searchSongs: vi.fn(async () => songs), getSimilarSongs: vi.fn(async () => songs) } as unknown as SubsonicService;
  function Harness() {
    const [queue, setQueue] = useState([songs[40]]);
    const [currentIndex, setIndex] = useState(0);
    const [isPlaying, setPlaying] = useState(false);
    const [mode, setRepeat] = useState<RepeatMode>('ALL');
    index = currentIndex; playing = isPlaying; repeat = mode;
    updateIndex = setIndex; updatePlaying = setPlaying;
    dj = useDjSession({ platform: api, profile, service, queue, index, playing, repeat, volume: 0.6, setQueue, setIndex, setPlaying, setRepeat, initAudio: async () => {}, context: () => audioContext, musicGain: () => ({ gain } as unknown as GainNode), stopRadio, cancelCrossfade: vi.fn(), getPosition: () => 42, restorePosition });
    return <audio ref={dj.speechRef} />;
  }
  const flush = async () => { await act(async () => { await Promise.resolve(); }); };
  const endVoice = async () => { await act(async () => { container.querySelector('audio')!.dispatchEvent(new Event('ended')); }); };
  const complete = async (count: number) => {
    for (let number = 0; number < count; number++) {
      await act(async () => { const next = index + 1; if (!dj.boundary(true, () => updateIndex(next))) updateIndex(next); });
      await flush();
    }
  };
  beforeEach(async () => {
    vi.clearAllMocks(); settings = { ...DEFAULT_LOCAL_DJ }; profile = 'server:alice';
    prepare.mockImplementation(async request => prepared(request));
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:speech'), revokeObjectURL: vi.fn() }));
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('greets once and plays exactly after five completions, excluding skips', async () => {
    await act(async () => dj.start()); await endVoice(); await flush();
    expect(prepare.mock.calls.filter(([request]) => request.welcome)).toHaveLength(1);
    await act(async () => { expect(dj.boundary(false, vi.fn())).toBe(false); updateIndex(1); });
    await complete(4); expect(dj.state.completed).toBe(4); expect(dj.state.phase).toBe('playing');
    await complete(1); expect(dj.isHolding()).toBe(true); expect(dj.state.phase).toBe('speaking');
    const heldIndex = index; await endVoice(); expect(index).toBe(heldIndex + 1); expect(dj.isHolding()).toBe(false);
    expect(dj.state.completed).toBe(0);
  });

  it('ducks by twelve dB in over-music mode and restores gain on pause, skip and stop', async () => {
    settings = { ...DEFAULT_LOCAL_DJ, interval: 4, style: 'over-music' };
    await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(<Harness />));
    await act(async () => dj.start());
    expect(dj.isHolding()).toBe(false); expect(gain.setTargetAtTime).toHaveBeenCalledWith(10 ** (-12 / 20), 1, 0.08);
    await act(async () => updatePlaying(false)); expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 1, 0.08);
    await act(async () => updatePlaying(true)); await endVoice(); await complete(4);
    expect(dj.state.phase).toBe('speaking'); expect(index).toBe(4);
    await act(async () => { expect(dj.skipInterlude()).toBe(true); });
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 1, 0.08);
    await act(async () => dj.stop()); expect(repeat).toBe('ALL'); expect(cancel).toHaveBeenCalled();
  });

  it('stopping an interlude continues music, and restores the saved queue explicitly', async () => {
    await act(async () => dj.start()); await endVoice(); await complete(5);
    const heldIndex = index; await act(async () => dj.stop());
    expect(index).toBe(heldIndex + 1); expect(dj.state.active).toBe(false);
    await act(async () => dj.restore()); expect(index).toBe(0); expect(restorePosition).toHaveBeenCalledWith(42); expect(stopRadio).toHaveBeenCalledTimes(2);
  });

  it('skips a late interlude and never plays its audio halfway through a track', async () => {
    let resolve!: (audio: DjPreparedAudio) => void;
    prepare.mockImplementation(async request => request.welcome ? prepared(request) : new Promise(result => { resolve = result; }));
    await act(async () => dj.start()); await endVoice(); await complete(5);
    expect(dj.isHolding()).toBe(false); expect(index).toBe(5);
    await act(async () => resolve(prepared({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(), tracks: [], welcome: false, taste: '', voice: 'Michael' })));
    expect(dj.state.phase).toBe('playing');
  });

  it('discards an obsolete greeting after a profile change', async () => {
    let resolve!: (audio: DjPreparedAudio) => void;
    prepare.mockImplementation(request => new Promise(result => { resolve = () => result(prepared(request)); }));
    let start!: Promise<void>;
    await act(async () => { start = dj.start(); });
    profile = 'server:bob'; await act(async () => root.render(<Harness />));
    await act(async () => { resolve({} as DjPreparedAudio); await start; });
    expect(dj.state.active).toBe(false); expect(dj.canRestore).toBe(false); expect(container.querySelector('audio')!.src).toBe('');
  });

  it.each([4, 5] as const)('maintains %i-track cadence for eleven blocks while refilling the queue', async interval => {
    settings = { ...DEFAULT_LOCAL_DJ, interval };
    await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(<Harness />));
    await act(async () => dj.start()); await endVoice();
    for (let block = 0; block < 11; block++) {
      await complete(interval);
      expect(dj.state.phase).toBe('speaking'); expect(dj.state.completed).toBe(0);
      await endVoice(); await flush();
      expect(index).toBe((block + 1) * interval);
    }
    expect(prepare.mock.calls.filter(([request]) => request.welcome)).toHaveLength(1);
  });

  it('does not insert a late greeting if the user starts music while it prepares', async () => {
    let resolve!: () => void;
    prepare.mockImplementation(request => request.welcome ? new Promise(result => { resolve = () => result(prepared(request)); }) : Promise.resolve(prepared(request)));
    let start!: Promise<void>; await act(async () => { start = dj.start(); });
    await act(async () => updatePlaying(true));
    await act(async () => { resolve(); await start; });
    expect(dj.state.phase).toBe('playing'); expect(dj.state.active).toBe(true);
    expect(container.querySelector('audio')!.src).toBe('');
  });

  it('does not queue historical tracks that are absent from current library results', async () => {
    vi.mocked(db.getMostPlayed).mockResolvedValueOnce([{ ...songs[0], id: 'deleted-song' }]);
    await act(async () => dj.start());
    expect(prepare.mock.calls.flatMap(([request]) => request.tracks).some(track => track.id === 'deleted-song')).toBe(false);
    expect(service.searchSongs).toHaveBeenCalled();
  });

  it('interrupts a voice preview before starting a new session', async () => {
    vi.mocked(api.aiDj!.preview).mockResolvedValueOnce(prepared({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(), tracks: [], welcome: true, taste: '', voice: 'Michael' }));
    await act(async () => dj.preview()); expect(dj.state.phase).toBe('speaking');
    let resolve!: () => void;
    prepare.mockImplementation(request => new Promise(result => { resolve = () => result(prepared(request)); }));
    let start!: Promise<void>; await act(async () => { start = dj.start(); });
    expect(container.querySelector('audio')!.src).toBe('');
    await endVoice(); expect(dj.state.phase).toBe('preparing');
    await act(async () => { resolve(); await start; });
    expect(dj.state.active).toBe(true); expect(dj.state.phase).toBe('speaking');
  });
});
