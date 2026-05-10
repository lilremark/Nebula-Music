# Nebula Music

A high-fidelity music client for Subsonic-compatible servers (Navidrome, Gonic, Airsonic, etc.). Version 2.1.2 adds AutoEq headphone calibration, Docker deployment support, safer long-session Subsonic playback, and polish for visualizer controls and Settings.

## Table of Contents

- [Key Features](#key-features)
- [Changelog](#changelog)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration and Environment](#configuration-and-environment)
- [Using Nebula](#using-nebula)
- [Architecture](#architecture)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Docker Deployment](#docker-deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Key Features

- UI Refresh (v2.0): Light-first surfaces, refined panels, and consistent styling across Home, Browse, Library, Player, and Modals.
- Theme System: System preference on first launch, explicit Light/Dark selection in Settings, and CSS-variable driven theming.
- Audio Engine: Playback speed control, per-song pitch persistence, and pitch correction (vinyl mode support).
- AutoEq Calibration: Search and apply headphone correction profiles from Settings.
- Visualizers: Web Audio API visualizer modes (Bars, Wave, Circle, Mirror, Spectrum, Particles, Hexagon).
- Internet Radio: Save stations, play live streams, and use dedicated mini/full-screen radio player surfaces.
- Player Experience: Expandable full-screen player, sidebar or floating mini-player, and mobile bottom player bar.
- Search: Spotlight-style modal search with real-time results across artists, albums, and songs.
- Library Management: Artists, albums, songs, playlists, likes, and queue management.
- Discovery: Featured hero, random mixes, recent/newest albums, and most played tracking.
- Offline-Ready Caching: IndexedDB caching for API responses, settings, and local play stats.
- Accessibility Improvements: Stronger contrast for secondary text, larger touch targets, and semantic heading fixes.

## Changelog

### v2.1.2 (2026-05-10)
- Added AutoEq headphone calibration search and profile application in Settings.
- Added Docker deployment support with a production Dockerfile, Compose file, and Nginx configuration.
- Improved Subsonic playback resilience with bounded stream URL caching and safer near-end recovery when streams stall.
- Added an Always Show Visualizer Controls setting and smoothed Zen title marquee animation.
- Refined Settings layout and fixed a Subsonic library-fetch crash.

### v2.1.1 (2026-04-28)
- Added a focused modal for creating Internet Radio stations, with cleaner form handling and a smoother station setup flow.
- Internet Radio now supports pitch shifting through dedicated DSP controls and playback UI integration.
- Generated music selections are more varied, with stronger shuffling and uniqueness checks for songs and albums.
- Cleaned up a duplicate full-player effect and refreshed the production script reference for more stable builds.

### v2.1 (2026-04-28)
- Internet Radio is now available in Nebula, with saved stations, live playback controls, and dedicated mini/full-screen player surfaces.
- Internet Radio supports direct streams and HLS .m3u8 streams with a lazy-loaded browser fallback for Chrome, Edge, and Firefox.
- Full-screen Internet Radio now uses the same Web Audio canvas visualizers as the regular full-screen player.
- Magic Crossfade is safer around pause, manual track changes, and track handoffs so secondary audio cannot keep playing unexpectedly.
- Waveform loading is more reliable because failed decodes no longer get cached as permanent fallback waveforms.
- Live radio playback is protected from speed and pitch mutations that can break stream buffering or drift away from the live edge.

### v2.0 (2026-03-16)
- Full UI refresh with light-first surfaces and refined panels.
- Theme system now respects system preference on first launch with explicit Light/Dark selection in Settings.
- Accessibility polish: higher contrast secondary text, larger touch targets, and semantic heading order fixes.
- Playback polish with per-song pitch persistence and clearer speed and pitch handling.
- Visual consistency pass across Home, Browse, Library, Player, and modals.

### v1.4 (2026-01-27)
- Expanded player layout refinements and larger album art on wide screens.
- Mini player enhancements with seekable progress bar and time display.
- Additional metadata in the expanded player (genre, year, quality).
- Visual spacing and animation improvements.

### v1.3 (2026-01-23)
- Smarter transcoding rules for M4A and ALAC playback.
- Dynamic viewport sizing for better mobile stability.
- Persistent library filters (sort, genre, year).
- Hero stability fixes and artist parallax improvements.

## Tech Stack

- Language: TypeScript
- Framework: React 18
- Build Tooling: Vite 5
- Styling: Tailwind CSS 3
- Audio: HTMLAudioElement + Web Audio API
- Storage: IndexedDB (custom wrapper in services/db.ts)
- Icons: Lucide React

## Prerequisites

- Node.js 18 or newer
- npm (package-lock.json is included)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the app:

```text
http://localhost:3000
```

## Configuration and Environment

No environment variables are required for local development. Subsonic credentials are entered in the UI and stored locally in IndexedDB.

Local storage details:
- IndexedDB settings store: theme, EQ, shortcuts, and cached API responses
- IndexedDB stats store: most played tracking per server
- localStorage: lightweight play history snapshots and last-seen version for the What's New modal

## Using Nebula

1. Launch the app and connect your Subsonic server.
1. Enter your server URL, username, and password. The app stores a token + salt, not the raw password.
1. Explore Home, Browse, Library, and Player screens. Toggle Light/Dark in Settings.
1. Optional: Click "Try Demo Mode" to explore the UI with mock data.

## Architecture

### Directory Structure

```text
nebula-music(1)/
|-- components/           # Reusable UI building blocks
|   |-- layout/           # App frame and top bar
|   |-- navigation/       # Nav drawer and mobile nav
|   |-- player/           # Now playing, mini player, player panels
|   `-- ui/               # Shared UI primitives
|-- constants/            # EQ presets and constants
|-- context/              # ThemeContext and Store state
|-- hooks/                # UI-focused hooks (adaptive colors, artist images)
|-- services/             # Subsonic API client and IndexedDB wrapper
|-- views/                # Route-level screens (Home, Browse, Library, Player, Settings)
|-- App.tsx               # App shell and routing logic
|-- index.tsx             # App bootstrap and error boundary
|-- index.css             # Global styles, custom utilities, theme overrides
`-- index.html            # Vite entry HTML (fonts, meta tags)
```

### App State and Data Flow

1. React components call actions from context/Store.tsx.
1. Store actions delegate to services/subsonicService.ts for network calls.
1. Responses are cached in IndexedDB (services/db.ts) to reduce network chatter.
1. Store state updates re-render views and player surfaces.

### Audio Pipeline

1. HTMLAudioElement lives in StoreProvider and is shared app-wide.
1. Playback rate and pitch are combined into a final playbackRate value.
1. Web Audio API AnalyserNode is created lazily and drives visualizers.
1. Media Session API keeps OS-level playback controls and metadata in sync.

### Theme System

- ThemeContext determines light or dark mode based on saved preference.
- On first launch, the app uses prefers-color-scheme.
- The html element gets the dark class only in dark mode and a data-theme attribute for future overrides.
- CSS variables are written to :root for consistent color usage.

### Storage and Caching

- IndexedDB stores settings, cached API responses, and per-server play stats.
- localStorage stores quick play history lists and the last-seen app version.

## Keyboard Shortcuts

| Action | Default Shortcut |
| --- | --- |
| Play/Pause | Space |
| Previous Track | ArrowLeft |
| Next Track | ArrowRight |
| Toggle Repeat | L |
| Cycle Visualizer | V |
| Toggle Zen Mode | Z |

Shortcuts are configurable in Settings.

## Available Scripts

| Command | Description |
| --- | --- |
| npm run dev | Start the Vite dev server on port 3000 |
| npm run build | Build production assets to dist/ |
| npm run preview | Preview the production build locally |

## Deployment

### Vercel

1. Import the repository into Vercel.
1. Framework preset: Vite.
1. Build command: npm run build
1. Output directory: dist
1. Deploy. Vercel will serve the static build.

### Static Hosting

You can host the dist/ folder on any static host (Netlify, S3, Cloudflare Pages). Build locally using npm run build and upload dist/.

## Docker Deployment

Nebula Music includes a self-contained Docker deployment bundle in docker/. The image builds the Vite app with Node.js, then serves the static dist/ output with Nginx.

### Docker Compose

From the repository root:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Open the app:

```text
http://localhost:8080
```

Stop the app:

```bash
docker compose -f docker/docker-compose.yml down
```

### Docker CLI

Build the image:

```bash
docker build -f docker/Dockerfile -t nebula-music:latest .
```

Run the container:

```bash
docker run --rm -p 8080:80 nebula-music:latest
```

### Hosting Notes

- Change the Compose port mapping from `8080:80` if another service already uses port 8080.
- Nebula is served as a static browser app. Subsonic credentials are entered in the UI and stored in the browser.
- Your Subsonic-compatible server must be reachable from the user's browser. If connection fails, check the server URL, HTTPS, and CORS settings.

## Troubleshooting

### Cannot connect to server

- Ensure your server URL is correct and includes https:// when available.
- Confirm your Subsonic server is reachable from the browser.
- Check for CORS restrictions on the server.

### Audio plays but cannot seek

- Some formats require transcoding. SubsonicService forces transcoding for problematic formats like ALAC and M4A.
- If you self-host, confirm your server supports streaming with proper Content-Length headers.

### Theme does not persist

- Ensure localStorage and IndexedDB are not blocked by the browser.
- Clear site data if you recently switched between demo and live credentials.

## License

MIT
