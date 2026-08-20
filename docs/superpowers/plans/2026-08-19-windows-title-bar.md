# Windows Title Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slim, app-consistent Windows title bar (centered "Nebula" wordmark + window controls on the right) above the main TopBar and the full-screen player header, matching the existing `MacTitleBar` pattern.

**Architecture:** A new `WindowsTitleBar` component self-gates on `os === 'win32'` (mirroring `MacTitleBar`) and is mounted in `App.tsx` above the TopBar. The full-screen player gets its own inline strip in `Player.tsx` (win32-only). `WindowControls` is removed from `TopBar.tsx`, and the nav drawer offset gains a `win32 → top-8` mapping so it clears the new strip.

**Tech Stack:** React + TypeScript, Tailwind CSS v4, vitest, lucide-react icons. No IPC/preload changes.

## Global Constraints

- Windows only: the new strip must render `null` on non-win32 platforms (`platform?.info.os === 'win32'`).
- macOS is unchanged (`MacTitleBar` + native traffic lights already cover it). Linux keeps the current inline `WindowControls` in the TopBar (the strip is win32-only).
- Reuse the existing `WindowControls` component unchanged — do not edit it.
- Sign-in screen (`SetupScreen.tsx`) is unchanged.
- Drag-region rules: blur/background on a `pointer-events-none` child; interactive children get `-webkit-app-region: no-drag`.
- Button styling: app-consistent (rounded-xl, neutral hover, no red close).
- Bar height: `h-8` (32px); same glass blur (`bg-white/80 dark:bg-black/20 backdrop-blur-xl`) and `border-b border-neutral-200 dark:border-white/5` treatment as `MacTitleBar`.
- No new IPC/preload surface.

---

### Task 1: Nav drawer offset for Windows

**Files:**
- Modify: `components/navigation/drawerLayout.ts`
- Test: `components/navigation/drawerLayout.test.ts`

**Interfaces:**
- Consumes: nothing (pure function).
- Produces: `getNavDrawerTopClass(os: string | undefined): 'top-8' | 'top-0'` — now maps `'win32'` to `'top-8'` so the drawer clears the new 32px strip.

- [ ] **Step 1: Write the failing test**

Append a `win32` row to the existing `it.each` table in `components/navigation/drawerLayout.test.ts`:

```ts
    ['win32', 'top-8'],
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/navigation/drawerLayout.test.ts`
Expected: FAIL — the `win32 → top-8` case returns `'top-0'`.

- [ ] **Step 3: Write minimal implementation**

```ts
export const getNavDrawerTopClass = (os: string | undefined): 'top-8' | 'top-0' =>
  os === 'darwin' || os === 'win32' ? 'top-8' : 'top-0';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/navigation/drawerLayout.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add components/navigation/drawerLayout.ts components/navigation/drawerLayout.test.ts
git commit -m "feat(desktop): Offset nav drawer for Windows title bar"
```

---

### Task 2: New `WindowsTitleBar` component

**Files:**
- Create: `components/layout/WindowsTitleBar.tsx`
- Modify: `components/layout/index.ts` (export the new component)

**Interfaces:**
- Consumes: `usePlatform` from `../../platform/PlatformContext`, `WindowControls` from `../window/WindowControls`, `appRegion` helper pattern from `MacTitleBar.tsx`.
- Produces: default export component `WindowsTitleBar: React.FC` that renders a `h-8` strip (blur child, centered `Nebula` wordmark, `WindowControls` on the right, drag region) when `platform?.info.os === 'win32'`, else `null`.

- [ ] **Step 1: Write the component**

Create `components/layout/WindowsTitleBar.tsx`:

```tsx
import React from 'react';
import type { CSSProperties } from 'react';
import { usePlatform } from '../../platform/PlatformContext';
import { WindowControls } from '../window/WindowControls';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

export const WindowsTitleBar: React.FC = () => {
    const platform = usePlatform();
    const isWindows = platform?.info.os === 'win32';

    if (!isWindows) return null;

    return (
        <div
            className="relative isolate h-8 flex items-center justify-between px-3 border-b border-neutral-200 dark:border-white/5"
            style={appRegion('drag')}
        >
            <div className="pointer-events-none absolute inset-0 -z-10 bg-white/80 dark:bg-black/20 backdrop-blur-xl" />
            <div className="w-24 shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                Nebula
            </span>
            <div className="w-24 shrink-0 flex justify-end">
                <WindowControls />
            </div>
        </div>
    );
};
```

- [ ] **Step 2: Export from the layout barrel**

Add to `components/layout/index.ts`:

