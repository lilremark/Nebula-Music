# Nebula Desktop Release Readiness — Performance, Fixes, Installer & Security Spec

Date: 2026-08-08
Branch: `feat/desktop-edition`

## Goal

Prepare Nebula Desktop for a GitHub Release. Fix the renderer MediaImage warning and a batch of app issues, wire up a seamless update flow, build an MSIX installer, improve the visualizer accuracy and mini-player smoothness, add Windows taskbar thumbnail buttons, and harden credential security.

## Task A — Fix renderer MediaImage warning

**Root cause:** `platform/desktop.ts:56-60` wraps every http(s) URL into `app://nebula/proxy?u=...`, and `context/Store.tsx:1852-1867` feeds those URLs into `MediaMetadata.artwork`. Chromium only accepts `http/https/data/blob` schemes for `MediaImage.src`, so it logs the warning on every song.

**Fix:** In `context/Store.tsx`, before assigning `navigator.mediaSession.metadata`, convert each artwork URL to a `data:` URL by fetching it and reading as a data URL (mirror the proven pattern in `services/streamDeckArtwork.ts:29-69`). Also use `song.coverArt || song.id` (Store.tsx:1861 currently uses `song.id`). Handle fetch failure gracefully (fall back to omitting artwork rather than throwing). The web build already works (identity `resolveMediaUrl`), so this only affects desktop; the fix is harmless on web.

**Acceptance:** No `MediaImage src can only be of http/https/data/blob` warning in the Electron renderer logs while playing in Demo or connected to a server. Media session still shows artwork.

## Task B — Flush demo state when signing into a server

**Root cause:** `connectToSubsonic` success (Store.tsx:1992-2006) clears queue, currentSongIndex, isPlaying, radio, homeData, cachedArtists, mostPlayed — but NOT play history (+ localStorage `nebula_play_history`), the cached explore albums (`nebula_explore_data`/`nebula_explore_date`), `viewData`/navigationStack, searchResults, or radioStations. The app-start flush (Store.tsx:648-672) does all of these; the in-session demo→server transition is inconsistent.

**Fix:** Replicate the init-path flush in the `connectToSubsonic` success block:
- `localStorage.removeItem(PLAY_HISTORY_KEY)`; `setPlayHistory({})`
- Remove `nebula_explore_data` / `nebula_explore_date` from localStorage
- Reset `viewData` to `null` / empty and clear the navigation stack
- `setSearchResults([])`; `setRadioStations([])`; `setPlaylists([])` before the `getPlaylists()` fetch, and add `.catch` so demo playlists can't persist if the fetch fails

**Acceptance:** After Demo → connect to a server, no demo albums/tracks/playlists/explore/play-history remain; Home and Library show only server content.

## Task C — Home layout: Most Played/For You full-width under Quick Picks

**Root cause:** `views/Home.tsx:277` uses `grid grid-cols-1 lg:grid-cols-3`, so at viewport ≥1024px with the 380px sidebar player open, content shrinks to ~644-1000px yet the `lg:grid-cols-3` split still applies → Most Played/For You card crushed to ~215-330px.

**Fix:** Stack the two blocks so they never sit side-by-side at narrow effective widths:
- Home.tsx:277 → `grid grid-cols-1 gap-6 mb-12` (drop the 3-column split entirely)
- Quick Picks (`lg:col-span-2` → remove span class) becomes full-width
- Most Played / For You card becomes full-width directly below Quick Picks
- Optionally cap the card's height (keep `h-[500px]`) so the list scrolls within a full-width card

**Acceptance:** With the sidebar player open at ~1024-1400px, Most Played/For You renders full-width below Quick Picks (not crushed); at wide widths it still looks reasonable full-width.

## Task D — Seamless update flow (GitHub releases)

Already implemented: full phase state machine (`electron/updater.ts`), auto-download, auto-install-on-quit, download progress, manual Restart & Install, stable/beta channel, startup check, `publish: github` config.

