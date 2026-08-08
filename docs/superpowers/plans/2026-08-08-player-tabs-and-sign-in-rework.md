# Player Tab Fixes & Sign-in Screen Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the unclickable full-screen player tabs (native drag-region swallow), make the tabs equal-width and truly centered (web + desktop), and rework the sign-in screen into a split view with a looping cover-flow filmstrip.

**Architecture:** Two independent tasks. Task 1 modifies `components/Player.tsx` only: adds `-webkit-app-region: no-drag` to the header's interactive elements (close button, tab bar, right-side button group) so native drag regions no longer swallow real OS clicks, gives each tab a fixed `w-24` width, and absolutely centers the tab group in the header. Task 2 creates a new `components/CoverFlow.tsx` (16 in-code gradient covers in a looping 3D filmstrip) and rewrites `components/SetupScreen.tsx` into a split view (cover flow left ~55%, sign-in form right ~45%, form-only below `lg`, no vertical scrolling, About card removed).

**Tech Stack:** React + TypeScript + Tailwind CSS v4 + lucide-react. Electron `-webkit-app-region` for the drag fix. `requestAnimationFrame` for the cover-flow loop (no new dependencies).

## Global Constraints

- Task 1 touches ONLY `components/Player.tsx`. Task 2 creates `components/CoverFlow.tsx` and modifies ONLY `components/SetupScreen.tsx`.
- Do NOT modify `electron/*`, any store, `components/layout/TopBar.tsx`, `components/window/WindowControls.tsx`, or any test file. Existing tests (85/85) must pass unchanged.
- The cover-flow covers are generated in code (CSS gradients) — NO network requests, NO image assets, NO new dependencies.
- The sign-in screen keeps its top drag strip (`appRegion('drag')` top-0 inset-x-0 h-10) and `WindowControls` (top-2 right-4) so the frameless window stays draggable/closable.
- The cover-flow container is `pointer-events-none` so it never swallows drag clicks.
- No code comments unless a comment already exists there.
- No vertical scrolling at any window size on the sign-in screen (`overflow-hidden`, flex-centering, no `min-h-screen`+scroll).
- Gate to pass before committing: `npm run typecheck` (0 errors), `npm test` (85/85), `npm run build` (PASS), `npm run build:electron` (PASS).
- Commit style: conventional commits (`fix:`, `feat:`).
- Environment notes: shell is PowerShell on win32. `tsx` is NOT installed — use `node -e "..."` one-liners to inspect files. Playwright scripts live in `C:\Users\remvr\AppData\Local\Temp\opencode\pw\`. Electron loads the BUILT `dist/` via `app://` — `npm run build:electron` MUST complete before any Electron DOM check.

---

### Task 1: Fix player tabs (no-drag + equal-width centered tabs)

**Files:**
- Modify: `components/Player.tsx`

**Interfaces:**
- Consumes: the existing `<header>` (line ~280), close button (~281), tab nav block (~289-305), right-side button group (~307-323), `WindowControls` (line 323). Uses `useStore()` state as-is; no signature changes.
- Produces: no exports; Task 2 has no dependency on this.

- [ ] **Step 1: Read the current component section to confirm the exact markup to replace**

Run: `node -e "const s=require('fs').readFileSync('components/Player.tsx','utf8'); console.log(s.slice(s.indexOf('{/* Top Navigation */}'), s.indexOf('{/* Main Content Area */}')));"`

Expected: prints the header block (lines ~279-324): `<header className="relative z-20 flex items-center justify-between p-4 md:p-6 ...">`, the close button, the tab-nav `div` with `flex items-center gap-1`, and the right-side `<div className="flex items-center gap-2">`.

- [ ] **Step 2: Add the `appRegion` helper and `CSSProperties` type import**

The file imports `React, { useState, useEffect, useCallback, useRef }` from `'react'` (line 1). Add the type import immediately after it:

```tsx
import type { CSSProperties } from 'react';
```

Add the helper near the top of the file, next to the existing `withAlpha` helper (around line 27-43):

```tsx
const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;
```

- [ ] **Step 3: Apply `no-drag` to the close button**

On the close button (line ~281-287), add a `style` prop:

