import { describe, expect, it, vi } from 'vitest';
import { createStreamProxy, type StreamProxyFetch } from './streamProxy';

const trusted = (url: string): boolean => url.startsWith('https://music.example');

const proxyUrl = (target: string): Request =>
  new Request(`app://nebula/proxy?u=${encodeURIComponent(target)}`);

const upstreamResponse = (
  init: { status?: number; body?: string; headers?: Record<string, string> } = {},
): Response =>
  new Response(init.body ?? 'stream', {
    status: init.status ?? 200,
    headers: init.headers ?? { 'content-type': 'audio/mpeg', 'content-length': '6' },
  });

describe('createStreamProxy', () => {
  it('forwards Range requests upstream', async () => {
    const fetchImpl = vi.fn<StreamProxyFetch>().mockResolvedValue(upstreamResponse());
    const { handle } = createStreamProxy({ fetchImpl, isTrustedTarget: trusted });

    const request = new Request(proxyUrl('https://music.example/rest/stream.view?id=1'), {
      headers: { Range: 'bytes=0-1023' },
    });
    const response = await handle(request);

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://music.example/rest/stream.view?id=1',
      expect.objectContaining({
        headers: expect.any(Headers),
        redirect: 'follow',
        signal: request.signal,
      }),
    );
    const init = fetchImpl.mock.calls[0][1]!;
    expect(init.headers!.get('Range')).toBe('bytes=0-1023');
  });

  it('propagates the renderer abort signal to the upstream fetch', async () => {
    const fetchImpl = vi.fn<StreamProxyFetch>().mockResolvedValue(upstreamResponse());
    const { handle } = createStreamProxy({ fetchImpl, isTrustedTarget: trusted });

    await handle(proxyUrl('https://music.example/rest/stream.view?id=1'));

    const init = fetchImpl.mock.calls[0][1]!;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal).not.toBeNull();
  });

  it('releases the upstream fetch when the renderer aborts mid-stream', async () => {
    const abortController = new AbortController();
    const fetchImpl = vi
      .fn<StreamProxyFetch>()
      .mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const { handle } = createStreamProxy({ fetchImpl, isTrustedTarget: trusted });

    const request = new Request(proxyUrl('https://music.example/rest/stream.view?id=1'));
    Object.defineProperty(request, 'signal', { value: abortController.signal });
    abortController.abort();

    const response = await handle(request);
    expect(response.status).toBe(499);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: abortController.signal }),
    );
  });

  it('forwards status, content-type, content-length, content-range and nosniff', async () => {
    const fetchImpl = vi
      .fn<StreamProxyFetch>()
      .mockResolvedValue(
        upstreamResponse({
          status: 206,
          headers: {
            'content-type': 'audio/mpeg',
            'content-length': '1024',
            'content-range': 'bytes 0-1023/100000',
          },
        }),
      );
    const { handle } = createStreamProxy({ fetchImpl, isTrustedTarget: trusted });

    const response = await handle(
      new Request(proxyUrl('https://music.example/rest/stream.view?id=1'), {
        headers: { Range: 'bytes=0-1023' },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('content-length')).toBe('1024');
    expect(response.headers.get('content-range')).toBe('bytes 0-1023/100000');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('returns the upstream body bytes', async () => {
    const fetchImpl = vi.fn<StreamProxyFetch>().mockResolvedValue(upstreamResponse({ body: 'abcdef' }));
    const { handle } = createStreamProxy({ fetchImpl, isTrustedTarget: trusted });

    const response = await handle(proxyUrl('https://music.example/rest/stream.view?id=1'));
    expect(await response.text()).toBe('abcdef');
  });

  it('rejects requests without a trusted target', async () => {
    const fetchImpl = vi.fn<StreamProxyFetch>();
    const { handle } = createStreamProxy({ fetchImpl, isTrustedTarget: trusted });

    expect((await handle(proxyUrl('http://insecure.example/stream'))).status).toBe(403);
    expect((await handle(new Request('app://nebula/proxy'))).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns 502 when the upstream fetch fails', async () => {
    const fetchImpl = vi
      .fn<StreamProxyFetch>()
      .mockRejectedValue(new Error('network down'));
    const { handle } = createStreamProxy({ fetchImpl, isTrustedTarget: trusted });

    const response = await handle(proxyUrl('https://music.example/rest/stream.view?id=1'));
    expect(response.status).toBe(502);
  });
});
