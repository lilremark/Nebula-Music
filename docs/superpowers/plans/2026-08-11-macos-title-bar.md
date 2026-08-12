# macOS Title Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slim 32px macOS title bar strip (traffic lights | centered "Nebula" | live check-updates button) above the existing TopBar so the traffic lights stop colliding with the far-left buttons and the app gets a native-looking, draggable title band.

**Architecture:** A new `MacTitleBar` component renders a macOS-only, draggable 32px strip above `TopBar` in `App.tsx`. Its icon state is derived by a pure function (`getTitleBarUpdateState`) so the state→icon mapping is unit-testable without a DOM. The button subscribes to the existing `platform.updater` bridge. `TopBar` drops its `pt-4` mac workaround; `electron/main.ts` retunes `trafficLightPosition` so the lights sit centered in the strip.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react icons, Electron (main process), existing platform bridge (`platform.updater` / `UpdaterState`). Tests follow the project's pure-logic `.ts` convention (vitest, node env — no jsdom, no testing-library).

## Global Constraints

- Typecheck gate: `npm run typecheck` must report 0 errors after every task.
- Test gate: `npm test` must pass (13 files, 97 tests). Never break existing tests.
- Build gate: `npm run build` and `npm run build:electron` must succeed.
- macOS only: the title bar must render only when `platform.info.os === 'darwin'`. No Windows/Linux changes (they use `frame: false` + `WindowControls`).
- No new IPC/preload surface — reuse the existing `UpdaterApi` (`getState`, `check`, `onStatus`) and `UpdaterState` type exactly as defined in `platform/types.ts` / `electron/updater.ts`.
- Follow existing component conventions: lucide-react icons, rounded hover states (`p-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10`), blur background (`bg-white/80 dark:bg-black/20 backdrop-blur-xl`), `-webkit-app-region` via an `appRegion` helper.
- No code comments unless required by an existing pattern.
- Copy rules: app name is "Nebula" (bold, `tracking-tight`).
- Do NOT add test dependencies (`jsdom`, `@testing-library/react`). UI behavior is verified by typecheck/build + human smoke test; only pure logic gets unit tests.
- Branch: `feat/macos-edition`. Working repo root: `/Users/jawuanw/NebulaMusicMac`.

---

### Task 1: Extract the updater icon-state logic as a pure function

**Files:**
- Create: `components/layout/titleBarUpdateState.ts`
- Test: `components/layout/titleBarUpdateState.test.ts`

**Interfaces:**
- Consumes: `UpdaterState` from `electron/updater` (phases: `idle | checking | available | downloading | downloaded | not-available | error`; fields `enabled`, `phase`, `message`).
- Produces: `getTitleBarUpdateState(state: UpdaterState): { busy: boolean; hasUpdate: boolean; canCheck: boolean; tooltip: string }`.

- [ ] **Step 1: Write the failing test**

Create `components/layout/titleBarUpdateState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { UpdaterState } from '../../electron/updater';
import { getTitleBarUpdateState } from './titleBarUpdateState';

const base = (overrides: Partial<UpdaterState>): UpdaterState => ({
  enabled: true,
  phase: 'idle',
  currentVersion: '2.4.0',
  newVersion: null,
  progress: null,
  message: null,
  ...overrides,
});

describe('getTitleBarUpdateState', () => {
  it('is busy while checking or downloading', () => {
    expect(getTitleBarUpdateState(base({ phase: 'checking' })).busy).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'downloading' })).busy).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'idle' })).busy).toBe(false);
  });

  it('reports an update when available or downloaded', () => {
    expect(getTitleBarUpdateState(base({ phase: 'available', newVersion: '2.5.0' })).hasUpdate).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'downloaded', newVersion: '2.5.0' })).hasUpdate).toBe(true);
    expect(getTitleBarUpdateState(base({ phase: 'idle' })).hasUpdate).toBe(false);
  });

  it('disables clicking while busy or when an update is available', () => {
    expect(getTitleBarUpdateState(base({ phase: 'checking' })).canCheck).toBe(false);
    expect(getTitleBarUpdateState(base({ phase: 'available' })).canCheck).toBe(false);
    expect(getTitleBarUpdateState(base({ phase: 'idle' })).canCheck).toBe(true);
  });

  it('is inert when updates are disabled', () => {
    expect(getTitleBarUpdateState(base({ enabled: false, phase: 'idle' })).canCheck).toBe(false);
    expect(getTitleBarUpdateState(base({ enabled: false, phase: 'idle' })).tooltip)
      .toBe('Updates available in installed builds');
  });

  it('uses the state message as the tooltip when present', () => {
    expect(getTitleBarUpdateState(base({ phase: 'available', message: 'Update 2.5.0 is available.' })).tooltip)
      .toBe('Update 2.5.0 is available.');
    expect(getTitleBarUpdateState(base({ phase: 'idle', enabled: true })).tooltip)
      .toBe('Check for updates');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/layout/titleBarUpdateState.test.ts`
