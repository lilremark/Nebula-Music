import type { UpdaterState } from '../../electron/updater';

export interface TitleBarUpdateState {
  busy: boolean;
  hasUpdate: boolean;
  canCheck: boolean;
  tooltip: string;
  accessibleName: string;
}

export const getTitleBarUpdateState = (state: UpdaterState): TitleBarUpdateState => {
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const hasUpdate = state.phase === 'available' || state.phase === 'downloaded';
  const canCheck = state.enabled === true && !busy && !hasUpdate;
  const tooltip =
    state.enabled === false
      ? 'Updates available in installed builds'
      : state.message ?? 'Check for updates';
  const accessibleName = canCheck && tooltip !== 'Check for updates'
    ? `Check for updates. ${tooltip}`
    : tooltip;
  return { busy, hasUpdate, canCheck, tooltip, accessibleName };
};
