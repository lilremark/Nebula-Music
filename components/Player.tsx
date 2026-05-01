import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Play, Pause, SkipBack, SkipForward,
    Volume2, Volume1, VolumeX, ChevronDown,
    Heart, Repeat, Repeat1, Activity, Eye, EyeOff, Disc3, Minus, Plus, Sliders, X, AudioWaveform
} from 'lucide-react';
import { useStore } from '../context/Store';
import { Visualizer } from './Visualizer';
import { useAdaptiveColors } from '../hooks/useAdaptiveColors';
import { useArtistImage } from '../hooks/useArtistImage';
import { useTrackWaveform } from '../hooks/useTrackWaveform';
import { PlaybackProgress } from './player/PlaybackProgress';
import { VisualizerMode } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SyncedLine {
    time: number;
    text: string;
}

interface PlayerProps {
    isExpanded: boolean;
    onClose: () => void;
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

    return color;
};

export const Player: React.FC<PlayerProps> = ({ isExpanded, onClose }) => {
    const { mode } = useTheme();
    const {
        queue, currentSongIndex, isPlaying, togglePlay, nextSong, prevSong,
        volume, setVolume, playSong,
        service, setView, audioRef,
        visualizerMode, setVisualizerMode,
        repeatMode, toggleRepeat, toggleLike,
        isZenMode, setZenMode,
        playbackRate, setPlaybackRate, pitch, setPitch, pitchCorrection, setPitchCorrection,
        settings, updateSettings
    } = useStore();

    const [activeTab, setActiveTab] = useState<'playing' | 'queue' | 'lyrics'>('playing');
    const [lyrics, setLyrics] = useState('');
    const [syncedLyrics, setSyncedLyrics] = useState<SyncedLine[]>([]);
    const [loadingLyrics, setLoadingLyrics] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showSpeedPitchModal, setShowSpeedPitchModal] = useState(false);
    const [visualProgress, setVisualProgress] = useState(0); // For immediate visual feedback
    const [showZenControls, setShowZenControls] = useState(false);

    const lyricsContainerRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLParagraphElement>(null);

    const currentSong = queue[currentSongIndex];
    const coverArt = currentSong ? service.getCoverArtUrl(currentSong.id, 800) : '';
    const streamUrl = currentSong ? service.getStreamUrl(currentSong.id, currentSong.suffix) : null;
    const waveform = useTrackWaveform(currentSong?.id, streamUrl);
    const progressMode = settings.progressVisualization;
    const { colors } = useAdaptiveColors(coverArt);
    const { image: artistImage } = useArtistImage(currentSong?.artistId, currentSong?.artist);
    const isLightMode = mode === 'light';

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

    const parseLyrics = useCallback((lrc: string) => {
        if (!lrc) return [];
        const lines = lrc.split('\n');
        const result: SyncedLine[] = [];
        const timeRegex = /\[(\d+):(\d{2})(?:\.(\d{2,3}))?\]/g;
        for (const line of lines) {
            timeRegex.lastIndex = 0;
            const matches = [...line.matchAll(timeRegex)];
            if (matches.length > 0) {
                const text = line.replace(timeRegex, '').trim();
                if (!text) continue;
                matches.forEach(match => {
                    const minutes = parseInt(match[1]);
                    const seconds = parseInt(match[2]);
                    const msStr = match[3];
                    let ms = 0;
                    if (msStr) ms = parseInt(msStr.padEnd(3, '0'));
                    const time = minutes * 60 + seconds + ms / 1000;
                    result.push({ time, text });
                });
            }
        }
        return result.sort((a, b) => a.time - b.time);
    }, []);

    useEffect(() => {
        setSyncedLyrics([]); setLyrics('');
        const fetchLyrics = async () => {
            if (activeTab === 'lyrics' && currentSong) {
                setLoadingLyrics(true);
                const text = await service.getLyrics(currentSong.artist, currentSong.title, currentSong.album, currentSong.duration, currentSong.id);
                const parsed = parseLyrics(text);
                if (parsed.length > 0) { setSyncedLyrics(parsed); setLyrics(''); }
                else { setSyncedLyrics([]); setLyrics(text || "No lyrics found."); }
                setLoadingLyrics(false);
            }
        };
        fetchLyrics();
    }, [activeTab, currentSong, service, parseLyrics]);

    const activeLineIndex = syncedLyrics.findIndex((line, index) => {
        const nextLine = syncedLyrics[index + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
    });

    useEffect(() => {
        if (activeLineRef.current && activeTab === 'lyrics') {
            activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeLineIndex, activeTab]);

    const cycleVisualizerMode = useCallback(() => {
        const modes: VisualizerMode[] = ['BARS', 'WAVE', 'CIRCLE', 'MIRROR', 'SPECTRUM', 'PARTICLES', 'HEXAGON', 'CUBE', 'GRID'];
        const nextIndex = (modes.indexOf(visualizerMode) + 1) % modes.length;
        setVisualizerMode(modes[nextIndex]);
    }, [visualizerMode, setVisualizerMode]);

    const renderQualityBadge = (suffix?: string, bitrate?: number) => {
        if (!suffix) return null;
        const s = suffix.toUpperCase();
        const isLossless = s === 'FLAC' || s === 'ALAC' || s === 'WAV' || s === 'AIFF' || s === 'AIF';
        return (
            <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider ${isLossless ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-neutral-200 text-neutral-600 border border-neutral-200 dark:bg-white/10 dark:text-white/60 dark:border-white/10'
                }`}>
                {s} {bitrate && `${bitrate}k`}
            </span>
        );
    };

    useEffect(() => {
        if (!isZenMode) {
            setShowZenControls(false);
            return;
        }

        if (settings.alwaysShowZenControls) {
            setShowZenControls(true);
            return;
        }

        const handleMouseMove = (event: MouseEvent) => {
            setShowZenControls(window.innerHeight - event.clientY < 190);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [isZenMode, settings.alwaysShowZenControls]);

    if (!currentSong) return null;

    const progress = duration ? (currentTime / duration) * 100 : 0;
    const displayProgress = visualProgress || progress; // Use visual progress if actively seeking
    const formatTime = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newProgress = parseFloat(e.target.value);
        setVisualProgress(newProgress); // Immediate visual update
        const newTime = (newProgress / 100) * duration;
        const audio = audioRef.current;
        if (audio) audio.currentTime = newTime;
        setCurrentTime(newTime);
        // Clear visual progress after a brief delay
        setTimeout(() => setVisualProgress(0), 50);
    };

    const toggleProgressMode = () => {
        updateSettings({ progressVisualization: progressMode === 'waveform' ? 'bar' : 'waveform' });
    };

    const playerBackground = isLightMode
        ? {
            backgroundColor: '#f4f4f5',
            backgroundImage: [
                `radial-gradient(circle at 18% 18%, ${withAlpha(colors.primary, 0.18)}, transparent 34%)`,
                `radial-gradient(circle at 78% 82%, ${withAlpha(colors.secondary || colors.primary, 0.14)}, transparent 36%)`,
                'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(244,244,245,0.94) 44%, rgba(229,229,229,0.92) 100%)'
            ].join(', '),
        }
        : {
            backgroundColor: '#0a0a0a',
            backgroundImage: colors.gradient,
        };

    return (
        <div className={`fixed inset-0 z-[60] flex flex-col bg-neutral-200 dark:bg-[#0a0a0a] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isExpanded || isZenMode ? 'translate-y-0' : 'translate-y-full'}`}
            style={playerBackground}
        >
            {/* Dot pattern background */}
            <div
                className={`absolute inset-0 pointer-events-none ${isLightMode ? 'opacity-45' : 'opacity-30'}`}
                style={{
                    backgroundImage: `radial-gradient(circle, ${withAlpha(colors.primary, isLightMode ? 0.14 : 0.18)} 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}
            />

            {isLightMode && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/50 via-white/25 to-neutral-200/55" />
            )}

            {/* Subtle album color orbs */}
            <div
                className={`absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none ${isLightMode ? 'opacity-[0.16]' : 'opacity-[0.05]'}`}
                style={{ backgroundColor: colors.primary }}
            />
            <div
                className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[160px] pointer-events-none ${isLightMode ? 'opacity-[0.12]' : 'opacity-[0.04]'}`}
                style={{ backgroundColor: colors.secondary || colors.primary }}
            />

            {/* Ambient Visualizer with gaussian blur */}
            {isPlaying && !isZenMode && (
                <div className="absolute inset-0 z-0 pointer-events-none" style={{ filter: 'blur(8px)' }}>
                    <Visualizer className={`w-full h-full ${isLightMode ? 'opacity-10' : 'opacity-15'}`} primaryColor={colors.primary} secondaryColor={colors.secondary || colors.primary} />
                </div>
            )}

            {/* Zen Mode Visualizer */}
            {isZenMode && (
                <div className="absolute inset-0 z-0">
                    <Visualizer className="w-full h-full opacity-80" primaryColor={colors.primary} secondaryColor={colors.secondary || colors.primary} />
                </div>
            )}

            {/* Top Navigation */}
            <header className={`relative z-20 flex items-center justify-between p-4 md:p-6 transition-opacity duration-500 ${isZenMode ? 'opacity-0 hover:opacity-100' : ''}`}>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-white/10 flex items-center justify-center hover:bg-neutral-300 dark:hover:bg-white/20 transition-all active:scale-95"
                    aria-label="Close player"
                >
                    <ChevronDown className="w-5 h-5 text-neutral-900 dark:text-white" />
                </button>

                {/* Tab Navigation */}
                {!isZenMode && (
                    <div className="flex items-center gap-1 bg-neutral-200 dark:bg-white/5 rounded-lg p-1">
                        {(['playing', 'lyrics', 'queue'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-md text-xs font-semibold uppercase tracking-wide transition-all ${activeTab === tab
                                    ? 'bg-white text-black'
                                    : 'text-neutral-600 dark:text-white/50 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                {tab === 'playing' ? 'Now Playing' : tab}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={cycleVisualizerMode}
                        className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-white/10 flex items-center justify-center hover:bg-neutral-300 dark:hover:bg-white/20 transition-all active:scale-95"
                        title={`Visualizer: ${visualizerMode}`}
                        aria-label={`Change visualizer mode (current: ${visualizerMode})`}
                    >
                        <Activity className="w-5 h-5 text-neutral-900 dark:text-white" />
                    </button>
                    <button
                        onClick={() => setZenMode(!isZenMode)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 ${isZenMode ? 'bg-white text-black' : 'bg-neutral-200 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-900 dark:text-white'}`}
                        aria-label={isZenMode ? 'Exit zen mode' : 'Enter zen mode'}
                    >
                        {isZenMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className={`relative z-10 flex-1 flex flex-col overflow-hidden ${isZenMode ? 'opacity-0 hover:opacity-100 transition-opacity duration-700' : ''}`}>

                {/* Now Playing Tab */}
                {activeTab === 'playing' && !isZenMode && (
                    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20 px-6 md:px-12 pb-8">
                        {/* Album Art */}
                        <div className="relative w-full max-w-[380px] lg:max-w-[480px] shrink-0">
                            <div className={`relative aspect-square rounded-xl overflow-hidden shadow-2xl transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-70'}`}>
                                <img
                                    src={coverArt}
                                    alt={currentSong.title}
                                    className="w-full h-full object-cover"
                                />
                                {/* Vinyl spinning indicator */}
                                {isPlaying && (
                                    <div className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                                        <Disc3 className="w-6 h-6 text-white animate-spin" style={{ animationDuration: '3s' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Song Info & Controls */}
                        <div className="relative flex-1 flex flex-col items-center lg:items-start text-center lg:text-left w-full max-w-lg">
                            {/* Quality Badge */}
                            <div className="mb-4">
                                {renderQualityBadge(currentSong.suffix, currentSong.bitRate)}
                            </div>

                            {/* Title & Artist */}
                            <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-neutral-900 dark:text-white mb-2 leading-tight">
                                {currentSong.title}
                            </h1>
                            <p
                                className="text-lg md:text-xl text-neutral-600 dark:text-white/50 font-medium mb-2 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                                onClick={() => { setView('ARTIST_DETAIL', currentSong.artistId); onClose(); }}
                            >
                                {currentSong.artist}
                            </p>
                            <p
                                className="text-sm text-neutral-500 dark:text-white/50 mb-8 cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors"
                                onClick={() => { setView('ALBUM_DETAIL', currentSong.albumId); onClose(); }}
                            >
                                {currentSong.album}
                            </p>

                            {/* Progress Bar */}
                            <div className="w-full mb-8">
                                <div className="flex justify-end mb-2">
                                    <button
                                        onClick={toggleProgressMode}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider text-neutral-600 hover:text-neutral-900 bg-neutral-200 hover:bg-neutral-300 transition-all dark:text-white/70 dark:bg-white/10 dark:hover:bg-white/20 dark:hover:text-white"
                                        title={`Progress style: ${progressMode}`}
                                        aria-label={`Switch progress style (current: ${progressMode})`}
                                    >
                                        <AudioWaveform className="w-3.5 h-3.5" />
                                        {progressMode === 'waveform' ? 'Waveform' : 'Bar'}
                                    </button>
                                </div>
                                <PlaybackProgress
                                    progress={displayProgress}
                                    mode={progressMode}
                                    accentColor={colors.primary}
                                    baseColor={withAlpha(colors.primary, progressMode === 'waveform' ? 0.24 : 0.16)}
                                    markerColor={colors.secondary || colors.primary}
                                    waveform={waveform}
                                    onScrub={handleScrub}
                                    trackClassName={`cursor-pointer transition-all duration-300 ${progressMode === 'waveform'
                                        ? 'h-28 bg-transparent rounded-none'
                                        : 'h-2 bg-neutral-300 dark:bg-white/10 rounded'
                                        }`}
                                />
                                <div className="flex justify-between mt-2 text-xs font-mono text-neutral-600 dark:text-white/60">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Main Controls */}
                            <div className="flex items-center justify-center gap-6 mb-8 w-full">
                                <button
                                    onClick={toggleRepeat}
                                    className={`p-3 rounded-lg transition-all ${repeatMode === 'OFF' ? 'text-neutral-500 dark:text-white/50 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-white/5' : 'text-neutral-900 dark:text-white bg-neutral-200 dark:bg-white/10'}`}
                                    aria-label={`Repeat mode: ${repeatMode}`}
                                >
                                    {repeatMode === 'ONE' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                                </button>

                                <button
                                    onClick={prevSong}
                                    className="p-4 text-neutral-700 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white transition-all hover:scale-110 active:scale-95"
                                    aria-label="Previous track"
                                >
                                    <SkipBack className="w-8 h-8" fill="currentColor" />
                                </button>

                                <button
                                    onClick={togglePlay}
                                    className="w-20 h-20 rounded-lg bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
                                    aria-label={isPlaying ? 'Pause' : 'Play'}
                                >
                                    {isPlaying ? (
                                        <Pause className="w-8 h-8" fill="currentColor" />
                                    ) : (
                                        <Play className="w-8 h-8 ml-1" fill="currentColor" />
                                    )}
                                </button>

                                <button
                                    onClick={nextSong}
                                    className="p-4 text-neutral-700 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white transition-all hover:scale-110 active:scale-95"
                                    aria-label="Next track"
                                >
                                    <SkipForward className="w-8 h-8" fill="currentColor" />
                                </button>

                                <button
                                    onClick={() => toggleLike(currentSong)}
                                    className={`p-3 rounded-lg transition-all ${currentSong.starred ? 'text-red-500 bg-red-500/10' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5'}`}
                                    aria-label={currentSong.starred ? 'Unlike' : 'Like'}
                                >
                                    <Heart className={`w-5 h-5 ${currentSong.starred ? 'fill-current' : ''}`} />
                                </button>
                            </div>

                            {/* Volume Control */}
                            <div className="flex items-center gap-3 w-full max-w-xs mx-auto lg:mx-0 mb-6">
                                <button
                                    onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
                                    className="p-2 text-neutral-600 hover:text-neutral-900 transition-colors dark:text-white/60 dark:hover:text-white"
                                    aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                                >
                                    {volume === 0 ? <VolumeX className="w-5 h-5" /> :
                                        volume < 0.5 ? <Volume1 className="w-5 h-5" /> :
                                            <Volume2 className="w-5 h-5" />}
                                </button>
                                <div className="flex-1 relative h-1.5 bg-white/10 rounded group">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-white/60 rounded"
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

                            {/* Speed & Pitch Toggle Button */}
                            <button
                                onClick={() => setShowSpeedPitchModal(!showSpeedPitchModal)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${showSpeedPitchModal || playbackRate !== 1.0 || pitch !== 0 || settings.magicCrossfade
                                    ? 'bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-white'
                                    : 'bg-neutral-50 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 dark:bg-white/5 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10'
                                    }`}
                            >
                                <Sliders className="w-4 h-4" />
                                <span className="text-sm font-medium">Speed & Pitch</span>
                                {(playbackRate !== 1.0 || pitch !== 0 || settings.magicCrossfade) && (
                                    <span className="text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">
                                        {playbackRate !== 1.0 && `${playbackRate.toFixed(1)}x`}
                                        {playbackRate !== 1.0 && (pitch !== 0 || settings.magicCrossfade) && ' / '}
                                        {pitch !== 0 && `${pitch > 0 ? '+' : ''}${pitch}`}
                                        {pitch !== 0 && settings.magicCrossfade && ' / '}
                                        {settings.magicCrossfade && 'Magic XF'}
                                    </span>
                                )}
                            </button>

                            {/* Speed & Pitch Modal - Centered Overlay */}
                            {showSpeedPitchModal && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/40 dark:bg-black/80 backdrop-blur-md"
                                    onClick={() => setShowSpeedPitchModal(false)}
                                >
                                    <div
                                        className="relative w-full max-w-sm bg-white dark:bg-neutral-950 rounded-2xl border border-neutral-200 dark:border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-6 transform transition-all scale-100 opacity-100"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Playback Settings</h3>
                                            <button
                                                onClick={() => setShowSpeedPitchModal(false)}
                                                className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition-all dark:text-white/60 dark:hover:text-white dark:hover:bg-white/10"
                                                aria-label="Close playback settings"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Speed Control */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-semibold text-neutral-500 dark:text-white/60 uppercase tracking-wide">Speed</label>
                                                <span className="text-xs font-mono text-neutral-600 dark:text-white/60">{playbackRate.toFixed(1)}x</span>
                                            </div>
                                            <div className="flex items-center justify-between bg-neutral-200 dark:bg-black/30 rounded-xl p-1">
                                                <button
                                                    onClick={() => {
                                                        const newSpeed = Math.max(0.5, Math.round((playbackRate - 0.1) * 10) / 10);
                                                        setPlaybackRate(newSpeed);
                                                    }}
                                                    className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 rounded-lg transition-all dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"
                                                    aria-label="Decrease speed"
                                                >
                                                    <Minus className="w-5 h-5" />
                                                </button>
                                                <div className="h-4 w-[1px] bg-neutral-300 dark:bg-white/10" />
                                                <button
                                                    onClick={() => {
                                                        const newSpeed = Math.min(2.0, Math.round((playbackRate + 0.1) * 10) / 10);
                                                        setPlaybackRate(newSpeed);
                                                    }}
                                                    className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 rounded-lg transition-all dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"
                                                    aria-label="Increase speed"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Pitch Control */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-semibold text-neutral-500 dark:text-white/60 uppercase tracking-wide">Pitch</label>
                                                <span className="text-xs font-mono text-neutral-600 dark:text-white/60">{pitch > 0 ? '+' : ''}{pitch}</span>
                                            </div>
                                            <div className="flex items-center justify-between bg-neutral-200 dark:bg-black/30 rounded-xl p-1">
                                                <button
                                                    onClick={() => setPitch(Math.max(-12, pitch - 1))}
                                                    className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 rounded-lg transition-all dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"
                                                    aria-label="Decrease pitch"
                                                >
                                                    <Minus className="w-5 h-5" />
                                                </button>
                                                <div className="h-4 w-[1px] bg-neutral-300 dark:bg-white/10" />
                                                <button
                                                    onClick={() => setPitch(Math.min(12, pitch + 1))}
                                                    className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 rounded-lg transition-all dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10"
                                                    aria-label="Increase pitch"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mode Toggle */}
                                        <div className="mb-6 p-1 bg-neutral-200 dark:bg-black/30 rounded-xl flex">
                                            <button
                                                onClick={() => setPitchCorrection(true)}
                                                className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${pitchCorrection
                                                    ? 'bg-white text-black shadow-lg'
                                                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                Digital
                                            </button>
                                            <button
                                                onClick={() => setPitchCorrection(false)}
                                                className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all ${!pitchCorrection
                                                    ? 'bg-white text-black shadow-lg'
                                                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                Analogue
                                            </button>
                                        </div>
                                        <div className="text-center mb-6">
                                            <p className="text-xs text-neutral-500 dark:text-white/60">
                                                {pitchCorrection ? 'Independent speed & pitch control' : 'Speed affects pitch (like vinyl)'}
                                            </p>
                                        </div>

                                        {/* Magic Crossfade Toggle */}
                                        <div className="mb-6">
                                            <button
                                                onClick={() => updateSettings({ magicCrossfade: !settings.magicCrossfade })}
                                                className="w-full flex items-center justify-between rounded-xl bg-neutral-200 p-4 text-left transition-all hover:bg-neutral-300 dark:bg-black/30 dark:hover:bg-white/10"
                                                aria-pressed={settings.magicCrossfade}
                                            >
                                                <div>
                                                    <div className="text-xs font-semibold text-neutral-500 dark:text-white/60 uppercase tracking-wide">Magic Crossfade</div>
                                                    <p className="mt-1 text-xs text-neutral-600 dark:text-white/60">Detects the ending and fades into the preloaded next track.</p>
                                                </div>
                                                <div className={`ml-4 h-7 w-12 shrink-0 rounded-full p-1 transition-all ${settings.magicCrossfade ? 'bg-primary' : 'bg-neutral-300 dark:bg-white/20'}`}>
                                                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.magicCrossfade ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </div>
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setPlaybackRate(1.0);
                                                setPitch(0);
                                                updateSettings({ magicCrossfade: false });
                                            }}
                                            className="w-full py-3.5 text-sm font-bold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all dark:text-white dark:bg-white/10 dark:hover:bg-white/20"
                                        >
                                            Reset to Default
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Lyrics Tab */}
                {activeTab === 'lyrics' && !isZenMode && (
                    <div className="flex-1 overflow-hidden relative">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar scroll-smooth" ref={lyricsContainerRef}>
                            <div className="min-h-full flex flex-col items-center justify-center py-20 px-6 text-center">
                                {loadingLyrics ? (
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 border-4 border-neutral-300 dark:border-white border-t-transparent rounded-full animate-spin mb-4" />
                                        <span className="text-neutral-600 dark:text-white/60">Loading lyrics...</span>
                                    </div>
                                ) : syncedLyrics.length > 0 ? (
                                    <div className="space-y-6 w-full max-w-4xl">
                                        {syncedLyrics.map((line, i) => {
                                            const isActive = i === activeLineIndex;
                                            return (
                                                <p
                                                    key={i}
                                                    ref={isActive ? activeLineRef : null}
                                                    className={`transition-all duration-500 cursor-pointer leading-relaxed ${isActive
                                                        ? 'text-3xl md:text-5xl font-bold text-neutral-900 dark:text-white'
                                                        : 'text-xl md:text-2xl font-medium text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
                                                        }`}
                                                    onClick={() => {
                                                        const audio = audioRef.current;
                                                        if (audio) audio.currentTime = line.time;
                                                        setCurrentTime(line.time);
                                                    }}
                                                >
                                                    {line.text}
                                                </p>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-lg text-neutral-600 dark:text-white/60 max-w-2xl whitespace-pre-line">
                                        {lyrics || "No lyrics found for this song."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Queue Tab */}
                {activeTab === 'queue' && !isZenMode && (
                    <div className="flex-1 overflow-hidden px-4 md:px-8 pb-8">
                        <div className="max-w-3xl mx-auto h-full flex flex-col">
                            <div className="flex items-center justify-between py-4">
                                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Up Next</h2>
                                <span className="text-sm text-neutral-600 dark:text-white/60">{queue.length} songs</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {queue.map((song, idx) => (
                                    <div
                                        key={`${song.id}-${idx}`}
                                        onClick={() => playSong(song, queue)}
                                        className={`flex items-center p-3 rounded-lg transition-all cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/5 mb-1 ${idx === currentSongIndex ? 'bg-neutral-200 dark:bg-white/10' : ''
                                            }`}
                                    >
                                        <div className="w-8 text-center font-mono text-sm mr-4 text-neutral-500 dark:text-white/60">
                                            {idx === currentSongIndex && isPlaying ? (
                                                <div className="flex justify-center gap-0.5">
                                                    <div className="w-0.5 h-3 bg-neutral-900 dark:bg-white animate-pulse" />
                                                    <div className="w-0.5 h-3 bg-neutral-900 dark:bg-white animate-pulse delay-75" />
                                                    <div className="w-0.5 h-3 bg-neutral-900 dark:bg-white animate-pulse delay-150" />
                                                </div>
                                            ) : idx + 1}
                                        </div>
                                        <div className="w-12 h-12 rounded overflow-hidden bg-neutral-200 dark:bg-neutral-800 mr-4 shrink-0">
                                            <img src={service.getCoverArtUrl(song.id, 100)} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-semibold truncate ${idx === currentSongIndex ? 'text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-white/80'}`}>
                                                {song.title}
                                            </div>
                                            <div className="text-sm text-neutral-600 dark:text-white/60 truncate">{song.artist}</div>
                                        </div>
                                        <span className="text-sm font-mono text-neutral-500 dark:text-white/50 ml-4">
                                            {formatTime(song.duration)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Zen Mode Controls */}
            {
                isZenMode && (
                    <div className={`absolute bottom-0 left-0 right-0 z-50 transition-all duration-300 ${showZenControls ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}>
                        <div className="bg-gradient-to-t from-black via-black/90 to-transparent px-6 pb-8 pt-24 md:px-10">
                            <div className="grid items-end gap-6 md:grid-cols-[minmax(220px,320px)_1fr_minmax(220px,320px)]">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/10 shadow-2xl md:h-24 md:w-24">
                                        <img src={coverArt} alt={currentSong.title} className="h-full w-full object-cover" />
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <div className="relative max-w-full overflow-hidden">
                                            <h2 className="zen-title-marquee text-lg font-black text-white md:text-2xl">
                                                <span>{currentSong.title}</span>
                                                <span aria-hidden="true">{currentSong.title}</span>
                                            </h2>
                                        </div>
                                        <p className="mt-1 truncate text-sm font-medium text-white/55 md:text-base">{currentSong.artist}</p>
                                    </div>
                                </div>

                                <div className="min-w-0">
                                    <div className="mb-5 flex items-center justify-center gap-8">
                                        <button onClick={prevSong} className="p-4 text-white/50 transition hover:text-white" aria-label="Previous track">
                                            <SkipBack className="h-7 w-7" fill="currentColor" />
                                        </button>
                                        <button
                                            onClick={togglePlay}
                                            className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-black shadow-xl transition hover:scale-105"
                                            aria-label={isPlaying ? 'Pause' : 'Play'}
                                        >
                                            {isPlaying ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-0.5 h-7 w-7" fill="currentColor" />}
                                        </button>
                                        <button onClick={nextSong} className="p-4 text-white/50 transition hover:text-white" aria-label="Next track">
                                            <SkipForward className="h-7 w-7" fill="currentColor" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <span className="w-12 text-right font-mono text-sm text-white/60">{formatTime(currentTime)}</span>
                                        <PlaybackProgress
                                            progress={displayProgress}
                                            mode={progressMode}
                                            accentColor={colors.primary}
                                            baseColor={withAlpha(colors.primary, progressMode === 'waveform' ? 0.28 : 0.18)}
                                            markerColor={colors.secondary || colors.primary}
                                            waveform={waveform}
                                            onScrub={handleScrub}
                                            trackClassName={`flex-1 cursor-pointer transition-all duration-300 ${progressMode === 'waveform'
                                                ? 'h-16 bg-transparent rounded-none'
                                                : 'h-1.5 bg-white/10 rounded'
                                                }`}
                                        />
                                        <span className="w-12 font-mono text-sm text-white/60">{formatTime(duration)}</span>
                                    </div>
                                </div>

                                <div className="hidden md:block" />
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
