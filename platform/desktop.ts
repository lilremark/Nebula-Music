import type {
  CredentialVault,
  DesktopSettingsApi,
  PlaybackTransport,
  Platform,
  PlatformApp,
  PlatformInfo,
  PlatformPower,
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
    onMaximizeChanged: (handler) => bridge.window.onMaximizeChanged(handler),
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

  // Media (audio streams, cover art) loads directly from the Subsonic server.
  // <audio> and <img> elements are not CORS-restricted, the CSP already allows
  // https media/img/connect, and the web build has always loaded media this
  // way without issue. Routing every stream through the main-process proxy
  // leaked connections there and eventually stalled playback after a handful
  // of tracks. Only http:// targets keep using the proxy because a secure
  // app:// context blocks plain-http media as mixed content.
  const resolveMediaUrl = (url: string): string => {
    if (!url) return url;
    if (/^https:\/\//i.test(url)) return url;
    if (/^http:\/\//i.test(url)) return bridge.http.proxyUrl(url);
    return url;
  };

  const app: PlatformApp = {
    onOpenSettings: (handler) => bridge.app.onOpenSettings(handler),
  };

  const power: PlatformPower = {
    onResumed: (handler) => bridge.power.onResumed(handler),
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
    app,
    openExternal: (url) => bridge.openExternal(url),
    settings,
    vault,
    playback,
    miniPlayer: {
      toggle: () => bridge.miniPlayer.toggle(),
      showMain: () => bridge.miniPlayer.showMain(),
    },
    power,
    updater: {
      getState: () => bridge.updater.getState(),
      check: () => bridge.updater.check(),
      installAndRestart: () => bridge.updater.installAndRestart(),
      openDownloadPage: () => bridge.updater.openDownloadPage(),
      onStatus: (handler) => bridge.updater.onStatus(handler),
    },
    fetchJson,
    resolveMediaUrl,
  };
};