```tsx
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-lg bg-neutral-200 dark:bg-white/10 flex items-center justify-center hover:bg-neutral-300 dark:hover:bg-white/20 transition-all active:scale-95"
                    aria-label="Close player"
                    style={appRegion('no-drag')}
                >
```

- [ ] **Step 4: Apply `no-drag` to the tab bar and make the tabs equal-width + centered**

Replace the entire tab navigation block (lines ~289-305) with:

```tsx
                {/* Tab Navigation */}
                {!isZenMode && (
                    <div
                        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-200 dark:bg-white/5 rounded-lg p-1"
                        style={appRegion('no-drag')}
                    >
                        {(['playing', 'lyrics', 'queue'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`w-24 py-2 rounded-md text-xs font-semibold uppercase tracking-wide transition-all ${activeTab === tab
                                    ? 'bg-white text-black'
                                    : 'text-neutral-600 dark:text-white/50 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                {tab === 'playing' ? 'Now Playing' : tab}
                            </button>
                        ))}
                    </div>
                )}
```

Notes:
- `px-4` is replaced with `w-24` (fixed 96px width) so all three tabs are identical size regardless of label; button text centers automatically.
- `absolute left-1/2 -translate-x-1/2` truly centers the group in the `relative` header regardless of the unequal side groups (close button left, right controls right).
- `style={appRegion('no-drag')}` on the tab bar so real OS clicks on tabs are not swallowed by the TopBar's native drag band.

- [ ] **Step 5: Apply `no-drag` to the right-side button group**

On the right-side group `<div className="flex items-center gap-2">` (line ~307), add the style prop:

```tsx
                <div className="flex items-center gap-2" style={appRegion('no-drag')}>
```

The `WindowControls` inside already sets its own `no-drag` on each button (WindowControls.tsx:39,47,55), so this group-level `no-drag` is for the visualizer and zen-mode buttons (lines 308-322).

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: 85/85 passing (10 files).

Run: `npm run build`
Expected: PASS.

Run: `npm run build:electron`
Expected: PASS (rebuilds `dist/`, which Electron loads via `app://`).

- [ ] **Step 7: Manual DOM check in Electron**

`npm run build:electron` (Step 6) MUST have completed. Create `C:\Users\remvr\AppData\Local\Temp\opencode\pw\verify-tabs-fixed.mjs`:

```javascript
import { _electron as electron } from 'playwright-core';
const app = await electron.launch({
  executablePath: 'C:/Users/remvr/Documents/Nebula Desktop/node_modules/electron/dist/electron.exe',
  args: ['C:/Users/remvr/Documents/Nebula Desktop'],
});
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(2500);
const demoBtn = win.locator('button', { hasText: 'Try Demo Mode' });
if (await demoBtn.count()) { await demoBtn.click(); await win.waitForTimeout(1500); }
const gotIt = win.locator('button', { hasText: 'Got it' });
if (await gotIt.count()) { await gotIt.click(); await win.waitForTimeout(400); }
const playNow = win.locator('button', { hasText: 'Play Now' });
if (await playNow.count()) { await playNow.click(); await win.waitForTimeout(1200); }
const openBtn = win.locator('[aria-label="Open full screen player"]:visible');
if (await openBtn.count()) { await openBtn.first().click(); await win.waitForTimeout(900); }

const result = await win.evaluate(() => {
  const tabs = [...document.querySelectorAll('button')].filter(b =>
    ['now playing', 'lyrics', 'queue'].includes(b.textContent.trim().toLowerCase()));
  const tabBar = tabs[0]?.closest('div[style]');
  const header = tabs[0]?.closest('header');
  const headerRect = header?.getBoundingClientRect();
  const barRect = tabBar?.getBoundingClientRect();
  return {
    tabCount: tabs.length,
    tabWidths: tabs.map(b => Math.round(b.getBoundingClientRect().width)),
    barNoDrag: tabBar ? getComputedStyle(tabBar).webkitAppRegion || getComputedStyle(tabBar).getPropertyValue('-webkit-app-region') : null,
    closeBtn: (() => {
      const c = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close player');
      return c ? getComputedStyle(c).webkitAppRegion || getComputedStyle(c).getPropertyValue('-webkit-app-region') : null;
    })(),
    rightGroupNoDrag: (() => {
      const g = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Enter zen mode' || b.getAttribute('aria-label') === 'Exit zen mode');
      return g ? getComputedStyle(g.parentElement).webkitAppRegion || getComputedStyle(g.parentElement).getPropertyValue('-webkit-app-region') : null;
    })(),
    centered: headerRect && barRect
      ? Math.round(Math.abs((barRect.x + barRect.width / 2) - (headerRect.x + headerRect.width / 2)))
      : null,
  };
});
console.log(JSON.stringify(result, null, 1));
await app.close();
console.log('done');
```

