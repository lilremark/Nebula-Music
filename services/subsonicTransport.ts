import type { Platform } from '../platform/types';
import { fetchAndRead } from './httpRequest';

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
 * Browser transport: bounded JSON requests and unchanged media URLs.
 */
export const webSubsonicTransport: SubsonicTransport = {
  fetchJson: async (url) => {
    // A redirect can forward query-string authentication to another server.
    // Browsers hide manual redirect destinations, so use the canonical server URL.
    return fetchAndRead(url, async (response) => {
      const body = await response.json().catch((error: unknown) => {
        if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) throw error;
        return null;
      });
      return { status: response.status, statusText: response.statusText, ok: response.ok, body };
    }, { redirect: 'error' });
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
