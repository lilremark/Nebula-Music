/** External URL validation for links opened from the renderer. */
const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'mailto:']);

export const isAllowedExternalUrl = (rawUrl: string): boolean => {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 4096) return false;
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * The Stream Deck plugin's loopback WebSocket endpoint. The renderer connects
 * to `ws://127.0.0.1:<port>/nebula/v1`; the main process rewrites the Origin
 * header of exactly these requests so the plugin accepts the handshake from
 * the `app://nebula`-served renderer.
 */
export const isStreamDeckBridgeUrl = (rawUrl: string): boolean => {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 4096) return false;
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'ws:' &&
      parsed.hostname === '127.0.0.1' &&
      parsed.pathname === '/nebula/v1'
    );
  } catch {
    return false;
  }
};
