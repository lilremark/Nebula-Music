import React, { Suspense, lazy, useState, useEffect, useCallback, useRef } from 'react';
import { StoreProvider, useStore } from './context/Store';
import { SplitLayout, TopBar, MacTitleBar, WindowsTitleBar } from './components/layout';
import { NavDrawer } from './components/navigation';
import { DesktopRail } from './components/navigation/DesktopRail';
import { BlurFade } from './components/vendor/magic-blur-fade';
import { NowPlayingPanel } from './components/player/NowPlayingPanel';
import { FloatingMiniPlayer } from './components/player/FloatingMiniPlayer';
import { DesktopPlaybackBar } from './components/player/DesktopPlaybackBar';
import { RadioFloatingMiniPlayer, RadioFullPlayer, RadioMobileBar, RadioSidebarPanel } from './components/radio/RadioPlayers';
import { Player } from './components/Player';
import { PlaylistModal } from './components/PlaylistModal';
import { SearchModal } from './components/SearchModal';
import { SetupScreen } from './components/SetupScreen';
import { WhatsNewModal } from './components/WhatsNewModal';
import { MobilePlayerBar } from './components/MobilePlayerBar';
import { UpdateBanner } from './components/UpdateBanner';
import { DjSpeechPlayer } from './components/DjSpeechPlayer';
import { VISUALIZER_MODES } from './types';
import { StreamDeckBridgeProvider } from './context/StreamDeckBridgeContext';
import { DesktopOwnerBridgeProvider } from './playback/ownerBridge';
import { usePlatform } from './platform/PlatformContext';
import { NebulaDesignPrototype } from './components/design-prototype/NebulaDesignPrototype';
import { ViewErrorBoundary } from './components/ViewErrorBoundary';

// Keep the playback owner and controls mounted while loading only the view
// being visited. Library and settings code need not delay first paint.
const HomeView = lazy(() => import('./views/Home').then(module => ({ default: module.HomeView })));
const LibraryView = lazy(() => import('./views/Library').then(module => ({ default: module.LibraryView })));
const BrowseView = lazy(() => import('./views/Browse').then(module => ({ default: module.BrowseView })));
const InternetRadioView = lazy(() => import('./views/InternetRadio').then(module => ({ default: module.InternetRadioView })));
const SettingsView = lazy(() => import('./views/Settings').then(module => ({ default: module.SettingsView })));
const ArtistDetailView = lazy(() => import('./views/ArtistDetailView').then(module => ({ default: module.ArtistDetailView })));
const AlbumDetailView = lazy(() => import('./views/AlbumDetail').then(module => ({ default: module.AlbumDetailView })));
const PlaylistDetailView = lazy(() => import('./views/PlaylistDetail').then(module => ({ default: module.PlaylistDetailView })));
const SearchView = lazy(() => import('./views/Search').then(module => ({ default: module.SearchView })));

/**
 * The production shell is also composed by the isolated Studio preview.  The
 * default drawer preserves the desktop application's behaviour; Studio opts
 * into its accessible preview drawer without forking any view or player code.
 */
