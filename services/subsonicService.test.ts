import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsonicService } from './subsonicService';
import type { SubsonicTransport } from './subsonicTransport';
import type { SubsonicCredentials } from '../types';

const makeTransport = () => {
  const resolveMediaUrl = vi.fn((u: string) => u);
  const fetchJson = vi.fn(async () => ({ status: 200, statusText: '', ok: true, body: {} }));
  return { resolveMediaUrl, fetchJson } as unknown as SubsonicTransport;
};

const creds: SubsonicCredentials = {
  serverUrl: 'https://music.example',
  username: 'user',
  token: 'tok',
  salt: 'salt',
};

afterEach(() => { vi.unstubAllGlobals(); });

beforeEach(() => {
  const crypto = globalThis.crypto as Crypto;
  vi.stubGlobal('window', { crypto });
});

describe('SubsonicService', () => {
  it('hashPassword returns a 32-hex salt and an md5 token', () => {
    const { token, salt } = SubsonicService.hashPassword('secret');
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('in demo mode getStreamUrl returns a sampled pixabay URL and caches it', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    const first = svc.getStreamUrl('abc123');
    expect(first).toMatch(/^https:\/\/cdn\.pixabay\.com/);
    expect(t.resolveMediaUrl).toHaveBeenCalledTimes(1);
    const second = svc.getStreamUrl('abc123');
    expect(second).toBe(first);
    expect(t.resolveMediaUrl).toHaveBeenCalledTimes(1); // cached
  });

  it('with real credentials getStreamUrl builds a stream.view URL and caches', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    svc.setCredentials(creds);
    const url = svc.getStreamUrl('song-1', 'm4a');
    expect(url).toContain('/rest/stream.view');
    expect(url).toContain('id=song-1');
    expect(url).toContain('u=user');
    expect(url).toContain('t=tok');
    expect(url).toContain('s=salt');
    expect(url).toContain('format=mp3'); // m4a forced to mp3
    expect(svc.getStreamUrl('song-1', 'm4a')).toBe(url); // cached
  });

  it('forces a flac transcode for alac/aif/wav prefixes', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    svc.setCredentials(creds);
    expect(svc.getStreamUrl('x', 'alac')).toContain('format=flac');
  });

  it('getCoverArtUrl passes through absolute http ids and falls back to a placeholder in demo', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    expect(svc.getCoverArtUrl('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg');
    expect(svc.getCoverArtUrl('')).toBe('https://picsum.photos/300/300?grayscale');
  });

  it('getPing returns false when the request throws', async () => {
    const svc = new SubsonicService(creds);
    const t = makeTransport();
    t.fetchJson = vi.fn(async () => { throw new Error('nope'); });
    svc.setTransport(t);
    expect(await svc.getPing()).toBe(false);
  });
});
