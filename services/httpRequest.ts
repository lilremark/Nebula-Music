export const HTTP_REQUEST_TIMEOUT_MS = 15_000;

/** Bound untrusted artwork even when its server omits Content-Length. */
export const readLimitedBlob = async (response: Response, maxBytes: number): Promise<Blob> => {
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > maxBytes) {
    await response.body?.cancel();
    throw new Error('The response exceeds the artwork size limit.');
  }
  if (!response.body) return new Blob([], { type: response.headers.get('content-type') || '' });
  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('The response exceeds the artwork size limit.');
      }
      chunks.push(value as Uint8Array<ArrayBuffer>);
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks, { type: response.headers.get('content-type') || '' });
};

/** Keep the deadline active while consuming the body, not just until headers arrive. */
export const fetchAndRead = async <T>(
  url: string,
  read: (response: Response) => Promise<T>,
  init: RequestInit = {},
  timeoutMs = HTTP_REQUEST_TIMEOUT_MS,
): Promise<T> => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abortFromCaller();
  else init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException('The request timed out.', 'TimeoutError')),
    timeoutMs,
  );
  try {
    const response = await fetch(url, {
      // Keep same-origin reverse-proxy sessions working; never include cookies
      // from a separately hosted music server or third-party lyric/artwork host.
      credentials: 'same-origin',
      referrerPolicy: 'no-referrer',
      ...init,
      signal: controller.signal,
    });
    return await read(response);
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
};
