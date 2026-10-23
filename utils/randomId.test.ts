import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from './randomId';

afterEach(() => vi.unstubAllGlobals());

describe('browser IDs', () => {
  it('uses the native UUID generator when available', () => {
    const native = vi.fn(() => 'a8954388-73a1-4463-9d8b-3bca81dd668a');
    vi.stubGlobal('crypto', { randomUUID: native });
    expect(randomId()).toBe('a8954388-73a1-4463-9d8b-3bca81dd668a');
    expect(native).toHaveBeenCalledOnce();
  });

  it.each([
    [0, '00000000-0000-4000-8000-000000000000'],
    [255, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
  ] as const)('generates an RFC v4 UUID without randomUUID using byte value %i', (value, expected) => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(value));
    vi.stubGlobal('crypto', { getRandomValues });
    expect(randomId()).toBe(expected);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
  });
});
