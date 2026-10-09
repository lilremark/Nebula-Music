import { DjCover } from './components/player/DjCover';
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
import { useAdaptiveColors } from './hooks/useAdaptiveColors';
import { PlaybackProgress } from './components/player/PlaybackProgress';
import { PlatformProvider, usePlatform } from './platform/PlatformContext';
import { createCommandClient } from './playback/commandClient';
import type { DesktopSnapshot, DesktopUpcomingTrack } from './playback/desktopProtocol';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
  ({ WebkitAppRegion: region }) as CSSProperties;

const formatDuration = (seconds: number, fallback = '--:--'): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
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
  const [energy, setEnergy] = useState(0);
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

  useEffect(() => platform?.playback.onDjEnergy?.(setEnergy), [platform]);
  useEffect(() => { if (!snapshot?.dj?.playing) setEnergy(0); }, [snapshot?.dj?.playing]);
  const speech = !!snapshot?.dj?.speech;
  const [displayProgress, setDisplayProgress] = useState(0);
  const { colors } = useAdaptiveColors(snapshot?.track?.coverArtUrl);

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
        snap?.dj?.speech && snap.dj.duration > 0 ? Math.min(100, snap.dj.position / snap.dj.duration * 100)
          : snap && snap.durationSeconds > 0
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
  const title = speech ? 'AI DJ' : track ? track.title : snapshot?.playing ? 'Playing…' : 'Not playing';
  const subtitle = speech ? snapshot?.dj?.preview ? 'Voice preview' : snapshot?.dj?.playing ? 'Introducing your next set' : 'DJ paused' : track?.artist ?? 'Nebula Music';
  const position = speech ? snapshot?.dj?.position ?? 0 : track ? snapshot?.positionSeconds ?? 0 : 0;
  const duration = speech ? snapshot?.dj?.duration ?? 0 : track ? snapshot?.durationSeconds ?? 0 : 0;

  return (
    <div className="nebula-mini">
      <div className="nebula-dj-haze" data-speaking={speech} aria-hidden="true" />
      {/* Compact now-playing bar */}
      <div className="nebula-mini-header" style={appRegion('drag')}>
        <div className="nebula-mini-track">
          <div className="nebula-mini-art">{speech ? <DjCover playing={!!snapshot?.dj?.playing} energy={energy} /> : <Art url={track?.coverArtUrl} size="h-12 w-12" />}</div>

          <div className="nebula-mini-copy">
            {snapshot?.dj?.active && <span className="nebula-dj-badge">AI DJ</span>}
            <p className="nebula-mini-title" title={title}>{title}</p>
            <p className="nebula-mini-subtitle" title={subtitle}>{subtitle}</p>
            {!speech && track?.album && <p className="nebula-mini-album" title={track.album}>{track.album}</p>}
          </div>
          <button type="button" onClick={() => void platform?.miniPlayer.showMain()}
            className="nebula-mini-icon" style={appRegion('no-drag')}
            aria-label="Open Nebula window" title="Open Nebula window">
            <ExternalLink size={16} />
          </button>
        </div>
        <div className="nebula-mini-bottom">
          <div className="nebula-mini-progress">
            <PlaybackProgress progress={track || speech ? displayProgress : 0} mode="bar" accentColor={colors.primary}
              secondaryColor={colors.secondary} markerColor={colors.secondary} baseColor="rgba(255,255,255,.1)"
              scrubbable={false} showHandle trackClassName="nebula-mini-progress-track" />
            <div className="nebula-mini-times"><span>{formatDuration(position, '0:00')}</span><span>{formatDuration(duration)}</span></div>
          </div>

          {/* Transport controls */}
          <div className="nebula-mini-controls" style={appRegion('no-drag')}>
            <button
              type="button"
              onClick={() => send('previous')}
              className="nebula-mini-icon nebula-mini-skip"
              aria-label="Previous track"
            >
              <SkipBack size={20} />
            </button>
            <button
              type="button"
              onClick={() => send(snapshot?.playing ? 'setPlayback' : 'togglePlayback')}
              className="nebula-mini-play"
              aria-label={snapshot?.playing ? 'Pause' : 'Play'}
            >
              {snapshot?.playing ? (
                <Pause size={20} />
              ) : (
                <Play className="ml-0.5" size={20} />
              )}
            </button>
            <button
              type="button"
              onClick={() => send('next')}
              className="nebula-mini-icon nebula-mini-skip"
              aria-label="Next track"
            >
              <SkipForward size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Up Next list */}
      {upcoming.length > 0 && (
        <section className="nebula-mini-queue">
          <div className="nebula-mini-queue-heading">
            <h2>Up Next</h2>
            <span>{upcoming.length} {upcoming.length === 1 ? 'track' : 'tracks'}</span>
          </div>
          <div className="nebula-mini-queue-list custom-scrollbar" aria-label="Up next">
            {upcoming.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                onClick={() => jumpTo(index)}
                style={appRegion('no-drag')}
                className="nebula-mini-queue-item"
                title={`Play "${item.title}"`}
              >
                <Art url={item.coverArtUrl} size="h-8 w-8" />
                <span className="nebula-mini-copy">
                  <span className="nebula-mini-title">
                    {item.title}
                  </span>
                  <span className="nebula-mini-subtitle">
                    {item.artist}
                    {item.album ? ` — ${item.album}` : ''}
                  </span>
                </span>
                <span className="nebula-mini-duration">
                  {formatDuration(item.durationSeconds)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {upcoming.length === 0 && <div className="nebula-mini-empty"><Music2 size={22} aria-hidden="true" /><strong>Nothing queued</strong><span>Your upcoming tracks will appear here.</span></div>}
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
