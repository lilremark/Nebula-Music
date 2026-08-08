# Player Tab Fixes & Sign-in Screen Rework — Design Spec

Date: 2026-08-08
Branch: `feat/desktop-edition`

## Goal

Three changes:

1. **Fix unclickable player tabs** (bug): the full-screen player's header tabs/buttons sit over the TopBar's native `-webkit-app-region: drag` band, which swallows real OS clicks for window-dragging.
2. **Equal-size, truly centered tabs**: make the Now Playing / Lyrics / Queue tabs identical width regardless of label, and center the group in the player header (web + desktop, shared `Player.tsx`).
3. **Sign-in screen rework**: split view — a looping 3D-ish cover-flow filmstrip on the left, the sign-in form on the right; form-only on narrow screens; no vertical scrolling at any size.

## Part 1 — Player tab fixes (`components/Player.tsx`)

### Root cause (confirmed)

`components/layout/TopBar.tsx:39` sets `style={appRegion('drag')}` on the whole top-64px header — a **native OS drag region**. The full-screen player is `fixed inset-0 z-[60]`; its header (tabs at y≈28, close button, right-side buttons) renders directly over that drag band. Native `-webkit-app-region: drag` regions capture real OS mouse input for window dragging and never deliver it to the DOM. Every TopBar button already sets `no-drag` (`TopBar.tsx:51,62,85,95`), but the player header's buttons do not.

(Note: automated Playwright clicks bypass native drag regions, which is why earlier automated tab tests passed while real clicks failed.)

### Fix

In `components/Player.tsx`, add `style={appRegion('no-drag')}` to the interactive elements in the header:
- the close button (line ~281)
- the tab bar container div (line ~291)
- the right-side button group div (line ~307)

The header's padding area (between buttons) keeps default (drag from the underlying TopBar band), so the window can still be moved from the player header's non-interactive areas. Need an `appRegion` helper (mirror the one in `TopBar.tsx` lines 7-8).

### Equal-size centered tabs

- Give each tab button a fixed width `w-24` (96px) so all three are identical regardless of label ("Now Playing" / "lyrics" / "queue").
- Center the tab group truly in the header: change the header layout so the tab group is `absolute left-1/2 -translate-x-1/2` (the header is already `relative`), instead of relying on `justify-between` (which centers it between unequal-width side groups).
- Keep the active-tab styles, hover styles, `text-xs font-semibold uppercase tracking-wide`, `rounded-md`, and `gap-1`/`p-1` container as-is.
- Applies to desktop and web identically (shared component).

### Verification (Part 1)

- `npm run typecheck` — 0 errors
- `npm test` — 85/85
- `npm run build` — PASS
- `npm run build:electron` — PASS
- Manual Electron DOM check (dev build, demo → full-screen player): tabs render centered (group center ≈ window center), each tab `w-24`; real pointer clicks switch tabs; window still draggable from header padding.
- Manual note: real OS clicks cannot be reproduced by Playwright (native drag region bypass), so the no-drag fix is verified by inspecting that `-webkit-app-region: no-drag` is applied to the tab/close/right-group elements plus the user's real-click confirmation.

## Part 2 — Sign-in screen rework (`components/SetupScreen.tsx`)

### Layout

- **Wide (≥ ~1024px):** two-panel split, `flex`, full viewport height (`h-screen overflow-hidden`):
  - Left ~55%: cover-flow panel.
  - Right ~45%: the sign-in form card, vertically centered (`flex items-center justify-center`).
- **Narrow (< ~768px):** cover flow hidden (`hidden lg:flex`); sign-in form fills the viewport centered. No vertical scrolling at any size (`overflow-hidden`, content fits via flex centering).
- Keep the top drag strip (`appRegion('drag')` top-0 inset-x-0 h-10, line 51) and `WindowControls` (top-2 right-4 z-10, line 54) so the frameless window remains draggable/closable on the sign-in screen.
- **Remove** the "About Nebula" card entirely.

### Cover flow (left panel)

- **16 in-code gradient covers**, no network/assets. Each is a square `aspect-square` card with a unique gradient background (hues spanning cyan → violet → fuchsia → amber → etc., matching the app's adaptive-color aesthetic) plus a simple album motif drawn with divs/SVG (vinyl rings, waveform bars, sun/moon, concentric circles, mountain, etc.).
- **3D-ish filmstrip:** a `perspective` container; the frontmost cover is full-size and centered; covers receding to the left/right shrink, darken slightly, and tilt toward the center (`rotateY`). Implemented by rendering the 16 covers in a flex row inside the perspective container with per-cover transforms.
- **Looping auto-scroll:** the strip translates horizontally on a timer (a small `useEffect` + `requestAnimationFrame` loop, or CSS keyframes) so covers continuously roll and wrap seamlessly (duplicate the sequence at the ends for a clean loop).
- Purely decorative: `pointer-events-none` so it never swallows clicks on the drag strip.
- Sizes are `vw`-relative / flexible so it scales with window size.

### Right panel (form)

- Reuse the existing form content: logo, "Sign in to Nebula" heading, auth-mode toggle (Password/API Key), Server URL / Username / Password-or-API-key inputs, insecure-URL warning, connection error, Connect Server + Try Demo Mode buttons.
- Narrow the card to `w-full max-w-sm` so it fits the right column without scrolling.
- Keep `Card`, `Button`, `Input` components and existing handlers/state (`connectToSubsonic`, `enableDemoMode`, `authMode`, `status`, `isInsecure`) unchanged.

### Verification (Part 2)

- `npm run typecheck` — 0 errors; `npm test` — 85/85; `npm run build` — PASS.
- Manual: at 1280×800 the split shows cover flow left + form right with no scrollbar; at 940×600 no scrollbar and covers/flow scale down; at narrow web width (<768px) cover flow hidden, form centered, no scrollbar.
- Manual: window still draggable from the top drag strip and closable via WindowControls on the sign-in screen.

## Acceptance criteria

- [ ] Full-screen player tabs are clickable with real OS clicks (no-drag applied), and the window is still draggable from header padding.
- [ ] Tabs are `w-24` equal width and the group is centered in the player header (web + desktop).
- [ ] Sign-in screen is a split view (cover-flow left, form right) on wide screens and form-only on narrow, with no vertical scrolling at any size.
- [ ] Gate: typecheck 0, tests 85/85, `npm run build` and `npm run build:electron` PASS.
