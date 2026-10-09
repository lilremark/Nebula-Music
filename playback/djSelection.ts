import type { ISong } from '../types';
import type { DjLocalSettings, ListeningEvent } from './djTypes';

export function summarizeTaste(events: ListeningEvent[], favorites: ISong[], frequent: ISong[]): string {
  const recent = events.filter(event => event.qualified).slice(-100).map(event => event.song);
  const weighted = [...recent, ...favorites, ...frequent];
  if (!weighted.length) return 'Still learning your taste; exploring variety in your library.';
  const tally = (key: 'artist' | 'genre') => {
    const counts = new Map<string, number>();
    for (const song of weighted) if (song[key]) counts.set(song[key]!, (counts.get(song[key]!) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(entry => entry[0]).join(', ');
  };
  const learning = recent.length < 5 && !frequent.length ? 'Still learning your taste. ' : '';
  const skips = events.filter(event => event.skipped && !event.qualified).slice(-20).length;
  return (learning + ['Frequent artists: ' + tally('artist'), 'Genres: ' + (tally('genre') || 'not tagged'), 'Based on qualified listening and likes', ...(skips ? [String(skips) + ' recent quick skips help avoid repeats'] : [])].join('. ') + '.').slice(0, 1200);
}

export function selectDjBlock(pool: ISong[], familiar: ISong[], events: ListeningEvent[], settings: DjLocalSettings, recentIds: string[] = []): ISong[] {
  const recent = new Set([...events.filter(event => event.qualified).slice(-20).map(event => event.song.id), ...recentIds.slice(-20)]);
  const skipped = new Set(events.filter(event => event.skipped && !event.qualified && Date.now() - event.at < 7 * 86400000).map(event => event.song.id));
  const known = new Set(familiar.map(song => song.id));
  const songs = [...new Map([...pool, ...familiar].filter(song => song?.id && !song.isVideo).map(song => [song.id, song])).values()];
  const preferred = songs.filter(song => !recent.has(song.id) && !skipped.has(song.id));
  const candidates = preferred.length >= settings.interval ? preferred : [...preferred, ...songs.filter(song => !preferred.includes(song))];
  const targetKnown = Math.round(settings.interval * ({ familiar: 0.8, balanced: 0.6, discover: 0.2 }[settings.discovery]));
  const output: ISong[] = [];
  for (let i = 0; i < settings.interval; i++) {
    const wantsKnown = i < targetKnown;
    const available = candidates.filter(song => !output.some(selected => selected.id === song.id));
    const differentArtist = available.filter(song => song.artist !== output.at(-1)?.artist);
    const choices = differentArtist.length ? differentArtist : available;
    const selected = choices.find(song => known.has(song.id) === wantsKnown) || choices[0];
    if (!selected) break;
    output.push(selected);
  }
  return output;
}
