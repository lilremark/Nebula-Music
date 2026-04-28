import React from 'react';
import { Activity, ChevronDown, ExternalLink, Maximize2, Music2, PanelRight, PanelRightClose, Pause, Play, Radio, Square, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useStore } from '../../context/Store';
import { useAdaptiveColors } from '../../hooks/useAdaptiveColors';

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

    return color;
};

const RadioBadge = () => (
    <span className="inline-flex items-center gap-1.5 rounded bg-red-500/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        Live
    </span>
);

const StationArt: React.FC<{ sizeClass: string; imageUrl?: string; label?: string }> = ({ sizeClass, imageUrl, label }) => {
    const { currentRadioStation } = useStore();
    const artworkUrl = imageUrl || currentRadioStation?.imageUrl;
    return (
        <div className={`${sizeClass} overflow-hidden rounded-lg bg-neutral-200 shadow-xl dark:bg-white/10`}>
            {artworkUrl ? (
                <img src={artworkUrl} alt={label || ''} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-secondary/25">
                    <Radio className="h-1/2 w-1/2 text-primary" />
                </div>
            )}
        </div>
    );
};

const VolumeSlider: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => {
    const { volume, setVolume } = useStore();
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <button
                onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                className={`${compact ? 'p-1.5' : 'p-2'} text-neutral-600 transition-colors hover:text-neutral-900 dark:text-white/60 dark:hover:text-white`}
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            >
                {volume === 0 ? <VolumeX className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : volume < 0.5 ? <Volume1 className={compact ? 'h-4 w-4' : 'h-5 w-5'} /> : <Volume2 className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
            </button>
            <div className="group relative h-1.5 flex-1 rounded bg-neutral-300 dark:bg-white/10">
                <div
                    className="absolute inset-y-0 left-0 rounded bg-neutral-800 dark:bg-white/60"
                    style={{ width: `${volume * 100}%` }}
                />
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
            </div>
        </div>
    );
};

const LiveRadioVisualizer: React.FC<{ isPlaying: boolean; primaryColor: string; secondaryColor: string; className?: string }> = ({ isPlaying, primaryColor, secondaryColor, className = '' }) => {
    const bars = Array.from({ length: 54 }, (_, index) => {
        const height = 24 + ((index * 29) % 62);
        const duration = 760 + ((index * 83) % 620);
        const delay = -((index * 47) % 700);
        return { height, duration, delay };
    });

    return (
        <div className={`flex items-end justify-center gap-1.5 overflow-hidden ${className || 'h-40'}`}>
            {bars.map((bar, index) => (
                <span
                    key={index}
                    className="radio-live-bar block w-1.5 rounded-full"
                    style={{
                        height: `${bar.height}%`,
                        animationDuration: `${bar.duration}ms`,
                        animationDelay: `${bar.delay}ms`,
                        animationPlayState: isPlaying ? 'running' : 'paused',
                        background: `linear-gradient(180deg, ${secondaryColor}, ${primaryColor})`,
                        boxShadow: `0 0 18px ${withAlpha(primaryColor, 0.32)}`,
                        opacity: isPlaying ? 0.95 : 0.35,
                    }}
                />
            ))}
        </div>
    );
};

const useRadioDisplay = () => {
    const { currentRadioStation, radioMetadata, isRadioMetadataLoading } = useStore();
    const artworkUrl = radioMetadata?.artworkUrl || currentRadioStation?.imageUrl;
    const title = radioMetadata?.title || currentRadioStation?.name || '';
    const artist = radioMetadata?.artist || currentRadioStation?.genre || 'Internet radio';
    const album = radioMetadata?.album;
    const subtitle = radioMetadata?.artist ? currentRadioStation?.name : currentRadioStation?.streamUrl;
    return { artworkUrl, title, artist, album, subtitle, radioMetadata, isRadioMetadataLoading };
};

