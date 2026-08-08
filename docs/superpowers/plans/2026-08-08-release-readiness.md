# Nebula Desktop Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Nebula Desktop for a GitHub Release: fix the renderer MediaImage warning, flush demo state on server connect, fix Home layout crushing, wire a seamless update flow with notification, fix the sidebar X button, add an MSIX installer, make the visualizer sonically accurate, smooth the mini-player ticker, add Windows taskbar thumbnail buttons, and harden credential security.

**Architecture:** Ten independent tasks, each touching a small, well-defined surface. Task 1 fixes the mediaSession artwork scheme warning via a data-URL conversion helper. Task 2 aligns the in-session demo→server flush with the existing app-start flush. Task 3 restructures the Home grid. Task 4 adds a concurrency guard + tray balloon + in-app update banner to the existing updater. Task 5 mirrors the player-tab no-drag fix onto the NavDrawer. Task 6 adds an MSIX target. Task 7 reworks the visualizer signal path (pre-DSP analyser, reduced smoothing, position→frequency band mapping). Task 8 adds rAF-driven progress to the mini-players. Task 9 adds `setThumbarButtons`. Task 10 hardens vault IPC and URL persistence.

**Tech Stack:** React + TypeScript + Tailwind, Electron main/preload, electron-updater, electron-builder (NSIS + MSIX), WebAudio AnalyserNode, `-webkit-app-region`.

## Global Constraints

- Existing tests (85/85) must keep passing; add unit tests where the change is testable (updater concurrency guard, lastServerUrl sanitizer).
- No comments in code unless a comment already exists there.
- Gate: `npm run typecheck` 0 errors, `npm test` green, `npm run build` PASS, `npm run build:electron` PASS.
- Commit style: conventional commits.
- Shell is PowerShell on win32; `tsx` is NOT installed — use `node -e "..."` one-liners.
- Electron loads the BUILT `dist/` via `app://` — `npm run build:electron` MUST complete before any Electron DOM check.
- Playwright scripts live in `C:\Users\remvr\AppData\Local\Temp\opencode\pw\`.
- Do not modify `electron/tray.ts`'s icon embedding, `electron/credentialVault.ts`'s safeStorage encryption, or any test file except where a task explicitly adds new test coverage.

---

### Task 1: Fix renderer MediaImage warning (mediaSession artwork)

**Files:**
- Modify: `context/Store.tsx` (mediaSession effect ~1852-1867)
- Create: `services/mediaSessionArtwork.ts` (helper, unit-testable)

**Interfaces:**
- Consumes: `service.getCoverArtUrl(id, size)`; `song.id`/`song.coverArt`.
- Produces: `toDataUrlArtwork(urls: { src: string; sizes: string; type: string }[]): Promise<{ src: string; sizes: string; type: string }[]>` — fetch each URL, convert to a `data:` URL, drop any that fail.

- [ ] **Step 1: Write the failing test**

Create `services/mediaSessionArtwork.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { toDataUrlArtwork } from './mediaSessionArtwork';

describe('toDataUrlArtwork', () => {
  it('converts fetchable http URLs to data URLs', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    const result = await toDataUrlArtwork([{ src: 'https://example.com/art.jpg', sizes: '96x96', type: 'image/jpeg' }]);
    expect(result).toHaveLength(1);
    expect(result[0].src.startsWith('data:image/jpeg')).toBe(true);
  });

  it('drops entries whose fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('nope'));
    const result = await toDataUrlArtwork([{ src: 'app://nebula/proxy?u=x', sizes: '96x96', type: 'image/jpeg' }]);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/mediaSessionArtwork.test.ts`
Expected: FAIL — module `./mediaSessionArtwork` cannot be resolved.

- [ ] **Step 3: Implement the helper**

Create `services/mediaSessionArtwork.ts`:

```ts
export interface MediaArtworkEntry {
  src: string;
  sizes: string;
  type: string;
}

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read artwork.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Artwork did not produce a data URL.'));
    reader.readAsDataURL(blob);
  });

export const toDataUrlArtwork = async (
  entries: MediaArtworkEntry[],
): Promise<MediaArtworkEntry[]> => {
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const response = await fetch(entry.src, { credentials: 'same-origin' });
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) return null;
        const dataUrl = await readBlobAsDataUrl(blob);
        return { src: dataUrl, sizes: entry.sizes, type: blob.type };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((entry): entry is MediaArtworkEntry => entry !== null);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/mediaSessionArtwork.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into the mediaSession effect**

In `context/Store.tsx`, import the helper:

```tsx
import { toDataUrlArtwork } from '../services/mediaSessionArtwork';
```

Replace the artwork construction in the mediaSession effect (lines ~1854-1866) so it builds artwork via the helper. The effect must become async-capable; assign metadata after the conversion resolves, and guard against a stale song:

