# Custom Frameless Title Bar + Window Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native Window-Controls-Overlay on the Windows main window with `frame: false` plus custom React-rendered minimize/maximize/close buttons, and fix the header drag/double-click so the frameless title bar behaves natively.

**Architecture:** The main window drops WCO entirely (`frame: false` on win32 only) so the drag region is a real Windows caption region (`HTCAPTION`) — which sidesteps the Electron #43371 drag regression that exists under `titleBarStyle: 'hidden'`. `TopBar` keeps `-webkit-app-region: drag` on the `<header>` but moves `backdrop-blur-xl` to a `pointer-events: none` child so the compositing layer can't swallow mousedown (harness-kit PR #38 pattern). A new `maximizeChanged` IPC push keeps the maximize/restore button icon in sync. The whole WCO theme-sync surface (`titleBarTheme.ts`, `IPC.titleBar.setTheme`, `Platform.titleBar`, `App.tsx` effect, `env(titlebar-area-width)` padding) is removed.

**Tech Stack:** Electron 43 (`BrowserWindow` frameless window), React 19 + Tailwind (renderer `TopBar`), TypeScript, Vitest (pure-logic tests only), Vite/esbuild.

## Global Constraints

- `frame: false` applies **only when `process.platform === 'win32'`**; non-Windows keeps the stock frame and never renders custom controls.
- The drag region must remain the `<header>` element; the `backdrop-blur-xl` + translucent background must live on a **separate `pointer-events: none`** child (never on the drag element).
- Window controls render **only when `platform?.info.os === 'win32'`**, placed directly after the Settings button in the right action group, **no divider**.
- Close button uses the **same neutral hover** as the other icon buttons (`hover:bg-neutral-200 dark:hover:bg-white/10 ...`) — no red tint.
- Remove the WCO surface entirely: `electron/titleBarTheme.ts`, `IPC.titleBar.setTheme`, `Platform.titleBar`, the `App.tsx` theme-sync effect, and the `env(titlebar-area-width, 100%)` reserved padding.
- The `maximizeChanged` push is additive: the existing `isMaximized()` invoke stays for initial state.
- No changes to `electron-builder.yml`, CSP, sandbox, or `contextIsolation`.
- The mini-player window and its drag region are untouched.
- Every task ends green on `npm run typecheck` (plus `npm test` where a test is added) before the commit step.
- Commit style: `feat(desktop): ...` conventional commits, one commit per task.

---

### Task 1: Maximize-state IPC channel + platform surface (additive)

**Files:**
- Modify: `electron/ipc.ts` (add `window.maximizeChanged`)
- Modify: `platform/types.ts` (add `onMaximizeChanged` to `WindowControl`)
- Modify: `platform/desktopBridge.ts` (add `onMaximizeChanged` to `DesktopBridge['window']`)
- Modify: `electron/preload.ts` (implement `onMaximizeChanged` subscription)
- Modify: `platform/desktop.ts` (wire `onMaximizeChanged`)
- Modify: `platform/web.ts` (no-op `onMaximizeChanged`)

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 4):
  - Channel constant `IPC.window.maximizeChanged` = `'nebula:window:maximize-changed'`.
  - `WindowControl.onMaximizeChanged(handler: (maximized: boolean) => void): () => void` — subscribes to maximize-state pushes, returns an unsubscribe function.

- [ ] **Step 1: Add the IPC channel**

In `electron/ipc.ts`, in the `window` block after `isFullScreen: 'nebula:window:is-full-screen',`, add:

```ts
    maximizeChanged: 'nebula:window:maximize-changed',
```

- [ ] **Step 2: Extend `WindowControl`**

In `platform/types.ts`, in the `WindowControl` interface after `isFullScreen(): Promise<boolean>;`, add:

```ts
  onMaximizeChanged(handler: (maximized: boolean) => void): () => void;
```

- [ ] **Step 3: Extend `DesktopBridge['window']`**

In `platform/desktopBridge.ts`, in the `window` block after `isFullScreen(): Promise<boolean>;`, add:

```ts
    onMaximizeChanged(handler: (maximized: boolean) => void): () => void;
```

- [ ] **Step 4: Implement the preload subscription**

In `electron/preload.ts`, in the `window` object after `isFullScreen: () => ipcRenderer.invoke(IPC.window.isFullScreen),`, add:

