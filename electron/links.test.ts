import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl, isStreamDeckBridgeUrl } from './links';

describe('isAllowedExternalUrl', () => {
  it('accepts https URLs', () => {
    expect(isAllowedExternalUrl('https://example.com/radio')).toBe(true);
  });

  it('accepts mailto links', () => {
    expect(isAllowedExternalUrl('mailto:dev@nebula.app')).toBe(true);
  });

  it('rejects http URLs', () => {
    expect(isAllowedExternalUrl('http://example.com/radio')).toBe(false);
  });

  it('rejects dangerous schemes', () => {
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects malformed or empty input', () => {
    expect(isAllowedExternalUrl('')).toBe(false);
    expect(isAllowedExternalUrl('not a url')).toBe(false);
    expect(isAllowedExternalUrl(42 as unknown as string)).toBe(false);
  });

  it('rejects oversized URLs', () => {
    expect(isAllowedExternalUrl(`https://example.com/${'a'.repeat(5000)}`)).toBe(false);
  });
});

describe('isStreamDeckBridgeUrl', () => {
  it('accepts the default Stream Deck bridge endpoint', () => {
    expect(isStreamDeckBridgeUrl('ws://127.0.0.1:37921/nebula/v1')).toBe(true);
  });

  it('accepts a custom loopback port on the bridge path', () => {
    expect(isStreamDeckBridgeUrl('ws://127.0.0.1:40222/nebula/v1')).toBe(true);
  });

  it('rejects the same host on a non-bridge path', () => {
    expect(isStreamDeckBridgeUrl('ws://127.0.0.1:37921/nebula/other')).toBe(false);
    expect(isStreamDeckBridgeUrl('ws://127.0.0.1:37921/')).toBe(false);
  });

  it('rejects non-WebSocket schemes', () => {
    expect(isStreamDeckBridgeUrl('http://127.0.0.1:37921/nebula/v1')).toBe(false);
    expect(isStreamDeckBridgeUrl('https://127.0.0.1:37921/nebula/v1')).toBe(false);
  });

  it('rejects non-loopback hosts', () => {
    expect(isStreamDeckBridgeUrl('ws://localhost:37921/nebula/v1')).toBe(false);
    expect(isStreamDeckBridgeUrl('ws://192.168.1.10:37921/nebula/v1')).toBe(false);
  });

  it('rejects malformed or empty input', () => {
    expect(isStreamDeckBridgeUrl('')).toBe(false);
    expect(isStreamDeckBridgeUrl('not a url')).toBe(false);
    expect(isStreamDeckBridgeUrl(42 as unknown as string)).toBe(false);
  });
});
