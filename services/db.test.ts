import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDB } from './db';

const STORE_SETTINGS = 'settings';
const STORE_CACHE = 'api_cache';
const STORE_STATS = 'stats';

describe('LocalDB', () => {
  // In-memory backing store for every object store (name -> Map<key, value>).
  const stores = new Map<string, Map<string, unknown>>();
  let db: LocalDB;

  // Returns the object-store view for `name`. Every operation dispatches its
  // request's `onsuccess` on the microtask queue, so `LocalDB`'s handlers
  // (attached synchronously after the call returns) are always set in time.
  // The backing Map is shared across transactions, so reads see earlier writes.
  const makeStore = (name: string) => {
    const data = stores.get(name)!;
    return {
      get: (key: string) => {
        const req: any = { onsuccess: null, onerror: null, result: data.get(key) };
        queueMicrotask(() => req.onsuccess && req.onsuccess());
        return req;
      },
      put: (value: unknown, key?: string) => {
        const k = key !== undefined ? key : (value as any).id;
        data.set(String(k), value);
        const req: any = { onsuccess: null, onerror: null, result: undefined };
        queueMicrotask(() => req.onsuccess && req.onsuccess());
        return req;
      },
      delete: (key: string) => {
        data.delete(key);
        const req: any = { onsuccess: null, onerror: null, result: undefined };
        queueMicrotask(() => req.onsuccess && req.onsuccess());
        return req;
      },
      getAll: () => {
        const req: any = { onsuccess: null, onerror: null, result: [...data.values()] };
        queueMicrotask(() => req.onsuccess && req.onsuccess());
        return req;
      },
      clear: () => {
        data.clear();
      },
    };
  };

  const installIndexedDB = () => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn((_name: string, _version: number) => {
        const request: any = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          error: null,
          result: null,
        };
        // Fully realise the open lifecycle (upgrade then success) on the
        // microtask queue, after LocalDB has attached its handlers.
        queueMicrotask(() => {
          if (!request.onupgradeneeded) return;
          const idb: any = {
            objectStoreNames: { contains: (n: string) => stores.has(n) },
            createObjectStore: (n: string, opts?: { keyPath?: string }) => {
              stores.set(n, new Map());
              return { keyPath: opts?.keyPath ?? null };
            },
            transaction: () => {
              const tx: any = {
                objectStore: (n: string) => makeStore(n),
                oncomplete: null,
                onerror: null,
                error: null,
              };
              // The shim never fails transactions, so only `oncomplete` fires.
              // (`clear()` sets both handlers; firing onerror here would reject.)
              queueMicrotask(() => {
                if (tx.oncomplete) tx.oncomplete();
              });
              return tx;
            },
          };
          request.result = idb;
          request.onupgradeneeded({ oldVersion: 0, newVersion: _version, target: { result: idb } });
          request.onsuccess && request.onsuccess();
        });
        return request;
      }),
    });
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    stores.clear();
  });

  beforeEach(async () => {
    stores.set(STORE_SETTINGS, new Map());
    stores.set(STORE_CACHE, new Map());
    stores.set(STORE_STATS, new Map());
    installIndexedDB();
    db = new LocalDB();
    await db.init();
  });

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
