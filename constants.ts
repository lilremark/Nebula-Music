
import { IAlbum, IArtist, ISong, IPlaylist } from './types';

export const APP_VERSION = '2.4.1';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
  link?: {
    label: string;
    href: string;
  };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.4.1',
    date: '2026-08-12',
    title: 'Playback and Navigation Fixes',
    changes: [
      'Fixed desktop playback stalling after a few tracks — media now loads directly from your server instead of the proxy, so streams and cover art no longer exhaust their connection pool.',
      'Opening a related album under "More by" now returns to the top of the album page, showing the album art, info, and tracklist (web, Windows, and macOS).',
      'Waveform previews fall back gracefully on servers that do not send CORS headers, matching the web build.'
    ],
    link: {
      label: 'Download Nebula 2.4.1',
      href: 'https://github.com/lilremark/Nebula-Music/releases/tag/v2.4.1'
    }
  },
  {
    version: '2.4.0',
    date: '2026-08-11',
    title: 'Nebula for macOS',
    changes: [
      'Added a native macOS arm64 edition with a dedicated title strip, traffic lights, app menu, Dock menu, menu-bar controls, media keys, and Notification Center updates.',
      'Added live Now Playing metadata and sanitized cover art to the macOS Playback menu.',
      'Added reproducible Windows and macOS release artifacts with platform-specific GitHub update feeds.',
      'Kept automatic Windows updates and added safe update checks with manual GitHub downloads for unsigned macOS builds.'
    ],
    link: {
      label: 'Download Nebula 2.4.0',
      href: 'https://github.com/lilremark/Nebula-Music/releases/tag/v2.4.0'
    }
  },
  {
    version: '2.3.1',
    date: '2026-08-08',
    title: 'Update Fixes and Polish',
    changes: [
      'Fixed automatic updates — the updater now reads the published latest.yml (stable) and uses prerelease detection for the beta channel.',
      'Replaced the tray indicator with the Nebula logo.',
      'Made the Home Most Played / For You section a collapsible dropdown so it no longer scrolls when stacked under Quick Picks.'
    ]
  },
  {
    version: '2.3.0',
    date: '2026-08-08',
    title: 'Nebula Desktop for Windows',
    changes: [
      'Nebula is now a native Windows desktop app with a custom frameless title bar, window controls, and a system tray.',
      'Added automatic updates delivered from GitHub Releases with an in-app Restart & Install banner and a tray notification.',
      'Added Windows taskbar integration: playback progress, thumbnail transport buttons (previous, play/pause, next), and global media keys.',
      'Added a native always-on-top mini-player window and secure credential storage via the OS credential vault.',
      'Reworked the sign-in screen into a split view with a looping cover-flow animation.',
      'Redesigned the Settings updates panel as a centered hero with phase-aware controls.',
      'Made full-screen player tabs and the sidebar close button clickable, and pinned Zen-mode controls so media info stays visible.',
      'Improved visualizer accuracy by sampling pre-DSP audio and refined the waveform ticker and mini-player progress.',
      'Added a signed installer (NSIS) plus an unsigned appx package, and set the Nebula logo as the app and taskbar icon.'
    ],
    link: {
      label: 'Download for Windows',
      href: 'https://github.com/lilremark/Nebula-Music/releases/latest'
    }
  },
  {
    version: '2.2.0',
    date: '2026-07-24',
    title: 'Stream Deck Control Arrives',
    changes: [
      'Added an opt-in, authenticated localhost bridge for controlling Nebula from Stream Deck and Stream Deck+.',
      'Added controls for now playing, album artwork, playback progress, seeking, volume, mute, previous and next tracks, and playlists.',
      'Added Stream Deck+ controls for scrubbing, playlist browsing, volume, playback speed, pitch, and pitch correction.',
      'Protected pairing with single-use six-digit codes, browser-stored tokens, loopback-only connections, and sanitized artwork.',
      'Reduced bridge traffic and command latency so hardware controls stay responsive while Stream Deck is minimized.',
      'Improved album and playlist queue replacement, Docker security, health checks, and published-image deployment.'
    ],
    link: {
      label: 'Get the Stream Deck plugin',
      href: 'https://github.com/lilremark/nebula-music-stream-deck-plugin'
    }
  },
  {
    version: '2.1.3',
    date: '2026-06-20',
    title: 'Modern Stack and OpenSubsonic Support',
    changes: [
      'Updated the application stack to React 19, Vite 8, Tailwind CSS 4, and TypeScript 6.',
      'Added OpenSubsonic extension discovery and API-key authentication.',
      'Added structured lyrics v2 and ID3-first album and starred endpoints with legacy fallbacks.',
      'Added Subsonic protocol fallback negotiation from API 1.16.1 through 1.14.0.',
      'Hardened Docker deployment with Node.js 24 LTS, unprivileged Nginx 1.30, a read-only runtime, dropped capabilities, and health checks.'
    ]
  },
  {
    version: '2.1.2',
    date: '2026-05-10',
    title: 'AutoEq, Docker, and Playback Resilience',
    changes: [
      'Added AutoEq headphone calibration search and profile application in Settings.',
      'Added Docker deployment support with a production Dockerfile, Compose file, and Nginx configuration.',
      'Improved Subsonic playback resilience with bounded stream URL caching and safer near-end recovery when streams stall.',
      'Added an Always Show Visualizer Controls setting and smoothed Zen title marquee animation.',
      'Refined Settings layout and fixed a Subsonic library-fetch crash.'
    ]
  },
  {
    version: '2.1.1',
    date: '2026-04-28',
    title: 'Radio Controls and Smarter Variety',
    changes: [
      'Added a focused modal for creating Internet Radio stations, with cleaner form handling and a smoother station setup flow.',
      'Internet Radio now supports pitch shifting through dedicated DSP controls and playback UI integration.',
      'Generated music selections are more varied, with stronger shuffling and uniqueness checks for songs and albums.',
      'Cleaned up a duplicate full-player effect and refreshed the production script reference for more stable builds.'
    ]
  },
  {
    version: '2.1',
    date: '2026-04-28',
    title: 'Radio, Playback, and Waveform Stability',
    changes: [
      'Internet Radio is now available in Nebula, with saved stations, live playback controls, and dedicated mini/full-screen player surfaces.',
      'Internet Radio supports direct streams and HLS .m3u8 streams with a lazy-loaded browser fallback for Chrome, Edge, and Firefox.',
      'Full-screen Internet Radio now uses the same Web Audio canvas visualizers as the regular full-screen player.',
      'Magic Crossfade is safer around pause, manual track changes, and track handoffs so secondary audio cannot keep playing unexpectedly.',
      'Waveform loading is more reliable because failed decodes no longer get cached as permanent fallback waveforms.',
      'Live radio playback is protected from speed and pitch mutations that can break stream buffering or drift away from the live edge.'
    ]
  },
  {
    version: '2.0',
    date: '2026-03-16',
    title: 'Nebula 2.0 - UI Refresh',
    changes: [
      'Full UI refresh with light-first surfaces and refined glass panels.',
      'Theme system now respects system preference on first launch with explicit Light/Dark selection in Settings.',
      'Accessibility polish: higher contrast secondary text, larger touch targets, and semantic heading order fixes.',
      'Playback polish with per-song pitch persistence and clearer speed/pitch handling.',
      'Visual consistency pass across Home, Browse, Library, Player, and modals.'
    ]
  },
  {
    version: '1.4',
    date: '2024-05-24',
    title: 'Player Experience Upgrade',
    changes: [
      'Redesigned Expanded Player: Now features a sleek side-by-side layout on larger screens with significantly larger album art.',
      'Mini Player Power-Up: Added a fully seekable progress bar with hover controls and a dedicated time display.',
      'Metadata Detail: Expanded player now displays detailed track info including Genre, Year, and Audio Quality specifics.',
      'Visual Polish: Improved animations and layout spacing for a more immersive listening experience.'
    ]
  },
  {
    version: '1.3',
    date: '2024-05-22',
    title: 'Responsiveness & Stability Update',
    changes: [
      'Fixed M4A/ALAC playback issues by implementing smarter transcoding rules and content-length estimation.',
      'Enhanced responsiveness: The app now fits perfectly on all screen sizes using dynamic viewport units (100dvh).',
      'Persistent Library Filters: Sort options, genre, and year filters are now saved between sessions.',
      'UI Stability: Fixed visual resets in the Home Hero section when interacting with the player.',
      'Visual Upgrades: Added parallax scrolling effects to Artist Detail views and refined player layouts for smaller screens.'
    ]
  }
];

