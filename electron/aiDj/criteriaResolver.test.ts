import { describe, expect, it, vi } from 'vitest';
import type { ISong } from '../../types';
import { MAX_RESOLVED_TRACKS, resolvePlaylistCriteria, createCriteriaResolver } from './criteriaResolver';
import type { CriteriaResolverDeps } from './criteriaResolver';

const song = (id: string, overrides: Partial<ISong> = {}): ISong => ({
  id,
  title: `Title ${id}`,
  artist: `Artist ${id}`,
  album: `Album ${id}`,
  duration: 200,
  ...overrides,
});

const fakeDeps = (overrides: Partial<CriteriaResolverDeps> = {}): CriteriaResolverDeps => ({
  searchSongs: vi.fn(async () => []),
  getRandomSongs: vi.fn(async () => []),
  ...overrides,
});

describe('resolvePlaylistCriteria', () => {
  it('resolves a query into tracks via searchSongs', async () => {
    const s1 = song('s1');
    const s2 = song('s2');
    const deps = fakeDeps({
      searchSongs: vi.fn(async (query: string, size: number) => {
        expect(query).toBe('neon highway');
        expect(size).toBeGreaterThan(0);
        return [s1, s2];
      }),
    });

    const result = await resolvePlaylistCriteria({ queries: ['neon highway'] }, deps);

    expect(result).toEqual([s1, s2]);
    expect(deps.searchSongs).toHaveBeenCalledTimes(1);
  });

  it('resolves a genre into a batch via getRandomSongs', async () => {
    const s1 = song('s1', { genre: 'Rock' });
    const s2 = song('s2', { genre: 'Rock' });
    const deps = fakeDeps({
      getRandomSongs: vi.fn(async (size: number, params: { genre?: string }) => {
        expect(params.genre).toBe('Rock');
        expect(size).toBeGreaterThan(0);
        return [s1, s2];
      }),
    });

    const result = await resolvePlaylistCriteria({ genres: ['Rock'] }, deps);

    expect(result).toEqual([s1, s2]);
    expect(deps.getRandomSongs).toHaveBeenCalledTimes(1);
    expect(deps.getRandomSongs).toHaveBeenCalledWith(expect.any(Number), { genre: 'Rock' });
  });

  it('skips a criterion that resolves to no tracks without aborting the rest', async () => {
    const s1 = song('s1');
    const deps = fakeDeps({
      searchSongs: vi.fn(async (query: string) => {
        if (query === 'exists') return [s1];
        return [];
      }),
      getRandomSongs: vi.fn(async () => []),
    });

    const result = await resolvePlaylistCriteria(
      { queries: ['unknown-xyz-999', 'exists'], genres: ['NoSuchGenre'] },
      deps,
    );

    expect(result).toEqual([s1]);
    expect(deps.searchSongs).toHaveBeenCalledTimes(2);
    expect(deps.getRandomSongs).toHaveBeenCalledTimes(1);
  });

  it('skips a failing criterion without aborting the batch', async () => {
    const s1 = song('s1');
    const deps = fakeDeps({
      searchSongs: vi.fn(async (query: string) => {
        if (query === 'boom') throw new Error('network');
        return [s1];
      }),
      getRandomSongs: vi.fn(async () => {
        throw new Error('random failed');
      }),
    });

    const result = await resolvePlaylistCriteria(
      { queries: ['boom', 'ok'], genres: ['Jazz'] },
      deps,
    );

    expect(result).toEqual([s1]);
  });

  it('resolves seeds as search queries', async () => {
    const s1 = song('s1');
    const deps = fakeDeps({
      searchSongs: vi.fn(async (query: string) => (query === 'Neon Void' ? [s1] : [])),
    });

    const result = await resolvePlaylistCriteria({ seeds: ['Neon Void'] }, deps);

    expect(result).toEqual([s1]);
    expect(deps.searchSongs).toHaveBeenCalledWith('Neon Void', expect.any(Number));
  });

  it('combines queries, genres, and seeds into a deduped bounded queue', async () => {
    const s1 = song('s1');
    const s2 = song('s2');
    const s3 = song('s3');
    const sDuplicate = song('s1'); // same id as s1

    const deps = fakeDeps({
      searchSongs: vi.fn(async (query: string) => {
        if (query === 'q1') return [s1, sDuplicate];
        if (query === 'seed1') return [s3];
        return [];
      }),
      getRandomSongs: vi.fn(async () => [s2, sDuplicate]),
    });

    const result = await resolvePlaylistCriteria(
      { queries: ['q1'], genres: ['Electronic'], seeds: ['seed1'] },
      deps,
    );

    // Combined flat would be [s1,s1, s2,s1, s3] -> deduped by id => [s1,s2,s3]
    expect(result.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('bounds the returned list to MAX_RESOLVED_TRACKS', async () => {
    const many = Array.from({ length: 30 }, (_, i) => song(`s${i}`));
    const deps = fakeDeps({
      searchSongs: vi.fn(async () => many.slice(0, 10)),
      getRandomSongs: vi.fn(async () => many.slice(10, 20)),
    });

    const result = await resolvePlaylistCriteria(
      { queries: ['a', 'b'], genres: ['Rock', 'Jazz'] },
      deps,
    );

    expect(result.length).toBeLessThanOrEqual(MAX_RESOLVED_TRACKS);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array when no criteria are provided', async () => {
    const deps = fakeDeps();
    const result = await resolvePlaylistCriteria({}, deps);
    expect(result).toEqual([]);
    expect(deps.searchSongs).not.toHaveBeenCalled();
    expect(deps.getRandomSongs).not.toHaveBeenCalled();
  });

  it('exposes createCriteriaResolver injectable seam mirroring llmClient pattern', async () => {
    const s1 = song('s1');
    const deps = fakeDeps({
      searchSongs: vi.fn(async () => [s1]),
    });
    const resolver = createCriteriaResolver(deps);
    const result = await resolver.resolve({ queries: ['anything'] });
    expect(result).toEqual([s1]);
  });

  it('works with a SubsonicService-like object (demo mode shape)', async () => {
    // The real SubsonicService exposes searchSongs/getRandomSongs with same signatures
    const s1 = song('s1');
    const subsonicLike = {
      searchSongs: vi.fn(async () => [s1]),
      getRandomSongs: vi.fn(async () => []),
      getSimilarSongs: vi.fn(async () => []),
      getGenres: vi.fn(async () => ['Rock']),
    } satisfies CriteriaResolverDeps;

    const result = await resolvePlaylistCriteria({ queries: ['test'] }, subsonicLike);
    expect(result).toEqual([s1]);
  });
});
