import type { CSSProperties } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, SkipBack, SkipForward, ExternalLink } from 'lucide-react';
import { PlatformProvider, usePlatform } from './platform/PlatformContext';
import { createCommandClient } from './playback/commandClient';
import type { DesktopSnapshot } from './playback/desktopProtocol';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
  ({ WebkitAppRegion: region }) as CSSProperties;

/**
 * The native mini-player window: a small always-on-top remote client. It is
 * *not* a playback owner; it subscribes to snapshots broadcast by the owner
 * bridge (via the main process) and sends transport commands through the same
 * desktop playback protocol used by the tray and media keys.
 */
const MiniPlayerContent: React.FC = () => {
  const platform = usePlatform();
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const clientRef = useRef(
    createCommandClient('nebula-mini-player', () => snapshotRef.current?.epoch ?? 0),
  );

  useEffect(() => {
    if (!platform) return;
    return platform.playback.onSnapshot(setSnapshot);
  }, [platform]);

  const send = (name: 'togglePlayback' | 'next' | 'previous' | 'setPlayback') => {
    platform?.playback.sendCommand(
      clientRef.current.send(
        name === 'setPlayback' ? { name, playing: !snapshotRef.current?.playing } : { name },
      ),
    );
  };

  const track = snapshot?.track ?? null;
  const progress =
    snapshot && snapshot.durationSeconds > 0
      ? Math.min(100, (snapshot.positionSeconds / snapshot.durationSeconds) * 100)
      : 0;

  return (
    <div
      className="flex h-full w-full select-none items-center gap-3 bg-neutral-900/95 px-3"
      style={appRegion('drag')}
    >
      {/* Track info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">
          {track ? track.title : snapshot?.playing ? 'Playing…' : 'Not playing'}
        </p>
        <p className="truncate text-xs text-white/50">
          {track ? `${track.artist}${track.album ? ` — ${track.album}` : ''}` : 'Nebula Music'}
        </p>
        <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-500 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-1" style={appRegion('no-drag')}>
        <button
          type="button"
          onClick={() => send('previous')}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Previous track"
        >
          <SkipBack className="h-4 w-4" fill="currentColor" />
        </button>
        <button
          type="button"
          onClick={() => send(snapshot?.playing ? 'setPlayback' : 'togglePlayback')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 text-black transition-transform hover:scale-105 active:scale-95"
          aria-label={snapshot?.playing ? 'Pause' : 'Play'}
        >
          {snapshot?.playing ? (
            <Pause className="h-4 w-4" fill="black" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" fill="black" />
          )}
        </button>
        <button
          type="button"
          onClick={() => send('next')}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Next track"
        >
          <SkipForward className="h-4 w-4" fill="currentColor" />
        </button>
        <button
          type="button"
          onClick={() => void platform?.miniPlayer.showMain()}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Open Nebula window"
          title="Open Nebula window"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const MiniPlayerApp: React.FC = () => (
  <PlatformProvider>
    <MiniPlayerContent />
  </PlatformProvider>
);

const rootElement = document.getElementById('mini-player-root');
if (!rootElement) {
  throw new Error('Could not find mini-player root element to mount to');
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <MiniPlayerApp />
  </React.StrictMode>,
);
