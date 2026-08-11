import type { UpdaterState } from '../../electron/updater';

export interface TitleBarUpdateState {
  busy: boolean;
  hasUpdate: boolean;
  canCheck: boolean;
  tooltip: string;
}

export const getTitleBarUpdateState = (state: UpdaterState): TitleBarUpdateState => {
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const hasUpdate = state.phase === 'available' || state.phase === 'downloaded';
  const canCheck = state.enabled === true && !busy && !hasUpdate;
  const tooltip =
    state.message ??
    (state.enabled === true ? 'Check for updates' : 'Updates available in installed builds');
  return { busy, hasUpdate, canCheck, tooltip };
};
