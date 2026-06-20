import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../context/Store';
import { Search, X, Disc, Mic2, Music, Play, ArrowRight, Command } from 'lucide-react';
import { ISong, IAlbum, IArtist } from '../types';

export const SearchModal: React.FC = () => {
    const { isSearchModalOpen, closeSearchModal, service, setView, playSong, openSearchModal, performSearch } = useStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ artists: IArtist[], albums: IAlbum[], songs: ISong[] }>({ artists: [], albums: [], songs: [] });
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Handle Cmd/Ctrl + K to toggle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (isSearchModalOpen) {
                    closeSearchModal();
                } else {
                    openSearchModal();
                }
            }
            if (e.key === 'Escape' && isSearchModalOpen) {
                closeSearchModal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchModalOpen, closeSearchModal, openSearchModal]);

    // Auto focus input when opened
    useEffect(() => {
        if (isSearchModalOpen) {
            // Small delay to ensure render
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isSearchModalOpen]);

    // Debounced Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.trim().length > 1) {
                setLoading(true);
                try {
                    const res = await service.search(query);
                    setResults(res);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults({ artists: [], albums: [], songs: [] });
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query, service]);

    const handleClose = () => {
        setQuery('');
        setResults({ artists: [], albums: [], songs: [] });
        closeSearchModal();
    };

    if (!isSearchModalOpen) return null;

    const hasResults = results.artists.length > 0 || results.albums.length > 0 || results.songs.length > 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 animate-fade-in">
            {/* Enhanced Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/20 via-neutral-900/30 to-neutral-900/40 dark:from-black/60 dark:via-black/80 dark:to-black/90 backdrop-blur-extra" onClick={handleClose} />

            {/* Command Palette Modal */}
            <div className="relative w-full max-w-3xl floating-card-3 rounded-3xl shadow-float-3 overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
                {/* Search Input Header */}
                <div className="relative flex items-center p-5 border-b border-neutral-200 dark:border-white/10 bg-gradient-to-r from-primary/[0.03] to-secondary/[0.03]">
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

                    <div className={`relative p-2.5 rounded-xl border transition-all duration-300 ${query.length > 0 ? 'bg-primary/20 border-primary/40 shadow-glow-sm' : 'bg-neutral-100 border-neutral-200 dark:bg-white/5 dark:border-white/10'
                        }`}>
                        <Search className={`w-5 h-5 transition-colors duration-300 ${query.length > 0 ? 'text-primary' : 'text-neutral-400'
                            }`} />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search artists, albums, songs..."
                        className="flex-1 bg-transparent border-none outline-hidden text-xl font-medium text-neutral-900 dark:text-white px-4 py-2 placeholder-neutral-500 dark:placeholder-neutral-600"
                    />

                    {loading && (
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
                    )}

                    <button
                        onClick={handleClose}
                        className="p-2 rounded-xl hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 transition-all duration-200 interactive-scale dark:hover:bg-white/10 dark:hover:text-white"
                        aria-label="Close search"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Results Area */}
                <div className="overflow-y-auto py-3 custom-scrollbar">
                    {!hasResults && query.length > 1 && !loading && (
                        <div className="p-12 text-center text-neutral-600 dark:text-neutral-500 animate-fade-in">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-base font-medium">No results found for "{query}"</p>
                            <p className="text-sm mt-2 text-neutral-600 dark:text-neutral-500">Try a different search term</p>
                        </div>
                    )}

                    {!hasResults && query.length <= 1 && (
                        <div className="p-16 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 border border-neutral-200 mb-4 dark:bg-white/5 dark:border-white/10">
                                <Command className="w-4 h-4 text-neutral-500" />
                                <span className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">Start typing to search</span>
                            </div>
                            <p className="text-xs text-neutral-600 dark:text-neutral-500 mt-3">Search your entire music library</p>
                        </div>
                    )}

                    {/* Artists */}
                    {results.artists.length > 0 && (
                        <div className="mb-6 px-3">
                            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-3 py-2 mb-2 flex items-center gap-2">
                                <Mic2 className="w-3.5 h-3.5" />
                                Artists
                            </h3>
                            <div className="space-y-1">
                                {results.artists.slice(0, 4).map((artist, index) => (
                                    <div
                                        key={artist.id}
                                        onClick={() => { setView('ARTIST_DETAIL', artist.id); handleClose(); }}
                                        className={`flex items-center px-4 py-3 rounded-xl glass-subtle hover:bg-primary/10 
                                          border border-transparent hover:border-primary/30 transition-all duration-300 
                                          cursor-pointer group interactive-lift animate-slide-up stagger-${Math.min(index + 1, 8)}`}
                                    >
                                        <div className="w-11 h-11 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center overflow-hidden mr-4 ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                                            {artist.coverArt ? <img src={service.getCoverArtUrl(artist.coverArt, 100)} className="w-full h-full object-cover" alt="" /> : <Mic2 className="w-5 h-5 text-neutral-500" />}
                                        </div>
                                        <span className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary flex-1 transition-colors">{artist.name}</span>
                                        <ArrowRight className="w-4 h-4 text-neutral-500 dark:text-neutral-600 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Albums */}
                    {results.albums.length > 0 && (
                        <div className="mb-6 px-3">
                            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-3 py-2 mb-2 flex items-center gap-2">
                                <Disc className="w-3.5 h-3.5" />
                                Albums
                            </h3>
                            <div className="space-y-1">
                                {results.albums.slice(0, 4).map((album, index) => (
                                    <div
                                        key={album.id}
                                        onClick={() => { setView('ALBUM_DETAIL', album.id); handleClose(); }}
                                        className={`flex items-center px-4 py-3 rounded-xl glass-subtle hover:bg-primary/10 
                                          border border-transparent hover:border-primary/30 transition-all duration-300 
                                          cursor-pointer group interactive-lift animate-slide-up stagger-${Math.min(index + 1, 8)}`}
                                    >
                                        <div className="w-11 h-11 rounded-lg bg-neutral-200 dark:bg-neutral-800 overflow-hidden mr-4 ring-2 ring-transparent group-hover:ring-primary/30 transition-all shadow-md">
                                            <img src={service.getCoverArtUrl(album.coverArt || album.id, 100)} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary transition-colors truncate">{album.name}</div>
                                            <div className="text-xs text-neutral-600 dark:text-neutral-500 font-medium truncate mt-0.5">{album.artist}</div>
                                        </div>
                                        <Disc className="w-4 h-4 text-neutral-500 dark:text-neutral-600 opacity-0 group-hover:opacity-100 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Songs */}
                    {results.songs.length > 0 && (
                        <div className="mb-2 px-3">
                            <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-3 py-2 mb-2 flex items-center gap-2">
                                <Music className="w-3.5 h-3.5" />
                                Songs
                            </h3>
                            <div className="space-y-1">
                                {results.songs.slice(0, 8).map((song, index) => (
                                    <div
                                        key={song.id}
                                        onClick={() => { playSong(song, results.songs); handleClose(); }}
                                        className={`flex items-center px-4 py-2.5 rounded-xl glass-subtle hover:bg-primary/10 
                                          border border-transparent hover:border-primary/30 transition-all duration-300 
                                          cursor-pointer group interactive-lift animate-slide-up stagger-${Math.min(index + 1, 8)}`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-neutral-800 overflow-hidden mr-4 relative ring-2 ring-transparent group-hover:ring-primary/30 transition-all shadow-xs">
                                            <img src={service.getCoverArtUrl(song.id, 100)} className="w-full h-full object-cover" alt="" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Play className="w-4 h-4 text-white fill-current" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-neutral-900 dark:text-white group-hover:text-primary truncate text-sm transition-colors">{song.title}</div>
                                            <div className="text-xs text-neutral-600 dark:text-neutral-500 truncate font-medium">{song.artist} • {song.album}</div>
                                        </div>
                                        <span className="text-xs text-neutral-500 dark:text-neutral-600 font-mono ml-4 tabular-nums">
                                            {Math.floor(song.duration / 60)}:{song.duration % 60 < 10 ? '0' : ''}{song.duration % 60}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {hasResults && (
                    <div className="p-4 glass-strong border-t border-neutral-200 dark:border-white/10 flex justify-between items-center">
                        <button
                            onClick={() => {
                                performSearch(query);
                                handleClose();
                            }}
                            className="text-sm font-bold text-primary hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/10 interactive-scale"
                        >
                            View all results
                            <ArrowRight className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-500 font-medium">
                            <kbd className="px-2 py-1 bg-neutral-100 border border-neutral-200 rounded-md font-mono dark:bg-black/40 dark:border-white/20">ESC</kbd>
                            <span>to close</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

