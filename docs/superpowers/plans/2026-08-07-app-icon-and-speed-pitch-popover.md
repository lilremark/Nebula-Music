# App Icon & Compact Speed & Pitch Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Nebula logo the Windows taskbar/window icon, and convert the full-screen player's Speed & Pitch modal into a compact popover that closes on outside click (desktop + web).

**Architecture:** Two independent tasks. Task 1 adds a `sharp` + `png-to-ico` based generator that rasterizes `logo.svg` into a committed `build/icon.png` (512px) and multi-size `build/icon.ico`, then wires them into `electron-builder.yml` and both `BrowserWindow` options in `electron/main.ts`. Task 2 rewrites the Speed & Pitch modal inside `components/Player.tsx` (shared by desktop and web) from a full-screen centered overlay into a `fixed`-positioned compact popover anchored to the button, closing on outside click via a transparent click-catcher.

**Tech Stack:** Node + sharp + png-to-ico (devDependencies), electron-builder, Electron main process (`electron/main.ts`), React + Tailwind + lucide-react (`components/Player.tsx`).

## Global Constraints

- Only `electron-builder.yml`, `electron/main.ts`, `package.json`/`package-lock.json`, new `scripts/generate-icons.mjs`, new `build/icon.png`, new `build/icon.ico`, and `components/Player.tsx` change. No other files.
- Do NOT modify `electron/tray.ts` (tray stays a violet dot), `electron/updater.ts`, any store, or any test file. Existing tests (85/85) must pass unchanged.
- The icon source of truth is `logo.svg` (repo root).
- Speed & Pitch popover content matches the sidebar `NowPlayingPanel` popover: Speed, Pitch, Digital/Analogue toggle, Reset. NO Magic Crossfade in the popover.
- The full-screen player's "Speed & Pitch" button (its toggle behavior and badge classes) is unchanged.
- No code comments unless a comment already exists there.
- Windows packaging targets x64 NSIS only (unchanged from `electron-builder.yml`).
- Gate to pass before committing: `npm run typecheck` (0 errors), `npm test` (85/85), `npm run build` (PASS), `npm run build:electron` (PASS).
- Commit style: conventional commits (`feat:`, `chore:`, `refactor:`).
- Environment notes: shell is PowerShell on win32. `tsx` is NOT installed — use `node -e "..."` one-liners to inspect files. `npm install` IS available for adding devDependencies.

---

### Task 1: Nebula app icon (generator + wiring)

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `build/icon.png` (generated, committed)
- Create: `build/icon.ico` (generated, committed)
- Modify: `package.json` (add devDependencies `sharp` and `png-to-ico`)
- Modify: `electron-builder.yml` (add `win.icon`)
- Modify: `electron/main.ts` (add `icon:` to both `BrowserWindow` option objects)

**Interfaces:**
- Consumes: `logo.svg` at repo root; `path` (already imported in `electron/main.ts`).
- Produces: committed `build/icon.png` (512×512) and `build/icon.ico` (16/24/32/48/64/128/256 frames). Later tasks do not depend on these.

- [ ] **Step 1: Install the icon tooling**

Run from repo root (PowerShell):

```powershell
npm install --save-dev sharp png-to-ico
```

Expected: both packages added to `devDependencies` in `package.json` and installed in `node_modules` (`Test-Path node_modules\sharp` → True, `Test-Path node_modules\png-to-ico` → True).

- [ ] **Step 2: Write the generator script**

Create `scripts/generate-icons.mjs`:

```js
import sharp from 'sharp';
import toIco from 'png-to-ico';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const svg = path.join(root, 'logo.svg');
const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });

// 512x512 PNG (electron-builder / window icon source, and the largest frame)
const png512 = await sharp(svg).resize(512, 512).png().toBuffer();
await fs.promises.writeFile(path.join(outDir, 'icon.png'), png512);

// Multi-size ICO frames for Windows (taskbar, alt-tab, exe resource)
const sizes = [256, 128, 64, 48, 32, 24, 16];
const frames = [];
for (const size of sizes) {
  frames.push(await sharp(svg).resize(size, size).png().toBuffer());
}
const ico = await toIco(frames);
await fs.promises.writeFile(path.join(outDir, 'icon.ico'), ico);

console.log(`generated build/icon.png (512x512) and build/icon.ico (${sizes.join(',')}px)`);
```

- [ ] **Step 3: Run the generator and verify output**