```tsx
    if (currentSongIndex >= 0 && queue[currentSongIndex]) {
      const song = queue[currentSongIndex];
      const artId = song.coverArt || song.id;
      void toDataUrlArtwork([
        { src: service.getCoverArtUrl(artId, 96),  sizes: '96x96',   type: 'image/jpeg' },
        { src: service.getCoverArtUrl(artId, 128), sizes: '128x128', type: 'image/jpeg' },
        { src: service.getCoverArtUrl(artId, 256), sizes: '256x256', type: 'image/jpeg' },
        { src: service.getCoverArtUrl(artId, 512), sizes: '512x512', type: 'image/jpeg' },
      ]).then((artwork) => {
        const current = queue[currentSongIndexRef.current];
        if (!current || current.id !== song.id) return;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.title,
          artist: song.artist,
          album: song.album,
          artwork: artwork.map(({ src, sizes, type }) => ({ src, sizes, type })),
        });
      });
    } else { navigator.mediaSession.metadata = null; }
```

Note: if a `currentSongIndexRef` does not already exist, add `const currentSongIndexRef = useRef(currentSongIndex); currentSongIndexRef.current = currentSongIndex;` near the top of the component and add it to the effect deps. (Verify the exact dependency array at line 1882 and add the ref.)

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85 + 2 new), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 7: Verify in Electron**

Create `C:\Users\remvr\AppData\Local\Temp\opencode\pw\verify-mediaimage.mjs` — launch Electron dev, enter Demo mode, Play Now, wait ~4s, then read the main process console for the `MediaImage src can only be of` warning. Expected: no such warning. (Script: reuse the demo-launch pattern from `verify-tabs-fixed.mjs`, capture `console-message` events via a listener registered before the click, print any matching lines.)

- [ ] **Step 8: Commit**

```bash
git add services/mediaSessionArtwork.ts services/mediaSessionArtwork.test.ts context/Store.tsx
git commit -m "fix(desktop): Use data URLs for media session artwork to silence scheme warning"
```

---

### Task 2: Flush demo state when signing into a server

**Files:**
- Modify: `context/Store.tsx` (`connectToSubsonic` success block ~1991-2007)

**Interfaces:**
- Consumes: existing `PLAY_HISTORY_KEY`, `setPlayHistory`, `setViewData`/`setNavigationStack`/`navigationStackRef`, `setSearchResults`, `setRadioStations`, `setPlaylists`.
- Produces: no exports.

- [ ] **Step 1: Read the current success block and init flush**

Run: `node -e "const s=require('fs').readFileSync('context/Store.tsx','utf8'); console.log(s.slice(s.indexOf('const connectToSubsonic'), s.indexOf('const disconnect')));"`

Also run: `node -e "const s=require('fs').readFileSync('context/Store.tsx','utf8'); console.log(s.slice(s.indexOf('localStorage.removeItem(PLAY_HISTORY_KEY)'), s.indexOf('const savedSettings')));"`

Expected: the success block clears queue/homeData/artists/mostPlayed but not play history, explore cache, viewData, searchResults, or radioStations; the init block (Store.tsx:648-672) removes `nebula_explore_data`/`nebula_explore_date`/`PLAY_HISTORY_KEY`, resets homeData, and clears playHistory.

- [ ] **Step 2: Extend the success block to flush everything**

In `context/Store.tsx`, inside `connectToSubsonic`'s `if (success)` block (after `setMostPlayed([])` at line ~2002), add:

```tsx
      // Flush demo-sourced state so server content is not mixed in.
      localStorage.removeItem('nebula_explore_data');
      localStorage.removeItem('nebula_explore_date');
      localStorage.removeItem(PLAY_HISTORY_KEY);
      setPlayHistory({});
      setSearchResults([]);
      setRadioStations([]);
      setPlaylists([]);
      navigationStackRef.current = [];
      setNavigationStack([]);
      setViewData(null);
```

Then change the playlists fetch (line ~2005) to handle rejection so demo playlists can never persist:

```tsx
      service.getPlaylists().then(setPlaylists).catch(() => {});
```

Verify the exact setter names exist (`setViewData`, `setNavigationStack`, `navigationStackRef`, `setSearchResults`, `setRadioStations`, `setPlayHistory`) by grepping `context/Store.tsx`; if any differ (e.g. `setPlayHistory` is spelled differently), use the real names from the init block (lines 654-667 reference them).

- [ ] **Step 3: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 4: Verify in Electron**

Launch Electron, enter Demo mode, play a song, then connect to a real server. Expected: Home shows only server content; Library playlists are empty until the server fetch resolves; "Most Played" does not show demo tracks; the app URL in the address bar (if visible) reflects the server.

- [ ] **Step 5: Commit**

```bash
git add context/Store.tsx
git commit -m "fix(desktop): Flush demo state when signing into a server"
```

---

### Task 3: Home layout — Most Played/For You full-width under Quick Picks

**Files:**
- Modify: `views/Home.tsx` (lines ~277-301)

**Interfaces:**
- Consumes: `randomSongs`, `getMostPlayedSongs`, `homeData.recommendedTracks`, `activeTab`/`setActiveTab`, `SongCard`/`SongRow`, `service`.
- Produces: no exports.

- [ ] **Step 1: Read the current grid section**

Run: `node -e "const s=require('fs').readFileSync('views/Home.tsx','utf8'); console.log(s.slice(s.indexOf('Quick Picks & Most Played'), s.indexOf('Daily Discovery')));"`

Expected: the `<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">` with Quick Picks (`lg:col-span-2`) and the Most Played/For You card.

- [ ] **Step 2: Restructure to full-width stacking**