```ts
    onMaximizeChanged: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: unknown) => {
        handler(Boolean(maximized));
      };
      ipcRenderer.on(IPC.window.maximizeChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC.window.maximizeChanged, listener);
      };
    },
```

- [ ] **Step 5: Wire the desktop platform**

In `platform/desktop.ts`, in the `windowControl` object after `isFullScreen: () => bridge.window.isFullScreen(),`, add:

```ts
    onMaximizeChanged: (handler) => bridge.window.onMaximizeChanged(handler),
```

- [ ] **Step 6: Add the web no-op**

In `platform/web.ts`, in the `webWindow` object after `isFullScreen: async () => false,`, add:

```ts
  onMaximizeChanged: () => () => {},
```

Note: use an inline arrow here (not the `noopUnsubscribe` const below), because `webWindow` is declared before `noopUnsubscribe` — referencing it would throw a TDZ ReferenceError at module load.

- [ ] **Step 7: Verify types**

Run: `npm run typecheck`
Expected: no errors (the WCO surface still exists and is untouched in this task).

- [ ] **Step 8: Commit**

```bash
git add electron/ipc.ts platform/types.ts platform/desktopBridge.ts electron/preload.ts platform/desktop.ts platform/web.ts
git commit -m "feat(desktop): Add maximize-state push channel to the platform API"
```

---

### Task 2: Main process — frameless window + maximize push events

**Files:**
- Modify: `electron/main.ts` (imports; remove `titleBarColors`; win32 window options; remove the `IPC.titleBar.setTheme` handler; add maximize/unmaximize listeners)

**Interfaces:**
- Consumes: `IPC.window.maximizeChanged` (Task 1).
- Produces: The win32 main window is `frame: false`; the renderer receives a boolean push on every maximize/unmaximize.

- [ ] **Step 1: Remove the title-bar theme import**

In `electron/main.ts`, delete this import line:

```ts
import { DEFAULT_TITLE_BAR, isTitleBarMode, titleBarThemeFor } from './titleBarTheme';
```

- [ ] **Step 2: Remove the overlay color state**

In `electron/main.ts`, delete this line:

```ts
let titleBarColors = DEFAULT_TITLE_BAR;
```

- [ ] **Step 3: Make the main window frameless on win32**

In `electron/main.ts`, in `createWindow()`, replace:

```ts
    ...(process.platform === 'win32'
      ? { titleBarStyle: 'hidden' as const, titleBarOverlay: { ...titleBarColors } }
      : {}),
```

with:

```ts
    ...(process.platform === 'win32' ? { frame: false } : {}),
```

- [ ] **Step 4: Remove the overlay theme handler**

In `electron/main.ts`, in `registerIpc()`, delete the whole handler block:

```ts
  ipcMain.on(IPC.titleBar.setTheme, (_event, mode: unknown) => {
    if (process.platform !== 'win32') return;
    if (!isTitleBarMode(mode)) return;
    titleBarColors = titleBarThemeFor(mode);
    mainWindow?.setTitleBarOverlay({ ...titleBarColors });
  });
```

- [ ] **Step 5: Add the maximize-state push listeners**

In `electron/main.ts`, in `createWindow()`, immediately after the `win.on('minimize', ...)` block, add:

```ts
  win.on('maximize', () => {
    win.webContents.send(IPC.window.maximizeChanged, true);
  });
  win.on('unmaximize', () => {
    win.webContents.send(IPC.window.maximizeChanged, false);
  });
```

- [ ] **Step 6: Verify build**

Run: `npm run typecheck; if ($?) { npm run build:main }`
Expected: both succeed (no errors; `electron/dist/main.cjs` regenerates).

- [ ] **Step 7: Commit**

```bash
git add electron/main.ts
git commit -m "feat(desktop): Make the Windows main window frameless with maximize push events"
```

---

### Task 3: Remove the WCO theme surface

**Files:**
- Delete: `electron/titleBarTheme.ts`
- Delete: `electron/titleBarTheme.test.ts`
- Modify: `electron/ipc.ts` (remove `titleBar` namespace)
- Modify: `electron/preload.ts` (remove `titleBar` block)
- Modify: `platform/types.ts` (remove `titleBar` from `Platform`; drop `TitleBarMode` import)
- Modify: `platform/desktopBridge.ts` (remove `titleBar`; drop `TitleBarMode` import)
- Modify: `platform/desktop.ts` (remove `titleBar` block)
- Modify: `platform/web.ts` (remove `webTitleBar` + `titleBar` entry)
- Modify: `App.tsx` (remove the theme-sync effect and the `useTheme` import)

