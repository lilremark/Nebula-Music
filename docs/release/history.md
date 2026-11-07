# Release history (before 3.0.2)

In-app changelog entries up to 3.0.1-beta.1, archived when release notes moved to
one file per version in this folder (see README.md). GitHub releases carry the full
notes for each version.

## 3.0.1-beta.1 — ReplayGain and Playback Feedback

_2026-10-28_

- Add ReplayGain under Settings → Sound, with Off, Track and Album modes, a preamp, and peak-based clipping protection using tags from your music server.
- Keep ReplayGain independent for each crossfade track while preserving your volume and equalizer settings.
- Show loading, buffering and playback errors in the player, including next-track transitions.
- Warn when the music server is unreachable and provide a retry action when the connection returns.
- Fix browser playback on plain-HTTP Docker and LAN addresses, and show platform-appropriate settings in web and desktop builds.
- Update dependencies, including Electron 45, React, Motion, ONNX Runtime and WebGPU tooling, and fix the reported dependency vulnerabilities.

## 3.0.0 — Nebula 3.0 — Highlights since 2.4.6

_2026-10-09_

- A redesigned interface with OLED-black and light themes, collapsible navigation, larger album artwork, and sticky album and playlist headers.
- A floating playback dock and responsive Now Playing sidebar, with smooth switching between layouts and a refreshed always-on-top desktop mini player.
- More detailed, seekable stereo waveforms and artwork-colored progress, plus shared speed and pitch controls across player layouts.
- An expanded Home with up to 12 Quick Picks and six-track pages for Your Rotation, including your Top 50 and For You recommendations.
- Refined search and library controls, with Settings organized into sections you can navigate from the keyboard.
- Experimental local AI DJ on Windows: personalized sets, Michael or Heart voices, and optional verified model downloads. AI DJ is disabled and hidden on web and macOS.
- More reliable long queues and crossfades, with fewer stalled streams and consistent AutoEQ preamp across music, crossfades, and radio.
- Windows x64 and macOS Apple Silicon downloads, a Stable/Beta update-channel choice, and more reliable Windows taskbar playback controls.
- Updated dependencies, stronger desktop security, and better separation of music-server accounts and cached libraries.

## 2.5.0-beta.30 — Mini Player Refresh

_2026-10-09_

- Match the mini player to the current desktop design with white square playback controls and dark surfaces.
- Give track, artist and album text more room, and show elapsed and total playback time.
- Fix queue sizing and scrolling so upcoming tracks use the available window height.
- Add a clear empty queue state while preserving playback commands and AI DJ presentation.

## 2.5.0-beta.29 — macOS Beta

_2026-10-07_

- Publish the current beta for macOS Apple Silicon with DMG and ZIP downloads.
- Include the latest player, search, Home rotation and expanded Quick Picks improvements.
- Verify both macOS and Windows builds before publishing beta releases.

## 2.5.0-beta.28 — More Quick Picks

_2026-10-07_

- Show up to 12 Quick Picks instead of eight, filling six desktop rows beside Your Rotation.
- Keep the existing playback, refresh controls and responsive layout.

## 2.5.0-beta.27 — Home Rotation Layout

_2026-10-07_

- Place Your Rotation to the right of Quick Picks on desktop, including with the sidebar player open.
- Replace the nested track scrollbar with six-track pages while retaining access to all Top 50 and For You tracks.
- Remove flavor text from the rotation card and stack it below Quick Picks when space is limited.

## 2.5.0-beta.26 — Smoother Player Switching

_2026-10-05_

- Smoothly switch between the bottom and sidebar players with coordinated content resizing and a proper close animation.
- Preserve playback, keyboard focus and reduced-motion preferences while switching players.
- Round the search modal focus highlight and keep the input and close button within compact layouts.

## 2.5.0-beta.25 — AI DJ Collection View

_2026-10-04_

- Match the AI DJ Discover view to Album and Playlist headers, actions and track rows.
- Keep the Discover orb moving while visible, including idle and paused sessions, with speech-reactive animation.
- Improve compact layouts and retain live reduced-motion and static visualization fallbacks.

