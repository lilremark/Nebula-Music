import type { DesktopCommandEnvelope, DesktopSnapshot } from '../playback/desktopProtocol';
import type { SubsonicCredentials } from '../types';
import type { UpdaterState } from '../electron/updater';

/**
 * The shape of the `window.desktop` bridge exposed by the Electron preload
 * script. This is the *only* place the renderer references a host global.
 * The web build never imports this module and never sees `window.desktop`.
 */
export interface DesktopBridge {
  info: {
    os: string;
    appName: string;
    appVersion: string;
  };
  app: {
    onOpenSettings(handler: () => void): () => void;
  };
  window: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
    isFullScreen(): Promise<boolean>;
    onMaximizeChanged(handler: (maximized: boolean) => void): () => void;
  };
  openExternal(url: string): Promise<boolean>;
  settings: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  vault: {
    get(serverUrl: string): Promise<SubsonicCredentials | null>;
    set(credentials: SubsonicCredentials): Promise<void>;
    clear(serverUrl: string): Promise<void>;
    getSecret(key: string): Promise<string | null>;
    setSecret(key: string, value: string): Promise<void>;
    clearSecret(key: string): Promise<void>;
  };
  http: {
    fetchJson(url: string): Promise<{ status: number; statusText: string; ok: boolean; body: unknown }>;
    proxyUrl(url: string): string;
  };
  playback: {
    onCommand(handler: (envelope: DesktopCommandEnvelope) => void): () => void;
    publishSnapshot(snapshot: DesktopSnapshot): void;
    onSnapshot(handler: (snapshot: DesktopSnapshot) => void): () => void;
    sendCommand(envelope: DesktopCommandEnvelope): void;
  };
  miniPlayer: {
    toggle(): Promise<void>;
    showMain(): Promise<void>;
  };
  power: {
    onResumed(handler: () => void): () => void;
  };
  updater: {
    getState(): Promise<UpdaterState>;
    check(): Promise<boolean>;
    installAndRestart(): Promise<void>;
    openDownloadPage(): Promise<boolean>;
    onStatus(handler: (state: UpdaterState) => void): () => void;
  };
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
