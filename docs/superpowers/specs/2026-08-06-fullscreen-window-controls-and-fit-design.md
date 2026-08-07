# Full-Screen Window Controls + Responsive Fit

Date: 2026-08-06
Status: Draft
Branch: `feat/desktop-edition`

## Problem

The Windows desktop edition is now fully frameless (`frame: false`, custom
React window controls in the TopBar). User feedback on the current build:

1. The full-screen expanded player (`Player.tsx`, `fixed inset-0 z-[60]`)
   covers the entire window, including the TopBar and its window controls. While
   it is open, there is no way to minimize / maximize / close the window.
2. The sign-in screen (`SetupScreen.tsx`) is rendered *instead of* the whole app
   (App.tsx:94-96), so it has no TopBar, no window controls at all, and no drag
   region — on a frameless window you can neither move nor close it normally.
3. On the sign-in screen, the two stacked cards (sign-in card + About card) are
   taller than the minimum window height (940x600), forcing `overflow-auto`
   scrolling to see everything.
4. The full-screen player's now-playing tab can clip at the minimum window
   height because the content area is `overflow-hidden` while its column
   (title, progress, controls, volume, speed button) is taller than ~600px.

## Goals

- Render the win32 minimize / maximize-restore / close controls in the
  full-screen player header (top-right, alongside visualizer/zen buttons).
- Render the same controls on the sign-in screen (top-right) and make its top
  edge a drag region so the frameless window can be moved and closed.
- Make sign-in content fit without scrolling at the minimum window size (keep
  `overflow-auto` only as a last-resort fallback).
- Make the full-screen player's now-playing content fit / scroll gracefully at
  the minimum window size instead of clipping.
- Reuse one implementation of the controls across all three surfaces.

## Non-Goals

- No macOS/Linux changes: `WindowControls` renders `null` off win32.
- No browser changes: `usePlatform()` resolves to the web platform, which has no
  `window` control surface; `WindowControls` renders `null`.
- No tray, mini-player, or media-key behavior changes.
- No change to the existing TopBar drag region semantics.
- Not re-styling the rest of the player's zen/visualizer controls.

## Approach: shared `WindowControls` component + responsive fit

### 1. New component `components/window/WindowControls.tsx`

Extract the win32 control cluster currently inlined in
`components/layout/TopBar.tsx` (lines 110-138) into a reusable component:

- Renders `null` when `platform?.info.os !== 'win32'`.
- Owns the `isMaximized` state:
  - initial value from `platform.window.isMaximized()`;
  - live updates via `platform.window.onMaximizeChanged(setIsMaximized)`;
  - unsubscribe in cleanup.
- Buttons (lucide): Minimize (`Minus`), Maximize/Restore (`Square` / `Copy`),
  Close (`X`). Each button `appRegion('no-drag')`.
- Styling matches the TopBar exactly:
  `p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600
  dark:text-white/60 hover:text-neutral-900 dark:hover:text-white
  transition-all duration-200 active:scale-95`; Close keeps the neutral hover.
- Props: optional `className` (applied to the wrapping `<div>`, which is
  `flex items-center gap-2` by default) and optional `buttonClassName` /
  `size` for surface-specific sizing (e.g. sign-in corner).
- Reuses the existing `appRegion` helper (move it to the new file or import it).

### 2. `TopBar` refactor (`components/layout/TopBar.tsx`)

- Delete the inline `isWindows && ( ... )` controls block; render
  `<WindowControls />` in its place (same position: right side, after the
  Settings button, no divider).
- Remove now-unused imports (`Minus`, `Square`, `Copy`, `X`, `useEffect`,
  `useState` if unused) and the `isMaximized` state.
- No visual or behavioral change.

### 3. Full-screen player (`components/Player.tsx`)

- Import `WindowControls`; render it in the header's right-side group
  (line ~291-307) after the zen button.
- The header is `relative z-20 flex items-center justify-between`; adding
  controls to the right group inherits the existing zen-mode
  `opacity-0 hover:opacity-100` reveal, so the buttons appear on hover in zen
  mode alongside the other header controls.
- **Fit (now-playing tab)**: the content block at lines 314-620 is
  `flex-1 flex flex-col lg:flex-row items-center justify-center ...`. Change the
  outer content wrapper to allow graceful behavior at minimum height:
  - Give the now-playing tab container `overflow-y-auto` (with a thin custom
    scrollbar) so the controls column can scroll instead of being clipped when
    the window is shorter than the column.
  - Cap album art by viewport height: replace
    `max-w-[380px] lg:max-w-[480px]` sizing with an aspect-square element whose
    width is bounded by both `max-w` and available height
    (e.g. `max-h-[min(40vh, 480px)]` on the image wrapper while preserving the
    square ratio), so art + text + controls fit at 600px height.
  - Reduce the large gaps on short viewports via responsive spacing that
    already exists (`gap-8 lg:gap-20`) — keep, but the scroll fallback is the
    safety net.
- Other tabs (lyrics, queue) already scroll internally and are unaffected.

### 4. Sign-in screen (`components/SetupScreen.tsx`)

- Add `<WindowControls />` fixed at the top-right corner (styled to blend:
  translucent dark/light background chip or plain buttons matching the surface).
- Add a drag region: a slim `-webkit-app-region: drag` strip across the top
  (absolute, `top-0 inset-x-0 h-10`, `pointer-events` intact) with the controls
  wrapped in `appRegion('no-drag')` so the buttons still click. Matches the
  TopBar drag-region approach (blur/composite-layer caveat: keep the strip
  simple — no backdrop-blur on the drag element itself).
- **Fit**: make everything fit at 940x600 without scrolling:
  - Keep the outer wrapper `fixed inset-0 overflow-auto` (last-resort fallback).
  - Compact vertical spacing so the header block, form, and About card fit in
    one viewport at 600px height: reduce `mb-8` header margin, tighten
    `space-y-4` / gaps, and `py-8` to a smaller padding, and cap the About card
    text so the whole column fits.
  - Verify empirically at 940x600 in the packaged window that no scrollbar is
    needed (measure the two-card column height vs 600px).
- The existing `min-h-screen` centering stays; the drag strip sits above the
  centered content.

### 5. Tests & verification

- No new unit tests: the project has no React component test harness (vitest
  runs in the default node env with no jsdom/testing-library, and existing
  tests cover services/electron/playback only). The `custom-frameless-title-bar`
  work set the precedent: component behavior is verified by the manual Windows
  smoke test. Adding a harness is out of scope.
- Verify in order: `npm run typecheck`, `npm run test`, `npm run build`,
  `npm run build:main`, boot smoke, then manual Windows checks:
  - full-screen player shows min/max/close top-right; all three work;
    maximize icon toggles; buttons reveal on hover in zen mode;
  - sign-in screen: controls visible top-right, drag strip moves the window,
    close works, no scroll at 940x600, scroll reappears only on tiny windows;
  - TopBar controls unchanged (still render, drag header still works).
  - `npm run test` (existing 85 tests) stays green.

## Open Questions

- None.

## Related

- Extends `2026-08-06-custom-frameless-title-bar-design.md` (frame:false,
  maximize-state channel, `platform.window.*` surface).
- `platform/window` surface (minimize/toggleMaximize/close/isMaximized/
  onMaximizeChanged) already exists from that work.