## 2.5.0-beta.24 — AI DJ Settings Refinement

_2026-10-03_

- Match AI DJ preferences to the shared Settings switches, dropdowns, buttons, typography and row spacing.
- Group model downloads and system requirements in a padded section, with consistent progress and action controls.
- Show the DJ voice level as a percentage and keep preferences usable in compact windows and both themes.

## 2.5.0-beta.23 — Local AI DJ

_2026-10-03_

- Start personalized AI DJ sessions from Discover, with local commentary and Michael or Heart voices after four or five completed tracks.
- Download verified SmolLM3 and Kokoro models in AI DJ Settings; the models are optional and excluded from the installer.
- Choose familiar, balanced or discovery listening, interludes between sets or over lowered music, and optional Discover transcription.
- Show a speech-reactive purple orb in every player, with a subtle purple background during DJ sessions.
- Keep the main view visible with both sidebars open, separate Home slideshow controls from album actions, and simplify the top bar.

## 2.5.0-beta.20 — Windows Taskbar Transport Controls

_2026-10-02_

- Show Previous, Play/Pause, and Next in the Windows taskbar thumbnail preview when Nebula opens.
- Retry toolbar registration when Windows is not ready and restore the controls when returning from the tray.
- Keep the Play/Pause button synchronized with playback without rebuilding the toolbar on every progress update.

## 2.5.0-beta.19 — Subtle Sidebar Highlight

_2026-10-02_

- Removed the shadow from selected sidebar items while keeping a subtle background highlight.
- Updated the Electron build downloader to remove a vulnerable transitive HTTP caching dependency.

## 2.5.0-beta.17 — Player and Library UI Refinements

_2026-10-02_

- Fixed the sidebar logo staying hidden after mouse interaction and refined active navigation highlights.
- Made the sidebar player available in smaller windows with a compact panel and exclusive player visibility.
- Shared the speed and pitch popover across bottom, sidebar, and full-screen players with 0.1-step buttons and sliders.
- Clarified update status with red Available and green Up to Date badges.
- Removed excess spacing before collection tracks while preserving stable sticky-header scrolling.
- Restyled Songs with divided track rows, larger controls, artwork, and favorite actions.
- Kept Albums filters on a single compact row with a shorter search field.

## 2.5.0-beta.16 — Sidebar and Progress Refinements

_2026-10-02_

- Lightened elapsed progress bars with a pale artwork-tinted gradient for clearer playback position.
- Aligned collapsed navigation icons and playlist artwork, and added smooth sidebar opening and closing with reduced-motion support.
- Added section dividers in both sidebar states and revealed the expand button over the collapsed Nebula logo on hover or keyboard focus.

## 2.5.0-beta.15 — Artwork Gradients and Collapsible Navigation

_2026-10-01_

- Applied artwork-color gradients to progress bars, played waveform bars, and playheads across all music players, including the native mini-player.
- Added a collapsible left sidebar with navigation icons, playlist artwork, accessible labels, and saved collapse state.
- Kept navigation vertical without scrolling in short windows and centered the playback dock as the sidebar changes width.

## 2.5.0-beta.14 — Playback Control Visuals

_2026-10-01_

- Replaced the progress-bar knob with an unclipped vertical playhead extending beyond the bar.
- Reduced bottom waveform height slightly while preserving its detail and smooth playback position.
- Matched bottom and sidebar transport controls to the large player with white square play buttons and outlined skip controls.

## 2.5.0-beta.13 — Waveform and Settings Refinements

_2026-10-01_

- Extended album and playlist track highlights and dividers to the edges of the content pane.
- Added taller, more detailed stereo waveforms with a smooth playhead, white played bars, and a yellow position marker.
- Added bottom-dock speed, pitch, independent-pitch, and waveform/progress controls.
- Showed actual audio-derived peaks and used a progress bar when a waveform is unavailable.
- Separated Settings into individual sections with keyboard-accessible tabs.
- Kept sidebar navigation vertical in short windows and sized playlists to the available space.

