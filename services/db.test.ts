import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { LocalDB } from './db';

describe('LocalDB transactions', () => {
  beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('preserves every simultaneous play count increment', async () => {
    const database = new LocalDB();
    const song = { id: 'same-song', title: 'Track' };
    await Promise.all(Array.from({ length: 30 }, () => database.incrementPlayCount(song, 'server')));
    expect((await database.get('stats', 'server:same-song')).playCount).toBe(30);
  });

  it('reports an aborted write even when the put request succeeds', async () => {
    const database = new LocalDB();
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = originalPut.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(database.set('settings', 'volume', 0.5)).rejects.toThrow('Database write aborted');
    expect(await database.get('settings', 'volume')).toBeUndefined();
  });

  it('uses the server index for most-played results', async () => {
    const database = new LocalDB();
    await database.incrementPlayCount({ id: 'other' }, 'other-server');
    await database.incrementPlayCount({ id: 'one' }, 'server');
    await database.incrementPlayCount({ id: 'two' }, 'server');
    await database.incrementPlayCount({ id: 'two' }, 'server');
    const indexSpy = vi.spyOn(IDBObjectStore.prototype, 'index');
    expect(await database.getMostPlayed('server', 1)).toEqual([{ id: 'two' }]);
    expect(indexSpy).toHaveBeenCalledWith('serverId');
  });

  it('adds the server index while preserving a version 3 library', async () => {
    const oldDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nebula_music_db', 3);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('settings');
        request.result.createObjectStore('api_cache');
        request.result.createObjectStore('stats', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = oldDatabase.transaction('stats', 'readwrite');
      tx.objectStore('stats').put({ id: 'server:song', serverId: 'server', playCount: 4, song: { id: 'song' } });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    oldDatabase.close();
    const database = new LocalDB();
    expect(await database.getMostPlayed('server')).toEqual([{ id: 'song' }]);
    expect((await database.get('stats', 'server:song')).playCount).toBe(4);
  });

  it('retries initialization after an open failure', async () => {
    const database = new LocalDB();
    const originalOpen = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const request = { error: new Error('Temporary failure') } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => request.onerror?.(new Event('error')));
      return request;
    }).mockImplementation(originalOpen);
    await expect(database.init()).rejects.toThrow('Temporary failure');
    await database.set('settings', 'volume', 0.4);
    expect(await database.get('settings', 'volume')).toBe(0.4);
  });
});
