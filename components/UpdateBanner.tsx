import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePlatform } from '../platform/PlatformContext';
import type { UpdaterState } from '../electron/updater';
import { shouldShowDownloadedUpdateBanner } from './updateAction';

export const UpdateBanner: React.FC = () => {
  const platform = usePlatform();
  const [state, setState] = useState<UpdaterState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!platform || platform.info.kind !== 'desktop') return;
    void platform.updater.getState().then(setState);
    return platform.updater.onStatus(setState);
  }, [platform]);

  if (!platform || platform.info.kind !== 'desktop') return null;
  if (!state || !shouldShowDownloadedUpdateBanner(state) || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-900 dark:text-emerald-300">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 shrink-0" />
        <span>
          Nebula {state.newVersion ?? ''} is ready to install.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => platform.updater.installAndRestart()}
          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-emerald-500"
        >
          Restart &amp; Install
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
          aria-label="Dismiss update notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
