import { describe, expect, it } from 'vitest';
import { getReplayGain, normalizeReplayGainSettings, parseReplayGain } from './replayGain';

const track = { mode: 'track' as const, preampDb: 0, preventClipping: true };

describe('ReplayGain', () => {
  it('keeps disabled and untagged playback at unity', () => {
    expect(getReplayGain({ trackGain: -6 }, { ...track, mode: 'off' })).toBe(1);
    expect(getReplayGain(undefined, { ...track, preampDb: 12 })).toBe(1);
    expect(getReplayGain({}, track)).toBe(1);
  });

  it('selects track or album gain, retaining legitimate zero values', () => {
    const tags = { trackGain: -6, albumGain: 0 };
    expect(getReplayGain(tags, track)).toBeCloseTo(10 ** (-6 / 20));
    expect(getReplayGain(tags, { ...track, mode: 'album' })).toBe(1);
  });

  it('falls back to the other gain, then the server fallback', () => {
    expect(getReplayGain({ trackGain: -6 }, { ...track, mode: 'album' })).toBeCloseTo(10 ** (-6 / 20));
    expect(getReplayGain({ albumGain: -3 }, track)).toBeCloseTo(10 ** (-3 / 20));
    expect(getReplayGain({ fallbackGain: -8 }, track)).toBeCloseTo(10 ** (-8 / 20));
  });

  it('adds the preamp and limits gain using the peak for the selected mode', () => {
    expect(getReplayGain({ trackGain: -6 }, { ...track, preampDb: 3 })).toBeCloseTo(10 ** (-3 / 20));
    const tags = { trackGain: 6, trackPeak: 0.8, albumGain: 6, albumPeak: 1.2 };
    expect(getReplayGain(tags, track)).toBeCloseTo(1 / 0.8);
    expect(getReplayGain(tags, { ...track, mode: 'album' })).toBeCloseTo(1 / 1.2);
    expect(getReplayGain(tags, { ...track, preventClipping: false })).toBeCloseTo(10 ** (6 / 20));
    expect(getReplayGain({ trackGain: 6, trackPeak: 0.9 }, { ...track, mode: 'album' })).toBeCloseTo(1 / 0.9);
  });

  it('uses the track peak to protect album mode when album peak is absent', () => {
    expect(getReplayGain({ albumGain: 6, trackPeak: 0.9 }, { ...track, mode: 'album' })).toBeCloseTo(1 / 0.9);
  });

  it('rejects malformed metadata and never produces non-finite gain', () => {
    expect(parseReplayGain(null)).toBeUndefined();
    expect(parseReplayGain({ trackGain: 'bad', albumGain: Infinity, trackPeak: 0, albumPeak: -1 })).toEqual({});
    expect(parseReplayGain({ trackGain: 0, trackPeak: 1, baseGain: 2, fallbackGain: -8, extra: 99 }))
      .toEqual({ trackGain: 0, trackPeak: 1, baseGain: 2, fallbackGain: -8 });
    for (const value of [NaN, Infinity, -Infinity, 1e30, -1e30]) {
      expect(Number.isFinite(getReplayGain({ trackGain: value }, track))).toBe(true);
    }
  });

  it('migrates missing and partial preferences and bounds corrupt preamp values', () => {
    expect(normalizeReplayGainSettings(undefined)).toEqual({ ...track, mode: 'off' });
    expect(normalizeReplayGainSettings({ mode: 'album' })).toEqual({ ...track, mode: 'album' });
    expect(normalizeReplayGainSettings({ mode: 'bad', preampDb: Infinity, preventClipping: 'no' })).toEqual({ ...track, mode: 'off' });
    expect(normalizeReplayGainSettings({ preampDb: 50 }).preampDb).toBe(12);
    expect(normalizeReplayGainSettings({ preampDb: -50 }).preampDb).toBe(-12);
  });
});
