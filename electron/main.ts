import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  net,
  protocol,
  session,
  shell,
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { IPC } from './ipc';
import { isAllowedExternalUrl } from './links';
import { SettingsStore } from './settingsStore';
import { CredentialVault } from './credentialVault';
import { createSafeStorageCipher } from './safeStorageCipher';
import { createTray, destroyTray, showUpdateBalloon } from './tray';
import { registerMediaKeys, unregisterMediaKeys } from './mediaKeys';
import { createUpdater, type Updater } from './updater';
import { createCommandClient } from '../playback/commandClient';
import { MediaCache, type MediaCacheEntryMeta } from './mediaCache';
import type {
  DesktopCommand,
  DesktopCommandEnvelope,
  DesktopSnapshot,
} from '../playback/desktopProtocol';

const SCHEME = 'app';
const PROTOCOL_URL = 'app://nebula/';
const WINDOW_MIN = { width: 940, height: 600 };

// Served only to the desktop renderer (via the app://nebula protocol), so the
// Vite dev server keeps its own (CSP-less) environment for HMR. The renderer
// fetches Subsonic JSON through the main process and streams media through the
// proxy, so it only needs self-origin, the Stream Deck loopback WebSocket, and
// https (radio streams, lrclib lyrics, Google Fonts).
const CSP = [
  "default-src 'self' app://nebula",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: app://nebula https:",
  "media-src 'self' app://nebula https:",
  "connect-src 'self' app://nebula ws://127.0.0.1:* https:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

let mainWindow: BrowserWindow | null = null;
let miniPlayerWindow: BrowserWindow | null = null;
let settingsStore: SettingsStore;
let credentialVault: CredentialVault;
let updater: Updater;
let mediaCache: MediaCache;
let isQuitting = false;
let lastSnapshot: DesktopSnapshot | null = null;

const thumbarClient = createCommandClient('nebula-thumbar', () => lastSnapshot?.epoch ?? 0);

const forwardCommand = (envelope: DesktopCommandEnvelope): void => {
  mainWindow?.webContents.send(IPC.playback.command, envelope);
};

const broadcastSnapshotToMiniPlayer = (snapshot: DesktopSnapshot): void => {
  miniPlayerWindow?.webContents.send(IPC.playback.snapshotToClient, snapshot);
};

const updateTaskbarProgress = (snapshot: DesktopSnapshot): void => {
  if (!mainWindow || settingsStore.get('taskbarProgressEnabled') !== true) return;
  if (snapshot.playing && snapshot.durationSeconds > 0) {
    mainWindow.setProgressBar(Math.min(1, snapshot.positionSeconds / snapshot.durationSeconds));
  } else {
    mainWindow.setProgressBar(-1);
  }
};

const updateThumbarButtons = (snapshot: DesktopSnapshot | null): void => {
  if (!mainWindow || process.platform !== 'win32') return;
  if (!snapshot) {
    mainWindow.setThumbarButtons([]);
    return;
  }
  const send = (command: DesktopCommand): void => forwardCommand(thumbarClient.send(command));
  const playIcon = snapshot.playing
    ? nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-pause.png'))
    : nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-play.png'));
  mainWindow.setThumbarButtons([
    {
      icon: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-prev.png')),
      tooltip: 'Previous',
      click: () => send({ name: 'previous' }),
    },
    {
      icon: playIcon,
      tooltip: snapshot.playing ? 'Pause' : 'Play',
      click: () => send({ name: 'togglePlayback' }),
    },
    {
      icon: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-next.png')),
      tooltip: 'Next',
      click: () => send({ name: 'next' }),
    },
  ]);
};

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.map': 'application/json',
};

const mimeFor = (filePath: string): string => MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';

const rendererRoot = (): string => path.join(app.getAppPath(), 'dist');

const isTrustedProxyTarget = (rawUrl: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (parsed.protocol === 'http:' && settingsStore.get('permitInsecureHttp') !== true) return false;
  return true;
};

/** True when an upstream response delivers the entire file (200 or full-range 206). */
const isFullContentResponse = (status: number, contentRange: string | null): boolean => {
  if (status === 200) return true;
  if (status !== 206 || !contentRange) return false;
  const match = /^bytes 0-(\d+)\/(\d+)$/.exec(contentRange.trim());
  return match !== null && Number(match[1]) === Number(match[2]) - 1;
};