Run: `node scripts/generate-icons.mjs`
Expected: prints `generated build/icon.png (512x512) and build/icon.ico (256,128,64,48,32,24,16px)`.

Verify both files are real images:

```powershell
node -e "const s=require('sharp'); (async()=>{for (const f of ['build/icon.png','build/icon.ico']){const m=await s(f).metadata(); console.log(f, m.format, m.width+'x'+m.height);}})()"
```

Expected: `build/icon.png png 512x512` and `build/icon.ico ico 256x256` (ico reports the largest frame). `Test-Path build\icon.ico` → True, and `(Get-Item build\icon.ico).Length` is non-trivial (>10 KB).

- [ ] **Step 4: Wire the icon into electron-builder**

Edit `electron-builder.yml`. Under the existing `win:` block add `icon` (keep the existing `target`/`artifactName`):

```yaml
win:
  icon: build/icon.ico
  target:
    - target: nsis
      arch:
        - x64
  artifactName: ${productName}-${version}-setup.${ext}
```

Also add `build/**/*` to the `files:` list so the runtime window-icon path resolves inside the packaged asar:

```yaml
files:
  - dist/**/*
  - electron/dist/**/*
  - build/**/*
  - package.json
```

- [ ] **Step 5: Set the runtime window icons**

In `electron/main.ts`, add an `icon` option to BOTH `BrowserWindow` constructors:

1. `createWindow` (around line 176-191): add `icon: path.join(__dirname, '..', '..', 'build', 'icon.ico'),` to the options object (e.g. directly after `backgroundColor: '#0b0b12',`).
2. `createMiniPlayerWindow` (around line 248-267): add the same line after `backgroundColor: '#17171a',`.

`path` is already imported at the top of `main.ts`. When compiled, `__dirname` is `electron/dist`, so `..`/`..` resolves to the repo root in dev and to the asar root when packaged.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: 85/85 passing (10 files).

Run: `npm run build`
Expected: build completes with PASS.

Run: `npm run build:electron`
Expected: build completes with PASS.

- [ ] **Step 7: Verify the icon is wired end-to-end (packaged)**

Run a directory-only package (faster than NSIS) to confirm electron-builder picks up the icon:

```powershell
npx electron-builder --win dir --publish never
```

Expected: completes; `release/win-unpacked/Nebula.exe` exists. (The exe now embeds the Nebula icon; if you later run `npm run dist:win`, the installer + taskbar will show it.)

Optional runtime check (dev): launch `npm run start:electron`, confirm the taskbar/alt-tab shows the Nebula icon. This is a manual visual check — report what you see.

- [ ] **Step 8: Commit**

```bash
git add scripts/generate-icons.mjs build/icon.png build/icon.ico package.json package-lock.json electron-builder.yml electron/main.ts
git commit -m "feat(desktop): Use the Nebula logo as the Windows app icon"
```

Expected: commit succeeds; `git status --short` shows only unrelated untracked artifacts (e.g. plan/spec docs under `docs/superpowers/`).

---

### Task 2: Compact Speed & Pitch popover in the full-screen player

**Files:**
- Modify: `components/Player.tsx` (add a ref + position state, a `toggleSpeedPitch` handler, a `pointerdown`/click-catcher close, and replace the modal JSX at lines ~488-620)

**Interfaces:**
- Consumes (already in scope of the component): `useStore()` → `playbackRate`, `setPlaybackRate`, `pitch`, `setPitch`, `pitchCorrection`, `setPitchCorrection`, `settings`; `showSpeedPitchModal`/`setShowSpeedPitchModal` state (line 64); lucide icons `Minus`, `Plus`, `X` (all imported at line 3-5).
- Produces: no exports; later tasks have no dependencies on this component.

- [ ] **Step 1: Read the current component section to confirm the exact markup to replace**

Run: `node -e "const s=require('fs').readFileSync('components/Player.tsx','utf8'); console.log(s.slice(s.indexOf('const [showSpeedPitchModal'), s.indexOf('{/* Lyrics Tab */}')))"`

Expected: prints the state line, the `toggleProgressMode` handler, the "Speed & Pitch Toggle Button" block (lines ~467-486), and the full-screen modal (lines ~488-620) ending right before `{/* Lyrics Tab */}`. Confirm the modal is the `fixed inset-0 z-[100]` overlay with `max-w-sm` card and the `settings.magicCrossfade` toggle inside it.

