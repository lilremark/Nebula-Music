import React, { useState, useEffect } from 'react';
import {
    Play, Pause, SkipBack, SkipForward,
    Volume2, Volume1, VolumeX,
    Repeat, Repeat1, Heart, AudioWaveform,
    ListMusic, Maximize2, PanelRightClose, Gauge, X, Minus, Plus
} from 'lucide-react';
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
    const { queue, currentSongIndex, isPlaying, togglePlay, nextSong, prevSong, volume, setVolume, audioRef, playSong, setView, service, playbackRate, setPlaybackRate, pitch, setPitch, pitchCorrection, setPitchCorrection, repeatMode, toggleRepeat, toggleLike, settings, updateSettings } = useStore();

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHoveringVolume, setIsHoveringVolume] = useState(false);
    const [showSpeedPitchModal, setShowSpeedPitchModal] = useState(false);
    const [visualProgress, setVisualProgress] = useState(0);
    const [isQueueCollapsed, setIsQueueCollapsed] = useState(false);

    const currentSong = queue[currentSongIndex];
    const coverArt = currentSong ? service.getCoverArtUrl(currentSong.id, 600) : '';
    const streamUrl = currentSong ? service.getStreamUrl(currentSong.id, currentSong.suffix) : null;
    const waveform = useTrackWaveform(currentSong?.id, streamUrl);
    const progressMode = settings.progressVisualization;

    // Adaptive colors from album art
    const { colors } = useAdaptiveColors(coverArt);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const updateTime = () => {
            setCurrentTime(audio.currentTime);
            setDuration(audio.duration || 0);
        };
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateTime);
        // Sync immediately on mount
        updateTime();
        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateTime);
        };
    }, [audioRef]);

    const progress = duration ? (currentTime / duration) * 100 : 0;
    const displayProgress = visualProgress || progress;

    const formatTime = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    };

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

    if (!currentSong) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
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
            style={{ background: `linear-gradient(180deg, ${colors.primary}15 0%, transparent 50%)` }}
        >
            {/* Top Section: Media Controls (Scrollable if needed on small screens, but usually fixed) */}
            <div className="flex-none flex flex-col items-center w-full pb-4 pt-4">
                {/* Header with collapse button */}
                <div className="w-full relative z-10 flex items-center justify-between px-4 mb-2">
                    <span className="text-xs font-bold text-neutral-600 dark:text-white/50 uppercase tracking-wider">Now Playing</span>
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
                <div className="relative w-full px-6 mb-6">
                    <div
                        className="relative w-full aspect-square max-w-[240px] mx-auto group cursor-pointer rounded-xl shadow-2xl overflow-hidden"
                        onClick={onExpand}
                    >
                        <img
                            src={coverArt}
                            alt={currentSong.title}
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
                <div className="px-6 text-center w-full mb-2">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white truncate" title={currentSong.title}>
                        {currentSong.title}
                    </h2>
                    <p
                        className="text-sm text-neutral-700 dark:text-white/50 truncate cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title={currentSong.artist}
                        onClick={() => setView('ARTIST_DETAIL', currentSong.artistId)}
                    >
                        {currentSong.artist}
                    </p>
                    <p
                        className="text-xs text-neutral-500 dark:text-white/50 truncate cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                        title={currentSong.album}
                        onClick={() => setView('ALBUM_DETAIL', currentSong.albumId)}
                    >
                        {currentSong.album}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full px-6 mb-2">
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
                        baseColor={withAlpha(colors.primary, progressMode === 'waveform' ? 0.28 : 0.18)}
                        markerColor={colors.secondary || colors.primary}
                        waveform={waveform}
                        onScrub={handleScrub}
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
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Main Controls */}
                <div className="flex items-center justify-center gap-4 mb-2">
                    <button
                        onClick={prevSong}
                        className="p-2.5 text-neutral-700 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white transition-all hover:scale-110 active:scale-95"
                        aria-label="Previous track"
                    >
                        <SkipBack className="w-5 h-5" fill="currentColor" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl"
                        style={{ backgroundColor: colors.primary }}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? (
                            <Pause className="w-5 h-5 text-black" fill="black" />
                        ) : (
                            <Play className="w-5 h-5 ml-0.5 text-black" fill="black" />
                        )}
                    </button>

                    <button
                        onClick={nextSong}
                        className="p-2.5 text-neutral-700 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white transition-all hover:scale-110 active:scale-95"
                        aria-label="Next track"
                    >
                        <SkipForward className="w-5 h-5" fill="currentColor" />
                    </button>
                </div>

                {/* Secondary Controls */}
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => toggleLike(currentSong)}
                        className={`p-2 transition-all active:scale-95 ${currentSong.starred ? 'text-red-500' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'}`}
                        aria-label={currentSong.starred ? 'Unlike' : 'Like'}
                    >
                        <Heart className={`w-5 h-5 ${currentSong.starred ? 'fill-current' : ''}`} />
                    </button>
                    <button
                        onClick={toggleRepeat}
                        className={`p-2 transition-colors active:scale-95 ${repeatMode === 'OFF' ? 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white' : 'text-neutral-900 dark:text-white'}`}
                        title={`Repeat: ${repeatMode}`}
                        aria-label={`Repeat mode: ${repeatMode}`}
                    >
                        {repeatMode === 'ONE' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                    </button>

                    {/* Speed Control */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSpeedPitchModal(!showSpeedPitchModal)}
                            className={`p-2 transition-colors active:scale-95 ${playbackRate !== 1.0 || pitch !== 0 ? 'text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'}`}
                            title={`Speed: ${playbackRate}x${pitch !== 0 ? ` / Pitch: ${pitch > 0 ? '+' : ''}${pitch}` : ''}`}
                            aria-label="Open playback speed and pitch settings"
                        >
                            <Gauge className="w-5 h-5" />
                        </button>

                        {/* Speed & Pitch Modal */}
                        {showSpeedPitchModal && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white/98 dark:bg-neutral-900/98 backdrop-blur-2xl rounded-xl border border-neutral-200 dark:border-white/5 shadow-2xl p-4 z-50">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Playback</h3>
                                    <button
                                        onClick={() => setShowSpeedPitchModal(false)}
                                        className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition-all dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10"
                                        aria-label="Close playback settings"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Speed Control */}
                                <div className="mb-3">
                                    <label className="text-[10px] font-semibold text-neutral-500 dark:text-white/60 uppercase tracking-wide mb-1.5 block">Speed</label>
                                    <div className="flex items-center justify-between bg-neutral-200 dark:bg-black/30 rounded-lg p-0.5">
                                        <button
                                            onClick={() => {
                                                const newSpeed = Math.max(0.5, Math.round((playbackRate - 0.1) * 10) / 10);
                                                setPlaybackRate(newSpeed);
                                                if (audioRef.current) audioRef.current.playbackRate = newSpeed;
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                            aria-label="Decrease speed"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="text-base font-mono text-neutral-900 dark:text-white font-bold">{playbackRate.toFixed(1)}x</span>
                                        <button
                                            onClick={() => {
                                                const newSpeed = Math.min(2.0, Math.round((playbackRate + 0.1) * 10) / 10);
                                                setPlaybackRate(newSpeed);
                                                if (audioRef.current) audioRef.current.playbackRate = newSpeed;
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                            aria-label="Increase speed"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Pitch Control */}
                                <div>
                                    <label className="text-[10px] font-semibold text-neutral-500 dark:text-white/60 uppercase tracking-wide mb-1.5 block">Pitch</label>
                                    <div className="flex items-center justify-between bg-neutral-200 dark:bg-black/30 rounded-lg p-0.5">
                                        <button
                                            onClick={() => setPitch(Math.max(-12, pitch - 1))}
                                            className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                            aria-label="Decrease pitch"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="text-base font-mono text-neutral-900 dark:text-white font-bold">{pitch > 0 ? '+' : ''}{pitch}</span>
                                        <button
                                            onClick={() => setPitch(Math.min(12, pitch + 1))}
                                            className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                            aria-label="Increase pitch"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Mode Toggle */}
                                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-white/10">
                                        <label className="text-[10px] font-semibold text-neutral-500 dark:text-white/60 uppercase tracking-wide mb-2 block">Mode</label>
                                        <div className="flex gap-1 bg-neutral-200 dark:bg-black/30 rounded-lg p-0.5">
                                            <button
                                                onClick={() => setPitchCorrection(true)}
                                                className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all ${pitchCorrection
                                                    ? 'bg-primary text-black'
                                                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                🎛️ Digital
                                            </button>
                                            <button
                                                onClick={() => setPitchCorrection(false)}
                                                className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all ${!pitchCorrection
                                                    ? 'bg-primary text-black'
                                                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                💿 Analogue
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-neutral-500 dark:text-white/50 mt-2 leading-tight">
                                            {pitchCorrection ? 'Independent speed & pitch control' : 'Speed affects pitch (vintage vinyl)'}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setPlaybackRate(1.0);
                                            setPitch(0);
                                            if (audioRef.current) audioRef.current.playbackRate = 1.0;
                                        }}
                                        className="w-full mt-2 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 dark:text-white/60 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-all"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

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
            <div className={`flex flex-col px-4 pb-4 transition-all duration-300 ${isQueueCollapsed ? 'flex-none' : 'flex-1 min-h-0'}`}>
                <div className="flex-1 bg-neutral-100 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/5 overflow-hidden flex flex-col shadow-inner">
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
                                        playSong(song, queue);
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




