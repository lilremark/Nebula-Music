/**
 * Streaming proxy for the desktop build.
 *
 * https media loads directly from the Subsonic server in the renderer. This
 * proxy remains only for plain-http targets, which a secure `app://` context
 * would otherwise block as mixed content.
 *
 * Media requests are frequently aborted by the renderer (track advance, seek,
 * preloaded next-track teardown). The abort signal must be forwarded to the
 * upstream fetch so the server connection is released promptly; otherwise
 * connections leak until the full stream finishes and the per-host connection
 * pool is exhausted, which stalls playback after a handful of tracks.
 */

import { fetchWithTrustedRedirects, UntrustedTargetError, type TrustedFetch } from './trustedFetch';

export type StreamProxyFetch = TrustedFetch;

export interface StreamProxyOptions {
  fetchImpl: StreamProxyFetch;
  isTrustedTarget(url: string): boolean;
}

/**
 * Returns a `handle` function suitable for Electron's `protocol.handle`.
 * The upstream fetch inherits the renderer's abort signal so cancelled
 * requests close their connection instead of leaking it.
 */
export const createStreamProxy = ({ fetchImpl, isTrustedTarget }: StreamProxyOptions) => {
  const handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const target = url.searchParams.get('u');
    if (!target || !isTrustedTarget(target)) {
      return new Response('Forbidden', { status: 403 });
    }

    const headers = new Headers();
    const range = request.headers.get('Range');
    if (range) headers.set('Range', range);

    try {
      const upstream = await fetchWithTrustedRedirects(fetchImpl, isTrustedTarget, target, {
        headers,
        signal: request.signal,
      });

      const responseHeaders = new Headers();
      const contentType = upstream.headers.get('content-type');
      if (contentType) responseHeaders.set('content-type', contentType);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) responseHeaders.set('content-length', contentLength);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) responseHeaders.set('content-range', contentRange);
      responseHeaders.set('x-content-type-options', 'nosniff');
      // Never let remote HTML/SVG become an active document on our privileged
      // app origin, even if it is reached through a link or an iframe.
      responseHeaders.set('content-security-policy', "default-src 'none'; sandbox; frame-ancestors 'none'");

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      if (err instanceof UntrustedTargetError) return new Response('Forbidden', { status: 403 });
      if (err instanceof Error && err.name === 'AbortError') {
        // The renderer cancelled the request (e.g. it switched tracks). The
        // caller will ignore this response; returning one keeps the handler
        // well-formed without re-throwing into the protocol layer.
        return new Response('Request cancelled', { status: 499 });
      }
      return new Response('Proxy error', { status: 502 });
    }
  };

  return { handle };
};
