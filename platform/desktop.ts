import type {
  CredentialVault,
  DesktopSettingsApi,
  PlaybackTransport,
  Platform,
  PlatformInfo,
  WindowControl,
} from './types';

/**
 * The Electron platform implementation, backed by the preload bridge
 * (`window.desktop`). This module is only ever dynamically imported by
 * `PlatformContext` when `window.desktop` is present, so the web build never
 * loads it.
 */
export const createDesktopPlatform = (): Platform => {
  const bridge = window.desktop;
  if (!bridge) {
    throw new Error(
      'createDesktopPlatform() requires window.desktop (run inside the Electron renderer).',
    );
  }

  const windowControl: WindowControl = {
    minimize: () => bridge.window.minimize(),
    toggleMaximize: () => bridge.window.toggleMaximize(),
    close: () => bridge.window.close(),
    isMaximized: () => bridge.window.isMaximized(),
    isFullScreen: () => bridge.window.isFullScreen(),
  };

  const settings: DesktopSettingsApi = {
    get: (key) => bridge.settings.get(key),
    set: (key, value) => bridge.settings.set(key, value),
  };

  const vault: CredentialVault = {
    get: (serverUrl) => bridge.vault.get(serverUrl),
    set: (credentials) => bridge.vault.set(credentials),
    clear: (serverUrl) => bridge.vault.clear(serverUrl),
    getSecret: (key) => bridge.vault.getSecret(key),
    setSecret: (key, value) => bridge.vault.setSecret(key, value),
    clearSecret: (key) => bridge.vault.clearSecret(key),
  };

  const playback: PlaybackTransport = {
    onCommand: (handler) => bridge.playback.onCommand(handler),
    publishSnapshot: (snapshot) => bridge.playback.publishSnapshot(snapshot),
    onSnapshot: (handler) => bridge.playback.onSnapshot(handler),
    sendCommand: (envelope) => bridge.playback.sendCommand(envelope),
  };

  const fetchJson = (url: string) => bridge.http.fetchJson(url);

  const resolveMediaUrl = (url: string): string => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return bridge.http.proxyUrl(url);
    return url;
  };

  const info: PlatformInfo = {
    kind: 'desktop',
    os: bridge.info.os,
    appName: bridge.info.appName,
    appVersion: bridge.info.appVersion,
  };

  return {
    info,
    window: windowControl,
    openExternal: (url) => bridge.openExternal(url),
    settings,
    vault,
    playback,
    miniPlayer: {
      toggle: () => bridge.miniPlayer.toggle(),
      showMain: () => bridge.miniPlayer.showMain(),
    },
    updater: {
      getState: () => bridge.updater.getState(),
      check: () => bridge.updater.check(),
      installAndRestart: () => bridge.updater.installAndRestart(),
      onStatus: (handler) => bridge.updater.onStatus(handler),
    },
    titleBar: {
      setTheme: (mode) => bridge.titleBar.setTheme(mode),
    },
    fetchJson,
    resolveMediaUrl,
  };
};
