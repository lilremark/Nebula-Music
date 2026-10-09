import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Disc3,
  Heart,
  Home,
  LibraryBig,
  ListMusic,
  Mic2,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Server,
  Settings,
} from 'lucide-react';
import { useStore } from '../../context/Store';
import type { View } from '../../types';
import nebulaLogo from './assets/nebula-monochrome.svg';

interface StudioNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  view: View;
};

const desktopDefault = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches;

/**
 * Studio-only collapsible rail. It uses the real Store navigation while its
 * expanded state remains local to the isolated prototype.
 */
export function StudioNavDrawer({ isOpen, onClose }: StudioNavDrawerProps) {
  const { currentView, isDemoMode, playlists, setView, settings } = useStore();
  const [expanded, setExpanded] = useState(desktopDefault);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches);
  const drawerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const syncViewport = () => setIsMobile(media.matches);
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (isOpen) setExpanded(true);
  }, [isOpen]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    drawer.inert = isMobile && !expanded;
  }, [expanded, isMobile]);

  useEffect(() => {
    if (!expanded) return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    if (!isMobile) {
      const closeOnEscape = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setExpanded(false);
        onCloseRef.current();
      };
      document.addEventListener('keydown', closeOnEscape);
      return () => document.removeEventListener('keydown', closeOnEscape);
    }

    const shell = drawer.parentElement;
    const opener = shell?.querySelector<HTMLElement>('button[aria-controls="app-navigation"]') ?? null;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnFocusTo = activeElement && activeElement !== document.body ? activeElement : opener;
    const siblings = shell
      ? Array.from(shell.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== drawer && !node.classList.contains('studio-nav-backdrop'))
      : [];
    const siblingState = siblings.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }));

    siblings.forEach(element => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });

    const getFocusable = () => Array.from(drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => !element.inert && element.getClientRects().length > 0);

    const focusInitialControl = window.requestAnimationFrame(() => {
      drawer.querySelector<HTMLElement>('[data-nav-initial-focus]')?.focus();
    });

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(false);
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => {
      window.cancelAnimationFrame(focusInitialControl);
      document.removeEventListener('keydown', trapFocus);
      siblingState.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      window.requestAnimationFrame(() => (opener ?? returnFocusTo)?.focus());
    };
  }, [expanded, isMobile]);

  const collapse = () => {
    setExpanded(false);
    onClose();
  };

  const navigate = (view: View) => {
    setView(view);
    if (window.matchMedia('(max-width: 900px)').matches) collapse();
  };

  const sections: Array<{ label: string; items: NavItem[] }> = [
    {
      label: 'Discover',
      items: [
        ...(settings.sidebar.showHome ? [{ icon: Home, label: 'Home', view: 'HOME' as View }] : []),
        ...(settings.sidebar.showBrowse ? [{ icon: Compass, label: 'Browse', view: 'BROWSE' as View }] : []),
        ...(settings.sidebar.showRadio ? [{ icon: Radio, label: 'Internet Radio', view: 'RADIO' as View }] : []),
      ],
    },
    {
      label: 'Your Library',
      items: [
        ...(settings.sidebar.showSongs ? [{ icon: Heart, label: 'Liked Songs', view: 'LIKED_SONGS' as View }] : []),
        ...(settings.sidebar.showArtists ? [{ icon: Mic2, label: 'Artists', view: 'ARTISTS' as View }] : []),
        ...(settings.sidebar.showAlbums ? [{ icon: Disc3, label: 'Albums', view: 'ALBUMS' as View }] : []),
        ...(settings.sidebar.showSongs ? [{ icon: Music2, label: 'Songs', view: 'SONGS' as View }] : []),
        ...(settings.sidebar.showPlaylists ? [{ icon: ListMusic, label: 'Playlists', view: 'PLAYLISTS' as View }] : []),
      ],
    },
  ];

  return <>
    <button
      type="button"
      className="studio-nav-backdrop"
      aria-hidden="true"
      tabIndex={-1}
      onClick={collapse}
      data-open={expanded}
    />

    <nav
      ref={drawerRef}
      id="app-navigation"
      className="studio-nav-drawer"
      data-nebula-navigation
      data-open={expanded}
      aria-label={expanded ? 'Main navigation' : 'Collapsed navigation'}
      aria-hidden={isMobile && !expanded ? true : undefined}
      aria-modal={isMobile && expanded ? true : undefined}
      role={isMobile && expanded ? 'dialog' : 'navigation'}
      tabIndex={isMobile && expanded ? -1 : undefined}
    >
      <div className="studio-nav-header" data-nebula-navigation-header>
        <button type="button" className="studio-nav-brand" onClick={() => navigate('HOME')} aria-label="Go to Nebula home">
          <img src={nebulaLogo} alt="" />
          <span className="studio-nav-brand-copy"><strong>Nebula</strong><small>Music Library</small></span>
        </button>
        <button
          type="button"
          onClick={() => expanded ? collapse() : setExpanded(true)}
          className="studio-nav-close"
          aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
          title={expanded ? 'Collapse navigation' : 'Expand navigation'}
          data-nav-initial-focus
        >
          {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </button>
      </div>

      <div className="studio-nav-content" data-nebula-navigation-content>
        {sections.map(section => <div className="studio-nav-section" key={section.label}>
          <p>{section.label}</p>
          {section.items.map(({ icon: Icon, label, view }) => <button
            type="button"
            key={view}
            onClick={() => navigate(view)}
            aria-current={currentView === view ? 'page' : undefined}
            aria-label={label}
            title={!expanded ? label : undefined}
            className="studio-nav-item"
            data-nebula-navigation-item
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </button>)}
        </div>)}

        <div className="studio-nav-section studio-playlist-shortcuts">
          <p>Your Playlists</p>
          <button type="button" className="studio-nav-item studio-create-playlist" onClick={() => navigate('PLAYLISTS')} aria-label="Create playlist" title={!expanded ? 'Create playlist' : undefined}>
            <Plus className="h-5 w-5" /><span>Create Playlist</span>
          </button>
          {playlists.slice(0, 3).map(playlist => <button
            type="button"
            key={playlist.id}
            className="studio-nav-item"
            data-nebula-navigation-item
            onClick={() => setView('PLAYLIST_DETAIL', playlist.id)}
            aria-label={playlist.name}
            title={!expanded ? playlist.name : undefined}
          >
            <LibraryBig className="h-5 w-5" /><span>{playlist.name}</span>
          </button>)}
        </div>
      </div>

      <div className="studio-nav-footer" data-nebula-navigation-footer>
        <button type="button" className="studio-nav-item" data-nebula-navigation-item onClick={() => navigate('SETTINGS')} aria-current={currentView === 'SETTINGS' ? 'page' : undefined} aria-label="Settings" title={!expanded ? 'Settings' : undefined}>
          <Settings className="h-5 w-5" /><span>Settings</span>
        </button>
        <div className="studio-nav-status" title={!expanded ? 'Home Server connected' : undefined}>
          <Server className="h-5 w-5" />
          <span><strong>Home Server</strong><small>{isDemoMode ? 'Preview connected' : 'Connected'}</small></span>
          <i aria-hidden="true" />
        </div>
      </div>
    </nav>
  </>;
}
