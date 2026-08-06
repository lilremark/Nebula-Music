# Nebula Desktop — Design Specification

- Status: Approved
- Date: 2026-08-06
- Scope: Phase 1 (secure desktop foundation, internal only)

## 1. Problem

Nebula Music is a browser-based Subsonic player. It runs well in a tab but stops
when the tab is closed or the laptop sleeps the background tab. Users on Windows
want a native app that behaves like a music player: a tray icon, media keys, an
installer, automatic updates, and playback that survives the UI being closed.

Electron gives us native packaging for free, but it introduces real risks:

- The renderer already hosts WebSockets (Stream Deck bridge) and the audio engine.
  Native packaging must not break that.
- Credentials are typed into a settings form in the renderer. A desktop app must
  store them with the OS keychain (`safeStorage`), not `localStorage`.
- A desktop app runs with higher privilege than a web page. The attack surface
  (navigation, links, payloads from Subsonic metadata) must be treated seriously.

## 2. Non-goals

- No native mini-player, native menus, or media-key support in Phase 1 (Phase 2).
- No offline/local media (Phase 3).
- No macOS/Linux packaging.
- No second audio pipeline; no multi-window shared-state architecture.

## 3. Architecture: single playback owner

The main React window is the **sole playback owner**. It holds the single
`StoreProvider`, the three media elements (`audioRef`, `crossfadeAudioRef`,
`radioAudioRef`), the Web Audio graph, Media Session, and the Stream Deck bridge.
The window stays alive while hidden.

Everything else is a **remote IPC client**:

- Tray menu (main process) sends commands via IPC to the renderer.
- Media keys and taskbar controls (Phase 2) are handled by the main process and
  forwarded the same way.
- Stream Deck bridge continues to talk to the renderer directly over its own
  loopback WebSocket.

This keeps the existing single-`StoreProvider` architecture untouched and avoids
the whole class of multi-window shared-state bugs.

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer (Vite-built React app, single StoreProvider)        │
│  audioRef/crossfadeAudioRef/radioAudioRef + AudioContext     │
│  Media Session, Stream Deck bridge, visualizers, lyrics      │
│  platform/ web adapter            playback/ ownerBridge      │
└──────────────────────────┬──────────────────────────────────┘
                           │ contextBridge IPC (preload)
┌──────────────────────────┴──────────────────────────────────┐
│ Main process (Electron)                                      │
│  app://nebula custom protocol serving dist/                  │
│  single-instance lock, window lifecycle, tray                │
│  desktop settings store (atomic JSON, zod)                   │
│  safeStorage credential vault                                │
└──────────────────────────────────────────────────────────────┘
```

## 4. Toolchain

| Tool | Version | Note |
| --- | --- | --- |
| Electron | `43.3.0` | current stable |
| electron-builder | `26.15.3` | Windows NSIS target |
| electron-updater | `6.8.9` | GitHub Releases |
| esbuild | `0.28.1` | bundles main + preload as CJS |
| Zod | `4.4.3` | settings schema validation |
| Vite / React / TS | existing | untouched web build |

Main and preload are bundled with esbuild (CommonJS output) because
`tsconfig.json` uses `module: ESNext` with `noEmit: true` and Electron's main
process must be CJS. The renderer stays on the existing Vite build.

## 5. Custom protocol: `app://nebula`

The renderer is served from `app://nebula` (a registered `protocol.handle`)
instead of `file://`. Rationale:

- Vite emits root-absolute asset URLs (`/assets/index-*.js`). Under `file://`,
  those resolve to the filesystem root and fail. `app://nebula` makes `/assets/...`
  resolve against the app root correctly.
- `webSecurity: true` is preserved (no `webSecurity: false` anywhere).
- Origin becomes `app://nebula`, which is a stable, non-file origin for
  credentials/storage decisions.

The protocol handler:

