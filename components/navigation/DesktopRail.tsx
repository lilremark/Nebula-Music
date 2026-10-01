import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Compass, Disc3, Heart, Home, ListMusic, Mic2, Moon, Music2, Radio, Search, Settings, Sun } from 'lucide-react';
import { useStore } from '../../context/Store';
import { useTheme } from '../../context/ThemeContext';
import type { View } from '../../types';

const sections = [
  { title: 'Your Library', items: [
    { view: 'ARTISTS', label: 'Artists', icon: Mic2, flag: 'showArtists' },
    { view: 'ALBUMS', label: 'Albums', icon: Disc3, flag: 'showAlbums' },
    { view: 'SONGS', label: 'Songs', icon: Music2, flag: 'showSongs' },
    { view: 'PLAYLISTS', label: 'Playlists', icon: ListMusic, flag: 'showPlaylists' },
    { view: 'LIKED_SONGS', label: 'Liked Songs', icon: Heart },
    { view: 'LIKED_ALBUMS', label: 'Liked Albums', icon: Disc3 },
  ] },
] as const;

const parentView = (view: View): View => {
  if (view === 'ARTIST_DETAIL') return 'ARTISTS';
  if (view === 'ALBUM_DETAIL') return 'ALBUMS';
  if (view === 'PLAYLIST_DETAIL') return 'PLAYLISTS';
  return view;
};

export const DesktopRail: React.FC = () => {
  const { currentView, setView, openSearchModal, settings, credentials, isDemoMode, service, playlists } = useStore();
  const { mode, toggleTheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const visibleSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => !('flag' in item) || settings.sidebar[item.flag]),
  })).filter(section => section.items.length);
  const listenItems = [
    { view: 'HOME', label: 'Listen Now', icon: Home, flag: settings.sidebar.showHome },
    { view: 'BROWSE', label: 'Browse', icon: Compass, flag: settings.sidebar.showBrowse },
    { view: 'RADIO', label: 'Internet Radio', icon: Radio, flag: settings.sidebar.showRadio },
  ] as const;

  const navButton = (item: { view: View; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }> }) => {
    const Icon = item.icon;
    const active = parentView(currentView) === item.view;
    return <button key={item.view} type="button" className="nebula-rail-item" data-active={active} aria-current={active ? 'page' : undefined} onClick={() => setView(item.view)}>
      {active && <motion.span className="nebula-rail-active" layoutId="nebula-rail-active" transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }} />}
      <Icon size={19} strokeWidth={1.9} aria-hidden />
      <span>{item.label}</span>
    </button>;
  };

  return <aside className="nebula-rail" aria-label="Music navigation">
    <button type="button" className="nebula-rail-brand" onClick={() => setView('HOME')} aria-label="Nebula Home">
      <span className="nebula-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span><strong>Nebula</strong><small>Your music, your server</small></span>
    </button>
    <div className="nebula-rail-scroll">
      <nav aria-label="Discover" className="nebula-rail-section">
        <h2>Discover</h2>
        {listenItems.filter(item => item.flag).map(navButton)}
        <button type="button" className="nebula-rail-item" onClick={openSearchModal}><Search size={19} strokeWidth={1.9} aria-hidden /><span>Search</span></button>
      </nav>
      {visibleSections.map(section => <nav key={section.title} aria-label={section.title} className="nebula-rail-section">
        <h2>{section.title}</h2>
        {section.items.map(navButton)}
      </nav>)}
      {settings.sidebar.showPlaylists && playlists.length > 0 && <nav aria-label="Your playlists" className="nebula-rail-section nebula-rail-playlists">
        <h2>Playlists</h2>
        {playlists.slice(0, 8).map(playlist => <button key={playlist.id} type="button" className="nebula-rail-playlist" onClick={() => setView('PLAYLIST_DETAIL', playlist.id)}>
          {playlist.coverArt ? <img src={service.getCoverArtUrl(playlist.coverArt, 48)} alt="" /> : <span><ListMusic size={15} aria-hidden /></span>}
          <span title={playlist.name}>{playlist.name}</span>
        </button>)}
      </nav>}
    </div>
    <div className="nebula-rail-footer">
      <button type="button" className="nebula-rail-item" data-active={currentView === 'SETTINGS'} onClick={() => setView('SETTINGS')}><Settings size={19} strokeWidth={1.9} aria-hidden="true" /><span>Settings</span></button>
      <button type="button" className="nebula-rail-item" onClick={toggleTheme} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}>
        {mode === 'dark' ? <Sun size={19} strokeWidth={1.9} aria-hidden="true" /> : <Moon size={19} strokeWidth={1.9} aria-hidden="true" />}
        <span>{mode === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
      </button>
      <div className="nebula-rail-status"><span />{isDemoMode ? 'Demo library' : credentials ? 'Connected to server' : 'Offline'}</div>
    </div>
  </aside>;
};
