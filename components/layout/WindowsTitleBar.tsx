import React from 'react';
import type { CSSProperties } from 'react';
import { usePlatform } from '../../platform/PlatformContext';
import { WindowControls } from '../window/WindowControls';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

export const WindowsTitleBar: React.FC = () => {
    const platform = usePlatform();
    const isWindows = platform?.info.os === 'win32';

    if (!isWindows) return null;

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
                <WindowControls />
            </div>
        </div>
    );
};