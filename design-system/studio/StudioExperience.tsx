import { AiDjSettings } from '../../components/AiDjSettings';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Activity, Album, ArrowLeft, AudioLines, Cable, Check, ChevronLeft, ChevronRight, CirclePlus, Compass,
  Disc3, Download, ExternalLink, Gauge, Headphones, Heart, Home, Keyboard, Library, ListFilter,
  ListMusic, Menu, Mic2, Monitor, Music2, Palette, Pause, Play, Plus, Radio, RefreshCw, Search,
  Server, Settings, Shuffle, SlidersHorizontal, Trash2, Waves, X,
} from 'lucide-react';
import { MOCK_ALBUMS, MOCK_ARTISTS, MOCK_PLAYLISTS, MOCK_SONGS } from '../../constants';
import { useStore } from '../../context/Store';
import { useStreamDeckBridge } from '../../context/StreamDeckBridgeContext';
import { useTheme } from '../../context/ThemeContext';
import { getUpdateAction } from '../../components/updateAction';
import { AI_DJ_SETTINGS_DEFAULTS, AVAILABLE_DJ_VOICES } from '../../electron/settingsSchema';
import type { UpdaterState } from '../../electron/updater';
import { usePlatform } from '../../platform/PlatformContext';
import { STREAM_DECK_DEFAULT_PORT } from '../../services/streamDeckProtocol';
import type { IAlbum, IArtist, IPlaylist, IRadioStation, ISong, View, VisualizerMode } from '../../types';
import nebulaLogo from './assets/nebula-monochrome.svg';
import {
  AnimatedSwitch, ArtworkTrackCard, CommandGroup, CommandSearch, EmptyState, HookNavigation,
  LoadingState, SegmentedControl, StepPlayer, StudioButton as ActionButton, useDialogFocus,
} from './components/StudioKit';
import { FloatingPlayer, LargeNowPlaying, SidebarPlayer } from './components/StudioPlayers';

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
const formatDuration = (seconds = 0) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const contrastColor = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#111111';
  const [red, green, blue] = [0, 2, 4].map(index => parseInt(normalized.slice(index, index + 2), 16));
  return (red * .299 + green * .587 + blue * .114) > 150 ? '#111111' : '#ffffff';
};

function PageHeading({ title, copy, action }: { title: string; copy?: string; action?: React.ReactNode }) {
  return <header className="studio-page-heading"><div><h1>{title}</h1>{copy && <p>{copy}</p>}</div>{action}</header>;
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="studio-section-heading"><h2>{title}</h2>{action}</div>;
}

function useCatalog() {
  const { service, playlists } = useStore();
  const [data, setData] = useState<{ songs: ISong[]; albums: IAlbum[]; artists: IArtist[]; genres: string[]; starredSongs: ISong[]; starredAlbums: IAlbum[] }>({ songs: [], albums: [], artists: [], genres: [], starredSongs: [], starredAlbums: [] });
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    const [songs, albums, artists, genres, starred] = await Promise.all([
      service.getRandomSongs(24), service.getAlbumList('random', 24), service.getArtists(), service.getGenres(), service.getStarred(),
    ]);
    setData({ songs, albums, artists, genres, starredSongs: starred.songs, starredAlbums: starred.albums });
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, [service]);
  return {
    songs: data.songs.length ? data.songs : MOCK_SONGS,
    albums: data.albums.length ? data.albums : MOCK_ALBUMS,
    artists: data.artists.length ? data.artists : MOCK_ARTISTS,
    genres: data.genres,
    starredSongs: data.starredSongs,
    starredAlbums: data.starredAlbums,
    playlists: playlists.length ? playlists : MOCK_PLAYLISTS,
    loading,
    refresh,
  };
}

function TrackRow({ song, context, index, active = false }: { song: ISong; context: ISong[]; index: number; active?: boolean }) {
  const { service, playSong, setView, toggleLike, openPlaylistModal, isPlaying } = useStore();
  return <div className="studio-track-row" data-active={active}>
    <button type="button" className="studio-track-index" onClick={() => playSong(song, context)} aria-label={`Play ${song.title}`}><span>{String(index + 1).padStart(2, '0')}</span>{active && isPlaying ? <Pause /> : <Play />}</button>
    <button type="button" className="studio-track-title" onClick={() => playSong(song, context)}><img src={service.getCoverArtUrl(song.coverArt || song.id, 96)} alt=""/><span><strong>{song.title}</strong><small>{song.artist}</small></span></button>
    <button type="button" className="studio-track-album" onClick={() => song.albumId && setView('ALBUM_DETAIL', song.albumId)}>{song.album}</button>
    <span className="studio-track-format">{song.suffix?.toUpperCase() || 'AUDIO'}</span>
    <span className="studio-track-duration">{formatDuration(song.duration)}</span>
    <div className="studio-track-actions"><button type="button" aria-label={song.starred ? 'Unlike track' : 'Like track'} data-active={song.starred} onClick={() => toggleLike(song)}><Heart /></button><button type="button" aria-label="Add to playlist" onClick={() => openPlaylistModal(song)}><CirclePlus /></button></div>
  </div>;
}

function TrackLedger({ songs }: { songs: ISong[] }) {
  const { queue, currentSongIndex } = useStore();
  return <div className="studio-track-ledger">
    <div className="studio-track-columns"><span>#</span><span>Track</span><span>Album</span><span>Format</span><span>Time</span><span /></div>
    {songs.map((song, index) => <TrackRow key={`${song.id}-${index}`} song={song} context={songs} index={index} active={queue[currentSongIndex]?.id === song.id} />)}
  </div>;
}

function CollectionTile({ item, kind = 'album' }: { item: IAlbum | IArtist | IPlaylist; kind?: 'album' | 'artist' | 'playlist' }) {
  const { service, setView, playSong } = useStore();
  const title = 'name' in item ? item.name : '';
  const subtitle = kind === 'artist' ? `${(item as IArtist).albumCount ?? 0} albums` : kind === 'playlist' ? `${(item as IPlaylist).songCount} tracks` : (item as IAlbum).artist;
  const art = service.getCoverArtUrl(item.coverArt || item.id, 420);
  const open = () => setView(kind === 'artist' ? 'ARTIST_DETAIL' : kind === 'playlist' ? 'PLAYLIST_DETAIL' : 'ALBUM_DETAIL', item.id);
  const songs = (item as IAlbum | IPlaylist).songs;
  return <article className="studio-collection-tile" data-kind={kind}>
    <button type="button" className="studio-collection-art" onClick={open}><img src={art} alt=""/><span>{kind === 'artist' ? <Mic2 /> : kind === 'playlist' ? <ListMusic /> : <Disc3 />}</span></button>
    <div><button type="button" onClick={open}><strong>{title}</strong><small>{subtitle}</small></button>{songs?.length ? <button type="button" aria-label={`Play ${title}`} onClick={() => playSong(songs[0], songs)}><Play /></button> : <button type="button" aria-label={`Open ${title}`} onClick={open}><ChevronRight /></button>}</div>
  </article>;
}

