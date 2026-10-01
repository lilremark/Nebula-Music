export type TrustedFetch = (
  url: string,
  init?: { headers?: Headers; redirect?: 'manual'; signal?: AbortSignal },
) => Promise<Response>;

export class UntrustedTargetError extends Error {
  constructor() {
    super('Forbidden network target.');
    this.name = 'UntrustedTargetError';
  }
}

/** Enforce HTTP opt-in on every redirect and release intermediate bodies. */
export const fetchWithTrustedRedirects = async (
  fetchImpl: TrustedFetch,
  isTrustedTarget: (url: string) => boolean,
  target: string,
  init: { headers?: Headers; signal?: AbortSignal } = {},
): Promise<Response> => {
  let url = target;
  for (let redirects = 0; redirects <= 10; redirects += 1) {
    if (!isTrustedTarget(url)) throw new UntrustedTargetError();
    const response = await fetchImpl(url, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirects === 10) throw new Error('Invalid or excessive redirects.');
    url = new URL(location, url).href;
  }
  throw new Error('Excessive redirects.');
};
