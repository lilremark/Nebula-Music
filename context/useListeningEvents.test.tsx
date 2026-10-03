/** @vitest-environment jsdom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useListeningEvents } from './useListeningEvents';
import { db } from '../services/db';
import type { ISong } from '../types';
vi.mock('../services/db', () => ({ db: { addListeningEvent: vi.fn(async () => {}) } }));

describe('shared listening events', () => {
  let root: Root, container: HTMLDivElement, audio: HTMLAudioElement;
  let paused: boolean, ended: boolean, profile: string;
  let listening: ReturnType<typeof useListeningEvents>;
  const onQualified = vi.fn();
  const song = { id: 'one', duration: 120 } as ISong;
  function Harness() { listening = useListeningEvents({ profile, song, playing: true, owner: () => audio, onQualified }); return null; }
  const heard = async (seconds: number) => {
    await act(async () => { for (let index = 0; index < seconds * 4; index++) { audio.currentTime += 0.25; vi.advanceTimersByTime(250); } });
  };
  beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] }); vi.clearAllMocks();
    profile = 'server:alice'; paused = false; ended = false; audio = document.createElement('audio');
    Object.defineProperties(audio, { paused: { get: () => paused }, ended: { get: () => ended } });
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
  it('qualifies once and never creates a second completion while ended audio waits for an interlude', async () => {
    await heard(61); expect(onQualified).toHaveBeenCalledTimes(1);
    expect(listening.finish(true)).toBe(true); paused = true; ended = true;
    await act(async () => vi.advanceTimersByTime(2000));
    expect(listening.finish(true)).toBe(false); expect(db.addListeningEvent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.addListeningEvent).mock.calls[0][0]).toMatchObject({ qualified: true, completed: true, skipped: false });
  });
  it('excludes native seeking and records a natural ending independently of qualification', async () => {
    await heard(1); audio.currentTime = 119;
    audio.dispatchEvent(new Event('seeking')); audio.dispatchEvent(new Event('seeked'));
    expect(listening.finish(true)).toBe(true);
    expect(vi.mocked(db.addListeningEvent).mock.calls[0][0]).toMatchObject({ listened: 0.75, qualified: false, completed: true });
  });
  it('separates profile events while retaining explicit skips as taste evidence', async () => {
    await heard(2); listening.finish(false, true);
    profile = 'server:bob'; await act(async () => root.render(<Harness />)); await heard(2);
    listening.finish();
    expect(vi.mocked(db.addListeningEvent).mock.calls.map(([event]) => [event.profile, event.skipped])).toEqual([['server:alice', true], ['server:bob', false]]);
  });
});
