# Windows Title Bar Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Windows main window's title bar adopt Nebula's design via Electron Window Controls Overlay — native Win11 minimize/maximize/close buttons floating over a themed, draggable 64px app header.

**Architecture:** The main window gets `titleBarStyle: 'hidden'` + `titleBarOverlay` on win32 only; the existing `TopBar` (64px header) becomes the drag region and reserves space for the native buttons with `env(titlebar-area-width)`. A pure `electron/titleBarTheme.ts` module maps light/dark to overlay colors, the renderer syncs the persisted theme to main over a new `titleBar:set-theme` IPC channel, and the platform boundary (`preload` → `DesktopBridge` → `Platform`) is extended with a `titleBar.setTheme(mode)` no-op on web.

**Tech Stack:** Electron 43 (`BrowserWindow` WCO API, `setTitleBarOverlay`), React 19 + Tailwind (renderer `TopBar`), TypeScript, Vitest (pure-logic tests), Vite/esbuild.

## Global Constraints

- Overlay/`titleBarStyle` must be applied **only when `process.platform === 'win32'`**; non-Windows keeps the stock frame.
- `titleBarOverlay.height` must equal the header height **64** (matches the existing `h-16` `TopBar`).
- Overlay colors: dark = `color: '#0b0b12'`, `symbolColor: '#ffffff'`; light = `color: '#fafafa'`, `symbolColor: '#0a0a0a'`.
- Web build must be unchanged: use `env(titlebar-area-width, 100%)` fallback for the reserved padding and a no-op `titleBar` API in `platform/web.ts`.
- No changes to `electron-builder.yml`, CSP, sandbox, or `contextIsolation`.
- The mini-player window and its drag region are untouched.
- Every task ends green on `npm run typecheck` (and `npm test` for tasks that add tests) before the commit step.
- Commit style: `feat(desktop): ...` conventional commits, one commit per task.

---

### Task 1: Title-bar theme module + unit tests

**Files:**
- Create: `electron/titleBarTheme.ts`
- Create: `electron/titleBarTheme.test.ts`

**Interfaces:**
- Consumes: nothing (standalone pure module).
- Produces (used by Tasks 2–5):
  - `export type TitleBarMode = 'light' | 'dark'`
  - `export interface TitleBarOverlayColors { color: string; symbolColor: string; height: number }`
  - `export const DEFAULT_TITLE_BAR: TitleBarOverlayColors` (dark)
  - `export const isTitleBarMode(value: unknown): value is TitleBarMode`
  - `export const titleBarThemeFor(mode: TitleBarMode): TitleBarOverlayColors`

- [ ] **Step 1: Write the failing test**

Create `electron/titleBarTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TITLE_BAR,
  isTitleBarMode,
  titleBarThemeFor,
} from './titleBarTheme';

describe('titleBarTheme', () => {
  it('defaults to the dark overlay', () => {
    expect(DEFAULT_TITLE_BAR).toEqual({
      color: '#0b0b12',
      symbolColor: '#ffffff',
      height: 64,
    });
  });

  it('maps dark mode to the dark colors and the 64px height', () => {
    expect(titleBarThemeFor('dark')).toEqual(DEFAULT_TITLE_BAR);
  });

  it('maps light mode to light colors and the 64px height', () => {
    expect(titleBarThemeFor('light')).toEqual({
      color: '#fafafa',
      symbolColor: '#0a0a0a',
      height: 64,
    });
  });

  it('validates the title bar mode', () => {
    expect(isTitleBarMode('light')).toBe(true);
    expect(isTitleBarMode('dark')).toBe(true);
    expect(isTitleBarMode('system')).toBe(false);
    expect(isTitleBarMode(null)).toBe(false);
    expect(isTitleBarMode(42)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/titleBarTheme.test.ts -t "defaults to the dark overlay"`
Expected: FAIL with "Failed to resolve import ./titleBarTheme" / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `electron/titleBarTheme.ts`:

