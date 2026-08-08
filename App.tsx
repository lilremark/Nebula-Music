import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StoreProvider, useStore } from './context/Store';
import { SplitLayout, TopBar } from './components/layout';
import { NavDrawer } from './components/navigation';
import { NowPlayingPanel } from './components/player/NowPlayingPanel';
import { FloatingMiniPlayer } from './components/player/FloatingMiniPlayer';
import { RadioFloatingMiniPlayer, RadioFullPlayer, RadioMobileBar, RadioSidebarPanel } from './components/radio/RadioPlayers';
import { Player } from './components/Player';
import { HomeView } from './views/Home';
import { LibraryView } from './views/Library';
import { BrowseView } from './views/Browse';
import { InternetRadioView } from './views/InternetRadio';
import { SettingsView } from './views/Settings';
import { ArtistDetailView } from './views/ArtistDetailView';
import { AlbumDetailView } from './views/AlbumDetail';
import { PlaylistDetailView } from './views/PlaylistDetail';
import { SearchView } from './views/Search';
import { PlaylistModal } from './components/PlaylistModal';
import { SearchModal } from './components/SearchModal';
import { SetupScreen } from './components/SetupScreen';
import { WhatsNewModal } from './components/WhatsNewModal';
import { MobilePlayerBar } from './components/MobilePlayerBar';
import { UpdateBanner } from './components/UpdateBanner';
import { VISUALIZER_MODES } from './types';
import { StreamDeckBridgeProvider } from './context/StreamDeckBridgeContext';
import { DesktopOwnerBridgeProvider } from './playback/ownerBridge';

const AppContent: React.FC = () => {
  const {
    currentView, setView, credentials, isDemoMode, queue, currentSongIndex,
    currentRadioStation,
    togglePlay, nextSong, prevSong, toggleRepeat, isPlaying,
    visualizerMode, setVisualizerMode, isZenMode, setZenMode,
    settings, volume, setVolume, getMostPlayedSongs, refreshMostPlayed
  } = useStore();

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const handleGlobalShortcuts = useCallback((e: KeyboardEvent) => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
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

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentView]);

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

  // Dynamic background style based on settings
  const bgStyle = {
    backgroundColor: settings.theme.backgroundColor || '#000000',
  };

  return (
    <div className="relative h-screen overflow-hidden bg-neutral-200 dark:bg-neutral-950 text-neutral-900 dark:text-white">
      {/* Navigation Drawer */}
      <NavDrawer isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />

      {/* Top-level update banner (desktop only) */}
      <UpdateBanner />

      {/* Split Screen Layout */}
      <SplitLayout
        isPlayerVisible={isPlayerVisible}
        isCollapsed={isSidebarCollapsed || useFloatingPlayer}
        rightPanel={
          useSidebarPlayer ? (
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
          (useFloatingPlayer || isSidebarCollapsed) ? (
            isRadioPlayerVisible ? (
              <RadioFloatingMiniPlayer
                onExpand={() => setIsExpanded(true)}
                onRestoreSidebar={() => {
                  if (useSidebarPlayer) setIsSidebarCollapsed(false);
                }}
              />
            ) : (
              <FloatingMiniPlayer
                onExpand={() => setIsExpanded(true)}
                onRestoreSidebar={() => {
                  if (useSidebarPlayer) setIsSidebarCollapsed(false);
                }}
              />
            )
          ) : null
        }
      >
        {/* Top Bar */}
        <header>
          <TopBar onMenuClick={() => setIsNavOpen(true)} />
        </header>

        {/* Scrollable Content */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className={`min-h-full ${isPlayerVisible ? 'pb-24 lg:pb-8' : 'pb-8'}`}>
            <ViewComponent />
          </div>
        </main>

        {/* Mobile Player Bar (shows on mobile when something is playing) */}
        {isRadioPlayerVisible ? (
          <RadioMobileBar onExpand={() => setIsExpanded(true)} />
        ) : (
          <MobilePlayerBar onExpand={() => setIsExpanded(true)} />
        )}
      </SplitLayout>

      {/* Mini Player */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${isNavOpen ? 'translate-y-full' : 'translate-y-0'} md:hidden`}>
        {isRadioPlayerVisible ? (
          <RadioMobileBar onExpand={() => setIsExpanded(true)} />
        ) : (
          <MobilePlayerBar onExpand={() => setIsExpanded(true)} />
        )}
      </div>



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
