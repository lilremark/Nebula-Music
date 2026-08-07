import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

interface WindowControlsProps {
    className?: string;
    buttonClassName?: string;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
    className = '',
    buttonClassName = '',
}) => {
    const platform = usePlatform();
    const [isMaximized, setIsMaximized] = useState(false);

    const isWindows = platform?.info.os === 'win32';

    useEffect(() => {
        if (!isWindows) return;
        void platform.window.isMaximized().then(setIsMaximized);
        return platform.window.onMaximizeChanged(setIsMaximized);
    }, [platform, isWindows]);

    if (!isWindows) return null;

    const buttonClass = `p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95 ${buttonClassName}`;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <button
                onClick={() => void platform.window.minimize()}
                className={buttonClass}
                aria-label="Minimize"
                style={appRegion('no-drag')}
            >
                <Minus className="w-5 h-5" />
            </button>
            <button
                onClick={() => void platform.window.toggleMaximize()}
                className={buttonClass}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                style={appRegion('no-drag')}
            >
                {isMaximized ? <Copy className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </button>
            <button
                onClick={() => void platform.window.close()}
                className={buttonClass}
                aria-label="Close"
                style={appRegion('no-drag')}
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
};
