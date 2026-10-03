import { EventEmitter } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { utilityProcess } from 'electron';
import { LocalDjRuntime } from './localRuntime';
import { groundedCommentaryChoices, type DjPrepareRequest } from './localProtocol';

vi.mock('electron', () => ({ utilityProcess: { fork: vi.fn() } }));
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
const request = (): DjPrepareRequest => ({ requestId: randomUUID(), sessionId: randomUUID(), tracks: [{ id: 'one', title: 'Blue Train', artist: 'John Coltrane', genre: 'Jazz' }], taste: 'Still learning your taste; exploring variety in your library.', welcome: true, voice: 'Michael' });

describe('bundled DJ runtime failures and cancellation', () => {
  let directory: string, runtime: LocalDjRuntime;
  let child: EventEmitter & { kill: ReturnType<typeof vi.fn> };
  let worker: EventEmitter & { kill: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> };
  const originalPlatform = process.platform;
  beforeEach(async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nebula-dj-runtime-'));
    await fs.mkdir(path.join(directory, 'llama'));
    const bytes = Buffer.from('fixture-resource');
    await fs.writeFile(path.join(directory, 'model.gguf'), bytes);
    await fs.writeFile(path.join(directory, 'llama', 'llama-server.exe'), bytes);
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ files: ['model.gguf', 'llama/llama-server.exe'].map(file => ({ file, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })) }));
    child = Object.assign(new EventEmitter(), { kill: vi.fn() });
    worker = Object.assign(new EventEmitter(), { kill: vi.fn(), postMessage: vi.fn() });
    vi.mocked(spawn).mockReturnValue(child as any); vi.mocked(utilityProcess.fork).mockReturnValue(worker as any);
    worker.postMessage.mockImplementation(data => queueMicrotask(() => worker.emit('message', { id: data.id, wavBase64: Buffer.from('RIFF fixture').toString('base64') })));
    runtime = new LocalDjRuntime(directory, 'fixture-worker.cjs');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('/health') ? '{}' : JSON.stringify({ choices: [{ message: { content: JSON.stringify({ speech: groundedCommentaryChoices(request())[0] }) } }] }), { status: 200 })));
  });
  afterEach(async () => {
    runtime.cancel(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (!directory.startsWith(path.join(os.tmpdir(), 'nebula-dj-runtime-'))) throw new Error('Invalid test resource directory');
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('validates extracted model checksums and fails closed on corruption', async () => {
    await fs.writeFile(path.join(directory, 'model.gguf'), 'corrupt-resource!');
    expect(await runtime.readiness()).toMatchObject({ ready: false });
  });
  it('reports missing model resources', async () => {
    await fs.unlink(path.join(directory, 'model.gguf'));
    expect(await runtime.readiness()).toMatchObject({ ready: false });
  });
  it('uses a grounded fallback for malformed or hallucinated text and still synthesizes locally', async () => {
    vi.mocked(fetch).mockImplementation(async url => new Response(String(url).endsWith('/health') ? '{}' : JSON.stringify({ choices: [{ message: { content: '{"speech":"Radiohead is up next."}' } }] })));
    const result = await runtime.prepare(request());
    expect(result.fallback).toBe(true); expect(result.text).toContain('John Coltrane'); expect(result.text).not.toContain('Radiohead');
    expect(result.wavBase64).toBeTruthy();
  });
  it('binds authenticated CPU inference only to loopback and releases both processes on stop', async () => {
    expect((await runtime.prepare(request())).fallback).toBe(false);
    expect(spawn).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['127.0.0.1', '--api-key', '--n-gpu-layers', '0']), expect.objectContaining({ windowsHide: true, shell: false }));
    runtime.cancel(); expect(child.kill).toHaveBeenCalled(); expect(worker.kill).toHaveBeenCalled();
  });
  it('previews the voice without starting the text model helper', async () => {
    await runtime.prepare(request(), true);
    expect(spawn).not.toHaveBeenCalled(); expect(utilityProcess.fork).toHaveBeenCalled();
  });
  it('rejects synthesis failure instead of blocking the music owner', async () => {
    worker.postMessage.mockImplementation(data => queueMicrotask(() => worker.emit('message', { id: data.id, error: 'Voice resources missing' })));
    await expect(runtime.prepare(request())).rejects.toThrow('Voice resources missing');
  });
  it('rejects a crashed voice process', async () => {
    worker.postMessage.mockImplementation(() => queueMicrotask(() => worker.emit('exit', 1)));
    await expect(runtime.prepare(request())).rejects.toThrow('voice process stopped');
  });
  it('cancels an in-flight request and discards obsolete audio', async () => {
    let started!: () => void;
    const voiceStarted = new Promise<void>(resolve => { started = resolve; });
    worker.postMessage.mockImplementation(started);
    const preparation = runtime.prepare(request());
    const rejected = expect(preparation).rejects.toThrow('cancelled');
    await voiceStarted; runtime.cancel(); await rejected;
    expect(worker.kill).toHaveBeenCalled();
  });
  it('times out stuck synthesis after sixty seconds and releases the voice worker', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let started!: () => void;
    const voiceStarted = new Promise<void>(resolve => { started = resolve; });
    worker.postMessage.mockImplementation(started);
    const preparation = runtime.prepare(request(), true);
    const rejected = expect(preparation).rejects.toThrow('60 seconds');
    await voiceStarted; await vi.advanceTimersByTimeAsync(60000); await rejected;
    expect(worker.kill).toHaveBeenCalled();
  });
  it('uses deterministic commentary when the text helper crashes during startup', async () => {
    vi.mocked(fetch).mockImplementation(async () => { child.emit('exit', 1); return new Response('{}', { status: 503 }); });
    const result = await runtime.prepare(request());
    expect(result.fallback).toBe(true); expect(result.error).toContain('stopped unexpectedly');
    expect(result.wavBase64).toBeTruthy();
  });
});
