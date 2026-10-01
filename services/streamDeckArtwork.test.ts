import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSanitizedArtwork } from './streamDeckArtwork';

const makeResponse = (type: string, length = '10', status = 200) => new Response('x', {
  status, headers: { 'content-type': type, 'content-length': length },
});

// Minimal canvas that records drawImage and returns a small data URL.
beforeEach(() => {
  const ctx = { drawImage: vi.fn() };
  const canvas: any = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: () => 'data:image/jpeg;base64,AAAA',
  };
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal(
    'Image',
    class {
      onload: any;
      onerror: any;
      src: string = '';
      naturalWidth = 256;
      naturalHeight = 256;
      constructor() {
        queueMicrotask(() => this.onload && this.onload());
      }
    },
  );
  vi.stubGlobal(
    'FileReader',
    class {
      onload: any;
      onerror: any;
      result: string | null = null;
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,AAAA';
        queueMicrotask(() => this.onload && this.onload());
      }
    },
  );
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSanitizedArtwork', () => {
  const t = () => globalThis.fetch as ReturnType<typeof vi.fn>;

  it('sends the authenticated URL with same-origin credentials and force-cache', async () => {
    t().mockResolvedValue(makeResponse('image/jpeg', '100'));
    await createSanitizedArtwork('https://m/art?id=1');
    expect(t()).toHaveBeenCalledWith('https://m/art?id=1', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('returns undefined when the response is not ok', async () => {
    t().mockResolvedValue(makeResponse('image/jpeg', '10', 500));
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns undefined when the declared content-length exceeds the cap', async () => {
    t().mockResolvedValue(makeResponse('image/jpeg', '999999999'));
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns undefined for a non-image blob', async () => {
    t().mockResolvedValue(makeResponse('text/plain'));
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns a jpeg data URL on the happy path', async () => {
    t().mockResolvedValue(makeResponse('image/jpeg'));
    expect(await createSanitizedArtwork('https://m/art')).toMatch(/^data:image\/jpeg/);
  });
});
