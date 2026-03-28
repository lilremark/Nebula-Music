import React from 'react';

export type ProgressVisualizationMode = 'bar' | 'waveform';

interface PlaybackProgressProps {
    progress: number;
    mode: ProgressVisualizationMode;
    accentColor: string;
    waveform?: number[] | null;
    onScrub?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    scrubbable?: boolean;
    trackClassName?: string;
    showHandle?: boolean;
}

const FALLBACK_WAVEFORM = Array.from({ length: 180 }, (_, i) => {
    const phase = i / 180;
    const value = Math.abs(Math.sin(phase * Math.PI * 4));
    return 0.2 + value * 0.7;
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getWaveHeight = (peak: number) => `${Math.max(10, Math.min(98, peak * 100))}%`;

export const PlaybackProgress: React.FC<PlaybackProgressProps> = ({
    progress,
    mode,
    accentColor,
    waveform,
    onScrub,
    scrubbable = true,
    trackClassName = '',
    showHandle = false,
}) => {
    const safeProgress = clamp(progress, 0, 100);
    const peaks = waveform && waveform.length ? waveform : FALLBACK_WAVEFORM;

    return (
        <div className={`relative overflow-hidden ${trackClassName}`}>
            {mode === 'waveform' ? (
                <>
                    <div className="absolute inset-0">
                        <div className="h-full w-full flex items-center gap-0">
                            {peaks.map((peak, idx) => (
                                <span
                                    key={`inactive-${idx}`}
                                    className="flex-1 min-w-[1px] bg-neutral-500/50 dark:bg-white/25 self-center"
                                    style={{ height: getWaveHeight(peak) }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${safeProgress}%` }}>
                        <div className="absolute inset-0">
                            <div className="h-full w-full flex items-center gap-0">
                                {peaks.map((peak, idx) => (
                                    <span
                                        key={`active-${idx}`}
                                        className="flex-1 min-w-[1px] self-center"
                                        style={{ height: getWaveHeight(peak), backgroundColor: accentColor }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <div
                        className="absolute top-0 bottom-0 w-[2px] bg-white/80 dark:bg-white/70 pointer-events-none"
                        style={{ left: `calc(${safeProgress}% - 1px)` }}
                    />
                </>
            ) : (
                <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${safeProgress}%`, backgroundColor: accentColor }}
                />
            )}

            {showHandle && (
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg pointer-events-none"
                    style={{ left: `calc(${safeProgress}% - 6px)` }}
                />
            )}

            {scrubbable && onScrub && (
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={safeProgress}
                    onChange={onScrub}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            )}
        </div>
    );
};
