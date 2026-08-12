import { describe, it, expect } from 'vitest';
import type { UpdaterState } from '../../electron/updater';
import { getTitleBarUpdateState } from './titleBarUpdateState';

const base = (overrides: Partial<UpdaterState>): UpdaterState => ({
  enabled: true,
  installMode: 'automatic',
  phase: 'idle',
  currentVersion: '2.4.0',
  newVersion: null,
  progress: null,
  message: null,
  ...overrides,
});

describe('getTitleBarUpdateState', () => {
  it.each([
    ['idle', null, false, false, 'check', 'Check for updates', 'Check for updates'],
    ['checking', 'Checking for updates…', true, false, 'none', 'Checking for updates…', 'Checking for updates…'],
    ['available', 'Update 2.5.0 is available.', false, true, 'none', 'Update 2.5.0 is available.', 'Update 2.5.0 is available.'],
    ['downloading', 'Downloading update…', true, false, 'none', 'Downloading update…', 'Downloading update…'],
    ['downloaded', 'Restart Nebula to finish installing the update.', false, true, 'none', 'Restart Nebula to finish installing the update.', 'Restart Nebula to finish installing the update.'],
    ['not-available', 'Nebula is up to date.', false, false, 'check', 'Nebula is up to date.', 'Check for updates. Nebula is up to date.'],
    ['error', 'Update check failed.', false, false, 'check', 'Update check failed.', 'Check for updates. Update check failed.'],
  ] as const)('maps the %s phase', (phase, message, busy, hasUpdate, action, tooltip, accessibleName) => {
    expect(getTitleBarUpdateState(base({ phase, message }))).toEqual({
      busy,
      hasUpdate,
      action,
      tooltip,
      accessibleName,
    });
  });

  it('is inert and uses installed-build copy when updates are disabled', () => {
    const state = getTitleBarUpdateState(base({
      enabled: false,
      phase: 'idle',
      message: 'Automatic updates are only available in installed builds.',
    }));

    expect(state.action).toBe('none');
    expect(state.tooltip).toBe('Updates available in installed builds');
    expect(state.accessibleName).toBe('Updates available in installed builds');
  });

  it('presents a manual available update as a download action', () => {
    expect(getTitleBarUpdateState(base({
      installMode: 'manual',
      phase: 'available',
      newVersion: '2.4.1',
      message: 'Update 2.4.1 is available.',
    }))).toEqual({
      busy: false,
      hasUpdate: true,
      action: 'download',
      tooltip: 'Download Nebula 2.4.1',
      accessibleName: 'Download Nebula 2.4.1',
    });
  });

  it('uses the state message as the tooltip when present', () => {
    expect(getTitleBarUpdateState(base({ phase: 'available', message: 'Update 2.5.0 is available.' })).tooltip)
      .toBe('Update 2.5.0 is available.');
    expect(getTitleBarUpdateState(base({ phase: 'idle', enabled: true })).tooltip)
      .toBe('Check for updates');
  });
});