```ts
export type TitleBarMode = 'light' | 'dark';

export interface TitleBarOverlayColors {
  color: string;
  symbolColor: string;
  height: number;
}

const THEMES: Record<TitleBarMode, TitleBarOverlayColors> = {
  dark: { color: '#0b0b12', symbolColor: '#ffffff', height: 64 },
  light: { color: '#fafafa', symbolColor: '#0a0a0a', height: 64 },
};

export const DEFAULT_TITLE_BAR = THEMES.dark;

export const isTitleBarMode = (value: unknown): value is TitleBarMode =>
  value === 'light' || value === 'dark';

export const titleBarThemeFor = (mode: TitleBarMode): TitleBarOverlayColors =>
  THEMES[mode];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/titleBarTheme.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/titleBarTheme.ts electron/titleBarTheme.test.ts
git commit -m "feat(desktop): Add pure title-bar theme mapping for the overlay"
```

---

### Task 2: IPC channel, preload bridge, and platform API surface

**Files:**
- Modify: `electron/ipc.ts` (add `titleBar` namespace after `updater`)
- Modify: `electron/preload.ts` (add `titleBar` to the bridge object)
- Modify: `platform/types.ts` (add `titleBar` to `Platform`; import `TitleBarMode`)
- Modify: `platform/desktopBridge.ts` (add `titleBar` to `DesktopBridge`; import `TitleBarMode`)
- Modify: `platform/desktop.ts` (wire `titleBar` into the returned `Platform`)
- Modify: `platform/web.ts` (no-op `titleBar`)

**Interfaces:**
- Consumes: `TitleBarMode` from `../electron/titleBarTheme` (Task 1), `IPC.titleBar.setTheme`.
- Produces:
  - Channel constant `IPC.titleBar.setTheme` = `'nebula:title-bar:set-theme'`.
  - `DesktopBridge.titleBar.setTheme(mode: TitleBarMode): void`
  - `Platform.titleBar.setTheme(mode: TitleBarMode): void` (web = no-op).

- [ ] **Step 1: Add the IPC channel**

In `electron/ipc.ts`, after the `updater` block and before the closing `} as const;`, add:

```ts
  titleBar: {
    setTheme: 'nebula:title-bar:set-theme',
  },
```

- [ ] **Step 2: Add the channel to the preload bridge**

In `electron/preload.ts`, after the `updater` block and before the closing `};` of `bridge`, add:

```ts
  titleBar: {
    setTheme: (mode) => {
      ipcRenderer.send(IPC.titleBar.setTheme, mode);
    },
  },
```

- [ ] **Step 3: Extend `DesktopBridge`**

In `platform/desktopBridge.ts`, add `import type { TitleBarMode } from '../electron/titleBarTheme';` and, after the `updater` block in the interface, add:

```ts
  titleBar: {
    setTheme(mode: TitleBarMode): void;
  };
```

- [ ] **Step 4: Extend `Platform`**

In `platform/types.ts`, add `import type { TitleBarMode } from '../electron/titleBarTheme';` and, after `readonly updater: UpdaterApi;`, add:

```ts
  /** Syncs the Windows overlay controls to the app theme (no-op on web). */
  readonly titleBar: { setTheme(mode: TitleBarMode): void };
```

- [ ] **Step 5: Wire the desktop platform**

In `platform/desktop.ts`, in the returned object after `updater: { ... },`, add:

```ts
    titleBar: {
      setTheme: (mode) => bridge.titleBar.setTheme(mode),
    },
```

- [ ] **Step 6: Add the web no-op**

In `platform/web.ts`, after `const webUpdater: UpdaterApi = { ... };`, add:

```ts
const webTitleBar = {
  setTheme: (): void => {},
};
```

and in the returned object after `updater: webUpdater,`, add:

```ts
  titleBar: webTitleBar,
```

