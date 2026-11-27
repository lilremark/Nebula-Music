import React, { useEffect, useState } from 'react';
import { useStore } from '../context/Store';
import { IPlaylist, ISong } from '../types';
import { Play, Trash2, ListMusic, Shuffle, Save, ListPlus, BarChart2, Heart, Pause } from 'lucide-react';
import { useAdaptiveColors } from '../hooks/useAdaptiveColors';
import { containsSameSongs } from '../utils/playback';
import { CollectionHeader } from '../components/CollectionHeader';

export const PlaylistDetailView: React.FC = () => {
    const { viewData, setView, playSong, togglePlay, isPlaying, queue, currentSongIndex, currentRadioStation, playlists, deletePlaylist, savePlaylist, service, openPlaylistModal, isDemoMode, toggleLike } = useStore();
    const [playlist, setPlaylist] = useState<IPlaylist | null>(null);
    const [isSavedPlaylist, setIsSavedPlaylist] = useState(true);
    const [showFullNotes, setShowFullNotes] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // The inline delete confirmation quietly disarms itself after a few seconds.
    useEffect(() => {
        if (!confirmingDelete) return;
        const timer = window.setTimeout(() => setConfirmingDelete(false), 4000);
        return () => window.clearTimeout(timer);
    }, [confirmingDelete]);

    // Extract colors from playlist cover art for accent backgrounds
    const playlistArtUrl = playlist ? service.getCoverArtUrl(playlist.coverArt || playlist.id, 200) : undefined;
    const { colors: playlistColors, defaultColors, isLoading: isColorLoading } = useAdaptiveColors(playlistArtUrl);

    useEffect(() => {
        let cancelled = false;
        setPlaylist(null);
        setShowFullNotes(false);
        setConfirmingDelete(false);
        const load = async () => {
            if (typeof viewData === 'string') {
                let pl = playlists.find(p => p.id === viewData);
                if (!pl || (pl && (!pl.songs || pl.songs.length === 0) && !isDemoMode)) {
                    const fullPl = await service.getPlaylist(viewData);
                    if (cancelled) return;
                    if (fullPl) { setPlaylist(fullPl); setIsSavedPlaylist(true); return; }
                }
                if (pl) { setPlaylist(pl); setIsSavedPlaylist(true); }
            } else if (typeof viewData === 'object' && viewData !== null) {
                setPlaylist(viewData);
                setIsSavedPlaylist(playlists.some(p => p.id === viewData.id));
            }
        };
        load();
        return () => { cancelled = true; };
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
            <span data-nebula-track-quality className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isLossless ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-white/60'}`}>
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
    return (
        <div className="min-h-full pb-32 w-full" data-nebula-view="playlist-detail" style={{
            '--album-color': isColorLoading || playlistColors === defaultColors ? 'var(--next-surface)' : playlistColors.primary,
        } as React.CSSProperties}>
            <CollectionHeader title={playlist.name} artwork={
                playlist.coverArt ? (
                    <img
                        src={service.getCoverArtUrl(playlist.coverArt, 500)}
                        alt={playlist.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ListMusic className="w-32 h-32 text-neutral-400 dark:text-white/50" />
                    </div>
                )
            } metadata={
                <div data-nebula-album-meta>
                    <p className="nebula-collection-facts">
                        {[
                            playlist.songCount ? `${playlist.songCount} ${playlist.songCount === 1 ? 'track' : 'tracks'}` : null,
                            playlist.duration ? formatTotalTime(playlist.duration) : null,
                            playlist.created ? `Created ${new Date(playlist.created).toLocaleDateString()}` : null,
                        ].filter(Boolean).join(' · ')}
                    </p>
                </div>
            } actions={
                <div data-nebula-album-options className="flex flex-1 min-w-0 items-center gap-3">
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
                            type="button"
                            data-nebula-playlist-delete
                            data-confirming={confirmingDelete}
                            onClick={() => {
                                if (confirmingDelete) { setConfirmingDelete(false); deletePlaylist(playlist.id); }
                                else setConfirmingDelete(true);
                            }}
                            onBlur={() => setConfirmingDelete(false)}
                            onKeyDown={event => { if (event.key === 'Escape' && confirmingDelete) { event.stopPropagation(); setConfirmingDelete(false); } }}
                            className="nebula-collection-delete"
                            title={confirmingDelete ? 'Click again to delete this playlist' : 'Delete playlist'}
                            aria-label={confirmingDelete ? 'Confirm delete playlist' : 'Delete playlist'}
                        >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            {confirmingDelete && <span>Delete playlist?</span>}
                        </button>
                    )}
                </div>
            } />

            {/* Main Content - full width */}
            <div data-nebula-detail-content>
                {/* Track List Section - with playlist-colored accent */}
                <section
                    data-nebula-track-section
                    className="mb-8"
                >
                    <div data-nebula-track-section-inner>
                        <h2 className="sr-only">Tracks</h2>
                        <div data-nebula-track-list>
                            {playlist.songs?.map((song, idx) => {
                                const isCurrent = !currentRadioStation && currentSong?.id === song.id;

                                return (
                                    <div
                                        data-nebula-track-row
                                        data-current={isCurrent}
                                        key={`${song.id}-${idx}`}
                                        className="group flex items-center gap-4 cursor-pointer"
                                        onClick={() => playlist.songs && playSong(song, playlist.songs)}
                                    >
                                        {/* Track number / Play */}
                                        <button type="button" data-nebula-track-play aria-label={`Play ${song.title}`} className="w-7 text-center relative shrink-0" onClick={event => {
                                            event.stopPropagation();
                                            if (playlist.songs) playSong(song, playlist.songs);
                                        }}>
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
                                                        <span className="nebula-time text-neutral-500 dark:text-white/60 group-hover:opacity-0 transition">
                                                            {idx + 1}
                                                        </span>
                                                    )}
                                                    <Play className="w-3.5 h-3.5 text-neutral-900 dark:text-white absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition fill-current" />
                                                </>
                                            )}
                                        </button>

                                        {/* Title & Artist */}
                                        <div className="flex-1 min-w-0">
                                            <p data-nebula-track-title className={`text-sm font-medium truncate transition ${isCurrent ? 'text-primary' : 'text-neutral-900 dark:text-white group-hover:text-neutral-900 dark:group-hover:text-white'}`}>
                                                {song.title}
                                            </p>
                                            <p className="text-xs text-neutral-600 dark:text-white/60 truncate">{song.artist}</p>
                                        </div>

                                        {/* Play count */}
                                        {song.playCount && song.playCount > 0 && (
                                            <div data-nebula-track-plays className="nebula-time hidden md:flex items-center gap-1 shrink-0" title={`${song.playCount} plays`}>
                                                <BarChart2 className="w-3 h-3" aria-hidden="true" />
                                                {song.playCount}
                                            </div>
                                        )}

                                        {/* Duration */}
                                        <span data-nebula-track-duration className="nebula-time text-right shrink-0">
                                            {formatTime(song.duration)}
                                        </span>

                                        {/* Actions - always visible */}
                                        <div className="flex items-center gap-2 shrink-0" data-nebula-track-actions>
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
                {/* About Section */}
                {comment && (
                    <section data-nebula-about className="nebula-detail-section">
                        <h2 className="nebula-section-title">About</h2>
                        <p className={`nebula-about-copy ${!showFullNotes ? 'line-clamp-3' : ''}`}>
                            {comment}
                        </p>
                        {comment.length > 120 && (
                            <button type="button" className="nebula-text-button" aria-expanded={showFullNotes} onClick={() => setShowFullNotes(!showFullNotes)}>
                                {showFullNotes ? 'Show less' : 'Read more'}
                            </button>
                        )}
                    </section>
                )}


            </div>
        </div>
    );
};



