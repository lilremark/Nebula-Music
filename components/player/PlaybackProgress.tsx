import React from 'react';

export type ProgressVisualizationMode = 'bar' | 'waveform';

interface PlaybackProgressProps {
    progress: number;
    mode: ProgressVisualizationMode;
    accentColor: string;
    baseColor?: string;
    markerColor?: string;
    waveform?: number[] | null;
    onScrub?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    scrubbable?: boolean;
    trackClassName?: string;
    trackStyle?: React.CSSProperties;
    showHandle?: boolean;
}

const FALLBACK_WAVEFORM = Array.from({ length: 180 }, (_, i) => {
    const phase = i / 180;
    const value = Math.abs(Math.sin(phase * Math.PI * 4));
    return 0.1 + value * 0.5;
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getWaveHeight = (peak: number) => `${Math.max(10, Math.min(98, peak * 100))}%`;
const withAlpha = (color: string, alpha: number) => {
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const normalized = hex.length === 3
            ? hex.split('').map(char => char + char).join('')
            : hex;

        if (normalized.length === 6) {
            const r = parseInt(normalized.slice(0, 2), 16);
            const g = parseInt(normalized.slice(2, 4), 16);
            const b = parseInt(normalized.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    }

    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }

    if (color.startsWith('rgba(')) {
        return color.replace(/rgba\((.+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
    }

    return color;
};

export const PlaybackProgress: React.FC<PlaybackProgressProps> = ({
    progress,
    mode,
    accentColor,
    baseColor,
    markerColor,
    waveform,
    onScrub,
    scrubbable = true,
    trackClassName = '',
    trackStyle,
    showHandle = false,
}) => {
    const safeProgress = clamp(progress, 0, 100);
    const peaks = waveform && waveform.length ? waveform : FALLBACK_WAVEFORM;
    const progressWidth = `${safeProgress}%`;
    const progressClipPath = `inset(0 ${100 - safeProgress}% 0 0)`;
    const shouldShowMarker = mode === 'waveform' || showHandle;
    const resolvedBaseColor = baseColor || withAlpha(accentColor, mode === 'waveform' ? 0.28 : 0.18);
    const resolvedMarkerColor = markerColor || accentColor;

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
        <div
            className={`relative overflow-hidden ${trackClassName}`}
            style={{
                ...(mode === 'bar' ? { backgroundColor: resolvedBaseColor } : undefined),
                ...trackStyle,
            }}
        >
            {mode === 'waveform' ? (
                <>
                    <div className="absolute inset-0">
                        {waveformBars('', { backgroundColor: resolvedBaseColor })}
                    </div>
                    <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: progressClipPath, transition: 'clip-path 180ms linear' }}
                    >
                        {waveformBars('', { backgroundColor: accentColor })}
                    </div>
                </>
            ) : (
                <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: progressWidth, backgroundColor: accentColor, transition: 'width 180ms linear' }}
                />
            )}

            {shouldShowMarker && (
                mode === 'waveform' ? (
                    <div
                        className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
                        style={{
                            left: `calc(${safeProgress}% - 1px)`,
                            backgroundColor: resolvedMarkerColor,
                            boxShadow: `0 0 10px ${withAlpha(resolvedMarkerColor, 0.45)}`,
                        }}
                    />
                ) : (
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white/80 shadow-lg pointer-events-none"
                        style={{
                            left: `calc(${safeProgress}% - 6px)`,
                            backgroundColor: resolvedMarkerColor,
                            boxShadow: `0 0 0 2px ${withAlpha(resolvedMarkerColor, 0.2)}`,
                        }}
                    />
                )
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
