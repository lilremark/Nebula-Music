import { describe, expect, it, vi, afterEach } from 'vitest';
import { webSubsonicTransport, createDesktopSubsonicTransport } from './subsonicTransport';
import type { Platform } from '../platform/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('webSubsonicTransport', () => {
  it('passes media URLs through unchanged', () => {
    expect(webSubsonicTransport.resolveMediaUrl('https://music.example/stream.mp3')).toBe(
      'https://music.example/stream.mp3',
    );
    expect(webSubsonicTransport.resolveMediaUrl('')).toBe('');
  });

  it('maps a fetch response to { status, statusText, ok, body }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const result = await webSubsonicTransport.fetchJson('https://music.example/rest/ping.view');
    expect(result).toMatchObject({ status: 200, statusText: '', ok: true, body: { ok: true } });
  });

  it('keeps ok=false and a non-JSON body as null for error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gateway error', { status: 502, statusText: 'Bad Gateway' })),
    );
    const result = await webSubsonicTransport.fetchJson('https://music.example/rest/ping.view');
    expect(result).toMatchObject({ status: 502, statusText: 'Bad Gateway', ok: false, body: null });
  });
});

describe('createDesktopSubsonicTransport', () => {
  const platform = {
    fetchJson: vi.fn(async () => ({ status: 200, statusText: '', ok: true, body: { ping: true } })),
    resolveMediaUrl: vi.fn((url: string) => `app://nebula/proxy?u=${encodeURIComponent(url)}`),
  } as unknown as Platform;

  it('delegates fetchJson to the platform', async () => {
    const transport = createDesktopSubsonicTransport(platform);
    const result = await transport.fetchJson('http://music.example/rest/ping.view');
    expect(platform.fetchJson).toHaveBeenCalledWith('http://music.example/rest/ping.view');
    expect(result.body).toEqual({ ping: true });
  });

  it('delegates resolveMediaUrl to the platform', () => {
    const transport = createDesktopSubsonicTransport(platform);
    expect(transport.resolveMediaUrl('http://music.example/rest/stream.view?id=1')).toBe(
      'app://nebula/proxy?u=http%3A%2F%2Fmusic.example%2Frest%2Fstream.view%3Fid%3D1',
    );
  });
});
