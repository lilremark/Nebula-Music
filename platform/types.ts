import type { DesktopCommandEnvelope, DesktopSnapshot } from '../playback/desktopProtocol';
import type { SubsonicCredentials } from '../types';

export type PlatformKind = 'web' | 'desktop';

export interface PlatformInfo {
  kind: PlatformKind;
  os: string;
  appName: string | null;
  appVersion: string | null;
}

export interface WindowControl {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  isFullScreen(): Promise<boolean>;
}

export interface DesktopSettingsApi {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface CredentialVault {
  get(serverUrl: string): Promise<SubsonicCredentials | null>;
  set(credentials: SubsonicCredentials): Promise<void>;
  clear(serverUrl: string): Promise<void>;
}

/**
 * Command/snapshot transport between remote clients (tray, media keys, later
 * mini-player) in the main process and the playback owner in the renderer.
 * In the web build this is a no-op.
 */
export interface PlaybackTransport {
  onCommand(handler: (envelope: DesktopCommandEnvelope) => void): () => void;
  publishSnapshot(snapshot: DesktopSnapshot): void;
}

export interface JsonFetchResult {
  status: number;
  statusText: string;
  ok: boolean;
  body: unknown;
}

/**
 * Platform is the boundary between the renderer and the host. The web build
 * uses `web.ts`; the Electron build uses `desktop.ts` on top of the preload
 * bridge. Renderer code must never branch on `window.electron` directly.
 */
export interface Platform {
  readonly info: PlatformInfo;
  readonly window: WindowControl;
  openExternal(url: string): Promise<boolean>;
  readonly settings: DesktopSettingsApi;
  readonly vault: CredentialVault;
  readonly playback: PlaybackTransport;
  /** JSON fetch routed through the main process on desktop (bypasses CORS and
   * mixed-content policy for Subsonic servers). Web build uses global fetch. */
  fetchJson(url: string): Promise<JsonFetchResult>;
  /** Rewrites a media URL to the desktop proxy (or identity on web) so audio
   * and cover art load through the main process. */
  resolveMediaUrl(url: string): string;
}
