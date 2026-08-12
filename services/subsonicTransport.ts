import type { Platform } from '../platform/types';

export interface SubsonicTransport {
  fetchJson(url: string): Promise<{
    status: number;
    statusText: string;
    ok: boolean;
    body: unknown;
  }>;
  resolveMediaUrl(url: string): string;
}

/**
 * Browser transport: global fetch and unchanged URLs. The web build behaves
 * exactly as before.
 */
export const webSubsonicTransport: SubsonicTransport = {
  fetchJson: async (url) => {
    const response = await fetch(url);
    const body = await response.json().catch(() => null);
    return { status: response.status, statusText: response.statusText, ok: response.ok, body };
  },
  resolveMediaUrl: (url) => url,
};

/**
 * Desktop transport: JSON fetches route through the main process, which
 * bypasses renderer CORS so Subsonic servers work without CORS headers.
 * https media loads directly from the server (identical to the web build);
 * only plain-http media is routed through the proxy to satisfy the app's
 * mixed-content policy (subject to the per-server opt-in enforced in main).
 */
export const createDesktopSubsonicTransport = (platform: Platform): SubsonicTransport => ({
  fetchJson: (url) => platform.fetchJson(url),
  resolveMediaUrl: (url) => platform.resolveMediaUrl(url),
});