Expected: FAIL — cannot find module `./titleBarUpdateState`.

- [ ] **Step 3: Write the minimal implementation**

Create `components/layout/titleBarUpdateState.ts`:

```ts
import type { UpdaterState } from '../../electron/updater';

export interface TitleBarUpdateState {
  busy: boolean;
  hasUpdate: boolean;
  canCheck: boolean;
  tooltip: string;
}

export const getTitleBarUpdateState = (state: UpdaterState): TitleBarUpdateState => {
  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const hasUpdate = state.phase === 'available' || state.phase === 'downloaded';
  const canCheck = state.enabled === true && !busy && !hasUpdate;
  const tooltip =
    state.message ??
    (state.enabled === true ? 'Check for updates' : 'Updates available in installed builds');
  return { busy, hasUpdate, canCheck, tooltip };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/layout/titleBarUpdateState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/layout/titleBarUpdateState.ts components/layout/titleBarUpdateState.test.ts
git commit -m "feat: add title bar updater icon state logic"
```

---

### Task 2: Add the `MacTitleBar` component

**Files:**
- Create: `components/layout/MacTitleBar.tsx`
- Modify: `components/layout/index.ts`

**Interfaces:**
- Consumes: `usePlatform` from `platform/PlatformContext` (returns `Platform | null`); `Platform.info.os`; `Platform.updater` (type `UpdaterApi`); `UpdaterState` from `electron/updater`; `getTitleBarUpdateState` from `./titleBarUpdateState` (Task 1); lucide-react `RefreshCw`.
- Produces: `MacTitleBar: React.FC` — renders `null` unless macOS; used by `App.tsx` (Task 3). No props.

- [ ] **Step 1: Write the component**

Create `components/layout/MacTitleBar.tsx`:

```tsx
import React from 'react';
import type { CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePlatform } from '../../platform/PlatformContext';
import type { UpdaterState } from '../../electron/updater';
import { getTitleBarUpdateState } from './titleBarUpdateState';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;

export const MacTitleBar: React.FC = () => {
    const platform = usePlatform();
    const isMac = platform?.info.os === 'darwin';
    const [state, setState] = React.useState<UpdaterState | null>(null);

    React.useEffect(() => {
        if (!isMac || !platform) return;
        void platform.updater.getState().then(setState);
        return platform.updater.onStatus(setState);
    }, [isMac, platform]);

    if (!isMac) return null;

    const updaterState = state
        ? getTitleBarUpdateState(state)
        : { busy: false, hasUpdate: false, canCheck: true, tooltip: 'Check for updates' };

    return (
        <div
            className="relative h-8 flex items-center justify-between px-3 border-b border-neutral-200 dark:border-white/5"
            style={appRegion('drag')}
        >
            <div className="pointer-events-none absolute inset-0 -z-10 bg-white/80 dark:bg-black/20 backdrop-blur-xl" />
            <div className="w-24 shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                Nebula
            </span>
            <div className="w-24 shrink-0 flex justify-end">
                <button
                    type="button"
                    onClick={() => { void platform?.updater.check(); }}
                    disabled={!updaterState.canCheck}
                    aria-label="Check for updates"
                    title={updaterState.tooltip}
                    className="relative p-1.5 rounded-lg text-neutral-500 dark:text-white/40 hover:bg-neutral-200 dark:hover:bg-white/10 hover:text-neutral-900 dark:hover:text-white transition-all duration-200 disabled:opacity-60"
                    style={appRegion('no-drag')}
                >
                    <RefreshCw className={`w-4 h-4 ${updaterState.busy ? 'animate-spin' : ''}`} />
                    {updaterState.hasUpdate && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                </button>
            </div>
        </div>
    );
};
```

Note: the component does not import `getTitleBarUpdateState`'s exported `TitleBarUpdateState` interface — it constructs a default literal inline. No comment needed; the object shape is inferred.

- [ ] **Step 2: Export from the layout index**

In `components/layout/index.ts` add:

```ts
export { MacTitleBar } from './MacTitleBar';
```

- [ ] **Step 3: Run gates**

