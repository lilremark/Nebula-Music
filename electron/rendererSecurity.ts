import path from 'node:path';

/** Only bundled entry documents may exercise the preload's native privileges. */
export const isRendererDocumentUrl = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'app:' && url.host === 'nebula' &&
      !url.username && !url.password &&
      ['/', '/index.html', '/mini-player.html'].includes(url.pathname);
  } catch {
    return false;
  }
};

export const isTrustedRendererFrame = (event: {
  sender: { mainFrame: unknown };
  senderFrame: { url: string } | null;
}): boolean => !!event.senderFrame && event.senderFrame === event.sender.mainFrame &&
  isRendererDocumentUrl(event.senderFrame.url);

/** Decode URL paths once, then use the platform's path rules for containment. */
export const resolveRendererAsset = (root: string, pathname: string): string | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  // Backslashes and colons have filesystem meaning on Windows, including ADS.
  if (!decoded.startsWith('/') || /[\\\0:]/.test(decoded)) return null;
  const segments = decoded.slice(1).split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) return null;
  const filePath = path.resolve(root, decoded === '/' ? 'index.html' : decoded.slice(1));
  const relative = path.relative(path.resolve(root), filePath);
  return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) ? filePath : null;
};
