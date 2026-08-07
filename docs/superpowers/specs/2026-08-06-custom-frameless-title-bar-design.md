# Custom Frameless Title Bar + Window Controls

Date: 2026-08-06
Status: Draft
Branch: `feat/desktop-edition`

## Problem

The Windows desktop edition ships the native Window-Controls-Overlay (WCO)
title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`). User feedback on the
current build:

1. The native window-control buttons don't blend with the app design.
2. Dragging the header to move the window does not work.
3. Double-clicking the header does not maximize.
4. The tray icon never appears.

Root causes found during brainstorming:

- **(1)** WCO renders OS-native buttons that can only be recolored, not restyled
  to match the app.
- **(2, 3)** The TopBar drag header applies `backdrop-blur-xl` directly on the
  element with `-webkit-app-region: drag`. On Windows, the backdrop filter
  creates a compositing layer that swallows the mousedown before the drag
  region sees it, killing both drag and the native double-click-to-maximize
  caption behavior. The mini-player header drags correctly because it has no
  backdrop filter. This matches the fix pattern in harness-kit PR #38
  (backdrop-filter must move to a `pointer-events: none` child).
- Additionally, Electron issue #43371 notes `-webkit-app-region: drag` has no
  effect on Windows under `titleBarStyle: 'hidden'` (regression since 31.4.0,
  still present in 32.x). The app pins `electron ^43.3.0`.
- **(4)** `new Tray()` with the embedded 32x32 PNG succeeds (verified
  empirically on this machine). The icon is being created correctly but lands
  in the Windows notification-area overflow chevron by default; apps cannot
  force-pin a tray icon. No code fix is possible; document it.

## Goals

- Render custom React window controls (minimize / maximize-restore / close)
  that blend with the app design, on Windows only.
- Make the header a working drag region on Windows.
- Restore native double-click-to-maximize on the header.
- Keep native resize edges, Aero Snap, and shadow on the frameless window.
- Remove the now-unneeded WCO theme-sync surface cleanly.
- Document the tray overflow behavior (no code change).

## Non-Goals

- No macOS/Linux changes: they keep the native title bar (custom controls do
  not render).
- No tray-icon code change (verified working; overflow is an OS setting).
- No behavior change to the mini-player window (already frameless and correct).

## Approach: Full custom frameless window

Replace WCO with `frame: false` on win32 and render our own window controls.

### 1. Window shell (`electron/main.ts`)

- Replace the win32 branch in `createWindow`:
  ```ts
  ...(process.platform === 'win32' ? { frame: false } : {})
  ```
- `thickFrame` remains default (`true`) → native resize borders, shadow, and
  Aero Snap on a frameless window.
- Remove `titleBarColors` (module var), the `titleBarTheme` import, and the
  `ipcMain.on(IPC.titleBar.setTheme, ...)` handler.
- Non-win32 platforms keep the current native chrome.

### 2. Maximize-state push channel

Renderer needs the live maximize state to switch the maximize/restore icon.

- `electron/ipc.ts`: add `window.maximizeChanged: 'nebula:window:maximize-changed'`.
- `electron/main.ts` `createWindow`: subscribe
  `win.on('maximize')` / `win.on('unmaximize')` and
  `win.webContents.send(IPC.window.maximizeChanged, <boolean>)`.
- Initial state still read once via the existing `isMaximized()` invoke.

### 3. Platform surface

- `platform/types.ts`:
  - `WindowControl` gains `onMaximizeChanged(handler: (maximized: boolean) => void): () => void`.
  - Remove `titleBar` from `Platform` and the `TitleBarMode` import.
- `platform/desktopBridge.ts`: mirror the add/remove; drop `TitleBarMode` import.
- `electron/preload.ts`: implement `onMaximizeChanged` as an
  `ipcRenderer.on` subscription returning an unsubscribe function.
- `platform/desktop.ts`: wire `onMaximizeChanged` through; remove `titleBar` block.
- `platform/web.ts`: `webWindow` gains `onMaximizeChanged: () => noopUnsubscribe`;
  remove `webTitleBar`.

### 4. Remove WCO theme surface

- Delete `electron/titleBarTheme.ts` and `electron/titleBarTheme.test.ts`.
- Remove the `App.tsx` effect `if (platform) platform.titleBar.setTheme(theme.mode);`
  and the `useTheme` import if it becomes unused.

### 5. TopBar rewrite (`components/layout/TopBar.tsx`)

- Keep `<header>` as the drag element with `appRegion('drag')`.
- Move `backdrop-blur-xl` + translucent background off the `<header>` into a
  separate `absolute inset-0 pointer-events-none` child so the blur layer no
  longer intercepts mousedown.
- Remove `paddingRight: 'calc(100% - env(titlebar-area-width, 100%))'`
  (a WCO-only CSS variable; meaningless with `frame: false`).
- Render window controls (right side, directly after the Settings button, no
  divider) only when `platform?.info.os === 'win32'`:
  - Buttons: Minimize (`Minus`), Maximize/Restore (`Square` / `Copy`),
    Close (`X`), all lucide icons, each `appRegion('no-drag')`.
  - Styling matches the existing icon buttons exactly:
    `p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 ...`
    **Close uses the same neutral hover — no red tint** (user decision).
  - `isMaximized` state subscribed via `platform.window.onMaximizeChanged`;
    initial value from `platform.window.isMaximized()`.
  - Actions: `platform.window.minimize()`, `platform.window.toggleMaximize()`,
    `platform.window.close()`.
- Double-click-to-maximize is provided natively by Windows because the drag
  region is a real `HTCAPTION` on the `frame: false` path.

### 6. Tests & verification

- Delete `electron/titleBarTheme.test.ts` (only test touching the removed module).
- No new unit tests for TopBar (project has no component test harness; the
  component behavior is verified by the manual Windows smoke test).
- Verify in order: `npm run typecheck`, `npm run test`, `npm run build`,
  `npm run build:main`, boot smoke, then manual Windows checks:
  - drag header moves window; double-click maximizes/restores;
  - minimize / maximize / close buttons work; maximize button icon toggles;
  - edge-resize and Aero Snap still work;
  - tray icon present in the notification-area overflow chevron.

## Open Questions

- None. Tray behavior is documented (OS overflow setting), not code.

## Related

- Supersedes `2026-08-06-windows-title-bar-overlay-design.md` and its plan.
- Keep the `frame: false` change scoped to the main window only; the
  mini-player already uses `frame: false` and is unaffected.