**Add:**
1. **In-app banner** when `phase === 'downloaded'`: a dismissible banner (top of the app shell, above content) reading "Nebula <newVersion> is ready to install" with a "Restart & Install" button and a dismiss (X). Wired to `platform.updater.onStatus` (desktop only; hidden on web). Component in `App.tsx` or a new `components/UpdateBanner.tsx`.
2. **Tray balloon** (Windows): when `update-downloaded` fires in the updater, show a `tray.displayBalloon({ title: 'Nebula update ready', content: 'Version X is downloaded. Click to install.' })`; clicking the balloon triggers `installAndRestart()`. Add an `onUpdateDownloaded` hook to `createTray`/updater wiring in `electron/main.ts`.
3. **Concurrency guard** in `updater.check()` — ignore re-entry while `phase === 'checking' || 'downloading'`.
4. On `error`, clear stale `newVersion`/`progress` (updater.ts:105-106).

**Acceptance:** Packaged app: downloading an update shows progress, then a banner + tray balloon on completion; clicking either installs and restarts. `check()` is re-entry-safe.

## Task E — Sidebar close (X) button

**Root cause:** NavDrawer X button (NavDrawer.tsx:108-114) sits at y≈20-44 inside the TopBar's native `-webkit-app-region: drag` band (TopBar.tsx:39) with no `no-drag`, so real OS clicks are swallowed on the frameless Windows window (same class as the player-tab fix).

**Fix:** Add `style={{ WebkitAppRegion: 'no-drag' }}` (via the local `appRegion('no-drag')` helper) to the NavDrawer header and its X button. Confirm backdrop click and Escape still close.

**Acceptance:** Clicking X closes the sidebar on Windows desktop; window dragging from the drawer's non-interactive areas still works.

## Task F — MSIX installer (unsigned) + keep NSIS

**Fix:** In `electron-builder.yml`, add an `msix` target alongside `nsis`:
```yaml
win:
  target:
    - target: nsis
      arch: [x64]
    - target: msix
      arch: [x64]
  artifactName: ${productName}-${version}-setup.${ext}
msix:
  createDesktopShortcut: always
  identityName: com.nebula.desktop
  publisherDisplayName: Nebula
```
Provide a publisher/identity (unsigned). Note: MSIX requires a certificate to be "trusted" for Store installs, but an unsigned MSIX can be sideloaded with Developer Mode enabled — the user accepts this.

**Acceptance:** `npm run dist:win` produces both a `.exe` (NSIS) and a `.msix`. The MSIX installs via sideload (Developer Mode) and launches.

## Task G — Visualizer accuracy (full rework)

**Root causes (found):**
1. Analyser samples post-compressor/EQ (compressor ratio 2, threshold -1dB squashes dynamics; Store.tsx:800-813).
2. Double-smoothing: analyser `smoothingTimeConstant 0.68` (Visualizer.tsx:195-196) + per-band attack/release 0.5/0.24 (Visualizer.tsx:149-151).
3. PARTICLES/HEXAGON/CUBE/GRID pick bins by index-modulo (Visualizer.tsx:414,436,483,501), not position→frequency.
4. Permanent high-frequency lift `1 + (i/(count-1))*0.5` (Visualizer.tsx:147).

**Fix:**
- Tap the analyser **before** the compressor/EQ in `ensureDspGraph` (Store.tsx): add a second `AnalyserNode` reading `dspInput` (pre-EQ/pre-compressor), and expose it to the visualizer (keep the existing node or swap the exposed one). Set `fftSize = 2048`, `smoothingTimeConstant ≈ 0.5` once in `ensureDspGraph`.
- In `components/Visualizer.tsx`: stop mutating the shared analyser from the component (set FFT/smoothing in `ensureDspGraph`); reduce/remove the attack/release smoothing; remove or shrink the high-frequency lift; replace index-modulo bin lookups in PARTICLES/HEXAGON/CUBE/GRID with a position→frequency mapping helper (reuse the band-index math from `getFrequencyBands`).
- Keep WAVE (time-domain) as-is — it's already accurate.
- Ensure the analyser is non-null: the Visualizer already gates on it; if playback hasn't started, draw a subtle idle state rather than nothing.