## 2.5.0-beta.12 — Floating Playback Dock and Collection Headers

_2026-10-01_

- Replaced the full-width bottom player with a centered, rounded dock and moved the waveform above its controls.
- Separated album and playlist details from their action bars and replaced track cards with flat rows and dividers.
- Added shared sticky album and playlist headers that shrink while scrolling and expand again at the top.
- Kept artwork, titles, and playback actions visible in compact headers without changing scroll height.
- Restored bottom playback controls in narrower desktop windows and preserved volume, seeking, and full-screen playback.

## 2.5.0-beta.11 — Album Layout and Modal Refinements

_2026-10-01_

- Enlarged album artwork, titles, metadata, and controls, and removed the duplicate album back button.
- Blended artwork colors through the album header and track list, with larger track controls and hover feedback.
- Renamed Listen Now to Home, removed Browse shortcuts, and removed introductory Settings copy.
- Scoped radio and Search backdrops to the central pane, with uniform radio blur and lighter Search blur.
- Made sidebar playlist shortcuts adapt to available height and added compact navigation for short windows without sidebar scrolling.

## 2.5.0-beta.10 — OLED Theme and Interface Cleanup

_2026-10-01_

- Replaced placeholder branding with the official Nebula logo.
- Removed Listen Now header shortcuts, sidebar appearance controls, and extra introductory copy while retaining Settings descriptions.
- Enlarged sidebar connection status and added the connected server address.
- Changed dark mode to a pure black canvas with neutral gray surfaces.

## 2.5.0-beta.9 — Player and Settings Refinements

_2026-10-01_

- Added a seekable waveform to the bottom mini player.
- The bottom and side players now replace one another, including when resizing the window.
- Improved Settings section spacing and separated the HTTP connection option from its warning and action buttons.

## 2.5.0-beta.8 — Security, Playback and AutoEQ

_2026-09-30_

- Refreshed the desktop and web interface while retaining library, playlist, radio, and playback controls.
- Updated dependencies and improved desktop security and isolation between music servers and accounts.
- Improved queue and crossfade recovery, radio cleanup, artwork loading, and settings persistence.
- Applied AutoEQ preamp to music, crossfades, and radio with saved-profile restore, EQ bypass, and smooth live changes.
- Reduced the initial web bundle by loading views on demand while keeping playback active.
- AI DJ settings remain temporarily hidden.

## 2.5.0-beta.6 — Queue Playback Reliability

_2026-09-20_

- Stopped opening an unused crossfade stream for every track when Magic Crossfade is disabled, preventing stream connections from accumulating during long queues.
- Added end-of-track recovery to the active crossfade player so the queue keeps advancing if the primary stream handoff stalls.

## 2.5.0-beta.5 — AI DJ Settings Pause

_2026-09-19_

- Temporarily disabled the AI DJ settings panel while the feature is prepared for a later beta.

## 2.5.0-beta.4 — Playback Stability

_2026-09-19_

- Cancelled stale waveform downloads between tracks so long queues continue loading streams without exhausting the server connection pool.

## 2.5.0-beta.3 — Beta Channel

_2026-08-20_

- Introduced the beta release channel: pre-release builds published from the beta branch are delivered to users who switch the update channel to Beta in Settings.
- Stable users continue to receive only published stable releases.

## 2.4.6 — Windows Title Bar

_2026-08-19_

- Added a dedicated Windows title bar with the Nebula wordmark and window controls above the app, matching the macOS layout.
- Moved the window controls out of the top bar into the new title strip in the main window and the full-screen player, and tightened their hover highlights so they fit within the strip.
- The navigation drawer now clears the new Windows title bar instead of overlapping it.

## 2.4.5 — Stream Deck Fix

_2026-08-16_

- Fixed Stream Deck pairing on the Windows desktop app: the bridge handshake now again sends a valid loopback origin the plugin accepts, so the plugin connects and pairs reliably.

