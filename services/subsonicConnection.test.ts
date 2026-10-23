import { describe, expect, it, vi } from 'vitest';
import { SubsonicService } from './subsonicService';

describe('Subsonic connection checks', () => {
  it('checks the current server without extension discovery or changing protocol metadata', async () => {
    const service = new SubsonicService({ serverUrl: 'https://music.example/base', username: 'fixture', token: 'fixture', salt: 'fixture' });
    const fetchJson = vi.fn(async (_url: string) => ({ ok: true, status: 200, statusText: '', body: { 'subsonic-response': { status: 'ok', version: '1.16.1' } } }));
    service.setTransport({ fetchJson, resolveMediaUrl: url => url });
    const previous = service.getServerInfo();
    expect(await service.checkConnection()).toBe(true);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(new URL(fetchJson.mock.calls[0][0]).pathname).toBe('/base/rest/ping.view');
    expect(service.getServerInfo()).toEqual(previous);
  });

  it('reports HTTP failures, invalid responses, and rejected requests as disconnected', async () => {
    const service = new SubsonicService({ serverUrl: 'https://music.example', username: 'fixture', token: 'fixture', salt: 'fixture' });
    const fetchJson = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable', body: null })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: '', body: {} })
      .mockRejectedValueOnce(new Error('Connection refused'));
    service.setTransport({ fetchJson, resolveMediaUrl: url => url });
    expect(await service.checkConnection()).toBe(false);
    expect(await service.checkConnection()).toBe(false);
    expect(await service.checkConnection()).toBe(false);
  });

  it('keeps reachability separate from authentication and protocol negotiation errors', async () => {
    const service = new SubsonicService({ serverUrl: 'https://music.example', username: 'fixture', token: 'fixture', salt: 'fixture' });
    const fetchJson = vi.fn(async () => ({ ok: true, status: 200, statusText: '', body: { 'subsonic-response': { status: 'failed', error: { code: 30, message: 'Use an older protocol version' } } } }));
    service.setTransport({ fetchJson, resolveMediaUrl: url => url });
    expect(await service.checkConnection()).toBe(true);
    expect(service.getServerInfo().clientProtocolVersion).toBe('1.16.1');
  });
});
