import React, { useEffect, useRef } from 'react';
import { MOCK_PLAYLISTS, MOCK_SONGS } from '../../constants';
import { StoreProvider, useStore } from '../../context/Store';
import { StreamDeckBridgeProvider } from '../../context/StreamDeckBridgeContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { PlatformProvider } from '../../platform/PlatformContext';
import { DesktopOwnerBridgeProvider } from '../../playback/ownerBridge';
import { StudioExperience } from './StudioExperience';

function StudioDemoBootstrap() {
  const { enableDemoMode, isInitialized, performSearch, playSong, setView } = useStore();
  const enabledRef = useRef(false);
  useEffect(() => {
    if (!isInitialized || enabledRef.current) return;
    enabledRef.current = true;
    enableDemoMode();
    const params = new URLSearchParams(window.location.search);
    if (params.get('qaPlayer') === '1') {
      playSong(MOCK_SONGS[5], MOCK_SONGS);
    }
    const qaView = params.get('qaView');
    if (qaView === 'album') {
      setView('ALBUM_DETAIL', 'al4', { clearHistory: true });
    } else if (qaView === 'playlist') {
      setView('PLAYLIST_DETAIL', MOCK_PLAYLISTS[0].id, { clearHistory: true });
    } else if (qaView === 'artist') {
      setView('ARTIST_DETAIL', 'ar1', { clearHistory: true });
    } else if (qaView === 'search') {
      void performSearch('Neon');
    } else {
      const routedViews = {
        settings: 'SETTINGS',
        browse: 'BROWSE',
        radio: 'RADIO',
        artists: 'ARTISTS',
        albums: 'ALBUMS',
        songs: 'SONGS',
        playlists: 'PLAYLISTS',
        'liked-songs': 'LIKED_SONGS',
        'liked-albums': 'LIKED_ALBUMS',
      } as const;
      const routedView = qaView ? routedViews[qaView as keyof typeof routedViews] : undefined;
      if (routedView) setView(routedView, undefined, { clearHistory: true });
    }
  }, [enableDemoMode, isInitialized, performSearch, playSong, setView]);
  return <StudioChrome><StudioExperience /></StudioChrome>;
}

function StudioChrome({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

/** A full Nebula session wired to preview-only persistence and fixture audio. */
export function StudioApp() {
  return <div className="studio-app" data-studio="interactive-preview">
    <PlatformProvider><ThemeProvider><StoreProvider previewPlaylistStorageKey="nebula_studio_preview_playlists"><DesktopOwnerBridgeProvider><StreamDeckBridgeProvider>
      <div className="studio-stage"><StudioDemoBootstrap /></div>
    </StreamDeckBridgeProvider></DesktopOwnerBridgeProvider></StoreProvider></ThemeProvider></PlatformProvider>
  </div>;
}