Change line 277 from:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
```

to:

```tsx
<div className="grid grid-cols-1 gap-6 mb-12">
```

Remove `lg:col-span-2` from the Quick Picks wrapper (line 279) so it is full-width. Keep the Most Played/For You card as-is (it already is full-width in a single-column grid). Optionally increase the fixed card height so the full-width list has room: change `h-[500px]` (line 301) to `h-[600px]`.

- [ ] **Step 3: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 4: Verify in Electron**

Launch Electron, enter Demo mode, play a song (opens the sidebar player), then at window widths ~1024–1400px confirm: Most Played/For You renders full-width directly below Quick Picks, not crushed to a narrow column. Screenshot at 1280x800 and 1100x700.

- [ ] **Step 5: Commit**

```bash
git add views/Home.tsx
git commit -m "feat(home): Stack Most Played/For You full-width under Quick Picks"
```

---

### Task 4: Seamless update flow — concurrency guard, tray balloon, in-app banner

**Files:**
- Modify: `electron/updater.ts` (check guard, error clearing, downloaded callback)
- Modify: `electron/tray.ts` (balloon + click-to-install)
- Modify: `electron/main.ts` (wire downloaded → tray balloon)
- Create: `components/UpdateBanner.tsx`
- Modify: `App.tsx` (mount banner)
- Test: `electron/updater.test.ts` (add concurrency-guard tests)

**Interfaces:**
- Consumes: `UpdaterOptions` (`electron/updater.ts:56-64`), `createTray` (`electron/tray.ts:29`), `platform.updater.onStatus` (preload `onStatus`), `platform.updater.installAndRestart`.
- Produces: `UpdaterOptions.onDownloaded?: (info: { version: string }) => void`; `TrayOptions.onUpdateClick: () => void`; `UpdateBanner` component mounted in `App.tsx`.

- [ ] **Step 1: Add the concurrency guard and downloaded callback to the updater**

In `electron/updater.ts`:
1. Add `onDownloaded?: (info: { version: string }) => void` to `UpdaterOptions` (line 56-64).
2. In `check()` (line 124-134), add a re-entry guard at the top:

```ts
const check = async (): Promise<boolean> => {
  if (!enabled) return false;
  if (state.phase === 'checking' || state.phase === 'downloading') return false;
  emit({ phase: 'checking', message: 'Checking for updates\u2026' });
  try {
    await driver.checkForUpdates();
    return true;
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Update check failed.'));
    return false;
  }
};
```

3. In `onError` (line 105-106), clear stale values:

```ts
const onError = (error: Error): void =>
  emit({ phase: 'error', newVersion: null, progress: null, message: error?.message ?? 'Update check failed.' });
```

4. In `onDownloaded` (line 109-115), invoke the callback after emitting:

```ts
const onDownloaded = (info: { version: string }): void => {
  emit({
    phase: 'downloaded',
    newVersion: info.version,
    progress: 100,
    message: 'Restart Nebula to finish installing the update.',
  });
  onDownloadedOption?.(info);
};
```

(`const { ..., onDownloaded: onDownloadedOption } = options;` in the destructure at line 78.)

- [ ] **Step 2: Add tests for the guard and error clearing**

In `electron/updater.test.ts`, add:

```ts
it('ignores re-entrant check() while checking', async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const driver = makeDriver({
    checkForUpdates: vi.fn(async () => { await gate; }),
  });
  const updater = createUpdater(makeOptions(driver));
  const first = updater.check();
  const second = await updater.check();
  expect(second).toBe(false);
  release();
  await first;
  expect(driver.checkForUpdates).toHaveBeenCalledTimes(1);
});

it('clears newVersion and progress on error', async () => {
  const driver = makeDriver({ checkForUpdates: vi.fn(async () => { throw new Error('boom'); }) });
  const updater = createUpdater(makeOptions(driver));
  await updater.check();
  const state = updater.getState();
  expect(state.phase).toBe('error');
  expect(state.newVersion).toBeNull();
  expect(state.progress).toBeNull();
});
```

Match the existing test helpers (`makeDriver`, `makeOptions`) used in the file. Run `npx vitest run electron/updater.test.ts` — the two new tests must pass.

- [ ] **Step 3: Add the tray balloon**

In `electron/tray.ts`, add `onUpdateClick: () => void` to `TrayOptions` and a public `showUpdateBalloon`:

```ts
let tray: Tray | null = null;
let updateClickHandler: (() => void) | null = null;

interface TrayOptions {
  getWindow: () => BrowserWindow | null;
  getEpoch: () => number;
  onCommand: (envelope: DesktopCommandEnvelope) => void;
  onToggleMiniPlayer: () => void;
  onQuit: () => void;
  onUpdateClick: () => void;
}

export const createTray = (options: TrayOptions): Tray => {
  if (tray) return tray;
  updateClickHandler = options.onUpdateClick;
  ...
  tray.on('click', showWindow);
  tray.on('balloon-click', () => { updateClickHandler?.(); showWindow(); });
  return tray;
};