- Maps `/` to `dist/index.html`, `/assets/*` to `dist/assets/*`.
- Sets `X-Content-Type-Options: nosniff`.
- Rejects path traversal and absolute filesystem paths.

## 6. Security model

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  `webSecurity: true`. No `allowRunningInsecureContent`.
- Preload exposes a minimal, typed `window.desktop` bridge via `contextBridge`.
  No `ipcRenderer` object is leaked; only a fixed set of functions is exposed.
- Navigation is locked: `will-navigate` is prevented; `setWindowOpenHandler` denies
  all new windows and instead opens external links with the system browser.
- External links (radio station homepages, changelog links) are validated to be
  `https:` (or local `nebula://` in Phase 3) before opening.
- Stream Deck bridge remains loopback-only with its existing HMAC
  challenge/response pairing. No changes to its trust model.
- Renderer never receives `safeStorage` plaintext unless the user is actively
  editing credentials, and only via a single-use `ipcRenderer.invoke` round-trip.

### 6.1 Plain HTTP Subsonic (explicit opt-in)

Many self-hosted Subsonic instances are plain `http://`. A browser tab fails these
with mixed-content / insecure-context errors. In Electron we can permit them while
keeping `webSecurity: true`.

Decision: each profile record carries an explicit `allowInsecureHttp: boolean`.
Subsonic fetches for that profile route through the main process via a streaming
IPC endpoint (`net.fetch` in the main process, which is not subject to renderer
mixed-content policy). The default remains `https://`-only. The setting is surfaced
in the settings UI and stored in the desktop settings store.

Constraint: the credentials vault still refuses to store credentials over plain
HTTP in Phase 2; Phase 1 permits plaintext because the whole Phase 1 build is
internal-only and unreleased.

## 7. Lifecycle

- `app.requestSingleInstanceLock()`; a second launch focuses the existing window.
- Closing the window hides it (tray). Window close event is intercepted; real quit
  happens via tray "Quit" or `app.quit()`. `app.on('before-quit')` sets a flag so
  the window close handler doesn't re-hide.
- `app.on('window-all-closed')` does **not** quit on Windows (per platform norm for
  tray apps).
- The renderer notifies readiness via the preload bridge before the main process
  considers the app fully started.

## 8. Desktop settings store

Renderer settings continue to live in IndexedDB (unchanged). Desktop-only settings
(tray behavior, HTTP-insecure opt-ins per profile, window bounds, update channel)
live in a separate store:

- File: `<userData>/settings.json`, written atomically (write temp + rename).
- Schema-validated on load and write with Zod; unknown keys are dropped, invalid
  values fall back to defaults instead of crashing.
- All writes go through the main process (single writer), never from the renderer.

## 9. Credential vault (Phase 1 internal: plaintext, Phase 2: safeStorage)

- Phase 1: profile credentials are stored in `settings.json` in plaintext. This is
  explicitly temporary and only acceptable because Phase 1 ships to nobody.
- Phase 2: a `credentialStore` abstraction backs onto `safeStorage.encryptString`.
  The renderer's credential form round-trips plaintext only while editing; the
  vault refuses to fall back to plaintext when encryption is unavailable.

## 10. Updater (Phase 2 release gate)

- electron-builder NSIS installers uploaded to GitHub Releases.
- electron-updater with `publish.provider: github`.
- `autoUpdater` configured in the main process; a renderer-visible status surface
  is added in Phase 2.

## 11. Deliverables

- Phase 1: internal-only builds (`npm run build:electron`), tray + hide-on-close,
  single-instance, `app://nebula` protocol, platform boundary refactor, playback
  protocol, desktop settings store, plaintext vault, validation of external links.
- Phase 2: signed installer, GitHub Releases + auto-update, safeStorage vault,
  media keys + taskbar controls + mini-player (remote clients), Stream Deck
  hardening and settings UX.
- Phase 3: SQLite download DB, `nebula://` deep links, Jump Lists, taskbar
  progress, local folders, M3U import/export.
