import type { DesktopCommandEnvelope, DesktopSnapshot } from '../playback/desktopProtocol';
import type { SubsonicCredentials } from '../types';
import type { UpdaterState } from '../electron/updater';

export type PlatformKind = 'web' | 'desktop';

export interface PlatformInfo {
  kind: PlatformKind;
  os: string;
  appName: string | null;
  appVersion: string | null;
}

export interface PlatformApp {
  /** Subscribes to a "open settings" request from the native app menu. */
  onOpenSettings(handler: () => void): () => void;
}

export interface WindowControl {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  isFullScreen(): Promise<boolean>;
  onMaximizeChanged(handler: (maximized: boolean) => void): () => void;
}

export interface DesktopSettingsApi {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface CredentialVault {
  get(serverUrl: string): Promise<SubsonicCredentials | null>;
  set(credentials: SubsonicCredentials): Promise<void>;
  clear(serverUrl: string): Promise<void>;
  /** Generic OS-safeStorage-backed secret storage for non-credential secrets. */
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  clearSecret(key: string): Promise<void>;
}

/**
 * Command/snapshot transport between the playback owner and remote clients
 * (tray, media keys, mini-player). In the main window the transport is used
 * by the owner bridge to receive commands and publish snapshots; in the
 * mini-player window the same transport is used in the reverse direction:
 * subscribe to snapshots and send commands. In the web build this is a no-op.
 */
export interface PlaybackTransport {
  onCommand(handler: (envelope: DesktopCommandEnvelope) => void): () => void;
  publishSnapshot(snapshot: DesktopSnapshot): void;
  onSnapshot(handler: (snapshot: DesktopSnapshot) => void): () => void;
  sendCommand(envelope: DesktopCommandEnvelope): void;
}

export interface JsonFetchResult {
  status: number;
  statusText: string;
  ok: boolean;
  body: unknown;
}

export interface MiniPlayerControl {
  /** Toggles the always-on-top mini-player window (main window only). */
  toggle(): Promise<void>;
  /** Shows and focuses the main Nebula window (mini-player window only). */
  showMain(): Promise<void>;
}

/** Auto-update surface. Inert (enabled: false) in the web build and in dev. */
export interface UpdaterApi {
  getState(): Promise<UpdaterState>;
  /** Returns true when an update check was initiated. */
  check(): Promise<boolean>;
  /** Installs the downloaded update and restarts (no-op until downloaded). */
  installAndRestart(): Promise<void>;
  /** Opens the available manual update's validated release page. */
  openDownloadPage(): Promise<boolean>;
  /** Subscribes to state pushes; returns an unsubscribe function. */
  onStatus(handler: (state: UpdaterState) => void): () => void;
}

/**
 * Platform is the boundary between the renderer and the host. The web build
 * uses `web.ts`; the Electron build uses `desktop.ts` on top of the preload
 * bridge. Renderer code must never branch on `window.electron` directly.
 */
export interface Platform {
  readonly info: PlatformInfo;
  readonly window: WindowControl;
  readonly app: PlatformApp;
  openExternal(url: string): Promise<boolean>;
  readonly settings: DesktopSettingsApi;
  readonly vault: CredentialVault;
  readonly playback: PlaybackTransport;
  readonly miniPlayer: MiniPlayerControl;
  readonly updater: UpdaterApi;
  /** JSON fetch routed through the main process on desktop (bypasses CORS and
   * mixed-content policy for Subsonic servers). Web build uses global fetch. */
  fetchJson(url: string): Promise<JsonFetchResult>;
  /** Rewrites a media URL to the desktop proxy (or identity on web) so audio
   * and cover art load through the main process. */
  resolveMediaUrl(url: string): string;
}
