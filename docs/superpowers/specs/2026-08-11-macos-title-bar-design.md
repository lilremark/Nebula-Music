# macOS Title Bar Design

## Problem

The macOS traffic lights, raised to `{ x: 22, y: 6 }` to clear the far-left
TopBar buttons, still collide visually with the sidebar/Nebula/home buttons and
look awkward. The app has no dedicated title-bar band: everything sits in one
64px TopBar row, and the native window controls float over it.

## Goal

Add a slim, app-consistent title bar on macOS that gives the traffic lights a
dedicated band and, per the user's request, displays the app name centered and
a live check-updates button on the far right. It must blend with the existing
design language (lucide icons, rounded hover states, blur background) and keep
the window draggable.

## Layout

New 32px strip (`h-8`) rendered above the existing TopBar, macOS only:

```
┌──────────────────────────────────────────┐
│ ● ● ●           Nebula            ↻     │  ← MacTitleBar (drag region)
├──────────────────────────────────────────┤
│ ≡  ♫  Home       ...       ⌕  ⚙  ▢□×  │  ← existing TopBar (unchanged row)
└──────────────────────────────────────────┘
```

- Left: native traffic lights (the strip's left slot is left empty; the
  `trafficLightPosition` in `electron/main.ts` is retuned so the lights sit
  vertically centered in the strip).
- Center: "Nebula" wordmark.
- Right: check-updates button.
- The whole strip is `-webkit-app-region: drag`; only interactive children are
  `no-drag`.

## Components

### New: `components/layout/MacTitleBar.tsx`

- `usePlatform()`; renders `null` unless `platform.info.os === 'darwin'`.
- Height `h-8`, `flex items-center justify-between`, same blur/background
  treatment as TopBar (bg-white/80 dark:bg-black/20 backdrop-blur-xl) so it
  blends, with the same border-b.
- Left spacer reserves `pl-24` (~96px) so centered text is optically centered
  relative to the window (traffic lights occupy the left ~70px).
- Center: `Nebula` in the bold, tracking-tight style (`font-bold
  tracking-tight text-neutral-900 dark:text-white`).
- Right: check-updates button (below).

### Check-updates button

Uses the existing `platform.updater` bridge (already exposed in preload as
`getState`, `check`, `onStatus`). Subscribes to state via `getState()` then
`onStatus()` like `UpdateBanner.tsx` does.

Behavior by `phase`:

| phase | icon | effect |
| --- | --- | --- |
| `checking` / `downloading` | `RefreshCw` spinning | click disabled |
| `available` / `downloaded` | `RefreshCw` + green pulse dot | click disabled |
| `not-available` / `error` / `idle` | `RefreshCw` | click → `updater.check()` |
| `enabled === false` (dev) | `RefreshCw`, dimmed | click inert; tooltip "Updates available in installed builds" |

Visual language matches TopBar buttons: `p-2 rounded-lg hover:bg-neutral-200
dark:hover:bg-white/10` etc. Tooltip (`title`) shows the phase message when
present, otherwise "Check for updates".

## Changes to existing files

### `App.tsx`

Render `<MacTitleBar />` inside the `<header>` block, above `<TopBar>`, macOS
only (component self-gates on platform). No other layout change; the two bars
stack naturally because the root is a flex column.

### `components/layout/TopBar.tsx`

- Remove the `pt-4` mac workaround (no longer needed).
- Keep `pl-3` far-left buttons; keep the page title as-is.
- Revert nothing else.

### `electron/main.ts`

- Re-tune `trafficLightPosition` so the lights sit vertically centered in the
  32px strip (currently `{ x: 22, y: 6 }`; likely `{ x: 20, y: 10 }`-ish).
  Exact value verified visually; the lights are ~14px tall, strip is 32px.

## Non-goals

- No new IPC/preload surface — everything uses existing updater bridge.
- No Windows/Linux changes (they use `frame: false` + custom `WindowControls`).
- The existing `UpdateBanner` still handles the "downloaded, ready to install"
  flow; the title-bar button does not duplicate the install CTA.
- No changes to the update state machine in `electron/updater.ts`.

## Testing

- `npm run typecheck` (0 errors), `npm test` (all pass), `npm run build`,
  `npm run build:electron`.
- Manual (human): launch `npm run start:electron` on macOS; verify traffic
  lights clear the TopBar buttons, Nebula is centered, the update icon spins on
  click in dev (or stays inert with tooltip), window still drags via the strip.
