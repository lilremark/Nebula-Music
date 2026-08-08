import { describe, expect, it, vi } from 'vitest';
import { toDataUrlArtwork } from './mediaSessionArtwork';

if (typeof FileReader === 'undefined') {
  class PolyfillFileReader {
    result: string | ArrayBuffer | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsDataURL(blob: Blob): void {
      blob
        .arrayBuffer()
        .then((buffer) => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
          this.result = `data:${blob.type || ''};base64,${btoa(binary)}`;
          this.onload?.();
        })
        .catch(() => this.onerror?.());
    }
  }
  (globalThis as unknown as { FileReader: unknown }).FileReader = PolyfillFileReader;
}

describe('toDataUrlArtwork', () => {
  it('converts fetchable http URLs to data URLs', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    const result = await toDataUrlArtwork([{ src: 'https://example.com/art.jpg', sizes: '96x96', type: 'image/jpeg' }]);
    expect(result).toHaveLength(1);
    expect(result[0].src.startsWith('data:image/jpeg')).toBe(true);
  });

  it('drops entries whose fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('nope'));
    const result = await toDataUrlArtwork([{ src: 'app://nebula/proxy?u=x', sizes: '96x96', type: 'image/jpeg' }]);
    expect(result).toHaveLength(0);
  });
});
