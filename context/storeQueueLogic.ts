import type { ISong, RepeatMode } from '../types';

export const computeNextPlaybackIndex = (
  songIndex: number,
  songQueue: ISong[],
  mode: RepeatMode,
): number => {
  if (songQueue.length === 0) return -1;
  if (songIndex < songQueue.length - 1) return songIndex + 1;
  if (mode === 'ALL') return 0;
  return -1;
};

export const pushNavigationStack = <N>(
  stack: N[],
  entry: N,
  limit = 50,
): N[] => [...stack, entry].slice(-limit);

export const popNavigationStack = <N>(
  stack: N[],
): { stack: N[]; entry: N | undefined } => {
  if (stack.length === 0) return { stack: [], entry: undefined };
  const entry = stack[stack.length - 1];
  return { stack: stack.slice(0, -1), entry };
};