/** Parses a `Range: bytes=a-b` header into [start, end] (inclusive), or null. */
const parseByteRange = (rangeHeader: string, total: number): { start: number; end: number } | null => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const rawStart = match[1];
  const rawEnd = match[2];

  if (rawStart === '' && rawEnd === '') return null;
  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffix = Math.max(0, Math.min(Number(rawEnd), total));
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }
  const start = Number(rawStart);
  if (!Number.isFinite(start) || start >= total) return null;
  const end = rawEnd === '' ? total - 1 : Math.min(Number(rawEnd), total - 1);
  if (end < start) return null;
  return { start, end };
};

/** Builds a Response from a fully cached file, honoring an optional Range header. */
const serveFromCache = async (meta: MediaCacheEntryMeta, rangeHeader: string | null): Promise<Response> => {
  const headers = new Headers();
  headers.set('content-type', meta.contentType || 'application/octet-stream');
  headers.set('accept-ranges', 'bytes');
  headers.set('x-content-type-options', 'nosniff');

  if (rangeHeader) {
    const parsed = parseByteRange(rangeHeader, meta.size);
    if (parsed) {
      const { start, end } = parsed;
      const data = await mediaCache.readRange(meta.key, start, end - start + 1);
      headers.set('content-range', `bytes ${start}-${start + data.length - 1}/${meta.size}`);
      headers.set('content-length', String(data.length));
      return new Response(toBodyInit(data), { status: 206, headers });
    }
  }

  const data = await mediaCache.readFile(meta.key);
  headers.set('content-length', String(data.length));
  return new Response(toBodyInit(data), { status: 200, headers });
};

/** Converts a Node Buffer into a body-consumable Uint8Array. */
const toBodyInit = (buffer: Buffer): Uint8Array<ArrayBuffer> =>
  new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

const handleProxy = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const target = url.searchParams.get('u');
  if (!target || !isTrustedProxyTarget(target)) {
    return new Response('Forbidden', { status: 403 });
  }

  const headers = new Headers();
  const range = request.headers.get('Range');
  if (range) headers.set('Range', range);

  // Serve previously-played tracks straight from the local cache so replays
  // are instant and the Subsonic server is not hit again.
  const key = mediaCache.keyFor(target);
  const cached = mediaCache.get(key);
  if (cached) {
    return serveFromCache(cached, range);
  }

  // Wire the renderer's abort signal to the upstream request so cancelled
  // streams (track changes, seeks, skips) release the connection instead of
  // leaking it. Un-released streams were the cause of the desktop freeze.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (request.signal) {
    if (request.signal.aborted) onAbort();
    else request.signal.addEventListener('abort', onAbort, { once: true });
  }

  let upstream: Response;
  try {
    upstream = await net.fetch(target, { headers, redirect: 'follow', signal: controller.signal });
  } catch {
    return new Response('Proxy error', { status: 502 });
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) responseHeaders.set('content-length', contentLength);
  const contentRange = upstream.headers.get('content-range');
  if (contentRange) responseHeaders.set('content-range', contentRange);
  responseHeaders.set('x-content-type-options', 'nosniff');
  if (upstream.status === 206 || upstream.headers.get('accept-ranges')) {
    responseHeaders.set('accept-ranges', upstream.headers.get('accept-ranges') ?? 'bytes');
  }

  // Cache full successful audio streams so the next play is instant. Partial
  // (206) responses and non-media content are streamed through without caching.
  const shouldCache = mediaCache.isEnabled
    && upstream.body != null
    && contentType?.startsWith('audio/')
    && isFullContentResponse(upstream.status, upstream.headers.get('content-range'));

  if (!shouldCache || !upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  }

  return streamAndCache(mediaCache, key, upstream.body, contentType!, responseHeaders, upstream.status, upstream.statusText);
};

/**
 * Streams an upstream body to the client while writing every byte to a cache
 * `.part` file. On full completion the entry is committed; if the client aborts
 * or the stream errors, the partial download is discarded. The returned stream
 * is what the renderer consumes.
 */
