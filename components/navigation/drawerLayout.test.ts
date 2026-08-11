import { describe, expect, it } from 'vitest';
import { getNavDrawerTopClass } from './drawerLayout';

describe('getNavDrawerTopClass', () => {
  it.each([
    ['darwin', 'top-8'],
    ['win32', 'top-0'],
    ['linux', 'top-0'],
    [undefined, 'top-0'],
  ] as const)('maps %s to %s', (os, expected) => {
    expect(getNavDrawerTopClass(os)).toBe(expected);
  });
});
