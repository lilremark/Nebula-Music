# Settings — Updates Panel Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Settings → Updates panel into a centered hero layout with a larger, centered, primary-colored Check-for-updates button.

**Architecture:** A single presentational change inside `DesktopUpdatesPanel` in `views/Settings.tsx`. The component already subscribes to `platform.updater` state; no state, IPC, updater, or test changes are needed. The two existing stacked rows (version row + two-column row) are replaced with: a centered hero block (badge → version → message), a fixed-width primary button whose label/icon vary by `phase`, an optional progress bar, and the channel selector moved below as a centered row.

**Tech Stack:** React + TypeScript, Tailwind CSS v4 utility classes, lucide-react icons, the existing `SettingPanel` component and `platform.updater` / `platform.settings` APIs.

## Global Constraints

- Touch only `views/Settings.tsx` — specifically the `DesktopUpdatesPanel` component (lines ~209-319).
- Do NOT modify `electron/updater.ts`, `electron/main.ts`, any store, or any test file. Existing `electron/updater.test.ts` tests must still pass unchanged.
- Preserve all existing update-state semantics verbatim: `phase`, `progress`, `message`, `enabled`, `currentVersion`, `readyToInstall`, `busy`, `badgeClass`, and handlers `platform.updater.check()`, `platform.updater.installAndRestart()`, `changeChannel`.
- The button uses the app's primary color: `bg-primary text-black hover:brightness-110`.
- Button fixed width `w-56`, height `py-3`, `text-sm`, `rounded-lg`, centered via `mx-auto` (or a centered flex parent).
- When `phase === 'downloaded'`, the button swaps to the existing "Restart & Install" primary button keeping the same `w-56` width so the layout does not jump.
- Progress bar shows only while `phase === 'downloading'`, width `w-56` to match the button, track `h-1.5 bg-white/10`, fill `bg-primary`.
- Channel selector keeps its Stable/Beta behavior and gets narrowed to `w-48`, centered below the button with a small centered caption.
- No comments in code unless a comment already exists there (project convention: do not add comments).
- Gate to pass before committing: `npm run typecheck`, `npm test` (85/85 expected), `npm run build`, `npm run build:electron`.
- Commit message style: conventional commits (`feat:`, `fix:`, `refactor:`, etc.) used in this repo.

---

### Task 1: Redesign DesktopUpdatesPanel into a centered hero

**Files:**
- Modify: `views/Settings.tsx:209-319` (the entire `DesktopUpdatesPanel` component; only the returned JSX and the `buttonLabel`/`buttonIcon` helpers change)

**Interfaces:**
- Consumes: `usePlatform()` (`platform.info.kind`, `platform.info.appVersion`, `platform.settings.get/set`, `platform.updater.getState/onStatus/check/installAndRestart`), `UpdaterState` type from `../electron/updater`, `SettingPanel` component (defined at line 26), `Download` and `RefreshCw` lucide icons (already imported at line 3-5).
- Produces: no exports; later tasks have no dependencies on this component's internals.

- [ ] **Step 1: Write the failing test**

There is no component-harness test infrastructure for `Settings.tsx` (vitest runs node-env only; `SettingPanel`/`DesktopUpdatesPanel` render DOM and would need a browser). Per the spec, behavior is covered by the existing `electron/updater.test.ts` (unchanged) plus the manual DOM check. Instead of a unit test, define the acceptance check that will be run after implementation:

```bash
npm run typecheck && npm test && npm run build && npm run build:electron
```

Expected: typecheck 0 errors, tests 85/85 pass, build PASS, build:electron PASS.

- [ ] **Step 2: Read the current component to confirm the exact markup to replace**

Run: `node -e "const s=require('fs').readFileSync('views/Settings.tsx','utf8'); console.log(s.slice(s.indexOf('const DesktopUpdatesPanel'), s.indexOf('export const SettingsView')));"`
Expected: prints the `DesktopUpdatesPanel` body (lines ~209-319). Confirm the current structure: `SettingPanel icon={Download} title="Updates"`, hero row with version + message + badge, then a `grid gap-px ... md:grid-cols-2` with channel selector (left) and buttons (right).

- [ ] **Step 3: Implement the hero layout**

Replace the return value of `DesktopUpdatesPanel` (lines 256-317) with:

