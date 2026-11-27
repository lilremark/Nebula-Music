import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Compass, Headphones, Disc3, Heart, Home, LibraryBig, ListMusic, Mic2, Music2, PanelLeftClose, PanelLeftOpen, Plus, Radio, Search, Settings } from 'lucide-react';
import { useStore } from '../../context/Store';
import logo from '../../logo.svg';
import { ServerConnectionStatus } from './ServerConnectionStatus';
import type { SidebarSectionId, View } from '../../types';
import { usePlatform } from '../../platform/PlatformContext';
import { isLocalDjPlatform } from '../../platform/aiDjAvailability';
import { activeSidebarSection, openPlaylistId, resolveSidebarSections, toggleSidebarSection } from './sidebarSections';

const libraryItems = [
  { view: 'ARTISTS', label: 'Artists', icon: Mic2, flag: 'showArtists' },
  { view: 'ALBUMS', label: 'Albums', icon: Disc3, flag: 'showAlbums' },
  { view: 'SONGS', label: 'Songs', icon: Music2, flag: 'showSongs' },
  { view: 'PLAYLISTS', label: 'Playlists', icon: ListMusic, flag: 'showPlaylists' },
  { view: 'LIKED_SONGS', label: 'Liked Songs', icon: Heart },
  { view: 'LIKED_ALBUMS', label: 'Liked Albums', icon: Disc3 },
] as const;

const parentView = (view: View): View => {
  if (view === 'ARTIST_DETAIL') return 'ARTISTS';
  if (view === 'ALBUM_DETAIL') return 'ALBUMS';
  if (view === 'PLAYLIST_DETAIL') return 'PLAYLISTS';
  return view;
};

/** Group heading that discloses its rows; hidden in the 72px icon rail, where every row stays visible. */
const RailHeading: React.FC<{
  id: SidebarSectionId;
  label: string;
  open: boolean;
  hasActive: boolean;
  count?: number;
  onToggle: () => void;
  children?: React.ReactNode;
}> = ({ id, label, open, hasActive, count, onToggle, children }) => (
  <div className="nebula-rail-heading" data-open={open}>
    <h2>
      <button type="button" className="nebula-rail-disclosure" aria-expanded={open} aria-controls={`nebula-rail-group-${id}`} onClick={onToggle}>
        <span className="nebula-rail-disclosure-label">{label}</span>
        {count !== undefined && <span className="nebula-rail-heading-count">{count}</span>}
        {!open && hasActive && <span className="nebula-rail-heading-dot" data-nebula-rail-active-marker aria-hidden="true" />}
        {!open && hasActive && <span className="sr-only">, contains the current page</span>}
        <ChevronDown className="nebula-rail-chevron" size={14} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </h2>
    {children}
  </div>
);

