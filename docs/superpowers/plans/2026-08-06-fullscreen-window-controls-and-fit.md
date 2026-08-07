# Full-Screen Window Controls + Responsive Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse one win32 window-controls component (minimize / maximize-restore / close) across the TopBar, the full-screen player, and the sign-in screen, and make the sign-in screen and full-screen player fit inside the window without clipping or scrolling at the minimum size (940x600).

**Architecture:** Extract the window-control cluster currently inlined in `TopBar` into a new `WindowControls` component that owns the `isMaximized` state (via the existing `platform.window` surface) and renders `null` off win32. Mount it in the TopBar (no visual change), the full-screen `Player` header (right group, alongside visualizer/zen), and `SetupScreen` (fixed top-right plus a top drag strip). Fit fixes are CSS/class-only: the sign-in screen compacts to fit 940x600 (keeping `overflow-auto` as a last-resort fallback), and the player's now-playing tab gains an internal scroll fallback plus a viewport-height-capped album art.

**Tech Stack:** React 19 + Tailwind (renderer), lucide-react icons, TypeScript, Electron 43 frameless win32 window, Vitest (pure-logic tests only — no component test harness).

## Global Constraints

- Window controls render **only when `platform?.info.os === 'win32'`**; every other platform/browser renders `null` (web `platform.window` is a no-op, but the OS gate prevents rendering).
- `appRegion` helper stays per-file (project convention: TopBar, mini-player each define their own copy); `WindowControls` defines its own.
- Buttons: Minimize (`Minus`), Maximize/Restore (`Square` / `Copy`), Close (`X`), each `appRegion('no-drag')`; Close uses the **same neutral hover** — no red tint.
- Drag-region rule (from frameless work): never put `backdrop-blur` on the element with `-webkit-app-region: drag`; the sign-in drag strip must be a plain strip with no blur.
- No changes to `electron-builder.yml`, CSP, sandbox, `contextIsolation`, or the `platform` IPC surface.
- The mini-player window and the existing TopBar drag semantics are untouched.
- No new unit tests (no React component harness exists; node-only vitest). Verification is `npm run typecheck`, `npm run test`, `npm run build`, `npm run build:main`, plus the manual Windows smoke checks.
- Every task ends green on `npm run typecheck` before the commit step.
- Commit style: `feat(desktop): ...` conventional commits, one commit per task.

---

### Task 1: Create `components/window/WindowControls.tsx`

**Files:**
- Create: `components/window/WindowControls.tsx`

**Interfaces:**
- Consumes: `usePlatform()` from `../../platform/PlatformContext` (returns `Platform | null`); `platform.window.minimize()`, `platform.window.toggleMaximize()`, `platform.window.close()`, `platform.window.isMaximized()`, `platform.window.onMaximizeChanged(handler)` (all already exist).
- Produces (used by Tasks 2, 3, 4):
  - `WindowControls({ className?, buttonClassName? })` — renders `null` off win32; otherwise a `div.flex.items-center.gap-2` with three win32-gated buttons. Optional `className` applies to the wrapping div; optional `buttonClassName` appends to every button.

- [ ] **Step 1: Create the component file**

