import React, { useEffect, useMemo, useRef, useState } from 'react';

export type ProgressVisualizationMode = 'bar' | 'waveform';

interface PlaybackProgressProps {
    progress: number;
    mode: ProgressVisualizationMode;
    accentColor: string;
    baseColor?: string;
    markerColor?: string;
    secondaryColor?: string;
    waveform?: number[] | null;
    onScrub?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    scrubbable?: boolean;
    trackClassName?: string;
    trackStyle?: React.CSSProperties;
    showHandle?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const getWaveHeight = (peak: number) => `${Math.max(1, Math.min(98, peak * 100))}%`;
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

const WaveformBars = React.memo(({ peaks, color, secondary }: { peaks: number[]; color: string; secondary?: string }) => (
    <div className="h-full w-full flex items-end gap-[1px]" aria-hidden="true">
        {peaks.map((peak, index) => <span key={index} className="flex-1 min-w-0" style={{ height: getWaveHeight(peak), backgroundColor: color, backgroundImage: secondary ? `linear-gradient(180deg, ${secondary}, ${color})` : undefined }} />)}
    </div>
));

export const PlaybackProgress: React.FC<PlaybackProgressProps> = ({
    progress,
    mode,
    accentColor,
    baseColor,
    markerColor,
    secondaryColor,
    waveform,
    onScrub,
    scrubbable = true,
    trackClassName = '',
    trackStyle,
    showHandle = true,
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [barCount, setBarCount] = useState(320);
    useEffect(() => {
        const track = trackRef.current;
        if (!track || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setBarCount(Math.max(8, Math.floor(track.clientWidth / 3))));
        observer.observe(track);
        return () => observer.disconnect();
    }, []);
    const displayPeaks = useMemo(() => {
        if (!waveform || waveform.length <= barCount) return waveform;
        return Array.from({ length: barCount }, (_, index) => {
            const start = Math.floor(index * waveform.length / barCount);
            const end = Math.floor((index + 1) * waveform.length / barCount);
            return Math.max(...waveform.slice(start, end));
        });
    }, [waveform, barCount]);
    const safeProgress = clamp(progress, 0, 100);
    const effectiveMode = mode === 'waveform' && waveform?.length ? 'waveform' : 'bar';
    const progressClipPath = `inset(0 ${100 - safeProgress}% 0 0)`;
    const shouldShowMarker = effectiveMode === 'waveform' || showHandle;
    const resolvedBaseColor = baseColor || withAlpha(accentColor, effectiveMode === 'waveform' ? 0.28 : 0.18);
    const resolvedMarkerColor = markerColor || accentColor;
    const resolvedSecondaryColor = secondaryColor || resolvedMarkerColor;
    const progressGradient = `linear-gradient(90deg, ${accentColor}, ${resolvedSecondaryColor})`;
    const markerGradient = `linear-gradient(180deg, ${resolvedSecondaryColor}, ${accentColor})`;

    return (
        <div
            ref={trackRef}
            data-nebula-progress={effectiveMode}
            className={`relative ${effectiveMode === 'waveform' ? 'overflow-hidden' : 'overflow-visible'} ${trackClassName}`}
            style={{
                ...trackStyle,
            }}
        >
            {effectiveMode === 'waveform' ? (
                <>
                    <div className="absolute inset-0">
                        <WaveformBars peaks={displayPeaks!} color={resolvedBaseColor} />
                    </div>
                    <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ clipPath: progressClipPath }}
                    >
                        <WaveformBars peaks={displayPeaks!} color={accentColor} secondary={resolvedSecondaryColor} />
                    </div>
                </>
            ) : (
                <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit', backgroundColor: resolvedBaseColor }}>
                    <div data-nebula-progress-fill className="absolute inset-0" style={{ clipPath: progressClipPath, backgroundImage: progressGradient }} />
                </div>
            )}

            {shouldShowMarker && (
                <div
                    data-nebula-playhead
                    aria-hidden="true"
                    className="absolute w-[2px] pointer-events-none"
                    style={{
                        top: effectiveMode === 'bar' ? -6 : 0,
                        bottom: effectiveMode === 'bar' ? -6 : 0,
                        left: `calc(${safeProgress}% - 1px)`,
                        backgroundColor: resolvedMarkerColor,
                        backgroundImage: markerGradient,
                        boxShadow: `0 0 10px ${withAlpha(resolvedMarkerColor, 0.45)}`,
                    }}
                />
            )}

            {scrubbable && onScrub && (
                <input
                    type="range"
                    aria-label="Playback position"
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
