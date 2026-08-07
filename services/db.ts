
const DB_NAME = 'nebula_music_db';
const DB_VERSION = 3; // Increment version to trigger upgrade
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
        console.error("DB Open Error:", request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        this.db = request.result;
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
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName: string, value: any): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async remove(storeName: string, key: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
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

    // Get existing entry
    const existing = await new Promise<any>((resolve) => {
      const tx = this.db!.transaction(STORE_STATS, 'readonly');
      const store = tx.objectStore(STORE_STATS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    const entry = existing || {
      id,
      serverId,
      songId: song.id,
      song: song, // Store song metadata for display
      playCount: 0,
      lastPlayed: 0
    };

    entry.playCount = (entry.playCount || 0) + 1;
    entry.lastPlayed = Date.now();
    // Update song metadata in case it changed (e.g. cover art)
    entry.song = { ...entry.song, ...song };

    await this.put(STORE_STATS, entry);
  }

  async getMostPlayed(serverId: string, limit: number = 20): Promise<any[]> {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(STORE_STATS, 'readonly');
      const store = tx.objectStore(STORE_STATS);
      const req = store.getAll(); // Get all for now, filter in memory (dataset is small locally)

      req.onsuccess = () => {
        const allStats = req.result || [];
        const serverStats = allStats.filter((s: any) => s.serverId === serverId);
        serverStats.sort((a: any, b: any) => b.playCount - a.playCount);
        resolve(serverStats.slice(0, limit).map((s: any) => s.song));
      };
      req.onerror = () => resolve([]);
    });
  }
}

export const db = new LocalDB();
