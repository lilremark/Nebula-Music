import React from 'react';
import type { CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';
import type { UpdaterState } from '../../electron/updater';
import { getTitleBarUpdateState } from './titleBarUpdateState';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

export const MacTitleBar: React.FC = () => {
    const platform = usePlatform();
    const isMac = platform?.info.os === 'darwin';
    const [state, setState] = React.useState<UpdaterState | null>(null);
    const [isHydrated, setIsHydrated] = React.useState(false);

    React.useEffect(() => {
        if (!isMac || !platform) return;
        void platform.updater.getState().then((initialState) => {
            setState(initialState);
            setIsHydrated(true);
        });
        return platform.updater.onStatus(setState);
    }, [isMac, platform]);

    if (!isMac) return null;

    const updaterState = state && isHydrated
        ? getTitleBarUpdateState(state)
        : {
            busy: false,
            hasUpdate: false,
            canCheck: false,
            tooltip: 'Loading update status',
            accessibleName: 'Loading update status',
        };

    const handleCheck = () => {
        if (!isHydrated || !state || !updaterState.canCheck || !platform) return;
        void platform.updater.check();
    };

    return (
        <div
            className="relative isolate h-8 flex items-center justify-between px-3 border-b border-neutral-200 dark:border-white/5"
            style={appRegion('drag')}
        >
            <div className="pointer-events-none absolute inset-0 -z-10 bg-white/80 dark:bg-black/20 backdrop-blur-xl" />
            <div className="w-24 shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                Nebula
            </span>
            <div className="w-24 shrink-0 flex justify-end">
                <button
                    type="button"
                    onClick={handleCheck}
                    disabled={!updaterState.canCheck}
                    aria-label={updaterState.accessibleName}
                    title={updaterState.tooltip}
                    className="relative p-1.5 rounded-lg text-neutral-500 dark:text-white/40 hover:bg-neutral-200 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 disabled:opacity-60"
                    style={appRegion('no-drag')}
                >
                    <RefreshCw className={`w-4 h-4 ${updaterState.busy ? 'animate-spin motion-reduce:animate-none' : ''}`} />
                    {updaterState.hasUpdate && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
                    )}
                </button>
                <span role="status" aria-live="polite" className="sr-only">
                    {updaterState.tooltip}
                </span>
            </div>
        </div>
    );
};