export const showUpdateBalloon = (version: string): void => {
  if (!tray) return;
  tray.displayBalloon({
    title: 'Nebula update ready',
    content: `Version ${version} is downloaded. Click to install.`,
  });
};
```

- [ ] **Step 4: Wire main.ts**

In `electron/main.ts`, import `showUpdateBalloon` from `./tray`. In the `createUpdater` options (main.ts:494-504), add:

```ts
    updater = createUpdater({
      driver: autoUpdater,
      enabled: app.isPackaged,
      getCurrentVersion: () => app.getVersion(),
      getChannel: () => settingsStore.get('updateChannel') ?? 'stable',
      broadcast: (state) => {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(IPC.updater.status, state);
        }
      },
      onDownloaded: (info) => showUpdateBalloon(info.version),
    });
```

- [ ] **Step 5: Create the in-app banner component**

Create `components/UpdateBanner.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePlatform } from '../platform/PlatformContext';
import type { UpdaterState } from '../electron/updater';

export const UpdateBanner: React.FC = () => {
  const platform = usePlatform();
  const [state, setState] = useState<UpdaterState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!platform || platform.info.kind !== 'desktop') return;
    void platform.updater.getState().then(setState);
    return platform.updater.onStatus(setState);
  }, [platform]);

  if (!platform || platform.info.kind !== 'desktop') return null;
  if (!state || state.phase !== 'downloaded' || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-900 dark:text-emerald-300">
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 shrink-0" />
        <span>
          Nebula {state.newVersion ?? ''} is ready to install.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => platform.updater.installAndRestart()}
          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-emerald-500"
        >
          Restart &amp; Install
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
          aria-label="Dismiss update notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Mount the banner in App.tsx**

In `App.tsx`, import `UpdateBanner` and render it at the top of the app shell, above `SplitLayout`:

```tsx
      {/* Top-level update banner (desktop only) */}
      <UpdateBanner />
```

Place it right after the `{/* Navigation Drawer */}` line (~133) so it sits above content but below the fixed player overlay.

- [ ] **Step 7: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85 + new updater tests), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 8: Verify**

Unit tests cover the guard and error-clearing. The banner/balloon require a packaged build + a real GitHub release to fully exercise; for this task, verify: typecheck/tests pass, the banner compiles, and `showUpdateBalloon` is exported and wired (grep main.ts for `onDownloaded`). Note in the PR description that end-to-end update behavior must be confirmed against an actual published release.

- [ ] **Step 9: Commit**

```bash
git add electron/updater.ts electron/updater.test.ts electron/tray.ts electron/main.ts components/UpdateBanner.tsx App.tsx
git commit -m "feat(desktop): Notify on downloaded updates via tray balloon and in-app banner"
```

---

### Task 5: Fix sidebar close (X) button

**Files:**
- Modify: `components/navigation/NavDrawer.tsx`

**Interfaces:**
- Consumes: `onClose` prop; `appRegion` helper (define locally like TopBar/Player).
- Produces: no exports.

- [ ] **Step 1: Read the drawer header**

Run: `node -e "const s=require('fs').readFileSync('components/navigation/NavDrawer.tsx','utf8'); console.log(s.slice(0, s.indexOf('export')));"`

Expected: imports, the `appRegion` helper may or may not exist; the drawer `<nav>` at ~79 and header at ~91-114 with the X button at 108-114.

- [ ] **Step 2: Add the helper and no-drag**

Add the helper (if missing) near the imports:

```tsx
import type { CSSProperties } from 'react';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
    ({ WebkitAppRegion: region }) as CSSProperties;
```

Add `style={appRegion('no-drag')}` to the drawer header div (line ~91) and to the X button (line ~108):

```tsx
                <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-white/10" style={appRegion('no-drag')}>
                    ...
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white transition-colors"
                        aria-label="Close menu"
                        style={appRegion('no-drag')}
                    >
```

- [ ] **Step 3: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 4: Verify in Electron**

Launch Electron, open the nav drawer, click the X with a real OS click. Expected: drawer closes. Confirm via DOM (`getComputedStyle` on the header/X returns `no-drag`) with the same probe pattern used for the player tabs (`verify-tabs-fixed.mjs`), then user real-click confirmation.

- [ ] **Step 5: Commit**

```bash
git add components/navigation/NavDrawer.tsx
git commit -m "fix(desktop): Make the nav drawer close button clickable (no-drag)"
```

---

### Task 6: MSIX installer (unsigned) alongside NSIS

**Files:**
- Modify: `electron-builder.yml`

**Interfaces:**
- Produces: an MSIX artifact via `electron-builder --win msix`.

- [ ] **Step 1: Read the current builder config**

Run: `Get-Content electron-builder.yml`
Expected: `win.target: nsis`, `artifactName: ${productName}-${version}-setup.${ext}`.

- [ ] **Step 2: Add the MSIX target and config**

Replace the `win:` block with:

```yaml
win:
  target:
    - target: nsis
      arch:
        - x64
    - target: msix
      arch:
        - x64
  artifactName: ${productName}-${version}-setup.${ext}

msix:
  createDesktopShortcut: always
  identityName: com.nebula.desktop
  publisherDisplayName: Nebula
  publisher: CN=Nebula
```

Note: MSIX normally requires a certificate for Store/trusted installs; an unsigned MSIX can be sideloaded with Windows Developer Mode enabled. The user has accepted this.

- [ ] **Step 3: Verify the target is valid**

Run: `npx electron-builder --help 2>&1 | Select-String msix` — confirm the msix target is supported by the installed electron-builder.

