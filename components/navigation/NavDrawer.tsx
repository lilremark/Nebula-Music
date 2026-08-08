import React, { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Home, Compass, Mic2, Disc, Music, ListMusic, Heart, Star, Settings, X, Radio } from 'lucide-react';
import { useStore } from '../../context/Store';
import { View } from '../../types';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

interface NavDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NavDrawer: React.FC<NavDrawerProps> = ({ isOpen, onClose }) => {
    const { currentView, setView, isDemoMode, settings } = useStore();
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
                    fixed inset-0 z-40 bg-black/70 backdrop-blur-xs
                    transition-opacity duration-300
                    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                `}
                onClick={onClose}
            />

            {/* Drawer */}
            <nav
                className={`
                    fixed top-0 left-0 bottom-0 z-50
                    w-72 max-w-[85vw]
                    bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-white/10
                    flex flex-col
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
                aria-label="Main navigation"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-white/10" style={appRegion('no-drag')}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-black stroke-current" fill="none" strokeWidth="3" strokeLinecap="round">
                                <path d="M4 10v4" className="opacity-40" />
                                <path d="M8 7v10" className="opacity-60" />
                                <path d="M12 3v18" className="opacity-100" />
                                <path d="M16 7v10" className="opacity-60" />
                                <path d="M20 10v4" className="opacity-40" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">NEBULA</h2>
                            <p className="text-[10px] text-neutral-600 dark:text-white/60 uppercase tracking-widest font-mono">Music</p>
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
                    </div>

                    <SectionLabel>Library</SectionLabel>
                    <div className="space-y-1">
                        {s.showSongs && <NavItem icon={Heart} label="Liked Songs" view="LIKED_SONGS" />}
                        {s.showAlbums && <NavItem icon={Star} label="Liked Albums" view="LIKED_ALBUMS" />}
                        {s.showArtists && <NavItem icon={Mic2} label="Artists" view="ARTISTS" />}
                        {s.showAlbums && <NavItem icon={Disc} label="Albums" view="ALBUMS" />}
                        {s.showSongs && <NavItem icon={Music} label="Songs" view="SONGS" />}
                    </div>

                    {s.showPlaylists && (
                        <>
                            <SectionLabel>Playlists</SectionLabel>
                            <div className="space-y-1">
                                <NavItem icon={ListMusic} label="My Playlists" view="PLAYLISTS" />
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
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5">
                        <div className={`w-2 h-2 rounded-full ${isDemoMode
                            ? 'bg-amber-500'
                            : 'bg-emerald-500 animate-pulse'
                            }`} />
                        <span className="text-xs text-neutral-500 dark:text-white/50 font-mono uppercase tracking-wider">
                            {isDemoMode ? 'Demo Mode' : 'Connected'}
                        </span>
                    </div>
                </div>
            </nav>
        </>
    );
};


