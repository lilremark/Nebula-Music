import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('AutoEq index and profile requests', () => {
  it('reads profile preamp values and tolerates missing or malformed headers', async () => {
    const { parseAutoEqFixedBandProfile } = await import('./autoEqService');
    const bands = 'GraphicEQ: 32 -2; 64 -1; 125 1; 250 2; 500 3; 1000 4; 2000 5; 4000 6; 8000 7; 16000 8';
    expect(parseAutoEqFixedBandProfile(`Preamp: -7.3 dB\n${bands}`).preamp).toBe(-7.3);
    expect(parseAutoEqFixedBandProfile(`Preamp: +1.5 dB\n${bands}`).preamp).toBe(1.5);
    expect(parseAutoEqFixedBandProfile(bands).preamp).toBeUndefined();
    expect(parseAutoEqFixedBandProfile(`Preamp: NaN dB\n${bands}`).preamp).toBeUndefined();
    expect(parseAutoEqFixedBandProfile(`Preamp: ${'9'.repeat(400)} dB\n${bands}`).preamp).toBeUndefined();
  });
  it('deduplicates simultaneous index loads and uses the in-memory index afterwards', async () => {
    const localStorage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    vi.stubGlobal('localStorage', localStorage);
    const markdown = Array.from({ length: 101 }, (_, i) => `[Headphone ${i}](./source/Headphone ${i}/README.md)`).join('\n');
    const fetchMock = vi.fn(async () => new Response(markdown));
    vi.stubGlobal('fetch', fetchMock);
    const service = await import('./autoEqService');
    const [first, second] = await Promise.all([service.fetchAutoEqIndex(), service.fetchAutoEqIndex()]);
    expect(first).toHaveLength(101);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await service.searchAutoEqProfiles('Headphone');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem).toHaveBeenCalledTimes(2);
  });

  it('reconstructs cached profile URLs from repository paths instead of trusting stored URLs', async () => {
    const path = 'results/source/Headphone/Headphone FixedBandEQ.txt';
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ fetchedAt: Date.now(), entries: [
      { id: path, name: 'Headphone', source: 'source', path, rawUrl: 'https://attacker.example/profile' },
      { id: 'bad', name: 'Bad', source: 'bad', path: 'results/../outside FixedBandEQ.txt', rawUrl: 'https://attacker.example' },
    ] }) });
    const fetchMock = vi.fn(async () => new Response('GraphicEQ: 32 -2; 64 -1; 125 1; 250 2; 500 3; 1000 4; 2000 5; 4000 6; 8000 7; 16000 8'));
    vi.stubGlobal('fetch', fetchMock);
    const service = await import('./autoEqService');
    const entries = await service.fetchAutoEqIndex();
    expect(entries).toHaveLength(1);
    expect(entries[0].rawUrl).toBe('https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results/source/Headphone/Headphone%20FixedBandEQ.txt');
    const profile = await service.fetchAutoEqProfile({ ...entries[0], rawUrl: 'https://attacker.example' });
    expect(profile.bands['32']).toBe(-2);
    expect(fetchMock).toHaveBeenCalledWith(entries[0].rawUrl, expect.any(Object));
  });
});
