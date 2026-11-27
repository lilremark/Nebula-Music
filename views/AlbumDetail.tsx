import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../context/Store';
import { IAlbum, ISong } from '../types';
import { Play, Shuffle, Heart, ListPlus, BarChart2, Disc, Pause } from 'lucide-react';
import { useAdaptiveColors } from '../hooks/useAdaptiveColors';
import { containsSameSongs } from '../utils/playback';
import { CollectionHeader } from '../components/CollectionHeader';
import { AlbumCard, COLLECTION_GRID_CLASS } from '../components/DetailCards';

export const AlbumDetailView: React.FC = () => {
    const { viewData, setView, service, playSong, togglePlay, isPlaying, queue, currentSongIndex, currentRadioStation, openPlaylistModal, toggleLike } = useStore();
    const [album, setAlbum] = useState<IAlbum | null>(null);
    const [relatedAlbums, setRelatedAlbums] = useState<IAlbum[]>([]);
    const [showFullNotes, setShowFullNotes] = useState(false);

    // Extract colors from album art for accent backgrounds
    const albumArtUrl = album ? service.getCoverArtUrl(album.coverArt || album.id, 200) : undefined;
    const { colors: albumColors, defaultColors, isLoading: isColorLoading } = useAdaptiveColors(albumArtUrl);

    useEffect(() => {
        let cancelled = false;
        setAlbum(null);
        setRelatedAlbums([]);
        setShowFullNotes(false);
        const load = async () => {
            if (viewData) {
                const data = await service.getAlbum(viewData);
                if (cancelled) return;
                setAlbum(data);
                if (!data) return;

                if (data.artistId) {
                    try {
                        const { albums } = await service.getArtist(data.artistId);
                        if (cancelled) return;
                        setRelatedAlbums(albums.filter(a => a.id !== data.id).slice(0, 6));
                    } catch (e) {
                        console.warn('Could not load related albums');
                    }
                }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [viewData, service]);

    const hasMultiDisc = useMemo(() => {
        return (album?.songs || []).some(s => (s.discNumber || 1) > 1);
    }, [album]);

    if (!album) return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-600 dark:text-white/60">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-sm">Loading Album...</span>
        </div>
    );

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

    const displayedSongCount = album.songs?.length || album.songCount;
    const displayedDuration = album.songs?.length
        ? album.songs.reduce((total, song) => total + song.duration, 0)
        : album.duration;

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

    const toggleAlbumLike = async () => {
        if (!album) return;
        const newStatus = !album.starred;
        setAlbum({ ...album, starred: newStatus });
        await service.toggleStar(album.id, newStatus, 'album');
    };

    const handleSongLike = (song: ISong) => {
        toggleLike(song);
        setAlbum(prev => prev ? { ...prev, songs: prev.songs?.map(s => s.id === song.id ? { ...s, starred: !s.starred } : s) } : null);
    };

    const currentSong = queue[currentSongIndex];
    const isAlbumQueueActive = Boolean(currentSong)
        && !currentRadioStation
        && Boolean(album.songs?.length)
        && containsSameSongs(queue, album.songs!);
    const handleAlbumPlay = () => {
        if (!album.songs?.length) return;

        if (isAlbumQueueActive) {
            togglePlay();
            return;
        }

        playSong(album.songs[0], album.songs);
    };
    return (
        <div className="min-h-full pb-32 w-full" data-nebula-view="album-detail" style={{
            '--album-color': isColorLoading || albumColors === defaultColors ? 'var(--next-surface)' : albumColors.primary,
        } as React.CSSProperties}>
            <CollectionHeader title={album.name} artwork={
                <img
                    src={service.getCoverArtUrl(album.coverArt || album.id, 500)}
                    alt={album.name}
                    className="w-full h-full object-cover"
                />
            } metadata={
                <div data-nebula-album-meta>
                    <button
                        type="button"
                        className="nebula-collection-artist"
                        title={album.artist}
                        onClick={() => album.artistId && setView('ARTIST_DETAIL', album.artistId)}
                    >
                        {album.artist}
                    </button>
                    <p className="nebula-collection-facts">
                        {album.year ? <>{album.year}<span aria-hidden="true"> · </span></> : null}
                        {displayedSongCount} {displayedSongCount === 1 ? 'song' : 'songs'}, {formatTotalTime(displayedDuration)}
                    </p>
                </div>
            } actions={
                <div data-nebula-album-options className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleAlbumPlay}
                        className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition text-sm dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                    >
                        {isPlaying && isAlbumQueueActive ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        {isPlaying && isAlbumQueueActive ? 'Pause' : 'Play'}
                    </button>
                    <button
                        className="p-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 hover:text-neutral-900 transition dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                        title="Shuffle"
                        aria-label="Shuffle album"
                        onClick={() => {
                            if (album.songs) {
                                const shuffled = [...album.songs].sort(() => Math.random() - 0.5);
                                playSong(shuffled[0], shuffled);
                            }
                        }}
                    >
                        <Shuffle className="w-4 h-4" />
                    </button>
                    <button
                        onClick={toggleAlbumLike}
                        className={`p-2 rounded-lg transition ${album.starred ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400' : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 hover:text-neutral-900 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'}`}
                        title={album.starred ? "Unlike" : "Like"}
                        aria-label={album.starred ? 'Unlike album' : 'Like album'}
                    >
                        <Heart className={`w-4 h-4 ${album.starred ? 'fill-current' : ''}`} />
                    </button>
                </div>
            } />

            {/* Main Content - full width */}
            <div data-nebula-detail-content>
                {/* Track List Section - with album-colored accent */}
                <section
                    data-nebula-track-section
                    className="mb-8"
                >
                    <div data-nebula-track-section-inner>
                        <h2 className="sr-only">Tracks</h2>
                        <div data-nebula-track-list>
                            {album.songs?.map((song, idx) => {
                                const isCurrent = !currentRadioStation && currentSong?.id === song.id;
                                const discNumber = song.discNumber || 1;
                                const prevDisc = idx > 0 ? (album.songs![idx - 1].discNumber || 1) : 0;
                                const showDiscHeader = hasMultiDisc && discNumber !== prevDisc;

                                return (
                                    <React.Fragment key={song.id}>
                                        {showDiscHeader && (
                                            <div data-nebula-disc-header className="flex items-center gap-2">
                                                <Disc className="w-3.5 h-3.5" aria-hidden="true" />
                                                Disc {discNumber}
                                            </div>
                                        )}
                                        <div
                                            data-nebula-track-row
                                            data-current={isCurrent}
                                            className="group flex items-center gap-4 cursor-pointer"
                                            onClick={() => album.songs && playSong(song, album.songs)}
                                        >
                                            {/* Track number / Play */}
                                            <button type="button" data-nebula-track-play aria-label={`Play ${song.title}`} className="w-7 text-center relative shrink-0" onClick={event => {
                                                event.stopPropagation();
                                                if (album.songs) playSong(song, album.songs);
                                            }}>
                                                {isCurrent && isPlaying ? (
                                                    <div className="flex gap-0.5 items-end justify-center h-4">
                                                        <div className="w-0.5 bg-primary animate-pulse h-2"></div>
                                                        <div className="w-0.5 bg-primary animate-pulse h-3"></div>
                                                        <div className="w-0.5 bg-primary animate-pulse h-4"></div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className={`nebula-time group-hover:opacity-0 transition ${isCurrent ? 'text-primary' : 'text-neutral-600 dark:text-white/60'}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <Play className="w-3.5 h-3.5 text-neutral-900 dark:text-white absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition fill-current" />
                                                    </>
                                                )}
                                            </button>

                                            {/* Title & Artist */}
                                            <div className="flex-1 min-w-0">
                                                <p data-nebula-track-title className={`text-sm font-medium truncate transition ${isCurrent ? 'text-primary' : 'text-neutral-900 dark:text-white group-hover:text-neutral-900 dark:group-hover:text-white'}`}>
                                                    {song.title}
                                                </p>
                                                {song.artist !== album.artist && (
                                                    <p className="text-xs text-neutral-600 dark:text-white/60 truncate">{song.artist}</p>
                                                )}
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
                                                {/* Quality badge - moved here */}
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
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </section>


                {/* About Section */}
                {album.info?.notes && (
                    <section data-nebula-about className="nebula-detail-section">
                        <h2 className="nebula-section-title">About</h2>
                        <p className={`nebula-about-copy ${!showFullNotes ? 'line-clamp-3' : ''}`}>
                            {album.info.notes}
                        </p>
                        {album.info.notes.length > 120 && (
                            <button type="button" className="nebula-text-button" aria-expanded={showFullNotes} onClick={() => setShowFullNotes(!showFullNotes)}>
                                {showFullNotes ? 'Show less' : 'Read more'}
                            </button>
                        )}
                    </section>
                )}

                {/* Related Albums */}
                {relatedAlbums.length > 0 && (
                    <section className="nebula-detail-section" data-nebula-related>
                        <h2 className="nebula-section-title">More by {album.artist}</h2>
                        <div data-nebula-collection-grid className={COLLECTION_GRID_CLASS}>
                            {relatedAlbums.map((related) => (
                                <AlbumCard
                                    key={related.id}
                                    title={related.name}
                                    subtitle={related.year}
                                    imageUrl={service.getCoverArtUrl(related.coverArt || related.id, 400)}
                                    onOpen={() => setView('ALBUM_DETAIL', related.id)}
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};



