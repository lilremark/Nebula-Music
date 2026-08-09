import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MediaCache } from './mediaCache';

const makeDir = async (): Promise<string> => mkdtemp(path.join(tmpdir(), 'nebula-media-cache-'));

const writeBytes = async (cache: MediaCache, key: string, data: Buffer, contentType = 'audio/mpeg') => {
  const { fd } = await cache.beginWrite(key);
  await fd.write(data);
  await fd.close();
  return cache.finalize(key, { size: data.length, contentType });
};

describe('MediaCache', () => {
  it('caches a file and serves it back', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    const key = cache.keyFor('https://server/stream?id=1');
    const data = Buffer.from('audio-bytes');
    await writeBytes(cache, key, data);

    const meta = cache.get(key);
    expect(meta).not.toBeNull();
    expect(meta!.size).toBe(data.length);
    expect(cache.stats().entryCount).toBe(1);
    expect(await cache.readFile(key)).toEqual(data);

    await cache.clear();
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null for unknown keys', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    expect(cache.get('missing')).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it('evicts least-recently-used entries when over the byte cap', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 100, enabled: true });

    // First entry is LRU.
    await writeBytes(cache, 'key-a', Buffer.alloc(60));
    await writeBytes(cache, 'key-b', Buffer.alloc(60));

    expect(cache.get('key-a')).toBeNull();
    expect(cache.get('key-b')).not.toBeNull();
    expect(cache.stats().usedBytes).toBeLessThanOrEqual(100);
    await rm(dir, { recursive: true, force: true });
  });

  it('touches lastAccess on get so recently used entries survive eviction', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });

    await writeBytes(cache, 'key-a', Buffer.alloc(60));
    await writeBytes(cache, 'key-b', Buffer.alloc(60));
    // Access key-a now -> key-b becomes oldest.
    cache.get('key-a');
    await cache.setMaxBytes(100);

    expect(cache.get('key-a')).not.toBeNull();
    expect(cache.get('key-b')).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it('discard removes an in-progress partial file', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    const key = cache.keyFor('https://server/stream?id=2');
    const { fd, filePath } = await cache.beginWrite(key);
    await fd.write(Buffer.alloc(10));
    await fd.close();
    await cache.discard(key);
    const names = await readdir(dir);
    expect(names.filter(n => n.endsWith('.part')).length).toBe(0);
    expect(cache.get(key)).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it('persists the index across open() calls', async () => {
    const dir = await makeDir();
    let cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    const key = cache.keyFor('https://server/stream?id=3');
    await writeBytes(cache, key, Buffer.from('data'));
    await cache.persistIndex();

    cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    expect(cache.get(key)).not.toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it('sweeps leftover partial files on open', async () => {
    const dir = await makeDir();
    let cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    const key = cache.keyFor('https://server/stream?id=4');
    const { fd } = await cache.beginWrite(key);
    await fd.write(Buffer.alloc(10));
    await fd.close();

    cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    const names = await readdir(dir);
    expect(names.filter(n => n.endsWith('.part')).length).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('sweeps leftover index temp files on open', async () => {
    const dir = await makeDir();
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir, 'index.json.tmp'), '{}', 'utf8');
    const cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    const names = await readdir(dir);
    expect(names.filter(n => n.endsWith('.tmp')).length).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('ignores unknown/missing files in the index', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 1_000_000, enabled: true });
    await writeBytes(cache, 'missing-file-key', Buffer.from('x'));
    await cache.remove('missing-file-key');
    expect(cache.get('missing-file-key')).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it('does not evict when disabled', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 100, enabled: true });
    cache.setEnabled(false);
    await writeBytes(cache, 'key-a', Buffer.alloc(60));
    await writeBytes(cache, 'key-b', Buffer.alloc(60));
    expect(cache.get('key-a')).not.toBeNull();
    expect(cache.get('key-b')).not.toBeNull();
    expect(cache.stats().enabled).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });

  it('key is a stable sha256 hash', async () => {
    const dir = await makeDir();
    const cache = await MediaCache.open({ directory: dir, maxBytes: 100, enabled: true });
    const k1 = cache.keyFor('https://a/b?c=1');
    const k2 = cache.keyFor('https://a/b?c=1');
    const k3 = cache.keyFor('https://a/b?c=2');
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k1).toMatch(/^[0-9a-f]{64}$/);
    await rm(dir, { recursive: true, force: true });
  });
});