export const DesktopRail: React.FC<{ collapsed: boolean; onToggle: () => void }> = ({ collapsed, onToggle }) => {
  const { currentView, viewData, setView, openSearchModal, settings, updateSettings, service, playlists, createPlaylist } = useStore();
  const platform = usePlatform();
  const reducedMotion = useReducedMotion();
  const sections = resolveSidebarSections(settings.sidebar);
  // The icon rail has no headings, so it always shows every group.
  const isOpen = (id: SidebarSectionId) => collapsed || sections[id];
  const toggleSection = (id: SidebarSectionId) => updateSettings({ sidebar: toggleSidebarSection(settings.sidebar, id) });

  const showPlaylistGroup = settings.sidebar.showPlaylists && playlists.length > 0;
  const activePlaylistId = openPlaylistId(currentView, viewData);
  const activeSection = activeSidebarSection(currentView, viewData, showPlaylistGroup ? playlists.map(playlist => playlist.id) : []);

  const listRef = useRef<HTMLDivElement>(null);
  const [listOverflow, setListOverflow] = useState(false);
  const measureList = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setListOverflow(list.scrollTop + list.clientHeight < list.scrollHeight - 1);
  }, []);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    measureList();
    const observer = new ResizeObserver(measureList);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measureList, showPlaylistGroup]);
  useLayoutEffect(measureList, [measureList, playlists.length, collapsed, sections.playlists]);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape unmount the input, which may also fire blur; settle the draft once.
  const createSettledRef = useRef(false);
  const startCreate = () => { createSettledRef.current = false; setNewName(''); setCreating(true); };
  useEffect(() => { if (creating) newInputRef.current?.focus(); }, [creating]);
  useEffect(() => { if (collapsed) setCreating(false); }, [collapsed]);
  const finishCreate = (commit: boolean) => {
    if (createSettledRef.current) return;
    createSettledRef.current = true;
    const name = newName.trim();
    if (commit && name) createPlaylist(name);
    setNewName('');
    setCreating(false);
  };

  const listenItems = [
    { view: 'HOME', label: 'Home', icon: Home, flag: settings.sidebar.showHome },
    { view: 'BROWSE', label: 'Browse', icon: Compass, flag: settings.sidebar.showBrowse },
    { view: 'AI_DJ', label: 'AI DJ', icon: Headphones, flag: isLocalDjPlatform(platform?.info) },
    { view: 'RADIO', label: 'Internet Radio', icon: Radio, flag: settings.sidebar.showRadio },
  ] as const;
  const visibleLibraryItems = libraryItems.filter(item => !('flag' in item) || settings.sidebar[item.flag]);

  const pillTransition = (kind: 'spring' | 'fade' = 'spring') => reducedMotion ? { duration: 0 } : kind === 'spring' ? { type: 'spring' as const, stiffness: 420, damping: 38 } : { duration: 0.18 };
  const activePill = (kind: 'spring' | 'fade' = 'spring') => <motion.span className="nebula-rail-active" layoutId="nebula-rail-active" transition={pillTransition(kind)} />;

  const navButton = (section: SidebarSectionId) => (item: { view: View; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }> }) => {
    const Icon = item.icon;
    const active = activeSection !== 'playlists' && parentView(currentView) === item.view;
    return <button key={item.view} type="button" className="nebula-rail-item" aria-label={item.label} title={collapsed ? item.label : undefined} data-active={active} aria-current={active ? 'page' : undefined} onClick={() => setView(item.view)}>
      {active && isOpen(section) && activePill()}
      <Icon size={19} strokeWidth={1.9} aria-hidden />
      <span>{item.label}</span>
    </button>;
  };

  const group = (id: SidebarSectionId, children: React.ReactNode, inner?: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement>; 'data-overflow'?: boolean }) => {
    const open = isOpen(id);
    return <div className="nebula-rail-group" id={`nebula-rail-group-${id}`} data-open={open} inert={!open}>
      <div {...inner} className={`nebula-rail-group-inner ${inner?.className || ''}`.trim()}>{children}</div>
    </div>;
  };

  return <aside className="nebula-rail" data-collapsed={collapsed} aria-label="Music navigation">
    <div className="nebula-rail-header" data-nebula-rail-divider="brand">
    <button type="button" className="nebula-rail-brand" onClick={() => setView('HOME')} aria-label="Nebula Home">
      <img className="nebula-brand-mark" src={logo} alt="" />
      <strong>Nebula</strong>
    </button>
    <button type="button" className="nebula-rail-toggle" onClick={event => { onToggle(); if (!event.currentTarget.matches(':focus-visible')) event.currentTarget.blur(); }} aria-label={collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
    </button>
    </div>
    <div className="nebula-rail-body">
      <div className="nebula-rail-core">
        <nav aria-label="Discover" className="nebula-rail-section">
          <RailHeading id="discover" label="Discover" open={sections.discover} hasActive={activeSection === 'discover'} onToggle={() => toggleSection('discover')} />
          {group('discover', <>
            {listenItems.filter(item => item.flag).map(navButton('discover'))}
            <button type="button" className="nebula-rail-item" aria-label="Search" title={collapsed ? 'Search' : undefined} onClick={openSearchModal}><Search size={19} strokeWidth={1.9} aria-hidden /><span>Search</span></button>
          </>)}
        </nav>
        <nav data-nebula-rail-divider="library" aria-label="Your Library" className="nebula-rail-section">
          <RailHeading id="library" label="Your Library" open={sections.library} hasActive={activeSection === 'library'} onToggle={() => toggleSection('library')} />
          {group('library', visibleLibraryItems.map(navButton('library')))}
        </nav>
      </div>
      {showPlaylistGroup && <nav data-nebula-rail-divider="playlists" aria-label="Your playlists" className="nebula-rail-section nebula-rail-playlists">
        <RailHeading id="playlists" label="Playlists" open={sections.playlists} hasActive={activeSection === 'playlists'} count={playlists.length} onToggle={() => toggleSection('playlists')}>
          <button type="button" className="nebula-rail-heading-add" aria-label="New playlist" title="New playlist" onClick={startCreate}><Plus size={14} strokeWidth={2.2} aria-hidden="true" /></button>
        </RailHeading>
        {creating && !collapsed && <form className="nebula-rail-new" onSubmit={event => { event.preventDefault(); finishCreate(true); }}>
          <input ref={newInputRef} aria-label="New playlist name" placeholder="Playlist name" value={newName} maxLength={120} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); finishCreate(false); } }} onBlur={() => finishCreate(true)} />
        </form>}
        {group('playlists', <>
          {playlists.map(playlist => {
            const active = playlist.id === activePlaylistId;
            return <button key={playlist.id} type="button" className="nebula-rail-playlist" aria-label={playlist.name} title={playlist.name} data-active={active} aria-current={active ? 'page' : undefined} onClick={() => setView('PLAYLIST_DETAIL', playlist.id)}>
              {playlist.coverArt ? <img src={service.getCoverArtUrl(playlist.coverArt, 48)} alt="" /> : <span className="nebula-rail-playlist-thumb"><ListMusic size={15} aria-hidden /></span>}
              <span className="nebula-rail-playlist-name">{playlist.name}</span>
              {/* Last child, and not a span, so the existing thumb/label selectors keep matching. */}
              {active && isOpen('playlists') && <motion.i className="nebula-rail-active" layoutId="nebula-rail-active" transition={pillTransition()} />}
            </button>;
          })}
          {!collapsed && !sections.library && settings.sidebar.showPlaylists && <button type="button" className="nebula-rail-all-playlists" onClick={() => setView('PLAYLISTS')}>
            <LibraryBig size={15} strokeWidth={1.9} aria-hidden="true" />
            <span>All playlists</span>
          </button>}
        </>, { className: 'nebula-rail-playlist-list', ref: listRef, onScroll: measureList, 'data-overflow': listOverflow })}
      </nav>}
    </div>
    <div className="nebula-rail-footer">
      <button type="button" className="nebula-rail-item" aria-label="Settings" title={collapsed ? 'Settings' : undefined} data-active={currentView === 'SETTINGS'} onClick={() => setView('SETTINGS')}>{currentView === 'SETTINGS' && activePill('fade')}<Settings size={19} strokeWidth={1.9} aria-hidden="true" /><span>Settings</span></button>
      <ServerConnectionStatus />
    </div>
  </aside>;
};
