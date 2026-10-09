import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRendererDocumentUrl, isTrustedRendererFrame, resolveRendererAsset } from './rendererSecurity';

describe('renderer privilege boundaries', () => {
  it.each(['app://nebula/', 'app://nebula/index.html#library', 'app://nebula/mini-player.html'])('trusts the bundled document %s', (url) => {
    const frame = { url };
    expect(isTrustedRendererFrame({ sender: { mainFrame: frame }, senderFrame: frame })).toBe(true);
  });

  it.each([
    'app://nebula/proxy?u=https://evil.example', 'app://other/index.html',
    'https://nebula/index.html', 'app://nebula:80/', 'app://user@nebula/',
    'app://nebula/assets/remote.html', 'not a url',
  ])('denies native privileges and navigation for %s', (url) => {
    const frame = { url };
    expect(isRendererDocumentUrl(url)).toBe(false);
    expect(isTrustedRendererFrame({ sender: { mainFrame: frame }, senderFrame: frame })).toBe(false);
  });

  it('rejects subframes even when their URL matches a bundled entry', () => {
    const mainFrame = { url: 'app://nebula/' };
    expect(isTrustedRendererFrame({ sender: { mainFrame }, senderFrame: { ...mainFrame } })).toBe(false);
    expect(isTrustedRendererFrame({ sender: { mainFrame }, senderFrame: null })).toBe(false);
  });
});

describe('renderer asset containment', () => {
  const root = path.resolve('dist');
  it('serves bundled and encoded asset paths', () => {
    expect(resolveRendererAsset(root, '/')).toBe(path.join(root, 'index.html'));
    expect(resolveRendererAsset(root, '/assets/album%20cover.svg')).toBe(path.join(root, 'assets', 'album cover.svg'));
  });

  it.each([
    '/../dist-secret/credentials.json', '/..\\dist-secret\\credentials.json',
    '/%2e%2e%5cdist-secret%5ccredentials.json', '/assets/%2e%2e/secret',
    '/C:/Windows/win.ini', '/index.html:secret', '/%00', '/bad%ZZ', '/assets/%2f%2e%2e/secret',
  ])('rejects Windows traversal or malformed path %s', (pathname) => {
    expect(resolveRendererAsset(root, pathname)).toBeNull();
  });
});
