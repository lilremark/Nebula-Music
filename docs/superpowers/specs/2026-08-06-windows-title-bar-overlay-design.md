# Nebula Desktop — Windows Title Bar Overlay Design

- Status: Approved
- Date: 2026-08-06
- Scope: Phase 2 (Windows-native UI integration, internal only)

## 1. Problem

Nebula Desktop on Windows currently uses the stock OS title bar. The rest of the
app is a fully custom, design-driven UI (gradients, glass, dark/light themes).
The native frame breaks the visual language: an unthemed caption bar sits on top
of a themed app, and the app gains no benefit from the bar (no drag affordance,
no in-app controls).

We want the title bar to adopt the app's design for a more unified Windows
experience while keeping Windows-native window management.

## 2. Non-goals

- No macOS/Linux title bar work (stock frame stays on non-Windows).
- No custom (React-rendered) minimize/maximize/close buttons.
- No settings toggle / runtime frame rebuild (always-on for the Windows main window).
- No changes to the mini-player (already frameless with a drag region).
- No `electron-builder.yml` / packaging changes.

## 3. Decision: Window Controls Overlay (WCO)

Use Electron's Window Controls Overlay on the main window:

- `titleBarStyle: 'hidden'` removes the OS caption bar.
- `titleBarOverlay` keeps Windows' native minimize/maximize/close buttons drawn
  by the OS over the app's top-right corner, preserving Win11 snap flyouts, the
  system menu, double-click maximize, drag, and keyboard window management.
- The app's own content fills the whole window, including the former title bar
  area, so Nebula's design extends to the very top.

This is preferred over a fully custom frameless window because it keeps native
behaviors (snap layouts, system menu, accessibility, RTL) with far less code and
no hit-testing/drag reimplementation. It is preferred over keeping the stock
frame because the app design unifies the bar.

### Why not custom buttons?

The window-control IPC (`window.minimize` / `toggleMaximize` / `close` /
`isMaximized` / `isFullScreen`) already exists in `preload.ts` and the platform
adapters and could power React-rendered buttons. But native overlay buttons give
us Win11-specific behavior (snap flyout, system menu, hover animations) for free
and are the more "Windows-native" option. The existing IPC is left in place and
unused (it remains a valid escape hatch for a future "stock frame" setting).

## 4. Design

### 4.1 Main process (`electron/main.ts`)

- Module state: `let titleBarColors = { color: '#0b0b12', symbolColor: '#ffffff' }`
  (dark default; matches the window `backgroundColor: '#0b0b12'`).
- `createWindow()`: when `process.platform === 'win32'`, add to the
  `BrowserWindow` options:
  - `titleBarStyle: 'hidden'`
  - `titleBarOverlay: { ...titleBarColors, height: 64 }` (height matches the
    existing 64px `TopBar` header).
- New IPC handler `IPC.titleBar.setTheme` (renderer → main, send-only):
  - Validate `mode` is `'light' | 'dark'`.
  - Update `titleBarColors`:
    - light: `color: '#fafafa'`, `symbolColor: '#0a0a0a'`
    - dark: `color: '#0b0b12'`, `symbolColor: '#ffffff'`
  - Call `mainWindow?.setTitleBarOverlay({ ...titleBarColors, height: 64 })`.
  - Guard with `process.platform === 'win32'` (no-op elsewhere).

The overlay starts dark because the main process does not know the persisted
theme at boot (the theme lives in the renderer's `localStorage`). The renderer
syncs the real theme on mount via the same IPC before the window's first paint
(the window is shown on `ready-to-show`).

### 4.2 IPC / preload / platform surface

- `electron/ipc.ts`: add `titleBar: { setTheme: 'title-bar:set-theme' }`.
- `electron/preload.ts`: expose `window.titleBar.setTheme(mode)` → sends the
  validated string on `IPC.titleBar.setTheme`.
- `platform/types.ts`: extend the window-controls surface with
  `titleBar: { setTheme(mode: 'light' | 'dark'): void }`.
- `platform/desktopBridge.ts` / `platform/desktop.ts`: thread the call through.
- `platform/web.ts`: `titleBar.setTheme` is a no-op (web has no frame).

### 4.3 Theme sync (`App.tsx` `AppContent`)

- New `useEffect` keyed on `useTheme().mode`:
  - Calls `platform.titleBar.setTheme(mode)` on mount **and** on every theme
    change, so the overlay colors always match the app theme.
  - Runs before the `SetupScreen` early-return (hooks order is preserved), so
    even unauthenticated windows get correct overlay colors.
- Placement in `AppContent` rather than `ThemeContext` because `PlatformProvider`
  wraps `ThemeProvider`; `ThemeContext` cannot call `usePlatform`.

### 4.4 `TopBar` becomes the title bar (`components/layout/TopBar.tsx`)

- The `<header>` keeps `h-16` (64px), matching `titleBarOverlay.height`.
- The header gets an inline `WebkitAppRegion: 'drag'` so the whole bar drags the
  window (same pattern already used by `mini-player.tsx`).
- Interactive children (menu button, logo button, search button, settings
  button) each get `WebkitAppRegion: 'no-drag'`.
- The header's right side reserves the native-button strip with
  `padding-right: calc(100% - env(titlebar-area-width, 100%))`:
  - Windows/WCO: `env(titlebar-area-width)` is the draggable width, so the
    padding equals the native buttons' width and the search/settings buttons
    never sit under them.
  - Web: the `env()` fallback makes the padding `0`, so layout is unchanged.
- No other layout or class changes.

### 4.5 Theme colors

| Mode  | Overlay background (`color`) | Symbols (`symbolColor`) |
| ----- | ---------------------------- | ----------------------- |
| dark  | `#0b0b12`                    | `#ffffff`               |
| light | `#fafafa`                    | `#0a0a0a`               |

## 5. Edge cases & constraints

- **First paint**: overlay defaults to dark; the renderer corrects to the
  persisted theme on mount. Because the window shows on `ready-to-show`, any
  mismatch is at most one frame and matches the `#0b0b12` background.
- **Maximized / snap**: native behavior handled by WCO; no renderer work.
- **Web build**: `env()` fallbacks + no-op `titleBar` API keep the web layout
  byte-for-byte identical.
- **macOS / Linux**: the win32 guard leaves the stock frame untouched.
- **Security**: sandbox + `contextIsolation` + CSP untouched; the new channel
  carries a single validated string.

## 6. Files

- `electron/main.ts` — window options, overlay state, `titleBar.setTheme` handler.
- `electron/ipc.ts` — channel constant.
- `electron/preload.ts` — `window.titleBar.setTheme` bridge.
- `platform/types.ts`, `platform/desktopBridge.ts`, `platform/desktop.ts`,
  `platform/web.ts` — `titleBar` API surface.
- `components/layout/TopBar.tsx` — drag region + reserved right padding.
- `App.tsx` — theme → overlay sync effect.

## 7. Verification

1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. `npm run build:main`
5. Electron boot smoke test (`npx electron .` on Windows): renderer loads, no
   stderr, native overlay buttons render top-right, window drags by the header,
   double-click maximizes, theme toggle recolors the overlay.