- [ ] **Step 7: Verify types**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add electron/ipc.ts electron/preload.ts platform/types.ts platform/desktopBridge.ts platform/desktop.ts platform/web.ts
git commit -m "feat(desktop): Add titleBar setTheme IPC channel and platform API"
```

---

### Task 3: Main-process window options and overlay theme handler

**Files:**
- Modify: `electron/main.ts` (imports; `titleBarColors` state; `createWindow()` options; `registerIpc()` handler)

**Interfaces:**
- Consumes: `DEFAULT_TITLE_BAR`, `isTitleBarMode`, `titleBarThemeFor` (Task 1); `IPC.titleBar.setTheme` (Task 2).
- Produces: The main window is frameless-with-overlay on win32; `setTitleBarOverlay` is updated when the renderer syncs the theme.

- [ ] **Step 1: Import the theme helpers**

In `electron/main.ts`, after the `createUpdater` import, add:

```ts
import { DEFAULT_TITLE_BAR, isTitleBarMode, titleBarThemeFor } from './titleBarTheme';
```

- [ ] **Step 2: Add overlay state**

In `electron/main.ts`, after `let updater: Updater;`, add:

```ts
let titleBarColors = DEFAULT_TITLE_BAR;
```

- [ ] **Step 3: Apply WCO to the main window (win32 only)**

In `createWindow()`, inside the `new BrowserWindow({ ... })` options object, after `minHeight: WINDOW_MIN.height,` and before `show: false,`, add:

```ts
    ...(process.platform === 'win32'
      ? { titleBarStyle: 'hidden' as const, titleBarOverlay: { ...titleBarColors } }
      : {}),
```

- [ ] **Step 4: Add the overlay theme handler**

In `registerIpc()`, after the `IPC.window.isFullScreen` handler and before the `IPC.settings.get` handler, add:

```ts
  ipcMain.on(IPC.titleBar.setTheme, (_event, mode: unknown) => {
    if (process.platform !== 'win32') return;
    if (!isTitleBarMode(mode)) return;
    titleBarColors = titleBarThemeFor(mode);
    mainWindow?.setTitleBarOverlay({ ...titleBarColors });
  });
```

- [ ] **Step 5: Verify build**

Run: `npm run typecheck; if ($?) { npm run build:main }`
Expected: both succeed (no errors; `electron/dist/main.cjs` regenerates).

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts
git commit -m "feat(desktop): Apply window controls overlay to the Windows main window"
```

---

### Task 4: Renderer theme-sync effect

**Files:**
- Modify: `App.tsx` (imports; `useEffect` in `AppContent`)

**Interfaces:**
- Consumes: `usePlatform` from `./platform/PlatformContext`, `useTheme` from `./context/ThemeContext`, `Platform.titleBar.setTheme` (Task 2).
- Produces: On mount and on every theme change, `platform.titleBar.setTheme(mode)` is called (no-op when `platform` is null, e.g. during platform bootstrap or web fallback).

- [ ] **Step 1: Add imports**

In `App.tsx`, after the `DesktopOwnerBridgeProvider` import, add:

```ts
import { usePlatform } from './platform/PlatformContext';
import { useTheme } from './context/ThemeContext';
```

- [ ] **Step 2: Add the sync effect**

In `AppContent`, after the `mainRef` `useRef` line and before `handleGlobalShortcuts`, add:

```ts
  const platform = usePlatform();
  const theme = useTheme();

  useEffect(() => {
    if (platform) platform.titleBar.setTheme(theme.mode);
  }, [platform, theme.mode]);
```

The effect runs before the `if (!credentials && !isDemoMode) return <SetupScreen />;` early return, so the overlay is themed even before credentials exist.

- [ ] **Step 3: Verify types + build**