Expected:
- `tabCount: 3`
- `tabWidths` — all three equal (≈96, i.e. `w-24`)
- `barNoDrag`, `closeBtn`, `rightGroupNoDrag` — all equal `"no-drag"` (this is the key assertion for the fix; Playwright synthetic clicks cannot reproduce the native drag-region swallow, so the `no-drag` computed-style check plus your real-click confirmation is the verification).
- `centered` ≤ 2 (the tab group center is within ~2px of the header center).

Then the user must confirm with REAL OS clicks that the tabs (and close button) work in the full-screen player and the window is still draggable from the header's padding area.

- [ ] **Step 8: Commit**

```bash
git add components/Player.tsx
git commit -m "fix(player): Make full-screen player tabs clickable and equally sized"
```

Expected: commit succeeds; working tree clean except unrelated untracked items (`docs/superpowers/...`, `rename-probe/`).

---

### Task 2: Sign-in screen split view with cover flow

**Files:**
- Create: `components/CoverFlow.tsx`
- Modify: `components/SetupScreen.tsx`

**Interfaces:**
- Consumes: `useStore()` → `connectToSubsonic`, `enableDemoMode` (SetupScreen only); `Card`, `Button`, `Input`, `WindowControls` components (all already imported in SetupScreen).
- Produces: `CoverFlow` (default or named export, self-contained, no props). Task 1 has no dependency on this; later tasks (none) have no dependency.

- [ ] **Step 1: Create the `CoverFlow` component**

Create `components/CoverFlow.tsx`:

```tsx
import React, { useEffect, useState } from 'react';

const COVER_GRADIENTS: [string, string][] = [
    ['#06b6d4', '#8b5cf6'], // cyan -> violet
    ['#8b5cf6', '#ec4899'], // violet -> pink
    ['#ec4899', '#f59e0b'], // pink -> amber
    ['#f59e0b', '#10b981'], // amber -> emerald
    ['#10b981', '#06b6d4'], // emerald -> cyan
    ['#3b82f6', '#8b5cf6'], // blue -> violet
    ['#f43f5e', '#f59e0b'], // rose -> amber
    ['#14b8a6', '#3b82f6'], // teal -> blue
    ['#a855f7', '#ec4899'], // purple -> pink
    ['#f97316', '#f43f5e'], // orange -> rose
    ['#22d3ee', '#3b82f6'], // sky -> blue
    ['#84cc16', '#14b8a6'], // lime -> teal
    ['#e879f9', '#818cf8'], // fuchsia -> indigo
    ['#fbbf24', '#f97316'], // amber -> orange
    ['#2dd4bf', '#22d3ee'], // teal -> sky
    ['#c084fc', '#f472b6'], // violet -> pink
];

const COVERS = COVER_GRADIENTS.map(([from, to], i) => ({
    id: i,
    background: `linear-gradient(135deg, ${from}, ${to})`,
}));

const COVER_SIZE = 120;
const SPACING = 110;

export const CoverFlow: React.FC = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let raf = 0;
        let last = performance.now();
        const tick = (now: number) => {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            setProgress((p) => p + dt * 0.12);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const N = COVERS.length;

    return (
        <div className="relative h-full w-full overflow-hidden" style={{ perspective: '1200px' }}>
            <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
                {COVERS.map((cover, i) => {
                    let rel = i - (progress % N);
                    if (rel > N / 2) rel -= N;
                    if (rel < -N / 2) rel += N;
                    const abs = Math.abs(rel);
                    const tx = rel * SPACING;
                    const rotY = rel * -18;
                    const scale = Math.max(0.55, 1 - abs * 0.07);
                    const opacity = Math.max(0.25, 1 - abs * 0.12);
                    return (
                        <div
                            key={cover.id}
                            className="absolute rounded-xl shadow-2xl"
                            style={{
                                width: COVER_SIZE,
                                height: COVER_SIZE,
                                background: cover.background,
                                transform: `translateX(${tx}px) rotateY(${rotY}deg) scale(${scale})`,
                                opacity,
                                zIndex: Math.round(100 - abs),
                            }}
                        >
                            {/* Vinyl-ring motif */}
                            <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                                <div className="h-2/3 w-2/3 rounded-full bg-white/20" />
                                <div className="absolute h-1/2 w-1/2 rounded-full bg-white/10" />
                                <div className="absolute h-1/6 w-1/6 rounded-full bg-white/40" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
```

