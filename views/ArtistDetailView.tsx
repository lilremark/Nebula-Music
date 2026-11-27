import React, { useEffect, useState } from 'react';
import { useStore } from '../context/Store';
import { IArtist, IAlbum, ISong } from '../types';
import { Play, Shuffle, ListPlus, Mic2, Heart, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { useAdaptiveColors } from '../hooks/useAdaptiveColors';
import { AlbumCard, COLLECTION_GRID_CLASS } from '../components/DetailCards';

export const ArtistDetailView: React.FC = () => {
    const { viewData, setView, service, playSong, openPlaylistModal, toggleLike, queue, currentSongIndex, currentRadioStation } = useStore();
    const [artist, setArtist] = useState<IArtist | null>(null);
    const [albums, setAlbums] = useState<IAlbum[]>([]);
    const [topSongs, setTopSongs] = useState<ISong[]>([]);
    const [info, setInfo] = useState<{ bio?: string, image?: string }>({});
    const [showAllTracks, setShowAllTracks] = useState(false);
    const [showFullBio, setShowFullBio] = useState(false);

    // Artist portrait palette tints the hero, like the album header.
    const { colors: artistColors, defaultColors, isLoading: isColorLoading } = useAdaptiveColors(info.image);

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
            <span data-nebula-track-quality className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isLossless ? 'bg-yellow-500/20 text-yellow-400' : 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-white/60'}`}>
                {s}
            </span>
        );
    };

    const handleSongLike = (song: ISong) => {
        toggleLike(song);
        setTopSongs(prev => prev.map(s => s.id === song.id ? { ...s, starred: !s.starred } : s));
    };

    const displayedTracks = showAllTracks ? topSongs : topSongs.slice(0, 5);
    const albumCount = artist.albumCount ?? albums.length;
    const currentSong = currentRadioStation ? undefined : queue[currentSongIndex];
    const bioLines = info.bio ? info.bio.split('\n').map(line => line.trim()).filter(Boolean) : [];

    return (
        <div data-nebula-view="artist-detail" className="nebula-artist-page min-h-full pb-32 w-full" style={{
            '--album-color': isColorLoading || artistColors === defaultColors ? 'var(--next-surface)' : artistColors.primary,
        } as React.CSSProperties}>
            <header data-nebula-artist-hero className="nebula-artist-hero">
                <div data-nebula-artist-hero-layout className="nebula-artist-hero-layout">
                    <div className="nebula-artist-portrait">
                        {info.image ? (
                            <img src={info.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full grid place-items-center">
                                <Mic2 className="w-14 h-14" aria-hidden="true" />
                            </div>
                        )}
                    </div>

                    <div className="nebula-artist-hero-copy">
                        <h1 title={artist.name}>{artist.name}</h1>
                        {albumCount > 0 && (
                            <p className="nebula-artist-meta">{albumCount} {albumCount === 1 ? 'album' : 'albums'}</p>
                        )}
                        {topSongs.length > 0 && (
                            <div data-nebula-album-options className="nebula-artist-actions flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => playSong(topSongs[0], topSongs)}
                                    className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition text-sm dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                                >
                                    <Play className="w-4 h-4 fill-current" /> Play
                                </button>
                                <button
                                    type="button"
                                    className="p-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 hover:text-neutral-900 transition dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                    title="Shuffle"
                                    aria-label="Shuffle popular songs"
                                    onClick={() => {
                                        const shuffled = [...topSongs].sort(() => Math.random() - 0.5);
                                        playSong(shuffled[0], shuffled);
                                    }}
                                >
                                    <Shuffle className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="nebula-artist-body">
                {/* Popular */}
                {topSongs.length > 0 && (
                    <section data-nebula-artist-tracks className="nebula-detail-section">
                        <h2 className="nebula-section-title">Popular</h2>
                        <div data-nebula-track-list className="nebula-artist-track-list">
                            {displayedTracks.map((song, i) => {
                                const isCurrent = currentSong?.id === song.id;
                                return (
                                    <div
                                        key={song.id}
                                        data-nebula-track-row
                                        data-current={isCurrent}
                                        className="group flex items-center gap-4 cursor-pointer"
                                        onClick={() => playSong(song, topSongs)}
                                    >
                                        <button type="button" data-nebula-track-play aria-label={`Play ${song.title}`} className="relative shrink-0 text-center" onClick={event => {
                                            event.stopPropagation();
                                            playSong(song, topSongs);
                                        }}>
                                            <span className={`nebula-time group-hover:opacity-0 transition ${isCurrent ? 'text-primary' : 'text-neutral-600 dark:text-white/60'}`}>{i + 1}</span>
                                            <Play className="w-3.5 h-3.5 text-neutral-900 dark:text-white absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition fill-current" />
                                        </button>

                                        <img
                                            src={service.getCoverArtUrl(song.coverArt || song.id, 100)}
                                            className="nebula-artist-track-art"
                                            loading="lazy"
                                            alt=""
                                        />

                                        <div className="flex-1 min-w-0">
                                            <p data-nebula-track-title className={`truncate ${isCurrent ? 'text-primary' : ''}`}>{song.title}</p>
                                            {song.album && (
                                                <button
                                                    type="button"
                                                    className="nebula-artist-track-album"
                                                    disabled={!song.albumId}
                                                    onClick={(e) => { e.stopPropagation(); if (song.albumId) setView('ALBUM_DETAIL', song.albumId); }}
                                                >
                                                    {song.album}
                                                </button>
                                            )}
                                        </div>

                                        {song.playCount && song.playCount > 0 && (
                                            <div data-nebula-track-plays className="nebula-time hidden md:flex items-center gap-1 shrink-0" title={`${song.playCount} plays`}>
                                                <BarChart2 className="w-3 h-3" aria-hidden="true" />
                                                {song.playCount}
                                            </div>
                                        )}

                                        <span data-nebula-track-duration className="nebula-time text-right shrink-0">
                                            {formatTime(song.duration)}
                                        </span>

                                        <div className="flex items-center gap-2 shrink-0" data-nebula-track-actions>
                                            <div className="shrink-0">{getQualityBadge(song.suffix)}</div>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleSongLike(song); }}
                                                className={`transition hover:bg-neutral-200 dark:hover:bg-white/10 ${song.starred ? 'text-red-400' : 'text-neutral-500 hover:text-neutral-900 dark:text-white/50 dark:hover:text-white'}`}
                                                title={song.starred ? "Unlike" : "Like"}
                                                aria-label={song.starred ? 'Unlike song' : 'Like song'}
                                            >
                                                <Heart className={`w-4 h-4 ${song.starred ? 'fill-current' : ''}`} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openPlaylistModal(song); }}
                                                className="transition hover:bg-neutral-200 text-neutral-500 hover:text-primary dark:hover:bg-white/10 dark:text-white/50"
                                                title="Add to playlist"
                                                aria-label="Add to playlist"
                                            >
                                                <ListPlus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {topSongs.length > 5 && (
                            <button
                                type="button"
                                onClick={() => setShowAllTracks(!showAllTracks)}
                                aria-expanded={showAllTracks}
                                className="nebula-text-button inline-flex items-center gap-1"
                            >
                                {showAllTracks ? (
                                    <><ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> Show less</>
                                ) : (
                                    <><ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> See all {topSongs.length} songs</>
                                )}
                            </button>
                        )}
                    </section>
                )}

                {/* Discography */}
                {albums.length > 0 && (
                    <section data-nebula-artist-discography className="nebula-detail-section">
                        <h2 className="nebula-section-title">Discography</h2>
                        <div data-nebula-collection-grid className={COLLECTION_GRID_CLASS}>
                            {albums.map((album) => (
                                <AlbumCard
                                    key={album.id}
                                    title={album.name}
                                    subtitle={[album.year, album.songCount ? `${album.songCount} ${album.songCount === 1 ? 'track' : 'tracks'}` : null].filter(Boolean).join(' · ') || undefined}
                                    imageUrl={service.getCoverArtUrl(album.coverArt || album.id, 400)}
                                    onOpen={() => setView('ALBUM_DETAIL', album.id)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* About */}
                {bioLines.length > 0 && (
                    <section data-nebula-about className="nebula-detail-section">
                        <h2 className="nebula-section-title">About</h2>
                        <div className={`nebula-about-copy ${!showFullBio ? 'line-clamp-3' : ''}`}>
                            {bioLines.slice(0, showFullBio ? undefined : 1).map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                        {(info.bio?.length ?? 0) > 150 && (
                            <button type="button" className="nebula-text-button" aria-expanded={showFullBio} onClick={() => setShowFullBio(!showFullBio)}>
                                {showFullBio ? 'Show less' : 'Read more'}
                            </button>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};