**Interfaces:**
- Consumes: nothing (the surface it removes was fully implemented).
- Produces: `Platform` no longer has a `titleBar` member; `IPC.titleBar` no longer exists; `electron/titleBarTheme.ts` and its test are gone.

- [ ] **Step 1: Delete the theme module and its test**

```bash
git rm electron/titleBarTheme.ts electron/titleBarTheme.test.ts
```

- [ ] **Step 2: Remove the IPC channel**

In `electron/ipc.ts`, delete the whole block:

```ts
  titleBar: {
    setTheme: 'nebula:title-bar:set-theme',
  },
```

- [ ] **Step 3: Remove the preload block**

In `electron/preload.ts`, delete the whole block:

```ts
  titleBar: {
    setTheme: (mode) => {
      ipcRenderer.send(IPC.titleBar.setTheme, mode);
    },
  },
```

- [ ] **Step 4: Remove from `Platform`**

In `platform/types.ts`:
- Delete `import type { TitleBarMode } from '../electron/titleBarTheme';`
- Delete:
```ts
  /** Syncs the Windows overlay controls to the app theme (no-op on web). */
  readonly titleBar: { setTheme(mode: TitleBarMode): void };
```

- [ ] **Step 5: Remove from `DesktopBridge`**

In `platform/desktopBridge.ts`:
- Delete `import type { TitleBarMode } from '../electron/titleBarTheme';`
- Delete:
```ts
  titleBar: {
    setTheme(mode: TitleBarMode): void;
  };
```

- [ ] **Step 6: Remove from the desktop platform**

In `platform/desktop.ts`, delete:

```ts
    titleBar: {
      setTheme: (mode) => bridge.titleBar.setTheme(mode),
    },
```

- [ ] **Step 7: Remove from the web platform**

In `platform/web.ts`:
- Delete `const webTitleBar = { setTheme: (): void => {}, };`
- Delete `  titleBar: webTitleBar,` from the returned object.

- [ ] **Step 8: Remove the renderer theme-sync effect**

In `App.tsx`:
- Delete `import { useTheme } from './context/ThemeContext';`
- Delete:
```ts
  const theme = useTheme();
```
- Delete:
```ts
  useEffect(() => {
    if (platform) platform.titleBar.setTheme(theme.mode);
  }, [platform, theme.mode]);
```
- `platform` (`usePlatform()`) is used **only** by this effect in `App.tsx` — delete `const platform = usePlatform();` and the `import { usePlatform } from './platform/PlatformContext';` line as well, otherwise the variables become orphaned dead code.
- Verify `theme` is not referenced anywhere else in `App.tsx` (only `settings.theme.*` on the store's settings object remains — that is unrelated and must stay). `useEffect` is still imported and used elsewhere in the file (lines 92, 97).

- [ ] **Step 9: Verify types + full test suite**

Run: `npm run typecheck; if ($?) { npm test }`
Expected: typecheck clean; the full suite passes with the `titleBarTheme` tests removed.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(desktop): Remove the window controls overlay theme surface"
```

---

### Task 4: TopBar rewrite — drag fix + custom window controls

**Files:**
- Rewrite: `components/layout/TopBar.tsx`

**Interfaces:**
- Consumes: `usePlatform` from `../../platform/PlatformContext`; `WindowControl.onMaximizeChanged`, `minimize`, `toggleMaximize`, `close`, `isMaximized` (Tasks 1–2); lucide icons.
- Produces: The `<header>` is a working drag region on Windows (blur moved to a `pointer-events: none` child); custom win32-only window controls after the Settings button with a live maximize/restore icon; double-click-to-maximize works natively.

- [ ] **Step 1: Replace the whole component**

Replace the full contents of `components/layout/TopBar.tsx` with:

```tsx
import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Copy, Menu, Minus, Search, Settings, Square, X } from 'lucide-react';
import { useStore } from '../../context/Store';
import { usePlatform } from '../../platform/PlatformContext';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

interface TopBarProps {
    onMenuClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
    const { openSearchModal, setView, currentView } = useStore();
    const platform = usePlatform();
    const [isMaximized, setIsMaximized] = useState(false);

    const isWindows = platform?.info.os === 'win32';