Run: `npm run typecheck` (0 errors — YAML is not typechecked but confirm nothing else breaks).

- [ ] **Step 4: Attempt a dry packaging to confirm config validity**

Best-effort: `npx electron-builder --win msix --publish never --config.directories.output="$env:TEMP\nebula-msix"`. If it fails for environmental reasons (e.g. it needs the electron-builder binary/network), report the exact error. The config correctness is the deliverable; note whether the artifact built.

- [ ] **Step 5: Commit**

```bash
git add electron-builder.yml
git commit -m "build(desktop): Add unsigned MSIX target alongside NSIS"
```

---

### Task 7: Visualizer accuracy (full rework)

**Files:**
- Modify: `context/Store.tsx` (`ensureDspGraph` ~778-818)
- Modify: `components/Visualizer.tsx` (smoothing, high-freq lift, band mapping)
- Test: `components/visualizerBands.test.ts` (new — extract band math for unit testing)

**Interfaces:**
- Consumes: `analyser` from `useStore()`; `VISUALIZER_MODES`.
- Produces: `getFrequencyBands` and `getBandForPosition` exported from `components/visualizerBands.ts` (extracted), used by `Visualizer.tsx`.

- [ ] **Step 1: Extract the band math into a testable module**

Create `components/visualizerBands.ts`:

```ts
export const getFrequencyBin = (frequency: number, sampleRate: number, binCount: number): number => {
  const nyquist = sampleRate / 2;
  return Math.min(binCount - 1, Math.max(0, Math.floor((frequency / nyquist) * binCount)));
};

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

export const getFrequencyBands = (
  data: Uint8Array,
  count: number,
  previous: number[],
  sampleRate: number,
): number[] => {
  const bands = new Array(count);
  const minHz = 28;
  const maxHz = Math.min(20000, sampleRate * 0.48);
  const minLog = Math.log(minHz);
  const maxLog = Math.log(maxHz);

  for (let i = 0; i < count; i++) {
    const startHz = Math.exp(minLog + (i / count) * (maxLog - minLog));
    const endHz = Math.exp(minLog + ((i + 1) / count) * (maxLog - minLog));
    const start = getFrequencyBin(startHz, sampleRate, data.length);
    const end = Math.min(data.length, Math.max(start + 1, getFrequencyBin(endHz, sampleRate, data.length) + 1));
    let sum = 0;
    for (let bin = start; bin < end; bin++) sum += data[bin];
    const raw = sum / (end - start) / 255;
    // Softer than the old 0.58-exponent + 1.5x high-frequency lift: a mild
    // curve with no permanent treble boost keeps quiet highs responsive.
    const boosted = clamp(Math.pow(raw, 0.7));
    const oldValue = previous[i] ?? 0;
    // Gentle attack/release only; the analyser smoothing is lowered to ~0.5
    // in ensureDspGraph so transients are not doubly-smoothed.
    const smoothing = boosted > oldValue ? 0.35 : 0.15;
    bands[i] = oldValue + (boosted - oldValue) * smoothing;
  }

  return bands;
};

/** Map a 0..1 position across the log-spaced band axis to a band index. */
export const getBandForPosition = (position: number, count: number): number =>
  clamp(Math.round(position * (count - 1)), 0, count - 1);
```

- [ ] **Step 2: Write the failing tests**

Create `components/visualizerBands.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getBandForPosition, getFrequencyBands } from './visualizerBands';

describe('getFrequencyBands', () => {
  it('maps a silent buffer to near-zero bands', () => {
    const data = new Uint8Array(2048);
    const bands = getFrequencyBands(data, 72, [], 44100);
    expect(bands.every((b) => b === 0)).toBe(true);
  });

  it('does not permanently boost the high-frequency bands', () => {
    const data = new Uint8Array(2048).fill(51); // ~0.2 of full scale
    const bands = getFrequencyBands(data, 72, [], 44100);
    const maxBand = Math.max(...bands);
    expect(maxBand).toBeLessThan(0.6);
  });
});

describe('getBandForPosition', () => {
  it('maps endpoints and midpoints to band indices', () => {
    expect(getBandForPosition(0, 72)).toBe(0);
    expect(getBandForPosition(1, 72)).toBe(71);
    expect(getBandForPosition(0.5, 72)).toBe(35);
  });
});
```

Run `npx vitest run components/visualizerBands.test.ts` — must FAIL initially (module missing).

- [ ] **Step 3: Rewire the analyser to tap pre-DSP**

In `context/Store.tsx` `ensureDspGraph` (lines 778-818), connect the analyser BEFORE the EQ/compressor so it samples the unprocessed signal. Change the block (lines 809-813) from:

```tsx
    const ana = ctx.createAnalyser();
    ana.fftSize = 2048;
    ana.smoothingTimeConstant = 0.85;
    compressor.connect(ana);
    ana.connect(ctx.destination);
```

to:

```tsx
    const ana = ctx.createAnalyser();
    ana.fftSize = 2048;
    ana.smoothingTimeConstant = 0.5;
    dspInputRef.current.connect(ana);
    compressor.connect(ctx.destination);
```

