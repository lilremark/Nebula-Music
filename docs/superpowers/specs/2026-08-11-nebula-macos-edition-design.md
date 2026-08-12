# Nebula macOS Edition — Design

- Status: Accepted
- Date: 2026-08-11
- Scope: Port the Windows-first Electron desktop edition of Nebula Music to macOS as v2.4.0.

## Context

Nebula Music is a React 19 + Vite + TypeScript web player for Subsonic/OpenSubsonic
libraries. Since v2.3.0 it also ships as a Windows desktop app: the existing Vite
build is served from a custom `app://nebula` protocol by an Electron main process
that owns a tray, automatic updates, taskbar integration, global media keys, an
always-on-top mini-player window, and OS-vault credential storage.

The user wants the same desktop experience on macOS, using native macOS behaviors
where the platform expects them (traffic lights, app menu, menu-bar status item,
Now Playing / media keys, Notification Center). The Windows build ships unsigned;
macOS will also ship unsigned. Target architecture is the native machine (arm64).

## Goals

1. One codebase: extend the existing Electron shell with `darwin` branches, never
   fork. Keep `npm run dev`, `npm test`, `npm run build` (web) unchanged.
2. macOS-native chrome: real traffic lights, a real app menu (Cmd+C/V, Cmd+Q/W/H),
   and a menu-bar status item as the macOS equivalent of the Windows tray.
3. macOS-native integration: Now Playing / media keys through the renderer Media
   Session, Notification Center for update-ready, a dock menu, a floating panel
   mini-player.
4. Unsigned arm64 distribution: `.dmg` for users plus the `.zip` + `latest-mac.yml`
   pair required by electron-updater, published to the same GitHub Releases.

## Non-Goals

- Intel (x64) or universal binaries.
- Code signing or notarization (no Apple Developer account; mirrors Windows).
- Re-implementing the renderer; the web build remains the source of truth.
- Changes to Windows behavior beyond the minimal branches required.
- Linux support.

## Architecture

The existing platform layering is reused as-is:

- `platform/` — web vs. desktop implementations behind `PlatformContext`.
- `playback/desktopProtocol.ts` + `commandClient.ts` — the command/snapshot
  transport used by the tray, dock menu, and application-menu playback items.
- `electron/credentialVault.ts` + `safeStorageCipher.ts` — already cross-platform
  (Keychain on macOS); no change needed.
- `electron/updater.ts` — platform-agnostic state machine; no change needed.
- `electron/main.ts` — gains the `darwin` branches and menu-bar/notification work.

Platform conditionals are concentrated in the main process. The renderer only
learns about macOS through the existing `platform.info.os` value, which it already
uses to render (or not render) the Windows window controls.

### Data flow

```
Menu-bar status item ─┐
Dock menu ────────────┼─ DesktopCommand envelope ──▶ IPC.playback.command
App menu (Playback) ──┘        │
                                ▼
                 ownerBridge (main window) ──▶ Store ──▶ audio
Renderer Media Session (macOS media keys / Now Playing) stays renderer-side.
Update-ready ─▶ Notification Center (darwin) / tray balloon (win32)
```

## Changes

### 1. Build & packaging

**`electron-builder.yml`** — add a `mac:` block (keep `win:` as-is):

```yaml
mac:
  icon: electron/assets/icon.icns
  category: public.app-category.music
  target:
    - target: dmg
      arch: [arm64]
    - target: zip
      arch: [arm64]
  artifactName: ${productName}-${version}-${arch}.${ext}
```

- `zip` is mandatory for electron-updater's `latest-mac.yml`.
- `publish` stays `provider: github` for the same Releases feed.
- No signing keys: unsigned build. `hardenedRuntime`/`notarize` are left unset.

**`scripts/generate-icons.mjs`** — also emit a macOS icon set:

- Render 16/32/64/128/256/512 px PNGs (+ `@2x` variants for 16/32/128/256/512)
  into a temporary `icon.iconset` directory, then run
  `iconutil -c icns <iconset> -o electron/assets/icon.icns` (macOS built-in).
