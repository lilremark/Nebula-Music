import type { UpdaterState } from '../../electron/updater';
import { getUpdateAction } from '../updateAction';

export interface TitleBarUpdateState {
  busy: boolean;
  hasUpdate: boolean;
  action: 'none' | 'check' | 'download';
  tooltip: string;
  accessibleName: string;
}

export const getTitleBarUpdateState = (state: UpdaterState): TitleBarUpdateState => {
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const hasUpdate = state.phase === 'available' || state.phase === 'downloaded';
  const updateAction = getUpdateAction(state);
  const action = updateAction.kind === 'check' || updateAction.kind === 'download'
    ? updateAction.kind
    : 'none';
  const tooltip = action === 'download'
    ? updateAction.label
    : state.enabled === false
      ? 'Updates available in installed builds'
      : state.message ?? updateAction.label;
  const accessibleName = action === 'check' && tooltip !== 'Check for updates'
    ? `Check for updates. ${tooltip}`
    : tooltip;
  return { busy, hasUpdate, action, tooltip, accessibleName };
};
