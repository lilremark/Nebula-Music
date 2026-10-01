import React from 'react';
import { Arc } from 'loading-dev';
import { useStore } from '../context/Store';
import { Mic2, Disc, Music, Play, MoreVertical, ListPlus, Search as SearchIcon, Clock, BarChart2, Heart, ArrowRight } from 'lucide-react';

export const SearchView: React.FC = () => {
    const { searchResults, isSearching, lastSearchQuery, playSong, setView, service, openPlaylistModal, openSearchModal } = useStore();

    if (isSearching) {
        return (
            <div data-nebula-view="search" data-nebula-search-state="loading" className="flex flex-col items-center justify-center h-[60vh] animate-fade-in text-neutral-500">
                <Arc size={44} className="mb-4 text-primary" />
                <p className="font-bold tracking-widest text-xs uppercase">Searching Library...</p>
            </div>
        );
    }

    const hasResults = searchResults.artists.length > 0 || searchResults.albums.length > 0 || searchResults.songs.length > 0;

    if (!hasResults && lastSearchQuery) {
        return (
            <div data-nebula-view="search" data-nebula-search-state="empty-results" className="flex flex-col items-center justify-center h-[60vh] text-center text-neutral-400 animate-fade-in">
                <SearchIcon className="w-16 h-16 mb-6 opacity-20" />
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">No results found</h1>
                <p className="text-lg">We couldn't find anything matching <span className="text-neutral-900 dark:text-white font-bold">"{lastSearchQuery}"</span></p>
                <button
                    onClick={openSearchModal}
                    className="mt-8 px-8 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-full font-bold transition border border-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/5"
                >
                    Try Another Search
                </button>
            </div>
        );
    }

    if (!lastSearchQuery) {
        return (
            <div data-nebula-view="search" data-nebula-search-state="idle" className="flex flex-col items-center justify-center h-[60vh] text-center text-neutral-400 animate-fade-in">
                <div className="w-20 h-20 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-8 border border-neutral-200 dark:border-white/5">
                    <SearchIcon className="w-8 h-8 text-neutral-500" />
                </div>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3">Search your library</h1>
                <p className="max-w-md mx-auto leading-relaxed">Find your favorite artists, albums, and songs. Just start typing to explore your collection.</p>
            </div>
        );
    }

    return (
        <div data-nebula-view="search" data-nebula-search-state="results" className="p-8 md:p-12 pb-32 max-w-[1800px] mx-auto animate-fade-in">
            <div data-nebula-view-header className="flex items-center justify-between mb-10 border-b border-neutral-200 dark:border-white/5 pb-8">
                <h1 className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
                    Results for <span className="text-primary">"{lastSearchQuery}"</span>
                </h1>
                <span className="text-sm font-bold text-neutral-500 uppercase tracking-widest bg-neutral-100 dark:bg-white/5 px-4 py-1.5 rounded-full border border-neutral-200 dark:border-white/5">
                    {searchResults.songs.length + searchResults.albums.length + searchResults.artists.length} Matches
                </span>
            </div>

            {/* Artists */}
            {searchResults.artists.length > 0 && (
                <section className="mb-16 animate-slide-up">
                    <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center"><Mic2 className="w-6 h-6 mr-3 text-neutral-400" /> Artists</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-6">
                        {searchResults.artists.map((artist, i) => (
                            <div
                                key={artist.id}
                                data-nebula-artist-card
                                className={`group cursor-pointer floating-card-1 bg-white/80 dark:bg-neutral-900/40 rounded-[2rem] p-5 border border-neutral-200 dark:border-white/5 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-glow-secondary stagger-${Math.min(i + 1, 6)}`}
                                onClick={() => setView('ARTIST_DETAIL', artist.id)}
                            >
                                <div className="aspect-square rounded-full overflow-hidden mb-5 relative shadow-lg bg-neutral-200 dark:bg-neutral-800 border border-neutral-200 dark:border-white/5">
                                    {artist.coverArt ? (
                                        <img src={service.getCoverArtUrl(artist.coverArt, 300)} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-700 opacity-90 group-hover:opacity-100" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-100 dark:bg-neutral-900"><Mic2 className="w-12 h-12" /></div>
                                    )}
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                        <span className="bg-white text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest transform scale-90 group-hover:scale-100 transition-transform">Profile</span>
                                    </div>
                                </div>
                                <h4 className="font-bold text-neutral-900 dark:text-white text-center truncate text-base group-hover:text-primary transition-colors">{artist.name}</h4>
                                <p className="text-xs text-neutral-500 text-center mt-1 font-medium bg-neutral-100 dark:bg-white/5 py-1 px-2 rounded-full mx-auto w-fit">Artist</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Albums */}
            {searchResults.albums.length > 0 && (
                <section className="mb-16 animate-slide-up stagger-1">
                    <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center"><Disc className="w-6 h-6 mr-3 text-neutral-400" /> Albums</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-6">
                        {searchResults.albums.map((album, i) => (
                            <div
                                key={album.id}
                                data-nebula-collection-card
                                className={`group cursor-pointer floating-card-1 bg-white/80 dark:bg-neutral-900/40 rounded-[1.5rem] p-4 border border-neutral-200 dark:border-white/5 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-white/10 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl stagger-${Math.min(i + 1, 6)}`}
                                onClick={() => setView('ALBUM_DETAIL', album.id)}
                            >
                                <div className="aspect-square rounded-2xl overflow-hidden mb-4 relative shadow-lg bg-neutral-200 dark:bg-neutral-800">
                                    <img src={service.getCoverArtUrl(album.coverArt || album.id, 300)} alt={album.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-700 opacity-90 group-hover:opacity-100" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                            <Play className="w-5 h-5 text-black fill-current ml-0.5" />
                                        </div>
                                    </div>
                                </div>
                                <h4 className="font-bold text-neutral-900 dark:text-white truncate text-base group-hover:text-primary transition-colors px-1">{album.name}</h4>
                                <p className="text-xs font-bold text-neutral-500 truncate px-1">{album.artist}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Songs */}
            {searchResults.songs.length > 0 && (
                <section className="animate-slide-up stagger-2">
                    <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6 flex items-center"><Music className="w-6 h-6 mr-3 text-neutral-400" /> Songs</h3>
                    <div data-nebula-track-ledger className="floating-card-1 bg-white/80 dark:bg-neutral-900/30 rounded-[2rem] border border-neutral-200 dark:border-white/5 overflow-hidden backdrop-blur-md">
                        <table className="w-full text-left text-sm text-neutral-700 dark:text-neutral-400">
                            <thead className="bg-neutral-100 dark:bg-black/20 text-neutral-600 dark:text-neutral-500 uppercase tracking-widest text-[10px] font-bold border-b border-neutral-200 dark:border-white/5">
                                <tr>
                                    <th className="p-5 w-16 text-center"></th>
                                    <th className="p-5">Title</th>
                                    <th className="p-5">Artist</th>
                                    <th className="p-5 hidden md:table-cell">Album</th>
                                    <th className="p-5 text-right">Time</th>
                                    <th className="p-5 w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                                {searchResults.songs.map((song, idx) => (
                                    <tr key={song.id} className="hover:bg-neutral-100 dark:hover:bg-white/5 group transition-all duration-200">
                                        <td className="p-5 w-16 text-center cursor-pointer relative" onClick={() => playSong(song, searchResults.songs)}>
                                            <div className="flex items-center justify-center w-8 h-8 mx-auto relative group-hover:scale-110 transition-transform">
                                                <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 m-auto fill-current" />
                                                <span className="font-mono text-xs text-neutral-500 group-hover:opacity-0">{idx + 1}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 font-bold text-neutral-900 dark:text-white cursor-pointer" onClick={() => playSong(song, searchResults.songs)}>
                                            <div className="flex items-center gap-4">
                                                <img src={service.getCoverArtUrl(song.id, 50)} className="w-10 h-10 rounded-lg object-cover bg-neutral-200 dark:bg-neutral-800 shadow-md group-hover:scale-105 transition-transform" alt="" />
                                                <span className="group-hover:text-primary transition-colors">{song.title}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 cursor-pointer text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); if (song.artistId) setView('ARTIST_DETAIL', song.artistId); }}>
                                            {song.artist}
                                        </td>
                                        <td className="p-5 cursor-pointer text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors hidden md:table-cell" onClick={(e) => { e.stopPropagation(); if (song.albumId) setView('ALBUM_DETAIL', song.albumId); }}>
                                            {song.album}
                                        </td>
                                        <td className="p-5 text-right font-mono text-xs tabular-nums text-neutral-500">
                                            {Math.floor(song.duration / 60)}:{song.duration % 60 < 10 ? '0' : ''}{song.duration % 60}
                                        </td>
                                        <td className="p-5 text-right w-24 flex items-center justify-end">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openPlaylistModal(song); }}
                                                className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-500 hover:text-primary opacity-0 group-hover:opacity-100 transition hover:scale-110"
                                                title="Add to Playlist"
                                            >
                                                <ListPlus className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
};