(`dspInputRef.current` is the graph input gain created at line 784-786, before the EQ filters. This taps the raw signal, so the visualizer reflects actual sonics rather than the compressed/EQ'd output.)

- [ ] **Step 4: Update Visualizer.tsx to use the extracted module and fix the modes**

In `components/Visualizer.tsx`:
1. Replace the local `getFrequencyBin`/`getFrequencyBands`/`clamp` definitions with imports from `./visualizerBands` (delete the local copies, lines 116-155).
2. Remove the analyser mutation (lines 195-196) — FFT/smoothing are now configured in `ensureDspGraph`:
   Delete:
   ```tsx
   analyser.fftSize = Math.max(analyser.fftSize, 4096);
   analyser.smoothingTimeConstant = 0.68;
   ```
3. In the render loop, set `analyser.fftSize = 2048` locally once (guard: if `analyser.fftSize < 2048`, it is fine; do not mutate the shared node beyond a single no-op check) — the pre-DSP analyser already has fftSize 2048 from `ensureDspGraph`, so remove the mutation entirely.
4. Fix position→frequency mappings in PARTICLES/HEXAGON/CUBE/GRID:
   - PARTICLES (line ~414): replace `const band = bars72[index % bars72.length] || 0;` with a position-based pick using the particle's normalized x: `const band = bars72[getBandForPosition(clamp((p.x / width + 0.5) / 2 + 0.25, 0, 1), bars72.length)] || 0;`
   - HEXAGON (line ~436): replace `const band = bars72[(ring * 12 + i * 8) % bars72.length] || 0;` with `const band = bars72[getBandForPosition((ring * 6 + i) / (rings * 6), bars72.length)] || 0;`
   - CUBE (line ~448-459): for each of the 12 edges, pick a band by the edge index across the full band axis: `const band = bars72[getBandForPosition(edgeIndex / edges.length, bars72.length)] || 0;` and use it for that edge's line width/alpha.
   - GRID (lines ~501, 526-527): replace the `floor(...)` index expressions with `getBandForPosition(...)` using the same normalized position.
   Note: each `bars72[...]` index expression should route through `getBandForPosition` with a position in `[0,1]`. Read each mode's block fully before editing to preserve structure.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run components/visualizerBands.test.ts` — PASS.
Run: `npm run typecheck` — 0 errors (watch for unused `clamp`/`getFrequencyBin` imports; remove unused locals).
Run: `npm test` — 85 + new tests.

- [ ] **Step 6: Run the build gate**

Run: `npm run build`, `npm run build:electron` — PASS.

- [ ] **Step 7: Verify visually in Electron**

Launch Electron, enter Demo mode, Play Now, open the full-screen player, cycle all 9 visualizer modes. Expected: every mode reacts to transients/bass/treble; WAVE still instant; no mode looks pegged or static. Note: sound playback is required — confirm audio is actually playing (volume up).

- [ ] **Step 8: Commit**

```bash
git add components/visualizerBands.ts components/visualizerBands.test.ts context/Store.tsx components/Visualizer.tsx
git commit -m "fix(visualizer): Sample pre-DSP audio, soften smoothing, and map modes to frequencies"
```

---

### Task 8: Mini-player ticker smoothness

**Files:**
- Modify: `components/player/FloatingMiniPlayer.tsx` (rAF progress loop)
- Modify: `components/player/NowPlayingPanel.tsx` (rAF progress loop)
- Modify: `mini-player.tsx` (rAF interpolation between snapshots)
- Modify: `playback/ownerBridge.tsx` (lower snapshot interval)

**Interfaces:**
- Consumes: `audioRef` (FloatingMiniPlayer/NowPlayingPanel), `snapshot` (mini-player.tsx), `publishSnapshot`/`SNAPSHOT_INTERVAL_MS` (ownerBridge).
- Produces: no exports.

- [ ] **Step 1: Read the current timeupdate listeners**

Run: `node -e "const s=require('fs').readFileSync('components/player/FloatingMiniPlayer.tsx','utf8'); console.log(s.slice(s.indexOf('useEffect(() => {'), s.indexOf('if (!currentSong)')));"`

Expected: the `timeupdate`/`loadedmetadata` listener at lines 52-67.

- [ ] **Step 2: Add an rAF progress loop to FloatingMiniPlayer**

Replace the `useEffect` (lines 52-67) with a version that reads `audio.currentTime` per frame:

```tsx
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        let raf = 0;
        const tick = () => {
            setCurrentTime(audio.currentTime);
            setDuration(audio.duration || 0);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [audioRef]);
```

Also add a `useEffect` to sync once on mount/loadedmetadata for the duration (keep the `loadedmetadata` listener solely for duration):

```tsx
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const syncDuration = () => setDuration(audio.duration || 0);
        audio.addEventListener('loadedmetadata', syncDuration);
        syncDuration();
        return () => audio.removeEventListener('loadedmetadata', syncDuration);
    }, [audioRef]);
```

- [ ] **Step 3: Apply the same rAF loop to NowPlayingPanel**

Read `components/player/NowPlayingPanel.tsx` lines 52-79 (its `timeupdate` listener) and apply the same rAF pattern. Keep `loadedmetadata` for duration.

- [ ] **Step 4: Lower the native mini-player snapshot interval**

In `playback/ownerBridge.tsx` line 24, change:

```tsx
const SNAPSHOT_INTERVAL_MS = 2_000;
```

to:

```tsx
const SNAPSHOT_INTERVAL_MS = 1_000;
```

- [ ] **Step 5: Add rAF interpolation to the native mini-player**

In `mini-player.tsx`, after the `onSnapshot` effect (lines 29-32), add a rAF loop that eases progress toward the latest snapshot:

```tsx
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const target =
        snapshot && snapshot.durationSeconds > 0
          ? Math.min(100, (snapshot.positionSeconds / snapshot.durationSeconds) * 100)
          : 0;
      setDisplayProgress((prev) => prev + (target - prev) * Math.min(1, dt * 6));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snapshot]);
```

Then replace the `progress` computation (lines 43-46) and the bar width (line 63-64) to use `displayProgress` instead of the raw snapshot-derived value, and shorten the CSS transition to `transition-[width] duration-200`.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 7: Verify in Electron**

Launch Electron, enter Demo mode, Play Now, open the floating mini-player (or the native mini-player window via tray). Expected: the progress bar moves smoothly (no visible ~250ms/2s steps). Confirm the native mini-player window (open via tray → Mini Player) eases smoothly between snapshots.

- [ ] **Step 8: Commit**

```bash
git add components/player/FloatingMiniPlayer.tsx components/player/NowPlayingPanel.tsx mini-player.tsx playback/ownerBridge.tsx
git commit -m "feat(player): Drive mini-player progress with requestAnimationFrame for a smooth ticker"
```

---

### Task 9: Windows taskbar thumbnail toolbar buttons

**Files:**
- Modify: `electron/main.ts` (thumbar helper + wiring)
- Create: `electron/thumbarIcons.ts` (16x16 PNG data URLs, mirroring tray.ts's embedded-icon pattern)
- Modify: `electron/tray.ts` (no change needed)

**Interfaces:**
- Consumes: `DesktopSnapshot` (`playing`, `positionSeconds`, `durationSeconds`), `forwardCommand`, `createCommandClient`, `IPC.playback.command`.
- Produces: `updateThumbarButtons(snapshot: DesktopSnapshot | null): void` and `clearThumbarButtons(): void` exported from `electron/main.ts` (or inline helpers called on snapshot/close).

- [ ] **Step 1: Create the thumbar icon data URLs**

Create `electron/thumbarIcons.ts` with four 16x16 PNG data URLs. Use `nativeImage.createFromDataURL`. Provide simple white glyphs on transparent background. Generate the base64 PNGs with a one-off Node script using `sharp` (already a devDependency) — write 16x16 white-on-transparent PNG buffers via `sharp(Buffer.from(svg), ...).png()`:

```ts
import { nativeImage } from 'electron';

const fromSvg = (paths: string[]): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${paths.join('')}</svg>`;
  // NOTE: convert via sharp at build time; store the resulting base64 here.
  return '';
};
```

Implementation note: generate the four PNGs once (e.g. `node -e` using sharp, writing to `electron/assets/thumb-*.png`), then load them with `nativeImage.createFromPath` in `main.ts`:

```ts
const thumbarIcon = (name: string) => nativeImage.createFromPath(path.join(__dirname, '..', 'assets', `thumb-${name}.png`));
```

Generate the four icons with sharp from inline SVG glyphs (play = filled triangle, pause = two bars, prev = left bar+triangle, next = right bar+triangle), writing to `electron/assets/thumb-play.png`, `thumb-pause.png`, `thumb-prev.png`, `thumb-next.png`. Add these files to git.

- [ ] **Step 2: Add the thumbar update helper in main.ts**

```ts
const updateThumbarButtons = (snapshot: DesktopSnapshot | null): void => {
  if (!mainWindow || process.platform !== 'win32') return;
  if (!snapshot) { mainWindow.setThumbarButtons([]); return; }
  const client = createCommandClient('nebula-thumbar', () => snapshot.epoch);
  const send = (command: DesktopCommand) => forwardCommand(client.send(command));
  const playIcon = snapshot.playing
    ? nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-pause.png'))
    : nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-play.png'));
  mainWindow.setThumbarButtons([
    {
      icon: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-prev.png')),
      tooltip: 'Previous',
      click: () => send({ name: 'previous' }),
    },
    {
      icon: playIcon,
      tooltip: snapshot.playing ? 'Pause' : 'Play',
      click: () => send({ name: 'togglePlayback' }),
    },
    {
      icon: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'thumb-next.png')),
      tooltip: 'Next',
      click: () => send({ name: 'next' }),
    },
  ]);
};
```

Import `DesktopCommand` and `createCommandClient` (both already imported for tray/media keys in main.ts — verify).

- [ ] **Step 3: Call it from the snapshot handler and on close**

In the `IPC.playback.snapshot` handler (main.ts:427-431), after `updateTaskbarProgress(snapshot)`, add `updateThumbarButtons(snapshot);`.

In `createWindow`'s `close` handler (or `will-quit`), add `mainWindow.setThumbarButtons([]);` before destroy (guard null).

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 5: Verify in Electron**

Launch the packaged or dev Electron on Windows, play a song, hover the taskbar thumbnail. Expected: Previous/Play/Pause/Next buttons appear and control playback; the play/pause icon reflects state. (Thumbar buttons are Windows-only and taskbar-bound; report what you observe.)

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts electron/assets/thumb-play.png electron/assets/thumb-pause.png electron/assets/thumb-prev.png electron/assets/thumb-next.png
git commit -m "feat(desktop): Add Windows taskbar thumbnail transport buttons"
```

