import React from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Menu, Moon, Search, Settings, Sun } from 'lucide-react';
import { useStore } from '../../context/Store';
import { useTheme } from '../../context/ThemeContext';
import { usePlatform } from '../../platform/PlatformContext';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

interface TopBarProps {
    onMenuClick: () => void;
    isNavOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, isNavOpen = false }) => {
    const { openSearchModal, setView, currentView, canGoBack, goBack } = useStore();
    const { mode, toggleTheme } = useTheme();
    const platform = usePlatform();
    const isMac = platform?.info.os === 'darwin';

    // Get current page title
    const getPageTitle = () => {
        switch (currentView) {
            case 'HOME': return 'Home';
            case 'BROWSE': return 'Browse';
            case 'RADIO': return 'Radio';
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
            case 'SEARCH': return 'Search';
            default: return 'Nebula';
        }
    };

    return (
        <header
            data-nebula-topbar
            className={`nebula-topbar relative h-16 flex items-center justify-between px-6 ${isMac ? 'pl-3' : ''} border-b border-neutral-200 dark:border-white/5 sticky top-0 z-30`}
            style={appRegion(isNavOpen ? 'no-drag' : 'drag')}
        >
            {/* Blur + background live on a pointer-events-none child so the
                compositing layer can never swallow mousedown on the drag region. */}
            <div className="pointer-events-none absolute inset-0 -z-10 nebula-topbar-surface" />

            {/* Left: Menu + Title */}
            <div className="flex items-center gap-4" data-nebula-topbar-leading>
                {canGoBack && <button type="button" className="nebula-topbar-back" onClick={() => goBack()} aria-label="Go back" style={appRegion('no-drag')}><ArrowLeft size={18} aria-hidden="true" /></button>}
                <button
                    onClick={onMenuClick}
                    className="nebula-topbar-menu p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95"
                    aria-label="Open navigation"
                    aria-controls="app-navigation"
                    aria-expanded={isNavOpen}
                    style={appRegion('no-drag')}
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="nebula-topbar-heading flex items-center gap-3">
                    {/* Logo - clickable to go home */}
                    <button
                        data-nebula-topbar-mark
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

                    <span data-nebula-topbar-title className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                        {getPageTitle()}
                    </span>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2" data-nebula-topbar-actions>
                <button
                    data-nebula-command-search
                    onClick={openSearchModal}
                    className="nebula-search-trigger p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95"
                    aria-label="Search"
                    style={appRegion('no-drag')}
                >
                    <Search className="w-5 h-5" />
                    <span data-nebula-command-search-label>Search your music</span>
                    <kbd data-nebula-command-search-key>Ctrl K</kbd>
                </button>

                <button type="button" className="nebula-topbar-theme" onClick={toggleTheme} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`} style={appRegion('no-drag')}>
                    {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                <button
                    data-nebula-topbar-settings
                    onClick={() => setView('SETTINGS')}
                    className={`p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 transition-all duration-200 active:scale-95 ${currentView === 'SETTINGS' ? 'text-neutral-900 dark:text-white bg-neutral-200 dark:bg-white/10' : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                    aria-label="Settings"
                    style={appRegion('no-drag')}
                >
                    <Settings className="w-5 h-5" />
                </button>

            </div>
        </header>
    );
};
