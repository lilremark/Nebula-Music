import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { DjModelManager } from './modelManager';

const bytes = Buffer.from('verified model');
const asset = { file: 'model.gguf', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), url: 'https://models.example/pinned/model.gguf', kind: 'model' };
function archive(name: string, type = '0') {
  const header = Buffer.alloc(512); header.write(name); header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
  header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124); header.fill(32, 148, 156); header.write(type, 156);
  if (type === '2') header.write('../outside', 157);
  const sum = header.reduce((total, value) => total + value, 0); header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return Buffer.concat([header, bytes, Buffer.alloc(512 - bytes.length), Buffer.alloc(1024)]);
}
describe('explicit local model installation', () => {
  let root: string;
  beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'nebula-model-download-')); });
  afterEach(async () => { if (!root.startsWith(path.join(os.tmpdir(), 'nebula-model-download-'))) throw Error('Invalid test folder'); await fs.rm(root, { recursive: true, force: true }); });
  const create = (fetcher: (...args: any[]) => Promise<Response> = vi.fn(async () => new Response(bytes)), files = [asset]) => new DjModelManager(root, () => {}, fetcher as typeof fetch, [asset], files);
  it('does not download at startup and only becomes ready after verified atomic installation', async () => {
    const fetcher = vi.fn(async () => new Response(bytes)); const manager = create(fetcher);
    expect(await manager.status()).toMatchObject({ ready: false, phase: 'missing' }); expect(fetcher).not.toHaveBeenCalled();
    expect(await manager.download()).toMatchObject({ ready: true, phase: 'ready', received: bytes.length });
    expect(await fs.readFile(path.join(manager.resources, asset.file))).toEqual(bytes);
    expect(await create().status()).toMatchObject({ ready: true });
    expect(await fs.stat(path.join(root, 'downloads')).catch(() => null)).toBeNull();
  });
  it.each([Buffer.from('corrupt model!'), Buffer.from('truncated'), Buffer.from('too many bytes in this response')])('rejects corrupt, truncated and oversized responses', async payload => {
    const manager = create(vi.fn(async () => new Response(payload)));
    expect(await manager.download()).toMatchObject({ ready: false, phase: 'error' });
    expect(await fs.stat(manager.resources).catch(() => null)).toBeNull();
    expect(await fs.readdir(path.join(root, 'downloads'))).toEqual([]);
  });
  it('cancels a stalled network request and permits retry', async () => {
    let began!: () => void; const started = new Promise<void>(resolve => { began = resolve; });
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
      began(); return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    });
    const manager = create(fetcher); const download = manager.download(); await started; manager.cancel();
    expect(await download).toMatchObject({ phase: 'missing', ready: false });
    fetcher.mockImplementation(async () => new Response(bytes));
    expect(await manager.download()).toMatchObject({ ready: true });
  });
  it('shares concurrent requests and reuses complete verified files when extraction verification fails', async () => {
    const fetcher = vi.fn(async () => new Response(bytes)); const manager = create(fetcher, [asset, { ...asset, file: 'packages/missing.onnx' }]);
    const first = manager.download(); expect(manager.download()).toBe(first);
    expect(await first).toMatchObject({ ready: false });
    const repaired = create(fetcher); expect(await repaired.download()).toMatchObject({ ready: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps an existing installation intact on failed repair', async () => {
    const manager = create(); await manager.download();
    const broken = create(vi.fn(async () => new Response('bad')));
    expect(await broken.download()).toMatchObject({ ready: false });
    expect(await fs.readFile(path.join(manager.resources, asset.file))).toEqual(bytes);
  });
  it('fails closed after an installed file is corrupted or deleted', async () => {
    const manager = create(); await manager.download();
    await fs.writeFile(path.join(manager.resources, asset.file), 'damaged');
    expect(await create().status()).toMatchObject({ ready: false });
    await fs.unlink(path.join(manager.resources, asset.file));
    expect(await create().status()).toMatchObject({ ready: false });
  });
  it('requires the verified installation manifest and shares startup checks', async () => {
    const manager = create(); await manager.download();
    const checking = create();
    expect(await Promise.all([checking.status(), checking.status()])).toMatchObject([{ ready: true }, { ready: true }]);
    await fs.unlink(path.join(manager.resources, 'manifest.json'));
    expect(await create().status()).toMatchObject({ ready: false });
  });
  it.each([['../outside', '0'], ['voice.bin', '2']])('rejects traversal and links in pinned archives', async (name, type) => {
    const payload = archive(name, type);
    const download = { ...asset, file: 'voice.tar', kind: 'archive', size: payload.length, sha256: createHash('sha256').update(payload).digest('hex') };
    const manager = new DjModelManager(root, () => {}, vi.fn(async () => new Response(payload)) as typeof fetch, [download], [{ ...asset, file: 'packages/voice.bin' }]);
    expect(await manager.download()).toMatchObject({ phase: 'error', ready: false });
    expect(await fs.stat(manager.resources).catch(() => null)).toBeNull();
  });
  it('extracts a valid archive and verifies its installed payload', async () => {
    const payload = archive('voice.bin');
    const download = { ...asset, file: 'voice.tar', kind: 'archive', size: payload.length, sha256: createHash('sha256').update(payload).digest('hex') };
    const manager = new DjModelManager(root, () => {}, vi.fn(async () => new Response(payload)) as typeof fetch, [download], [{ ...asset, file: 'packages/voice.bin' }]);
    expect(await manager.download()).toMatchObject({ phase: 'ready', ready: true });
    expect(await fs.readFile(path.join(manager.resources, 'packages', 'voice.bin'))).toEqual(bytes);
  });
});
