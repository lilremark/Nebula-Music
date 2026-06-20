import React, { useState } from 'react';
import { useStore } from '../context/Store';
import { Plus, X, ListMusic, Music } from 'lucide-react';

export const PlaylistModal: React.FC = () => {
  const { modalOpen, closePlaylistModal, playlists, createPlaylist, addSongToPlaylist, songToAddToPlaylist, service } = useStore();
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-neutral-900/40 dark:bg-black/80 backdrop-blur-xs animate-fade-in"
        onClick={closePlaylistModal}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-md bg-white/95 dark:bg-neutral-900/98 backdrop-blur-2xl border border-neutral-200 dark:border-white/5 rounded-2xl shadow-2xl pointer-events-auto animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-white/5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">Add to Playlist</h2>
                <p className="text-xs text-neutral-600 dark:text-white/50 truncate">{songToAddToPlaylist.title}</p>
              </div>
            </div>
            <button
              onClick={closePlaylistModal}
              className="p-2 rounded-lg hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 transition dark:hover:bg-white/10 dark:text-white/50 dark:hover:text-white"
              aria-label="Close playlist modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Create New */}
          <div className="p-4 border-b border-neutral-200 dark:border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="New playlist name..."
                className="flex-1 bg-white border border-neutral-300 rounded-lg px-4 py-2.5 text-sm text-neutral-900 
                        placeholder:text-neutral-500 focus:border-primary/60 focus:outline-hidden transition
                        dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/30 dark:focus:border-white/20"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button
                onClick={handleCreate}
                disabled={!newPlaylistName.trim()}
                className="px-4 py-2.5 bg-primary text-black font-semibold rounded-lg text-sm
                        hover:bg-primary/90 transition disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Create playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Playlist List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {playlists.length === 0 ? (
              <div className="text-center text-neutral-600 dark:text-white/60 py-12">
                <ListMusic className="w-10 h-10 mx-auto mb-3 opacity-60" />
                <p className="text-sm">No playlists yet</p>
                <p className="text-xs mt-1">Create one above</p>
              </div>
            ) : (
              <div className="p-2">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleSelect(pl.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 transition text-left group dark:hover:bg-white/5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                      <ListMusic className="w-5 h-5 text-neutral-600 group-hover:text-neutral-900 transition dark:text-white/50 dark:group-hover:text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-white truncate text-sm">{pl.name}</p>
                      <p className="text-xs text-neutral-600 dark:text-white/60">{pl.songCount} {pl.songCount === 1 ? 'song' : 'songs'}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-100 text-neutral-600 group-hover:bg-primary group-hover:text-black transition dark:bg-white/5 dark:text-white/60">
                      <Plus className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-200 dark:border-white/5">
            <button
              onClick={closePlaylistModal}
              className="w-full py-2.5 text-sm text-neutral-600 hover:text-neutral-900 transition dark:text-white/50 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
};