- [ ] **Step 2: Add the ref, position state, and toggle handler**

Add these near the existing state/refs (after line 64 `showSpeedPitchModal` state, or with the refs at lines 68-69):

```tsx
    const speedPitchButtonRef = useRef<HTMLButtonElement>(null);
    const [speedPitchPos, setSpeedPitchPos] = useState<{ left: number; bottom: number } | null>(null);

    const toggleSpeedPitch = () => {
        if (showSpeedPitchModal) {
            setShowSpeedPitchModal(false);
            return;
        }
        const r = speedPitchButtonRef.current?.getBoundingClientRect();
        if (r) {
            setSpeedPitchPos({ left: r.left + r.width / 2, bottom: window.innerHeight - r.top + 12 });
        }
        setShowSpeedPitchModal(true);
    };
```

`useRef` and `useState` are already imported (line 1). Place `toggleSpeedPitch` next to `toggleProgressMode` (around line 205-207).

- [ ] **Step 3: Point the button at the new handler and add the ref**

In the "Speed & Pitch Toggle Button" block (line ~468), change:

```tsx
                            onClick={() => setShowSpeedPitchModal(!showSpeedPitchModal)}
```

to:

```tsx
                            onClick={toggleSpeedPitch}
                            ref={speedPitchButtonRef}
```

Leave the button's `className`, badge, and label logic (lines 470-485) unchanged.

- [ ] **Step 4: Replace the modal JSX with the compact popover**

Replace the entire `{showSpeedPitchModal && ( ... )}` block (lines ~488-620) with:

```tsx
                            {showSpeedPitchModal && speedPitchPos && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[100]"
                                        onClick={() => setShowSpeedPitchModal(false)}
                                    />
                                    <div
                                        className="fixed z-[100] w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/95"
                                        style={{ left: speedPitchPos.left, bottom: speedPitchPos.bottom }}
                                    >
                                        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 dark:text-white/45">Playback</p>
                                                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Speed & Pitch</h3>
                                            </div>
                                            <button
                                                onClick={() => setShowSpeedPitchModal(false)}
                                                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition-all dark:text-white/55 dark:hover:text-white dark:hover:bg-white/10"
                                                aria-label="Close playback settings"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <div className="space-y-4 p-4">
                                            {/* Speed Control */}
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <label className="text-[10px] font-semibold text-neutral-500 dark:text-white/55 uppercase tracking-wide">Speed</label>
                                                    <span className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-white/50">{playbackRate.toFixed(1)}x</span>
                                                </div>
                                                <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-white/10 dark:bg-white/[0.04]">
                                                    <button
                                                        onClick={() => { setPlaybackRate(Math.max(0.5, Math.round((playbackRate - 0.1) * 10) / 10)); }}
                                                        className="w-9 h-9 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-white dark:text-white/55 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                                        aria-label="Decrease speed"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <span className="min-w-16 text-center text-base font-mono text-neutral-900 dark:text-white font-bold tabular-nums">{playbackRate.toFixed(1)}x</span>
                                                    <button
                                                        onClick={() => { setPlaybackRate(Math.min(2.0, Math.round((playbackRate + 0.1) * 10) / 10)); }}
                                                        className="w-9 h-9 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-white dark:text-white/55 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                                        aria-label="Increase speed"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Pitch Control */}
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <label className="text-[10px] font-semibold text-neutral-500 dark:text-white/55 uppercase tracking-wide">Pitch</label>
                                                    <span className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-white/50">semitones</span>
                                                </div>
                                                <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-white/10 dark:bg-white/[0.04]">
                                                    <button
                                                        onClick={() => setPitch(Math.max(-12, pitch - 1))}
                                                        className="w-9 h-9 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-white dark:text-white/55 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                                        aria-label="Decrease pitch"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <span className="min-w-16 text-center text-base font-mono text-neutral-900 dark:text-white font-bold tabular-nums">{pitch > 0 ? '+' : ''}{pitch}</span>
                                                    <button
                                                        onClick={() => setPitch(Math.min(12, pitch + 1))}
                                                        className="w-9 h-9 flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:bg-white dark:text-white/55 dark:hover:text-white dark:hover:bg-white/10 rounded-md transition-all"
                                                        aria-label="Increase pitch"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mode Toggle */}
                                            <div className="border-t border-neutral-200 pt-4 dark:border-white/10">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <label className="text-[10px] font-semibold text-neutral-500 dark:text-white/55 uppercase tracking-wide">Pitch Mode</label>
                                                    <span className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-white/50">{pitchCorrection ? 'locked' : 'linked'}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-white/10 dark:bg-white/[0.04]">
                                                    <button
                                                        onClick={() => setPitchCorrection(true)}
                                                        className={`py-2 px-3 rounded-md text-xs font-bold transition-all ${pitchCorrection
                                                            ? 'bg-neutral-900 text-white shadow-xs dark:bg-white dark:text-black'
                                                            : 'text-neutral-600 hover:text-neutral-900 hover:bg-white dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10'
                                                            }`}
                                                    >
                                                        Digital
                                                    </button>
                                                    <button
                                                        onClick={() => setPitchCorrection(false)}
                                                        className={`py-2 px-3 rounded-md text-xs font-bold transition-all ${!pitchCorrection
                                                            ? 'bg-neutral-900 text-white shadow-xs dark:bg-white dark:text-black'
                                                            : 'text-neutral-600 hover:text-neutral-900 hover:bg-white dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10'
                                                            }`}
                                                    >
                                                        Analogue
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-neutral-500 dark:text-white/50 mt-2 leading-snug">
                                                    {pitchCorrection ? 'Speed and pitch adjust independently.' : 'Speed changes pitch together.'}
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => { setPlaybackRate(1.0); setPitch(0); }}
                                                className="w-full py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 dark:text-white/60 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 rounded-lg transition-all"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
```