const streamAndCache = async (
  cache: MediaCache,
  key: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
  responseHeaders: Headers,
  status: number,
  statusText: string,
): Promise<Response> => {
  const writer = await cache.beginWrite(key);
  const reader = body.getReader();
  let received = 0;
  let finalized = false;

  const finish = async (commit: boolean): Promise<void> => {
    if (finalized) return;
    finalized = true;
    await writer.fd.close().catch(() => {});
    if (commit) {
      await cache.finalize(key, { size: received, contentType });
    } else {
      await cache.discard(key);
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          await finish(true);
          controller.close();
          return;
        }
        if (value) {
          await writer.fd.write(value);
          received += value.byteLength;
        }
        controller.enqueue(value);
      } catch (error) {
        await finish(false);
        controller.error(error);
      }
    },
    async cancel() {
      try {
        await reader.cancel();
      } catch { }
      await finish(false);
    },
  });

  return new Response(stream, { status, statusText, headers: responseHeaders });
};

const handleProtocol = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);

  if (url.pathname === '/proxy') return handleProxy(request);

  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const normalized = path.posix.normalize(pathname).replace(/^([/\\])+/, '');
  if (!normalized || normalized === '..' || normalized.startsWith('../')) {
    return new Response('Forbidden', { status: 403 });
  }

  const root = rendererRoot();
  const filePath = path.join(root, normalized);
  if (!filePath.startsWith(root)) return new Response('Forbidden', { status: 403 });

  try {
    const data = await fs.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        'content-type': mimeFor(filePath),
        'content-security-policy': CSP,
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
};

const registerProtocol = (): void => {
  protocol.handle(SCHEME, handleProtocol);
};

const openExternalSafely = async (rawUrl: string): Promise<boolean> => {
  if (!isAllowedExternalUrl(rawUrl)) return false;
  await shell.openExternal(rawUrl);
  return true;
};

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: WINDOW_MIN.width,
    minHeight: WINDOW_MIN.height,
    ...(process.platform === 'win32' ? { frame: false } : {}),
    show: false,
    backgroundColor: '#0b0b12',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(PROTOCOL_URL)) event.preventDefault();
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      if (settingsStore.get('trayOnClose') === false) {
        isQuitting = true;
        app.quit();
        return;
      }
      event.preventDefault();
      win.hide();
    } else {
      mainWindow?.setThumbarButtons([]);
    }
  });

  win.on('minimize', () => {
    if (!isQuitting && settingsStore.get('minimizeToTray') === true) {
      win.hide();
    }
  });

  win.on('maximize', () => {
    win.webContents.send(IPC.window.maximizeChanged, true);
  });
  win.on('unmaximize', () => {
    win.webContents.send(IPC.window.maximizeChanged, false);
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.on('did-finish-load', () => {
    console.log('[nebula] renderer loaded');
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(
      `[nebula] renderer failed to load (${errorCode}) ${errorDescription} ${validatedURL}`,
    );
  });
  win.webContents.on('console-message', (event) => {
    if (event.level === 'warning' || event.level === 'error') {
      console.error(`[nebula] renderer ${event.level}: ${event.message}`);
    }
  });

  void win.loadURL(PROTOCOL_URL);
  return win;
};

const createMiniPlayerWindow = (): BrowserWindow => {
  const win = new BrowserWindow({
    width: 360,
    height: 96,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#17171a',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(PROTOCOL_URL)) event.preventDefault();
  });

  // The mini-player is a companion window: closing it hides it instead of
  // destroying it, and never quits the app.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.on('did-finish-load', () => {
    console.log('[nebula] mini-player loaded');
    // Seed the remote client with the latest state instead of waiting for the
    // next snapshot publish from the owner.
    if (lastSnapshot) broadcastSnapshotToMiniPlayer(lastSnapshot);
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(
      `[nebula] mini-player failed to load (${errorCode}) ${errorDescription} ${validatedURL}`,
    );
  });
  win.webContents.on('console-message', (event) => {
    if (event.level === 'warning' || event.level === 'error') {
      console.error(`[nebula] mini-player ${event.level}: ${event.message}`);
    }
  });

  void win.loadURL(`${PROTOCOL_URL}mini-player.html`);
  return win;
};

