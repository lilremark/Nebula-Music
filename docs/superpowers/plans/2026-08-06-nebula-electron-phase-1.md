# Nebula Desktop — Phase 1 Plan

- Status: Approved
- Date: 2026-08-06
- Goal: secure desktop foundation, internal only (no public release)

## Task 1 — Record decisions and baseline

1. `PRODUCT.md` (done), design spec, this plan, ADR `0003-electron-desktop-edition.md`.
2. Commit the upstream baseline with the planning record.

## Task 2 — Platform boundary

Introduce a `Platform` interface so the web app never branches on `window.electron`:

- `platform/types.ts` — the `Platform` interface: window control, external link
  opening, settings-store access, credential vault, environment info, updater
  status, playback protocol endpoints.
- `platform/web.ts` — no-op / in-browser implementation (web build unchanged).
- `platform/desktop.ts` — implemented on top of the preload bridge
  (`window.desktop`), guarded so web builds never reference it.
- `platform/PlatformContext.tsx` — `PlatformProvider` + `usePlatform()`.

Verification: `npm run typecheck`, `npm test` still pass with the platform layer
wired but unused.

## Task 3 — Playback protocol

Shared, schema-validated contract for remote clients → owner:

- `playback/desktopProtocol.ts` — command/snapshot types, epoch + sequence
  validation (reject stale/replayed commands), zod schemas.
- `playback/ownerBridge.tsx` — renderer-side bridge that owns the Store and answers
  commands; sends snapshots on state change. Tray/media-key/mini-player all speak
  this protocol over IPC; Stream Deck keeps its own protocol on its own socket.

Verification: unit tests for epoch/sequence and command parsing.

## Task 4 — Electron toolchain

- Add devDeps: `electron@43.3.0`, `electron-builder@26.15.3`, `electron-updater@6.8.9`,
  `esbuild@0.28.1`, `zod@4.4.3` (+ any platform packages needed for NSIS on Windows).
- `esbuild.config.mjs` — bundles `electron/main.ts` and `electron/preload.ts` to
  CJS in `electron/dist/`.
- `package.json` scripts: `build:main`, `build:electron` (web build + main bundle),
  `start:electron`, `dist:win` (electron-builder).
- electron-builder config (in package.json `build` field or `electron-builder.yml`).

## Task 5 — Main process shell

- `electron/main.ts`: `app://nebula` protocol handler, single-instance lock,
  `BrowserWindow` (contextIsolation, sandbox, webSecurity, preload), `will-navigate`
  + `setWindowOpenHandler` enforcement, external-link validation (https only),
  window lifecycle (hide on close, quit via tray / before-quit flag).
- `electron/preload.ts`: typed `contextBridge` API surface (no raw ipcRenderer).
- Shared IPC channels defined in a single module used by both sides.

## Task 6 — Tray

- Tray icon + menu: Show/Hide, Play/Pause/Next/Prev (via playback protocol),
  Quit. Tooltip shows track title.
- Close/minimize-to-tray behavior wired to lifecycle flags.

## Task 7 — Desktop settings store + vault

- `electron/settingsStore.ts`: atomic JSON writes, zod validation, single writer.
- `electron/credentialVault.ts`: Phase 1 plaintext passthrough with a marker type so
  Phase 2 can swap to `safeStorage` without renderer changes.
- Expose both through the preload bridge; wire into the settings UI (minimal).

## Task 8 — Verification and baseline commit

- `npm run typecheck`, `npm test`, `npm run build` (web) all green.
- `npm run build:electron` produces `electron/dist/*.js`.
- Smoke-test `npm run start:electron` manually (window opens, tray works,
  protocol serves assets, close hides to tray, quit works).
- Commit Phase 1 with release notes.

## Phase 2 (after Phase 1)

Three sub-plans: Secure Data And Session (safeStorage vault, signed installer,
GitHub Releases auto-update), Native Player Features (media keys, taskbar
controls, mini-player as remote client), Integration And Release (Stream Deck
hardening, external-link validation UI, public release).

## Phase 3 (after Phase 2)

Dedicated SQLite download DB (preferred over IndexedDB/LevelDB), `nebula://` deep
links, Jump Lists, taskbar progress, local folders, M3U import/export, all feeding
the existing renderer-owned engine.
