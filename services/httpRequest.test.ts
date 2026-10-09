import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAndRead, readLimitedBlob } from './httpRequest';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('fetchAndRead', () => {
  it('aborts a request that never delivers headers', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const request = fetchAndRead('https://example.test', res => res.json(), {}, 20);
    const rejection = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(20);
    await rejection;
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the deadline active while the response body stalls', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => ({
      json: () => new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
      }),
    })));
    const request = fetchAndRead('https://example.test', res => res.json(), {}, 20);
    const rejection = expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(20);
    await rejection;
  });

  it('honors caller cancellation and clears its deadline on success', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_url, init: RequestInit) => {
      controller.abort();
      expect(init.signal?.aborted).toBe(true);
      return new Response('hello');
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAndRead('https://example.test', res => res.text(), { signal: controller.signal })).toBe('hello');
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', referrerPolicy: 'no-referrer' });
  });
});

describe('readLimitedBlob', () => {
  it('cancels an oversized response before consuming its body', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const response = new Response(body, { headers: { 'content-length': '20' } });
    await expect(readLimitedBlob(response, 10)).rejects.toThrow('size limit');
    expect(cancel).toHaveBeenCalled();
  });

  it('cancels a streamed response that exceeds the limit without a declared size', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20)); }, cancel });
    await expect(readLimitedBlob(new Response(body), 10)).rejects.toThrow('size limit');
    expect(cancel).toHaveBeenCalled();
  });

  it('preserves the media type and bytes of valid artwork', async () => {
    const blob = await readLimitedBlob(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }), 10);
    expect(blob.type).toBe('image/png');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
  });
});