export const RadioSidebarPanel: React.FC<{ onExpand: () => void; onCollapse: () => void }> = ({ onExpand, onCollapse }) => {
    const { currentRadioStation, isRadioPlaying, toggleRadioPlay, stopRadio } = useStore();
    const { artworkUrl, title, artist } = useRadioDisplay();
    if (!currentRadioStation) return null;

    return (
        <div className="flex h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-primary/10 via-transparent to-secondary/10 p-6">
            <div className="mb-4 flex w-full items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">Internet Radio</span>
                <button
                    onClick={onCollapse}
                    className="rounded-lg p-2 text-neutral-600 transition hover:bg-neutral-300 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Collapse radio panel"
                >
                    <PanelRightClose className="h-5 w-5" />
                </button>
            </div>

            <button onClick={onExpand} className="mb-6 block transition hover:scale-[1.02]">
                <StationArt sizeClass="h-56 w-56" imageUrl={artworkUrl} label={title} />
            </button>
            <RadioBadge />
            <h2 className="mt-4 max-w-full truncate text-center text-2xl font-black text-neutral-900 dark:text-white">{title}</h2>
            <p className="mt-1 max-w-full truncate text-sm text-neutral-600 dark:text-white/60">{artist}</p>

            <div className="mt-8 flex items-center justify-center gap-4">
                <button
                    onClick={stopRadio}
                    className="rounded-lg p-4 text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Stop radio"
                >
                    <Square className="h-5 w-5 fill-current" />
                </button>
                <button
                    onClick={toggleRadioPlay}
                    className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-black shadow-xl transition hover:scale-105"
                    aria-label={isRadioPlaying ? 'Pause radio' : 'Play radio'}
                >
                    {isRadioPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-0.5 h-7 w-7 fill-current" />}
                </button>
                <button
                    onClick={onExpand}
                    className="rounded-lg p-4 text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Open radio player"
                >
                    <Maximize2 className="h-5 w-5" />
                </button>
            </div>

            <VolumeSlider className="mt-8 w-full max-w-xs" />
        </div>
    );
};

export const RadioFloatingMiniPlayer: React.FC<{ onExpand: () => void; onRestoreSidebar: () => void }> = ({ onExpand, onRestoreSidebar }) => {
    const { currentRadioStation, isRadioPlaying, toggleRadioPlay, stopRadio } = useStore();
    const { artworkUrl, title, artist } = useRadioDisplay();
    if (!currentRadioStation) return null;

    return (
        <div className="flex w-[680px] max-w-[calc(100vw-24px)] items-center gap-3 overflow-hidden rounded-xl border border-neutral-300 bg-neutral-100 p-3 shadow-2xl dark:border-white/10 dark:bg-neutral-900/95">
            <StationArt sizeClass="h-12 w-12 shrink-0" imageUrl={artworkUrl} label={title} />
            <div className="min-w-0 flex-1">
                <div className="mb-1"><RadioBadge /></div>
                <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">{title}</p>
                <p className="truncate text-xs text-neutral-600 dark:text-white/50">{artist}</p>
            </div>
            <VolumeSlider className="hidden w-32 shrink-0 sm:flex" compact />
            <button onClick={stopRadio} className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Stop radio">
                <Square className="h-4 w-4 fill-current" />
            </button>
            <button onClick={toggleRadioPlay} className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-black" aria-label={isRadioPlaying ? 'Pause radio' : 'Play radio'}>
                {isRadioPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>
            <button onClick={onRestoreSidebar} className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Show radio sidebar">
                <PanelRight className="h-4 w-4" />
            </button>
            <button onClick={onExpand} className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Open radio player">
                <Maximize2 className="h-4 w-4" />
            </button>
        </div>
    );
};

export const RadioMobileBar: React.FC<{ onExpand: () => void }> = ({ onExpand }) => {
    const { currentRadioStation, isRadioPlaying, toggleRadioPlay } = useStore();
    const { artworkUrl, title, artist } = useRadioDisplay();
    if (!currentRadioStation) return null;

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-neutral-950/95">
            <div className="flex items-center gap-3" onClick={onExpand}>
                <StationArt sizeClass="h-12 w-12 shrink-0" imageUrl={artworkUrl} label={title} />
                <div className="min-w-0 flex-1">
                    <div className="mb-1"><RadioBadge /></div>
                    <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">{title}</p>
                    <p className="truncate text-xs text-neutral-600 dark:text-white/50">{artist}</p>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); toggleRadioPlay(); }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-black"
                    aria-label={isRadioPlaying ? 'Pause radio' : 'Play radio'}
                >
                    {isRadioPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </button>
            </div>
        </div>
    );
};

