import { describe, expect, it } from 'vitest';
import { ListeningClock } from './listeningClock';
import { selectDjBlock, summarizeTaste } from './djSelection';
import { DEFAULT_LOCAL_DJ, type ListeningEvent } from './djTypes';
import type { ISong } from '../types';
import { djPrepareSchema, parseLocalCommentary } from '../electron/aiDj/localProtocol';
import { desktopSettingsSchema } from '../electron/settingsSchema';

const song = (id: string, artist = id): ISong => ({ id, title: id, artist, genre: 'Jazz', duration: 120 } as ISong);
describe('actual listening clock', () => {
  it('qualifies once based on time heard, excluding seeks and pauses', () => {
    const clock = new ListeningClock(120);
    expect(clock.sample(0, 0, true)).toBe(false);
    clock.sample(59, 250, true, 1, true);
    expect(clock.listened).toBe(0);
    clock.sample(60, 1250, false);
    for (let time = 61; time < 120; time++) clock.sample(time, (time - 60) * 1000 + 1250, true);
    expect(clock.qualified).toBe(false);
    expect(clock.sample(120, 61250, true)).toBe(true);
    expect(clock.sample(121, 62250, true)).toBe(false);
  });
  it('does not turn a stalled stream or a long scheduler gap into listening', () => {
    const clock = new ListeningClock(300); clock.sample(0, 0, true);
    clock.sample(100, 1000, true); clock.sample(101, 10000, true); clock.sample(101, 11000, true);
    expect(clock.listened).toBe(0);
  });
  it('records actual listening seconds when music plays at twice its normal speed', () => {
    const clock = new ListeningClock(120); clock.sample(0, 0, true, 2);
    clock.sample(2, 1000, true, 2);
    expect(clock.listened).toBe(1);
  });
});
describe('personalized blocks', () => {
  it('balances three familiar tracks with two related discoveries', () => {
    const familiar = [song('a'), song('b'), song('c')];
    const selected = selectDjBlock([song('x'), song('y'), ...familiar], familiar, [], DEFAULT_LOCAL_DJ);
    expect(selected.map(song => song.id)).toEqual(['a', 'b', 'c', 'x', 'y']);
  });
  it('avoids duplicates, videos, recent repeats and adjacent artists when possible', () => {
    const selected = selectDjBlock([song('a', 'One'), song('a'), { ...song('v'), isVideo: true }, song('b', 'One'), song('c', 'Two'), song('d'), song('e'), song('f')], [], [], DEFAULT_LOCAL_DJ, ['a']);
    expect(new Set(selected.map(song => song.id)).size).toBe(selected.length);
    expect(selected.some(song => ['a', 'v'].includes(song.id))).toBe(false);
    expect(selected[0].artist).not.toBe(selected[1].artist);
  });
  it('handles short libraries and missing listening history', () => {
    expect(selectDjBlock([song('a')], [], [], DEFAULT_LOCAL_DJ)).toHaveLength(1);
    expect(summarizeTaste([], [], [])).toContain('Still learning');
  });
  it('penalizes quick skips without treating qualified skips as dislikes', () => {
    const event = { id: '1', profile: 'profile', song: song('a'), at: Date.now(), listened: 2, skipped: true, qualified: false, completed: false } satisfies ListeningEvent;
    const pool = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => song(id));
    expect(selectDjBlock(pool, [], [event], DEFAULT_LOCAL_DJ).some(song => song.id === 'a')).toBe(false);
    const later = Array.from({ length: 20 }, (_, index) => ({ ...event, id: 'later' + index, song: song('later' + index), qualified: true, skipped: false }));
    expect(selectDjBlock(pool, [], [{ ...event, qualified: true }, ...later], DEFAULT_LOCAL_DJ)[0].id).toBe('a');
  });
});
describe('local protocol and migration', () => {
  it('keeps old provider configuration inactive and initializes local defaults', () => {
    const parsed = desktopSettingsSchema.parse({ aiDj: { enabled: true, provider: 'custom', model: 'old', baseUrl: 'http://localhost:1111' } });
    expect(parsed.aiDj.model).toBe('old'); expect(parsed.aiDj.local).toEqual(DEFAULT_LOCAL_DJ);
    expect(() => desktopSettingsSchema.parse({ aiDj: { local: { interval: 6 } } })).toThrow();
  });
  it('bounds IPC inputs and rejects arbitrary voices and empty libraries', () => {
    expect(() => djPrepareSchema.parse({ requestId: 'not-an-id' })).toThrow();
    expect(() => djPrepareSchema.parse({ requestId: crypto.randomUUID(), sessionId: crypto.randomUUID(), tracks: [], taste: '', welcome: false, voice: 'custom-path' })).toThrow();
  });
  it('rejects malformed, unbounded and thinking output', () => {
    const body = (content: string) => ({ choices: [{ message: { content } }] });
    expect(parseLocalCommentary(body('{"speech":"Your next set starts here."}'))).toContain('next set');
    for (const content of ['not json', JSON.stringify({ speech: 'a'.repeat(361) }), '{"speech":"<think>Secret</think>"}']) expect(() => parseLocalCommentary(body(content))).toThrow();
  });
});
