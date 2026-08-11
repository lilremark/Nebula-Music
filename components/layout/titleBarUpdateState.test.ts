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
  it.each([
    ['idle', null, false, false, true, 'Check for updates', 'Check for updates'],
    ['checking', 'Checking for updates…', true, false, false, 'Checking for updates…', 'Checking for updates…'],
    ['available', 'Update 2.5.0 is available.', false, true, false, 'Update 2.5.0 is available.', 'Update 2.5.0 is available.'],
    ['downloading', 'Downloading update…', true, false, false, 'Downloading update…', 'Downloading update…'],
    ['downloaded', 'Restart Nebula to finish installing the update.', false, true, false, 'Restart Nebula to finish installing the update.', 'Restart Nebula to finish installing the update.'],
    ['not-available', 'Nebula is up to date.', false, false, true, 'Nebula is up to date.', 'Check for updates. Nebula is up to date.'],
    ['error', 'Update check failed.', false, false, true, 'Update check failed.', 'Check for updates. Update check failed.'],
  ] as const)('maps the %s phase', (phase, message, busy, hasUpdate, canCheck, tooltip, accessibleName) => {
    expect(getTitleBarUpdateState(base({ phase, message }))).toEqual({
      busy,
      hasUpdate,
      canCheck,
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

    expect(state.canCheck).toBe(false);
    expect(state.tooltip).toBe('Updates available in installed builds');
    expect(state.accessibleName).toBe('Updates available in installed builds');
  });

  it('uses the state message as the tooltip when present', () => {
    expect(getTitleBarUpdateState(base({ phase: 'available', message: 'Update 2.5.0 is available.' })).tooltip)
      .toBe('Update 2.5.0 is available.');
    expect(getTitleBarUpdateState(base({ phase: 'idle', enabled: true })).tooltip)
      .toBe('Check for updates');
  });
});
