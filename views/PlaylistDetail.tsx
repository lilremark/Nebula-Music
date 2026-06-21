import React, { useEffect, useState } from 'react';
import { useStore } from '../context/Store';
import { IPlaylist, ISong } from '../types';
import { Play, Clock, ArrowLeft, Trash2, ListMusic, Shuffle, Save, ListPlus, Info, BarChart2, Heart, Pause } from 'lucide-react';
import { useAdaptiveColors } from '../hooks/useAdaptiveColors';
import { containsSameSongs } from '../utils/playback';

export const PlaylistDetailView: React.FC = () => {
    const { viewData, setView, goBack, backTarget, playSong, togglePlay, isPlaying, queue, currentSongIndex, currentRadioStation, playlists, deletePlaylist, savePlaylist, service, openPlaylistModal, isDemoMode, toggleLike } = useStore();
    const [playlist, setPlaylist] = useState<IPlaylist | null>(null);
    const [isSavedPlaylist, setIsSavedPlaylist] = useState(true);
    const [showFullNotes, setShowFullNotes] = useState(false);

    // Extract colors from playlist cover art for accent backgrounds
    const playlistArtUrl = playlist ? service.getCoverArtUrl(playlist.coverArt || playlist.id, 200) : undefined;
    const { colors: playlistColors } = useAdaptiveColors(playlistArtUrl);

    useEffect(() => {
        const load = async () => {
            if (typeof viewData === 'string') {
                let pl = playlists.find(p => p.id === viewData);
                if (!pl || (pl && (!pl.songs || pl.songs.length === 0) && !isDemoMode)) {
                    const fullPl = await service.getPlaylist(viewData);
                    if (fullPl) { setPlaylist(fullPl); setIsSavedPlaylist(true); return; }
                }
                if (pl) { setPlaylist(pl); setIsSavedPlaylist(true); }
            } else if (typeof viewData === 'object' && viewData !== null) {
                setPlaylist(viewData);
                setIsSavedPlaylist(playlists.some(p => p.id === viewData.id));
            }
        };
        load();
    }, [viewData, playlists, service, isDemoMode]);

    if (!playlist) return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-600 dark:text-white/60">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-sm">Loading Playlist...</span>
        </div>
    );

    const handleSave = () => { if (playlist) { savePlaylist(playlist); setView('PLAYLISTS'); } };

    const handleSongLike = (song: ISong) => {
        toggleLike(song);
        setPlaylist(prev => prev ? { ...prev, songs: prev.songs?.map(s => s.id === song.id ? { ...s, starred: !s.starred } : s) } : null);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
    };

    const formatTotalTime = (s: number) => {
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
    };

    const getQualityBadge = (suffix?: string) => {
        if (!suffix) return null;
        const s = suffix.toUpperCase();
        const isLossless = s === 'FLAC' || s === 'ALAC' || s === 'WAV';
        return (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isLossless ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-white/60'}`}>
                {s}
            </span>
        );
    };

    const currentSong = queue[currentSongIndex];
    const isPlaylistQueueActive = Boolean(currentSong)
        && !currentRadioStation
        && Boolean(playlist.songs?.length)
        && containsSameSongs(queue, playlist.songs!);
    const handlePlaylistPlay = () => {
        if (!playlist.songs?.length) return;

        if (isPlaylistQueueActive) {
            togglePlay();
            return;
        }

        playSong(playlist.songs[0], playlist.songs);
    };
    const comment = playlist.comment || (!isSavedPlaylist ? (playlist as any).desc : null);
    const defaultBackView = isSavedPlaylist ? 'PLAYLISTS' : 'BROWSE';
    const backLabel = (() => {
        switch (backTarget?.view) {
            case 'HOME': return 'Home';
            case 'BROWSE': return 'Browse';
            case 'ARTISTS': return 'Artists';
            case 'ARTIST_DETAIL': return 'Artist';
            case 'ALBUMS': return 'Albums';
            case 'ALBUM_DETAIL': return 'Album';
            case 'PLAYLISTS': return 'Playlists';
            case 'PLAYLIST_DETAIL': return 'Playlist';
            case 'SEARCH': return 'Search';
            case 'LIKED_ALBUMS': return 'Liked Albums';
            case 'LIKED_SONGS': return 'Liked Songs';
            case 'SONGS': return 'Songs';
            default: return isSavedPlaylist ? 'Playlists' : 'Browse';
        }
    })();

    return (
        <div className="min-h-full pb-32 w-full">
            {/* Hero Header - full width */}
            <div className="relative pt-4">
                {/* Background with playlist image and blur */}
                <div className="absolute inset-x-0 top-0 h-[420px] overflow-hidden pointer-events-none">
                    {playlist.coverArt ? (
                        <img
                            src={service.getCoverArtUrl(playlist.coverArt, 400)}
                            className="absolute w-full h-full object-cover blur-3xl opacity-25 scale-150"
                            alt=""
                        />
                    ) : (
                        <div className="absolute w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-3xl" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-neutral-200/90 to-neutral-200 dark:from-neutral-950/40 dark:via-neutral-950/85 dark:to-neutral-950" />
                </div>

                <div className="relative z-10 px-6 lg:px-10 pt-2 pb-10">
                    {/* Back button */}
                    <button
                        onClick={() => goBack(defaultBackView)}
                        className="mb-5 flex items-center text-neutral-600 hover:text-neutral-900 transition text-sm font-medium group dark:text-white/50 dark:hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        {backLabel}
                    </button>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Cover Art */}
                        <div className="shrink-0 w-56 h-56 md:w-72 md:h-72 rounded-xl overflow-hidden shadow-2xl bg-neutral-200 dark:bg-neutral-900">
                            {playlist.coverArt ? (
                                <img
                                    src={service.getCoverArtUrl(playlist.coverArt, 500)}
                                    alt={playlist.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ListMusic className="w-32 h-32 text-neutral-400 dark:text-white/50" />
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 flex flex-col justify-end">
                            <p className="text-[10px] font-bold text-neutral-600 dark:text-white/60 uppercase tracking-widest mb-1">Playlist</p>
                            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-2 leading-tight">{playlist.name}</h1>

                            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-white/60 mb-4">
                                {playlist.songCount && (
                                    <>
                                        <span>{playlist.songCount} tracks</span>
                                        <span className="text-neutral-400 dark:text-white/50">•</span>
                                    </>
                                )}
                                {playlist.duration && <span>{formatTotalTime(playlist.duration)}</span>}
                                {playlist.created && (
                                    <>
                                        <span className="text-neutral-400 dark:text-white/50">•</span>
                                        <span>Created {new Date(playlist.created).toLocaleDateString()}</span>
                                    </>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-3 mt-2">
                                {playlist.songs && playlist.songs.length > 0 && (
                                    <>
                                        <button
                                            onClick={handlePlaylistPlay}
                                            className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition text-sm shadow-xl dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                                        >
                                            {isPlaying && isPlaylistQueueActive ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                            {isPlaying && isPlaylistQueueActive ? 'Pause' : 'Play'}
                                        </button>
                                        <button
                                            className="p-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 hover:text-neutral-900 transition dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                            title="Shuffle"
                                            aria-label="Shuffle playlist"
                                            onClick={() => {
                                                if (playlist.songs) {
                                                    const shuffled = [...playlist.songs].sort(() => Math.random() - 0.5);
                                                    playSong(shuffled[0], shuffled);
                                                }
                                            }}
                                        >
                                            <Shuffle className="w-4 h-4" />
                                        </button>
                                    </>
                                )}

                                {!isSavedPlaylist && (
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-4 py-2 bg-neutral-200 text-neutral-700 font-medium rounded-lg hover:bg-neutral-300 hover:text-neutral-900 transition text-sm dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save Playlist
                                    </button>
                                )}

                                {isSavedPlaylist && (
                                    <button
                                        onClick={() => { if (confirm('Are you sure you want to delete this playlist?')) deletePlaylist(playlist.id); }}
                                        className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition"
                                        title="Delete Playlist"
                                        aria-label="Delete playlist"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - full width */}
            <div className="px-6 lg:px-10 pt-4">
                {/* About Section */}
                {comment && (
                    <div className="mb-8 mt-4">
                        <div
                            className="flex items-start gap-3 p-4 bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-200 transition dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/[0.07]"
                            onClick={() => setShowFullNotes(!showFullNotes)}
                        >
                            <Info className="w-4 h-4 text-neutral-500 dark:text-white/60 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-1">About</h3>
                                <p className={`text-sm text-neutral-700 dark:text-white/70 leading-relaxed ${!showFullNotes ? 'line-clamp-2' : ''}`}>
                                    {comment}
                                </p>
                                {comment.length > 120 && (
                                    <span className="text-xs text-primary mt-1 inline-block">
                                        {showFullNotes ? 'Show less' : 'Read more'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Track List Section - with playlist-colored accent */}
                <section
                    className="mb-8 rounded-xl overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${playlistColors.surface} 0%, transparent 100%)`,
                    }}
                >
                    <div className="p-4">
                        <h2 className="text-sm font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-3">Tracks</h2>
                        <div className="border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden" style={{ borderColor: playlistColors.primaryMuted }}>
                            {playlist.songs?.map((song, idx) => {
                                const isCurrent = currentSong?.id === song.id;

                                return (
                                    <div
                                        key={`${song.id}-${idx}`}
                                        className={`group flex items-center gap-4 px-5 py-4 cursor-pointer transition border-b border-neutral-200 dark:border-white/5 last:border-0 hover:bg-neutral-200 dark:hover:bg-white/5 ${isCurrent ? 'bg-neutral-200 dark:bg-white/5' : ''}`}
                                        onClick={() => playlist.songs && playSong(song, playlist.songs)}
                                    >
                                        {/* Track number / Play */}
                                        <div className="w-7 text-center relative shrink-0">
                                            {isCurrent && isPlaying ? (
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <div className="w-0.5 h-2 bg-primary animate-[bounce_1s_infinite_0ms]" />
                                                    <div className="w-0.5 h-4 bg-primary animate-[bounce_1s_infinite_150ms]" />
                                                    <div className="w-0.5 h-3 bg-primary animate-[bounce_1s_infinite_300ms]" />
                                                </div>
                                            ) : (
                                                <>
                                                    {isCurrent ? (
                                                        <Pause className="w-3.5 h-3.5 text-primary mx-auto" />
                                                    ) : (
                                                        <span className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-neutral-500 dark:text-white/60 group-hover:text-neutral-900 dark:group-hover:text-white/60'} transition`}>
                                                            {idx + 1}
                                                        </span>
                                                    )}
                                                    <Play className="w-3.5 h-3.5 text-white absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition fill-current" />
                                                </>
                                            )}
                                        </div>

                                        {/* Title & Artist */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate transition ${isCurrent ? 'text-primary' : 'text-neutral-900 dark:text-white group-hover:text-neutral-900 dark:group-hover:text-white'}`}>
                                                {song.title}
                                            </p>
                                            <p className="text-xs text-neutral-600 dark:text-white/60 truncate">{song.artist}</p>
                                        </div>

                                        {/* Play count */}
                                        {song.playCount && song.playCount > 0 && (
                                            <div className="hidden md:flex items-center gap-1 text-[10px] text-neutral-500 dark:text-white/50 font-mono shrink-0">
                                                <BarChart2 className="w-3 h-3" />
                                                {song.playCount}
                                            </div>
                                        )}

                                        {/* Duration */}
                                        <span className="text-xs text-neutral-500 dark:text-white/60 font-mono w-10 text-right shrink-0">
                                            {formatTime(song.duration)}
                                        </span>

                                        {/* Actions - always visible */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Quality badge */}
                                            <div className="shrink-0">
                                                {getQualityBadge(song.suffix)}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSongLike(song); }}
                                                className={`p-1.5 rounded hover:bg-neutral-200 transition dark:hover:bg-white/10 ${song.starred ? 'text-red-400' : 'text-neutral-500 hover:text-neutral-900 dark:text-white/50 dark:hover:text-white'}`}
                                                title={song.starred ? "Unlike" : "Like"}
                                                aria-label={song.starred ? 'Unlike song' : 'Like song'}
                                            >
                                                <Heart className={`w-4 h-4 ${song.starred ? 'fill-current' : ''}`} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openPlaylistModal(song); }}
                                                className="p-1.5 rounded hover:bg-neutral-200 text-neutral-500 hover:text-primary transition dark:hover:bg-white/10 dark:text-white/50"
                                                title="Add to playlist"
                                                aria-label="Add to playlist"
                                            >
                                                <ListPlus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {(!playlist.songs || playlist.songs.length === 0) && (
                                <div className="p-12 text-center text-neutral-600 dark:text-white/60">
                                    <ListMusic className="w-10 h-10 mx-auto mb-3 opacity-60" />
                                    <p className="text-sm">This playlist is empty.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};



