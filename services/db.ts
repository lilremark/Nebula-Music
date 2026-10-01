
const DB_NAME = 'nebula_music_db';
const DB_VERSION = 4;
const STORE_SETTINGS = 'settings';
const STORE_CACHE = 'api_cache';
const STORE_STATS = 'stats';

export class LocalDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
          this.initPromise = null;
        };
        resolve();
      };
      request.onupgradeneeded = (event) => {
        console.warn("DB Upgrade Needed: Old Version", event.oldVersion, "New Version", event.newVersion);
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE);
        }
        if (!db.objectStoreNames.contains(STORE_STATS)) {
          console.warn("Creating 'stats' object store");
          db.createObjectStore(STORE_STATS, { keyPath: 'id' });
        }
        const stats = request.transaction!.objectStore(STORE_STATS);
        if (!stats.indexNames.contains('serverId')) stats.createIndex('serverId', 'serverId');
      };
    });
    return this.initPromise;
  }

  async get(storeName: string, key: string): Promise<any> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async set(storeName: string, key: string, value: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value, key); // For object stores without keyPath, key is required. With keyPath, key is in value.
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Database write aborted.'));
      tx.onerror = () => reject(tx.error ?? req.error);
    });
  }

  async put(storeName: string, value: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Database write aborted.'));
      tx.onerror = () => reject(tx.error ?? req.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Database write aborted.'));
      tx.onerror = () => reject(tx.error);
    });
  }

  async remove(storeName: string, key: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Database write aborted.'));
      tx.onerror = () => reject(tx.error ?? req.error);
    });
  }

  // Helper Methods
  async saveCredentials(creds: any) { return this.set(STORE_SETTINGS, 'credentials', creds); }
  async getCredentials() { return this.get(STORE_SETTINGS, 'credentials'); }

  async cacheResponse(key: string, data: any) {
    // Using set because api_cache doesn't have keyPath in initialization above (default key-value store)
    return this.set(STORE_CACHE, key, { timestamp: Date.now(), data });
  }

  async getCachedResponse(key: string, ttlMinutes: number = 60) {
    const res = await this.get(STORE_CACHE, key);
    if (!res) return null;
    const age = (Date.now() - res.timestamp) / 1000 / 60;
    if (age > ttlMinutes) return null;
    return res.data;
  }

  // Stats Methods
  private getStatsId(serverId: string, songId: string) {
    return `${serverId}:${songId}`;
  }

  async incrementPlayCount(song: any, serverId: string) {
    await this.init();
    const id = this.getStatsId(serverId, song.id);

    // Read and increment in one transaction so simultaneous scrobbles do not
    // overwrite each other's counts.
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_STATS, 'readwrite');
      const store = tx.objectStore(STORE_STATS);
      const req = store.get(id);
      req.onsuccess = () => {
        const entry = req.result || {
          id,
          serverId,
          songId: song.id,
          song,
          playCount: 0,
          lastPlayed: 0,
        };
        entry.playCount = (entry.playCount || 0) + 1;
        entry.lastPlayed = Date.now();
        entry.song = { ...entry.song, ...song };
        store.put(entry);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('Play count update aborted.'));
      tx.onerror = () => reject(tx.error ?? req.error);
    });
  }

  async getMostPlayed(serverId: string, limit: number = 20): Promise<any[]> {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_STATS, 'readonly');
      const store = tx.objectStore(STORE_STATS);
      const req = store.index('serverId').getAll(serverId);

      req.onsuccess = () => {
        const serverStats = req.result || [];
        serverStats.sort((a: any, b: any) => b.playCount - a.playCount);
        resolve(serverStats.slice(0, limit).map((s: any) => s.song));
      };
      req.onerror = () => resolve([]);
    });
  }
}

export const db = new LocalDB();