export const MOCK_ARTISTS: IArtist[] = [
  { id: 'ar1', name: 'Neon Void', albumCount: 2 },
  { id: 'ar2', name: 'Cyber Punkers', albumCount: 1 },
  { id: 'ar3', name: 'Lo-Fi Dreams', albumCount: 3 },
  { id: 'ar4', name: 'The Algorithms', albumCount: 1 },
  { id: 'ar5', name: 'Retro Wave', albumCount: 5 },
];

export const MOCK_ALBUMS: IAlbum[] = [
  { id: 'al1', name: 'Midnight City', artist: 'Neon Void', artistId: 'ar1', songCount: 12, duration: 3600, created: '2023-01-01', year: 2023, coverArt: 'https://picsum.photos/300/300?random=1' },
  { id: 'al2', name: 'Digital Rain', artist: 'Cyber Punkers', artistId: 'ar2', songCount: 8, duration: 2400, created: '2023-05-12', year: 2023, coverArt: 'https://picsum.photos/300/300?random=2' },
  { id: 'al3', name: 'Study Beats', artist: 'Lo-Fi Dreams', artistId: 'ar3', songCount: 20, duration: 5000, created: '2022-11-01', year: 2022, coverArt: 'https://picsum.photos/300/300?random=3' },
  { id: 'al4', name: 'Binary Sunset', artist: 'The Algorithms', artistId: 'ar4', songCount: 6, duration: 1800, created: '2024-01-15', year: 2024, coverArt: 'https://picsum.photos/300/300?random=4' },
];

