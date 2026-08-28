import { describe, expect, it } from 'vitest';
import type { ISong } from '../types';
import { containsSameSongs } from './playback';

const song = (id: string): ISong => ({ id, title: id, artist: 'x' }) as ISong;

describe('containsSameSongs', () => {
  it('returns true when both queues contain the same songs regardless of order', () => {
    expect(containsSameSongs([song('a'), song('b')], [song('b'), song('a')])).toBe(true);
  });

  it('returns true for duplicate ids and empty queues', () => {
    expect(containsSameSongs([], [])).toBe(true);
    expect(containsSameSongs([song('a'), song('a')], [song('a'), song('a')])).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(containsSameSongs([song('a')], [song('a'), song('b')])).toBe(false);
  });

  it('returns false when ids differ', () => {
    expect(containsSameSongs([song('a')], [song('b')])).toBe(false);
  });
});
