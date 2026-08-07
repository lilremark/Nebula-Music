# Nebula Desktop

A Windows desktop edition of Nebula Music, the Subsonic-compatible music player.
It wraps the existing React web app in an Electron shell so playback keeps running
while the window is hidden, without a browser tab holding everything hostage.

## Positioning

- **Same product, better packaging.** All player behavior lives in the existing
  web UI: queue, audio engine, visualizers, lyrics, AutoEq, Stream Deck bridge,
  and settings. The desktop edition does not re-implement playback. It makes the
  app a native Windows application: a tray icon, media keys, an installer, and a
  background window that keeps playing after you close the UI.
- **Single playback owner.** The main React window is the only component that owns
  audio. Tray, mini-player, media keys, taskbar controls, and the Stream Deck
  bridge are remote clients that send commands and read snapshots over IPC.
- **Windows first.** Target is Windows 10 22H2 and Windows 11, x64. macOS and Linux
  are future work and intentionally out of scope until Windows is solid.

## Audience

People who live in Windows and want Nebula Music to behave like a native music
player: play from the system tray, control playback with media keys, and keep music
playing without keeping a browser tab open.

## User outcomes

1. Install Nebula with a signed installer and automatic updates.
2. Close the window; music keeps playing from the tray.
3. Control playback with media keys, tray menu, and a future mini-player.
4. Reuse existing Nebula state: credentials, settings, playlists, queue.

## Platforms

| Scope | Version | Priority |
| --- | --- | --- |
| Windows 10 22H2 + Windows 11 | x64 (amd64) | Phase 1+ |
| macOS | — | Not planned |
| Linux | — | Not planned |

## Out of scope (initially)

- macOS/Linux packaging.
- Native mini-player window (Phase 2; remote client, not a playback owner).
- Offline/local media download (Phase 3; SQLite download DB, `nebula://` links).
- A second audio pipeline or shared-state window hierarchy (explicitly rejected).
