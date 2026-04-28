
import React, { useState, useEffect } from 'react';
import { Home, Disc, Mic2, Music, ListMusic, Settings, Compass, Search, Heart, Star, ChevronLeft, Radio } from 'lucide-react';
import { useStore } from '../context/Store';
import { View } from '../types';
import { Tooltip } from './ui/Tooltip';

const STORAGE_KEY = 'nebula-sidebar-collapsed';

export const Sidebar: React.FC = () => {
  const { currentView, setView, isDemoMode, settings, openSearchModal } = useStore();
  const s = settings.sidebar;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const NavItem = ({ icon: Icon, label, view }: { icon: any, label: string, view: View }) => {
    const isActive = currentView === view;

    const button = (
      <button
        onClick={() => setView(view)}
        className={`
          flex items-center w-full mb-1.5 text-sm font-medium rounded-xl group relative overflow-hidden
          transition-all duration-300 ease-out interactive-press
          ${isCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'}
          ${isActive
            ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-neutral-900 dark:text-white border border-primary/30 shadow-glow-sm'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent hover:border-neutral-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-white/[0.07] dark:hover:border-white/10'
          }
        `}
      >
        {/* Active indicator line */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-secondary rounded-r-full shadow-glow-sm animate-scale-in" />
        )}

        <Icon className={`
          w-5 h-5 shrink-0 transition-all duration-300
          ${isCollapsed ? '' : 'ml-1 mr-3'}
          ${isActive
            ? 'text-primary scale-110'
            : 'text-neutral-500 group-hover:text-neutral-900 group-hover:scale-105 dark:group-hover:text-white'
          }
        `} />

        {!isCollapsed && (
          <span className={`
            sidebar-label-transition truncate
            ${isActive ? 'font-semibold tracking-wide' : ''}
          `}>
            {label}
          </span>
        )}

        {/* Hover glow effect */}
        {!isActive && (
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
        )}
      </button>
    );

    // Wrap in tooltip when collapsed
    if (isCollapsed) {
      return (
        <Tooltip content={label} position="right">
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  const SectionHeader = ({ title }: { title: string }) => {
    if (isCollapsed) {
      return <div className="h-px bg-neutral-200 dark:bg-white/10 my-4 mx-2" />;
    }
    return (
      <h3 className="px-4 mb-3 text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest sidebar-label-transition">
        {title}
      </h3>
    );
  };

  return (
    <div
      className={`
        hidden md:flex flex-col h-full floating-panel border-r border-neutral-200 dark:border-white/10 
        pt-6 pb-4 z-20 relative overflow-hidden animate-slide-down sidebar-transition
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-secondary/[0.02] pointer-events-none" />

      {/* Header */}
      <div className={`relative z-10 ${isCollapsed ? 'px-2' : 'px-5'} mb-8`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''} mb-7 group cursor-pointer`}>
          <div className="w-11 h-11 bg-gradient-to-tr from-primary via-primary to-secondary rounded-2xl flex items-center justify-center shadow-glow transform transition-all duration-700 group-hover:rotate-180 group-hover:scale-110 group-hover:shadow-glow-lg border border-white/10 shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white stroke-current" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10v4" className="opacity-50" />
              <path d="M8 7v10" className="opacity-75" />
              <path d="M12 3v18" className="opacity-100" />
              <path d="M16 7v10" className="opacity-75" />
              <path d="M20 10v4" className="opacity-50" />
            </svg>
          </div>
          {!isCollapsed && (
            <div className="ml-3 sidebar-label-transition">
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight leading-none">NEBULA</h1>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-widest font-mono">Music</p>
            </div>
          )}
        </div>

        {/* Search Trigger */}
        {isCollapsed ? (
          <Tooltip content="Search (⌘K)" position="right">
            <button
              onClick={openSearchModal}
              className="w-full flex items-center justify-center glass-subtle hover:bg-neutral-200 border border-neutral-200 dark:border-white/10 rounded-xl p-2.5 text-neutral-600 dark:text-neutral-400 transition-all duration-300 hover:border-primary/30 hover:shadow-glow-sm interactive-press mb-6 dark:hover:bg-white/[0.08]"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={openSearchModal}
            className="w-full flex items-center justify-between glass-subtle hover:bg-neutral-200 border border-neutral-200 dark:border-white/10 rounded-xl py-2.5 px-3.5 text-sm text-neutral-600 dark:text-neutral-400 transition-all duration-300 group mb-6 hover:border-primary/30 hover:shadow-glow-sm interactive-press dark:hover:bg-white/[0.08]"
          >
            <div className="flex items-center">
              <Search className="w-4 h-4 mr-2.5 group-hover:text-primary transition-all duration-300" />
              <span className="group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">Search...</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded-md border border-neutral-300 bg-neutral-100 px-2 font-mono text-[10px] font-medium text-neutral-500 group-hover:border-primary/40 group-hover:text-primary transition-all dark:border-white/20 dark:bg-black/30">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </button>
        )}

        {/* Connection Status */}
        <div className={`flex items-center glass-subtle rounded-lg border border-neutral-200 dark:border-white/10 ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2'}`}>
          <div className={`w-2 h-2 rounded-full shrink-0 transition-all ${isDemoMode
            ? 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.5)]'
            : 'bg-success animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            }`} />
          {!isCollapsed && (
            <span className="text-xs text-neutral-600 dark:text-neutral-300 font-mono uppercase tracking-wider ml-2.5 sidebar-label-transition">
              {isDemoMode ? 'DEMO MODE' : 'CONNECTED'}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className={`flex-1 overflow-y-auto space-y-7 custom-scrollbar relative z-10 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <div className="space-y-1">
          <SectionHeader title="Discover" />
          {s.showHome && <NavItem icon={Home} label="Home" view="HOME" />}
          {s.showBrowse && <NavItem icon={Compass} label="Browse" view="BROWSE" />}
          {s.showRadio && <NavItem icon={Radio} label="Internet Radio" view="RADIO" />}
        </div>

        {(s.showArtists || s.showAlbums || s.showSongs) && (
          <div className="space-y-1">
            <SectionHeader title="Library" />
            {s.showSongs && <NavItem icon={Heart} label="Liked Songs" view="LIKED_SONGS" />}
            {s.showAlbums && <NavItem icon={Star} label="Liked Albums" view="LIKED_ALBUMS" />}
            {s.showArtists && <NavItem icon={Mic2} label="Artists" view="ARTISTS" />}
            {s.showAlbums && <NavItem icon={Disc} label="Albums" view="ALBUMS" />}
            {s.showSongs && <NavItem icon={Music} label="Songs" view="SONGS" />}
          </div>
        )}

        {s.showPlaylists && (
          <div className="space-y-1">
            <SectionHeader title="Playlists" />
            <NavItem icon={ListMusic} label="My Playlists" view="PLAYLISTS" />
          </div>
        )}

        <div className="space-y-1">
          <SectionHeader title="System" />
          <NavItem icon={Settings} label="Settings" view="SETTINGS" />
        </div>
      </div>

      {/* Collapse Toggle Button */}
      <div className={`relative z-10 mt-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <button
          onClick={toggleSidebar}
          className={`
            w-full flex items-center justify-center py-2.5 rounded-xl
            bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 hover:border-neutral-300
            text-neutral-600 hover:text-neutral-900 transition-all duration-300 interactive-press
            dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:hover:border-white/15
            dark:text-neutral-400 dark:hover:text-white
          `}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={`
            w-5 h-5 rotate-180-transition
            ${isCollapsed ? 'rotate-180' : ''}
          `} />
          {!isCollapsed && (
            <span className="ml-2 text-xs font-medium sidebar-label-transition">Collapse</span>
          )}
        </button>
      </div>
    </div>
  );
};