This mirrors the sidebar popover's content. The popover is `fixed` (computed from the button's rect), so it is not clipped by the now-playing scroll container. Note: `settings` and `updateSettings` are no longer used by this block — `updateSettings` is still used by `toggleProgressMode` (line 206), and `settings` is still used by the button badge (lines 470-483), so no imports become dead. `playbackRate`/`pitch` handlers deliberately do NOT touch `audioRef.current.playbackRate` directly (the store's effect applies playback attributes), matching the previous full-screen modal behavior.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: 85/85 passing (10 files). No test files changed.

Run: `npm run build`
Expected: PASS.

Run: `npm run build:electron`
Expected: PASS (rebuilds `dist/`, which Electron loads via `app://`).

- [ ] **Step 6: Manual DOM check in Electron (dev build)**

The `npm run build:electron` in Step 5 MUST complete before this. Create `C:\Users\remvr\AppData\Local\Temp\opencode\pw\verify-speedpitch.mjs`:

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

// Open the popover via the toggle button (real pointer click)
const toggle = win.locator('button', { hasText: 'Speed & Pitch' }).first();
await toggle.click();
await win.waitForTimeout(400);

const opened = await win.evaluate(() => {
  const popup = [...document.querySelectorAll('div')].find(d =>
    d.className.includes('fixed z-[100] w-72') && d.textContent.includes('Speed & Pitch'));
  if (!popup) return null;
  const r = popup.getBoundingClientRect();
  const hasBackdrop = [...document.querySelectorAll('div')].some(d =>
    d.className.includes('fixed inset-0 z-[100]') && !d.textContent.trim());
  return { w: Math.round(r.width), h: Math.round(r.height), hasBackdrop, onScreen: r.bottom <= window.innerHeight };
});
console.log('opened:', JSON.stringify(opened));

// Close via clicking outside (top-left corner of the window)
await win.mouse.click(8, 8);
await win.waitForTimeout(300);
const closed = await win.evaluate(() => {
  return ![...document.querySelectorAll('div')].some(d =>
    d.className.includes('fixed z-[100] w-72') && d.textContent.includes('Speed & Pitch'));
});
console.log('closed on outside click:', closed);
await app.close();
```

Expected output:
- `opened` non-null with `w` ≈ 288 (w-72 = 18rem), `onScreen: true`, `hasBackdrop` is `true` (the transparent click-catcher) but it has no visible background (its `className` is exactly `fixed inset-0 z-[100]` — no `bg-*`).
- `closed on outside click: true`.

Also verify visually (screenshot or on-screen) at 1280×800 and 940×600 that the popover floats above the button, is compact (w-72), and no dark full-screen backdrop appears.

- [ ] **Step 7: Commit**

```bash
git add components/Player.tsx
git commit -m "feat(player): Make Speed & Pitch a compact click-outside popover in the full-screen player"
```

Expected: commit succeeds; working tree clean except unrelated untracked docs.
