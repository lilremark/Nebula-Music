import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubsonicService } from './subsonicService';
import type { SubsonicCredentials } from '../types';
import type { SubsonicTransport } from './subsonicTransport';

const { cache, getCachedResponse, cacheResponse } = vi.hoisted(() => {
  const cache = new Map<string, unknown>();
  return {
    cache,
    getCachedResponse: vi.fn(async (key: string) => cache.get(key) ?? null),
    cacheResponse: vi.fn(async (key: string, value: unknown) => { cache.set(key, value); }),
  };
});
vi.mock('./db', () => ({ db: { getCachedResponse, cacheResponse } }));

const credentials = (serverUrl = 'https://music.example', username = 'alice'): SubsonicCredentials => ({
  authType: 'token', serverUrl, username, token: 'token', salt: 'salt',
});
const transport = (name: string): SubsonicTransport => ({
  fetchJson: vi.fn(async () => ({ status: 200, statusText: 'OK', ok: true,
    body: { 'subsonic-response': { status: 'ok', artists: { index: [{ artist: [{ id: '1', name }] }] } } },
  })),
  resolveMediaUrl: url => url,
});

beforeEach(() => { cache.clear(); vi.clearAllMocks(); });

describe('Subsonic account isolation', () => {
  it('isolates cached library metadata by server and account', async () => {
    const service = new SubsonicService(credentials());
    service.setTransport(transport('Alice library'));
    expect((await service.getArtists())[0].name).toBe('Alice library');
    service.setCredentials(credentials('https://other.example'));
    service.setTransport(transport('Other server library'));
    expect((await service.getArtists())[0].name).toBe('Other server library');
    service.setCredentials(credentials('https://other.example', 'bob'));
    service.setTransport(transport('Bob library'));
    expect((await service.getArtists())[0].name).toBe('Bob library');
    expect(cache.size).toBe(3);
  });

  it('isolates API key accounts without including the secret in cache keys', async () => {
    const service = new SubsonicService({ serverUrl: 'https://music.example', authType: 'apiKey', apiKey: 'first-secret' });
    service.setTransport(transport('First library'));
    await service.getArtists();
    service.setCredentials({ serverUrl: 'https://music.example', authType: 'apiKey', apiKey: 'second-secret' });
    service.setTransport(transport('Second library'));
    expect((await service.getArtists())[0].name).toBe('Second library');
    expect([...cache.keys()].join()).not.toMatch(/first-secret|second-secret/);
  });

  it('does not accept or cache a response from an account changed during the request', async () => {
    const service = new SubsonicService(credentials());
    let resolveRequest!: (response: Awaited<ReturnType<SubsonicTransport['fetchJson']>>) => void;
    const pending = new Promise<Awaited<ReturnType<SubsonicTransport['fetchJson']>>>(resolve => { resolveRequest = resolve; });
    const fetchJson = vi.fn(() => pending);
    service.setTransport({ fetchJson, resolveMediaUrl: url => url });
    const artists = service.getArtists();
    await vi.waitFor(() => expect(fetchJson).toHaveBeenCalled());
    service.setCredentials(credentials('https://other.example'));
    resolveRequest({ status: 200, statusText: 'OK', ok: true,
      body: { 'subsonic-response': { status: 'ok', artists: { index: [{ artist: [{ id: '1', name: 'Old account' }] }] } } } });
    expect(await artists).toEqual([]);
    expect(cache.size).toBe(0);
  });
});

describe('Subsonic URL construction', () => {
  it('removes inherited credentials/query fragments while preserving base paths and LAN HTTP', () => {
    const service = new SubsonicService(credentials('http://192.168.1.2/music/?p=plaintext&apiKey=obsolete#fragment'));
    const url = new URL(service.getStreamUrl('song 1'));
    expect(url.pathname).toBe('/music/rest/stream.view');
    expect(url.searchParams.get('u')).toBe('alice');
    expect(url.searchParams.get('id')).toBe('song 1');
    expect(url.searchParams.has('p')).toBe(false);
    expect(url.searchParams.has('apiKey')).toBe(false);
    expect(url.hash).toBe('');
  });

  it('clears resolved URL caches after switching transports', () => {
    const service = new SubsonicService(credentials());
    const first = service.getStreamUrl('1');
    service.setTransport({ ...transport(''), resolveMediaUrl: url => `proxy:${url}` });
    expect(service.getStreamUrl('1')).toBe(`proxy:${first}`);
  });
});
