/**
 * Studio has a separate IndexedDB database even when it is served from the
 * same browser origin as another design-system page.  Its API matches the
 * application's LocalDB surface so production modules can be composed
 * unchanged by the preview build.
 */
const DB_NAME = 'nebula_studio_preview_db';
const DB_VERSION = 1;
const SETTINGS = 'settings';
const CACHE = 'api_cache';
const STATS = 'stats';

class PreviewDb {
  private database: IDBDatabase | null = null;
  private opening: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { this.database = request.result; resolve(); };
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SETTINGS)) database.createObjectStore(SETTINGS);
        if (!database.objectStoreNames.contains(CACHE)) database.createObjectStore(CACHE);
        if (!database.objectStoreNames.contains(STATS)) database.createObjectStore(STATS, { keyPath: 'id' });
      };
    });
    return this.opening;
  }

  async get(store: string, key: string): Promise<any> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.database!.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(store: string, key: string, value: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.database!.transaction(store, 'readwrite').objectStore(store).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async put(store: string, value: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.database!.transaction(store, 'readwrite').objectStore(store).put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(store: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.database!.transaction(store, 'readwrite');
      transaction.objectStore(store).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async remove(store: string, key: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const request = this.database!.transaction(store, 'readwrite').objectStore(store).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  saveCredentials(credentials: any) { return this.set(SETTINGS, 'credentials', credentials); }
  getCredentials() { return this.get(SETTINGS, 'credentials'); }
  cacheResponse(key: string, data: any) { return this.set(CACHE, key, { timestamp: Date.now(), data }); }

  async getCachedResponse(key: string, ttlMinutes = 60) {
    const result = await this.get(CACHE, key);
    return result && (Date.now() - result.timestamp) / 60000 <= ttlMinutes ? result.data : null;
  }

  async incrementPlayCount(song: any, serverId: string) {
    const id = `${serverId}:${song.id}`;
    const existing = await this.get(STATS, id).catch(() => null);
    return this.put(STATS, {
      id,
      serverId,
      songId: song.id,
      song: { ...(existing?.song || {}), ...song },
      playCount: (existing?.playCount || 0) + 1,
      lastPlayed: Date.now(),
    });
  }

  async getMostPlayed(serverId: string, limit = 20): Promise<any[]> {
    await this.init();
    return new Promise(resolve => {
      const request = this.database!.transaction(STATS, 'readonly').objectStore(STATS).getAll();
      request.onsuccess = () => resolve((request.result || [])
        .filter((entry: any) => entry.serverId === serverId)
        .sort((a: any, b: any) => b.playCount - a.playCount)
        .slice(0, limit)
        .map((entry: any) => entry.song));
      request.onerror = () => resolve([]);
    });
  }
}

export const db = new PreviewDb();
