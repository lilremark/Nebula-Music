import { describe, expect, it } from 'vitest';
import { getBandForPosition, getFrequencyBands } from './visualizerBands';

describe('getFrequencyBands', () => {
  it('maps a silent buffer to near-zero bands', () => {
    const data = new Uint8Array(2048);
    const bands = getFrequencyBands(data, 72, [], 44100);
    expect(bands.every((b) => b === 0)).toBe(true);
  });

  it('does not permanently boost the high-frequency bands', () => {
    const data = new Uint8Array(2048).fill(51); // ~0.2 of full scale
    const bands = getFrequencyBands(data, 72, [], 44100);
    const maxBand = Math.max(...bands);
    expect(maxBand).toBeLessThan(0.6);
  });
});

describe('getBandForPosition', () => {
  it('maps endpoints and midpoints to band indices', () => {
    expect(getBandForPosition(0, 72)).toBe(0);
    expect(getBandForPosition(1, 72)).toBe(71);
    expect(getBandForPosition(0.5, 72)).toBe(35);
  });
});