**Acceptance:** All visualizer modes react visibly and correctly to transients, bass, and treble across BARS/WAVE/CIRCLE/MIRROR/SPECTRUM/PARTICLES/HEXAGON/CUBE/GRID. No static analyser (except before first play). Typecheck/tests/build pass.

## Task H — Mini-player ticker smoothness

**Root cause:** FloatingMiniPlayer.tsx:52-67 updates position only on `timeupdate` (~4Hz), no rAF. Native mini-player (mini-player.tsx:43-65) only re-renders on 2s snapshots with a 500ms CSS transition.

**Fix:**
- FloatingMiniPlayer: add a `requestAnimationFrame` loop reading `audio.currentTime` (pattern: Store.tsx:1047 crossfade) to drive `currentTime`/progress smoothly; keep scrub override.
- NowPlayingPanel: same rAF treatment (or share a hook).
- Native mini-player (mini-player.tsx): add a rAF interpolation loop between snapshots (animate progress toward the latest snapshot target); lower `SNAPSHOT_INTERVAL_MS` in `playback/ownerBridge.tsx:24` from 2000 to ~1000ms and shorten the CSS transition (e.g. `duration-200`) so steps are imperceptible.

**Acceptance:** The playing ticker in the floating mini-player and the native mini-player window moves smoothly (no visible ~250ms/2s steps).

## Task I — Windows taskbar thumbnail toolbar buttons (Previous/Next/Play/Pause)

**New feature:** `win.setThumbarButtons` on the main window (Windows only). Four buttons: Previous, Play/Pause, Next (and optionally Stop). Icons as small PNGs (16x16, white-on-transparent) bundled under `electron/assets/` (or generated from existing lucide SVG glyphs). Command routing reuses the existing playback command bus (`forwardCommand`/`IPC.playback.command` → ownerBridge).

**Wiring:**
- `electron/main.ts`: after window creation, call `updateThumbarButtons(snapshot)`; a helper that sets `mainWindow.setThumbarButtons([...])` with Play/Pause toggling based on `snapshot.playing`. Update on every snapshot + play-state change. Clear on window close. Guard `process.platform === 'win32'` and non-packaged.
- Icon assets: `electron/assets/thumb-play.png`, `thumb-pause.png`, `thumb-prev.png`, `thumb-next.png` (16x16).

**Acceptance:** Hovering the taskbar shows Previous/Play/Pause/Next; clicking controls playback; the Play/Pause icon reflects state.

## Task J — Security pass (fix actionable findings)

Findings and fixes:
1. **Vault IPC sender validation** (`electron/main.ts:392-412`): validate the sender frame's URL/`webContents` belongs to this app before handling `vault.get`/`vault.set`/`vault.delete` (reject otherwise).
2. **`lastServerUrl` plaintext + userinfo:** when saving, strip any `user:pass@` userinfo from the URL before persisting to `settings.json` (Store.tsx:296 / main.ts:486); keep the full URL only in the encrypted vault.
3. **Log hygiene:** ensure nothing logs credentials or full signed URLs (verify `debugIncrementStats` logs only serverUrl:username of the host, not secrets; confirm no renderer log includes apiKey/token).
4. **Do NOT change** the safeStorage encryption, the renderer-context credential presence (inherent to Subsonic URL auth), or web IndexedDB behavior (web is out of scope for this desktop pass) — document these as accepted risks.

**Acceptance:** Vault IPC rejects foreign senders; settings.json never contains userinfo; no logs expose credentials.

## Global constraints

- Existing tests (85/85) must keep passing; add unit tests where the change is testable (updater concurrency guard, flush helper, thumbar snapshot mapping, lastServerUrl sanitizer).
- No comments in code unless a comment already exists there.
- Gate: `npm run typecheck` 0 errors, `npm test` green, `npm run build` PASS, `npm run build:electron` PASS.
- Commit style: conventional commits.
- Shell is PowerShell on win32; `tsx` not installed (use `node -e`).
