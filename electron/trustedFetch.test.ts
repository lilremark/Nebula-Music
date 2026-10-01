import { describe, expect, it, vi } from 'vitest';
import { fetchWithTrustedRedirects, UntrustedTargetError, type TrustedFetch } from './trustedFetch';

const trusted = (url: string): boolean => new URL(url).protocol === 'https:';

describe('trusted redirects', () => {
  it.each(['http://music.example/stream', 'file:///C:/secret', 'app://nebula/index.html'])('blocks redirect to %s before fetching it', async (location) => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const fetchImpl = vi.fn<TrustedFetch>().mockResolvedValue(new Response(body, { status: 302, headers: { location } }));
    await expect(fetchWithTrustedRedirects(fetchImpl, trusted, 'https://music.example/stream')).rejects.toBeInstanceOf(UntrustedTargetError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('follows relative redirects while preserving range and abort signal', async () => {
    const headers = new Headers({ Range: 'bytes=500-' });
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn<TrustedFetch>()
      .mockResolvedValueOnce(new Response(null, { status: 307, headers: { location: '/media' } }))
      .mockResolvedValueOnce(new Response('audio'));
    expect(await (await fetchWithTrustedRedirects(fetchImpl, trusted, 'https://music.example/stream', { headers, signal })).text()).toBe('audio');
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://music.example/media', { headers, signal, redirect: 'manual' });
  });

  it('allows explicitly opted-in HTTP targets including redirects', async () => {
    const fetchImpl = vi.fn<TrustedFetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://local.example/media' } }))
      .mockResolvedValueOnce(new Response('audio'));
    await fetchWithTrustedRedirects(fetchImpl, (url) => ['http:', 'https:'].includes(new URL(url).protocol), 'https://music.example/stream');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('bounds redirect loops', async () => {
    const fetchImpl = vi.fn<TrustedFetch>().mockImplementation(async () => new Response(null, { status: 301, headers: { location: '/loop' } }));
    await expect(fetchWithTrustedRedirects(fetchImpl, trusted, 'https://music.example/loop')).rejects.toThrow('excessive redirects');
    expect(fetchImpl).toHaveBeenCalledTimes(11);
  });
});
