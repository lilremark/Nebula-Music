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
    expect(peaks).toHaveLength(4); // Two peak buckets, each rendered as base and played layers.
    expect((peaks[0] as HTMLElement).style.height).toBe('80%');
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
