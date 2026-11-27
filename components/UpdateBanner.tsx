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
    // Shared banner layout and tones: .nebula-banner in next-ui.css.
    <div className="nebula-banner nebula-banner-row" data-tone="success">
      <Download className="nebula-banner-icon" aria-hidden="true" />
      <span className="nebula-banner-copy">
        Nebula {state.newVersion ?? ''} is ready to install.
      </span>
      <div className="nebula-banner-actions">
        <button
          type="button"
          onClick={() => platform.updater.installAndRestart()}
          className="nebula-banner-button"
          data-variant="primary"
        >
          Restart &amp; Install
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="nebula-banner-dismiss"
          aria-label="Dismiss update notice"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