Run: `npm run typecheck` — Expected: 0 errors.
Run: `npm test` — Expected: 14 files pass (13 existing + 1 from Task 1).
Run: `npm run build` — Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/layout/MacTitleBar.tsx components/layout/index.ts
git commit -m "feat: add macOS title bar component"
```

---

### Task 3: Mount the title bar above the TopBar

**Files:**
- Modify: `App.tsx:187-190` and the import at `App.tsx:3`

**Interfaces:**
- Consumes: `MacTitleBar` from `components/layout` (Task 2, no props).
- Produces: the macOS strip rendered above `TopBar` in the app shell.

- [ ] **Step 1: Update the import**

In `App.tsx` line 3, change:

```tsx
import { SplitLayout, TopBar } from './components/layout';
```

to:

```tsx
import { SplitLayout, TopBar, MacTitleBar } from './components/layout';
```

- [ ] **Step 2: Mount the component**

In `App.tsx`, change the `<header>` block (lines 187-190):

```tsx
        {/* Top Bar */}
        <header>
          <TopBar onMenuClick={() => setIsNavOpen(true)} isNavOpen={isNavOpen} />
        </header>
```

to:

```tsx
        {/* Top Bar */}
        <header className="flex flex-col shrink-0">
          <MacTitleBar />
          <TopBar onMenuClick={() => setIsNavOpen(true)} isNavOpen={isNavOpen} />
        </header>
```

- [ ] **Step 3: Run gates**

Run: `npm run typecheck` — Expected: 0 errors.
Run: `npm test` — Expected: all pass.
Run: `npm run build` — Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: mount macOS title bar above top bar"
```

---

### Task 4: Revert TopBar mac workaround and retune traffic lights

**Files:**
- Modify: `components/layout/TopBar.tsx:42`
- Modify: `electron/main.ts:220`

**Interfaces:**
- Consumes: current `trafficLightPosition` in `electron/main.ts`; `isMac`/`appRegion` helpers already in `TopBar.tsx`.
- Produces: TopBar without `pt-4` on mac; traffic lights vertically centered in the 32px strip.

- [ ] **Step 1: Remove the TopBar mac padding workaround**

In `components/layout/TopBar.tsx` line 42, change:

```tsx
className={`relative h-16 flex items-center justify-between px-6 ${isMac ? 'pl-3 pt-4' : ''} border-b border-neutral-200 dark:border-white/5 sticky top-0 z-30`}
```

to:

```tsx
className={`relative h-16 flex items-center justify-between px-6 ${isMac ? 'pl-3' : ''} border-b border-neutral-200 dark:border-white/5 sticky top-0 z-30`}
```

(Remove only the `pt-4`; keep `pl-3` and everything else on the line identical.)

- [ ] **Step 2: Retune the traffic light position**

In `electron/main.ts` line 220, change:

```ts
trafficLightPosition: { x: 22, y: 6 } as const
```

to:

```ts
trafficLightPosition: { x: 20, y: 10 } as const
```

The strip is 32px (`h-8`) tall and the lights are ~14px tall; `y: 10` centers them in the strip. If the human reports the lights look off-center after the visual check in Task 5, this value is the single knob to adjust.

- [ ] **Step 3: Run gates**

Run: `npm run typecheck` — Expected: 0 errors.
Run: `npm test` — Expected: all pass.
Run: `npm run build && npm run build:electron` — Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add components/layout/TopBar.tsx electron/main.ts
git commit -m "refactor: remove top bar mac padding, center traffic lights in title strip"
```

---

### Task 5: Visual verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: the app produced by Tasks 1-4.

- [ ] **Step 1: Launch the app**

Run: `npm run start:electron`
Expected: window opens with the new 32px strip on top; "Nebula" centered; check-updates icon far-right; traffic lights in the strip's left slot.

- [ ] **Step 2: Verify the following (human)**

1. Traffic lights sit vertically centered in the strip and do NOT overlap the sidebar/menu/home buttons in the TopBar below.
2. "Nebula" appears optically centered (adjust the left/right `w-24` spacers in `MacTitleBar.tsx` if it reads off-center).
3. The update icon is inert but shows a tooltip in dev (`enabled: false`); in an installed build clicking it shows the spinner and a green dot when an update is found.
4. Dragging the strip moves the window; buttons remain clickable (no-drag).
5. Windows/Linux builds (if checked) are unaffected.

- [ ] **Step 3: Report any visual issues back**

If any of the checks in Step 2 fail, report the specific symptom. Do not commit.