export const AppContent: React.FC<{
  navDrawer?: React.ComponentType<{ isOpen: boolean; onClose: () => void }>;
  initialSidebarCollapsed?: boolean;
  initialPlayerExpanded?: boolean;
}> = ({ navDrawer: Drawer = NavDrawer, initialSidebarCollapsed = true, initialPlayerExpanded = false }) => {
  const {
    currentView, setView, viewData, credentials, isDemoMode, queue, currentSongIndex,
    currentRadioStation,
    togglePlay, nextSong, prevSong, toggleRepeat, isPlaying,
    visualizerMode, setVisualizerMode, isZenMode, setZenMode,
    settings, updateSettings, volume, setVolume, getMostPlayedSongs, refreshMostPlayed
  } = useStore();

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialPlayerExpanded);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  // Development-only concept lab. It is intentionally isolated from the
  // production app so visual exploration cannot alter playback behavior.
  const showDesignPrototype = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('designPrototype') === '1';

  if (showDesignPrototype) {
    return <NebulaDesignPrototype />;
  }

  const handleGlobalShortcuts = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // Range inputs own their arrow keys. Handling them here as volume
    // shortcuts makes keyboard slider adjustment apply twice.
    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const { shortcuts } = settings;
    const key = e.key;

    if (key === 'Escape') {
      if (isZenMode) setZenMode(false);
      else if (isExpanded) setIsExpanded(false);
      else if (isNavOpen) setIsNavOpen(false);
      return;
    }

    if (key === shortcuts.playPause || key === 'MediaPlayPause') {
      e.preventDefault();
      togglePlay();
    } else if (key === shortcuts.next || key === 'MediaTrackNext') {
      e.preventDefault();
      nextSong();
    } else if (key === shortcuts.prev || key === 'MediaTrackPrevious') {
      e.preventDefault();
      prevSong();
    } else if (key === 'MediaStop') {
      e.preventDefault();
      if (isPlaying) togglePlay();
    } else if (key === shortcuts.loop) {
      toggleRepeat();
    } else if (key === shortcuts.zen) {
      setZenMode(!isZenMode);
    } else if (key === shortcuts.visualizer) {
      const nextIndex = (VISUALIZER_MODES.indexOf(visualizerMode) + 1) % VISUALIZER_MODES.length;
      setVisualizerMode(VISUALIZER_MODES[nextIndex]);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      setVolume(Math.min(1, volume + 0.05));
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      setVolume(Math.max(0, volume - 0.05));
    }
  }, [settings, togglePlay, nextSong, prevSong, toggleRepeat, visualizerMode, setVisualizerMode, isZenMode, setZenMode, isPlaying, volume, setVolume, isExpanded, isNavOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleGlobalShortcuts]);

  // Scroll to top on navigation. The view alone is not enough: clicking a
  // related album in "More by" keeps the same view and only changes viewData,
  // so the effect must also key off viewData to land on the new album's header.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentView, viewData]);

  const platform = usePlatform();

  useEffect(() => {
    if (!platform) return;
    return platform.app.onOpenSettings(() => setView('SETTINGS'));
  }, [platform, setView]);

  if (!credentials && !isDemoMode) {
    return <SetupScreen />;
  }

  let ViewComponent;
  switch (currentView) {
    case 'HOME': ViewComponent = HomeView; break;
    case 'BROWSE': ViewComponent = BrowseView; break;
    case 'RADIO': ViewComponent = InternetRadioView; break;
    case 'SETTINGS': ViewComponent = SettingsView; break;
    case 'ARTISTS':
    case 'ALBUMS':
    case 'SONGS':
    case 'PLAYLISTS':
    case 'LIKED_SONGS':
    case 'LIKED_ALBUMS': ViewComponent = LibraryView; break;
    case 'ARTIST_DETAIL': ViewComponent = ArtistDetailView; break;
    case 'ALBUM_DETAIL': ViewComponent = AlbumDetailView; break;
    case 'PLAYLIST_DETAIL': ViewComponent = PlaylistDetailView; break;
    case 'SEARCH': ViewComponent = SearchView; break;
    default: ViewComponent = HomeView;
  }

  const isMusicPlayerVisible = queue.length > 0 && currentSongIndex >= 0;
  const isRadioPlayerVisible = !!currentRadioStation;
  const isPlayerVisible = isMusicPlayerVisible || isRadioPlayerVisible;

  // Determine player display mode based on settings
  const useSidebarPlayer = settings.miniPlayerMode === 'sidebar';
  const useFloatingPlayer = settings.miniPlayerMode === 'floating';
  const showSidebarPlayer = viewportWidth >= 1320 && useSidebarPlayer && !isSidebarCollapsed;
  const showFloatingPlayer = viewportWidth >= 1024 && useFloatingPlayer;
  const showDesktopPlaybackBar = viewportWidth >= 1024 && useSidebarPlayer && isPlayerVisible;

  return (
    <div className="nebula-next relative flex h-screen flex-col overflow-hidden bg-neutral-200 dark:bg-neutral-950 text-neutral-900 dark:text-white">
      <WindowsTitleBar />
      <MacTitleBar />

      {/* Navigation Drawer */}
      {isNavOpen && <Drawer isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />}

      {/* Top-level update banner (desktop only) */}
      <UpdateBanner />

      {/* Split Screen Layout */}
      <div className="flex-1 min-h-0">
        <SplitLayout
        leftPanel={<DesktopRail />}
        isPlayerVisible={isPlayerVisible}
        isCollapsed={isSidebarCollapsed || useFloatingPlayer}
        rightPanel={
          showSidebarPlayer ? (
            isRadioPlayerVisible ? (
              <RadioSidebarPanel
                onExpand={() => setIsExpanded(true)}
                onCollapse={() => setIsSidebarCollapsed(true)}
              />
            ) : (
              <NowPlayingPanel
                onExpand={() => setIsExpanded(true)}
                onCollapse={() => setIsSidebarCollapsed(true)}
              />
            )
          ) : null
        }
        floatingPlayer={
          showFloatingPlayer ? (
            isRadioPlayerVisible ? (
              <RadioFloatingMiniPlayer
                onExpand={() => setIsExpanded(true)}
                onRestoreSidebar={() => {
                  updateSettings({ miniPlayerMode: 'sidebar' });
                  setIsSidebarCollapsed(false);
                }}
              />
            ) : (
              <FloatingMiniPlayer
                onExpand={() => setIsExpanded(true)}
                onRestoreSidebar={() => {
                  updateSettings({ miniPlayerMode: 'sidebar' });
                  setIsSidebarCollapsed(false);
                }}
              />
            )
          ) : null
        }
      >
        {/* Top Bar */}
        <header className="flex flex-col shrink-0">
          <TopBar onMenuClick={() => setIsNavOpen(true)} isNavOpen={isNavOpen} />
        </header>

        {/* Scrollable Content */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className={`min-h-full ${isPlayerVisible ? 'pb-24 lg:pb-8' : 'pb-8'}`}>
            <BlurFade key={`${currentView}-${String(viewData ?? '')}`} duration={0.3} blur="4px" offset={10}>
              <ViewErrorBoundary key={currentView}>
                <Suspense fallback={<div className="p-8 text-neutral-500" role="status">Loading view…</div>}>
                  <ViewComponent />
                </Suspense>
              </ViewErrorBoundary>
            </BlurFade>
          </div>
        </main>

      </SplitLayout>
      </div>

      {showDesktopPlaybackBar && <DesktopPlaybackBar
        onExpand={() => setIsExpanded(true)}
        panelOpen={showSidebarPlayer}
        onTogglePanel={() => viewportWidth < 1320 ? setIsExpanded(true) : setIsSidebarCollapsed(value => !value)}
      />}

      {/* Mini Player */}
      {!isNavOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          {isRadioPlayerVisible ? (
            <RadioMobileBar onExpand={() => setIsExpanded(true)} />
          ) : (
            <MobilePlayerBar onExpand={() => setIsExpanded(true)} />
          )}
        </div>
      )}



      {/* Full Screen Player (expanded mode) */}
      {isRadioPlayerVisible ? (
        <RadioFullPlayer isExpanded={isExpanded} onClose={() => setIsExpanded(false)} />
      ) : (
        <Player isExpanded={isExpanded} onClose={() => setIsExpanded(false)} />
      )}

      {/* Modals */}
      <PlaylistModal />
      <SearchModal />
      <WhatsNewModal />
      <DjSpeechPlayer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <DesktopOwnerBridgeProvider>
        <StreamDeckBridgeProvider>
          <AppContent />
        </StreamDeckBridgeProvider>
      </DesktopOwnerBridgeProvider>
    </StoreProvider>
  );
};

export default App;
