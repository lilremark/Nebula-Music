# Nebula App Icon & Compact Speed & Pitch Popover — Design Spec

Date: 2026-08-07
Branch: `feat/desktop-edition`

## Goal

Two UI changes:

1. **App icon:** Replace the default Electron icon with the Nebula logo (`logo.svg`) so the Nebula icon shows in the Windows taskbar (and window/alt-tab) for dev, unpacked, and installed builds.
2. **Compact Speed & Pitch popover:** In the full-screen player, replace the full-screen centered Speed & Pitch overlay with a compact popover anchored above the "Speed & Pitch" button that closes when clicking outside, matching the sidebar player's popup. Applies to both desktop and web (shared `Player.tsx`).

## Task 2 — App Icon

### Current state

- `logo.svg` at repo root: 512×512, gradient (cyan→violet) rounded square with white equalizer bars. This is the brand logo used in the TopBar and favicon.
- `electron-builder.yml` has no `icon` config → Windows builds embed the default Electron icon.
- `BrowserWindow` in `electron/main.ts` (lines ~176 and ~248) has no `icon` option → dev/unpacked runtime windows use the default Electron icon.
- No `.ico` or icon `.png` exists in the repo.

### Design

**Source of truth:** `logo.svg`.

**New generator script** `scripts/generate-icons.mjs`:
- Uses `sharp` (added as a devDependency) to rasterize `logo.svg`.
- Emits:
  - `build/icon.png` — 512×512 (electron-builder auto-detects `build/icon.png` for other platforms; also used as the window icon source).
  - `build/icon.ico` — multi-resolution ICO containing 16, 24, 32, 48, 64, 128, and 256 px frames (sharp builds the ICO from the PNG frames).
- The generated `build/icon.ico` and `build/icon.png` are committed, so `npm install`/script re-run is not required to build; the script is only for regenerating if the logo changes.

**Wiring:**
- `electron-builder.yml` → add `win.icon: build/icon.ico`.
- `electron/main.ts` → add `icon: path.join(__dirname, '../..', 'build/icon.ico')` to the main window `BrowserWindow` options and the mini-player `BrowserWindow` options.

**Out of scope:**
- Tray icon (`electron/tray.ts` stays a violet dot — deliberately separate).
- Non-Windows platforms (this branch's packaging targets Windows via NSIS; the committed PNG enables cross-platform icons if added later, but only `win.icon` is configured here).

**Verification:**
- `scripts/generate-icons.mjs` produces a valid `.ico` (file exists, non-trivial size, readable by sharp as `{format: 'ico'}`).
- `npm run typecheck` 0 errors (main.ts compiles).
- `npm run build:electron` PASS.
- Packaged exe (`npm run dist:win` or `electron-builder --dir`) embeds the icon — verify via the generated exe's icon or by launching the unpacked exe and checking the taskbar.
- Dev run (`npm run start:electron`) shows the Nebula icon in the taskbar.

## Task 3 — Compact Speed & Pitch Popover

### Current state

`components/Player.tsx` (the full-screen player, mounted in `App.tsx:212`, used in both web and desktop) contains the only "Speed & Pitch" button + modal:

- Button: lines 467–486 (toggles `showSpeedPitchModal`).
- Modal: lines 488–620 — a `fixed inset-0 z-[100]` full-screen centered overlay with a dark `backdrop-blur` backdrop and a `max-w-sm` card. It already closes on backdrop click and via the X button and Reset.

The sidebar player (`components/player/NowPlayingPanel.tsx:289-408`) already has the desired compact pattern: a `w-64` popover positioned `absolute bottom-full` above its button with a bordered card, header row (title + close X), Speed, Pitch, Digital/Analogue toggle, and Reset — no full-screen backdrop, no Magic Crossfade.

### Design

In `Player.tsx`, replace the modal (lines 488–620) with:

**Structure** (modeled on the sidebar popover):
- Keep the button's `onClick={() => setShowSpeedPitchModal(!showSpeedPitchModal)}` (line 469) unchanged.
- New popover wrapper: a `fixed inset-0 z-[100]` transparent click-catcher div whose `onClick` sets `showSpeedPitchModal(false)`. This catches outside clicks without a visible backdrop.
- Inside it, the popover card positioned above the button:
  - `absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/95`
  - `onClick={(e) => e.stopPropagation()}` so clicks inside don't bubble to the catcher.
- Because the button sits inside a scrollable/centered flex column (now-playing content), `bottom-full` anchoring relative to the button's flex parent keeps it visible; the wrapper is `relative` on the button's nearest positioned ancestor within the now-playing column so the popover floats above the button and is not clipped by the outer scroll container. (Verify visually at 940×600 and 1280×800.)

**Header:** row with title "Speed & Pitch" and an X close button (like the sidebar header, slightly larger text for the full-screen context).

**Content** (matches the sidebar, without Magic Crossfade):
- Speed control: minus / current `0.5x–2.0x` value / plus; clamping `Math.max(0.5, …)` / `Math.min(2.0, …)` with `setPlaybackRate`.
- Pitch control: minus / current `±N` semitones / plus; `setPitch` clamp `[-12, 12]`.
- Pitch mode toggle: Digital (`setPitchCorrection(true)`) / Analogue (`setPitchCorrection(false)`), with the descriptive line.
- Reset button: `setPlaybackRate(1.0); setPitch(0);` (keeps `setPitchCorrection` untouched to match sidebar behavior).

**Behavior:**
- Opening: click "Speed & Pitch".
- Closing: click anywhere outside the card (click-catcher), X button, or the existing `Escape` path (App.tsx global handler already closes the expanded player on Escape; the popover itself does not need a new Escape listener, but the X must work).
- No dark backdrop / blur over the whole player.

**Out of scope:**
- The sidebar `NowPlayingPanel` popover is unchanged.
- Radio full player (`RadioFullPlayer`) is unchanged — it has no Speed & Pitch controls.
- Update handling of `magicCrossfade`: it remains a Settings/Store value; it is simply no longer surfaced in this popover (as in the sidebar).

**Verification:**
- `npm run typecheck` 0 errors.
- `npm test` — 85/85.
- `npm run build` PASS.
- Manual DOM check in Electron (dev build, demo mode → full-screen player): open Speed & Pitch, confirm the popover appears above the button, is `w-72`, has no full-screen backdrop, and closes on outside click / X.
- Web (`npm run dev`) — same component, same behavior.

## Acceptance criteria

- [ ] Windows taskbar shows the Nebula icon for dev, unpacked, and installed builds.
- [ ] Full-screen player Speed & Pitch is a compact popover above the button, no full-screen backdrop, closes on outside click.
- [ ] Gate: typecheck 0 errors, tests 85/85, `npm run build` and `npm run build:electron` PASS.
