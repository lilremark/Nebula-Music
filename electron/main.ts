import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  net,
  powerMonitor,
  protocol,
  session,
  shell,
} from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { IPC } from './ipc';
import { isAllowedExternalUrl, isStreamDeckBridgeUrl } from './links';
import { releaseUrlForVersion } from './releaseUrl';
import { SettingsStore } from './settingsStore';
import { CredentialVault } from './credentialVault';
import { createSafeStorageCipher } from './safeStorageCipher';
import { createTray, destroyTray, showUpdateBalloon } from './tray';
import { registerMediaKeys, unregisterMediaKeys } from './mediaKeys';
import { createUpdater, type Updater } from './updater';
import { installMacAppMenu, updateMacPlaybackMenu } from './macMenu';
import { createCommandClient } from '../playback/commandClient';
import { createStreamProxy } from './streamProxy';
import { isRendererDocumentUrl, isTrustedRendererFrame, resolveRendererAsset } from './rendererSecurity';
import { fetchWithTrustedRedirects, UntrustedTargetError } from './trustedFetch';
import {
  desktopCommandEnvelopeSchema,
  desktopSnapshotSchema,
  type DesktopCommand,
  type DesktopCommandEnvelope,
  type DesktopSnapshot,
} from '../playback/desktopProtocol';
import { DjModelManager } from './aiDj/modelManager';
import { LocalDjRuntime } from './aiDj/localRuntime';
import { djPrepareSchema } from './aiDj/localProtocol';
import { randomUUID } from 'node:crypto';

const SCHEME = 'app';
const PROTOCOL_URL = 'app://nebula/';
const WINDOW_MIN = { width: 940, height: 600 };

// Served only to the desktop renderer (via the app://nebula protocol), so the
// Vite dev server keeps its own (CSP-less) environment for HMR. The renderer
// fetches Subsonic JSON through the main process and loads https media
// directly; only plain-http servers stream through the proxy. The renderer
// therefore needs self-origin, the Stream Deck loopback WebSocket, and https
// (direct server media, radio streams, lrclib lyrics, Google Fonts).
const CSP = [
  "default-src 'self' app://nebula",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: app://nebula https:",
  "media-src 'self' app://nebula https: blob:",
  "worker-src 'self' blob:",
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
let isQuitting = false;
let lastSnapshot: DesktopSnapshot | null = null;

const thumbarClient = createCommandClient('nebula-thumbar', () => lastSnapshot?.epoch ?? 0);

const forwardCommand = (envelope: DesktopCommandEnvelope): void => {
  mainWindow?.webContents.send(IPC.playback.command, envelope);
};

const broadcastSnapshotToMiniPlayer = (snapshot: DesktopSnapshot): void => {
  miniPlayerWindow?.webContents.send(IPC.playback.snapshotToClient, snapshot);
};

let localDj: LocalDjRuntime | null = null;
let djModels: DjModelManager | null = null;
const getDjModels = () => djModels ??= new DjModelManager(path.join(app.getPath('userData'), 'aiDj', 'smollm3-q4-kokoro-v1'), state => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(IPC.aiDj.modelsChanged, state); }, net.fetch as typeof fetch);
const getLocalDj = () => localDj ??= new LocalDjRuntime(getDjModels().resources, path.join(__dirname, 'voiceWorker.cjs'), app.isPackaged ? path.join(process.resourcesPath, 'aiDj') : path.join(app.getAppPath(), 'electron/aiDj/resources'));

// Snapshots arrive up to ~4x/sec (on `timeupdate`). Re-creating native images
// from disk and poking the Windows taskbar on every snapshot is measurable
// overhead and a known taskbar-freeze trigger, so the progress bar is only
// updated when it moves meaningfully and the thumbar buttons are re-applied
// only when their state changes or the window returns to the taskbar.
let lastTaskbarProgress = -1;