export const MOCK_SONGS: ISong[] = [
  { id: 's1', title: 'Neon Highway', artist: 'Neon Void', artistId: 'ar1', album: 'Midnight City', albumId: 'al1', duration: 245, coverArt: 'https://picsum.photos/300/300?random=1', created: '2024-01-10', bitRate: 320, playCount: 12, suffix: 'mp3' },
  { id: 's2', title: 'Cybernetic Heart', artist: 'Neon Void', artistId: 'ar1', album: 'Midnight City', albumId: 'al1', duration: 198, coverArt: 'https://picsum.photos/300/300?random=1', created: '2024-01-11', bitRate: 320, playCount: 5, suffix: 'mp3' },
  { id: 's3', title: 'Glitch in the Matrix', artist: 'Cyber Punkers', artistId: 'ar2', album: 'Digital Rain', albumId: 'al2', duration: 305, coverArt: 'https://picsum.photos/300/300?random=2', created: '2024-01-12', bitRate: 960, playCount: 3, suffix: 'flac' },
  { id: 's4', title: 'Rainy Window', artist: 'Lo-Fi Dreams', artistId: 'ar3', album: 'Study Beats', albumId: 'al3', duration: 150, coverArt: 'https://picsum.photos/300/300?random=3', created: '2023-12-25', bitRate: 128, playCount: 45, suffix: 'mp3' },
  { id: 's5', title: 'Coffee Shop Noise', artist: 'Lo-Fi Dreams', artistId: 'ar3', album: 'Study Beats', albumId: 'al3', duration: 180, coverArt: 'https://picsum.photos/300/300?random=3', created: '2023-12-26', bitRate: 256, playCount: 22, suffix: 'mp3' },
  { id: 's6', title: 'Sorting Array', artist: 'The Algorithms', artistId: 'ar4', album: 'Binary Sunset', albumId: 'al4', duration: 420, coverArt: 'https://picsum.photos/300/300?random=4', created: '2024-02-01', bitRate: 320, playCount: 8, suffix: 'mp3' },
  { id: 's7', title: 'Nightcall', artist: 'Retro Wave', artistId: 'ar5', album: 'Drive OST', albumId: 'al5', duration: 250, coverArt: 'https://picsum.photos/300/300?random=5', created: '2024-02-02', bitRate: 850, playCount: 15, suffix: 'flac' },
  { id: 's8', title: 'Synthesizer Love', artist: 'Neon Void', artistId: 'ar1', album: 'Midnight City', albumId: 'al1', duration: 210, coverArt: 'https://picsum.photos/300/300?random=1', created: '2024-01-10', bitRate: 320, playCount: 1, suffix: 'mp3' },
];

export const MOCK_PLAYLISTS: IPlaylist[] = [
  { id: 'pl1', name: 'Coding Flow', songCount: 2, duration: 665, created: '2024-01-01', coverArt: 'https://picsum.photos/300/300?random=6', songs: [MOCK_SONGS[5], MOCK_SONGS[0]] },
  { id: 'pl2', name: 'Gym Hype', songCount: 1, duration: 250, created: '2024-01-10', coverArt: 'https://picsum.photos/300/300?random=7', songs: [MOCK_SONGS[6]] },
];
