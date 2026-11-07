
import { IAlbum, IArtist, ISong, IPlaylist } from './types';

// Release notes for this version: docs/release/v<APP_VERSION>.md (shown in What's New).
export const APP_VERSION = '3.0.2-beta.1';

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
