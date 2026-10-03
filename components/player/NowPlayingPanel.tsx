import { DjBadge, DjHaze, PlayerCover, useDjPlayback } from './DjPresentation';
import React, { useState, useEffect } from 'react';
import {
    Play, Pause, SkipBack, SkipForward,
    Volume2, Volume1, VolumeX,
    Repeat, Repeat1, Heart, AudioWaveform,
    ListMusic, Maximize2, PanelRightClose
} from 'lucide-react';
import { SpeedPitchControls } from './SpeedPitchControls';
import { useStore } from '../../context/Store';
import { useAdaptiveColors } from '../../hooks/useAdaptiveColors';
import { useTrackWaveform } from '../../hooks/useTrackWaveform';
import { PlaybackProgress } from './PlaybackProgress';

interface NowPlayingPanelProps {
    onExpand: () => void;
    onCollapse: () => void;
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

export const NowPlayingPanel: React.FC<NowPlayingPanelProps> = ({ onExpand, onCollapse }) => {
    const { queue, currentSongIndex, isPlaying, togglePlay, nextSong, prevSong, volume, setVolume, audioRef, playSong, setView, service, repeatMode, toggleRepeat, toggleLike, settings, updateSettings } = useStore();

    const { dj, playQueueIndex } = useStore();
    const voice = useDjPlayback();
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHoveringVolume, setIsHoveringVolume] = useState(false);
    const [visualProgress, setVisualProgress] = useState(0);
    const [isQueueCollapsed, setIsQueueCollapsed] = useState(false);

    const currentSong = queue[currentSongIndex];
    const coverArt = currentSong ? service.getCoverArtUrl(currentSong.id, 600) : '';
    const streamUrl = currentSong ? service.getStreamUrl(currentSong.id, currentSong.suffix) : null;
    const progressMode = voice.speech ? 'bar' : settings.progressVisualization;
    const waveform = useTrackWaveform(currentSong?.id, progressMode === 'waveform' ? streamUrl : null);

    // Adaptive colors from album art
    const { colors } = useAdaptiveColors(coverArt);

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

    const progress = duration ? (currentTime / duration) * 100 : 0;
    const displayProgress = voice.speech ? voice.progress : visualProgress || progress;

    const formatTime = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (voice.speech) return;
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

