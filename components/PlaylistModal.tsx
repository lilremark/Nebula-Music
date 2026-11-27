import React, { useState } from 'react';
import { useStore } from '../context/Store';
import { Plus, X, ListMusic } from 'lucide-react';

// Surface, header, footer and buttons come from the shared .nebula-modal /
// .nebula-control-* styles in next-ui.css.
export const PlaylistModal: React.FC = () => {
  const { modalOpen, closePlaylistModal, playlists, createPlaylist, addSongToPlaylist, songToAddToPlaylist } = useStore();
  const [newPlaylistName, setNewPlaylistName] = useState('');

  if (!modalOpen || !songToAddToPlaylist) return null;

  const handleCreate = () => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName);
      setNewPlaylistName('');
    }
  };

  const handleSelect = (id: string) => {
    addSongToPlaylist(id, songToAddToPlaylist);
    closePlaylistModal();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="nebula-modal-scrim animate-fade-in" onClick={closePlaylistModal} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-modal-title"
        className="nebula-modal relative w-full max-w-md max-h-[calc(100dvh-2rem)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nebula-modal-header">
          <div className="nebula-modal-heading">
            <h2 id="playlist-modal-title" className="nebula-modal-title">Add to Playlist</h2>
            <p className="nebula-modal-subtitle">{songToAddToPlaylist.title}</p>
          </div>
          <button
            type="button"
            onClick={closePlaylistModal}
            className="nebula-modal-close"
            aria-label="Close playlist modal"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        {/* Create New */}
        <div className="flex gap-2 border-b border-[var(--next-line)] px-5 py-4">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New playlist name..."
            aria-label="New playlist name"
            className="nebula-control-input min-w-0 flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newPlaylistName.trim()}
            className="nebula-control-button"
            aria-label="Create playlist"
          >
            <Plus aria-hidden="true" />
            Create
          </button>
        </div>

        {/* Playlist List */}
        <div className="nebula-modal-body custom-scrollbar max-h-[300px]">
          {playlists.length === 0 ? (
            <div className="py-12 text-center text-[var(--next-muted)]">
              <ListMusic className="mx-auto mb-3 h-10 w-10 opacity-60" aria-hidden="true" />
              <p className="text-sm">No playlists yet</p>
              <p className="mt-1 text-xs">Create one above</p>
            </div>
          ) : (
            <div className="p-2">
              {playlists.map((pl) => (
                <button
                  type="button"
                  key={pl.id}
                  onClick={() => handleSelect(pl.id)}
                  className="nebula-modal-list-item group"
                >
                  <span className="nebula-modal-thumb">
                    <ListMusic aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--next-text)]">{pl.name}</span>
                    <span className="nebula-time block text-xs text-[var(--next-muted)]">{pl.songCount} {pl.songCount === 1 ? 'song' : 'songs'}</span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-[var(--next-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="nebula-modal-footer">
          <button
            type="button"
            onClick={closePlaylistModal}
            className="nebula-control-button"
            data-variant="quiet"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
