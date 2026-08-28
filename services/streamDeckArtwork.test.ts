import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSanitizedArtwork } from './streamDeckArtwork';

const makeBlob = (type: string, content = 'x') => ({ type, size: content.length }) as Blob;

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
    t().mockResolvedValue({ ok: true, headers: { get: () => '100' }, blob: async () => makeBlob('image/jpeg') });
    await createSanitizedArtwork('https://m/art?id=1');
    expect(t()).toHaveBeenCalledWith('https://m/art?id=1', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('returns undefined when the response is not ok', async () => {
    t().mockResolvedValue({ ok: false, headers: { get: () => '10' }, blob: async () => makeBlob('image/jpeg') });
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns undefined when the declared content-length exceeds the cap', async () => {
    t().mockResolvedValue({ ok: true, headers: { get: () => '999999999' }, blob: async () => makeBlob('image/jpeg') });
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns undefined for a non-image blob', async () => {
    t().mockResolvedValue({ ok: true, headers: { get: () => '10' }, blob: async () => makeBlob('text/plain') });
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns a jpeg data URL on the happy path', async () => {
    t().mockResolvedValue({ ok: true, headers: { get: () => '10' }, blob: async () => makeBlob('image/jpeg') });
    expect(await createSanitizedArtwork('https://m/art')).toMatch(/^data:image\/jpeg/);
  });
});