Notes:
- `progress` advances ~0.12 cover positions/second in a `requestAnimationFrame` loop, so the filmstrip continuously rolls; modulo wrap keeps it looping seamlessly.
- `rel` is the shortest signed distance from the front cover (range −N/2..N/2), driving `translateX`, `rotateY`, `scale`, `opacity`, and `zIndex` for the 3D cover-flow look.
- The vinyl-ring motif (concentric translucent circles) is drawn with divs; no assets/network.

- [ ] **Step 2: Rewrite `SetupScreen.tsx` into the split view**

Add the import:

```tsx
import { CoverFlow } from './CoverFlow';
```

Replace the outer return container and the centered-card wrapper. Specifically:

1. Change the root div (line ~49) from `overflow-auto` to `overflow-hidden`:

```tsx
    <div className="fixed inset-0 overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
```

2. Change the drag-strip z-index so it sits above the panels but below WindowControls (drag strip currently line ~51; WindowControls currently `z-10` at line ~54). Bump both:

```tsx
      {/* Drag region so the frameless window can be moved from the sign-in screen */}
      <div className="absolute top-0 inset-x-0 h-10 z-30" style={appRegion('drag')} />

      {/* Window controls (Windows only) */}
      <div className="absolute top-2 right-4 z-40" style={appRegion('no-drag')}>
        <WindowControls />
      </div>
```

3. Keep the two background decorations (dot pattern and blurred orb, lines ~58-68) as-is.

4. Replace the `<div className="relative flex min-h-screen items-center justify-center px-5 py-6">` wrapper (line ~70) AND its closing tag, plus the entire centered column (lines ~71-229: the `w-full max-w-md` div, the sign-in `Card`, and the About `Card`), with:

```tsx
      {/* Left: cover flow (hidden below lg) */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] lg:block">
        <CoverFlow />
      </div>

      {/* Right: sign-in form */}
      <div className="absolute inset-y-0 right-0 flex w-full items-center justify-center px-5 py-8 lg:w-[45%]">
        <div className="w-full max-w-sm">
          <Card
            elevation={4}
            hover={false}
            padding="lg"
            className="border-neutral-200/70 bg-white/90 dark:border-white/10 dark:bg-neutral-950/82"
          >
            <div className="mb-6 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-white">
                <svg viewBox="0 0 24 24" className="h-7 w-7 stroke-current" fill="none" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M4 10v4" className="opacity-40" />
                  <path d="M8 7v10" className="opacity-60" />
                  <path d="M12 3v18" />
                  <path d="M16 7v10" className="opacity-60" />
                  <path d="M20 10v4" className="opacity-40" />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500 dark:text-white/40">Nebula Music</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Sign in to Nebula</h1>
              <p className="mt-2 text-sm text-neutral-600 dark:text-white/55">
                Connect your Subsonic-compatible server and start listening.
              </p>
            </div>

            <form onSubmit={handleConnect} className="space-y-3">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-white/5">
                {([
                  ['password', 'Password'],
                  ['apiKey', 'API Key'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAuthMode(mode);
                      setPass('');
                      resetError();
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition ${authMode === mode
                      ? 'bg-white text-neutral-950 shadow-xs dark:bg-white dark:text-black'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-white/50 dark:hover:text-white'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                  Server URL
                </label>
                <Input
                  required
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    resetError();
                  }}
                  placeholder="https://music.yourserver.com"
                  autoComplete="url"
                  icon={<Server className="h-4 w-4" />}
                  className={`py-3 ${isInsecure ? 'border-yellow-500/40 focus:border-yellow-500/60 focus:ring-yellow-500/20' : ''}`}
                />
              </div>

              {authMode === 'password' && <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                  Username
                </label>
                <Input
                  required
                  type="text"
                  value={user}
                  onChange={(e) => {
                    setUser(e.target.value);
                    resetError();
                  }}
                  placeholder="Username"
                  autoComplete="username"
                  icon={<User className="h-4 w-4" />}
                  className="py-3"
                />
              </div>}

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                  {authMode === 'apiKey' ? 'API Key' : 'Password'}
                </label>
                <Input
                  required
                  type="password"
                  value={pass}
                  onChange={(e) => {
                    setPass(e.target.value);
                    resetError();
                  }}
                  placeholder={authMode === 'apiKey' ? 'Enter API key' : 'Enter password'}
                  autoComplete={authMode === 'apiKey' ? 'off' : 'current-password'}
                  icon={<LockKeyhole className="h-4 w-4" />}
                  className="py-3"
                />
              </div>

              {isInsecure && (
                <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-3 text-xs text-yellow-700 dark:text-yellow-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>HTTPS is recommended for secure server access.</span>
                </div>
              )}

              {status === 'error' && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Connection failed. Check your details and try again.</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  size="md"
                  loading={status === 'loading'}
                  icon={status === 'loading' ? undefined : <ArrowRight className="h-4 w-4" />}
                  className="w-full justify-center rounded-2xl"
                >
                  Connect Server
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={enableDemoMode}
                  className="w-full justify-center rounded-2xl"
                >
                  Try Demo Mode
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
```

