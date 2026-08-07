import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createUpdater, type Updater, type UpdaterDriver, type UpdaterState } from './updater';

interface Harness {
  driver: UpdaterDriver;
  updater: Updater;
  checkForUpdates: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
  broadcast: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => boolean;
  getState: () => UpdaterState;
}

const makeHarness = (enabled = true): Harness => {
  const events = new EventEmitter();
  const checkForUpdates = vi.fn(async () => ({}));
  const quitAndInstall = vi.fn();
  const broadcast = vi.fn();
  const driver: UpdaterDriver = {
    channel: 'stable',
    autoDownload: true,
    autoInstallOnAppQuit: true,
    checkForUpdates,
    quitAndInstall,
    on: (event, listener) => {
      events.on(event, listener as (...args: unknown[]) => void);
      return events;
    },
    removeListener: (event, listener) => {
      events.removeListener(event, listener as (...args: unknown[]) => void);
      return events;
    },
  };
  const updater = createUpdater({
    driver,
    enabled,
    getCurrentVersion: () => '2.2.0',
    getChannel: () => 'stable',
    broadcast,
  });
  return {
    driver,
    updater,
    checkForUpdates,
    quitAndInstall,
    broadcast,
    emit: (event, ...args) => events.emit(event, ...args),
    getState: () => updater.getState(),
  };
};

describe('createUpdater', () => {
  it('starts idle with the current version and enables autoDownload', () => {
    const harness = makeHarness(true);
    expect(harness.getState()).toEqual({
      enabled: true,
      phase: 'idle',
      currentVersion: '2.2.0',
      newVersion: null,
      progress: null,
      message: null,
    });
    expect(harness.driver.channel).toBe('stable');
    expect(harness.driver.autoDownload).toBe(true);
    expect(harness.driver.autoInstallOnAppQuit).toBe(true);
  });

  it('is inert and explains itself when disabled', () => {
    const harness = makeHarness(false);
    expect(harness.getState().enabled).toBe(false);
    expect(harness.getState().message).toContain('installed builds');
  });

  it('check() no-ops when disabled', async () => {
    const harness = makeHarness(false);
    expect(await harness.updater.check()).toBe(false);
    expect(harness.checkForUpdates).not.toHaveBeenCalled();
    expect(harness.broadcast).not.toHaveBeenCalled();
  });

  it('check() broadcasts a checking state and asks the driver', async () => {
    const harness = makeHarness(true);
    await expect(harness.updater.check()).resolves.toBe(true);
    expect(harness.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(harness.broadcast).toHaveBeenCalledWith(expect.objectContaining({ phase: 'checking' }));
  });

  it('handles update-available', () => {
    const harness = makeHarness(true);
    harness.emit('update-available', { version: '2.3.0' });
    expect(harness.getState()).toMatchObject({
      phase: 'available',
      newVersion: '2.3.0',
      message: expect.stringContaining('2.3.0'),
    });
  });

  it('handles update-not-available', () => {
    const harness = makeHarness(true);
    harness.emit('update-not-available', { version: '2.2.0' });
    expect(harness.getState()).toMatchObject({ phase: 'not-available', newVersion: null });
  });

  it('tracks download progress', () => {
    const harness = makeHarness(true);
    harness.emit('download-progress', { percent: 42, transferred: 42, total: 100, bytesPerSecond: 1024 });
    expect(harness.getState()).toMatchObject({ phase: 'downloading', progress: 42 });
  });

  it('marks the update downloaded', () => {
    const harness = makeHarness(true);
    harness.emit('update-downloaded', { version: '2.3.0' });
    expect(harness.getState()).toMatchObject({ phase: 'downloaded', newVersion: '2.3.0', progress: 100 });
  });

  it('records an error state with the driver message', () => {
    const harness = makeHarness(true);
    harness.emit('error', new Error('no feed'));
    expect(harness.getState()).toMatchObject({ phase: 'error', message: 'no feed' });
  });

  it('surfaces synchronous check failures', async () => {
    const harness = makeHarness(true);
    harness.checkForUpdates.mockRejectedValueOnce(new Error('offline'));
    await harness.updater.check();
    expect(harness.getState()).toMatchObject({ phase: 'error', message: 'offline' });
  });

  it('only installs after the update is downloaded', () => {
    const harness = makeHarness(true);
    harness.updater.installAndRestart();
    expect(harness.quitAndInstall).not.toHaveBeenCalled();
    harness.emit('update-downloaded', { version: '2.3.0' });
    harness.updater.installAndRestart();
    expect(harness.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('setChannel updates the driver channel', () => {
    const harness = makeHarness(true);
    harness.updater.setChannel('beta');
    expect(harness.driver.channel).toBe('beta');
  });

  it('setChannel is a no-op when disabled', () => {
    const harness = makeHarness(false);
    harness.updater.setChannel('beta');
    expect(harness.driver.channel).toBe('stable');
  });

  it('dispose removes event listeners', () => {
    const harness = makeHarness(true);
    harness.updater.dispose();
    harness.emit('update-available', { version: '2.3.0' });
    expect(harness.getState().phase).toBe('idle');
    expect(harness.broadcast).not.toHaveBeenCalled();
  });
});
