import type { CSSProperties } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ExternalLink,
  Music2,
} from 'lucide-react';
import { PlatformProvider, usePlatform } from './platform/PlatformContext';
import { createCommandClient } from './playback/commandClient';
import type { DesktopSnapshot, DesktopUpcomingTrack } from './playback/desktopProtocol';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
  ({ WebkitAppRegion: region }) as CSSProperties;

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const EmptyArt = ({ size }: { size: string }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-white/30 ${size}`}
  >
    <Music2 className="h-1/2 w-1/2" />
  </span>
);

const Art = ({ url, size }: { url?: string; size: string }) =>
  url ? (
    <img src={url} alt="" draggable={false} className={`shrink-0 rounded-lg object-cover ${size}`} />
  ) : (
    <EmptyArt size={size} />
  );

/**
 * The native mini-player window: a small always-on-top remote client. It is
 * *not* a playback owner; it subscribes to snapshots broadcast by the owner
 * bridge (via the main process) and sends transport commands through the same
 * desktop playback protocol used by the tray and media keys.
 *
 * Layout: a compact now-playing bar (album art, title, progress, transport)
 * with an "Up Next" queue list below showing the next few tracks.
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

  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // Skip work while hidden (backgroundThrottling is disabled, so the frame
      // loop keeps firing even when the mini-player is hidden).
      if (document.visibilityState !== 'visible') return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const snap = snapshotRef.current;
      const target =
        snap && snap.durationSeconds > 0
          ? Math.min(100, (snap.positionSeconds / snap.durationSeconds) * 100)
          : 0;
      setDisplayProgress((prev) => {
        // Bail out (React skips the re-render) once converged, so a paused
        // mini-player does not re-render at 60fps forever.
        if (Math.abs(target - prev) < 0.01) return prev;
        const next = prev + (target - prev) * Math.min(1, dt * 6);
        return Math.abs(next - prev) < 0.01 ? prev : next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (name: 'togglePlayback' | 'next' | 'previous' | 'setPlayback') => {
    platform?.playback.sendCommand(
      clientRef.current.send(
        name === 'setPlayback' ? { name, playing: !snapshotRef.current?.playing } : { name },
      ),
    );
  };

  const jumpTo = (index: number) => {
    platform?.playback.sendCommand(clientRef.current.send({ name: 'playQueueIndex', index }));
  };

  const track = snapshot?.track ?? null;
  const upcoming: DesktopUpcomingTrack[] = snapshot?.upcoming ?? [];

  return (
    <div className="flex h-full w-full flex-col select-none overflow-hidden bg-neutral-900/95">
      {/* Compact now-playing bar */}
      <div className="flex items-center gap-3 px-3 py-2.5" style={appRegion('drag')}>
        <Art url={track?.coverArtUrl} size="h-12 w-12" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {track ? track.title : snapshot?.playing ? 'Playing…' : 'Not playing'}
          </p>
          <p className="truncate text-xs text-white/50">
            {track ? `${track.artist}${track.album ? ` — ${track.album}` : ''}` : 'Nebula Music'}
          </p>
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-500 transition-[width] duration-200"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-0.5" style={appRegion('no-drag')}>
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

      {/* Up Next list */}
      {upcoming.length > 0 && (
        <div className="border-t border-white/10 bg-neutral-950/60">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              Up Next
            </span>
            <span className="text-[10px] font-semibold text-cyan-400">{upcoming.length} tracks</span>
          </div>
          <div className="max-h-[168px] overflow-y-auto pb-1.5">
            {upcoming.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpTo(index)}
                style={appRegion('no-drag')}
                className="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/5"
                title={`Play "${item.title}"`}
              >
                <Art url={item.coverArtUrl} size="h-8 w-8" />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-xs ${
                      index === 0
                        ? 'font-semibold text-cyan-400'
                        : 'font-medium text-white/90'
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="block truncate text-[11px] text-white/40">
                    {item.artist}
                    {item.album ? ` — ${item.album}` : ''}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/35">
                  {formatDuration(item.durationSeconds)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
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
