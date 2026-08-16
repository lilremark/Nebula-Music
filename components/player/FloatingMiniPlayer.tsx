import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Maximize2, PanelRight, Heart, Volume2, Volume1, VolumeX, AudioWaveform } from 'lucide-react';
import { useStore } from '../../context/Store';
import { useAdaptiveColors } from '../../hooks/useAdaptiveColors';
import { useTrackWaveform } from '../../hooks/useTrackWaveform';
import { PlaybackProgress } from './PlaybackProgress';

interface FloatingMiniPlayerProps {
    onExpand: () => void;
    onRestoreSidebar: () => void;
}

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

export const FloatingMiniPlayer: React.FC<FloatingMiniPlayerProps> = ({ onExpand, onRestoreSidebar }) => {
    const {
        queue, currentSongIndex, isPlaying, togglePlay, nextSong, prevSong, service, audioRef, toggleLike, volume, setVolume, settings, updateSettings
    } = useStore();

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHoverProgress, setIsHoverProgress] = useState(false);
    const [isHoverVolume, setIsHoverVolume] = useState(false);
    const [visualProgress, setVisualProgress] = useState(0);

    const currentSong = queue[currentSongIndex];

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        let raf = 0;
        let lastTime = -1;
        let lastDuration = -1;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            // Skip work while hidden (backgroundThrottling is disabled, so the
            // frame loop keeps firing even when the window is minimized/trayed).
            if (document.visibilityState !== 'visible') return;
            const time = audio.currentTime;
            if (Math.abs(time - lastTime) >= 0.1) {
                lastTime = time;
                setCurrentTime(time);
            }
            const dur = audio.duration || 0;
            if (dur !== lastDuration) {
                lastDuration = dur;
                setDuration(dur);
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [audioRef]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const syncDuration = () => setDuration(audio.duration || 0);
        audio.addEventListener('loadedmetadata', syncDuration);
        syncDuration();
        return () => audio.removeEventListener('loadedmetadata', syncDuration);
    }, [audioRef]);

    if (!currentSong) return null;

    const coverArt = service.getCoverArtUrl(currentSong.coverArt || currentSong.id, 200);
    const streamUrl = service.getStreamUrl(currentSong.id, currentSong.suffix);
    const waveform = useTrackWaveform(currentSong.id, streamUrl);
    const progressMode = settings.progressVisualization;
    const { colors } = useAdaptiveColors(coverArt);
    const progress = duration ? (currentTime / duration) * 100 : 0;
    const displayProgress = visualProgress || progress;

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newProgress = parseFloat(e.target.value);
        setVisualProgress(newProgress);
        const newTime = (newProgress / 100) * duration;
        const audio = audioRef.current;
        if (audio) audio.currentTime = newTime;
        setCurrentTime(newTime);
        setTimeout(() => setVisualProgress(0), 50);
    };

    const toggleProgressMode = () => {
        updateSettings({ progressVisualization: progressMode === 'waveform' ? 'bar' : 'waveform' });
    };

    const formatTime = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    };

    return (
        <div
            className="flex flex-col rounded-xl bg-neutral-100 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-300 dark:border-white/10 shadow-2xl animate-scale-in overflow-hidden"
            style={{
                boxShadow: `0 25px 60px -15px rgba(0,0,0,0.6), 0 0 0 1px ${colors.primary}15`,
                width: '760px',
                maxWidth: 'calc(100vw - 24px)'
            }}
        >
            {/* Progress bar at top - clickable with hover expand */}
            <div onMouseEnter={() => setIsHoverProgress(true)} onMouseLeave={() => setIsHoverProgress(false)}>
                <PlaybackProgress
                    progress={displayProgress}
                    mode={progressMode}
                    accentColor={colors.primary}
                    baseColor={withAlpha(colors.primary, progressMode === 'waveform' ? 0.28 : 0.18)}
                    markerColor={colors.secondary || colors.primary}
                    waveform={waveform}
                    onScrub={handleScrub}
                    trackStyle={{
                        boxShadow: progressMode === 'bar'
                            ? `0 0 18px ${withAlpha(colors.primary, 0.16)}`
                            : undefined,
                    }}
                    trackClassName={`${progressMode === 'waveform'
                        ? 'h-16 bg-transparent transition-all duration-300'
                        : `group transition-all duration-200 ${isHoverProgress ? 'h-3' : 'h-1.5'} bg-neutral-300 dark:bg-white/10`
                        }`}
                />
            </div>

            {/* Main content */}
            <div className="flex items-center gap-3 px-3 pr-5 py-3">
                {/* Album Art */}
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 shadow-lg cursor-pointer" onClick={onExpand}>
                    <img
                        src={coverArt}
                        alt={currentSong.title}
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Song Info */}
                <div className="min-w-0 w-32 shrink-0">
                    <div className="relative overflow-hidden">
                        {currentSong.title.length > 22 ? (
                            <div className="mini-title-marquee font-semibold text-neutral-900 dark:text-white text-sm whitespace-nowrap">
                                <span>{currentSong.title}</span>
                                <span aria-hidden="true">{currentSong.title}</span>
                            </div>
                        ) : (
                            <p className="font-semibold text-neutral-900 dark:text-white text-sm truncate">{currentSong.title}</p>
                        )}
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-white/50 truncate">{currentSong.artist}</p>
                </div>

                {/* Time display */}
                <div className="flex items-center justify-center gap-2 text-xs font-mono text-neutral-700 dark:text-white/70 shrink-0 min-w-[86px]">
                    <span className="tabular-nums">{formatTime(currentTime)}</span>
                    <span className="text-neutral-400 dark:text-white/50">/</span>
                    <span className="tabular-nums">{formatTime(duration)}</span>
                </div>

                {/* Progress style toggle */}
                <button
                    onClick={toggleProgressMode}
                    className="p-1.5 text-neutral-600 hover:text-neutral-900 transition-colors active:scale-95 dark:text-white/60 dark:hover:text-white"
                    title={`Progress style: ${progressMode}`}
                    aria-label={`Switch progress style (current: ${progressMode})`}
                >
                    <AudioWaveform className="w-4 h-4" />
                </button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Volume control */}
                <div
                    className="flex items-center gap-1 shrink-0"
                    onMouseEnter={() => setIsHoverVolume(true)}
                    onMouseLeave={() => setIsHoverVolume(false)}
                >
                    <button
                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                        className="p-1.5 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                    >
                        {volume === 0 ? <VolumeX className="w-4 h-4" /> :
                            volume < 0.5 ? <Volume1 className="w-4 h-4" /> :
                                <Volume2 className="w-4 h-4" />}
                    </button>
                    <div className={`overflow-hidden transition-all duration-200 ${isHoverVolume ? 'w-16' : 'w-0'}`}>
                        <div className="relative h-1 bg-neutral-300 dark:bg-white/10 rounded-full">
                            <div
                                className="absolute inset-y-0 left-0 bg-neutral-600 dark:bg-white/60 rounded-full"
                                style={{ width: `${volume * 100}%` }}
                            />
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Like button */}
                <button
                    onClick={() => toggleLike(currentSong)}
                    className={`p-2 transition-colors active:scale-95 ${currentSong.starred ? 'text-red-500' : 'text-neutral-600 hover:text-neutral-900 dark:text-white/60 dark:hover:text-white'}`}
                    aria-label={currentSong.starred ? 'Unlike' : 'Like'}
                >
                    <Heart className={`w-4 h-4 ${currentSong.starred ? 'fill-current' : ''}`} />
                </button>

                {/* Controls */}
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={prevSong}
                        className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors active:scale-95 dark:text-white/50 dark:hover:text-white"
                        aria-label="Previous track"
                    >
                        <SkipBack className="w-4 h-4" fill="currentColor" />
                    </button>
                    <button
                        onClick={togglePlay}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: colors.primary }}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? (
                            <Pause className="w-4 h-4 text-black" fill="black" />
                        ) : (
                            <Play className="w-4 h-4 ml-0.5 text-black" fill="black" />
                        )}
                    </button>
                    <button
                        onClick={nextSong}
                        className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors active:scale-95 dark:text-white/50 dark:hover:text-white"
                        aria-label="Next track"
                    >
                        <SkipForward className="w-4 h-4" fill="currentColor" />
                    </button>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-neutral-200 dark:bg-white/10" />

                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Restore Sidebar */}
                    <button
                        onClick={onRestoreSidebar}
                        className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors active:scale-95 dark:text-white/60 dark:hover:text-white"
                        title="Show sidebar"
                        aria-label="Show sidebar"
                    >
                        <PanelRight className="w-4 h-4" />
                    </button>
                    {/* Expand Full Screen */}
                    <button
                        onClick={onExpand}
                        className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors active:scale-95 dark:text-white/60 dark:hover:text-white"
                        title="Full screen player"
                        aria-label="Open full screen player"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};


