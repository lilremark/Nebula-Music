// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioProgress, type AudioProgressState } from './useAudioProgress';

describe('useAudioProgress', () => {
  let container: HTMLDivElement;
  let root: Root;
  let audio: HTMLAudioElement;
  const audioRef: { current: HTMLAudioElement | null } = { current: null };
  let latest: AudioProgressState;
  let renders = 0;
  let visibility: DocumentVisibilityState = 'visible';

  const Probe = ({ options }: { options?: Parameters<typeof useAudioProgress>[1] }) => {
    renders += 1;
    latest = useAudioProgress(audioRef, options);
    return null;
  };
  const mount = (options?: Parameters<typeof useAudioProgress>[1]) => act(async () => root.render(<Probe options={options} />));
  const emit = (type: string) => act(async () => { audio.dispatchEvent(new Event(type)); });

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    container = document.createElement('div');
    root = createRoot(container);
    audio = document.createElement('audio');
    audioRef.current = audio;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 200 });
    renders = 0;
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  });

  it('reads position and duration on mount and on media events', async () => {
    audio.currentTime = 12;
    await mount();
    expect(latest).toMatchObject({ currentTime: 12, duration: 200 });
    audio.currentTime = 30;
    await emit('timeupdate');
    expect(latest.currentTime).toBe(30);
    Object.defineProperty(audio, 'duration', { configurable: true, value: 240 });
    await emit('durationchange');
    expect(latest.duration).toBe(240);
  });

  it('skips re-renders when nothing changed', async () => {
    await mount();
    const before = renders;
    for (let i = 0; i < 5; i += 1) await emit('timeupdate');
    // React may render once more before bailing out of an identical state update.
    expect(renders - before).toBeLessThanOrEqual(1);
  });

  it('does no work while hidden and resyncs when visible again', async () => {
    await mount();
    visibility = 'hidden';
    const before = renders;
    audio.currentTime = 90;
    await emit('timeupdate');
    expect(renders).toBe(before);
    expect(latest.currentTime).toBe(0);
    visibility = 'visible';
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(latest.currentTime).toBe(90);
  });

  it('uses the fallback duration until the element knows its length', async () => {
    Object.defineProperty(audio, 'duration', { configurable: true, value: Number.NaN });
    await mount({ fallbackDuration: 180 });
    expect(latest.duration).toBe(180);
  });

  it('attaches nothing when disabled and detaches on unmount', async () => {
    const add = vi.spyOn(audio, 'addEventListener');
    await mount({ enabled: false });
    expect(add).not.toHaveBeenCalled();
    await mount();
    const remove = vi.spyOn(audio, 'removeEventListener');
    await act(async () => root.render(null));
    expect(remove).toHaveBeenCalledWith('timeupdate', expect.any(Function));
  });

  it('shows an optimistic position while seeking', async () => {
    await mount();
    await act(async () => latest.setCurrentTime(150));
    expect(latest.currentTime).toBe(150);
  });
});