```ts
export { WindowsTitleBar } from './WindowsTitleBar';
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/layout/WindowsTitleBar.tsx components/layout/index.ts
git commit -m "feat(desktop): Add Windows title bar component"
```

---

### Task 3: Mount the title bar and remove inline controls from TopBar

**Files:**
- Modify: `App.tsx` (render `<WindowsTitleBar />` above the TopBar wrapper)
- Modify: `components/layout/TopBar.tsx:104-106` (remove `<WindowControls />` and its import)

**Interfaces:**
- Consumes: `WindowsTitleBar` from Task 2.
- Produces: main window layout where the Windows strip sits above the TopBar; TopBar no longer imports or renders `WindowControls`.

- [ ] **Step 1: Add the import and render in `App.tsx`**

App.tsx imports layout components from the barrel (`import { SplitLayout, TopBar, MacTitleBar } from './components/layout';`, line 3). Add `WindowsTitleBar` to that import list. In the root return (line 143-144), render it directly above `<MacTitleBar />`:

```tsx
<div className="relative flex h-screen flex-col overflow-hidden bg-neutral-200 dark:bg-neutral-950 text-neutral-900 dark:text-white">
  <WindowsTitleBar />
  <MacTitleBar />
```

Both self-gate by platform, so only the relevant one renders.

- [ ] **Step 2: Remove `WindowControls` from `TopBar.tsx`**

Remove line 105 (`<WindowControls />`) and the import at line 4 (`import { WindowControls } from '../window/WindowControls';`).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — expected 0 errors.
Run: `npx vitest run` — expected all tests pass.

- [ ] **Step 4: Commit**

```bash
git add App.tsx components/layout/TopBar.tsx
git commit -m "feat(desktop): Mount Windows title bar above TopBar"
```

---

### Task 4: Full-screen player title strip

**Files:**
- Modify: `components/Player.tsx` (add `usePlatform` import, add strip above the header at line ~269, remove inline `WindowControls` at line 316)

**Interfaces:**
- Consumes: `usePlatform` from `../platform/PlatformContext`, existing `WindowControls` import.
- Produces: a win32-only `h-8` strip with centered `Nebula` wordmark (white text) and `WindowControls` on the right, rendered as the first child of the player's root flex column (before the header at line 269). The player header's inline `WindowControls` (line 316) is removed.

- [ ] **Step 1: Add `usePlatform` import**

Add to the imports in `components/Player.tsx`:

```ts
import { usePlatform } from '../platform/PlatformContext';
```

- [ ] **Step 2: Add the strip**

Inside the `Player` component body, near where `playerBackground` etc. are computed, read the platform:

```ts
const platform = usePlatform();
const isWindows = platform?.info.os === 'win32';
```

Immediately after the root `<div>` opens (line 228-230, before the dot-pattern background), render the strip (win32 only):

```tsx
{isWindows && (
    <div
        className="relative z-20 h-8 flex items-center justify-between px-3 border-b border-white/10"
        style={appRegion('drag')}
    >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-black/40 backdrop-blur-xl" />
        <div className="w-24 shrink-0" aria-hidden="true" />
        <span className="text-sm font-bold tracking-tight text-white">
            Nebula
        </span>
        <div className="w-24 shrink-0 flex justify-end">
            <WindowControls />
        </div>
    </div>
)}
```

- [ ] **Step 3: Remove the inline `WindowControls` from the header**

Remove line 316 (`<WindowControls />`). The header's right `flex items-center gap-2` group keeps only the visualizer and zen buttons.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — expected 0 errors.
Run: `npx vitest run` — expected all tests pass.

- [ ] **Step 5: Build**

Run: `node esbuild.config.mjs` — expected main process bundles without error.

- [ ] **Step 6: Commit**

```bash
git add components/Player.tsx
git commit -m "feat(desktop): Add title strip to full-screen player"
```

---

### Task 5: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Tests**

Run: `npx vitest run`
Expected: all tests pass (174+, including the new `win32 → top-8` case).

- [ ] **Step 3: Builds**

Run: `node esbuild.config.mjs` and `npx vite build`
Expected: both complete without error.

- [ ] **Step 4: Manual smoke (human, Windows)**

Run: `npm run start:electron`
Check: strip shows above the TopBar with centered wordmark; window controls work (minimize/maximize/restore/close); window drags via the strip; nav drawer clears the strip; full-screen player shows the strip with wordmark + controls and stays draggable; sign-in screen and Linux layout are unchanged.

- [ ] **Step 5: Commit any stragglers**

If verification produced uncommitted changes, commit them with an appropriate message.