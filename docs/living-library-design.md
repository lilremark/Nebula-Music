# Living Library: production desktop refresh

This direction is implemented in the production renderer. It uses the existing Store, service, playback owner, Electron bridge, and route components, so the current app remains the source of behavior. The separate Studio work stays available for comparison.

## Visual system

- **Mood:** an art-led music library with the quiet structure of a native desktop app. Artwork supplies the color and energy; the shell stays legible.
- **Layout:** a persistent desktop rail, a compact search and action bar, a broad browsing canvas, and a bottom transport bar. The optional now-playing panel holds artwork and queue; at narrower widths the app uses the existing mobile player. The existing Floating Bar setting remains available.
- **Themes:** matched light and dark palettes in `design-system/tokens.ts`, `index.css`, and `next-ui.css`. Stored user colors remain user-controlled.
- **Type and shape:** Manrope for the product shell, restrained radii, generous artwork, compact transport controls, and a clear reading order.
- **Motion:** the featured Step Player advances between tracks, selection moves within the rail and tabs, route changes blur and fade, and settings switches give animated feedback. Reduced-motion preferences suppress nonessential movement.

## Component integration

The production app renders source components from every requested library. Source links and attribution are in `components/vendor/README.md`.

| Library | Actual component | Production placement |
| --- | --- | --- |
| Rare UI | Step Player | Home featured track progression |
| React Bits | Spotlight Card | Home quick picks |
| Aceternity UI | Tabs | Home Most Played / For You section |
| Magic UI | Blur Fade | View transitions in `AppContent` |
| Spectrum UI | Animated Switch | Settings toggles |
| loading.dev | Arc | Home refresh and search loading states |

## Music service structure

- **Discover:** Listen Now, Browse, Internet Radio, and Search are grouped in the desktop rail and mobile drawer. Browse begins with direct album, artist, song, playlist, and radio routes.
- **Your Library:** library types and liked collections share one section, with saved playlists listed below it on both layouts. The server connection state stays visible at the bottom of navigation.
- **Listen Now:** a featured track leads into compact quick picks, an always-visible listening-history/recommendation section, then album shelves for discovery, recent listening, and new additions.
- **Playback:** the desktop transport stays available while navigating. The queue/artwork side panel can open independently; full-screen playback retains visualizer, speed, repeat, and advanced controls. The Store still owns audio.

## Behavior and review

The route switch in `AppContent` still mounts Home, Browse, Internet Radio, Settings, every library section, and artist, album, playlist, and search details. The same player and Store actions handle playback, queue, repeat, volume, radio, playlists, likes, equalizer, visualizer, shortcuts, and server connection. Desktop UI validation covered navigation, demo playback, search, settings, theme switching, and responsive behavior. The connected Subsonic server and external hardware integrations require human review with the user's devices.

Run `npm run dev` for the browser preview or `npm run start:electron` for the local app. `npm run build:electron` builds the desktop renderer and main process. On this Windows host, `npx electron-builder --win nsis --publish never --config.electronDist=node_modules/electron/dist` creates a local installer without publishing it; using the installed Electron distribution avoids a transient file-lock error during archive extraction.
