import type { UpdaterState } from '../electron/updater';

export type UpdateAction = {
  kind: 'none' | 'check' | 'download' | 'install';
  label: string;
};

export const getUpdateAction = (state: UpdaterState): UpdateAction => {
  if (!state.enabled) return { kind: 'none', label: 'Update unavailable' };
  if (state.phase === 'checking') return { kind: 'none', label: 'Checking\u2026' };
  if (state.phase === 'downloading') {
    return { kind: 'none', label: `Downloading\u2026 ${Math.round(state.progress ?? 0)}%` };
  }
  if (state.installMode === 'manual' && state.phase === 'available' && state.newVersion) {
    return { kind: 'download', label: `Download Nebula ${state.newVersion}` };
  }
  if (state.installMode === 'automatic' && state.phase === 'downloaded') {
    return { kind: 'install', label: 'Restart & Install' };
  }
  if (state.phase === 'available' || state.phase === 'downloaded') {
    return { kind: 'none', label: 'Update unavailable' };
  }
  return { kind: 'check', label: 'Check for updates' };
};

export const shouldShowDownloadedUpdateBanner = (state: UpdaterState): boolean =>
  state.installMode === 'automatic' && state.phase === 'downloaded';
