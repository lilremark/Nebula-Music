import React, { useEffect, useState } from 'react';
import { useStore } from '../context/Store';
import { ISong, IAlbum } from '../types';
import { Play, Plus, Clock, Flame, Compass, ListPlus, RefreshCw, ChevronRight, BarChart2 } from 'lucide-react';

// Album Card Component - Square, minimal rounding
const AlbumCard: React.FC<{ album: IAlbum; onClick: () => void }> = ({ album, onClick }) => {
    const { service } = useStore();

    return (
        <div
            className="group cursor-pointer"
            onClick={onClick}
        >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-900 mb-3 shadow-lg">
                <img
                    src={service.getCoverArtUrl(album.coverArt || album.id, 400)}
                    alt={album.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300" />
                <div
                    className="absolute bottom-3 right-3 w-12 h-12 rounded-lg bg-white text-black flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-xl pointer-events-none"
                >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm truncate mb-1">{album.name}</h3>
            <p className="text-xs text-neutral-600 dark:text-white/70 truncate">{album.artist}</p>
        </div>
    );
};


// Song Card Component - Square with overlay
const SongCard: React.FC<{ song: ISong; songs: ISong[]; index: number }> = ({ song, songs, index }) => {
    const { service, playSong, openPlaylistModal } = useStore();

    return (
        <div
            className="group cursor-pointer relative aspect-square rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-900"
            onClick={() => playSong(song, songs)}
        >
            <img
                src={service.getCoverArtUrl(song.coverArt || song.id, 400)}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                alt={song.album}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

            {/* Play button on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-14 h-14 bg-white text-black rounded-lg flex items-center justify-center shadow-xl">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                </div>
            </div>

            {/* Song info */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-semibold text-white text-sm truncate">{song.title}</h3>
                <p className="text-xs text-white/50 truncate mt-1">{song.artist}</p>
            </div>

            {/* Add to playlist */}
            <button
                onClick={(e) => { e.stopPropagation(); openPlaylistModal(song); }}
                className="absolute top-3 right-3 p-2 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-white/20 backdrop-blur-xs"
                aria-label="Add to playlist"
            >
                <ListPlus className="w-4 h-4" />
            </button>
        </div>
    );
};

// Section Header
const SectionHeader: React.FC<{
    title: string;
    icon: any;
    onShowMore?: () => void;
    onRefresh?: () => void;
    loading?: boolean;
}> = ({ title, icon: Icon, onShowMore, onRefresh, loading }) => (
    <div className="flex items-center justify-between mb-6 mt-12">
        <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h2>
        </div>
        <div className="flex gap-2">
            {onRefresh && (
                <button
                    onClick={onRefresh}
                    className="p-2 rounded bg-neutral-200 dark:bg-white/5 hover:bg-neutral-300 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition"
                    aria-label={`Refresh ${title}`}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            )}
            {onShowMore && (
                <button
                    onClick={onShowMore}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-200 dark:bg-white/5 hover:bg-neutral-300 dark:hover:bg-white/10 text-neutral-700 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white text-xs transition"
                >
                    View All <ChevronRight className="w-3 h-3" />
                </button>
            )}
        </div>
    </div>
);

// Hero Section - Featured Track
const HeroSection: React.FC<{ songs: ISong[] }> = ({ songs }) => {
    const { service, playSong, setView, homeData, refreshHomeData, getMostPlayedSongs } = useStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const heroSongs = songs.slice(0, 5);

    useEffect(() => {
        if (heroSongs.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % heroSongs.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [heroSongs.length]);

    if (heroSongs.length === 0) return null;

    const featured = heroSongs[currentIndex];
    const artUrl = service.getCoverArtUrl(featured.coverArt || featured.id, 800);

    return (
        <div className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900 mb-10">
            {/* Background */}
            <div className="absolute inset-0">
                <img src={artUrl} className="w-full h-full object-cover opacity-30 blur-2xl scale-110" alt="" />
                <div className="absolute inset-0 bg-gradient-to-r from-white/75 via-neutral-100/90 to-transparent dark:from-black dark:via-black/80" />
            </div>

            <div className="relative flex flex-col md:flex-row items-center gap-8 p-8 md:p-12">
                {/* Album Art */}
                <div
                    className="shrink-0 w-48 h-48 md:w-64 md:h-64 rounded-lg overflow-hidden shadow-2xl cursor-pointer"
                    onClick={() => { if (featured.albumId) setView('ALBUM_DETAIL', featured.albumId); }}
                >
                    <img src={artUrl} alt={featured.album} className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-4">
                        <Flame className="w-3 h-3 fill-current" /> Featured
                    </div>
                    <h1
                        className="text-3xl md:text-5xl font-black text-neutral-900 dark:text-white mb-3 cursor-pointer hover:text-neutral-700 dark:hover:text-white/80 transition"
                        onClick={() => { if (featured.albumId) setView('ALBUM_DETAIL', featured.albumId); }}
                    >
                        {featured.title}
                    </h1>
                    <p className="text-lg text-neutral-600 dark:text-white/50 mb-6">
                        <span
                            className="hover:text-neutral-900 cursor-pointer transition dark:hover:text-white"
                            onClick={() => { if (featured.artistId) setView('ARTIST_DETAIL', featured.artistId); }}
                        >
                            {featured.artist}
                        </span>
                        <span className="mx-2">•</span>
                        {featured.album}
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                        <button
                            onClick={() => playSong(featured, heroSongs)}
                            className="flex items-center gap-2 px-8 py-3 bg-neutral-900 text-white rounded font-bold hover:bg-neutral-800 transition shadow-lg dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                        >
                            <Play className="w-5 h-5 fill-current" /> Play Now
                        </button>
                        <button
                            onClick={() => { if (featured.albumId) setView('ALBUM_DETAIL', featured.albumId); }}
                            className="flex items-center gap-2 px-6 py-3 bg-neutral-200 text-neutral-900 rounded font-medium hover:bg-neutral-300 transition dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                        >
                            View Album
                        </button>
                    </div>
                </div>
            </div>

            {/* Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {heroSongs.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-8 bg-primary' : 'w-2 bg-neutral-300 hover:bg-neutral-400 dark:bg-white/20 dark:hover:bg-white/40'
                            }`}
                        aria-label={`Show featured track ${idx + 1} of ${heroSongs.length}`}
                    />
                ))}
            </div>
        </div>
    );
};

// Helper
const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
};

interface SongRowProps {
    song: ISong;
    onClick: () => void;
    getCoverArtUrl: (id: string, size?: number) => string;
}

const SongRow: React.FC<SongRowProps> = ({ song, onClick, getCoverArtUrl }) => (
    <div
        className="flex items-center gap-3 p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded cursor-pointer group transition"
        onClick={onClick}
    >
        <div className="w-10 h-10 relative shrink-0">
            <img
                src={getCoverArtUrl(song.coverArt || song.id, 100)}
                className="w-full h-full rounded object-cover bg-neutral-200 dark:bg-neutral-800"
                onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48L3N2Zz4=' }}
                alt=""
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Play className="w-4 h-4 text-white fill-white" />
            </div>
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">{song.title}</div>
            <div className="text-xs text-neutral-600 dark:text-white/60 truncate">{song.artist}</div>
        </div>

        {/* Play Count & Duration */}
        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-white/50 font-mono">
            {(song.playCount !== undefined && song.playCount > 0) && (
                <div className="flex items-center gap-1" title={`${song.playCount} plays`}>
                    <BarChart2 className="w-3 h-3" />
                    <span>{song.playCount}</span>
                </div>
            )}
            {song.duration && <span>{formatDuration(song.duration)}</span>}
        </div>
    </div>
);

export const HomeView: React.FC = () => {
    const { service, playSong, setView, getMostPlayedSongs, homeData, refreshHomeData, refreshQuickPicks, refreshDiscovery, isInitialized } = useStore();
    const [loadingExplore, setLoadingExplore] = useState(false);
    const [loadingQuickPicks, setLoadingQuickPicks] = useState(false);
    const [activeTab, setActiveTab] = useState<'played' | 'recommended'>('played');

    useEffect(() => {
        // Wait for Store initialization to complete before fetching data
        // This prevents demo data from being loaded when real server credentials are stored
        if (!isInitialized) return;

        const init = async () => {
            setLoadingExplore(true);
            await refreshHomeData();
            setLoadingExplore(false);
        };
        init();
    }, [refreshHomeData, isInitialized]);

    const displaySongs = activeTab === 'played' ? [] : homeData.recommendedTracks;
    const { randomSongs, exploreAlbums, recentAlbums, newestAlbums } = homeData;

    return (
        <div className="p-6 md:p-8 pb-32 max-w-[1600px] mx-auto">
            <HeroSection songs={randomSongs} />

            {/* Quick Picks & Most Played */}
            <div className="grid grid-cols-1 gap-6 mb-12">
                {/* Quick Picks Grid */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Flame className="w-5 h-5 text-orange-500" />
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Quick Picks</h2>
                        </div>
                        <button
                            onClick={async () => { setLoadingQuickPicks(true); await refreshQuickPicks(); setLoadingQuickPicks(false); }}
                            className="p-2 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 transition dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/60 dark:hover:text-white"
                            aria-label="Refresh quick picks"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingQuickPicks ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {randomSongs.slice(0, 8).map((song, i) => (
                            <SongCard key={`${song.id}-${i}`} song={song} songs={randomSongs} index={i} />
                        ))}
                    </div>
                </div>

                {/* Most Played / For You */}
                <div className="bg-neutral-100 dark:bg-neutral-900/50 rounded-lg overflow-hidden flex flex-col h-[600px] border border-neutral-200 dark:border-white/5">
                    <div className="flex border-b border-white/5 shrink-0">
                        <button
                            onClick={() => setActiveTab('played')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition ${activeTab === 'played' ? 'bg-neutral-200 text-neutral-900 dark:bg-white/5 dark:text-white' : 'text-neutral-600 hover:text-neutral-900 dark:text-white/70 dark:hover:text-white'}`}
                        >
                            Most Played Songs
                        </button>
                        <button
                            onClick={() => setActiveTab('recommended')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide transition ${activeTab === 'recommended' ? 'bg-neutral-200 text-neutral-900 dark:bg-white/5 dark:text-white' : 'text-neutral-600 hover:text-neutral-900 dark:text-white/70 dark:hover:text-white'}`}
                        >
                            For You
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {activeTab === 'played' ? (
                            <div className="space-y-1">
                                {getMostPlayedSongs().slice(0, 50).map((song) => (
                                    <SongRow
                                        key={song.id}
                                        song={song}
                                        onClick={() => playSong(song, getMostPlayedSongs())}
                                        getCoverArtUrl={(id, size) => service.getCoverArtUrl(id, size)}
                                    />
                                ))}
                                {getMostPlayedSongs().length === 0 && (
                                    <div className="text-center py-8 text-neutral-600 dark:text-white/60 text-sm">
                                        No stats yet.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {homeData.recommendedTracks.slice(0, 20).map((song, i) => (
                                    <SongRow
                                        key={song.id}
                                        song={song}
                                        onClick={() => playSong(song, homeData.recommendedTracks)}
                                        getCoverArtUrl={(id, size) => service.getCoverArtUrl(id, size)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* Discovery */}
            < SectionHeader
                title="Daily Discovery"
                icon={Compass}
                onShowMore={() => setView('ALBUMS', { sort: 'random' })}
                onRefresh={async () => { setLoadingExplore(true); await refreshDiscovery(); setLoadingExplore(false); }}
                loading={loadingExplore}
            />
            {loadingExplore && exploreAlbums.length === 0 ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {exploreAlbums.slice(0, 6).map((album) => (
                        <AlbumCard key={album.id} album={album} onClick={() => setView('ALBUM_DETAIL', album.id)} />
                    ))}
                </div>
            )}



            {/* Recently Played */}
            <SectionHeader
                title="Recently Played"
                icon={Clock}
                onShowMore={() => setView('ALBUMS', { sort: 'recent' })}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {recentAlbums.slice(0, 6).map((album) => (
                    <AlbumCard key={album.id} album={album} onClick={() => setView('ALBUM_DETAIL', album.id)} />
                ))}
            </div>

            {/* Recently Added */}
            <SectionHeader
                title="Recently Added"
                icon={Plus}
                onShowMore={() => setView('ALBUMS', { sort: 'newest' })}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {newestAlbums.slice(0, 6).map((album) => (
                    <AlbumCard key={album.id} album={album} onClick={() => setView('ALBUM_DETAIL', album.id)} />
                ))}
            </div>
        </div >
    );
};


