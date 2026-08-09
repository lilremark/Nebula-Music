import { createHash } from 'node:crypto';
import {
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

/**
 * A bounded, disk-backed LRU cache for streamed media (audio tracks and cover
 * art) served through the desktop proxy.
 *
 * Design goals:
 *  - Previously-played tracks replay instantly from disk instead of re-hitting
 *    the Subsonic server over the network.
 *  - The cache is bounded by a byte cap. Eviction is LRU and happens inline on
 *    every finalize, so disk usage can never grow without bound (no crashes
 *    from filling the disk).
 *  - Files are written to a `.part` path first and atomically renamed on
 *    completion, so an interrupted download can never leave a corrupt entry.
 *
 * Keys are the SHA-256 of the upstream URL, which is stable because
 * SubsonicService caches per-song stream URLs.
 */
export interface MediaCacheEntryMeta {
  key: string;
  size: number;
  contentType: string;
  lastAccess: number;
}

export interface MediaCacheStats {
  enabled: boolean;
  maxBytes: number;
  usedBytes: number;
  entryCount: number;
  directory: string;
}

export interface MediaCacheOptions {
  directory: string;
  maxBytes: number;
  enabled: boolean;
}

const PART_SUFFIX = '.part';
const INDEX_FILE = 'index.json';

const serializeIndex = (entries: Map<string, MediaCacheEntryMeta>): string =>
  `${JSON.stringify([...entries.values()], null, 2)}\n`;

export class MediaCache {
  private readonly entries = new Map<string, MediaCacheEntryMeta>();
  private readonly directory: string;
  private maxBytes: number;
  private enabled: boolean;
  private indexDirty = false;

  private constructor(directory: string, maxBytes: number, enabled: boolean) {
    this.directory = directory;
    this.maxBytes = maxBytes;
    this.enabled = enabled;
  }

  static async open(options: MediaCacheOptions): Promise<MediaCache> {
    const cache = new MediaCache(options.directory, options.maxBytes, options.enabled);
    await mkdir(options.directory, { recursive: true });
    await cache.loadIndex();
    if (cache.enabled) await cache.sweepPartials();
    await cache.evictIfNeeded();
    return cache;
  }

  setEnabled(enabled: boolean): Promise<void> {
    if (this.enabled === enabled) return Promise.resolve();
    this.enabled = enabled;
    return this.evictIfNeeded();
  }

  setMaxBytes(maxBytes: number): Promise<void> {
    if (this.maxBytes === maxBytes) return Promise.resolve();
    this.maxBytes = maxBytes;
    return this.evictIfNeeded();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  stats(): MediaCacheStats {
    return {
      enabled: this.enabled,
      maxBytes: this.maxBytes,
      usedBytes: this.totalSize(),
      entryCount: this.entries.size,
      directory: this.directory,
    };
  }

  /** Full path for the finished cache file of a key (may not exist). */
  filePathFor(key: string): string {
    return path.join(this.directory, `${key}`);
  }

  private partPathFor(key: string): string {
    return `${this.filePathFor(key)}${PART_SUFFIX}`;
  }

  keyFor(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  private totalSize(): number {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.size;
    return total;
  }

  /** Returns metadata if a complete entry exists and touches LRU time. */
  get(key: string): MediaCacheEntryMeta | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    entry.lastAccess = Date.now();
    this.indexDirty = true;
    return { ...entry };
  }

  /** Reads the finished file's content for a key (streaming-friendly chunked caller). */
  async readFile(key: string): Promise<Buffer> {
    return readFile(this.filePathFor(key));
  }

  /** Reads a byte range [start, start+length) from a finished cache file. */
  async readRange(key: string, start: number, length: number): Promise<Buffer> {
    const handle = await open(this.filePathFor(key), 'r');
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async statFile(key: string): Promise<{ size: number } | null> {
    try {
      const info = await stat(this.filePathFor(key));
      return { size: info.size };
    } catch {
      return null;
    }
  }

  /**
   * Opens a write stream for a partial download. Caller streams bytes into the
   * returned file descriptor, then calls finalize() (success) or discard()
   * (abort/error).
   */
  async beginWrite(key: string): Promise<{ filePath: string; fd: import('node:fs/promises').FileHandle }> {
    await mkdir(this.directory, { recursive: true });
    const filePath = this.partPathFor(key);
    const fd = await open(filePath, 'w');
    return { filePath, fd };
  }

  /** Commits a partial file into the finished cache and evicts if over budget. */
  async finalize(key: string, meta: Omit<MediaCacheEntryMeta, 'key' | 'lastAccess'>): Promise<boolean> {
    const partPath = this.partPathFor(key);
    const finalPath = this.filePathFor(key);
    try {
      await rename(partPath, finalPath);
    } catch {
      return false;
    }
    const info = await this.statFile(key).catch(() => null);
    const size = info?.size ?? meta.size;
    this.entries.set(key, { key, size, contentType: meta.contentType, lastAccess: Date.now() });
    this.indexDirty = true;
    await this.evictIfNeeded();
    return true;
  }

  /** Discards an in-progress partial download (aborted / errored). */
  async discard(key: string): Promise<void> {
    await rm(this.partPathFor(key), { force: true }).catch(() => {});
  }

  /** Removes a finished entry and its file. */
  async remove(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.indexDirty = true;
    }
    await rm(this.filePathFor(key), { force: true }).catch(() => {});
  }

  /** Clears every cached file and the index. */
  async clear(): Promise<void> {
    for (const key of [...this.entries.keys()]) {
      await this.remove(key);
    }
    await this.persistIndex();
  }

  /** Evicts least-recently-used entries until total size fits maxBytes. */
  async evictIfNeeded(): Promise<void> {
    if (!this.enabled) return;
    while (this.totalSize() > this.maxBytes) {
      const oldest = [...this.entries.values()].sort((a, b) => a.lastAccess - b.lastAccess)[0];
      if (!oldest) break;
      await this.remove(oldest.key);
    }
    if (this.indexDirty) await this.persistIndex();
  }

  /** Persists the in-memory index to disk (cheap, atomic). */
  async persistIndex(): Promise<void> {
    if (!this.indexDirty) return;
    await mkdir(this.directory, { recursive: true });
    const tmp = path.join(this.directory, `${INDEX_FILE}.tmp`);
    await writeFile(tmp, serializeIndex(this.entries), 'utf8');
    await rename(tmp, path.join(this.directory, INDEX_FILE));
    this.indexDirty = false;
  }

  private async loadIndex(): Promise<void> {
    try {
      const raw = await readFile(path.join(this.directory, INDEX_FILE), 'utf8');
      const parsed = JSON.parse(raw) as MediaCacheEntryMeta[];
      if (!Array.isArray(parsed)) return;
      for (const meta of parsed) {
        if (!meta || typeof meta.key !== 'string') continue;
        const info = await this.statFile(meta.key).catch(() => null);
        if (info) this.entries.set(meta.key, { ...meta, size: info.size });
      }
    } catch {
      // Missing/corrupt index is fine.
    }
  }

  /** Removes leftover .part / index temp files from previous runs. */
  private async sweepPartials(): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.endsWith(PART_SUFFIX) || name.endsWith('.tmp')) {
        await rm(path.join(this.directory, name), { force: true }).catch(() => {});
      }
    }
  }
}
