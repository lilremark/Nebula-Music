import React from 'react';

interface SplitLayoutProps {
    leftPanel?: React.ReactNode;
    rightPanel: React.ReactNode | null;
    floatingPlayer?: React.ReactNode | null;
    children: React.ReactNode;
    isPlayerVisible: boolean;
    isCollapsed?: boolean;
}


export const SplitLayout: React.FC<SplitLayoutProps> = ({
    leftPanel,
    rightPanel,
    floatingPlayer,
    children,
    isPlayerVisible,
    isCollapsed = false
}) => {
    const showSidebar = isPlayerVisible && !isCollapsed && rightPanel !== null;

    return (
        <div className="nebula-split-layout flex h-full w-full bg-neutral-200 dark:bg-black">
            {leftPanel}
            {/* Left Panel - Content Area */}
            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {children}
            </main>

            {/* Right Panel - Now Playing (Desktop, when not collapsed) */}
            {showSidebar && (
                <aside
                    data-nebula-panel="now-playing"
                    className="
                        hidden min-[1320px]:flex flex-col
                        w-[340px] min-w-[340px] max-w-[340px]
                        h-full border-l border-neutral-300 dark:border-white/5
                        bg-gradient-to-b from-neutral-100 via-neutral-200 to-neutral-100
                        dark:from-black dark:via-neutral-950 dark:to-black
                    "
                    style={{ animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                    {rightPanel}
                </aside>
            )}

            {/* Floating Mini-Player (centered at bottom when collapsed) */}
            {isPlayerVisible && floatingPlayer && (
                <div className={`hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ${isCollapsed ? '' : 'min-[1320px]:hidden'}`} data-nebula-floating-dock>
                    {floatingPlayer}
                </div>
            )}
        </div>
    );
};
