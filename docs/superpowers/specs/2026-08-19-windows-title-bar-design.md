# Windows Title Bar Design

## Problem

The custom window controls (minimize, maximize/restore, close) sit inline in
the main TopBar, the full-screen player header, and the sign-in screen. The
user wants the window actions on Windows in their own slim bar above the app's
function bar, matching the app's existing design language. macOS already has
this pattern via `MacTitleBar` (a 32px strip above the TopBar).

## Goal

Add a dedicated Windows title-bar strip above the app functions, following the
existing `MacTitleBar` pattern and the app's design language (lucide icons,
rounded hover states, blur background, drag region). No new IPC or preload
surface — reuse the existing `WindowControls` component.

## Decisions

- **Approach A** (selected): new `components/layout/WindowsTitleBar.tsx`
  self-gating on `os === 'win32'`, mirroring `MacTitleBar`.
- **Scope**: main window + full-screen player. The sign-in screen keeps its
  current inline controls (unchanged).
- **Bar contents**: main window shows a centered "Nebula" wordmark with window
  controls on the right; the full-screen player shows a controls-only strip
  (no wordmark).
- **Button styling**: keep the existing app-consistent style (rounded-xl,
  neutral hover, no red close tint).

## Layout

Main window, Windows only:

```
┌──────────────────────────────────────────┐
│              Nebula            ─  ▢  ×  │  ← WindowsTitleBar (drag region)
├──────────────────────────────────────────┤
│ ≡  ♫  Home       ...       ⌕  ⚙         │  ← existing TopBar (window controls removed)
└──────────────────────────────────────────┘
```

Full-screen player, Windows only:

```
┌──────────────────────────────────────────┐
│                              ─  ▢  ×    │  ← controls-only strip (drag region)
├──────────────────────────────────────────┤
│ ⌄          Now Playing   tab  ...  ⧉  ⌾ │  ← existing player header (unchanged)
└──────────────────────────────────────────┘
```

## Components

### New: `components/layout/WindowsTitleBar.tsx`

- `usePlatform()`; renders `null` unless `platform.info.os === 'win32'`.
- Height `h-8`, `flex items-center justify-between px-3`, same blur/background
  treatment as `MacTitleBar` (`bg-white/80 dark:bg-black/20 backdrop-blur-xl`
  on a `pointer-events-none` child) and same `border-b`.
- Whole strip is `-webkit-app-region: drag`; only interactive children are
  `no-drag` (the `WindowControls` buttons already set this internally).
- Left spacer + centered `Nebula` wordmark (`font-bold tracking-tight
  text-neutral-900 dark:text-white`), matching `MacTitleBar` so both platforms
  read identically.
- Right: `<WindowControls />` (existing component, unchanged).

### Full-screen player strip (`components/Player.tsx`)

- A controls-only strip rendered above the existing header (line ~269), visible
  only on Windows (gate on `platform.info.os === 'win32'`).
- Same `h-8`, blur, border, and drag-region treatment as the main window strip.
- Right: `<WindowControls />`; no wordmark.
- Must respect the player's zen-mode hide behavior only if it doesn't conflict
  with the strip being the drag region — the strip stays visible (window must
  stay draggable).

## Changes to existing files

### `App.tsx`

Render `<WindowsTitleBar />` in the root flex column above the TopBar wrapper,
alongside `<MacTitleBar />` (line 144). Components self-gate by platform, so
only the relevant one renders.

### `components/layout/TopBar.tsx`

- Remove `<WindowControls />` from the right action group (line 105).
- Keep everything else unchanged (still `h-16`, still a drag region).

### `components/navigation/drawerLayout.ts` + test

- `getNavDrawerTopClass`: add a `win32 → 'top-8'` mapping so the nav drawer
  clears the new 32px strip. Update `getNavDrawerTopClass` and its test
  (`drawerLayout.test.ts`) to cover `win32`.

### `components/Player.tsx`

- Add the controls-only strip above the existing header, Windows only.

## Non-goals

- No new IPC/preload surface.
- No macOS changes (`MacTitleBar` and traffic lights already cover it).
- No Linux changes (linux keeps current TopBar-inline controls — linux is not
  `win32`, so `WindowControls` still renders in the TopBar there; the new strip
  is win32-only).
- No changes to the sign-in screen (`SetupScreen.tsx`) or the radio full player.
- No changes to `WindowControls` itself.

## Testing

- Unit: extend `drawerLayout.test.ts` with the `win32 → top-8` case.
- `npm run typecheck` (0 errors), `npm test` (all pass), `npm run build`,
  `npm run build:electron`.
- Manual (human): launch `npm run start:electron` on Windows; verify the strip
  shows above the TopBar, the wordmark is centered, window controls work
  (minimize/maximize/restore/close), the window drags via the strip, the nav
  drawer clears the strip, and the full-screen player shows the controls-only
  strip that also keeps the window draggable.