---

### Task 10: Security pass — vault IPC, lastServerUrl, log hygiene

**Files:**
- Modify: `electron/main.ts` (vault IPC sender validation; lastServerUrl sanitize)
- Modify: `context/Store.tsx` (sanitize lastServerUrl before saving)
- Test: `electron/main.test.ts` (if a test harness for main exists; otherwise add a pure sanitizer test)

**Interfaces:**
- Consumes: `credentialVault`, `settingsStore`, `IPC.vault.*`, `BrowserWindow`.
- Produces: `sanitizeServerUrlForSettings(url: string): string` (strip `user:pass@` userinfo) — put it in `electron/urlSanitize.ts` so it is unit-testable.

- [ ] **Step 1: Create the sanitizer + test**

Create `electron/urlSanitize.ts`:

```ts
/** Strip `user:pass@` userinfo so plaintext settings never carry credentials. */
export const sanitizeServerUrlForSettings = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
};
```

Create `electron/urlSanitize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sanitizeServerUrlForSettings } from './urlSanitize';

describe('sanitizeServerUrlForSettings', () => {
  it('strips userinfo from https URLs', () => {
    expect(sanitizeServerUrlForSettings('https://user:pass@music.example.com')).toBe('https://music.example.com/');
  });
  it('leaves URLs without userinfo unchanged', () => {
    expect(sanitizeServerUrlForSettings('https://music.example.com/base')).toBe('https://music.example.com/base');
  });
});
```

