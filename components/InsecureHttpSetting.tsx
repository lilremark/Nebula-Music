import React from 'react';
import type { useInsecureHttpSetting } from '../hooks/useInsecureHttpSetting';

export const InsecureHttpSetting: React.FC<{ setting: ReturnType<typeof useInsecureHttpSetting> }> = ({ setting }) => {
    if (!setting.isDesktop) return null;
    return (
        <div className="space-y-2 text-xs">
            <label className="flex items-start gap-2 text-neutral-700 dark:text-white/70">
                <input type="checkbox" checked={setting.allowed} disabled={!setting.ready || setting.saving}
                    onChange={event => { void setting.change(event.target.checked); }} className="mt-0.5" />
                <span>Allow unencrypted HTTP server connections on this device. Your credentials and music traffic can be read by others on the network.</span>
            </label>
            {setting.error && <p role="alert" className="text-red-600 dark:text-red-400">{setting.error}</p>}
        </div>
    );
};