- Render a monochrome template PNG for the status item:
  `electron/assets/trayTemplate.png` (16 px) and `trayTemplate@2x.png` (32 px).
  The glyph is the Nebula "bars" mark in black-with-alpha on transparency so it
  works as a macOS template image in both menu-bar appearances.
- Keep the existing `icon.ico`/`icon.png` outputs; add the new files to git.

**`package.json`**

- Version `2.3.1` → `2.4.0`.
- Add `"dist:mac": "node esbuild.config.mjs && vite build && electron-builder --mac --publish never"`.

### 2. Window chrome & native app menu

**`electron/main.ts` — `createWindow`**

```ts
...(process.platform === 'darwin'
  ? { titleBarStyle: 'hiddenInset' as const }
  : process.platform === 'win32'
    ? { frame: false }
    : {}),
```

- On macOS this keeps the native traffic lights overlaid on the web header while
  the header's existing `-webkit-app-region: drag` provides the drag region.
- The explicit `icon:` stays (used on Windows/Linux; the dock icon comes from the
  bundle on macOS).

**`components/layout/TopBar.tsx`**

- When `platform.info.os === 'darwin'`, add left padding (≈ `pl-20`) to the header
  so the menu button clears the traffic lights; keep the drag region unchanged.
- `WindowControls` already returns `null` on non-win32, so no duplicate controls.

**`electron/macMenu.ts` (new)** — `installMacAppMenu(options)` called only on
darwin:

- **Nebula**: About (role), Settings… (Cmd+,), Hide / Hide Others / Show All
  (roles), Quit (role).
- The Settings… item and any other view-navigation menu items send
  `IPC.app.openSettings` to the main window; see **Renderer navigation** below.
- **Edit**: undo/redo/cut/copy/paste/selectAll roles — required so text inputs get
  Cmd+C/V.
- **Playback**: Play/Pause, Next, Previous, Repeat — built as a `CommandClient`
  (`nebula-app-menu`) forwarding `DesktopCommand` envelopes through the same
  `IPC.playback.command` path as the tray, so ordering/dedup matches.
- **Window**: Minimize (Cmd+M), Zoom, Full Screen (Cmd+Ctrl+F), Bring All to Front,
  plus a Mini Player toggle item reusing `toggleMiniPlayer`.
- Windows/Linux keep their existing default menu; this module is darwin-only.

**Renderer navigation (`IPC.app.openSettings`)**

- New channel in `electron/ipc.ts`: `IPC.app.openSettings: 'nebula:app:open-settings'`.
- Preload exposes `bridge.app.onOpenSettings(handler)` subscribing to it.
- In the renderer, `App.tsx` (or the Store bootstrap) subscribes once when the
  desktop platform is present and calls `setView('SETTINGS')`; the handler is a
  no-op on web. This is what the app-menu Settings… item triggers.

**Dock menu (`electron/main.ts`)**

- On darwin, `app.dock.setMenu(Menu.buildFromTemplate(...))` with Play/Pause,
  Next, Previous (same command client) and "Show Nebula".

### 3. Status item, media keys, notifications

**`electron/tray.ts`**

- On darwin, create the tray from `trayTemplate.png`/`trayTemplate@2x.png` and call
  `setTemplateImage(true)` so the status item renders correctly in both menu-bar
  appearances.
- Keep the existing context menu (Show, Play/Pause, Next, Previous, Mini Player,
  Quit) — on macOS the left-click shows this menu natively.
- On macOS the left-click `showWindow` binding is inert (the menu takes over),
  which is the expected status-item behavior; no change needed beyond the icon.

**`showUpdateBalloon` → notifications**

- In `electron/tray.ts`, gate `tray.displayBalloon(...)` to win32. On darwin, use
  Electron's `Notification`:

```ts
new Notification({ title: 'Nebula update ready', body: `Version ${version} is downloaded. Click to install.` })
  .on('click', () => { installAndRestart(); showMainWindow(); })
  .show();
```

- Move the click-to-install wiring so both paths land on the same handler.

**`electron/mediaKeys.ts`**

- Gate `registerMediaKeys`/`unregisterMediaKeys` to win32 (`globalShortcut` media
  keys are not supported on macOS).
