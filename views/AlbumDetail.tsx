import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../context/Store';
import { IAlbum, ISong } from '../types';
import { Play, Shuffle, Heart, ArrowLeft, ListPlus, BarChart2, Disc, Pause, Info } from 'lucide-react';
import { useAdaptiveColors } from '../hooks/useAdaptiveColors';

export const AlbumDetailView: React.FC = () => {
    const { viewData, setView, goBack, backTarget, service, playSong, isPlaying, queue, currentSongIndex, openPlaylistModal, toggleLike } = useStore();
    const [album, setAlbum] = useState<IAlbum | null>(null);
    const [relatedAlbums, setRelatedAlbums] = useState<IAlbum[]>([]);
    const [showFullNotes, setShowFullNotes] = useState(false);
    const [artistImage, setArtistImage] = useState<string>('');

    // Extract colors from album art for accent backgrounds
    const albumArtUrl = album ? service.getCoverArtUrl(album.coverArt || album.id, 200) : undefined;
    const { colors: albumColors } = useAdaptiveColors(albumArtUrl);

    useEffect(() => {
        const load = async () => {
            if (viewData) {
                const data = await service.getAlbum(viewData);
                setAlbum(data);
                if (!data) return;

                if (data.artistId) {
                    try {
                        const { albums } = await service.getArtist(data.artistId);
                        setRelatedAlbums(albums.filter(a => a.id !== data.id).slice(0, 6));

                        // Fetch artist info for background image
                        const artistInfo = await service.getArtistInfo(data.artistId, data.artist);
                        if (artistInfo.image) {
                            setArtistImage(artistInfo.image);
                        }
                    } catch (e) {
                        console.warn('Could not load related albums or artist info');
                    }
                }
            }
        };
        load();
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
    const isAlbumPlaying = currentSong?.albumId === album.id || currentSong?.album === album.name;
    const backLabel = (() => {
        switch (backTarget?.view) {
            case 'HOME': return 'Home';
            case 'BROWSE': return 'Browse';
            case 'ARTISTS': return 'Artists';
            case 'ARTIST_DETAIL': return 'Artist';
            case 'ALBUM_DETAIL': return 'Album';
            case 'PLAYLISTS': return 'Playlists';
            case 'PLAYLIST_DETAIL': return 'Playlist';
            case 'SEARCH': return 'Search';
            case 'LIKED_ALBUMS': return 'Liked Albums';
            case 'LIKED_SONGS': return 'Liked Songs';
            case 'SONGS': return 'Songs';
            default: return 'Albums';
        }
    })();

    return (
        <div className="min-h-full pb-32 w-full">
            {/* Hero Header - full width */}
            <div className="relative pt-4">
                {/* Background with artist image and blur */}
                <div className="absolute inset-x-0 top-0 h-[420px] overflow-hidden pointer-events-none">
                    {artistImage ? (
                        <img
                            src={artistImage}
                            className="absolute w-full h-full object-cover blur-2xl opacity-20 scale-110"
                            alt=""
                            onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                    ) : (
                        <img
                            src={service.getCoverArtUrl(album.coverArt || album.id, 400)}
                            className="absolute w-full h-full object-cover blur-3xl opacity-25 scale-150"
                            alt=""
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-neutral-200/90 to-neutral-200 dark:from-neutral-950/40 dark:via-neutral-950/85 dark:to-neutral-950" />
                </div>

                <div className="relative z-10 px-6 lg:px-10 pt-2 pb-10">
                    {/* Back button */}
                    <button
                        onClick={() => goBack('ALBUMS')}
                        className="mb-5 flex items-center text-neutral-600 hover:text-neutral-900 transition text-sm font-medium group dark:text-white/50 dark:hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        {backLabel}
                    </button>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Cover Art */}
                        <div className="shrink-0 w-56 h-56 md:w-72 md:h-72 rounded-xl overflow-hidden shadow-2xl bg-neutral-200 dark:bg-neutral-900">
                            <img
                                src={service.getCoverArtUrl(album.coverArt || album.id, 500)}
                                alt={album.name}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {/* Info */}
                        <div className="flex-1 flex flex-col justify-end">
                            <p className="text-[10px] font-bold text-neutral-600 dark:text-white/60 uppercase tracking-widest mb-1">Album</p>
                            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-2 leading-tight">{album.name}</h1>

                            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-white/60 mb-4">
                                <button
                                    className="hover:text-neutral-900 transition font-medium dark:hover:text-white"
                                    onClick={() => album.artistId && setView('ARTIST_DETAIL', album.artistId)}
                                >
                                    {album.artist}
                                </button>
                                {album.year && (
                                    <>
                                        <span className="text-neutral-400 dark:text-white/50">•</span>
                                        <span>{album.year}</span>
                                    </>
                                )}
                                <span className="text-neutral-400 dark:text-white/50">•</span>
                                <span>{album.songCount} songs, {formatTotalTime(album.duration)}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => album.songs && playSong(album.songs[0], album.songs)}
                                    className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition text-sm dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                                >
                                    {isPlaying && isAlbumPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                    {isPlaying && isAlbumPlaying ? 'Pause' : 'Play'}
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
                        </div>
                    </div>
                </div>
            </div>

            {/* Separator */}
            <div className="px-6 lg:px-10">
                <div className="border-t border-neutral-200 dark:border-white/10 my-2" />
            </div>

            {/* Main Content - full width */}
            <div className="px-6 lg:px-10 pt-4">
                {/* About Section */}
                {album.info?.notes && (
                    <div className="mb-8 mt-4">
                        <div
                            className="flex items-start gap-3 p-4 bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-200 transition dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/[0.07]"
                            onClick={() => setShowFullNotes(!showFullNotes)}
                        >
                            <Info className="w-4 h-4 text-neutral-500 dark:text-white/60 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-1">About</h3>
                                <p className={`text-sm text-neutral-700 dark:text-white/70 leading-relaxed ${!showFullNotes ? 'line-clamp-2' : ''}`}>
                                    {album.info.notes}
                                </p>
                                {album.info.notes.length > 120 && (
                                    <span className="text-xs text-primary mt-1 inline-block">
                                        {showFullNotes ? 'Show less' : 'Read more'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Track List Section - with album-colored accent */}
                <section
                    className="mb-8 rounded-xl overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${albumColors.surface} 0%, transparent 100%)`,
                    }}
                >
                    <div className="p-4">
                        <h2 className="text-sm font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-3">Tracks</h2>
                        <div className="border border-neutral-300 dark:border-white/10 rounded-lg overflow-hidden" style={{ borderColor: albumColors.primaryMuted }}>
                            {album.songs?.map((song, idx) => {
                                const isCurrent = currentSong?.id === song.id;
                                const discNumber = song.discNumber || 1;
                                const prevDisc = idx > 0 ? (album.songs![idx - 1].discNumber || 1) : 0;
                                const showDiscHeader = hasMultiDisc && discNumber !== prevDisc;

                                return (
                                    <React.Fragment key={song.id}>
                                        {showDiscHeader && (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-200 dark:bg-white/5 text-xs font-bold text-neutral-700 dark:text-white/50 uppercase tracking-wide border-b border-neutral-300 dark:border-white/10">
                                                <Disc className="w-3.5 h-3.5 text-primary" />
                                                Disc {discNumber}
                                            </div>
                                        )}
                                        <div
                                            className={`group flex items-center gap-4 px-5 py-4 cursor-pointer transition border-b border-neutral-200 dark:border-white/5 last:border-0 hover:bg-neutral-100 dark:hover:bg-white/5 ${isCurrent ? 'bg-neutral-100 dark:bg-white/5' : ''}`}
                                            onClick={() => album.songs && playSong(song, album.songs)}
                                        >
                                            {/* Track number / Play */}
                                            <div className="w-7 text-center relative shrink-0">
                                                {isCurrent && isPlaying ? (
                                                    <div className="flex gap-0.5 items-end justify-center h-4">
                                                        <div className="w-0.5 bg-primary animate-pulse h-2"></div>
                                                        <div className="w-0.5 bg-primary animate-pulse h-3"></div>
                                                        <div className="w-0.5 bg-primary animate-pulse h-4"></div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className={`text-xs font-mono group-hover:opacity-0 transition ${isCurrent ? 'text-primary' : 'text-neutral-600 dark:text-white/60'}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <Play className="w-3.5 h-3.5 text-neutral-900 dark:text-white absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition fill-current" />
                                                    </>
                                                )}
                                            </div>

                                            {/* Title & Artist */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate transition ${isCurrent ? 'text-primary' : 'text-neutral-900 dark:text-white group-hover:text-neutral-900 dark:group-hover:text-white'}`}>
                                                    {song.title}
                                                </p>
                                                {song.artist !== album.artist && (
                                                    <p className="text-xs text-neutral-600 dark:text-white/60 truncate">{song.artist}</p>
                                                )}
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

                {/* Related Albums */}
                {relatedAlbums.length > 0 && (
                    <section className="mb-8">
                        <div className="border-t border-neutral-200 dark:border-white/10 pt-6 mb-4" />
                        <h2 className="text-sm font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-4">More by {album.artist}</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                            {relatedAlbums.map((related) => (
                                <div
                                    key={related.id}
                                    className="group cursor-pointer"
                                    onClick={() => setView('ALBUM_DETAIL', related.id)}
                                >
                                    <div className="relative aspect-square rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-900 mb-2">
                                        <img
                                            src={service.getCoverArtUrl(related.coverArt || related.id, 200)}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            loading="lazy"
                                            alt={related.name}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                            <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition fill-current" />
                                        </div>
                                    </div>
                                    <h3 className="text-xs font-medium text-neutral-900 dark:text-white truncate">{related.name}</h3>
                                    <p className="text-[10px] text-neutral-600 dark:text-white/60">{related.year}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};



