import { describe, expect, it } from 'vitest';
import type { UpdaterState } from '../electron/updater';
import { getUpdateAction, shouldShowDownloadedUpdateBanner } from './updateAction';

const state = (overrides: Partial<UpdaterState> = {}): UpdaterState => ({
  enabled: true,
  installMode: 'automatic',
  phase: 'idle',
  currentVersion: '2.4.0',
  newVersion: null,
  progress: null,
  message: null,
  ...overrides,
});

describe('getUpdateAction', () => {
  it('checks when automatic or manual mode is idle', () => {
    expect(getUpdateAction(state())).toEqual({ kind: 'check', label: 'Check for updates' });
    expect(getUpdateAction(state({ installMode: 'manual' }))).toEqual({ kind: 'check', label: 'Check for updates' });
  });

  it('opens a manual download for an available mac update', () => {
    expect(getUpdateAction(state({
      installMode: 'manual',
      phase: 'available',
      newVersion: '2.4.1',
    }))).toEqual({ kind: 'download', label: 'Download Nebula 2.4.1' });
  });

  it('installs only downloaded automatic updates', () => {
    expect(getUpdateAction(state({ phase: 'downloaded', newVersion: '2.4.1' })))
      .toEqual({ kind: 'install', label: 'Restart & Install' });
    expect(getUpdateAction(state({ installMode: 'manual', phase: 'downloaded', newVersion: '2.4.1' })))
      .toEqual({ kind: 'none', label: 'Update unavailable' });
  });

  it('has no action while disabled or busy', () => {
    expect(getUpdateAction(state({ enabled: false }))).toEqual({ kind: 'none', label: 'Update unavailable' });
    expect(getUpdateAction(state({ phase: 'checking' }))).toEqual({ kind: 'none', label: 'Checking\u2026' });
    expect(getUpdateAction(state({ phase: 'downloading', progress: 42 })))
      .toEqual({ kind: 'none', label: 'Downloading\u2026 42%' });
  });
});

describe('shouldShowDownloadedUpdateBanner', () => {
  it('shows only for downloaded automatic updates', () => {
    expect(shouldShowDownloadedUpdateBanner(state({ phase: 'downloaded' }))).toBe(true);
    expect(shouldShowDownloadedUpdateBanner(state({ installMode: 'manual', phase: 'downloaded' }))).toBe(false);
  });
});
