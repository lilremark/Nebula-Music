import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { useStore } from '../context/Store';
import { IAlbum, ISong, IArtist, View } from '../types';
import { Play, Music, Mic2, MoreVertical, Plus, ListPlus, Search, Disc, ChevronLeft, ChevronRight, ArrowUp, Filter, X, Calendar, Tag, ArrowDownUp, ChevronDown, Heart, Star, ListMusic } from 'lucide-react';
import { CustomDropdown } from '../components/CustomDropdown';

const ITEMS_PER_PAGE = 60;

const YearPicker: React.FC<{ value: string, onChange: (val: string) => void }> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const pickerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({ top: '100%', left: 0, marginTop: '0.5rem' });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (value && !isNaN(parseInt(value))) {
            setViewYear(parseInt(value));
        }
    }, [value]);

    useLayoutEffect(() => {
        if (isOpen && pickerRef.current) {
            const rect = pickerRef.current.getBoundingClientRect();
            // Simple flip logic
            const style: React.CSSProperties = { top: '100%', left: 0, marginTop: '8px' };
            if (rect.bottom + 250 > window.innerHeight) {
                style.top = 'auto';
                style.bottom = '100%';
                style.marginTop = '0';
                style.marginBottom = '8px';
            }
            if (rect.left + 240 > window.innerWidth) {
                style.left = 'auto';
                style.right = 0;
            }
            setDropdownStyle(style);
        }
    }, [isOpen]);

    const currentYear = new Date().getFullYear();
    const startYear = Math.floor(viewYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, i) => startYear + i);

    return (
        <div className="relative min-w-[120px]" ref={pickerRef}>
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setIsOpen(true)}
                placeholder="Year"
                className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 pl-10 pr-8 text-sm focus:border-primary/60 focus:bg-white focus:outline-hidden text-neutral-900 transition-all placeholder-neutral-500 dark:bg-white/5 dark:border-white/5 dark:focus:border-white/20 dark:focus:bg-white/10 dark:text-white"
            />
            <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-900 z-10 dark:hover:text-white"
                onClick={() => {
                    if (!isOpen) inputRef.current?.focus();
                    setIsOpen(!isOpen);
                }}
                aria-label="Toggle year picker"
            >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    className="absolute w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-float-3 z-50 overflow-hidden animate-scale-in"
                    style={dropdownStyle}
                >
                    <div className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-white/5 border-b border-neutral-200 dark:border-white/5">
                        <button onClick={(e) => { e.preventDefault(); setViewYear(y => y - 12); }} className="p-1.5 hover:bg-neutral-200 rounded-lg text-neutral-600 hover:text-neutral-900 transition dark:hover:bg-white/10 dark:text-neutral-400 dark:hover:text-white" aria-label="Previous 12 years"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="text-sm font-bold text-neutral-900 dark:text-white">{startYear} - {startYear + 11}</span>
                        <button onClick={(e) => { e.preventDefault(); setViewYear(y => y + 12); }} className="p-1.5 hover:bg-neutral-200 rounded-lg text-neutral-600 hover:text-neutral-900 transition dark:hover:bg-white/10 dark:text-neutral-400 dark:hover:text-white" aria-label="Next 12 years"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-3">
                        {years.map(y => (
                            <button
                                key={y}
                                onClick={() => { onChange(y.toString()); setIsOpen(false); }}
                                disabled={y > currentYear + 5}
                                className={`py-3 rounded-xl text-xs font-bold transition-all ${y === parseInt(value) ? 'bg-primary text-black shadow-glow-sm' : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white'} ${y > currentYear + 5 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ViewHeader = ({ currentView, children }: { currentView: View, children?: React.ReactNode }) => (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6 animate-fade-in">
        <h2 className="text-4xl md:text-5xl font-black capitalize flex items-center tracking-tight text-neutral-900 dark:text-white hidden md:flex">
            {currentView === 'ARTISTS' && <div className="p-2 bg-purple-500/20 rounded-xl mr-4 border border-purple-500/30"><Mic2 className="w-8 h-8 text-purple-400" /></div>}
            {currentView === 'ALBUMS' && <div className="p-2 bg-blue-500/20 rounded-xl mr-4 border border-blue-500/30"><Disc className="w-8 h-8 text-blue-400" /></div>}
            {currentView === 'SONGS' && <div className="p-2 bg-green-500/20 rounded-xl mr-4 border border-green-500/30"><Music className="w-8 h-8 text-green-400" /></div>}
            {currentView === 'PLAYLISTS' && <div className="p-2 bg-orange-500/20 rounded-xl mr-4 border border-orange-500/30"><ListPlus className="w-8 h-8 text-orange-400" /></div>}
            {currentView === 'LIKED_SONGS' && <div className="p-2 bg-red-500/20 rounded-xl mr-4 border border-red-500/30"><Heart className="w-8 h-8 text-red-500 fill-current" /></div>}
            {currentView === 'LIKED_ALBUMS' && <div className="p-2 bg-yellow-500/20 rounded-xl mr-4 border border-yellow-500/30"><Star className="w-8 h-8 text-yellow-500 fill-current" /></div>}
            {currentView === 'LIKED_SONGS' ? 'Liked Songs' : currentView === 'LIKED_ALBUMS' ? 'Liked Albums' : currentView.toLowerCase()}
        </h2>

        <div className="flex flex-wrap items-center w-full lg:w-auto gap-3">
            {children}
        </div>
    </div>
);

const MobileLibraryTabs = () => {
    const { currentView, setView } = useStore();
    const tabs = [
        { id: 'ALBUMS', label: 'Albums', icon: Disc },
        { id: 'PLAYLISTS', label: 'Playlists', icon: ListMusic },
        { id: 'ARTISTS', label: 'Artists', icon: Mic2 },
        { id: 'SONGS', label: 'Songs', icon: Music },
        { id: 'LIKED_SONGS', label: 'Liked', icon: Heart },
    ];

    return (
        <div className="md:hidden w-full overflow-x-auto pb-6 -mx-6 px-6 scrollbar-hide">
            <div className="flex items-center gap-2">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setView(tab.id as any)}
                        className={`flex items-center px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap border transition-all shadow-xs ${currentView === tab.id
                            ? 'bg-white text-black border-white shadow-glow-sm'
                            : 'bg-neutral-800/80 text-neutral-400 border-white/5 backdrop-blur-md'
                            }`}
                    >
                        <tab.icon className={`w-4 h-4 mr-2 ${currentView === tab.id ? 'text-black' : ''}`} />
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

const FilterBar: React.FC<{
    currentView: View;
    filter: string;
    setFilter: (val: string) => void;
    setPage: (val: number) => void;
    sortType: string;
    setSortType: (val: string) => void;
    selectedGenre: string;
    setSelectedGenre: (val: string) => void;
    selectedYear: string;
    setSelectedYear: (val: string) => void;
    genres: string[];
    resetFilters: () => void;
}> = ({ currentView, filter, setFilter, setPage, sortType, setSortType, selectedGenre, setSelectedGenre, selectedYear, setSelectedYear, genres, resetFilters }) => (
    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto p-1">
        {/* Text Search */}
        <div className="relative flex-1 min-w-[200px] group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-neutral-900 transition-colors dark:group-focus-within:text-white" />
            <input
                type="text"
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setPage(0); }}
                placeholder="Search collection..."
                className="w-full bg-white border border-neutral-300 rounded-xl py-2.5 pl-10 pr-8 text-sm focus:border-primary/60 focus:bg-white focus:outline-hidden text-neutral-900 transition-all placeholder-neutral-500 dark:bg-white/5 dark:border-white/5 dark:focus:border-white/20 dark:focus:bg-white/10 dark:text-white"
            />
            {filter && (
                <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 p-1 rounded-full hover:bg-neutral-200 transition dark:hover:text-white dark:hover:bg-white/10" aria-label="Clear search">
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>

        {/* Sorting */}
        {currentView === 'ALBUMS' && !filter && !selectedGenre && !selectedYear && (
            <CustomDropdown
                value={sortType}
                onChange={(val) => { setSortType(val); setPage(0); }}
                options={[
                    { value: 'alphabeticalByName', label: 'A-Z' },
                    { value: 'newest', label: 'Recently Added' },
                    { value: 'recent', label: 'Recently Played' },
                    { value: 'frequent', label: 'Most Played' },
                    { value: 'random', label: 'Random' },
                    { value: 'byYear', label: 'By Year' }
                ]}
                icon={<ArrowDownUp className="w-4 h-4" />}
                className="min-w-[150px] flex-1 md:flex-none"
            />
        )}

        {/* Advanced Filters */}
        {(currentView === 'ALBUMS' || currentView === 'SONGS') && (
            <>
                <CustomDropdown
                    value={selectedGenre}
                    onChange={(val) => { setSelectedGenre(val); setPage(0); }}
                    options={[
                        { value: '', label: 'All Genres' },
                        ...genres.map(g => ({ value: g, label: g }))
                    ]}
                    placeholder="All Genres"
                    icon={<Tag className="w-4 h-4" />}
                    className="min-w-[150px] flex-1 md:flex-none"
                />

                <YearPicker value={selectedYear} onChange={(val) => { setSelectedYear(val); setPage(0); }} />

                {(selectedGenre || selectedYear) && (
                    <button
                        onClick={resetFilters}
                        className="p-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 transition shadow-xs border border-neutral-200 dark:bg-white/5 dark:hover:bg-white/20 dark:text-neutral-300 dark:hover:text-white dark:border-white/5"
                        title="Clear Filters"
                        aria-label="Clear filters"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </>
        )}
    </div>
);

export const LibraryView: React.FC = () => {
    const { currentView, setView, viewData, service, playSong, openPlaylistModal, playlists, createPlaylist, cachedArtists, fetchArtists } = useStore();
    const [items, setItems] = useState<any[]>([]);
    const [newPlName, setNewPlName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filter, setFilter] = useState('');
    const [selectedGenre, setSelectedGenre] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [genres, setGenres] = useState<string[]>([]);
    const [sortType, setSortType] = useState<string>('alphabeticalByName');

    // Pagination
    const [page, setPage] = useState(0);
    const [allItemsCached, setAllItemsCached] = useState<any[] | null>(null);

    const getStorageKey = (view: string, type: string) => `nebula_lib_${view}_${type}`;

    useEffect(() => {
        setPage(0); setFilter(''); setItems([]); setAllItemsCached(null);
        const savedGenre = localStorage.getItem(getStorageKey(currentView, 'genre')) || '';
        const savedYear = localStorage.getItem(getStorageKey(currentView, 'year')) || '';
        let savedSort = localStorage.getItem(getStorageKey(currentView, 'sort')) || 'alphabeticalByName';
        if (currentView === 'ALBUMS' && viewData && typeof viewData === 'object' && viewData.sort) savedSort = viewData.sort;
        setSelectedGenre(savedGenre); setSelectedYear(savedYear); setSortType(savedSort);
    }, [currentView, viewData]);

    const handleSetSortType = (val: string) => { setSortType(val); localStorage.setItem(getStorageKey(currentView, 'sort'), val); };
    const handleSetSelectedGenre = (val: string) => { setSelectedGenre(val); localStorage.setItem(getStorageKey(currentView, 'genre'), val); };
    const handleSetSelectedYear = (val: string) => { setSelectedYear(val); localStorage.setItem(getStorageKey(currentView, 'year'), val); };
    const resetFilters = () => { setFilter(''); handleSetSelectedGenre(''); handleSetSelectedYear(''); handleSetSortType('alphabeticalByName'); setPage(0); };

    useEffect(() => { service.getGenres().then(setGenres); }, [service]);

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            setIsLoading(true);
            if (currentView === 'PLAYLISTS') {
                if (isActive) setItems(playlists);
            } else if (currentView === 'ARTISTS') {
                if (cachedArtists.length > 0) { if (isActive) setAllItemsCached(cachedArtists); }
                else { await fetchArtists(); }
            } else if (currentView === 'ALBUMS') {
                let res = [];
                if (filter) res = await service.searchAlbums(filter, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
                else if (selectedGenre) res = await service.getAlbumList('byGenre', ITEMS_PER_PAGE, page * ITEMS_PER_PAGE, { genre: selectedGenre });
                else if (selectedYear) res = await service.getAlbumList('byYear', ITEMS_PER_PAGE, page * ITEMS_PER_PAGE, { fromYear: selectedYear, toYear: selectedYear });
                else {
                    res = await service.getAlbumList(sortType, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
                    if (isActive) { setItems(res); setAllItemsCached(null); }
                }
                if (isActive && (filter || selectedGenre || selectedYear)) setItems(res);
            } else if (currentView === 'SONGS') {
                let queryParts = []; if (filter) queryParts.push(filter); if (selectedGenre) queryParts.push(selectedGenre); if (selectedYear) queryParts.push(selectedYear);
                const res = await service.searchSongs(queryParts.join(' '), ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
                if (isActive) { setItems(res); setAllItemsCached(null); }
            } else if (currentView === 'LIKED_SONGS' || currentView === 'LIKED_ALBUMS') {
                const res = await service.getStarred();
                if (isActive) setAllItemsCached(currentView === 'LIKED_SONGS' ? res.songs : res.albums);
            }
            if (isActive) setIsLoading(false);
        };
        load();
        return () => { isActive = false; };
    }, [currentView, service, playlists, page, filter, selectedGenre, selectedYear, sortType, cachedArtists, fetchArtists]);

    const displayItems = useMemo(() => {
        if (currentView === 'PLAYLISTS') return !filter ? items : items.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
        const isClientSideView = currentView === 'ARTISTS' || currentView === 'LIKED_SONGS' || currentView === 'LIKED_ALBUMS';
        if (isClientSideView && allItemsCached) {
            let filtered = allItemsCached;
            if (filter) {
                const q = filter.toLowerCase();
                filtered = allItemsCached.filter(item => {
                    if (currentView === 'ARTISTS') return item.name.toLowerCase().includes(q);
                    const title = item.title || item.name || '';
                    const artist = item.artist || '';
                    return title.toLowerCase().includes(q) || artist.toLowerCase().includes(q);
                });
                return filtered;
            }
            return filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
        }
        return items;
    }, [items, filter, currentView, allItemsCached, page, playlists]);

    const PaginationControls = () => (
        <div className="flex justify-center items-center space-x-2 my-8">
            <button
                onClick={() => { setPage(p => p - 1); document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={page === 0}
                className="flex items-center px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition border border-neutral-200 font-bold text-sm text-neutral-700 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 dark:text-white"
            >
                <ChevronLeft className="w-4 h-4 mr-2" /> Prev
            </button>

            <div className="px-6 font-mono text-sm text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-black/20 rounded-full py-2.5 border border-neutral-200 dark:border-white/5 mx-2">
                Page <span className="text-neutral-900 dark:text-white font-bold">{page + 1}</span>
            </div>

            <button
                onClick={() => { setPage(p => p + 1); document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={displayItems.length < ITEMS_PER_PAGE}
                className="flex items-center px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition border border-neutral-200 font-bold text-sm text-neutral-700 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 dark:text-white"
            >
                Next <ChevronRight className="w-4 h-4 ml-2" />
            </button>
        </div>
    );

    const isClientSideView = currentView === 'ARTISTS' || currentView === 'LIKED_SONGS' || currentView === 'LIKED_ALBUMS';
    const shouldShowPagination = (!isClientSideView && currentView !== 'PLAYLISTS' && (displayItems.length > 0 || page > 0)) || (isClientSideView && !filter && (allItemsCached?.length || 0) > ITEMS_PER_PAGE);
    const isSongView = currentView === 'SONGS' || currentView === 'LIKED_SONGS';

    return (
        <div className="p-6 md:p-12 min-h-full flex flex-col max-w-[1800px] mx-auto animate-fade-in">
            <MobileLibraryTabs />

            <ViewHeader currentView={currentView}>
                <FilterBar currentView={currentView} filter={filter} setFilter={setFilter} setPage={setPage} sortType={sortType} setSortType={handleSetSortType} selectedGenre={selectedGenre} setSelectedGenre={handleSetSelectedGenre} selectedYear={selectedYear} setSelectedYear={handleSetSelectedYear} genres={genres} resetFilters={resetFilters} />
                {currentView === 'PLAYLISTS' && (
                    <div className="flex items-center ml-auto lg:ml-0 pl-2">
                        {isCreating ? (
                            <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 animate-fade-in shadow-lg">
                                <input autoFocus className="bg-transparent px-4 py-2.5 text-sm focus:outline-hidden text-neutral-900 dark:text-white w-40" placeholder="Playlist Name" value={newPlName} onChange={(e) => setNewPlName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPlName.trim()) { createPlaylist(newPlName); setNewPlName(''); setIsCreating(false); } else if (e.key === 'Escape') setIsCreating(false); }} />
                                <button onClick={() => setIsCreating(false)} className="px-3 text-neutral-500 hover:text-neutral-900 border-l border-neutral-200 dark:border-white/10 h-full transition-colors dark:text-neutral-400 dark:hover:text-white" aria-label="Cancel create playlist"><X className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <button onClick={() => setIsCreating(true)} className="flex items-center justify-center px-6 py-2.5 bg-primary text-black rounded-full text-sm font-bold hover:bg-white transition shadow-glow-sm hover:shadow-glow hover:scale-105 active:scale-95">
                                <Plus className="w-5 h-5 mr-1" /> New
                            </button>
                        )}
                    </div>
                )}
            </ViewHeader>

            {shouldShowPagination && <PaginationControls />}

            {isLoading && !displayItems.length ? (
                <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                    <p className="font-medium animate-pulse">Loading collection...</p>
                </div>
            ) : (
                <>
                    {isSongView ? (
                        <div className="rounded-lg overflow-hidden flex-1 bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-white/5">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left text-sm text-neutral-700 dark:text-neutral-400">
                                    <thead className="bg-neutral-200 text-neutral-700 dark:bg-white/5 dark:text-neutral-300 uppercase tracking-widest text-[10px] font-bold">
                                        <tr>
                                            <th className="p-5 w-16 text-center">#</th>
                                            <th className="p-5">Title</th>
                                            <th className="p-5 hidden md:table-cell">Artist</th>
                                            <th className="p-5 hidden lg:table-cell">Album</th>
                                            <th className="p-5 text-right">Time</th>
                                            <th className="p-5 w-24"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                                        {displayItems.map((song: ISong, idx) => (
                                            <tr key={song.id} className="hover:bg-neutral-100 dark:hover:bg-white/5 group transition-colors">
                                                <td className="p-4 text-center cursor-pointer relative" onClick={() => playSong(song, displayItems as ISong[])}>
                                                    <div className="flex items-center justify-center w-8 h-8 mx-auto relative">
                                                        <span className="font-mono text-neutral-500 text-xs absolute inset-0 flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0">{(page * ITEMS_PER_PAGE) + idx + 1}</span>
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100">
                                                            <Play className="w-4 h-4 text-primary fill-current" />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-bold text-neutral-900 dark:text-white cursor-pointer" onClick={() => playSong(song, displayItems as ISong[])}>
                                                    <div className="flex items-center gap-4">
                                                        <img src={service.getCoverArtUrl(song.id, 50)} className="w-10 h-10 rounded object-cover bg-neutral-200 dark:bg-neutral-800 shadow group-hover:scale-105 transition-transform" loading="lazy" alt="" />
                                                        <div className="min-w-0">
                                                            <div className="truncate group-hover:text-primary transition-colors text-sm">{song.title}</div>
                                                            <div className="md:hidden text-xs text-neutral-500 truncate mt-0.5">{song.artist}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell cursor-pointer text-neutral-700 dark:text-white/80 hover:text-neutral-900 dark:hover:text-white transition-colors text-sm font-medium" onClick={(e) => { e.stopPropagation(); if (song.artistId) setView('ARTIST_DETAIL', song.artistId); }}>{song.artist}</td>
                                                <td className="p-4 hidden lg:table-cell cursor-pointer text-neutral-600 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white transition-colors text-sm" onClick={(e) => { e.stopPropagation(); if (song.albumId) setView('ALBUM_DETAIL', song.albumId); }}>{song.album}</td>
                                                <td className="p-4 text-right font-mono text-xs tabular-nums cursor-pointer opacity-70 group-hover:opacity-100" onClick={() => playSong(song, displayItems as ISong[])}>{Math.floor(song.duration / 60)}:{song.duration % 60 < 10 ? '0' : ''}{song.duration % 60}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={(e) => { e.stopPropagation(); openPlaylistModal(song); }} className="text-neutral-500 hover:text-neutral-900 p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-neutral-200 rounded-full hover:scale-110 dark:hover:text-white dark:hover:bg-white/10" title="Add to Playlist" aria-label="Add to playlist">
                                                        <ListPlus className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 content-start">
                            {displayItems.map((item: any, i) => (
                                <div
                                    key={item.id}
                                    className={`group cursor-pointer bg-transparent`}
                                    onClick={() => {
                                        if (currentView === 'ARTISTS') setView('ARTIST_DETAIL', item.id);
                                        else if (currentView === 'ALBUMS' || currentView === 'LIKED_ALBUMS') setView('ALBUM_DETAIL', item.id);
                                        else if (currentView === 'PLAYLISTS') setView('PLAYLIST_DETAIL', item.id);
                                    }}
                                >
                                    <div className={`aspect-square overflow-hidden mb-3 relative shadow-lg bg-neutral-200 dark:bg-neutral-900 ${currentView === 'ARTISTS' ? 'rounded-full' : 'rounded-lg'}`}>
                                        <img src={service.getCoverArtUrl(item.coverArt || item.id, 400)} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                            {currentView === 'ARTISTS' ? <span className="px-3 py-1.5 bg-white text-black rounded text-[10px] font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">View</span> : (
                                                <div className="w-12 h-12 bg-white text-black rounded-lg shadow-xl flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"><Play className="w-5 h-5 fill-current ml-0.5" /></div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={currentView === 'ARTISTS' ? 'text-center' : ''}>
                                        <h3 className="font-semibold text-neutral-900 dark:text-white truncate text-sm mb-1">{item.name}</h3>
                                        {currentView !== 'ARTISTS' && currentView !== 'PLAYLISTS' && <p className="text-xs text-neutral-600 dark:text-white/60 truncate">{item.artist}</p>}
                                        {currentView === 'ARTISTS' && <p className="text-xs text-neutral-600 dark:text-white/60">{item.albumCount} Albums</p>}
                                        {currentView === 'PLAYLISTS' && <p className="text-xs text-neutral-600 dark:text-white/60">{item.songCount} Songs</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {displayItems.length === 0 && !isLoading && (
                        <div className="text-center py-32 text-neutral-500 animate-fade-in">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-bold text-neutral-400">No matches found</p>
                            <p className="text-sm mt-2 mb-6">Try adjusting your filters or search terms</p>
                            <button onClick={resetFilters} className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-sm transition border border-neutral-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/5">Clear all filters</button>
                        </div>
                    )}
                </>
            )}
            {shouldShowPagination && <PaginationControls />}
        </div>
    );
};

