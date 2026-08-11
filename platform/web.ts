import type {
  CredentialVault,
  DesktopSettingsApi,
  PlaybackTransport,
  Platform,
  PlatformApp,
  PlatformInfo,
  UpdaterApi,
  WindowControl,
} from './types';

const webWindow: WindowControl = {
  minimize: async () => {},
  toggleMaximize: async () => {},
  close: async () => {},
  isMaximized: async () => false,
  isFullScreen: async () => false,
  onMaximizeChanged: () => () => {},
};

const webSettings: DesktopSettingsApi = {
  get: async () => null,
  set: async () => {},
};

const webVault: CredentialVault = {
  get: async () => null,
  set: async () => {},
  clear: async () => {},
  getSecret: async () => null,
  setSecret: async () => {},
  clearSecret: async () => {},
};

const noopUnsubscribe = (): void => {};

const webApp: PlatformApp = { onOpenSettings: () => noopUnsubscribe };

const webPlayback: PlaybackTransport = {
  onCommand: () => noopUnsubscribe,
  publishSnapshot: () => {},
  onSnapshot: () => noopUnsubscribe,
  sendCommand: () => {},
};

const webMiniPlayer = {
  toggle: async () => {},
  showMain: async () => {},
};

const webUpdater: UpdaterApi = {
  getState: async () => ({
    enabled: false,
    installMode: 'automatic',
    phase: 'idle',
    currentVersion: null,
    newVersion: null,
    progress: null,
    message: null,
  }),
  check: async () => false,
  installAndRestart: async () => {},
  openDownloadPage: async () => false,
  onStatus: () => noopUnsubscribe,
};

const webFetchJson = async (url: string) => {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  return { status: response.status, statusText: response.statusText, ok: response.ok, body };
};

const webInfo: PlatformInfo = {
  kind: 'web',
  os: 'web',
  appName: null,
  appVersion: null,
};

/**
 * The in-browser platform. All desktop-only capabilities are inert so the web
 * build behaves exactly as before.
 */
export const createWebPlatform = (): Platform => ({
  info: webInfo,
  window: webWindow,
  openExternal: (url) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  },
  settings: webSettings,
  vault: webVault,
  playback: webPlayback,
  app: webApp,
  miniPlayer: webMiniPlayer,
  updater: webUpdater,
  fetchJson: webFetchJson,
  resolveMediaUrl: (url) => url,
});
