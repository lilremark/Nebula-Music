import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebPlatform } from './web';

afterEach(() => vi.unstubAllGlobals());

describe('web external links', () => {
  it('allows HTTP(S) links and rejects active-content schemes and embedded credentials', async () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    const platform = createWebPlatform();
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'https://user:secret@example.com']) {
      expect(await platform.openExternal(url)).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
    expect(await platform.openExternal('https://last.fm/music/Example')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://last.fm/music/Example', '_blank', 'noopener,noreferrer');
  });
});