function FeaturedBar({ songs }: { songs: ISong[] }) {
  const reduced = useReducedMotion();
  const { service, playSong, setView } = useStore();
  const featured = songs.slice(0, 5);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [pausedByFocus, setPausedByFocus] = useState(false);
  const duration = 6500;
  useEffect(() => {
    if (!playing || pausedByFocus || reduced || featured.length < 2) return;
    const started = performance.now() - progress * duration;
    const timer = window.setInterval(() => {
      const next = (performance.now() - started) / duration;
      if (next >= 1) { setIndex(current => (current + 1) % featured.length); setProgress(0); }
      else setProgress(next);
    }, 80);
    return () => window.clearInterval(timer);
  }, [duration, featured.length, index, pausedByFocus, playing, reduced]);
  if (!featured.length) return null;
  const song = featured[index];
  const art = service.getCoverArtUrl(song.coverArt || song.id, 1000);
  return <section
    className="studio-featured-bar"
    onMouseEnter={() => setPausedByFocus(true)} onMouseLeave={() => setPausedByFocus(false)}
    onFocusCapture={() => setPausedByFocus(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPausedByFocus(false); }}
    onKeyDown={event => { if (event.key === 'ArrowRight') setIndex((index + 1) % featured.length); if (event.key === 'ArrowLeft') setIndex((index - 1 + featured.length) % featured.length); }}
  >
    <AnimatePresence mode="popLayout">
      <motion.img key={art} className="studio-featured-backdrop" src={art} alt="" initial={reduced ? false : { opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .5, ease: [.16, 1, .3, 1] }} />
    </AnimatePresence>
    <div className="studio-featured-shade" />
    <div className="studio-featured-copy">
      <div><h2>{song.title}</h2><button type="button" onClick={() => song.artistId && setView('ARTIST_DETAIL', song.artistId)}>{song.artist}</button><p>{song.album} · {song.year || 'New release'} · {formatDuration(song.duration)}</p></div>
      <div className="studio-featured-actions"><ActionButton onClick={() => playSong(song, featured)}><Play /> Play Track</ActionButton><ActionButton variant="secondary" onClick={() => song.albumId && setView('ALBUM_DETAIL', song.albumId)}>Open Album <ChevronRight /></ActionButton></div>
    </div>
    <StepPlayer value={index} count={featured.length} playing={playing} progress={progress} onValueChange={next => { setIndex(next); setProgress(0); }} onPlayingChange={setPlaying} />
  </section>;
}

function HomeView({ catalog }: { catalog: ReturnType<typeof useCatalog> }) {
  const { setView, playSong, service, homeData } = useStore();
  const songs = homeData.randomSongs.length ? homeData.randomSongs : catalog.songs;
  const albums = homeData.recentAlbums.length ? homeData.recentAlbums : catalog.albums;
  return <div className="studio-page">
    <PageHeading title="Listen Now" action={<ActionButton variant="secondary" onClick={catalog.refresh}><RefreshCw /> Refresh</ActionButton>} />
    <FeaturedBar songs={songs} />
    <div className="studio-home-grid">
      <section><SectionHeading title="Quick Picks" action={<button onClick={() => setView('SONGS')}>View Songs <ChevronRight /></button>} /><div className="studio-artwork-list">{songs.slice(0, 4).map(song => <ArtworkTrackCard key={song.id} art={service.getCoverArtUrl(song.coverArt || song.id, 300)} title={song.title} artist={song.artist} onPlay={() => playSong(song, songs)} onOpen={() => song.albumId && setView('ALBUM_DETAIL', song.albumId)} />)}</div></section>
      <section className="studio-session-panel"><SectionHeading title="Start a Session" /><button type="button" onClick={() => playSong(songs[0], [...songs].sort(() => Math.random() - .5))}><span><Shuffle /></span><strong>Shuffle Everything</strong><ChevronRight /></button><button type="button" onClick={() => setView('LIKED_SONGS')}><span><Heart /></span><strong>Liked Tracks</strong><ChevronRight /></button><button type="button" onClick={() => setView('RADIO')}><span><Radio /></span><strong>Internet Radio</strong><ChevronRight /></button></section>
    </div>
    <section><SectionHeading title="Recently Added" action={<button onClick={() => setView('ALBUMS')}>Full Library <ChevronRight /></button>} /><div className="studio-collection-grid">{albums.slice(0, 6).map(album => <CollectionTile key={album.id} item={album} />)}</div></section>
  </div>;
}

function BrowseView({ catalog }: { catalog: ReturnType<typeof useCatalog> }) {
  const { service, playSong, setView } = useStore();
  const mixes = [
    { name: 'After Dark', songs: catalog.songs.filter(song => /synth|electronic/i.test(song.genre || '')).concat(catalog.songs).slice(0, 8) },
    { name: 'Deep Focus', songs: catalog.songs.filter(song => /lo-fi|classical/i.test(song.genre || '')).concat(catalog.songs).slice(0, 8) },
    { name: 'Server Favorites', songs: [...catalog.songs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 8) },
  ];
  return <div className="studio-page"><PageHeading title="Browse" /><FeaturedBar songs={catalog.songs.slice(2).concat(catalog.songs.slice(0, 2))} />
    <section><SectionHeading title="Made from Your Library" /><div className="studio-mix-grid">{mixes.map((mix, index) => <button type="button" key={mix.name} className="studio-mix" onClick={() => mix.songs[0] && playSong(mix.songs[0], mix.songs)}><img src={service.getCoverArtUrl(mix.songs[0]?.coverArt || mix.songs[0]?.id || `random=${index + 1}`, 500)} alt=""/><span><strong>{mix.name}</strong></span><Play /></button>)}</div></section>
    <section><SectionHeading title="Explore Albums" action={<button onClick={() => setView('ALBUMS')}>All Albums <ChevronRight /></button>} /><div className="studio-collection-grid">{catalog.albums.slice(0, 12).map(album => <CollectionTile key={album.id} item={album} />)}</div></section>
  </div>;
}

