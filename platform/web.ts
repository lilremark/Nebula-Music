import type {
  CredentialVault,
  DesktopSettingsApi,
  PlaybackTransport,
  Platform,
  PlatformApp,
  PlatformInfo,
  PlatformPower,
  UpdaterApi,
  WindowControl,
} from './types';
import { webSubsonicTransport } from '../services/subsonicTransport';

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

const webPower: PlatformPower = {
  onResumed: () => noopUnsubscribe,
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
      const target = new URL(url);
      if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password) {
        return Promise.resolve(false);
      }
      window.open(target.href, '_blank', 'noopener,noreferrer');
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
  power: webPower,
  updater: webUpdater,
  fetchJson: webSubsonicTransport.fetchJson,
  resolveMediaUrl: (url) => url,
});
