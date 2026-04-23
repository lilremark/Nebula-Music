import React, { useEffect, useState } from 'react';
import { useStore } from '../context/Store';
import { IArtist, IAlbum, ISong } from '../types';
import { Play, Disc, ArrowLeft, Music, ListPlus, Mic2, Heart, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { useAdaptiveColors } from '../hooks/useAdaptiveColors';

export const ArtistDetailView: React.FC = () => {
    const { viewData, setView, goBack, backTarget, service, playSong, openPlaylistModal, toggleLike } = useStore();
    const [artist, setArtist] = useState<IArtist | null>(null);
    const [albums, setAlbums] = useState<IAlbum[]>([]);
    const [topSongs, setTopSongs] = useState<ISong[]>([]);
    const [info, setInfo] = useState<{ bio?: string, image?: string }>({});
    const [showAllTracks, setShowAllTracks] = useState(false);
    const [showFullBio, setShowFullBio] = useState(false);

    // Extract colors from artist image for accent backgrounds
    const { colors: artistColors } = useAdaptiveColors(info.image);

    useEffect(() => {
        const load = async () => {
            if (!viewData) return;
            const { artist: artistData, albums: albumsData } = await service.getArtist(viewData);
            setArtist(artistData);
            setAlbums(albumsData);
            if (artistData.name) {
                setTopSongs(await service.getTopSongs(artistData.name, 10));
            }
            setInfo(await service.getArtistInfo(viewData, artistData.name));
        };
        load();
    }, [viewData, service]);

    if (!artist) return (
        <div className="flex flex-col items-center justify-center h-full text-neutral-600 dark:text-white/60">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-sm">Loading Artist...</span>
        </div>
    );

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec < 10 ? '0' + sec : sec}`;
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

    const handleSongLike = (song: ISong) => {
        toggleLike(song);
        setTopSongs(prev => prev.map(s => s.id === song.id ? { ...s, starred: !s.starred } : s));
    };

    const displayedTracks = showAllTracks ? topSongs : topSongs.slice(0, 5);
    const backLabel = (() => {
        switch (backTarget?.view) {
            case 'HOME': return 'Home';
            case 'BROWSE': return 'Browse';
            case 'ALBUMS': return 'Albums';
            case 'ALBUM_DETAIL': return 'Album';
            case 'ARTISTS': return 'Artists';
            case 'PLAYLISTS': return 'Playlists';
            case 'PLAYLIST_DETAIL': return 'Playlist';
            case 'SEARCH': return 'Search';
            case 'LIKED_ALBUMS': return 'Liked Albums';
            case 'LIKED_SONGS': return 'Liked Songs';
            case 'SONGS': return 'Songs';
            default: return 'Artists';
        }
    })();

    return (
        <div className="min-h-full pb-32 w-full">
            {/* Hero Header - full width */}
            <div className="relative pt-4">
                {/* Background with extended height */}
                <div className="absolute inset-x-0 top-0 h-[400px] overflow-hidden pointer-events-none">
                    {info.image ? (
                        <img
                            src={info.image}
                            className="w-full h-full object-cover opacity-20 blur-2xl scale-110"
                            alt=""
                            onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-300 dark:from-neutral-800 dark:to-neutral-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-200 via-neutral-200/85 to-white/60 dark:from-neutral-950 dark:via-neutral-950/85 dark:to-neutral-950/40" />
                </div>

                {/* Content */}
                <div className="relative z-10 px-6 lg:px-10 pt-2 pb-10">
                    {/* Back button */}
                    <button
                        onClick={() => goBack('ARTISTS')}
                        className="mb-5 flex items-center text-neutral-600 hover:text-neutral-900 transition text-sm font-medium group dark:text-white/50 dark:hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> {backLabel}
                    </button>

                    <div className="flex flex-col md:flex-row gap-5 items-center md:items-end">
                        {/* Artist Image */}
                        <div className="w-44 h-44 md:w-56 md:h-56 rounded-full overflow-hidden shadow-2xl bg-neutral-200 dark:bg-neutral-800 shrink-0 border-4 border-neutral-200 dark:border-white/10">
                            {info.image ? (
                                <img src={info.image} alt={artist.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Mic2 className="w-16 h-16 text-neutral-400 dark:text-white/50" />
                                </div>
                            )}
                        </div>

                        {/* Artist Info */}
                        <div className="text-center md:text-left flex-1">
                            <p className="text-[10px] font-bold text-neutral-600 dark:text-white/60 uppercase tracking-widest mb-1">Artist</p>
                            <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white mb-3">{artist.name}</h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
                                {topSongs.length > 0 && (
                                    <button
                                        onClick={() => playSong(topSongs[0], topSongs)}
                                        className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition text-sm dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                                    >
                                        <Play className="w-4 h-4 fill-current" /> Play
                                    </button>
                                )}
                                <span className="text-xs text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-lg font-medium dark:text-white/50 dark:bg-white/10">
                                    {artist.albumCount} Albums
                                </span>
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
            <div className="px-6 lg:px-10 pt-12">
                {/* Biography Section */}
                {info.bio && (
                    <div className="mb-8 mt-8">
                        <div
                            className="flex items-start gap-3 p-4 bg-neutral-100 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-200 transition dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/[0.07]"
                            onClick={() => setShowFullBio(!showFullBio)}
                        >
                            <Mic2 className="w-4 h-4 text-neutral-500 dark:text-white/60 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xs font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-1">About</h3>
                                <div className={`text-sm text-neutral-700 dark:text-white/70 leading-relaxed ${!showFullBio ? 'line-clamp-2' : ''}`}>
                                    {info.bio.split('\n').filter(line => line.trim()).slice(0, showFullBio ? undefined : 1).map((line, i) => (
                                        <p key={i}>{line.trim()}</p>
                                    ))}
                                </div>
                                {info.bio.length > 150 && (
                                    <span className="text-xs text-primary mt-1 inline-flex items-center gap-1">
                                        {showFullBio ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Read more</>}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Tracks - with artist-colored accent */}
                {topSongs.length > 0 && (
                    <section
                        className="mb-8 rounded-xl overflow-hidden"
                        style={{
                            background: `linear-gradient(135deg, ${artistColors.surface} 0%, transparent 100%)`,
                        }}
                    >
                        <div className="p-4">
                            <h2 className="text-sm font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Music className="w-4 h-4" style={{ color: artistColors.primary }} /> Popular
                            </h2>
                            <div className="border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden" style={{ borderColor: artistColors.primaryMuted }}>
                                {displayedTracks.map((song, i) => (
                                    <div
                                        key={song.id}
                                        className="group flex items-center gap-4 px-5 py-4 hover:bg-neutral-200 dark:hover:bg-white/5 transition cursor-pointer border-b border-neutral-200 dark:border-white/5 last:border-0"
                                        onClick={() => playSong(song, topSongs)}
                                    >
                                        {/* Number / Play */}
                                        <div className="w-8 text-center relative shrink-0">
                                            <span className="text-sm font-mono text-neutral-500 dark:text-white/60 group-hover:opacity-0 transition">
                                                {i + 1}
                                            </span>
                                            <Play className="w-4 h-4 text-white absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition fill-current" />
                                        </div>

                                        {/* Cover */}
                                        <img
                                            src={service.getCoverArtUrl(song.id, 100)}
                                            className="w-12 h-12 rounded object-cover bg-neutral-200 dark:bg-neutral-800 shrink-0"
                                            loading="lazy"
                                            alt=""
                                        />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary transition">{song.title}</p>
                                            <p
                                                className="text-xs text-neutral-600 dark:text-white/60 truncate hover:text-neutral-900 dark:hover:text-white/60 transition cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); if (song.albumId) setView('ALBUM_DETAIL', song.albumId); }}
                                            >
                                                {song.album}
                                            </p>
                                        </div>

                                        {/* Play count */}
                                        {song.playCount && song.playCount > 0 && (
                                            <div className="hidden md:flex items-center gap-1 text-[10px] text-neutral-500 dark:text-white/50 font-mono shrink-0">
                                                <BarChart2 className="w-3 h-3" />
                                                {song.playCount}
                                            </div>
                                        )}

                                        {/* Duration */}
                                        <span className="text-xs text-neutral-500 dark:text-white/60 font-mono shrink-0">
                                            {formatTime(song.duration)}
                                        </span>

                                        {/* Quality badge - moved next to actions for uniform layout */}
                                        <div className="shrink-0">
                                            {getQualityBadge(song.suffix)}
                                        </div>

                                        {/* Actions - always visible */}
                                        <div className="flex gap-1 shrink-0">
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
                                ))}
                            </div>
                            {topSongs.length > 5 && (
                                <button
                                    onClick={() => setShowAllTracks(!showAllTracks)}
                                    className="mt-3 text-xs text-neutral-600 hover:text-neutral-900 transition flex items-center gap-1 dark:text-white/50 dark:hover:text-white"
                                >
                                    {showAllTracks ? (
                                        <><ChevronUp className="w-3 h-3" /> Show less</>
                                    ) : (
                                        <><ChevronDown className="w-3 h-3" /> See all {topSongs.length} tracks</>
                                    )}
                                </button>
                            )}
                        </div>
                    </section>
                )}

                {/* Separator before Discography */}
                <div className="border-t border-neutral-200 dark:border-white/10 pt-6 mb-4" />

                {/* Discography - Grid View */}
                <section className="mb-8">
                    <h2 className="text-sm font-semibold text-neutral-700 dark:text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Disc className="w-4 h-4 text-secondary" /> Discography
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                        {albums.map((album) => (
                            <div
                                key={album.id}
                                className="group cursor-pointer"
                                onClick={() => setView('ALBUM_DETAIL', album.id)}
                            >
                                <div className="relative aspect-square rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-900 mb-2">
                                    <img
                                        src={service.getCoverArtUrl(album.coverArt || album.id, 200)}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                        alt={album.name}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                        <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition fill-current" />
                                    </div>
                                </div>
                                <h3 className="text-sm font-medium text-neutral-900 dark:text-white truncate">{album.name}</h3>
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 dark:text-white/60">
                                    {album.year && <span>{album.year}</span>}
                                    {album.year && album.songCount && <span>•</span>}
                                    {album.songCount && <span>{album.songCount} tracks</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};



