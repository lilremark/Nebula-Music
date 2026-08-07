/**
 * Auto-update state machine wrapping electron-updater's AppUpdater.
 *
 * The driver (electron-updater's autoUpdater) is injected so the transitions
 * are unit-testable without Electron. The renderer never talks to
 * electron-updater directly; it subscribes to state over the preload bridge.
 */

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

export interface UpdaterState {
  /** False outside installed builds; check()/installAndRestart() are inert. */
  enabled: boolean;
  phase: UpdatePhase;
  currentVersion: string | null;
  newVersion: string | null;
  /** Download progress 0..100, null unless phase === 'downloading'. */
  progress: number | null;
  /** Human-readable line for the settings UI. */
  message: string | null;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

/**
 * The minimal surface of electron-updater's AppUpdater that the updater relies
 * on. Structurally satisfied by the real autoUpdater instance.
 */
export interface UpdaterDriver {
  channel: string | null;
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
  on(event: 'checking-for-update', listener: () => void): unknown;
  on(event: 'update-available', listener: (info: { version: string }) => void): unknown;
  on(event: 'update-not-available', listener: (info: { version: string }) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'download-progress', listener: (progress: UpdateDownloadProgress) => void): unknown;
  on(event: 'update-downloaded', listener: (info: { version: string }) => void): unknown;
  removeListener(event: string, listener: (...args: any[]) => void): unknown;
}

export interface UpdaterOptions {
  driver: UpdaterDriver;
  enabled: boolean;
  getCurrentVersion: () => string | null;
  /** Read the current update channel (stable/beta) from settings. */
  getChannel: () => string;
  /** Pushes every state change to listeners (windows, etc.). */
  broadcast: (state: UpdaterState) => void;
}

export interface Updater {
  getState(): UpdaterState;
  setChannel(channel: string): void;
  /** Returns true when a check was actually initiated. */
  check(): Promise<boolean>;
  installAndRestart(): void;
  dispose(): void;
}

const DISABLED_MESSAGE = 'Automatic updates are only available in installed builds.';

export const createUpdater = (options: UpdaterOptions): Updater => {
  const { driver, enabled, getCurrentVersion, getChannel, broadcast } = options;

  let state: UpdaterState = {
    enabled,
    phase: 'idle',
    currentVersion: getCurrentVersion(),
    newVersion: null,
    progress: null,
    message: enabled ? null : DISABLED_MESSAGE,
  };

  const emit = (patch: Partial<UpdaterState>): void => {
    state = { ...state, ...patch };
    broadcast(state);
  };

  if (enabled) {
    driver.channel = getChannel();
    driver.autoDownload = true;
    driver.autoInstallOnAppQuit = true;
  }

  const onChecking = (): void => emit({ phase: 'checking', message: 'Checking for updates\u2026' });
  const onAvailable = (info: { version: string }): void =>
    emit({ phase: 'available', newVersion: info.version, message: `Update ${info.version} is available.` });
  const onNotAvailable = (): void =>
    emit({ phase: 'not-available', newVersion: null, message: 'Nebula is up to date.' });
  const onError = (error: Error): void =>
    emit({ phase: 'error', message: error?.message ?? 'Update check failed.' });
  const onProgress = (progress: UpdateDownloadProgress): void =>
    emit({ phase: 'downloading', progress: progress.percent, message: 'Downloading update\u2026' });
  const onDownloaded = (info: { version: string }): void =>
    emit({
      phase: 'downloaded',
      newVersion: info.version,
      progress: 100,
      message: 'Restart Nebula to finish installing the update.',
    });

  driver.on('checking-for-update', onChecking);
  driver.on('update-available', onAvailable);
  driver.on('update-not-available', onNotAvailable);
  driver.on('error', onError);
  driver.on('download-progress', onProgress);
  driver.on('update-downloaded', onDownloaded);

  const check = async (): Promise<boolean> => {
    if (!enabled) return false;
    emit({ phase: 'checking', message: 'Checking for updates\u2026' });
    try {
      await driver.checkForUpdates();
      return true;
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Update check failed.'));
      return false;
    }
  };

  const setChannel = (channel: string): void => {
    if (enabled) driver.channel = channel;
  };

  const installAndRestart = (): void => {
    if (!enabled || state.phase !== 'downloaded') return;
    driver.quitAndInstall();
  };

  const dispose = (): void => {
    driver.removeListener('checking-for-update', onChecking);
    driver.removeListener('update-available', onAvailable);
    driver.removeListener('update-not-available', onNotAvailable);
    driver.removeListener('error', onError);
    driver.removeListener('download-progress', onProgress);
    driver.removeListener('update-downloaded', onDownloaded);
  };

  return {
    getState: () => ({ ...state }),
    setChannel,
    check,
    installAndRestart,
    dispose,
  };
};