## 2.4.4 — Performance and Reliability

_2026-08-16_

- Fixed playback hanging after the app was minimized or hidden for a long time (or after the PC woke from sleep) by keeping the playback pipeline alive while the window is in the background.
- Reduced idle CPU and smoothed animations: the now-playing panel, mini-player, cover flow, and visualizer no longer re-render every frame while paused or hidden.
- Stopped constant Windows taskbar churn — thumbnail buttons and the taskbar progress bar now update only when they actually change.
- Re-syncs tray, media-key, and mini-player state after waking from sleep.

## 2.4.3 — Auto-Update Fix

_2026-08-12_

- Fixed the auto-update check failing with "net::ERR_HTTP2_SERVER_REFUSED_STREAM" by forcing update requests over HTTP/1.1, which GitHub serves reliably.

## 2.4.2 — Expanded Mini Player and Taskbar Fix

_2026-08-12_

- Reworked the always-on-top mini-player: it now shows the current album art, progress, and transport controls, plus an "Up Next" list of the next five queued tracks with their cover art.
- Clicking an "Up Next" row jumps playback to that track in the queue.
- Fixed a Windows taskbar issue where a second, overlapping Nebula icon appeared by registering the app's AppUserModelID so all windows share one taskbar entry.

## 2.4.1 — Playback and Navigation Fixes

_2026-08-12_

- Fixed desktop playback stalling after a few tracks — media now loads directly from your server instead of the proxy, so streams and cover art no longer exhaust their connection pool.
- Opening a related album under "More by" now returns to the top of the album page, showing the album art, info, and tracklist (web, Windows, and macOS).
- Waveform previews fall back gracefully on servers that do not send CORS headers, matching the web build.

## 2.4.0 — Nebula for macOS

_2026-08-11_

- Added a native macOS arm64 edition with a dedicated title strip, traffic lights, app menu, Dock menu, menu-bar controls, media keys, and Notification Center updates.
- Added live Now Playing metadata and sanitized cover art to the macOS Playback menu.
- Added reproducible Windows and macOS release artifacts with platform-specific GitHub update feeds.
- Kept automatic Windows updates and added safe update checks with manual GitHub downloads for unsigned macOS builds.

## 2.3.1 — Update Fixes and Polish

_2026-08-08_

- Fixed automatic updates — the updater now reads the published latest.yml (stable) and uses prerelease detection for the beta channel.
- Replaced the tray indicator with the Nebula logo.
- Made the Home Most Played / For You section a collapsible dropdown so it no longer scrolls when stacked under Quick Picks.

## 2.3.0 — Nebula Desktop for Windows

_2026-08-08_

- Nebula is now a native Windows desktop app with a custom frameless title bar, window controls, and a system tray.
- Added automatic updates delivered from GitHub Releases with an in-app Restart & Install banner and a tray notification.
- Added Windows taskbar integration: playback progress, thumbnail transport buttons (previous, play/pause, next), and global media keys.
- Added a native always-on-top mini-player window and secure credential storage via the OS credential vault.
- Reworked the sign-in screen into a split view with a looping cover-flow animation.
- Redesigned the Settings updates panel as a centered hero with phase-aware controls.
- Made full-screen player tabs and the sidebar close button clickable, and pinned Zen-mode controls so media info stays visible.
- Improved visualizer accuracy by sampling pre-DSP audio and refined the waveform ticker and mini-player progress.
- Added a signed installer (NSIS) plus an unsigned appx package, and set the Nebula logo as the app and taskbar icon.

## 2.2.0 — Stream Deck Control Arrives

_2026-07-24_

- Added an opt-in, authenticated localhost bridge for controlling Nebula from Stream Deck and Stream Deck+.
- Added controls for now playing, album artwork, playback progress, seeking, volume, mute, previous and next tracks, and playlists.
- Added Stream Deck+ controls for scrubbing, playlist browsing, volume, playback speed, pitch, and pitch correction.
- Protected pairing with single-use six-digit codes, browser-stored tokens, loopback-only connections, and sanitized artwork.
- Reduced bridge traffic and command latency so hardware controls stay responsive while Stream Deck is minimized.
- Improved album and playlist queue replacement, Docker security, health checks, and published-image deployment.