Run: `npm run typecheck; if ($?) { npm run build }`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(desktop): Sync the title bar overlay theme with the app theme"
```

---

### Task 5: TopBar becomes the draggable title bar

**Files:**
- Modify: `components/layout/TopBar.tsx` (imports; header style; per-button no-drag styles)

**Interfaces:**
- Consumes: nothing new (inline `CSSProperties` pattern already used by `mini-player.tsx`).
- Produces: The `<header>` is the drag region and reserves the native-button strip; interactive children are `no-drag`. Web layout is byte-for-byte unchanged via the `env()` fallback.

- [ ] **Step 1: Add the CSSProperties import and helper**

In `components/layout/TopBar.tsx`, change the first line from `import React from 'react';` to:

```ts
import React from 'react';
import type { CSSProperties } from 'react';
```

and after the imports, add:

```ts
const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
  ({ WebkitAppRegion: region }) as CSSProperties;
```

- [ ] **Step 2: Make the header the drag region with reserved button space**

Replace the `<header className="h-16 ...">` opening tag so it carries the drag region and the reserved padding:

```tsx
        <header
          className="h-16 flex items-center justify-between px-6 border-b border-neutral-200 dark:border-white/5 bg-white/80 dark:bg-black/20 backdrop-blur-xl sticky top-0 z-30"
          style={{
            ...appRegion('drag'),
            paddingRight: 'calc(100% - env(titlebar-area-width, 100%))',
          }}
        >
```

- [ ] **Step 3: Mark the interactive buttons as no-drag**

Add `style={appRegion('no-drag')}` to each of these four buttons:
- the menu button (the `onClick={onMenuClick}` button with the `Menu` icon),
- the logo button (the `onClick={() => setView('HOME')}` button),
- the search button (`onClick={openSearchModal}`),
- the settings button (`onClick={() => setView('SETTINGS')}`).

- [ ] **Step 4: Verify types + build**

Run: `npm run typecheck; if ($?) { npm run build }`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add components/layout/TopBar.tsx
git commit -m "feat(desktop): Make the TopBar the Windows drag region with reserved overlay space"
```

---

### Task 6: Full verification and Electron smoke test

**Files:**
- None (verification + commit only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run typecheck`
Run: `npm test`
Run: `npm run build`
Run: `npm run build:main`
Expected: all four succeed; the full suite (including the new `electron/titleBarTheme.test.ts`) passes.

- [ ] **Step 2: Electron boot smoke test**

Run: `npx electron .` (Windows machine)
Expected:
- stdout shows `[nebula] renderer loaded`; no stderr (no CSP/console errors).
- The window shows a frameless top bar: Nebula design extends to the top edge, native Win11 minimize/maximize/close buttons render top-right with dark colors.
- The header drags the window; double-clicking the header maximizes/restores.
- Toggling dark/light theme recolors the overlay buttons (light: near-white bg + dark symbols).

Close the app; confirm the tray icon remains and the app exits cleanly on `Quit`.

- [ ] **Step 3: Commit any remaining changes**

If any working-tree changes remain from the smoke test, stage and commit them:

```bash
git status --porcelain
```

Expected: clean. (If not, commit the stragglers with an appropriate `feat(desktop): ...` message.)

---

## Self-Review

**Spec coverage:** The design doc requires (1) win32-only WCO options on the main window → Task 3; (2) a `title-bar:set-theme` channel → Task 2; (3) preload/platform surface incl. web no-op → Task 2; (4) renderer theme sync on mount+change before the `SetupScreen` early return → Task 4; (5) TopBar drag region + `env(titlebar-area-width, 100%)` reserved padding with no-drag on the four buttons → Task 5; (6) theme colors from the design table → Task 1. All covered.

**Placeholder scan:** Every step has concrete code or an exact command; no "TBD"/"similar to" refs. `electron/updater.test.ts` was consulted to mirror the vitest import style.

**Type consistency:** `TitleBarMode` / `TitleBarOverlayColors` / `isTitleBarMode` / `titleBarThemeFor` / `DEFAULT_TITLE_BAR` are defined once in Task 1 and reused identically in Tasks 2–4. The channel constant `IPC.titleBar.setTheme` matches between `ipc.ts` (Task 2), `preload.ts` (Task 2), and `main.ts` (Task 3). `Platform.titleBar.setTheme(mode: TitleBarMode): void` is consistent across `types.ts`, `desktop.ts`, and `web.ts`.