- On macOS the renderer's existing Media Session handlers provide media keys and
  drive Now Playing / Control Center / lock screen with no main-process code.
- `main.ts` must not call `registerMediaKeys` on darwin (guard at the call site).

**Mini-player window (`createMiniPlayerWindow`)**

- Keep frameless + always-on-top; on darwin add `type: 'panel'` so it floats above
  other apps and is omitted from Cmd-Tab.

### 4. Renderer / UI adaptation

**`views/Settings.tsx` — `DesktopSettingsPanel`**

- "Taskbar Progress" row: render only on win32.
- "Global Media Keys" row: on macOS replace the toggle with a static row describing
  "Now Playing" integration (always active via Media Session). Keep the toggle on
  win32.
- "Close to Tray" and "Minimize to Tray" remain on all platforms. On macOS, use
  menu-bar wording in the descriptions ("keeps Nebula running in the menu bar"
  instead of "system tray" / "instead of the taskbar").

**`platform/desktopBridge.ts`, `platform/types.ts`, `platform/desktop.ts`**

- Add the `app.onOpenSettings(handler)` surface to `DesktopBridge`, the `Platform`
  interface (`app?: { onOpenSettings }` or a dedicated member), and the desktop
  implementation so the renderer can subscribe without branching on Electron
  globals. The web implementation exposes a no-op.

### 5. Auto-update (same feed, documented caveat)

- `electron-updater` reads `latest-mac.yml` from the existing GitHub provider with
  no code changes; `UpdaterState`, the Settings updates panel, and the in-app
  banner all already work.
- **Known limitation (documented in README/release notes):** Squirrel.Mac's
  relaunch step requires a code signature, so on unsigned builds the update check,
  download, banner, and notification will work but "Restart & Install" may not
  complete until a Developer ID is configured. This matches the Windows posture of
  shipping unsigned while keeping the update plumbing ready.

## Error handling & edge cases

- `iconutil` may be unavailable (non-macOS dev box): `generate-icons.mjs` should
  fail with a clear message rather than silently skip the `.icns`.
- `Notification` requires a packaged bundle; guard `.isSupported()` and fall back
  to the in-app banner silently in dev.
- `trayTemplate@2x.png` load failure falls back to the 1x template (load @1x and
  `setTemplateImage` regardless; Electron scales).
- Menu-bar status item and dock menu must not be created before `app.whenReady()`.
- The `mediaKeysEnabled` setting keeps its win32 meaning; on darwin toggling is not
  exposed in the UI, and `main.ts` never registers global shortcuts.

## Testing & verification

- Gate (must pass before completion):
  - `npm run typecheck` — 0 errors
  - `npm test` — all existing tests green
  - `npm run build` — PASS
  - `npm run build:electron` — PASS
- Manual smoke test on this Mac (arm64):
  - `npm run start:electron` launches; traffic lights present; header drags the
    window; menu button/logo clear the traffic lights.
  - App menu: About, Settings (Cmd+,), Edit shortcuts, Playback items, Window
    items, Quit (Cmd+Q), Close Window (Cmd+W).
  - Status item: icon adapts to dark/light menu bar; menu controls playback;
    Mini Player toggles the floating panel; window hides on close and reopens
    from status item / dock.
  - Dock menu shows playback controls.
  - Playing a track shows Now Playing in Control Center; media keys control it.
  - Simulated `update-downloaded` shows a Notification Center banner (dev: banner
    only, since packaged build is required for real updates).
  - `npm run dist:mac` produces `release/Nebula-2.4.0-arm64.dmg` and
    `release/Nebula-2.4.0-arm64.zip` + `latest-mac.yml`.

## Open items / risks

- Unsigned Squirrel.Mac auto-update install limitation (documented; signing is a
  future step).
- macOS 26+/Sequoia-era privacy prompts (media keys, notifications) surface at
  first use; no code change, but first-launch UX may include a system prompt.
- `titleBarStyle: 'hiddenInset'` overlap tweaks may need small pixel nudges after
  the first real launch; the plan should budget a polish pass.