    if (!currentSong) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" data-nebula-player="sidebar">
                <div className="w-32 h-32 rounded-2xl bg-neutral-300 dark:bg-white/5 flex items-center justify-center mb-6">
                    <ListMusic className="w-12 h-12 text-neutral-500 dark:text-white/50" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-700 dark:text-white/60 mb-2">No Track Playing</h3>
                <p className="text-sm text-neutral-600 dark:text-white/50">Select a song to start listening</p>
            </div>
        );
    }

    return (
        <div
            className="flex-1 flex flex-col h-full overflow-hidden relative justify-center"
            data-nebula-player="sidebar"
            style={{ background: `linear-gradient(180deg, ${colors.primary}15 0%, transparent 50%)` }}
        >
            <DjHaze speech={voice.speech} active={dj.state.active} />
            {/* Top Section: Media Controls (Scrollable if needed on small screens, but usually fixed) */}
            <div className="flex-none flex flex-col items-center w-full pb-4 pt-4" data-nebula-sidebar-player-main>
                {/* Header with collapse button */}
                <div className="w-full relative z-10 flex items-center justify-between px-4 mb-2" data-nebula-sidebar-player-header>
                    <span className="text-xs font-bold text-neutral-600 dark:text-white/50 uppercase tracking-wider">Now Playing <DjBadge /></span>
                    <button
                        onClick={onCollapse}
                        className="p-2 rounded-lg hover:bg-neutral-300 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all active:scale-95"
                        title="Collapse panel"
                        aria-label="Collapse now playing panel"
                    >
                        <PanelRightClose className="w-5 h-5" />
                    </button>
                </div>

                {/* Album Art - Compact */}
                <div className="relative w-full px-6 mb-6" data-nebula-sidebar-player-art>
                    <div
                        className="relative w-full aspect-square max-w-[240px] mx-auto group cursor-pointer rounded-xl shadow-2xl overflow-hidden"
                        onClick={onExpand}
                    >
                        <PlayerCover src={coverArt}
                            alt={voice.speech ? 'AI DJ' : currentSong.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />

                        {/* Expand overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                <Maximize2 className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Song Info */}
                <div className="px-6 text-center w-full mb-2" data-nebula-sidebar-player-info>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white truncate" title={voice.speech ? 'AI DJ' : currentSong.title}>
                        {voice.speech ? 'AI DJ' : currentSong.title}
                    </h2>
                    <p
                        className="text-sm text-neutral-700 dark:text-white/50 truncate cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title={voice.speech ? voice.subtitle : currentSong.artist}
                        onClick={() => { if (!voice.speech) setView('ARTIST_DETAIL', currentSong.artistId); }}
                    >
                        {voice.speech ? voice.subtitle : currentSong.artist}
                    </p>
                    <p
                        className="text-xs text-neutral-500 dark:text-white/50 truncate cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title={voice.speech ? '' : currentSong.album}
                        onClick={() => { if (!voice.speech) setView('ALBUM_DETAIL', currentSong.albumId); }}
                    >
                        {voice.speech ? '' : currentSong.album}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full px-6 mb-2" data-nebula-sidebar-player-progress>
                    <div className="flex justify-end mb-1.5">
                        <button
                            onClick={toggleProgressMode}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider text-neutral-600 hover:text-neutral-900 bg-neutral-200 hover:bg-neutral-300 transition-all dark:text-white/60 dark:bg-white/10 dark:hover:bg-white/20 dark:hover:text-white"
                            title={`Progress style: ${progressMode}`}
                            aria-label={`Switch progress style (current: ${progressMode})`}
                        >
                            <AudioWaveform className="w-3 h-3" />
                            {progressMode === 'waveform' ? 'Wave' : 'Bar'}
                        </button>
                    </div>
                    <PlaybackProgress
                        progress={displayProgress}
                        mode={progressMode}
                        accentColor={colors.primary}
                        secondaryColor={colors.secondary}
                        baseColor={withAlpha(colors.primary, progressMode === 'waveform' ? 0.28 : 0.18)}
                        markerColor={colors.secondary || colors.primary}
                        waveform={waveform}
                        onScrub={handleScrub}
                        scrubbable={!voice.speech}
                        showHandle
                        trackStyle={{
                            boxShadow: progressMode === 'bar'
                                ? `0 0 18px ${withAlpha(colors.primary, 0.16)}`
                                : undefined,
                        }}
                        trackClassName={`cursor-pointer transition-all duration-300 ${progressMode === 'waveform'
                            ? 'h-16 bg-transparent rounded-none'
                            : 'h-2 bg-neutral-300 dark:bg-white/10 rounded'
                            }`}
                    />
                    <div className="flex justify-between mt-1.5 text-[10px] text-neutral-600 dark:text-white/60 font-mono tabular-nums">
                        <span>{formatTime(voice.speech ? voice.position : currentTime)}</span>
                        <span>{formatTime(voice.speech ? voice.duration : duration)}</span>
                    </div>
                </div>

                {/* Main Controls */}
                <div className="nebula-playback-controls flex items-center justify-center gap-4 mb-2" data-nebula-sidebar-player-transport>
                    <button
                        onClick={prevSong}
                        className="nebula-playback-skip transition-all hover:scale-110 active:scale-95"
                        aria-label="Previous track"
                    >
                        <SkipBack className="w-5 h-5" fill="currentColor" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="nebula-playback-toggle transition-all hover:scale-105 active:scale-95 shadow-xl"
                        aria-label={voice.playing ? 'Pause' : 'Play'}
                    >
                        {voice.playing ? (
                            <Pause className="w-5 h-5 text-black" fill="black" />
                        ) : (
                            <Play className="w-5 h-5 ml-0.5 text-black" fill="black" />
                        )}
                    </button>

                    <button
                        onClick={nextSong}
                        className="nebula-playback-skip transition-all hover:scale-110 active:scale-95"
                        aria-label="Next track"
                    >
                        <SkipForward className="w-5 h-5" fill="currentColor" />
                    </button>
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-center gap-3" data-nebula-sidebar-player-tools>
                    <button
                        disabled={voice.speech}
                        onClick={() => toggleLike(currentSong)}
                        className={`p-2 transition-all active:scale-95 ${currentSong.starred ? 'text-red-500' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'}`}
                        aria-label={currentSong.starred ? 'Unlike' : 'Like'}
                    >
                        <Heart className={`w-5 h-5 ${currentSong.starred ? 'fill-current' : ''}`} />
                    </button>
                    <button
                        onClick={toggleRepeat}
                        disabled={dj.state.active}
                        title={dj.state.active ? "Repeat is unavailable during AI DJ" : undefined}
                        className={`p-2 transition-colors active:scale-95 ${repeatMode === 'OFF' ? 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white' : 'text-neutral-900 dark:text-white'}`}
                        aria-label={`Repeat mode: ${repeatMode}`}
                    >
                        {repeatMode === 'ONE' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                    </button>

                    {/* Speed Control */}
                    <SpeedPitchControls />

                    <button
                        onClick={onExpand}
                        className="p-2 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-colors active:scale-95"
                        title="Full screen"
                        aria-label="Open full screen player"
                    >
                        <Maximize2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Volume */}
                <div
                    data-nebula-sidebar-player-volume
                    className="flex items-center justify-center gap-1 shrink-0 mt-3"
                    onMouseEnter={() => setIsHoveringVolume(true)}
                    onMouseLeave={() => setIsHoveringVolume(false)}
                >
                    <button
                        onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                        className="p-2 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                    >
                        {volume === 0 ? <VolumeX className="w-5 h-5" /> :
                            volume < 0.5 ? <Volume1 className="w-5 h-5" /> :
                                <Volume2 className="w-5 h-5" />}
                    </button>
                    <div className={`overflow-hidden transition-all duration-200 ${isHoveringVolume ? 'w-24' : 'w-0'}`}>
                        <div className="relative h-1 bg-neutral-300 dark:bg-white/10 rounded-full my-3">
                            <div
                                className="absolute inset-y-0 left-0 bg-neutral-600 dark:bg-white/60 rounded-full"
                                style={{ width: `${volume * 100}%` }}
                            />
                            <input
                                type="range"
                                aria-label="Volume"
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
            </div>

            {/* Bottom Section: Queue Card */}
            <div className={`flex flex-col px-4 pb-4 transition-all duration-300 ${isQueueCollapsed ? 'flex-none' : 'flex-1 min-h-0'}`} data-nebula-sidebar-player-queue>
                <div className="flex-1 bg-neutral-100 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/5 overflow-hidden flex flex-col shadow-inner" data-nebula-sidebar-player-queue-card>
                    <div
                        className="px-4 py-3 border-b border-neutral-200 dark:border-white/5 flex items-center justify-between bg-neutral-200/50 dark:bg-white/5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
                        onClick={() => setIsQueueCollapsed(!isQueueCollapsed)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-600 dark:text-white/60 uppercase tracking-wider">Up Next</span>
                            <span className="text-[10px] font-mono text-neutral-500 dark:text-white/50">{queue.length - (currentSongIndex + 1)} tracks</span>
                        </div>
                        {isQueueCollapsed ? (
                            <PanelRightClose className="w-4 h-4 text-neutral-500 dark:text-white/50 rotate-90" />
                        ) : (
                            <PanelRightClose className="w-4 h-4 text-neutral-500 dark:text-white/50 -rotate-90" />
                        )}
                    </div>

                    {!isQueueCollapsed && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {queue.slice(currentSongIndex + 1).map((song, i) => (
                                <div
                                    key={`${song.id}-${i}`}
                                    className="group flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playQueueIndex(currentSongIndex + i + 1);
                                    }}
                                >
                                    <div className="relative w-8 h-8 rounded overflow-hidden shrink-0 bg-neutral-300 dark:bg-white/10">
                                        <img
                                            src={service.getCoverArtUrl(song.coverArt || song.id, 100)}
                                            alt=""
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                                            <Play className="w-3 h-3 text-white fill-current" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">{song.title}</p>
                                        <p className="text-[10px] text-neutral-600 dark:text-white/60 truncate">{song.artist}</p>
                                    </div>
                                    <span className="text-[10px] font-mono text-neutral-500 dark:text-white/50 truncate">
                                        {formatTime(song.duration)}
                                    </span>
                                </div>
                            ))}
                            {queue.length - (currentSongIndex + 1) === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                    <ListMusic className="w-8 h-8 text-neutral-300 dark:text-white/10 mb-2" />
                                    <p className="text-xs text-neutral-500 dark:text-white/50">Queue is empty</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};