Create `components/window/WindowControls.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

interface WindowControlsProps {
    className?: string;
    buttonClassName?: string;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
    className = '',
    buttonClassName = '',
}) => {
    const platform = usePlatform();
    const [isMaximized, setIsMaximized] = useState(false);

    const isWindows = platform?.info.os === 'win32';

    useEffect(() => {
        if (!isWindows) return;
        void platform.window.isMaximized().then(setIsMaximized);
        return platform.window.onMaximizeChanged(setIsMaximized);
    }, [platform, isWindows]);

    if (!isWindows) return null;

    const buttonClass = `p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 active:scale-95 ${buttonClassName}`;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <button
                onClick={() => void platform.window.minimize()}
                className={buttonClass}
                aria-label="Minimize"
                style={appRegion('no-drag')}
            >
                <Minus className="w-5 h-5" />
            </button>
            <button
                onClick={() => void platform.window.toggleMaximize()}
                className={buttonClass}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                style={appRegion('no-drag')}
            >
                {isMaximized ? <Copy className="w-5 h-5" /> : <Square className="w-5 h-5" />}
            </button>
            <button
                onClick={() => void platform.window.close()}
                className={buttonClass}
                aria-label="Close"
                style={appRegion('no-drag')}
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (0 errors).

- [ ] **Step 3: Commit**

```bash
git add components/window/WindowControls.tsx
git commit -m "feat(desktop): Add reusable win32 window controls component"
```

---

### Task 2: Refactor `TopBar` to use `WindowControls`

**Files:**
- Modify: `components/layout/TopBar.tsx`

**Interfaces:**
- Consumes: `WindowControls` from `../window/WindowControls` (no props).
- Produces: unchanged `TopBar` API (`TopBarProps { onMenuClick }`); identical visuals and placement.

- [ ] **Step 1: Replace the inline controls**

In `components/layout/TopBar.tsx`:

1. Replace the import line `import { Copy, Menu, Minus, Search, Settings, Square, X } from 'lucide-react';` with:
   ```tsx
   import { Menu, Search, Settings } from 'lucide-react';
   ```
2. Add the import:
   ```tsx
   import { WindowControls } from '../window/WindowControls';
   ```
3. Remove the `const [isMaximized, setIsMaximized] = useState(false);` line and the entire `useEffect(() => { if (!isWindows) return; ... }, [platform, isWindows]);` block.
4. Remove the `const isWindows = platform?.info.os === 'win32';` line and the `usePlatform` import if it becomes unused (it will — `platform` is only referenced by `isWindows`; delete `import { usePlatform } from '../../platform/PlatformContext';`).
5. Remove `useEffect`/`useState` from the `import React, { useEffect, useState } from 'react';` line if they become unused (they will):
   ```tsx
   import React from 'react';
   ```
6. Replace the `{isWindows && ( <> ... buttons ... </> )}` block (currently lines ~110-138) with:
   ```tsx
   {/* Custom window controls (Windows only), directly after Settings, no divider */}
   <WindowControls />
   ```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (0 errors; no unused-import errors).

- [ ] **Step 3: Commit**

```bash
git add components/layout/TopBar.tsx
git commit -m "feat(desktop): Use shared WindowControls in the TopBar"
```

---

### Task 3: Window controls + fit in the full-screen player

**Files:**
- Modify: `components/Player.tsx`

**Interfaces:**
- Consumes: `WindowControls` from `./window/WindowControls`; existing `PlayerProps { isExpanded, onClose }`.
- Produces: unchanged `Player` API; header gains win32 controls on the right; now-playing tab scrolls internally and album art caps to viewport height.

- [ ] **Step 1: Add the import**

In `components/Player.tsx`, after the `useTheme` import (line 14), add:

```tsx
import { WindowControls } from './window/WindowControls';
```

- [ ] **Step 2: Mount controls in the header right group**

In the header's right-side `<div className="flex items-center gap-2">` (currently lines ~291-307, containing the visualizer and zen buttons), append `<WindowControls />` **after** the zen button's closing `</button>` and **before** the group's closing `</div>`:

```tsx
                <div className="flex items-center gap-2">
                    <button ...visualizer... />
                    <button ...zen... />
                    <WindowControls />
                </div>
```

- [ ] **Step 3: Cap album art by viewport height**

The album-art outer wrapper is:

```tsx
<div className="relative w-full max-w-[380px] lg:max-w-[480px] shrink-0">
```

Keep it as-is. Change only the existing inner square element so the art cannot exceed roughly 42% of the viewport height. The inner element is:

```tsx
<div className={`relative aspect-square rounded-xl overflow-hidden shadow-2xl transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-70'}`}>
```

Change it to:

```tsx
<div className={`relative aspect-square rounded-xl overflow-hidden shadow-2xl transition-all duration-700 w-full max-w-full max-h-[min(42vh,480px)] ${isPlaying ? 'scale-100' : 'scale-95 opacity-70'}`}>
```

(The `max-w-[380px] lg:max-w-[480px]` on the outer wrapper still bounds width; the inner `aspect-square` keeps the ratio while `max-h-[min(42vh,480px)]` caps height so art + text + controls fit at 600px window height.)

- [ ] **Step 4: Make the now-playing tab scroll internally**

The now-playing tab container is:

```tsx
<div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20 px-6 md:px-12 pb-8">
```

Change `flex-1` to `flex-1 min-h-0` and add `overflow-y-auto custom-scrollbar`:

```tsx
<div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20 px-6 md:px-12 pb-8">
```

so when the controls column is taller than the window, it scrolls instead of clipping. (Lyrics and queue tabs already scroll internally and are unchanged.)

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Player.tsx
git commit -m "feat(desktop): Add window controls to full-screen player and prevent clipping at min size"
```