const toggleMiniPlayer = (): void => {
  if (miniPlayerWindow) {
    if (miniPlayerWindow.isVisible()) {
      miniPlayerWindow.hide();
    } else {
      miniPlayerWindow.show();
      miniPlayerWindow.focus();
    }
    return;
  }
  miniPlayerWindow = createMiniPlayerWindow();
  miniPlayerWindow.on('closed', () => {
    miniPlayerWindow = null;
  });
};

const showMainWindow = (): void => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const isTrustedSender = (webContents: Electron.WebContents): boolean => {
  const win = BrowserWindow.fromWebContents(webContents);
  return !!win && (win === mainWindow || win === miniPlayerWindow);
};

const registerIpc = (): void => {
  ipcMain.on(IPC.app.info, (event) => {
    event.returnValue = {
      os: process.platform,
      appName: app.getName(),
      appVersion: app.getVersion(),
    };
  });

  ipcMain.handle(IPC.app.openExternal, (_event, url: unknown) => {
    if (typeof url !== 'string') return false;
    return openExternalSafely(url);
  });

  ipcMain.on(IPC.window.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on(IPC.window.toggleMaximize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on(IPC.window.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle(IPC.window.isMaximized, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
  );
  ipcMain.handle(IPC.window.isFullScreen, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false,
  );

  ipcMain.handle(IPC.settings.get, (_event, key: unknown) => {
    if (typeof key !== 'string') return null;
    return settingsStore.get(key) ?? null;
  });
  ipcMain.handle(IPC.settings.set, async (_event, key: unknown, value: unknown) => {
    if (typeof key !== 'string') return;
    await settingsStore.set(key, value);
    if (key === 'mediaKeysEnabled') {
      if (value === true) {
        registerMediaKeys({
          getEpoch: () => lastSnapshot?.epoch ?? 0,
          onCommand: forwardCommand,
        });
      } else {
        unregisterMediaKeys();
      }
    } else if (key === 'taskbarProgressEnabled') {
      if (value === true && lastSnapshot) updateTaskbarProgress(lastSnapshot);
      else mainWindow?.setProgressBar(-1);
    } else if (key === 'updateChannel' && typeof value === 'string') {
      updater.setChannel(value);
    } else if (key === 'mediaCacheEnabled') {
      await mediaCache?.setEnabled(value === true);
    } else if (key === 'mediaCacheMaxMb' && typeof value === 'number') {
      await mediaCache?.setMaxBytes(value * 1024 * 1024);
    }
  });

  ipcMain.handle(IPC.vault.get, (event, serverUrl: unknown) => {
    if (!isTrustedSender(event.sender)) return null;
    if (typeof serverUrl !== 'string') return null;
    return credentialVault.get(serverUrl);
  });
  ipcMain.handle(IPC.vault.set, async (event, credentials: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    await credentialVault.set(credentials as Parameters<CredentialVault['set']>[0]);
  });
  ipcMain.handle(IPC.vault.clear, async (event, serverUrl: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    if (typeof serverUrl === 'string') await credentialVault.clear(serverUrl);
  });
  ipcMain.handle(IPC.vault.getSecret, (event, key: unknown) => {
    if (!isTrustedSender(event.sender)) return null;
    if (typeof key !== 'string') return null;
    return credentialVault.getSecret(key);
  });
  ipcMain.handle(IPC.vault.setSecret, async (event, key: unknown, value: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    if (typeof key !== 'string' || typeof value !== 'string') return;
    await credentialVault.setSecret(key, value);
  });
  ipcMain.handle(IPC.vault.clearSecret, async (event, key: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    if (typeof key === 'string') await credentialVault.clearSecret(key);
  });

  ipcMain.handle(IPC.http.fetchJson, async (_event, url: unknown) => {
    if (typeof url !== 'string' || !isTrustedProxyTarget(url)) {
      return { status: 403, statusText: 'Forbidden', ok: false, body: null };
    }
    try {
      const res = await net.fetch(url, { redirect: 'follow' });
      const body = await res.json().catch(() => null);
      return { status: res.status, statusText: res.statusText, ok: res.ok, body };
    } catch {
      throw new Error('Network error while fetching Subsonic server.');
    }
  });

  ipcMain.handle(IPC.mediaCache.stats, () => mediaCache?.stats() ?? null);
  ipcMain.handle(IPC.mediaCache.clear, async () => {
    await mediaCache?.clear();
    return mediaCache?.stats() ?? null;
  });

  ipcMain.on(IPC.playback.snapshot, (_event, snapshot: DesktopSnapshot) => {
    lastSnapshot = snapshot;
    updateTaskbarProgress(snapshot);
    updateThumbarButtons(snapshot);
    broadcastSnapshotToMiniPlayer(snapshot);
  });

  // Commands from the mini-player (a remote client) are validated and
  // forwarded to the playback owner in the main window.
  ipcMain.on(IPC.playback.clientCommand, (event, envelope: DesktopCommandEnvelope) => {
    if (!miniPlayerWindow || event.sender !== miniPlayerWindow.webContents) return;
    forwardCommand(envelope);
  });

  ipcMain.handle(IPC.miniPlayer.toggle, () => {
    toggleMiniPlayer();
  });
  ipcMain.handle(IPC.miniPlayer.showMain, () => {
    showMainWindow();
  });

  ipcMain.handle(IPC.updater.getState, () => updater.getState());
  ipcMain.handle(IPC.updater.check, () => updater.check());
  ipcMain.handle(IPC.updater.installAndRestart, () => {
    updater.installAndRestart();
  });
};

/**
 * The renderer is served from the custom `app://nebula` scheme, so its WebSocket
 * `Origin` header is `app://nebula`. The Stream Deck plugin only accepts
 * `http:`/`https:` origins on the loopback bridge handshake and otherwise closes
 * the socket with "Valid Origin required". Rewrite the Origin header for the
 * Stream Deck WebSocket endpoint so pairing works from the desktop build.
 */
const registerStreamDeckOriginRewrite = (): void => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.startsWith('ws://127.0.0.1:') && details.url.includes('/nebula/v1')) {
      const headers = { ...details.requestHeaders, Origin: 'http://localhost' };
      callback({ requestHeaders: headers });
      return;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
};

const onQuit = (): void => {
  isQuitting = true;
  app.quit();
};

// Must run before the app is ready: grants the custom scheme secure-origin
// privileges so the renderer can load from app://nebula and stream media.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    settingsStore = await SettingsStore.open(path.join(app.getPath('userData'), 'settings.json'));
    credentialVault = await CredentialVault.open(
      path.join(app.getPath('userData'), 'vault.json'),
      createSafeStorageCipher(),
    );
    mediaCache = await MediaCache.open({
      directory: path.join(app.getPath('userData'), 'media-cache'),
      maxBytes: (settingsStore.get<number>('mediaCacheMaxMb') ?? 4096) * 1024 * 1024,
      enabled: settingsStore.get('mediaCacheEnabled') !== false,
    });

    // Auto-update only runs in installed builds; dev launches use the web
    // bundle over `npm run dev` and must never attempt a check.
    updater = createUpdater({
      driver: autoUpdater,
      enabled: app.isPackaged,
      getCurrentVersion: () => app.getVersion(),
      getChannel: () => settingsStore.get('updateChannel') ?? 'stable',
      broadcast: (state) => {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC.updater.status, state);
        }
      },
      onDownloaded: (info) => showUpdateBalloon(info.version),
    });

    registerProtocol();
    registerIpc();
    registerStreamDeckOriginRewrite();

    mainWindow = createWindow();

    if (settingsStore.get('mediaKeysEnabled') === true) {
      registerMediaKeys({
        getEpoch: () => lastSnapshot?.epoch ?? 0,
        onCommand: forwardCommand,
      });
    }

    createTray({
      getWindow: () => mainWindow,
      getEpoch: () => lastSnapshot?.epoch ?? 0,
      onCommand: forwardCommand,
      onToggleMiniPlayer: toggleMiniPlayer,
      onQuit,
      onUpdateClick: () => updater.installAndRestart(),
    });

    // Check shortly after startup so the first launch isn't slowed down.
    if (app.isPackaged) {
      setTimeout(() => {
        void updater.check();
      }, 10_000);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
      else mainWindow?.show();
    });
  });

  // Tray app: closing the window hides it; do not quit on Windows.
  app.on('window-all-closed', () => {
    /* intentional no-op on win32 */
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    unregisterMediaKeys();
    destroyTray();
    updater?.dispose();
    void mediaCache?.persistIndex();
    miniPlayerWindow?.destroy();
    miniPlayerWindow = null;
  });
}
