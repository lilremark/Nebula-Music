# ADR 0003: Electron desktop edition for Windows

- Status: Accepted
- Date: 2026-08-06

## Context

Nebula Music is a browser-based Subsonic player. Users want a native Windows app:
playback that survives closing the window, a tray icon, media keys, an installer,
and automatic updates. The existing app is a single React window that owns all
playback (`StoreProvider`, three media elements, Web Audio graph, Media Session,
Stream Deck bridge).

Electron is the natural packaging layer because the renderer already is a web app.
The risk is that native packaging invites architectural drift: second audio
pipelines, shared-state window hierarchies, or `webSecurity: false` to make
plain-HTTP Subsonic work.

## Decision

Build a Windows-first Electron desktop edition in the same repository, with these
principles:

1. **Single playback owner.** The main React window remains the sole owner of the
   `StoreProvider` and all media elements, and stays alive while hidden. Tray,
   media keys, taskbar controls, mini-player, and Stream Deck are remote IPC
   clients only. No second audio pipeline.
2. **Render the web build, don't re-implement it.** The renderer is the existing
   Vite build served from a custom `app://nebula` protocol (root-absolute asset
   URLs are incompatible with `file://`). `webSecurity` stays `true`.
3. **Plain HTTP Subsonic via explicit per-profile opt-in.** Subsonic fetches for
   insecure profiles route through the main process with `net.fetch`, which is not
   subject to the renderer mixed-content policy. Default remains `https://`-only.
4. **Hardened shell.** `contextIsolation` + sandbox + minimal typed preload bridge;
   navigation locked; external links validated to `https:` before opening with the
   system browser; single-instance; close hides to tray.
5. **Desktop state in the main process.** Desktop settings (tray, HTTP opt-ins,
   window bounds, update channel) live in an atomic zod-validated JSON store with a
   single writer. Credentials move to `safeStorage` in Phase 2; Phase 1 is
   internal-only and stores plaintext behind a swappable vault interface.
6. **Reuse the existing build.** The web build (`npm run dev`, `npm test`,
   `npm run build`) keeps working and remains the source of truth.

## Consequences

- The main window is always the playback owner; hidden-window playback works.
- Stream Deck bridge is unaffected and continues to talk to the renderer.
- Renderer storage (IndexedDB settings/caches/stats) is unchanged.
- The desktop app must keep `dist/` fresh; a stale committed `dist/index.html` is
  never packaged (dist is gitignored, build runs before package).
- External links and radio station URLs are restricted to `https:`; http-only
  station homepages will not open until Phase 3 allows `nebula://` locally.
- Plaintext credentials exist only in the unreleased Phase 1 build and are removed
  when the Phase 2 vault lands.
- macOS/Linux are out of scope until Windows is solid.