## 2.1.3 — Modern Stack and OpenSubsonic Support

_2026-06-20_

- Updated the application stack to React 19, Vite 8, Tailwind CSS 4, and TypeScript 6.
- Added OpenSubsonic extension discovery and API-key authentication.
- Added structured lyrics v2 and ID3-first album and starred endpoints with legacy fallbacks.
- Added Subsonic protocol fallback negotiation from API 1.16.1 through 1.14.0.
- Hardened Docker deployment with Node.js 24 LTS, unprivileged Nginx 1.30, a read-only runtime, dropped capabilities, and health checks.

## 2.1.2 — AutoEq, Docker, and Playback Resilience

_2026-05-10_

- Added AutoEq headphone calibration search and profile application in Settings.
- Added Docker deployment support with a production Dockerfile, Compose file, and Nginx configuration.
- Improved Subsonic playback resilience with bounded stream URL caching and safer near-end recovery when streams stall.
- Added an Always Show Visualizer Controls setting and smoothed Zen title marquee animation.
- Refined Settings layout and fixed a Subsonic library-fetch crash.

## 2.1.1 — Radio Controls and Smarter Variety

_2026-04-28_

- Added a focused modal for creating Internet Radio stations, with cleaner form handling and a smoother station setup flow.
- Internet Radio now supports pitch shifting through dedicated DSP controls and playback UI integration.
- Generated music selections are more varied, with stronger shuffling and uniqueness checks for songs and albums.
- Cleaned up a duplicate full-player effect and refreshed the production script reference for more stable builds.

## 2.1 — Radio, Playback, and Waveform Stability

_2026-04-28_

- Internet Radio is now available in Nebula, with saved stations, live playback controls, and dedicated mini/full-screen player surfaces.
- Internet Radio supports direct streams and HLS .m3u8 streams with a lazy-loaded browser fallback for Chrome, Edge, and Firefox.
- Full-screen Internet Radio now uses the same Web Audio canvas visualizers as the regular full-screen player.
- Magic Crossfade is safer around pause, manual track changes, and track handoffs so secondary audio cannot keep playing unexpectedly.
- Waveform loading is more reliable because failed decodes no longer get cached as permanent fallback waveforms.
- Live radio playback is protected from speed and pitch mutations that can break stream buffering or drift away from the live edge.

## 2.0 — Nebula 2.0 - UI Refresh

_2026-03-16_

- Full UI refresh with light-first surfaces and refined glass panels.
- Theme system now respects system preference on first launch with explicit Light/Dark selection in Settings.
- Accessibility polish: higher contrast secondary text, larger touch targets, and semantic heading order fixes.
- Playback polish with per-song pitch persistence and clearer speed/pitch handling.
- Visual consistency pass across Home, Browse, Library, Player, and modals.

## 1.4 — Player Experience Upgrade

_2024-05-24_

- Redesigned Expanded Player: Now features a sleek side-by-side layout on larger screens with significantly larger album art.
- Mini Player Power-Up: Added a fully seekable progress bar with hover controls and a dedicated time display.
- Metadata Detail: Expanded player now displays detailed track info including Genre, Year, and Audio Quality specifics.
- Visual Polish: Improved animations and layout spacing for a more immersive listening experience.

## 1.3 — Responsiveness & Stability Update

_2024-05-22_

- Fixed M4A/ALAC playback issues by implementing smarter transcoding rules and content-length estimation.
- Enhanced responsiveness: The app now fits perfectly on all screen sizes using dynamic viewport units (100dvh).
- Persistent Library Filters: Sort options, genre, and year filters are now saved between sessions.
- UI Stability: Fixed visual resets in the Home Hero section when interacting with the player.
- Visual Upgrades: Added parallax scrolling effects to Artist Detail views and refined player layouts for smaller screens.
