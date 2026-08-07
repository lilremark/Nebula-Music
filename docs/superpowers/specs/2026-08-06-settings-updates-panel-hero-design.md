# Design: Settings — Updates Panel Hero Redesign

**Date:** 2026-08-06
**Status:** Approved
**Scope:** `views/Settings.tsx` only — the `DesktopUpdatesPanel` component. No changes to `electron/updater.ts`, IPC, store, or tests.

## Problem

The Settings → Updates panel's "Check for updates" button is small (`text-xs`, `px-4 py-2`) and sits in the right half of a two-column row, competing with the channel selector. The user wants a bigger, centered button with a cleaner presentation.

## Goals

- Make "Check for updates" the panel's focal action: larger and centered.
- Keep all existing update state semantics (`phase`, `progress`, `message`, `enabled`) intact.
- Present status (version, badge, message, download progress) clearly.

## Design

Replace the two stacked rows (version row + two-column row) with a centered hero layout inside the same `SettingPanel`:

### 1. Hero block
`px-5 py-6`, text centered:
- Status badge centered at top (existing `badgeClass` logic unchanged).
- "Nebula {version}" as `text-lg font-bold`.
- Status message (`updateState?.message`, defaulting to "Updates are checked against GitHub Releases.") as centered `text-xs`.

### 2. Primary button
Centered fixed-width `w-56 py-3 text-sm font-bold rounded-lg bg-primary text-black hover:brightness-110`. Content by `phase`:
- `idle` / `not-available` / `error` → `RefreshCw` icon + "Check for updates"; disabled when `!enabled || busy` (existing disabled classes preserved).
- `checking` → spinning `RefreshCw` + "Checking…"
- `downloading` → spinning `RefreshCw` + "Downloading… {progress}%"
- `downloaded` → becomes the existing primary "Restart & Install" button (`Download` icon), same click handler, keeping the same `w-56` width so the layout does not jump.

### 3. Progress bar
Only while `phase === 'downloading'`: `h-1.5 bg-white/10` track, `bg-primary` fill at `progress%`, `w-56` to match the button, centered directly beneath it.

### 4. Channel selector
Centered row `mt-6`: the existing Stable/Beta segmented control, narrowed to `w-48`, with its label/description as a small centered caption. Disabled/dimmed when the panel is `!enabled` per existing behavior.

## State / Behavior

- Purely JSX/layout change in `DesktopUpdatesPanel`.
- `phase`, `progress`, `message`, `enabled`, `readyToInstall`, and all handlers (`platform.updater.check()`, `installAndRestart()`, `changeChannel`) preserved verbatim.
- No inner scroll container in this panel; centering via `text-center` + `mx-auto` on fixed-width children.

## Responsive

Hero stacks cleanly at the 940×600 minimum window (content is short). Channel row uses `flex-col` on narrow and `flex-row` on wider widths.

## Testing

- Existing `electron/updater.test.ts` phase tests unchanged and must pass.
- Gate: `npm run typecheck`, `npm test` (85/85), `npm run build`, `npm run build:electron`.
- Manual DOM check of the rendered panel in Electron demo mode (badge, button width/centering, progress bar visibility across phases where reproducible).
