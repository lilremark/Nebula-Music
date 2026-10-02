// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopPlaybackBar } from './DesktopPlaybackBar';
import { useTrackWaveform } from '../../hooks/useTrackWaveform';

const { store } = vi.hoisted(() => ({ store: {} as Record<string, any> }));
vi.mock('../../context/Store', () => ({ useStore: () => store }));
vi.mock('../../hooks/useTrackWaveform', () => ({ useTrackWaveform: vi.fn(() => [0.2, 0.8, 0.5, 0.3]) }));

describe('bottom player waveform', () => {
  let container: HTMLDivElement;
  let root: Root;
  let audio: HTMLAudioElement;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    root = createRoot(container);
    audio = document.createElement('audio');
    Object.defineProperty(audio, 'duration', { value: 200 });
    audio.currentTime = 40;
    Object.assign(store, {
      queue: [{ id: 'song', title: 'Track', artist: 'Artist', duration: 200, suffix: 'mp3' }],
      currentSongIndex: 0, currentRadioStation: null, radioMetadata: null,
      isRadioPlaying: false, isPlaying: true, audioRef: { current: audio },
      service: { getCoverArtUrl: vi.fn(() => 'https://music.test/art'), getStreamUrl: vi.fn(() => 'https://music.test/stream') },
      togglePlay: vi.fn(), toggleRadioPlay: vi.fn(), prevSong: vi.fn(), nextSong: vi.fn(),
      settings: { progressVisualization: 'waveform' }, updateSettings: vi.fn(),
      playbackRate: 1, pitch: 0, pitchCorrection: true, setPlaybackRate: vi.fn(), setPitch: vi.fn(), setPitchCorrection: vi.fn(),
      toggleLike: vi.fn(), volume: 0.5, setVolume: vi.fn(), setView: vi.fn(),
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    vi.clearAllMocks(); vi.unstubAllGlobals();
  });
  const render = async () => act(async () => root.render(
    <DesktopPlaybackBar onExpand={vi.fn()} onTogglePanel={vi.fn()} panelOpen={false} />,
  ));

  it('displays loaded peaks and seeks the shared audio element as a percentage of duration', async () => {
    await render();
    expect(useTrackWaveform).toHaveBeenLastCalledWith('song', 'https://music.test/stream');
    const peaks = container.querySelectorAll('.nebula-transport-waveform span');
    expect(peaks).toHaveLength(8); // All four measured peaks in both layers.
    expect((peaks[0] as HTMLElement).style.height).toBe('20%');
    const slider = container.querySelector<HTMLInputElement>('input[aria-label="Playback position"]')!;
    expect(Number(slider.value)).toBe(20);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider, '75');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(audio.currentTime).toBe(150);
    expect(container.textContent).toContain('2:30');
    expect(store.setVolume).not.toHaveBeenCalled();
  });

  it('updates the waveform marker when playback time changes', async () => {
    await render();
    await act(async () => { audio.currentTime = 100; audio.dispatchEvent(new Event('timeupdate')); });
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Playback position"]')!.value).toBe('50');
  });

  it('reads the active audio owner between timeupdate events and cancels animation on unmount', async () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let frame = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { callbacks.set(++frame, callback); return frame; }));
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    await render();
    const replacement = document.createElement('audio');
    replacement.currentTime = 60;
    store.audioRef.current = replacement;
    await act(async () => callbacks.get(1)!(16));
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Playback position"]')!.value).toBe('30');
    await act(async () => root.render(null));
    expect(cancel).toHaveBeenCalledWith(2);
  });

  it('uses existing Store controls for visualization, speed and pitch', async () => {
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Switch to progress bar"]')!.click());
    expect(store.updateSettings).toHaveBeenCalledWith({ progressVisualization: 'bar' });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Speed and pitch controls"]')!.click());
    for (const [label, value, setter] of [['Playback speed', '1.5', store.setPlaybackRate], ['Playback pitch', '-3', store.setPitch]] as const) {
      const slider = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(slider, value);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(setter).toHaveBeenCalledWith(Number(value));
    }
    await act(async () => document.querySelector<HTMLButtonElement>('[data-nebula-speed-pitch] [aria-pressed="true"]')!.click());
    expect(store.setPitchCorrection).toHaveBeenCalledWith(false);
    store.settings.progressVisualization = 'bar';
    await render();
    expect(useTrackWaveform).toHaveBeenLastCalledWith('song', null);
  });

  it('steps speed and pitch by tenths, respects limits, and dismisses with Escape', async () => {
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Speed and pitch controls"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Increase speed"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Decrease pitch"]')!.click());
    expect(store.setPlaybackRate).toHaveBeenLastCalledWith(1.1);
    expect(store.setPitch).toHaveBeenLastCalledWith(-0.1);
    store.pitch = 11.9;
    await render();
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Increase pitch"]')!.click());
    expect(store.setPitch).toHaveBeenLastCalledWith(12);
    store.pitch = 12; store.playbackRate = 0.5;
    await render();
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Increase pitch"]')!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Decrease speed"]')!.disabled).toBe(true);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[data-nebula-speed-pitch]')).toBeNull();
  });

  it('keeps live radio unseekable and avoids track waveform requests', async () => {
    store.currentRadioStation = { id: 'radio', name: 'Live radio', streamUrl: 'https://radio.test/live' };
    await render();
    expect(useTrackWaveform).toHaveBeenLastCalledWith(undefined, null);
    expect(store.service.getStreamUrl).not.toHaveBeenCalled();
    expect(container.querySelector('.nebula-transport-waveform')).toBeNull();
    expect(container.querySelector('input[aria-label="Playback position"]')).toBeNull();
    expect(container.textContent).toContain('LIVE');
  });
});
