import { describe, expect, it } from 'vitest';
import { isLocalDjPlatform } from './aiDjAvailability';

describe('local AI DJ platform availability', () => {
  it.each([
    ['desktop', 'win32', true],
    ['desktop', 'darwin', false],
    ['desktop', 'linux', false],
    ['web', 'web', false],
    ['web', 'win32', false],
  ] as const)('%s on %s exposes AI DJ: %s', (kind, os, expected) => {
    expect(isLocalDjPlatform({ kind, os })).toBe(expected);
  });

  it('stays disabled while platform initialization is pending', () => {
    expect(isLocalDjPlatform(null)).toBe(false);
    expect(isLocalDjPlatform(undefined)).toBe(false);
  });
});