```tsx
    return (
        <SettingPanel icon={Download} title="Updates">
            <div className="px-5 py-6">
                <div className="flex flex-col items-center text-center">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${badgeClass}`}>
                        {phase.replace('-', ' ')}
                    </span>
                    <span className="mt-3 block text-lg font-bold text-neutral-900 dark:text-white">
                        {currentVersion ? `Nebula ${currentVersion}` : 'Nebula'}
                    </span>
                    <span className="mt-1 block max-w-xl text-xs leading-relaxed text-neutral-600 dark:text-white/50">
                        {updateState?.message ?? 'Updates are checked against GitHub Releases.'}
                    </span>

                    {phase === 'downloaded' ? (
                        <button
                            type="button"
                            onClick={() => platform.updater.installAndRestart()}
                            className="mt-5 flex w-56 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-black transition hover:brightness-110"
                        >
                            <Download className="h-4 w-4" />
                            Restart &amp; Install
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => platform.updater.check()}
                            disabled={!enabled || busy}
                            className="mt-5 flex w-56 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                            {busy ? (phase === 'downloading' ? `Downloading\u2026 ${updateState?.progress ?? 0}%` : 'Checking\u2026') : 'Check for updates'}
                        </button>
                    )}

                    {phase === 'downloading' && (
                        <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${updateState?.progress ?? 0}%` }}
                            />
                        </div>
                    )}
                </div>

                <div className="mt-6 flex flex-col items-center">
                    <span className="block text-sm font-semibold text-neutral-900 dark:text-white">Update channel</span>
                    <span className="mt-1 block text-xs leading-relaxed text-neutral-600 dark:text-white/50">
                        Beta delivers pre-release builds from the beta channel.
                    </span>
                    <div className={`mt-3 grid w-48 grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1 dark:bg-white/5 ${enabled ? '' : 'pointer-events-none opacity-50'}`}>
                        {[{ value: 'stable', label: 'Stable' }, { value: 'beta', label: 'Beta' }].map(option => (
                            <button
                                type="button"
                                key={option.value}
                                onClick={() => changeChannel(option.value)}
                                className={`rounded-md px-3 py-2.5 text-xs font-bold transition-all ${channel === option.value
                                    ? 'bg-white text-neutral-950 shadow-xs dark:bg-white dark:text-black'
                                    : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </SettingPanel>
    );
```

Note: `enabled` is `false` outside installed builds (dev), so the channel selector renders with `pointer-events-none opacity-50` and the Check button renders `disabled` — the manual DOM check below must account for that.

- [ ] **Step 4: Run the gate to verify it passes**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: 85/85 passing (10 files). The updater tests are unchanged and must all pass.

Run: `npm run build`
Expected: build completes with PASS.

Run: `npm run build:electron`
Expected: build completes with PASS (dist assets written).

- [ ] **Step 5: Manual DOM check in Electron (dev build, updates disabled)**

Because `enabled` is `false` in a non-installed dev build, run the app in Electron and confirm the hero renders: the badge, "Nebula 2.2.0", the default message, the disabled "Check for updates" button, and the dimmed channel selector are all present and centered.

Run (using Playwright script `C:\Users\remvr\AppData\Local\Temp\opencode\pw\verify-settings.mjs` — create it if absent):

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
const settingsBtn = win.locator('button', { hasText: 'Settings' }).first();
if (await settingsBtn.count()) { await settingsBtn.click(); await win.waitForTimeout(1200); }
const result = await win.evaluate(() => {
  const text = document.body.innerText;
  const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Check for updates'));
  const badge = [...document.querySelectorAll('span')].find(s => /up to date|downloading|idle/.test(s.textContent));
  return {
    hasUpdatesPanel: text.includes('Updates') && text.includes('Update channel'),
    hasVersion: text.includes('Nebula 2.2.0'),
    checkBtn: btn ? { text: btn.textContent.trim(), disabled: btn.disabled, w: btn.getBoundingClientRect().width } : null,
    badgeText: badge ? badge.textContent.trim() : null,
  };
});
console.log(JSON.stringify(result, null, 2));
await app.close();
```

Expected: `hasUpdatesPanel: true`, `hasVersion: true`, `checkBtn` present with `disabled: true` and `w` ≈ 224 (w-56 = 14rem), `badgeText` non-null. The button and channel row must be horizontally centered (verify visually via the values or a screenshot; exact centering is verified by the fixed `w-56`/`w-48` + `items-center` flex parent).

Note: if the Settings view is hard to reach in demo mode, instead verify by temporarily running the web dev server (`npm run dev`) — but on web, `platform.info.kind !== 'desktop'` so `DesktopUpdatesPanel` returns `null`. Use the Electron route only.

- [ ] **Step 6: Commit**

```bash
git add views/Settings.tsx
git commit -m "feat(desktop): Redesign Settings updates panel as centered hero"
```

Expected: commit succeeds; working tree clean afterward.
