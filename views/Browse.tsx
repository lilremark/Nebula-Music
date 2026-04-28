import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '../context/Store';
import { ISong, IAlbum, IPlaylist } from '../types';
import { Play, Music, RefreshCw, Heart, Radio, Zap, Calendar, Sparkles, Loader2 } from 'lucide-react';

// Mix Card Component
const MixCard: React.FC<{
    mix: IPlaylist & { icon: any; desc: string };
    onOpen: () => void;
    onPlay: () => void;
}> = ({ mix, onOpen, onPlay }) => {
    const Icon = mix.icon;
    const { service } = useStore();

    return (
        <div
            className="group cursor-pointer bg-neutral-100 dark:bg-neutral-900/50 rounded-lg overflow-hidden transition-all duration-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            onClick={onOpen}
        >
            {/* Cover Art Grid */}
            <div className="aspect-square relative bg-neutral-300 dark:bg-neutral-800">
                {mix.songs && mix.songs.length > 0 ? (
                    <div className="grid grid-cols-2 w-full h-full">
                        {mix.songs.slice(0, 4).map((song, i) => (
                            <img
                                key={song.id}
                                src={service.getCoverArtUrl(song.coverArt || song.id, 200)}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Icon className="w-16 h-16 text-neutral-400 dark:text-white/50" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />

                {/* Play Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPlay(); }}
                    className="absolute bottom-3 right-3 w-12 h-12 rounded-lg bg-white text-black flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl hover:scale-105"
                    aria-label="Play mix"
                >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>

                {/* Icon Badge */}
                <div className="absolute top-3 left-3 w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                    <Icon className="w-5 h-5 text-white" />
                </div>
            </div>

            {/* Info */}
            <div className="p-4">
                <h3 className="font-bold text-neutral-900 dark:text-white text-base mb-1">{mix.name}</h3>
                <p className="text-xs text-neutral-600 dark:text-white/70">{mix.desc}</p>
            </div>
        </div>
    );
};

// Album Card Component
const AlbumCard: React.FC<{
    album: IAlbum;
    badge?: string;
    onClick: () => void;
}> = ({ album, badge, onClick }) => {
    const { service } = useStore();

    return (
        <div
            className="group cursor-pointer"
            onClick={onClick}
        >
            <div className="relative aspect-square rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-900 mb-3 shadow-lg">
                <img
                    src={service.getCoverArtUrl(album.coverArt || album.id, 300)}
                    alt={album.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />

                {/* Play Button */}
                <div
                    className="absolute bottom-3 right-3 w-12 h-12 rounded-lg bg-white text-black flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl pointer-events-none"
                >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>

                {/* Badge */}
                {badge && (
                    <div className="absolute top-3 left-3 px-2 py-1 bg-primary text-black text-[10px] font-bold uppercase tracking-wide rounded shadow">
                        {badge}
                    </div>
                )}
            </div>
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm truncate mb-1">{album.name}</h3>
            <p className="text-xs text-neutral-600 dark:text-white/70 truncate">{album.artist}</p>
        </div>
    );
};


// Section Header
const SectionHeader: React.FC<{
    icon: any;
    title: string;
    iconColor?: string;
}> = ({ icon: Icon, title, iconColor = 'text-primary' }) => (
    <div className="flex items-center gap-3 mb-6">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h2>
    </div>
);

export const BrowseView: React.FC = () => {
    const { service, playSong, setView, getMostPlayedSongs, playInstantMix } = useStore();
    const [generatedMixes, setGeneratedMixes] = useState<(IPlaylist & { icon: any; desc: string })[]>([]);
    const [dailyAlbums, setDailyAlbums] = useState<IAlbum[]>([]);
    const [recommendedAlbums, setRecommendedAlbums] = useState<IAlbum[]>([]);
    const [newAlbums, setNewAlbums] = useState<IAlbum[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInstantMixLoading, setIsInstantMixLoading] = useState(false);
    const [instantMixError, setInstantMixError] = useState('');

    const loadData = useCallback(async (force = false) => {
        setIsLoading(true);
        const CACHE_KEY = 'nebula_browse_cache_v2';
        const TS_KEY = 'nebula_browse_ts_v2';
        const ONE_DAY = 24 * 60 * 60 * 1000;
        const cached = localStorage.getItem(CACHE_KEY);
        const ts = localStorage.getItem(TS_KEY);

        if (!force && cached && ts) {
            const age = Date.now() - parseInt(ts);
            if (age < ONE_DAY) {
                try {
                    const data = JSON.parse(cached);
                    const mixes = data.mixes.map((m: any) => {
                        let Icon = Music;
                        if (m.id.includes('flow')) Icon = Zap;
                        else if (m.id.includes('oldies')) Icon = Radio;
                        return { ...m, icon: Icon };
                    });
                    setGeneratedMixes(mixes);
                    setDailyAlbums(data.daily);
                    setNewAlbums(data.new);
                    setRecommendedAlbums(data.recommended);
                    setIsLoading(false);
                    return;
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }
        }

        const mostPlayed = getMostPlayedSongs();
        let topGenre = '';
        if (mostPlayed.length > 0) {
            const genreCounts: Record<string, number> = {};
            mostPlayed.forEach(s => { if (s.genre) genreCounts[s.genre] = (genreCounts[s.genre] || 0) + 1; });
            topGenre = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a])[0];
        }

        const [oldiesSongs, flowSongs, dailySongs] = await Promise.all([
            service.getRandomSongs(20, { toYear: new Date().getFullYear() - 10 }),
            service.getRandomSongs(20, topGenre ? { genre: topGenre } : {}),
            service.getRandomSongs(20)
        ]);

        const createMix = (idSuffix: string, title: string, desc: string, icon: any, songs: ISong[]) => ({
            id: `generated-${idSuffix}-${Date.now()}`,
            name: title,
            desc,
            icon,
            songCount: songs.length,
            duration: songs.reduce((acc, s) => acc + s.duration, 0),
            created: new Date().toISOString(),
            coverArt: songs[0]?.coverArt || songs[0]?.id,
            songs
        });

        const mixes = [
            createMix('flow', 'Flow State', topGenre ? `Focus for ${topGenre} fans` : 'Focus generated for you', Zap, flowSongs),
            createMix('oldies', 'Nostalgia Trip', 'Timeless favorites from the past', Radio, oldiesSongs),
            createMix('daily', 'Daily Mix', 'Fresh tracks to start your day', Music, dailySongs),
        ];

        let dailyStrategy = 'random';
        let dailyParams = {};
        if (topGenre && Math.random() > 0.3) {
            dailyStrategy = 'byGenre';
            dailyParams = { genre: topGenre };
        }

        let daily = await service.getAlbumList(dailyStrategy, 5, Math.floor(Math.random() * 20), dailyParams);
        if (daily.length < 5) {
            const fill = await service.getAlbumList('random', 5 - daily.length);
            daily = [...daily, ...fill];
        }
        daily = daily.sort(() => 0.5 - Math.random());

        const [newRes, recRes] = await Promise.all([
            service.getAlbumList('newest', 10),
            topGenre ? service.getAlbumList('byGenre', 10, 0, { genre: topGenre }) : service.getAlbumList('frequent', 10)
        ]);

        setGeneratedMixes(mixes);
        setDailyAlbums(daily);
        setNewAlbums(newRes);
        setRecommendedAlbums(recRes);

        const cacheMixes = mixes.map(({ icon, ...rest }) => rest);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ mixes: cacheMixes, daily, new: newRes, recommended: recRes }));
        localStorage.setItem(TS_KEY, Date.now().toString());
        setIsLoading(false);
    }, [service, getMostPlayedSongs]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleInstantMix = async () => {
        setIsInstantMixLoading(true);
        setInstantMixError('');
        try {
            const mix = await playInstantMix();
            if (mix.length === 0) setInstantMixError('No listening history found yet.');
        } catch (e) {
            setInstantMixError('Could not build an instant mix.');
        } finally {
            setIsInstantMixLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-600 dark:text-white/60">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs uppercase tracking-widest font-medium">Loading...</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 pb-32 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Browse</h1>
                <button
                    onClick={() => loadData(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 transition text-sm font-medium dark:bg-white/5 dark:hover:bg-white/10 dark:text-white/70 dark:hover:text-white"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Generated Mixes */}
            <SectionHeader icon={Sparkles} title="Generated For You" iconColor="text-yellow-500" />

            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-white/10 dark:bg-neutral-900/60 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-700 dark:text-white/70">
                    Builds a mix based off your listening history.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {instantMixError && (
                        <span className="text-sm text-red-500 dark:text-red-400">{instantMixError}</span>
                    )}
                    <button
                        onClick={handleInstantMix}
                        disabled={isInstantMixLoading}
                        className="inline-flex items-center justify-center gap-2 rounded bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                    >
                        {isInstantMixLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                        Instant Mix
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                {generatedMixes.map((mix) => (
                    <MixCard
                        key={mix.id}
                        mix={mix}
                        onOpen={() => setView('PLAYLIST_DETAIL', mix)}
                        onPlay={() => { if (mix.songs && mix.songs.length > 0) playSong(mix.songs[0], mix.songs); }}
                    />
                ))}
            </div>

            {/* Daily Recommendations */}
            <SectionHeader icon={Calendar} title="Daily Picks" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
                {dailyAlbums.map((album) => (
                    <AlbumCard
                        key={album.id}
                        album={album}
                        badge="Pick"
                        onClick={() => setView('ALBUM_DETAIL', album.id)}
                    />
                ))}
            </div>

            {/* New Arrivals */}
            <SectionHeader icon={Sparkles} title="New Arrivals" iconColor="text-blue-400" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
                {newAlbums.map((album) => (
                    <AlbumCard
                        key={album.id}
                        album={album}
                        onClick={() => setView('ALBUM_DETAIL', album.id)}
                    />
                ))}
            </div>

            {/* Recommended */}
            <SectionHeader icon={Heart} title="Recommended For You" iconColor="text-red-500" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {recommendedAlbums.map((album) => (
                    <AlbumCard
                        key={album.id}
                        album={album}
                        onClick={() => setView('ALBUM_DETAIL', album.id)}
                    />
                ))}
            </div>
        </div>
    );
};


