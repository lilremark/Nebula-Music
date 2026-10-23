import { describe, expect, it, vi } from 'vitest';
import { observeMusicStatus } from './musicStatus';

class Media extends EventTarget {
  paused = true;
  readyState = 0;
  currentTime = 0;
  error: { code: number } | null = null;
}

describe('music playback status', () => {
  it('shows loading before playback, buffering on underruns, and clears only once playback resumes', () => {
    const audio = new Media();
    const update = vi.fn();
    const stop = observeMusicStatus([audio], () => audio, update);
    expect(update).toHaveBeenLastCalledWith('loading');
    audio.paused = false;
    audio.readyState = 4;
    audio.dispatchEvent(new Event('playing'));
    expect(update).toHaveBeenLastCalledWith('idle');
    audio.currentTime = 12;
    audio.readyState = 2;
    audio.dispatchEvent(new Event('waiting'));
    expect(update).toHaveBeenLastCalledWith('buffering');
    audio.dispatchEvent(new Event('loadedmetadata'));
    expect(update).toHaveBeenLastCalledWith('buffering');
    audio.readyState = 3;
    audio.dispatchEvent(new Event('canplay'));
    expect(update).toHaveBeenLastCalledWith('idle');
    stop();
    audio.dispatchEvent(new Event('waiting'));
    expect(update).toHaveBeenLastCalledWith('idle');
  });

  it('ignores background preloading and buffered stalls, but follows the active crossfade owner', () => {
    const primary = new Media();
    const crossfade = new Media();
    primary.readyState = 4;
    primary.paused = false;
    let active = primary;
    const update = vi.fn();
    observeMusicStatus([primary, crossfade], () => active, update);
    crossfade.dispatchEvent(new Event('waiting'));
    primary.dispatchEvent(new Event('stalled'));
    expect(update).toHaveBeenLastCalledWith('idle');
    active = crossfade;
    crossfade.dispatchEvent(new Event('waiting'));
    expect(update).toHaveBeenLastCalledWith('loading');
    crossfade.paused = false;
    crossfade.readyState = 4;
    crossfade.dispatchEvent(new Event('playing'));
    expect(update).toHaveBeenLastCalledWith('idle');
    primary.dispatchEvent(new Event('error'));
    expect(update).toHaveBeenLastCalledWith('idle');
    crossfade.error = { code: 3 };
    crossfade.dispatchEvent(new Event('error'));
    expect(update).toHaveBeenLastCalledWith('error');
    crossfade.dispatchEvent(new Event('timeupdate'));
    crossfade.dispatchEvent(new Event('pause'));
    expect(update).toHaveBeenLastCalledWith('error');
  });
});
