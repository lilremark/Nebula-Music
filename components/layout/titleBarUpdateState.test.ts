import { describe, it, expect } from 'vitest';
import type { UpdaterState } from '../../electron/updater';
import { getTitleBarUpdateState } from './titleBarUpdateState';

const base = (overrides: Partial<UpdaterState>): UpdaterState => ({
  enabled: true,
  phase: 'idle',
  currentVersion: '2.4.0',
  newVersion: null,
  progress: null,
  message: null,
  ...overrides,
});

describe('getTitleBarUpdateState', () => {
  it('is busy while checking or downloading', () => {
    expect(getTitleBarUpdateState(base({ phase: 'checking' })).busy).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'downloading' })).busy).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'idle' })).busy).toBe(false);
  });

  it('reports an update when available or downloaded', () => {
    expect(getTitleBarUpdateState(base({ phase: 'available', newVersion: '2.5.0' })).hasUpdate).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'downloaded', newVersion: '2.5.0' })).hasUpdate).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'idle' })).hasUpdate).toBe(false);
  });

  it('disables clicking while busy or when an update is available', () => {
    expect(getTitleBarUpdateState(base({ phase: 'checking' })).canCheck).toBe(false);
    expect(getTitleBarUpdateState(base({ phase: 'available' })).canCheck).toBe(false);
    expect(getTitleBarUpdateState(base({ phase: 'idle' })).canCheck).toBe(true);
  });

  it('is inert when updates are disabled', () => {
    expect(getTitleBarUpdateState(base({ enabled: false, phase: 'idle' })).canCheck).toBe(false);
    expect(getTitleBarUpdateState(base({ enabled: false, phase: 'idle' })).tooltip)
      .toBe('Updates available in installed builds');
  });

  it('uses the state message as the tooltip when present', () => {
    expect(getTitleBarUpdateState(base({ phase: 'available', message: 'Update 2.5.0 is available.' })).tooltip)
      .toBe('Update 2.5.0 is available.');
    expect(getTitleBarUpdateState(base({ phase: 'idle', enabled: true })).tooltip)
      .toBe('Check for updates');
  });
});
