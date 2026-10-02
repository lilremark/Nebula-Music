import React, { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Home, Compass, Mic2, Disc, Music, ListMusic, Heart, Star, Settings, X, Radio, Search } from 'lucide-react';
import { useStore } from '../../context/Store';
import { usePlatform } from '../../platform/PlatformContext';
import { View } from '../../types';
import { getNavDrawerTopClass } from './drawerLayout';
import logo from '../../logo.svg';
import { ServerConnectionStatus } from './ServerConnectionStatus';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

interface NavDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NavDrawer: React.FC<NavDrawerProps> = ({ isOpen, onClose }) => {
    const { currentView, setView, openSearchModal, settings, playlists, service } = useStore();
    const platform = usePlatform();
    const drawerTopClass = getNavDrawerTopClass(platform?.info.os);
    const s = settings.sidebar;

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const handleNavigate = (view: View, id?: string) => {
        setView(view, id);
        onClose();
    };

    const NavItem = ({ icon: Icon, label, view, badge }: { icon: any; label: string; view: View; badge?: string }) => {
        const isActive = currentView === view;
        return (
            <button
                onClick={() => handleNavigate(view)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                    w-full flex items-center gap-4 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${isActive
                        ? 'bg-primary text-black font-semibold'
                        : 'text-neutral-700 dark:text-white/70 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10'
                    }
                `}
            >
                <Icon className={`w-5 h-5 ${isActive ? '' : ''}`} />
                <span className="flex-1 text-left text-sm">{label}</span>
                {badge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-black/20 text-black' : 'bg-white/10'}`}>
                        {badge}
                    </span>
                )}
            </button>
        );
    };

    const SectionLabel = ({ children }: { children: React.ReactNode }) => (
        <div className="px-4 pt-6 pb-2 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-white/50">
            {children}
        </div>
    );

    return (
        <>
            {/* Backdrop */}
            <div
                className={`
                    fixed left-0 right-0 bottom-0 ${drawerTopClass} z-40 bg-black/70 backdrop-blur-xs
                    transition-opacity duration-300
                    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                onClick={onClose}
                style={appRegion('no-drag')}
            />

            {/* Drawer */}
            <nav
                id="app-navigation"
                className={`
                    fixed ${drawerTopClass} left-0 bottom-0 z-50
                    w-72 max-w-[85vw]
                    bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-white/10
                    flex flex-col
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
                aria-label="Main navigation"
                style={appRegion('no-drag')}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-white/10" style={appRegion('no-drag')}>
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="" className="w-10 h-10" />
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">Nebula</h2>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        aria-label="Close menu"
                        style={appRegion('no-drag')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    <SectionLabel>Discover</SectionLabel>
                    <div className="space-y-1">
                        {s.showHome && <NavItem icon={Home} label="Home" view="HOME" />}
                        {s.showBrowse && <NavItem icon={Compass} label="Browse" view="BROWSE" />}
                        {s.showRadio && <NavItem icon={Radio} label="Internet Radio" view="RADIO" />}
                        <button type="button" onClick={() => { onClose(); openSearchModal(); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-neutral-700 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 text-left"><Search size={20} aria-hidden="true" /><span className="text-sm">Search</span></button>
                    </div>

                    <SectionLabel>Your Library</SectionLabel>
                    <div className="space-y-1">
                        {s.showArtists && <NavItem icon={Mic2} label="Artists" view="ARTISTS" />}
                        {s.showAlbums && <NavItem icon={Disc} label="Albums" view="ALBUMS" />}
                        {s.showSongs && <NavItem icon={Music} label="Songs" view="SONGS" />}
                        {s.showPlaylists && <NavItem icon={ListMusic} label="Playlists" view="PLAYLISTS" />}
                        <NavItem icon={Heart} label="Liked Songs" view="LIKED_SONGS" />
                        <NavItem icon={Star} label="Liked Albums" view="LIKED_ALBUMS" />
                    </div>

                    {s.showPlaylists && playlists.length > 0 && (
                        <>
                            <SectionLabel>Playlists</SectionLabel>
                            <div className="space-y-1">
                                {playlists.slice(0, 8).map(playlist => <button key={playlist.id} type="button" className="nebula-drawer-playlist" onClick={() => handleNavigate('PLAYLIST_DETAIL', playlist.id)}>
                                    {playlist.coverArt ? <img src={service.getCoverArtUrl(playlist.coverArt, 48)} alt="" /> : <span><ListMusic size={16} aria-hidden="true" /></span>}
                                    <span>{playlist.name}</span>
                                </button>)}
                            </div>
                        </>
                    )}

                    <SectionLabel>System</SectionLabel>
                    <div className="space-y-1">
                        <NavItem icon={Settings} label="Settings" view="SETTINGS" />
                    </div>
                </div>

                {/* Footer - Connection Status */}
                <div className="p-4 border-t border-white/10">
                    <ServerConnectionStatus />
                </div>
            </nav>
        </>
    );
};