export const RadioFullPlayer: React.FC<{ isExpanded: boolean; onClose: () => void }> = ({ isExpanded, onClose }) => {
    const { currentRadioStation, isRadioPlaying, toggleRadioPlay, stopRadio } = useStore();
    const { artworkUrl, title, artist, album, subtitle, radioMetadata, isRadioMetadataLoading } = useRadioDisplay();
    const { colors } = useAdaptiveColors(artworkUrl);
    if (!currentRadioStation) return null;

    return (
        <div
            className={`fixed inset-0 z-[60] flex flex-col bg-neutral-950 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isExpanded ? 'translate-y-0' : 'translate-y-full'}`}
            style={{
                backgroundColor: '#0a0a0a',
                backgroundImage: colors.gradient,
            }}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `radial-gradient(circle, ${withAlpha(colors.primary, 0.18)} 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-25 blur-md">
                <LiveRadioVisualizer isPlaying={isRadioPlaying} primaryColor={colors.primary} secondaryColor={colors.secondary || colors.primary} className="h-full" />
            </div>

            <header className="relative z-20 flex items-center justify-between p-4 md:p-6">
                <button
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition-all hover:bg-white/20 active:scale-95"
                    aria-label="Close radio player"
                >
                    <ChevronDown className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2 rounded-lg bg-white/5 p-1">
                    <span className="rounded-md bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black">Internet Radio</span>
                </div>
                <div className="flex items-center gap-2">
                    <RadioBadge />
                </div>
            </header>

            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 pb-8 md:px-12 lg:flex-row lg:gap-20">
                <div className="relative w-full max-w-[280px] shrink-0 md:max-w-[380px] lg:max-w-[480px]">
                    <div className={`relative aspect-square overflow-hidden rounded-xl shadow-2xl transition-all duration-700 ${isRadioPlaying ? 'scale-100' : 'scale-95 opacity-80'}`}>
                        {artworkUrl ? (
                            <img src={artworkUrl} alt={title} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white/10">
                                <Radio className="h-1/2 w-1/2 text-white/70" />
                            </div>
                        )}
                        {isRadioPlaying && (
                            <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                                <Activity className="h-6 w-6 text-white" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex w-full max-w-lg flex-1 flex-col items-center text-center lg:items-start lg:text-left">
                    <div className="mb-4 flex items-center gap-2">
                        <RadioBadge />
                        {radioMetadata ? (
                            <span className="rounded border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70">Metadata</span>
                        ) : isRadioMetadataLoading ? (
                            <span className="rounded border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50">Scanning</span>
                        ) : null}
                    </div>

                    <h1 className="max-w-full text-3xl font-black leading-tight text-white md:text-5xl lg:text-6xl">{title}</h1>
                    <p className="mt-3 max-w-full text-lg font-medium text-white/60 md:text-xl">{artist}</p>
                    {album && <p className="mt-2 max-w-full text-sm text-white/45">{album}</p>}
                    {subtitle && <p className="mt-3 max-w-full truncate font-mono text-xs text-white/35">{subtitle}</p>}

                    {currentRadioStation.homepageUrl && (
                        <a
                            href={currentRadioStation.homepageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Station site
                        </a>
                    )}

                    <LiveRadioVisualizer
                        isPlaying={isRadioPlaying}
                        primaryColor={colors.primary}
                        secondaryColor={colors.secondary || colors.primary}
                        className="mt-8 h-28 w-full md:h-40"
                    />

                    <div className="mt-8 flex w-full items-center justify-center gap-6 lg:justify-start">
                        <button onClick={stopRadio} className="rounded-lg bg-white/10 p-4 text-white/70 transition hover:bg-white/20 hover:text-white" aria-label="Stop radio">
                            <Square className="h-6 w-6 fill-current" />
                        </button>
                        <button onClick={toggleRadioPlay} className="flex h-20 w-20 items-center justify-center rounded-lg bg-white text-black shadow-xl transition hover:scale-105 active:scale-95" aria-label={isRadioPlaying ? 'Pause radio' : 'Play radio'}>
                            {isRadioPlaying ? <Pause className="h-9 w-9 fill-current" /> : <Play className="ml-1 h-9 w-9 fill-current" />}
                        </button>
                        <div className="hidden items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-white/50 sm:flex">
                            <Music2 className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-wide">Live Stream</span>
                        </div>
                    </div>

                    <VolumeSlider className="mt-8 w-full max-w-xs" />
                </div>
            </div>
        </div>
    );
};