const updateTaskbarProgress = (snapshot: DesktopSnapshot): void => {
  if (!mainWindow || settingsStore.get('taskbarProgressEnabled') !== true) return;
  if (snapshot.playing && snapshot.durationSeconds > 0) {
    const value = Math.min(1, snapshot.positionSeconds / snapshot.durationSeconds);
    if (lastTaskbarProgress === -1 || Math.abs(value - lastTaskbarProgress) >= 0.01) {
      lastTaskbarProgress = value;
      mainWindow.setProgressBar(value);
    }
  } else if (lastTaskbarProgress !== -1) {
    lastTaskbarProgress = -1;
    mainWindow.setProgressBar(-1);
  }
};

let thumbarImages: {
  prev: Electron.NativeImage;
  next: Electron.NativeImage;
  play: Electron.NativeImage;
  pause: Electron.NativeImage;
} | null = null;
let thumbarState: { playing: boolean; ready: boolean } | null = null;

const getThumbarImages = (): NonNullable<typeof thumbarImages> => {
  if (thumbarImages) return thumbarImages;
  thumbarImages = {
    prev: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-prev.png')),
    next: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-next.png')),
    play: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-play.png')),
    pause: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-pause.png')),
  };
  return thumbarImages;
};

const updateThumbarButtons = (snapshot: DesktopSnapshot | null): void => {
  if (!mainWindow || mainWindow.isDestroyed() || process.platform !== 'win32' || !mainWindow.isVisible()) return;
  const playing = snapshot?.playing ?? false;
  const ready = snapshot !== null;
  if (thumbarState?.playing === playing && thumbarState.ready === ready) return;
  const images = getThumbarImages();
  const send = (command: DesktopCommand): void => forwardCommand(thumbarClient.send(command));
  const flags: Electron.ThumbarButton['flags'] = ready ? [] : ['disabled'];
  const added = mainWindow.setThumbarButtons([
    {
      icon: images.prev,
      tooltip: 'Previous',
      flags,
      click: () => send({ name: 'previous' }),
    },
    {
      icon: playing ? images.pause : images.play,
      tooltip: playing ? 'Pause' : 'Play',
      flags,
      click: () => send({ name: 'togglePlayback' }),
    },
    {
      icon: images.next,
      tooltip: 'Next',
      flags,
      click: () => send({ name: 'next' }),
    },
  ]);
  // Windows can reject registration before its taskbar button exists. Cache
  // only a successful registration so the next snapshot retries failures.
  thumbarState = added ? { playing, ready } : null;
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

// The proxy forwards the renderer's abort signal upstream so interrupted
// media requests release their server connection instead of leaking it until
// the stream finishes (which exhausts the connection pool and stalls playback).
const streamProxy = createStreamProxy({
  fetchImpl: (url, init) => net.fetch(url, init),
  isTrustedTarget: isTrustedProxyTarget,
});

const handleProtocol = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  if (url.host !== 'nebula' || url.username || url.password) {
    return new Response('Forbidden', { status: 403 });
  }

  if (url.pathname === '/proxy') return streamProxy.handle(request);

  const filePath = resolveRendererAsset(rendererRoot(), url.pathname);
  if (!filePath) return new Response('Forbidden', { status: 403 });

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
  thumbarState = null;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: WINDOW_MIN.width,
    minHeight: WINDOW_MIN.height,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 20, y: 10 } as const }
      : process.platform === 'win32'
        ? { frame: false }
        : {}),
    show: false,
    backgroundColor: '#000000',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // Keep the playback pipeline (hls.js buffering, crossfade, snapshot
      // publishing) alive while the window is minimized or hidden to tray.
      // Without this, Chromium pauses rAF and throttles timers to 1/sec, which
      // stalls live streams and leaves the app frozen after long minimize/sleep.
      backgroundThrottling: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isRendererDocumentUrl(url)) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event, url) => {
    if (!isRendererDocumentUrl(url)) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  win.on('close', (event) => {
    if (!isQuitting) {
      if (settingsStore.get('trayOnClose') === false) {
        isQuitting = true;
        app.quit();
        return;
      }
      event.preventDefault();
      win.hide();
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

  const refreshThumbar = (): void => {
    if (process.platform !== 'win32') return;
    thumbarState = null;
    // Let Windows create/recreate the taskbar button before registration.
    setImmediate(() => {
      if (!isQuitting && mainWindow === win) updateThumbarButtons(lastSnapshot);
    });
  };
  win.on('show', refreshThumbar);
  win.on('restore', refreshThumbar);

  win.webContents.on('did-finish-load', () => {
    console.log('[nebula] renderer loaded');
    win.webContents.send(IPC.miniPlayer.visibility, miniPlayerWindow?.isVisible() ?? false);
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
    width: 380,
    height: 320,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#101010',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!isRendererDocumentUrl(url)) event.preventDefault();
  });
  win.webContents.on('will-redirect', (event, url) => {
    if (!isRendererDocumentUrl(url)) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());

  // The mini-player is a companion window: closing it hides it instead of
  // destroying it, and never quits the app.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('show', () => mainWindow?.webContents.send(IPC.miniPlayer.visibility, true));
  win.on('hide', () => mainWindow?.webContents.send(IPC.miniPlayer.visibility, false));
  win.on('closed', () => mainWindow?.webContents.send(IPC.miniPlayer.visibility, false));
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
  // WebContents identity alone also trusts subframes and a navigated renderer.
  // Gate every channel at registration so new native APIs inherit the policy.
  const onTrusted = (channel: string, listener: (event: Electron.IpcMainEvent, ...args: any[]) => void): void => {
    ipcMain.on(channel, (event, ...args) => {
      if (!isTrustedSender(event.sender) || !isTrustedRendererFrame(event)) {
        event.returnValue = null;
        return;
      }
      listener(event, ...args);
    });
  };
  const handleTrusted = (channel: string, listener: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown): void => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedSender(event.sender) || !isTrustedRendererFrame(event)) throw new Error('Unauthorized.');
      return listener(event, ...args);
    });
  };
  onTrusted(IPC.app.info, (event) => {
    event.returnValue = {
      os: process.platform,
      appName: app.getName(),
      appVersion: app.getVersion(),
    };
  });

  handleTrusted(IPC.app.openExternal, (_event, url: unknown) => {
    if (typeof url !== 'string') return false;
    return openExternalSafely(url);
  });

  onTrusted(IPC.window.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  onTrusted(IPC.window.toggleMaximize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  onTrusted(IPC.window.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  handleTrusted(IPC.window.isMaximized, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false,
  );
  handleTrusted(IPC.window.isFullScreen, (event) =>
    BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false,
  );

  handleTrusted(IPC.settings.get, (_event, key: unknown) => {
    if (typeof key !== 'string') return null;
    return settingsStore.get(key) ?? null;
  });
  handleTrusted(IPC.settings.set, async (_event, key: unknown, value: unknown) => {
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
      else {
        lastTaskbarProgress = -1;
        mainWindow?.setProgressBar(-1);
      }
    } else if (key === 'updateChannel' && typeof value === 'string') {
      updater.setChannel(value);
    }
  });

  handleTrusted(IPC.vault.get, (event, serverUrl: unknown) => {
    if (!isTrustedSender(event.sender)) return null;
    if (typeof serverUrl !== 'string') return null;
    return credentialVault.get(serverUrl);
  });
  handleTrusted(IPC.vault.set, async (event, credentials: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    await credentialVault.set(credentials as Parameters<CredentialVault['set']>[0]);
  });
  handleTrusted(IPC.vault.clear, async (event, serverUrl: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    if (typeof serverUrl === 'string') await credentialVault.clear(serverUrl);
  });
  handleTrusted(IPC.vault.getSecret, (event, key: unknown) => {
    if (!isTrustedSender(event.sender)) return null;
    if (typeof key !== 'string') return null;
    return credentialVault.getSecret(key);
  });
  handleTrusted(IPC.vault.setSecret, async (event, key: unknown, value: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    if (typeof key !== 'string' || typeof value !== 'string') return;
    await credentialVault.setSecret(key, value);
  });
  handleTrusted(IPC.vault.clearSecret, async (event, key: unknown) => {
    if (!isTrustedSender(event.sender)) return;
    if (typeof key === 'string') await credentialVault.clearSecret(key);
  });

  handleTrusted(IPC.http.fetchJson, async (_event, url: unknown) => {
    if (typeof url !== 'string' || !isTrustedProxyTarget(url)) {
      return { status: 403, statusText: 'Forbidden', ok: false, body: null };
    }
    try {
      const res = await fetchWithTrustedRedirects(
        (target, init) => net.fetch(target, init),
        isTrustedProxyTarget,
        url,
        { signal: AbortSignal.timeout(30_000) },
      );
      const body = await res.json().catch(() => null);
      return { status: res.status, statusText: res.statusText, ok: res.ok, body };
    } catch (error) {
      if (error instanceof UntrustedTargetError) {
        return { status: 403, statusText: 'Forbidden', ok: false, body: null };
      }
      throw new Error('Network error while fetching Subsonic server.');
    }
  });

  onTrusted(IPC.playback.djEnergy, (event, energy: unknown) => {
    if (event.sender !== mainWindow?.webContents || !miniPlayerWindow?.isVisible()) return;
    if (energy !== 0 && !lastSnapshot?.dj?.playing) return;
    if (typeof energy !== 'number' || !Number.isFinite(energy) || energy < 0 || energy > 1) return;
    miniPlayerWindow.webContents.send(IPC.playback.djEnergyToClient, energy);
  });
  onTrusted(IPC.playback.snapshot, (event, snapshot: unknown) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    const parsed = desktopSnapshotSchema.safeParse(snapshot);
    if (!parsed.success) return;
    const validatedSnapshot = parsed.data;
    lastSnapshot = validatedSnapshot;
    if (process.platform === 'darwin') updateMacPlaybackMenu(validatedSnapshot);
    updateTaskbarProgress(validatedSnapshot);
    updateThumbarButtons(validatedSnapshot);
    broadcastSnapshotToMiniPlayer(validatedSnapshot);
  });

  // Commands from the mini-player (a remote client) are validated and
  // forwarded to the playback owner in the main window.
  onTrusted(IPC.playback.clientCommand, (event, envelope: unknown) => {
    if (!miniPlayerWindow || event.sender !== miniPlayerWindow.webContents) return;
    const parsed = desktopCommandEnvelopeSchema.safeParse(envelope);
    if (parsed.success) forwardCommand(parsed.data);
  });

  handleTrusted(IPC.miniPlayer.toggle, () => {
    toggleMiniPlayer();
  });
  handleTrusted(IPC.miniPlayer.showMain, () => {
    showMainWindow();
  });

  handleTrusted(IPC.updater.getState, (event) => {
    if (!isTrustedSender(event.sender)) return null;
    return updater.getState();
  });
  handleTrusted(IPC.updater.check, (event) => {
    if (!isTrustedSender(event.sender)) return false;
    return updater.check();
  });
  handleTrusted(IPC.updater.installAndRestart, (event) => {
    if (!isTrustedSender(event.sender)) return;
    updater.installAndRestart();
  });
  handleTrusted(IPC.updater.openDownloadPage, async (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return false;
    const state = updater.getState();
    if (
      !state.enabled ||
      state.installMode !== 'manual' ||
      state.phase !== 'available' ||
      !state.newVersion
    ) {
      return false;
    }
    const url = releaseUrlForVersion(state.newVersion);
    return url ? openExternalSafely(url) : false;
  });

  handleTrusted(IPC.aiDj.modelsStatus, async event => {
    if (event.sender !== mainWindow?.webContents) throw new Error('Unauthorized.');
    return getDjModels().status();
  });
  handleTrusted(IPC.aiDj.downloadModels, async event => {
    if (event.sender !== mainWindow?.webContents || lastSnapshot?.dj?.active) throw new Error('Stop DJ before downloading models.');
    localDj?.cancel(); localDj = null;
    return getDjModels().download();
  });
  handleTrusted(IPC.aiDj.cancelDownload, async event => {
    if (event.sender !== mainWindow?.webContents) throw new Error('Unauthorized.');
    getDjModels().cancel();
  });
  handleTrusted(IPC.aiDj.readiness, async (event) => {
    if (event.sender !== mainWindow?.webContents) return { ready: false, error: 'Unauthorized.' };
    const models = await getDjModels().status();
    return models.ready ? getLocalDj().readiness() : { ready: false, error: models.error || 'Download AI DJ models in Settings first.' };
  });
  handleTrusted(IPC.aiDj.prepare, async (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) throw new Error('Unauthorized.');
    return getLocalDj().prepare(djPrepareSchema.parse(request));
  });
  handleTrusted(IPC.aiDj.preview, async (event, voice: unknown) => {
    if (event.sender !== mainWindow?.webContents || !['Michael', 'Heart'].includes(String(voice))) throw new Error('Invalid voice preview.');
    return getLocalDj().prepare({ requestId: randomUUID(), sessionId: randomUUID(), tracks: [{ id: 'preview', title: 'your next set', artist: 'Nebula' }], taste: '', welcome: true, voice: voice as 'Michael' | 'Heart' }, true);
  });
  handleTrusted(IPC.aiDj.cancel, async (event) => {
    if (event.sender === mainWindow?.webContents) localDj?.cancel();
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
    if (isStreamDeckBridgeUrl(details.url)) {
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
  // GitHub/Fastly intermittently refuses Electron's HTTP/2 streams during the
  // auto-update check (net::ERR_HTTP2_SERVER_REFUSED_STREAM), which silently
  // breaks update discovery. Force the Chromium network stack to HTTP/1.1 so
  // update requests always succeed — GitHub serves these fine over HTTP/1.1.
  app.commandLine.appendSwitch('disable-http2');

  // On Windows, the taskbar groups windows by AppUserModelID. Without a
  // matching ID, secondary windows (mini-player, dialogs) can appear as a
  // second, overlapping Nebula icon in the taskbar. Set it up front so every
  // window joins the same taskbar entry as the packaged app (com.nebula.desktop).
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.nebula.desktop');
  }

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

    // Playback does not need device capture, location, or other browser grants.
    // Cover both asynchronous requests and Chromium's synchronous checks.
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    // Auto-update only runs in installed builds; dev launches use the web
    // bundle over `npm run dev` and must never attempt a check.
    updater = createUpdater({
      driver: autoUpdater,
      enabled: app.isPackaged,
      installMode: process.platform === 'darwin' ? 'manual' : 'automatic',
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

    if (process.platform === 'darwin') {
      installMacAppMenu({
        getWindow: () => mainWindow,
        getEpoch: () => lastSnapshot?.epoch ?? 0,
        onCommand: forwardCommand,
        toggleMiniPlayer,
        openSettings: () => {
          mainWindow?.show();
          mainWindow?.webContents.send(IPC.app.openSettings);
        },
      });
      // Dev launches run from the Electron binary and show its default Dock
      // icon; force the Nebula icon until the bundle .icns applies.
      if (!app.isPackaged) {
        app.dock?.setIcon(path.join(__dirname, '..', 'assets', 'icon.png'));
      }
    }

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

    // After the machine wakes from sleep the renderer's rAF/timer state can
    // lag the audio clock. Tell the owner bridge to re-publish a fresh
    // snapshot and re-sync the mini-player so tray/media-key/taskbar state and
    // the mini-player's progress reflect the real position again.
    powerMonitor.on('resume', () => {
      mainWindow?.webContents.send(IPC.power.resumed);
      if (lastSnapshot) broadcastSnapshotToMiniPlayer(lastSnapshot);
    });

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
    try {
      localDj?.cancel();
    } catch {
      // ignore
    }
    miniPlayerWindow?.destroy();
    miniPlayerWindow = null;
  });
}

app.on('before-quit', () => { localDj?.cancel(); djModels?.cancel(); });