    useEffect(() => {
        if (!isWindows) return;
        void platform.window.isMaximized().then(setIsMaximized);
        return platform.window.onMaximizeChanged(setIsMaximized);
    }, [platform, isWindows]);

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
            style={appRegion('drag')}
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
                {isWindows && (
                    <>
                        <button
                            onClick={() => void platform.window.minimize()}
                            className="p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95"
                            aria-label="Minimize"
                            style={appRegion('no-drag')}
                        >
                            <Minus className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => void platform.window.toggleMaximize()}
                            className="p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95"
                            aria-label={isMaximized ? 'Restore' : 'Maximize'}
                            style={appRegion('no-drag')}
                        >
                            {isMaximized ? <Copy className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={() => void platform.window.close()}
                            className="p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95"
                            aria-label="Close"
                            style={appRegion('no-drag')}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </>
                )}
            </div>
        </header>
    );
};
```

- [ ] **Step 2: Verify types + build**

Run: `npm run typecheck; if ($?) { npm run build }`
Expected: both succeed (renderer bundle regenerates with the new controls).

- [ ] **Step 3: Commit**

```bash
git add components/layout/TopBar.tsx
git commit -m "feat(desktop): Render custom window controls in the TopBar with a fixed drag region"
```

---

### Task 5: Full verification and Electron smoke test

**Files:**
- None (verification + commit only).

- [ ] **Step 1: Run the full build/test suite**

Run: `npm run typecheck`
Run: `npm test`
Run: `npm run build`
Run: `npm run build:main`
Expected: all four succeed; the full test suite passes (with `titleBarTheme.test.ts` removed).

- [ ] **Step 2: Electron boot smoke test**

Run: `npm run start:electron` (Windows machine)
Expected:
- stdout shows `[nebula] renderer loaded`; no CSP/console errors on stderr.
- The window has no native frame: Nebula's design extends to the top edge, and the three custom controls (Minus / Square / X) render directly after the Settings button.
- Dragging the header moves the window.
- Double-clicking the header maximizes and restores.
- The minimize button minimizes; the maximize button toggles maximize/restore and its icon switches between `Square` and `Copy`; the close button hides the window (tray app behavior, `trayOnClose` default `true`).
- Edge-resize and Aero Snap (drag header to the top edge) still work.
- Dark/light theme toggle recolors the header including the new buttons (no overlay path involved).

Close the app via the tray `Quit` item; confirm the process exits cleanly. Confirm the tray icon sits in the Windows notification-area **overflow chevron** (apps cannot force-pin it — documented, not a bug).

- [ ] **Step 3: Commit any remaining changes**

```bash
git status --porcelain
```

Expected: clean. (If not, commit the stragglers with an appropriate `feat(desktop): ...` message.)

---

## Self-Review

**Spec coverage:** The design doc requires (1) win32-only `frame: false` on the main window → Task 2; (2) `maximizeChanged` push channel + `onMaximizeChanged` platform surface incl. web no-op → Task 1; (3) removal of `titleBarTheme.ts`, `IPC.titleBar.setTheme`, `Platform.titleBar`, and the `App.tsx` theme-sync effect → Task 3; (4) TopBar drag fix (blur moved to `pointer-events: none` child) + custom controls after Settings with neutral close hover + `env(titlebar-area-width)` padding removal → Task 4; (5) full build/test + manual Windows smoke incl. drag, double-click, buttons, resize/snap, tray overflow → Task 5. Tray overflow is documented, not coded, per the spec. All covered.

**Placeholder scan:** Every step has exact code, exact file edits, or an exact command; no "TBD"/"similar to" references. The `webWindow` inline `onMaximizeChanged: () => () => {}` deliberately avoids a TDZ hazard (the `noopUnsubscribe` const is declared after `webWindow`).

**Type consistency:** `IPC.window.maximizeChanged` is defined once (Task 1) and referenced identically in `preload.ts` (Task 1) and `main.ts` (Task 2). `onMaximizeChanged(handler: (maximized: boolean) => void): () => void` is identical across `types.ts`, `desktopBridge.ts`, `preload.ts`, `desktop.ts`, and `web.ts`. Task 4 consumes `platform.window.onMaximizeChanged`, `minimize`, `toggleMaximize`, `close`, `isMaximized`, and `platform?.info.os === 'win32'` — all produced by Tasks 1–2. The WCO surface names removed in Task 3 (`IPC.titleBar.setTheme`, `Platform.titleBar`, `TitleBarMode`, `webTitleBar`, `DEFAULT_TITLE_BAR`) are exactly those introduced by the superseded overlay plan and touched only there.
