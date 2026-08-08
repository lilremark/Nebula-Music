import React from 'react';
import type { CSSProperties } from 'react';
import { Menu, Search, Settings } from 'lucide-react';
import { WindowControls } from '../window/WindowControls';
import { useStore } from '../../context/Store';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

interface TopBarProps {
    onMenuClick: () => void;
    isNavOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, isNavOpen = false }) => {
    const { openSearchModal, setView, currentView } = useStore();

    // Get current page title
    const getPageTitle = () => {
        switch (currentView) {
            case 'HOME': return 'Home';
            case 'BROWSE': return 'Browse';
            case 'ARTISTS': return 'Artists';
            case 'ALBUMS': return 'Albums';
            case 'SONGS': return 'Songs';
            case 'PLAYLISTS': return 'Playlists';
            case 'LIKED_SONGS': return 'Liked Songs';
            case 'LIKED_ALBUMS': return 'Liked Albums';
            case 'SETTINGS': return 'Settings';
            case 'ALBUM_DETAIL': return 'Album';
            case 'ARTIST_DETAIL': return 'Artist';
            case 'PLAYLIST_DETAIL': return 'Playlist';
            default: return 'Nebula';
        }
    };

    return (
        <header
            className="relative h-16 flex items-center justify-between px-6 border-b border-neutral-200 dark:border-white/5 sticky top-0 z-30"
            style={appRegion(isNavOpen ? 'no-drag' : 'drag')}
        >
            {/* Blur + background live on a pointer-events-none child so the
                compositing layer can never swallow mousedown on the drag region. */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-white/80 dark:bg-black/20 backdrop-blur-xl" />

            {/* Left: Menu + Title */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95"
                    aria-label="Open navigation"
                    style={appRegion('no-drag')}
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                    {/* Logo - clickable to go home */}
                    <button
                        onClick={() => setView('HOME')}
                        className="w-8 h-8 rounded-lg bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                        title="Go to Home"
                        style={appRegion('no-drag')}
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 text-black stroke-current" fill="none" strokeWidth="3" strokeLinecap="round">
                            <path d="M4 10v4" className="opacity-40" />
                            <path d="M8 7v10" className="opacity-60" />
                            <path d="M12 3v18" className="opacity-100" />
                            <path d="M16 7v10" className="opacity-60" />
                            <path d="M20 10v4" className="opacity-40" />
                        </svg>
                    </button>

                    <h1 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                        {getPageTitle()}
                    </h1>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={openSearchModal}
                    className="p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95"
                    aria-label="Search"
                    style={appRegion('no-drag')}
                >
                    <Search className="w-5 h-5" />
                </button>

                <button
                    onClick={() => setView('SETTINGS')}
                    className={`p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 transition-all duration-200 active:scale-95 ${currentView === 'SETTINGS' ? 'text-neutral-900 dark:text-white bg-neutral-200 dark:bg-white/10' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                    aria-label="Settings"
                    style={appRegion('no-drag')}
                >
                    <Settings className="w-5 h-5" />
                </button>

                {/* Custom window controls (Windows only), directly after Settings, no divider */}
                <WindowControls />
            </div>
        </header>
    );
};
