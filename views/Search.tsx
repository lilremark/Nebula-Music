import React, { useState } from 'react';
import { Arc } from 'loading-dev';
import { useStore } from '../context/Store';
import { Play, ListPlus, Heart, Search as SearchIcon } from 'lucide-react';
import { ISong } from '../types';
import { AlbumCard, ArtistCard, COLLECTION_GRID_CLASS } from '../components/DetailCards';

export const SearchView: React.FC = () => {
    const { searchResults, isSearching, lastSearchQuery, playSong, setView, service, openPlaylistModal, openSearchModal, toggleLike, queue, currentSongIndex } = useStore();
    // Search results belong to the store; remember like toggles locally so the heart updates immediately.
    const [likeOverrides, setLikeOverrides] = useState<Record<string, boolean>>({});

    if (isSearching) {
        return (
            <div data-nebula-view="search" data-nebula-search-state="loading" className="flex flex-col items-center justify-center h-[60vh] animate-fade-in text-[var(--next-muted)]">
                <Arc size={44} className="mb-4 text-primary" />
                <p className="text-sm font-semibold">Searching your library…</p>
            </div>
        );
    }

    const hasResults = searchResults.artists.length > 0 || searchResults.albums.length > 0 || searchResults.songs.length > 0;

    if (!hasResults && lastSearchQuery) {
        return (
            <div data-nebula-view="search" data-nebula-search-state="empty-results" className="nebula-search-empty animate-fade-in">
                <SearchIcon className="w-12 h-12 mb-5 opacity-30" aria-hidden="true" />
                <h1 className="nebula-page-title mb-3">No results found</h1>
                <p>We couldn't find anything matching <span className="text-[var(--next-text)] font-semibold">“{lastSearchQuery}”</span></p>
                <button type="button" onClick={openSearchModal} className="nebula-search-retry">
                    Try another search
                </button>
            </div>
        );
    }

    if (!lastSearchQuery) {
        return (
            <div data-nebula-view="search" data-nebula-search-state="idle" className="nebula-search-empty animate-fade-in">
                <SearchIcon className="w-12 h-12 mb-5 opacity-30" aria-hidden="true" />
                <h1 className="nebula-page-title">Search your library</h1>
            </div>
        );
    }

    const matchCount = searchResults.songs.length + searchResults.albums.length + searchResults.artists.length;
    const songs = searchResults.songs;
    const isStarred = (song: ISong) => likeOverrides[song.id] ?? !!song.starred;

    return (
        <div data-nebula-view="search" data-nebula-search-state="results" className="nebula-search-page animate-fade-in">
            <div data-nebula-view-header className="nebula-search-header">
                <h1 className="nebula-page-title">Results for “{lastSearchQuery}”</h1>
                <p className="nebula-search-count">{matchCount} {matchCount === 1 ? 'match' : 'matches'}</p>
            </div>

            {searchResults.artists.length > 0 && (
                <section className="nebula-detail-section" aria-labelledby="nebula-search-artists">
                    <h2 id="nebula-search-artists" className="nebula-section-title">Artists</h2>
                    <div data-nebula-collection-grid className={COLLECTION_GRID_CLASS}>
                        {searchResults.artists.map(artist => (
                            <ArtistCard
                                key={artist.id}
                                name={artist.name}
                                subtitle={artist.albumCount ? `${artist.albumCount} ${artist.albumCount === 1 ? 'album' : 'albums'}` : 'Artist'}
                                imageUrl={artist.coverArt ? service.getCoverArtUrl(artist.coverArt, 400) : undefined}
                                onOpen={() => setView('ARTIST_DETAIL', artist.id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {searchResults.albums.length > 0 && (
                <section className="nebula-detail-section" aria-labelledby="nebula-search-albums">
                    <h2 id="nebula-search-albums" className="nebula-section-title">Albums</h2>
                    <div data-nebula-collection-grid className={COLLECTION_GRID_CLASS}>
                        {searchResults.albums.map(album => (
                            <AlbumCard
                                key={album.id}
                                title={album.name}
                                subtitle={album.artist}
                                imageUrl={service.getCoverArtUrl(album.coverArt || album.id, 400)}
                                onOpen={() => setView('ALBUM_DETAIL', album.id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {songs.length > 0 && (
                <section className="nebula-detail-section" aria-labelledby="nebula-search-songs">
                    <h2 id="nebula-search-songs" className="nebula-section-title">Songs</h2>
                    <div data-nebula-track-ledger data-nebula-track-list className="nebula-song-list">
                        {songs.map((song, idx) => {
                            const starred = isStarred(song);
                            return <div key={song.id} data-nebula-track-row data-active={queue[currentSongIndex]?.id === song.id} className="nebula-song-row group">
                                <button type="button" data-nebula-track-play aria-label={`Play ${song.title}`} onClick={() => playSong(song, songs)} className="nebula-song-play">
                                    <span className="nebula-time">{idx + 1}</span><Play size={18} fill="currentColor" />
                                </button>
                                <img src={service.getCoverArtUrl(song.coverArt || song.id, 80)} alt="" loading="lazy" className="nebula-song-art" />
                                <div className="nebula-song-copy">
                                    <button type="button" data-nebula-track-title onClick={() => playSong(song, songs)} title={song.title}>{song.title}</button>
                                    <div><button type="button" disabled={!song.artistId} onClick={() => song.artistId && setView('ARTIST_DETAIL', song.artistId)}>{song.artist}</button>
                                        {song.album && <><span> · </span><button type="button" disabled={!song.albumId} onClick={() => song.albumId && setView('ALBUM_DETAIL', song.albumId)}>{song.album}</button></>}</div>
                                </div>
                                <span data-nebula-track-duration className="nebula-time">{Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, '0')}</span>
                                <div data-nebula-track-actions className="nebula-song-actions">
                                    {song.suffix && <span data-nebula-track-quality>{song.suffix.toUpperCase()}</span>}
                                    <button type="button" aria-label={starred ? 'Unlike song' : 'Like song'} aria-pressed={starred} onClick={() => {
                                        toggleLike({ ...song, starred });
                                        setLikeOverrides(previous => ({ ...previous, [song.id]: !starred }));
                                    }}><Heart size={18} fill={starred ? 'currentColor' : 'none'} /></button>
                                    <button type="button" aria-label="Add to playlist" onClick={() => openPlaylistModal(song)}><ListPlus size={18} /></button>
                                </div>
                            </div>;
                        })}
                    </div>
                </section>
            )}
        </div>
    );
};
