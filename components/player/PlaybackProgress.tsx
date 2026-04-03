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
    return 0.1 + value * 0.5;
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
    const progressWidth = `${safeProgress}%`;
    const progressClipPath = `inset(0 ${100 - safeProgress}% 0 0)`;
    const shouldShowMarker = mode === 'waveform' || showHandle;

    const waveformBars = (barClassName: string, barStyle?: React.CSSProperties) => (
        <div className="h-full w-full flex items-end gap-[1px]">
            {peaks.map((peak, idx) => (
                <span
                    key={`wave-${idx}`}
                    className={`flex-1 min-w-[1px] ${barClassName}`}
                    style={{
                        height: getWaveHeight(peak),
                        ...barStyle,
                    }}
                />
            ))}
        </div>
    );

    return (
        <div className={`relative overflow-hidden ${trackClassName}`}>
            {mode === 'waveform' ? (
                <>
                    <div className="absolute inset-0">
                        {waveformBars('bg-neutral-500/55 dark:bg-white/25')}
                    </div>
                    <div
                        className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: progressClipPath }}
                    >
                        {waveformBars('', { backgroundColor: accentColor })}
                    </div>
                </>
            ) : (
                <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: progressWidth, backgroundColor: accentColor }}
                />
            )}

            {shouldShowMarker && (
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white/80 shadow-lg pointer-events-none"
                    style={{
                        left: `calc(${safeProgress}% - 6px)`,
                        backgroundColor: accentColor,
                        boxShadow: '0 0 0 2px rgba(10, 10, 10, 0.15)',
                    }}
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
