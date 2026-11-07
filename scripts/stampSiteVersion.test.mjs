import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stampSiteVersion } from './stampSiteVersion.mjs';

const sitePath = fileURLToPath(new URL('../site/index.html', import.meta.url));

describe('stampSiteVersion', () => {
  it('rewrites every download link and version badge in the homepage', () => {
    const source = readFileSync(sitePath, 'utf8');
    const { html, downloads, badges } = stampSiteVersion(source, 'v3.1.0');

    expect(downloads).toBe(4);
    expect(badges).toBeGreaterThanOrEqual(1);
    expect(html).toContain('releases/download/v3.1.0/Nebula-3.1.0-setup.exe');
    expect(html).toContain('releases/download/v3.1.0/Nebula-3.1.0-setup.appx');
    expect(html).toContain('releases/download/v3.1.0/Nebula-3.1.0-arm64.dmg');
    expect(html).toContain('releases/download/v3.1.0/Nebula-3.1.0-arm64.zip');
    expect(html).toContain('<b data-version>v3.1.0</b>');
    expect(html).not.toMatch(/releases\/download\/v3\.0\.0\//);
  });

  it('keeps the runtime asset templates intact', () => {
    const { html } = stampSiteVersion(readFileSync(sitePath, 'utf8'), '3.1.0');
    expect(html).toContain('data-asset="Nebula-{v}-setup.exe"');
  });

  it('accepts a version with or without the leading v', () => {
    const page = '<a href="https://x/releases/download/v1.0.0/Nebula-1.0.0-setup.exe">';
    expect(stampSiteVersion(page, '2.0.0').html).toBe(stampSiteVersion(page, 'v2.0.0').html);
  });

  it('rejects input that is not a version', () => {
    expect(() => stampSiteVersion('releases/download/v1.0.0/Nebula-1.0.0-x', 'latest')).toThrow('Not a release version');
  });

  it('fails loudly when the page has no download links to update', () => {
    expect(() => stampSiteVersion('<p>no links</p>', '3.1.0')).toThrow('No release download links');
  });
});
