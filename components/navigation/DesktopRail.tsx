import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Compass, Disc3, Heart, Home, ListMusic, Mic2, Music2, Radio, Search, Settings } from 'lucide-react';
import { useStore } from '../../context/Store';
import logo from '../../logo.svg';
import { ServerConnectionStatus } from './ServerConnectionStatus';
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
  const { currentView, setView, openSearchModal, settings, service, playlists } = useStore();
  const reducedMotion = useReducedMotion();
  const bodyRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const [playlistLimit, setPlaylistLimit] = useState(0);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const core = coreRef.current;
    if (!body || !core) return;
    const measure = () => {
      // Reserve body padding, the playlist heading and the section gap.
      const slots = Math.floor((body.clientHeight - core.offsetHeight - 60) / 32);
      setPlaylistLimit(Math.max(0, Math.min(4, slots)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(core);
    return () => observer.disconnect();
  }, []);
  const visibleSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => !('flag' in item) || settings.sidebar[item.flag]),
  })).filter(section => section.items.length);
  const listenItems = [
    { view: 'HOME', label: 'Home', icon: Home, flag: settings.sidebar.showHome },
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
      <img className="nebula-brand-mark" src={logo} alt="" />
      <strong>Nebula</strong>
    </button>
    <div className="nebula-rail-body" ref={bodyRef}>
      <div className="nebula-rail-core" ref={coreRef}>
        <nav aria-label="Discover" className="nebula-rail-section">
          <h2>Discover</h2>
          {listenItems.filter(item => item.flag).map(navButton)}
          <button type="button" className="nebula-rail-item" onClick={openSearchModal}><Search size={19} strokeWidth={1.9} aria-hidden /><span>Search</span></button>
        </nav>
        {visibleSections.map(section => <nav key={section.title} aria-label={section.title} className="nebula-rail-section">
          <h2>{section.title}</h2>
          {section.items.map(navButton)}
        </nav>)}
      </div>
      {settings.sidebar.showPlaylists && playlists.length > 0 && playlistLimit > 0 && <nav aria-label="Your playlists" className="nebula-rail-section nebula-rail-playlists">
        <h2>Playlists</h2>
        {playlists.slice(0, playlistLimit).map(playlist => <button key={playlist.id} type="button" className="nebula-rail-playlist" onClick={() => setView('PLAYLIST_DETAIL', playlist.id)}>
          {playlist.coverArt ? <img src={service.getCoverArtUrl(playlist.coverArt, 48)} alt="" /> : <span><ListMusic size={15} aria-hidden /></span>}
          <span title={playlist.name}>{playlist.name}</span>
        </button>)}
      </nav>}
    </div>
    <div className="nebula-rail-footer">
      <button type="button" className="nebula-rail-item" data-active={currentView === 'SETTINGS'} onClick={() => setView('SETTINGS')}><Settings size={19} strokeWidth={1.9} aria-hidden="true" /><span>Settings</span></button>
      <ServerConnectionStatus />
    </div>
  </aside>;
};