function LibraryView({ catalog }: { catalog: ReturnType<typeof useCatalog> }) {
  const { currentView, service } = useStore();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<'recent' | 'az' | 'played'>('recent');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(0);
  const tab: 'artists' | 'albums' | 'songs' | 'playlists' = currentView === 'ARTISTS' ? 'artists' : currentView === 'SONGS' || currentView === 'LIKED_SONGS' ? 'songs' : currentView === 'PLAYLISTS' ? 'playlists' : 'albums';
  const tabs = [{ value: 'artists', label: 'Artists' }, { value: 'albums', label: 'Albums' }, { value: 'songs', label: 'Songs' }, { value: 'playlists', label: 'Playlists' }] as const;
  const title = currentView === 'LIKED_SONGS' ? 'Liked Songs' : currentView === 'LIKED_ALBUMS' ? 'Liked Albums' : tabs.find(item => item.value === tab)?.label ?? 'Library';
  const needle = filter.toLowerCase();
  const songSource = currentView === 'LIKED_SONGS' ? catalog.starredSongs : catalog.songs;
  const albumSource = currentView === 'LIKED_ALBUMS' ? catalog.starredAlbums : catalog.albums;
  const sortItems = <T extends { name?: string; title?: string; created?: string; playCount?: number }>(items: T[]) => [...items].sort((a, b) => sort === 'az' ? (a.name || a.title || '').localeCompare(b.name || b.title || '') : sort === 'played' ? (b.playCount || 0) - (a.playCount || 0) : String(b.created || '').localeCompare(String(a.created || '')));
  const songs = sortItems(songSource.filter(song => `${song.title} ${song.artist} ${song.album}`.toLowerCase().includes(needle) && (!genre || song.genre === genre) && (!year || String(song.year || '') === year)));
  const albums = sortItems(albumSource.filter(album => `${album.name} ${album.artist}`.toLowerCase().includes(needle) && (!genre || album.genre === genre) && (!year || String(album.year || '') === year)));
  const artists = sortItems(catalog.artists.filter(artist => artist.name.toLowerCase().includes(needle)));
  const playlists = sortItems(catalog.playlists.filter(playlist => playlist.name.toLowerCase().includes(needle)));
  const currentItems = tab === 'songs' ? songs : tab === 'albums' ? albums : tab === 'artists' ? artists : playlists;
  const years = Array.from(new Set([...songSource.map(item => item.year), ...albumSource.map(item => item.year)].filter(Boolean))).sort((a, b) => Number(b) - Number(a));
  const perPage = tab === 'songs' ? 14 : 12;
  const pageCount = Math.max(1, Math.ceil(currentItems.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visibleItems = currentItems.slice(safePage * perPage, safePage * perPage + perPage);
  useEffect(() => { setPage(0); }, [filter, genre, sort, tab, year]);
  return <div className="studio-page"><PageHeading title={title} />
    <div className="studio-library-tools"><label className="studio-filter-input"><Search /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder={`Filter ${tabs.find(item => item.value === tab)?.label ?? tab}`} aria-label={`Filter ${tabs.find(item => item.value === tab)?.label ?? tab}`} />{filter && <button type="button" onClick={() => setFilter('')} aria-label="Clear filter"><X /></button>}</label><label className="studio-sort-control"><ListFilter /><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="Sort library"><option value="recent">Recently Added</option><option value="az">A–Z</option><option value="played">Most Played</option></select></label>{(tab === 'songs' || tab === 'albums') && <><label className="studio-filter-select"><span>Genre</span><select value={genre} onChange={event => setGenre(event.target.value)}><option value="">All Genres</option>{catalog.genres.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="studio-filter-select"><span>Year</span><select value={year} onChange={event => setYear(event.target.value)}><option value="">All Years</option>{years.map(item => <option key={item} value={item}>{item}</option>)}</select></label></>}{(filter || genre || year) && <button type="button" className="studio-filter-reset" onClick={() => { setFilter(''); setGenre(''); setYear(''); }}>Reset Filters</button>}</div>
    {catalog.loading ? <LoadingState /> : tab === 'songs' ? <TrackLedger songs={visibleItems as ISong[]} /> : <div className="studio-collection-grid">{tab === 'artists' ? (visibleItems as IArtist[]).map(item => <CollectionTile key={item.id} item={{ ...item, coverArt: item.coverArt || item.id }} kind="artist" />) : tab === 'playlists' ? (visibleItems as IPlaylist[]).map(item => <CollectionTile key={item.id} item={item} kind="playlist" />) : (visibleItems as IAlbum[]).map(item => <CollectionTile key={item.id} item={item} />)}</div>}
    {!catalog.loading && currentItems.length > perPage && <nav className="studio-pagination" aria-label={`${tab} pages`}><button type="button" disabled={safePage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft /> Previous</button><span>Page {safePage + 1} of {pageCount}</span><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}>Next <ChevronRight /></button></nav>}
  </div>;
}

function AlbumDetailView({ catalog }: { catalog: ReturnType<typeof useCatalog> }) {
  const { viewData, service, playSong, goBack, setView, togglePlay, isPlaying, queue, currentSongIndex } = useStore();
  const [album, setAlbum] = useState<IAlbum | null>(null);
  useEffect(() => { let live = true; void service.getAlbum(String(viewData)).then(value => live && setAlbum(value)); return () => { live = false; }; }, [service, viewData]);
  if (!album) return <div className="studio-page"><LoadingState label="Loading album" /></div>;
  const songs = album.songs || [];
  const art = service.getCoverArtUrl(album.coverArt || album.id, 900);
  const active = songs.some(song => queue[currentSongIndex]?.id === song.id);
  const play = () => active ? togglePlay() : songs[0] && playSong(songs[0], songs);
  return <div className="studio-detail-page"><section className="studio-detail-hero"><img className="studio-detail-bg" src={art} alt=""/><div className="studio-detail-shade"/><button className="studio-back" onClick={() => goBack('ALBUMS')}><ArrowLeft /> Back</button><div className="studio-detail-layout"><div className="studio-detail-cover"><img src={art} alt={`Cover for ${album.name}`} /><span className="studio-detail-vinyl" /></div><div><h1>{album.name}</h1><button onClick={() => album.artistId && setView('ARTIST_DETAIL', album.artistId)}>{album.artist}</button><p>{album.year || 'Unknown Year'} · {album.songCount} tracks · {formatDuration(album.duration)}</p><div><ActionButton onClick={play}>{active && isPlaying ? <Pause /> : <Play />} {active && isPlaying ? 'Pause' : 'Play Album'}</ActionButton><ActionButton secondary onClick={() => { const shuffled = [...songs].sort(() => Math.random() - .5); if (shuffled[0]) playSong(shuffled[0], shuffled); }}><Shuffle /> Shuffle</ActionButton><button className="studio-icon-action" data-active={album.starred} onClick={() => { void service.toggleStar(album.id, !album.starred, 'album'); setAlbum({ ...album, starred: !album.starred }); }} aria-label={album.starred ? 'Unlike album' : 'Like album'}><Heart /></button></div></div></div></section>
    <div className="studio-detail-content"><section><SectionHeading title="Track List" /><TrackLedger songs={songs} /></section>{album.info?.notes && <aside className="studio-liner-notes"><h2>About This Record</h2><p>{album.info.notes}</p></aside>}<section><SectionHeading title="More in Your Library" /><div className="studio-collection-grid">{catalog.albums.filter(item => item.id !== album.id).slice(0, 6).map(item => <CollectionTile key={item.id} item={item} />)}</div></section></div>
  </div>;
}

function PlaylistDetailView() {
  const { viewData, service, playlists, playSong, goBack, deletePlaylist, setView } = useStore();
  const [playlist, setPlaylist] = useState<IPlaylist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { let live = true; const supplied = viewData && typeof viewData === 'object' ? viewData as IPlaylist : null; const local = supplied || playlists.find(item => item.id === String(viewData)); if (local?.songs) setPlaylist(local); else void service.getPlaylist(String(viewData)).then(value => live && setPlaylist(value)); return () => { live = false; }; }, [playlists, service, viewData]);
  if (!playlist) return <div className="studio-page"><LoadingState label="Loading playlist" /></div>;
  const songs = playlist.songs || [];
  const art = service.getCoverArtUrl(playlist.coverArt || songs[0]?.coverArt || playlist.id, 900);
  return <div className="studio-detail-page"><section className="studio-detail-hero is-playlist"><img className="studio-detail-bg" src={art} alt=""/><div className="studio-detail-shade"/><button className="studio-back" onClick={() => goBack('PLAYLISTS')}><ArrowLeft /> Back</button><div className="studio-detail-layout"><div className="studio-detail-cover studio-cover-stack"><img src={art} alt="" /></div><div><h1>{playlist.name}</h1><p>{playlist.songCount} tracks · {formatDuration(playlist.duration)}{playlist.owner ? ` · ${playlist.owner}` : ''}</p><div><ActionButton onClick={() => songs[0] && playSong(songs[0], songs)}><Play /> Play Playlist</ActionButton><ActionButton secondary onClick={() => { const shuffled = [...songs].sort(() => Math.random() - .5); if (shuffled[0]) playSong(shuffled[0], shuffled); }}><Shuffle /> Shuffle</ActionButton>{confirmDelete ? <ActionButton secondary onClick={() => { deletePlaylist(playlist.id); setView('PLAYLISTS'); }}>Confirm Delete</ActionButton> : <button className="studio-icon-action" onClick={() => setConfirmDelete(true)} aria-label="Delete playlist"><Trash2 /></button>}</div></div></div></section><div className="studio-detail-content"><SectionHeading title="Tracks" />{songs.length ? <TrackLedger songs={songs} /> : <EmptyState icon={<ListMusic />} title="This Playlist Is Empty" copy="Add tracks from any song menu." />}</div></div>;
}

function ArtistDetailView({ catalog }: { catalog: ReturnType<typeof useCatalog> }) {
  const { viewData, service, playSong, goBack } = useStore();
  const [artist, setArtist] = useState<IArtist | null>(null);
  const [albums, setAlbums] = useState<IAlbum[]>([]);
  const [songs, setSongs] = useState<ISong[]>([]);
  const [bio, setBio] = useState('');
  useEffect(() => { let live = true; void (async () => { const response = await service.getArtist(String(viewData)); const [top, info] = await Promise.all([service.getTopSongs(response.artist.name, 12), service.getArtistInfo(String(viewData), response.artist.name)]); if (live) { setArtist(response.artist); setAlbums(response.albums); setSongs(top); setBio(info.bio || ''); } })(); return () => { live = false; }; }, [service, viewData]);
  if (!artist) return <div className="studio-page"><LoadingState label="Loading artist" /></div>;
  const art = service.getCoverArtUrl(artist.coverArt || artist.id, 1000);
  return <div className="studio-detail-page"><section className="studio-artist-hero"><img src={art} alt=""/><div/><button className="studio-back" onClick={() => goBack('ARTISTS')}><ArrowLeft /> Back</button><div><h1>{artist.name}</h1><p>{artist.albumCount ?? albums.length} albums in your library</p><ActionButton onClick={() => songs[0] && playSong(songs[0], songs)}><Play /> Play Artist</ActionButton></div></section><div className="studio-detail-content studio-artist-content"><section><SectionHeading title="Popular Tracks" />{songs.length ? <TrackLedger songs={songs} /> : <EmptyState icon={<Music2 />} title="No Top Tracks Returned" copy="Open an album to start listening." />}</section>{bio && <aside className="studio-liner-notes"><h2>About {artist.name}</h2><p>{bio}</p></aside>}<section><SectionHeading title="Discography" /><div className="studio-collection-grid">{(albums.length ? albums : catalog.albums).slice(0, 8).map(album => <CollectionTile key={album.id} item={album} />)}</div></section></div></div>;
}

function SearchView({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { searchResults, isSearching, lastSearchQuery } = useStore();
  const count = searchResults.artists.length + searchResults.albums.length + searchResults.songs.length;
  return <div className="studio-page"><PageHeading title={lastSearchQuery ? `Results for “${lastSearchQuery}”` : 'Search'} copy={lastSearchQuery ? `${count} matches` : undefined} action={<ActionButton onClick={onOpenSearch}><Search /> New Search</ActionButton>} />{isSearching ? <LoadingState label="Searching the Server" /> : !lastSearchQuery ? <EmptyState icon={<Search />} title="Find Anything in Nebula" copy="Press Ctrl K to search." /> : !count ? <EmptyState icon={<Search />} title="No Matches Found" copy="Try a shorter title, artist name, or album." action={<ActionButton variant="secondary" onClick={onOpenSearch}>Change Search</ActionButton>} /> : <>{searchResults.artists.length > 0 && <section><SectionHeading title="Artists" /><div className="studio-collection-grid">{searchResults.artists.map(item => <CollectionTile key={item.id} item={{ ...item, coverArt: item.coverArt || item.id }} kind="artist" />)}</div></section>}{searchResults.albums.length > 0 && <section><SectionHeading title="Albums" /><div className="studio-collection-grid">{searchResults.albums.map(item => <CollectionTile key={item.id} item={item} />)}</div></section>}{searchResults.songs.length > 0 && <section><SectionHeading title="Tracks" /><TrackLedger songs={searchResults.songs} /></section>}</>}</div>;
}

function RadioView() {
  const { radioStations, currentRadioStation, isRadioPlaying, playRadioStation, toggleRadioPlay, stopRadio, addRadioStation, deleteRadioStation } = useStore();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', streamUrl: '', homepageUrl: '', genre: '' });
  const submit = () => { if (!form.name.trim() || !form.streamUrl.trim()) return; addRadioStation(form); setForm({ name: '', streamUrl: '', homepageUrl: '', genre: '' }); setAdding(false); };
  return <div className="studio-page"><PageHeading title="Internet Radio" action={<ActionButton onClick={() => setAdding(value => !value)}>{adding ? <X /> : <Plus />} {adding ? 'Close Form' : 'Add Station'}</ActionButton>} />
    <AnimatePresence initial={false}>{adding && <motion.form className="studio-radio-form" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={event => { event.preventDefault(); submit(); }}><label><span>Station Name</span><input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Nightwave FM" /></label><label><span>Stream URL</span><input required type="url" value={form.streamUrl} onChange={event => setForm({ ...form, streamUrl: event.target.value })} placeholder="https://…" /></label><label><span>Genre</span><input value={form.genre} onChange={event => setForm({ ...form, genre: event.target.value })} placeholder="Ambient" /></label><ActionButton type="submit">Save Station</ActionButton></motion.form>}</AnimatePresence>
    {!radioStations.length ? <EmptyState icon={<Radio />} title="No Radio Stations Yet" copy="Add a direct stream URL to begin." action={<ActionButton onClick={() => setAdding(true)}><Plus /> Add a Station</ActionButton>} /> : <div className="studio-radio-grid">{radioStations.map(station => { const active = currentRadioStation?.id === station.id; return <article key={station.id} data-active={active}><div className="studio-radio-signal"><Waves /><i/><i/><i/></div><div><strong>{station.name}</strong><small>{station.genre || 'Live Stream'}</small></div><button type="button" className="studio-radio-play" onClick={() => active ? toggleRadioPlay() : playRadioStation(station)} aria-label={`${active && isRadioPlaying ? 'Pause' : 'Play'} ${station.name}`}>{active && isRadioPlaying ? <Pause /> : <Play />}</button>{station.homepageUrl && <a href={station.homepageUrl} target="_blank" rel="noreferrer" aria-label={`Open ${station.name} homepage`}><ExternalLink /></a>}<button type="button" onClick={() => { if (active) stopRadio(); deleteRadioStation(station.id); }} aria-label={`Delete ${station.name}`}><Trash2 /></button></article>; })}</div>}
  </div>;
}

type SettingsSection = 'playback' | 'appearance' | 'navigation' | 'equalizer' | 'shortcuts' | 'integrations' | 'desktop' | 'updates' | 'ai-dj' | 'server';
type AiDjConfig = typeof AI_DJ_SETTINGS_DEFAULTS;

function SettingsRow({ title, copy, control }: { title: string; copy?: string; control: React.ReactNode }) {
  return <div className="studio-settings-row"><span><strong>{title}</strong>{copy && <small>{copy}</small>}</span>{control}</div>;
}

function SettingsView() {
  const { settings, updateSettings, visualizerMode, setVisualizerMode, credentials, isDemoMode, disconnect, connectToSubsonic } = useStore();
  const { mode, setTheme } = useTheme();
  const platform = usePlatform();
  const streamDeck = useStreamDeckBridge();
  const [section, setSection] = useState<SettingsSection>('playback');
  const [server, setServer] = useState({ url: '', user: '', secret: '' });
  const [connecting, setConnecting] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<keyof typeof settings.shortcuts | null>(null);
  const [desktopSettings, setDesktopSettings] = useState({ trayOnClose: true, minimizeToTray: false, mediaKeysEnabled: true, taskbarProgressEnabled: true });
  const [updateChannel, setUpdateChannel] = useState('stable');
  const [updateState, setUpdateState] = useState<UpdaterState | null>(null);
  const [aiDj, setAiDj] = useState<AiDjConfig>({ ...AI_DJ_SETTINGS_DEFAULTS });
  const [aiKey, setAiKey] = useState('');
  const [hasAiKey, setHasAiKey] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const isDesktop = platform?.info.kind === 'desktop';

  useEffect(() => {
    if (!platform) return;
    let live = true;
    void Promise.all([
      platform.settings.get('trayOnClose'), platform.settings.get('minimizeToTray'),
      platform.settings.get('mediaKeysEnabled'), platform.settings.get('taskbarProgressEnabled'),
      platform.settings.get('updateChannel'), platform.settings.get('aiDj'), platform.vault.getSecret('aiDj:apiKey'),
      platform.updater.getState(),
    ]).then(([tray, minimize, mediaKeys, taskbar, channel, dj, key, updater]) => {
      if (!live) return;
      setDesktopSettings({ trayOnClose: tray !== false, minimizeToTray: minimize === true, mediaKeysEnabled: mediaKeys !== false, taskbarProgressEnabled: taskbar !== false });
      if (typeof channel === 'string') setUpdateChannel(channel);
      if (dj) setAiDj(dj as AiDjConfig);
      setHasAiKey(Boolean(key));
      setUpdateState(updater);
    }).catch(() => {});
    const unsubscribe = platform.updater.onStatus(state => setUpdateState(state));
    return () => { live = false; unsubscribe(); };
  }, [platform]);

  useEffect(() => {
    if (!editingShortcut) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      updateSettings({ shortcuts: { ...settings.shortcuts, [editingShortcut]: event.key } });
      setEditingShortcut(null);
    };
    window.addEventListener('keydown', capture, true);
    return () => window.removeEventListener('keydown', capture, true);
  }, [editingShortcut, settings.shortcuts, updateSettings]);

  const setDesktopSetting = async (key: keyof typeof desktopSettings, value: boolean) => {
    const previous = desktopSettings[key];
    setDesktopSettings(current => ({ ...current, [key]: value }));
    try { await platform?.settings.set(key, value); }
    catch { setDesktopSettings(current => ({ ...current, [key]: previous })); }
  };
  const saveAiDj = async (patch: Partial<AiDjConfig>) => {
    const next = { ...aiDj, ...patch };
    setAiDj(next);
    await platform?.settings.set('aiDj', next).catch(() => {});
  };
  const settingItems = [
    { id: 'playback', label: 'Playback', icon: <Play /> }, { id: 'appearance', label: 'Appearance', icon: <Palette /> },
    { id: 'navigation', label: 'Navigation', icon: <Compass /> }, { id: 'equalizer', label: 'Equalizer', icon: <SlidersHorizontal /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard /> }, { id: 'integrations', label: 'Stream Deck', icon: <Cable /> },
    { id: 'desktop', label: 'Desktop', icon: <Monitor /> }, { id: 'updates', label: 'Updates', icon: <Download /> },
    { id: 'ai-dj', label: 'AI DJ', icon: <Headphones /> }, { id: 'server', label: 'Server', icon: <Server /> },
  ];
  const toggleNav = (key: keyof typeof settings.sidebar, checked: boolean) => updateSettings({ sidebar: { ...settings.sidebar, [key]: checked } });
  const updateAction = updateState ? getUpdateAction(updateState) : { kind: 'none' as const, label: 'Loading update status' };
  const desktopNote = !isDesktop ? <p className="studio-settings-note">This control becomes active in the installed desktop build.</p> : null;

  return <div className="studio-page studio-settings-page"><PageHeading title="Settings" />
    <div className="studio-settings-layout"><aside><HookNavigation items={settingItems} value={section} onChange={id => setSection(id as SettingsSection)} /></aside><section className="studio-settings-surface">
      {section === 'playback' && <><header><Gauge/><div><h2>Playback</h2><p>Choose how controls and transitions behave.</p></div></header><SettingsRow title="Player Location" copy="Keep controls in the right sidebar or a centered dock." control={<SegmentedControl value={settings.miniPlayerMode} label="Player location" options={[{ value: 'sidebar', label: 'Sidebar' }, { value: 'floating', label: 'Dock' }]} onChange={value => updateSettings({ miniPlayerMode: value })} />} /><SettingsRow title="Magic Crossfade" copy="Blend the ending of one track into the next." control={<AnimatedSwitch label="Magic crossfade" checked={settings.magicCrossfade} onCheckedChange={checked => updateSettings({ magicCrossfade: checked })} />} /><div className="studio-settings-block"><h3>Visualizer</h3><div className="studio-visualizer-options">{(['BARS', 'WAVE', 'CIRCLE', 'MIRROR', 'SPECTRUM'] as VisualizerMode[]).map(item => <button key={item} type="button" data-active={visualizerMode === item} onClick={() => setVisualizerMode(item)}><Activity />{item.charAt(0) + item.slice(1).toLowerCase()}</button>)}</div></div></>}
      {section === 'appearance' && <><header><Palette/><div><h2>Appearance</h2><p>Set the viewing mode and listening-room colors.</p></div></header><SettingsRow title="Color mode" control={<SegmentedControl value={mode} label="Color mode" options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} onChange={value => setTheme(value)} />} /><div className="studio-color-settings">{(['primaryColor', 'secondaryColor', 'backgroundColor'] as const).map(key => <label key={key}><span>{key === 'primaryColor' ? 'Accent' : key === 'secondaryColor' ? 'Secondary' : 'Background tint'}</span><input type="color" value={settings.theme[key]} onChange={event => updateSettings({ theme: { ...settings.theme, [key]: event.target.value } })}/><code>{settings.theme[key]}</code></label>)}</div></>}
      {section === 'navigation' && <><header><Compass/><div><h2>Navigation</h2><p>Choose which destinations stay in the hooked rail.</p></div></header>{([['showHome', 'Home'], ['showBrowse', 'Browse'], ['showRadio', 'Internet radio'], ['showArtists', 'Artists'], ['showAlbums', 'Albums'], ['showSongs', 'Songs'], ['showPlaylists', 'Playlists']] as Array<[keyof typeof settings.sidebar, string]>).map(([key, label]) => <SettingsRow key={key} title={label} control={<AnimatedSwitch label={`Show ${label}`} checked={settings.sidebar[key]} onCheckedChange={checked => toggleNav(key, checked)} />} />)}</>}
      {section === 'equalizer' && <><header><AudioLines/><div><h2>Equalizer</h2><p>Shape the ten-band output used by Nebula’s playback owner.</p></div></header><SettingsRow title="Enable equalizer" copy="Apply these bands to music playback." control={<AnimatedSwitch label="Enable equalizer" checked={settings.eq.enabled} onCheckedChange={checked => updateSettings({ eq: { ...settings.eq, enabled: checked } })} />} /><div className="studio-eq">{Object.entries(settings.eq.bands).map(([key, value]) => <label key={key}><strong>{Number(value) > 0 ? '+' : ''}{value}</strong><input type="range" min={-12} max={12} step={1} value={value} onChange={event => updateSettings({ eq: { ...settings.eq, preset: 'custom', bands: { ...settings.eq.bands, [key]: Number(event.target.value) } } })} aria-label={`${key} equalizer gain`} /><span>{key}</span></label>)}</div></>}
      {section === 'shortcuts' && <><header><Keyboard/><div><h2>Keyboard shortcuts</h2><p>Remap global listening controls.</p></div></header>{Object.entries(settings.shortcuts).map(([key, value]) => <SettingsRow key={key} title={({ playPause: 'Play / pause', prev: 'Previous track', next: 'Next track', loop: 'Toggle repeat', visualizer: 'Cycle visualizer', zen: 'Toggle Zen mode' } as Record<string, string>)[key]} control={<button type="button" className="studio-key-capture" data-editing={editingShortcut === key} onClick={() => setEditingShortcut(key as keyof typeof settings.shortcuts)}>{editingShortcut === key ? 'Press a key' : value === ' ' ? 'Space' : value.toUpperCase()}</button>} />)}</>}
      {section === 'integrations' && <><header><Cable/><div><h2>Stream Deck</h2><p>Pair Nebula with the local controller plugin.</p></div></header><SettingsRow title="Enable bridge" copy={streamDeck.status.message || `Local endpoint: ${streamDeck.status.endpoint}`} control={<AnimatedSwitch label="Enable Stream Deck bridge" checked={settings.streamDeck.enabled} onCheckedChange={enabled => updateSettings({ streamDeck: { ...settings.streamDeck, enabled } })} />} /><SettingsRow title="Local port" copy="Disable the bridge before changing ports." control={<input className="studio-setting-input is-short" type="number" min={1024} max={65535} disabled={settings.streamDeck.enabled} value={settings.streamDeck.port || STREAM_DECK_DEFAULT_PORT} onChange={event => updateSettings({ streamDeck: { ...settings.streamDeck, port: Number(event.target.value) } })} />} /><form className="studio-pairing-form" onSubmit={async event => { event.preventDefault(); setPairingError(''); try { await streamDeck.pair(pairingCode); setPairingCode(''); } catch (error) { setPairingError(error instanceof Error ? error.message : 'Pairing failed.'); } }}><label><span>Pairing code</span><input inputMode="numeric" maxLength={6} value={pairingCode} onChange={event => setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label><ActionButton type="submit" disabled={!settings.streamDeck.enabled || pairingCode.length !== 6}>Pair</ActionButton></form>{pairingError && <p className="studio-settings-error">{pairingError}</p>}<div className="studio-inline-actions"><ActionButton secondary disabled={!settings.streamDeck.enabled} onClick={streamDeck.reconnect}><RefreshCw /> Reconnect</ActionButton><ActionButton secondary onClick={() => { void streamDeck.unpair(); }}>Revoke pairing</ActionButton><span className="studio-status-chip" data-state={streamDeck.status.state}>{streamDeck.status.state.replace('-', ' ')}</span></div></>}
      {section === 'desktop' && <><header><Monitor/><div><h2>Desktop integration</h2><p>Control how the installed app behaves with the operating system.</p></div></header>{desktopNote}<SettingsRow title="Close to tray" copy="Keep Nebula running after its window closes." control={<AnimatedSwitch disabled={!isDesktop} label="Close to tray" checked={desktopSettings.trayOnClose} onCheckedChange={value => { void setDesktopSetting('trayOnClose', value); }} />} /><SettingsRow title="Minimize to tray" copy="Hide the window instead of keeping it on the taskbar." control={<AnimatedSwitch disabled={!isDesktop} label="Minimize to tray" checked={desktopSettings.minimizeToTray} onCheckedChange={value => { void setDesktopSetting('minimizeToTray', value); }} />} /><SettingsRow title="Global media keys" copy="Receive play, pause, previous, and next while in the background." control={<AnimatedSwitch disabled={!isDesktop} label="Global media keys" checked={desktopSettings.mediaKeysEnabled} onCheckedChange={value => { void setDesktopSetting('mediaKeysEnabled', value); }} />} /><SettingsRow title="Taskbar progress" copy="Reflect the current track position in Windows." control={<AnimatedSwitch disabled={!isDesktop} label="Taskbar progress" checked={desktopSettings.taskbarProgressEnabled} onCheckedChange={value => { void setDesktopSetting('taskbarProgressEnabled', value); }} />} /></>}
      {section === 'updates' && <><header><Download/><div><h2>Updates</h2><p>Manage the release channel and installed build.</p></div></header>{desktopNote}<div className="studio-update-card"><span className="studio-status-chip" data-state={updateState?.phase || 'idle'}>{updateState?.phase?.replace('-', ' ') || 'idle'}</span><strong>{updateState?.currentVersion ? `Nebula ${updateState.currentVersion}` : 'Nebula Studio'}</strong><p>{updateState?.message || 'Updates are checked against GitHub Releases in installed builds.'}</p><ActionButton disabled={!isDesktop || updateAction.kind === 'none'} onClick={() => { if (updateAction.kind === 'check') void platform?.updater.check(); if (updateAction.kind === 'download') void platform?.updater.openDownloadPage(); if (updateAction.kind === 'install') void platform?.updater.installAndRestart(); }}><RefreshCw /> {updateAction.label}</ActionButton></div><SettingsRow title="Update channel" copy="Beta includes pre-release builds." control={<SegmentedControl disabled={!isDesktop} value={updateChannel} label="Update channel" options={[{ value: 'stable', label: 'Stable' }, { value: 'beta', label: 'Beta' }]} onChange={value => { setUpdateChannel(value); void platform?.settings.set('updateChannel', value); }} />} /></>}
      {section === 'ai-dj' && <AiDjSettings />}
      {section === 'server' && <><header><Server/><div><h2>Server</h2><p>{isDemoMode ? 'Studio is using its isolated fixture server.' : credentials ? 'Nebula is connected to your Subsonic server.' : 'Connect to a Subsonic-compatible server.'}</p></div></header>{(credentials || isDemoMode) ? <div className="studio-server-status"><span><Check /></span><div><strong>{isDemoMode ? 'Studio preview connected' : 'Music server connected'}</strong><small>{isDemoMode ? 'No production data is touched.' : credentials?.serverUrl}</small></div>{!isDemoMode && <ActionButton secondary onClick={disconnect}>Disconnect</ActionButton>}</div> : <form className="studio-server-form" onSubmit={async event => { event.preventDefault(); setConnecting(true); await connectToSubsonic(server.url, server.user, server.secret); setConnecting(false); }}><label><span>Server URL</span><input required value={server.url} onChange={event => setServer({ ...server, url: event.target.value })} placeholder="https://music.example.com" /></label><label><span>Username</span><input required value={server.user} onChange={event => setServer({ ...server, user: event.target.value })} /></label><label><span>Password</span><input required type="password" value={server.secret} onChange={event => setServer({ ...server, secret: event.target.value })} /></label><ActionButton type="submit" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect server'}</ActionButton></form>}</>}
    </section></div>
  </div>;
}

function PlaylistDialog() {
  const { modalOpen, closePlaylistModal, playlists, createPlaylist, addSongToPlaylist, songToAddToPlaylist } = useStore();
  const [name, setName] = useState('');
  const closeDialog = useCallback(() => closePlaylistModal(), [closePlaylistModal]);
  const dialogRef = useDialogFocus<HTMLDivElement>(modalOpen && Boolean(songToAddToPlaylist), closeDialog);
  if (!modalOpen || !songToAddToPlaylist) return null;
  return <div ref={dialogRef} tabIndex={-1} className="studio-dialog-layer" onMouseDown={event => { if (event.target === event.currentTarget) closePlaylistModal(); }}><div role="dialog" aria-modal="true" aria-label="Add track to playlist" className="studio-playlist-dialog"><header><div><h2>Add to playlist</h2><p>{songToAddToPlaylist.title}</p></div><button type="button" onClick={closePlaylistModal} aria-label="Close"><X /></button></header><form onSubmit={event => { event.preventDefault(); if (name.trim()) { createPlaylist(name.trim()); setName(''); } }}><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="New playlist name" aria-label="New playlist name"/><button type="submit" disabled={!name.trim()}><Plus /> Create</button></form><div>{playlists.map(item => <button type="button" key={item.id} onClick={() => { addSongToPlaylist(item.id, songToAddToPlaylist); closePlaylistModal(); }}><span><ListMusic /></span><span><strong>{item.name}</strong><small>{item.songCount} tracks</small></span><Plus /></button>)}</div></div></div>;
}

function RadioDock() {
  const { currentRadioStation, isRadioPlaying, radioMetadata, toggleRadioPlay, stopRadio, volume, setVolume } = useStore();
  if (!currentRadioStation) return null;
  return <div className="studio-floating-player studio-radio-dock" role="region" aria-label="Internet radio player"><div className="studio-radio-dock-icon"><Waves /></div><div><strong>{radioMetadata?.title || currentRadioStation.name}</strong><small>{radioMetadata?.artist || currentRadioStation.genre || 'Live stream'}</small></div><button type="button" className="studio-radio-dock-play" onClick={toggleRadioPlay} aria-label={isRadioPlaying ? 'Pause radio' : 'Play radio'}>{isRadioPlaying ? <Pause /> : <Play />}</button><div className="studio-floating-volume"><Gauge /><input type="range" min={0} max={1} step={.01} value={volume} onChange={event => setVolume(Number(event.target.value))} aria-label="Radio volume" /></div><button type="button" className="studio-icon-button" onClick={stopRadio} aria-label="Stop radio"><X /></button></div>;
}

const primaryNav: Array<{ id: View; label: string; icon: React.ReactNode }> = [
  { id: 'HOME', label: 'Listen Now', icon: <Home /> }, { id: 'BROWSE', label: 'Browse', icon: <Compass /> }, { id: 'RADIO', label: 'Internet Radio', icon: <Radio /> },
  { id: 'ARTISTS', label: 'Artists', icon: <Mic2 /> }, { id: 'ALBUMS', label: 'Albums', icon: <Album /> }, { id: 'SONGS', label: 'Songs', icon: <Music2 /> }, { id: 'PLAYLISTS', label: 'Playlists', icon: <ListMusic /> },
];

export function StudioExperience() {
  const { currentView, viewData, setView, goBack, canGoBack, performSearch, playlists, settings, queue, currentSongIndex, currentRadioStation } = useStore();
  const reduced = useReducedMotion();
  const [navOpen, setNavOpen] = useState(() => window.innerWidth > 900);
  const [searchOpen, setSearchOpen] = useState(false);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [playerOpen, setPlayerOpen] = useState(() => params.get('qaExpanded') === '1');
  const [playerCollapsed, setPlayerCollapsed] = useState(() => params.get('qaFloating') === '1');
  const [compactPlayerLayout, setCompactPlayerLayout] = useState(() => window.matchMedia('(max-width: 1260px)').matches);
  const [mobileNavLayout, setMobileNavLayout] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const catalog = useCatalog();
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); }
      if (event.key === 'Escape' && navOpen && !searchOpen) setNavOpen(false);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [navOpen, searchOpen]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1260px)');
    const sync = () => setCompactPlayerLayout(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const sync = () => setMobileNavLayout(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const nav = navRef.current;
    if (!mobileNavLayout || !navOpen || !nav) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : menuButtonRef.current;
    const background = Array.from(nav.parentElement?.children ?? []).filter(element => element !== nav && !(element instanceof HTMLElement && element.classList.contains('studio-mobile-scrim')) && element instanceof HTMLElement) as HTMLElement[];
    const previous = background.map(element => ({ element, inert: element.inert, ariaHidden: element.getAttribute('aria-hidden') }));
    previous.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    const frame = requestAnimationFrame(() => nav.querySelector<HTMLElement>('.studio-brand > button:last-child')?.focus());
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setNavOpen(false); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(nav.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', trap);
      previous.forEach(({ element, inert, ariaHidden }) => { element.inert = inert; if (ariaHidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', ariaHidden); });
      previousFocus?.focus();
    };
  }, [mobileNavLayout, navOpen]);
  const commandGroups: CommandGroup[] = [
    { label: 'Go to', items: primaryNav.concat([{ id: 'SETTINGS', label: 'Settings', icon: <Settings /> }]).map(item => ({ id: `view-${item.id}`, label: item.label, hint: 'Open view', icon: item.icon, action: () => setView(item.id as View) })) },
    { label: 'Your Playlists', items: playlists.slice(0, 5).map(item => ({ id: `playlist-${item.id}`, label: item.name, hint: `${item.songCount} tracks`, icon: <ListMusic />, action: () => setView('PLAYLIST_DETAIL', item.id) })) },
  ];
  const visibleNav = primaryNav.filter(item => item.id === 'HOME' ? settings.sidebar.showHome : item.id === 'BROWSE' ? settings.sidebar.showBrowse : item.id === 'RADIO' ? settings.sidebar.showRadio : item.id === 'ARTISTS' ? settings.sidebar.showArtists : item.id === 'ALBUMS' ? settings.sidebar.showAlbums : item.id === 'SONGS' ? settings.sidebar.showSongs : settings.sidebar.showPlaylists);
  const navValue = primaryNav.some(item => item.id === currentView) ? currentView : currentView.includes('DETAIL') ? currentView.split('_')[0] + 'S' : currentView.startsWith('LIKED') ? 'SONGS' : '';
  const hasPlayer = queue.length > 0 && currentSongIndex >= 0;
  const showSidebar = hasPlayer && !currentRadioStation && settings.miniPlayerMode === 'sidebar' && !playerCollapsed && !compactPlayerLayout;
  let view: React.ReactNode;
  if (currentView === 'HOME') view = <HomeView catalog={catalog} />;
  else if (currentView === 'BROWSE') view = <BrowseView catalog={catalog} />;
  else if (['ARTISTS', 'ALBUMS', 'SONGS', 'PLAYLISTS', 'LIKED_SONGS', 'LIKED_ALBUMS'].includes(currentView)) view = <LibraryView catalog={catalog} />;
  else if (currentView === 'ALBUM_DETAIL') view = <AlbumDetailView catalog={catalog} />;
  else if (currentView === 'PLAYLIST_DETAIL') view = <PlaylistDetailView />;
  else if (currentView === 'ARTIST_DETAIL') view = <ArtistDetailView catalog={catalog} />;
  else if (currentView === 'SEARCH') view = <SearchView onOpenSearch={() => setSearchOpen(true)} />;
  else if (currentView === 'RADIO') view = <RadioView />;
  else view = <SettingsView />;
  const studioTheme = {
    '--studio-accent': settings.theme.primaryColor,
    '--studio-accent-strong': settings.theme.primaryColor,
    '--studio-accent-secondary': settings.theme.secondaryColor,
    '--studio-accent-ink': contrastColor(settings.theme.primaryColor),
    '--studio-dark-bg': settings.theme.backgroundColor,
  } as React.CSSProperties;
  return <div className="nebula-remix" style={studioTheme} data-nav-open={navOpen} data-sidebar-player={showSidebar}>
    <button type="button" className="studio-mobile-scrim" aria-label="Close navigation" aria-hidden={!navOpen} tabIndex={navOpen ? 0 : -1} onClick={() => setNavOpen(false)} />
    <aside ref={navRef} className="studio-shell-nav" role={mobileNavLayout ? 'dialog' : undefined} aria-modal={mobileNavLayout && navOpen ? true : undefined} aria-label="Main navigation" aria-hidden={mobileNavLayout && !navOpen ? true : undefined} inert={mobileNavLayout && !navOpen}>
      <div className="studio-brand"><button type="button" onClick={() => setView('HOME')}><img src={nebulaLogo} alt=""/><span><strong>Nebula</strong></span></button><button type="button" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X /></button></div>
      <HookNavigation items={visibleNav} value={String(navValue)} onChange={id => { setView(id as View); if (window.innerWidth <= 900) setNavOpen(false); }} label="Explore" />
      <div className="studio-nav-playlists"><p>Playlists</p>{playlists.slice(0, 4).map(item => <button type="button" key={item.id} onClick={() => setView('PLAYLIST_DETAIL', item.id)}><ListMusic /><span>{item.name}</span></button>)}</div>
      <div className="studio-nav-footer"><button type="button" data-active={currentView === 'SETTINGS'} onClick={() => setView('SETTINGS')}><Settings /><span>Settings</span></button><div><Server /><span><strong>Home Server</strong><small>Connected</small></span><i /></div></div>
    </aside>
    <div className="studio-shell-main">
      <header className="studio-topbar"><div><button ref={menuButtonRef} type="button" className="studio-menu" aria-label={navOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navOpen} onClick={() => setNavOpen(value => !value)}><Menu /></button><button type="button" className="studio-back-button" aria-label="Go back" disabled={!canGoBack} onClick={() => goBack()}><ArrowLeft /></button></div><button type="button" className="studio-search-trigger" onClick={() => setSearchOpen(true)}><Search /><span>Search your music</span><kbd>Ctrl K</kbd></button></header>
      <main className="studio-view-scroll"><AnimatePresence mode="wait" initial={false}><motion.div
        key={`${currentView}-${String(viewData ?? '')}`}
        className="studio-route-frame"
        initial={reduced ? { opacity: 1 } : { opacity: .72, y: 10, clipPath: 'inset(0 0 4% 0)' }}
        animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -5 }}
        transition={{ duration: reduced ? .1 : .24, ease: [.16, 1, .3, 1] }}
      >{view}</motion.div></AnimatePresence></main>
    </div>
    {showSidebar && <SidebarPlayer onExpand={() => setPlayerOpen(true)} onCollapse={() => setPlayerCollapsed(true)} />}
    {hasPlayer && !currentRadioStation && (!showSidebar || settings.miniPlayerMode === 'floating') && <FloatingPlayer onExpand={() => setPlayerOpen(true)} onRestore={() => setPlayerCollapsed(false)} />}
    {currentRadioStation && <RadioDock />}
    <LargeNowPlaying open={playerOpen} onClose={() => setPlayerOpen(false)} />
    <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} groups={commandGroups} onSearch={query => { void performSearch(query); }} />
    <PlaylistDialog />
  </div>;
}