---

### Task 4: Window controls + drag strip + fit on the sign-in screen

**Files:**
- Modify: `components/SetupScreen.tsx`

**Interfaces:**
- Consumes: `WindowControls` from `./window/WindowControls`.
- Produces: unchanged `SetupScreen` API; win32 controls fixed top-right; a top drag strip; content fits at 940x600 without scrolling at normal sizes.

- [ ] **Step 1: Add imports**

In `components/SetupScreen.tsx`, add:

```tsx
import type { CSSProperties } from 'react';
import { WindowControls } from './window/WindowControls';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
  ({ WebkitAppRegion: region }) as CSSProperties;
```

- [ ] **Step 2: Add the drag strip + controls**

Immediately inside the outer wrapper (the `<div className="fixed inset-0 overflow-auto ...">`), before the dot-pattern background div, add:

```tsx
      {/* Drag region so the frameless window can be moved from the sign-in screen */}
      <div className="absolute top-0 inset-x-0 h-10" style={appRegion('drag')} />

      {/* Window controls (Windows only) */}
      <div className="absolute top-2 right-4 z-10" style={appRegion('no-drag')}>
        <WindowControls />
      </div>
```

(The drag strip is a plain element with no `backdrop-blur`, per the drag-region constraint. The controls sit on top of it and are `no-drag`.)

- [ ] **Step 3: Compact vertical spacing so content fits at 600px height**

Keep the outer wrapper `fixed inset-0 overflow-auto` (last-resort fallback). Compact the column:

1. Change the inner centering wrapper from:
   ```tsx
   <div className="relative flex min-h-screen items-center justify-center px-5 py-8">
   ```
   to:
   ```tsx
   <div className="relative flex min-h-screen items-center justify-center px-5 py-6">
   ```
2. In the sign-in `Card`, change the header block margin from `mb-8` to `mb-6`:
   ```tsx
   <div className="mb-6 text-center">
   ```
3. Change the form spacing from `space-y-4` to `space-y-3`:
   ```tsx
   <form onSubmit={handleConnect} className="space-y-3">
   ```
4. Tighten the About `Card` top margin from `mt-4` to `mt-3`:
   ```tsx
   className="mt-3 border-neutral-200/70 bg-white/75 dark:border-white/10 dark:bg-neutral-950/60"
   ```

These reduce the column height enough that header + form + About card fit within 600px at 940x600, while `overflow-auto` remains for very short windows.

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/SetupScreen.tsx
git commit -m "feat(desktop): Add window controls and drag strip to the sign-in screen, compact to fit min size"
```

---

### Task 5: Full verification pass

**Files:** none (verification only).

**Interfaces:** consumes the finished result of Tasks 1-4.

- [ ] **Step 1: Full gate**

Run each, in order, and confirm all pass:
- `npm run typecheck`
- `npm run test` (expect 85 tests green, 10 files)
- `npm run build`
- `npm run build:main`

- [ ] **Step 2: Boot smoke**

Run: `npm run start:electron`
Expected: Electron window opens, devtools console shows no CSP / renderer errors, and `[nebula] renderer loaded` prints in the terminal.

- [ ] **Step 3: Manual Windows checks**

With a song playing (or demo mode), verify in the packaged/dev window:
- **Full-screen player** (click the expand icon): minimize/maximize/close buttons show top-right next to the zen button; all three work; the maximize button icon toggles between `Square` and `Copy`; entering zen mode and hovering the top shows the header (including window controls).
- **Sign-in screen** (fresh profile / cleared credentials): controls visible top-right; the top strip drags the window; close works; at 940x600 there is **no scrollbar** and every element (logo header, form, About card) is visible; resizing to a very short window shows a scrollbar again (fallback still works).
- **TopBar**: controls still render after the Settings button; dragging the header still moves the window; double-click still maximizes/restores.

- [ ] **Step 4: Commit any fix-ups**

If any step in Task 5 surfaced a bug, fix it in the owning task's file and commit with a `fix(desktop): ...` message before finishing. If everything is green, no commit is needed for this task.
