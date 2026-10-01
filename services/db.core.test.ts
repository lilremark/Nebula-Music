import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { LocalDB } from './db';

describe('LocalDB core behavior', () => {
  let db: LocalDB;
  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    db = new LocalDB();
    await db.init();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('saves and retrieves credentials', async () => {
    const creds = { serverUrl: 'https://music.example', username: 'u' };
    await db.saveCredentials(creds);
    expect(await db.getCredentials()).toEqual(creds);
  });

  it('expires cached responses by TTL', async () => {
    await db.cacheResponse('k', { albums: [1, 2] });
    const fresh = await db.getCachedResponse('k', 60);
    expect(fresh).toEqual({ albums: [1, 2] });
    const expired = await db.getCachedResponse('k', -1);
    expect(expired).toBeNull();
  });

  it('increments play counts and returns most-played first', async () => {
    await db.incrementPlayCount({ id: 'a', title: 'A' }, 'srv');
    await db.incrementPlayCount({ id: 'a', title: 'A' }, 'srv');
    await db.incrementPlayCount({ id: 'b', title: 'B' }, 'srv');
    await db.incrementPlayCount({ id: 'x', title: 'X' }, 'other');
    const top = await db.getMostPlayed('srv', 10);
    expect(top.map((s: any) => s.id)).toEqual(['a', 'b']);
  });

  it('sets, gets, removes, and clears a value', async () => {
    await db.set('settings', 'key', { ok: 1 });
    expect(await db.get('settings', 'key')).toEqual({ ok: 1 });
    await db.remove('settings', 'key');
    expect(await db.get('settings', 'key')).toBeUndefined();
    await db.set('settings', 'again', 1);
    await db.clear('settings');
    expect(await db.get('settings', 'again')).toBeUndefined();
  });
});
