import type React from 'react';
import type { IPlaylist, ISong } from '../types';
import { commandFailure } from './streamDeckBridge';
import type { StreamDeckCommand } from './streamDeckProtocol';

export interface StreamDeckCommandDependencies {
  getState: () => {
    isPlaying: boolean;
    playlists: IPlaylist[];
  };
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  setVolume: (value: number) => void;
  playSong: (song: ISong, queue: ISong[]) => void;
  getPlaylist: (id: string) => Promise<IPlaylist | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  waitForCommit?: () => Promise<void>;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const createStreamDeckCommandHandler =
  (dependencies: StreamDeckCommandDependencies) =>
  async (command: StreamDeckCommand): Promise<void> => {
    const waitForCommit =
      dependencies.waitForCommit ??
      (() =>
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 0);
        }));
    const state = dependencies.getState();
    switch (command.name) {
      case 'setPlayback':
        if (state.isPlaying !== command.playing) {
          dependencies.togglePlay();
          await waitForCommit();
        }
        return;
      case 'togglePlayback':
        dependencies.togglePlay();
        await waitForCommit();
        return;
      case 'previous':
        dependencies.prevSong();
        await waitForCommit();
        return;
      case 'next':
        dependencies.nextSong();
        await waitForCommit();
        return;
      case 'setVolume':
        dependencies.setVolume(clamp(command.volume, 0, 1));
        await waitForCommit();
        return;
      case 'seekRelative': {
        const audio = dependencies.audioRef.current;
        if (!audio) throw commandFailure('playback_failed', 'No active track is available.');
        const duration = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
        audio.currentTime = clamp(audio.currentTime + command.seconds, 0, duration);
        return;
      }
      case 'startPlaylist': {
        const summary = state.playlists.find(
          (playlist) => playlist.id === command.playlistId,
        );
        if (!summary) {
          throw commandFailure('stale_playlist', 'The selected playlist no longer exists.');
        }
        const playlist =
          summary.songs?.length || summary.id.startsWith('local-')
            ? summary
            : await dependencies.getPlaylist(summary.id);
        if (!playlist) {
          throw commandFailure('stale_playlist', 'The selected playlist could not be loaded.');
        }
        if (!playlist.songs?.length) {
          throw commandFailure('empty_playlist', 'The selected playlist is empty.');
        }
        dependencies.playSong(playlist.songs[0], playlist.songs);
        await waitForCommit();
      }
    }
  };