This removes the About Nebula card entirely, narrows the form to `max-w-sm`, and keeps all form logic/handlers unchanged.

- [ ] **Step 3: Run the gate**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: 85/85 passing (10 files).

Run: `npm run build`
Expected: PASS.

Run: `npm run build:electron`
Expected: PASS (rebuilds `dist/`).

- [ ] **Step 4: Manual DOM check in Electron**

`npm run build:electron` (Step 3) MUST have completed. Create `C:\Users\remvr\AppData\Local\Temp\opencode\pw\verify-setup.mjs`:

```javascript
import { _electron as electron } from 'playwright-core';
const app = await electron.launch({
  executablePath: 'C:/Users/remvr/Documents/Nebula Desktop/node_modules/electron/dist/electron.exe',
  args: ['C:/Users/remvr/Documents/Nebula Desktop'],
});
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(2500);

async function report(label) {
  const r = await win.evaluate(() => {
    const root = document.querySelector('.fixed.inset-0');
    const form = [...document.querySelectorAll('h1')].find(h => h.textContent.includes('Sign in to Nebula'));
    const covers = [...document.querySelectorAll('div[style*="linear-gradient"]')].length;
    const about = [...document.querySelectorAll('p')].some(p => p.textContent.includes('About Nebula'));
    return {
      hasForm: !!form,
      coverCount: covers,
      aboutPresent: about,
      scrollY: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      rootOverflow: root ? getComputedStyle(root).overflow : null,
    };
  });
  console.log(label, JSON.stringify(r));
}

await report('1280x800 (default):');
await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(940, 600); });
await win.waitForTimeout(600);
await report('940x600:');
await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(700, 600); });
await win.waitForTimeout(600);
await report('700x600 (narrow, cover flow hidden):');
await app.close();
console.log('done');
```

Expected:
- `1280x800`: `hasForm: true`, `coverCount >= 16`, `aboutPresent: false`, `scrollHeight == clientHeight` (no vertical scroll), `hScroll <= 0`, `rootOverflow == "hidden"`.
- `940x600`: same, no scrollbar.
- `700x600`: `hasForm: true`, `coverCount: 0` (cover flow hidden below `lg`), no scrollbar, form centered.

Also verify visually: at 1280×800 the cover flow renders on the left with covers animating (rolling), the form is centered on the right, and the About card is gone. Confirm the window is still draggable from the top drag strip and closable via WindowControls (real clicks).

- [ ] **Step 5: Commit**

```bash
git add components/CoverFlow.tsx components/SetupScreen.tsx
git commit -m "feat(setup): Split sign-in screen with looping cover flow"
```

Expected: commit succeeds; working tree clean except unrelated untracked items.
