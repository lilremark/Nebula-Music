import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAutoEqFixedBandProfile,
  fetchAutoEqIndex,
  searchAutoEqProfiles,
  fetchAutoEqProfile,
} from './autoEqService';

const PROFILE = [
  'Preamp: -6.2 dB',
  'Filter 1: ON PK Fc 31 Hz Gain 3.0 dB Q 1.41',
  'Filter 2: ON PK Fc 64 Hz Gain -2.5 dB Q 1.41',
  'Filter 3: ON PK Fc 125 Hz Gain 1.0 dB Q 1.41',
  'Filter 4: ON PK Fc 250 Hz Gain -1.5 dB Q 1.41',
  'Filter 5: ON PK Fc 500 Hz Gain 2.0 dB Q 1.41',
  'Filter 6: ON PK Fc 1000 Hz Gain -3.0 dB Q 1.41',
  'Filter 7: ON PK Fc 2000 Hz Gain 4.0 dB Q 1.41',
  'Filter 8: ON PK Fc 4000 Hz Gain -1.0 dB Q 1.41',
  'Filter 9: ON PK Fc 8000 Hz Gain 0.5 dB Q 1.41',
  'Filter 10: ON PK Fc 16000 Hz Gain -0.2 dB Q 1.41',
].join('\n');

const STORE: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => STORE[k] ?? null,
    setItem: (k: string, v: string) => { STORE[k] = v; },
    removeItem: (k: string) => { delete STORE[k]; },
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => { vi.unstubAllGlobals(); Object.keys(STORE).forEach((k) => delete STORE[k]); });

if (!globalThis.Response) {
  class FakeResponse {
    ok: boolean; status: number; text: () => Promise<string>;
    constructor(body: string, init: { status: number }) {
      this.ok = init.status >= 200 && init.status < 300;
      this.status = init.status;
      this.text = async () => body;
    }
  }
  vi.stubGlobal('Response', FakeResponse);
}

describe('autoEqService', () => {
  it('throws when a profile has too few bands', () => {
    expect(() => parseAutoEqFixedBandProfile('Preamp: -6.0 dB')).toThrow(/not contain enough fixed-band/i);
  });

  it('parses a fixed-band profile into 10 clamped bands with a preamp', () => {
    const { bands, preamp, raw } = parseAutoEqFixedBandProfile(PROFILE);
    expect(Object.keys(bands)).toHaveLength(10);
    expect(bands['32']).toBe(3);
    expect(bands['64']).toBe(-2);
    expect(bands['1k']).toBe(-3);
    expect(bands['16k']).toBe(-0);
    expect(preamp).toBe(-6.2);
    expect(raw).toBe(PROFILE);
  });

  it('clamps gains to [-12, 12]', () => {
    const profile = PROFILE.replace('Gain 3.0 dB', 'Gain 30.0 dB');
    const { bands } = parseAutoEqFixedBandProfile(profile);
    expect(bands['32']).toBe(12);
  });

  it('parses a GraphicEQ pair format when present', () => {
    const eq = ['Preamp: -2.0 dB', 'GraphicEQ: 31 -2.2; 64 1.1; 125 0.0; 250 -1.0; 500 2.2; 1000 -0.5; 2000 0.8; 4000 -2.0; 8000 1.5; 16000 0.3'].join('\n');
    const { preamp, bands } = parseAutoEqFixedBandProfile(eq);
    expect(preamp).toBe(-2.0);
    expect(bands['32']).toBe(-2);
  });

  it('searchAutoEqProfiles returns [] for queries shorter than 2 chars', async () => {
    expect(await searchAutoEqProfiles('a')).toEqual([]);
  });

  it('fetchAutoEqProfile throws on a non-ok response', async () => {
    const t = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    t.mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(fetchAutoEqProfile({ id: 'x', name: 'x', source: 'x', path: 'results/x', rawUrl: 'https://x' }))
      .rejects.toThrow(/request failed \(500\)/);
  });

  it('fetchAutoEqIndex reads from localStorage cache when fresh', async () => {
    const t = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const entries = [{ id: 'a', name: 'A', source: 's', path: 'results/a FixedBandEQ.txt', rawUrl: 'https://r' }];
    STORE['nebula_autoeq_index_v2'] = JSON.stringify({ fetchedAt: Date.now(), entries });
    t.mockRejectedValue(new Error('should not be called'));
    expect(await fetchAutoEqIndex()).toEqual(entries);
    expect(t).not.toHaveBeenCalled();
  });
});
