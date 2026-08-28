import type { ISong } from '../types';
import { describe, expect, it } from 'vitest';
import { computeNextPlaybackIndex, pushNavigationStack, popNavigationStack } from './storeQueueLogic';

const song = (id: string): ISong => ({ id, title: id, album: '', artist: '', duration: 1 } as ISong);
const queue = (n: number): ISong[] => Array.from({ length: n }, (_, i) => song(String(i)));

describe('computeNextPlaybackIndex', () => {
  it('returns -1 for an empty queue', () => {
    expect(computeNextPlaybackIndex(0, [], 'OFF')).toBe(-1);
  });

  it('advances to the next index in the middle of the queue', () => {
    expect(computeNextPlaybackIndex(0, queue(3), 'OFF')).toBe(1);
  });

  it('wraps to 0 at the end when repeat is ALL', () => {
    expect(computeNextPlaybackIndex(2, queue(3), 'ALL')).toBe(0);
  });

  it('returns -1 at the end when repeat is OFF or ONE', () => {
    expect(computeNextPlaybackIndex(2, queue(3), 'OFF')).toBe(-1);
    expect(computeNextPlaybackIndex(2, queue(3), 'ONE')).toBe(-1);
  });
});

describe('pushNavigationStack', () => {
  it('appends an entry and bounds the stack to the limit', () => {
    const stack = pushNavigationStack([1, 2], 3, 3);
    expect(stack).toEqual([1, 2, 3]);
  });
});

describe('popNavigationStack', () => {
  it('pops the last entry and returns the remaining stack', () => {
    expect(popNavigationStack([{ view: 'A' }, { view: 'B' }])).toEqual(
      { stack: [{ view: 'A' }], entry: { view: 'B' } },
    );
  });

  it('returns an empty stack and no entry when empty', () => {
    expect(popNavigationStack([])).toEqual({ stack: [], entry: undefined });
  });
});
