import React from 'react';
import type { useInsecureHttpSetting } from '../hooks/useInsecureHttpSetting';

export const InsecureHttpSetting: React.FC<{ setting: ReturnType<typeof useInsecureHttpSetting> }> = ({ setting }) => {
    if (!setting.isDesktop) return null;
    return (
        <div data-nebula-http-consent className="mb-4 space-y-2 rounded-lg border border-neutral-200 bg-neutral-100/60 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
            <label className="flex cursor-pointer items-start gap-3 text-neutral-700 dark:text-white/70">
                <input type="checkbox" checked={setting.allowed} disabled={!setting.ready || setting.saving}
                    onChange={event => { void setting.change(event.target.checked); }} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
                <span className="min-w-0 leading-relaxed">
                    <span className="block font-semibold text-neutral-900 dark:text-white">Allow unencrypted HTTP server connections on this device</span>
                    <span className="mt-1 block text-neutral-600 dark:text-white/55">Your credentials and music traffic can be read by others on the network.</span>
                </span>
            </label>
            {setting.error && <p role="alert" className="text-red-600 dark:text-red-400">{setting.error}</p>}
        </div>
    );
};