Run `npx vitest run electron/urlSanitize.test.ts` — FAIL first (module missing), then PASS.

- [ ] **Step 2: Sanitize lastServerUrl before saving**

In `context/Store.tsx` `saveCredentials` (line 296), change:

```tsx
        await platform.settings.set('lastServerUrl', creds.serverUrl);
```

to:

```tsx
        const { sanitizeServerUrlForSettings } = await import('../electron/urlSanitize');
        await platform.settings.set('lastServerUrl', sanitizeServerUrlForSettings(creds.serverUrl));
```

(Dynamic import avoids bundling Electron-only code into the renderer if it is excluded; alternatively import statically if the module has no Electron imports — it does not, so a static `import { sanitizeServerUrlForSettings } from '../electron/urlSanitize';` at the top of Store.tsx is fine.)

- [ ] **Step 3: Add vault IPC sender validation in main.ts**

Wrap the vault handlers (main.ts:392-412) with a sender check. Add a helper:

```ts
const isTrustedSender = (webContents: Electron.WebContents): boolean => {
  const win = BrowserWindow.fromWebContents(webContents);
  return !!win && (win === mainWindow || win === miniPlayerWindow);
};
```

Then change each vault handler's first line to return early when the sender is untrusted, e.g.:

```ts
  ipcMain.handle(IPC.vault.get, (event, serverUrl: unknown) => {
    if (!isTrustedSender(event.sender)) return null;
    if (typeof serverUrl !== 'string') return null;
    return credentialVault.get(serverUrl);
  });
```

Apply the same guard to `vault.set`, `vault.clear`, `vault.getSecret`, `vault.setSecret`, `vault.clearSecret`.

- [ ] **Step 4: Verify log hygiene**

Grep for any log line that could print credentials or full signed URLs:
Run: `rg -n "console\.(log|warn|error)" context/Store.tsx electron/ | Select-String -Pattern "serverUrl|apiKey|username|token"`

Expected: only `debugIncrementStats` logs `serverUrl:username` (no secret) — confirm `serverUrl` there is the host, not the full URL with userinfo, and that no line prints `apiKey`/`token`/`pass`. If a line prints the full signed URL, truncate it.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck` (0 errors), `npm test` (85 + new sanitizer tests), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 6: Verify**

Unit tests cover the sanitizer. Sender-validation is structural (untrusted senders get `null`/no-op). Confirm via code review of the diff.

- [ ] **Step 7: Commit**

```bash
git add electron/urlSanitize.ts electron/urlSanitize.test.ts context/Store.tsx electron/main.ts
git commit -m "security(desktop): Validate vault IPC senders and strip userinfo from lastServerUrl"
```

---

## Self-review notes

- Task 1 (A), Task 2 (B), Task 3 (C), Task 5 (E), Task 6 (F), Task 8 (H), Task 9 (I), Task 10 (J) each map 1:1 to spec tasks.
- Task 4 (D) covers the concurrency guard, error-clearing, tray balloon, and in-app banner; the end-to-end update check requires a published release (documented).
- Task 7 (G) covers the pre-DSP analyser, reduced double-smoothing, position→frequency mapping, and removal of the high-frequency lift.
- No placeholders; every code step has concrete content.
- Cross-task type consistency: `getFrequencyBands`/`getBandForPosition` exported from `components/visualizerBands.ts` and consumed by `Visualizer.tsx`; `sanitizeServerUrlForSettings` in `electron/urlSanitize.ts` consumed by `Store.tsx`; `onDownloaded` on `UpdaterOptions` consumed by `main.ts`; `showUpdateBalloon` in `tray.ts` consumed by `main.ts`.
