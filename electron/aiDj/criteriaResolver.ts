import type { PlaylistCriteria } from './llmClient';
import type { ISong } from '../../types';

export const MAX_RESOLVED_TRACKS = 15;
const PER_QUERY_LIMIT = 3;
const PER_GENRE_LIMIT = 5;
const PER_SEED_LIMIT = 3;

export interface CriteriaResolverDeps {
  searchSongs(query: string, size: number): Promise<ISong[]>;
  getRandomSongs(size: number, params: { genre?: string }): Promise<ISong[]>;
  getSimilarSongs?(id: string, count: number): Promise<ISong[]>;
  getGenres?(): Promise<string[]>;
}

const dedupeById = (songs: ISong[]): ISong[] => {
  const seen = new Set<string>();
  const out: ISong[] = [];
  for (const s of songs) {
    if (!s?.id || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
};

const safeSearch = async (
  deps: CriteriaResolverDeps,
  query: string,
  size: number,
): Promise<ISong[]> => {
  try {
    const res = await deps.searchSongs(query, size);
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
};

const safeRandomByGenre = async (
  deps: CriteriaResolverDeps,
  genre: string,
  size: number,
): Promise<ISong[]> => {
  try {
    const res = await deps.getRandomSongs(size, { genre });
    return Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
};

/**
 * Resolves LLM-shaped playlist criteria into real tracks via the Subsonic
 * service. Each criterion is resolved independently; failures or empty
 * results are skipped without aborting the batch. The combined list is
 * deduped by id and bounded to MAX_RESOLVED_TRACKS.
 *
 * Injectable seam: pass any object that satisfies CriteriaResolverDeps —
 * the real SubsonicService in the app, or a fake in tests/demo.
 */
export const resolvePlaylistCriteria = async (
  criteria: PlaylistCriteria,
  deps: CriteriaResolverDeps,
): Promise<ISong[]> => {
  const queries = (criteria.queries ?? []).map((q) => q.trim()).filter(Boolean);
  const genres = (criteria.genres ?? []).map((g) => g.trim()).filter(Boolean);
  const seeds = (criteria.seeds ?? []).map((s) => s.trim()).filter(Boolean);

  const batches: Promise<ISong[]>[] = [];

  for (const q of queries) {
    batches.push(safeSearch(deps, q, PER_QUERY_LIMIT));
  }
  for (const genre of genres) {
    batches.push(safeRandomByGenre(deps, genre, PER_GENRE_LIMIT));
  }
  for (const seed of seeds) {
    batches.push(safeSearch(deps, seed, PER_SEED_LIMIT));
  }

  if (batches.length === 0) return [];

  const results = await Promise.all(batches);
  const combined = results.flat();
  const deduped = dedupeById(combined);
  return deduped.slice(0, MAX_RESOLVED_TRACKS);
};

export const createCriteriaResolver = (deps: CriteriaResolverDeps) => ({
  resolve: (criteria: PlaylistCriteria) => resolvePlaylistCriteria(criteria, deps),
});
