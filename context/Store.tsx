
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, ISong, View, SubsonicCredentials, AppSettings, IPlaylist, VisualizerMode, RepeatMode, IArtist, IAlbum, HomeData, NavigationTarget, IRadioStation, IRadioMetadata } from '../types';
import { SubsonicService } from '../services/subsonicService';
import { MOCK_PLAYLISTS } from '../constants';
import { db } from '../services/db';

interface StoreContextType extends AppState {
  setView: (view: View, data?: any, options?: { replace?: boolean; clearHistory?: boolean }) => void;
  goBack: (fallbackView?: View, fallbackData?: any) => void;
  canGoBack: boolean;
  backTarget?: NavigationTarget;
  playSong: (song: ISong, contextQueue?: ISong[]) => void;
  playRadioStation: (station: IRadioStation) => void;
  toggleRadioPlay: () => void;
  stopRadio: () => void;
  setRadioPitch: (val: number) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  setVolume: (val: number) => void;
  setPlaybackRate: (val: number) => void;
  setPitch: (val: number) => void;
  setPitchCorrection: (enabled: boolean) => void;
  setVisualizerMode: (mode: VisualizerMode) => void;
  toggleRepeat: () => void;
  toggleLike: (song: ISong) => void;
  connectToSubsonic: (url: string, user: string, pass: string) => Promise<boolean>;
  disconnect: () => void;
  enableDemoMode: () => void;
  addToQueue: (song: ISong) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;

  // Playlist Actions
  openPlaylistModal: (song: ISong) => void;
  closePlaylistModal: () => void;
  createPlaylist: (name: string) => void;
  savePlaylist: (playlist: IPlaylist) => void;
  addSongToPlaylist: (playlistId: string, song: ISong) => void;
  deletePlaylist: (id: string) => void;
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;
  addRadioStation: (station: Omit<IRadioStation, 'id' | 'created'>) => void;
  updateRadioStation: (station: IRadioStation) => void;
  deleteRadioStation: (id: string) => void;

  // Search
  performSearch: (query: string) => void;
  isSearchModalOpen: boolean;
  openSearchModal: () => void;
  closeSearchModal: () => void;

  // Stats & History
  getMostPlayedSongs: () => ISong[];
  refreshMostPlayed: () => Promise<void>;
  playInstantMix: () => Promise<ISong[]>;
  history: ISong[];

  service: SubsonicService;
  audioRef: React.RefObject<HTMLAudioElement>;
  radioAudioRef: React.RefObject<HTMLAudioElement>;
  analyser: AnalyserNode | null;

  // Data Fetching
  refreshHomeData: (force?: boolean) => Promise<void>;
  refreshQuickPicks: () => Promise<void>;
  refreshDiscovery: () => Promise<void>;
  fetchArtists: (force?: boolean) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const DEFAULT_SETTINGS: AppSettings = {
  theme: {
    primaryColor: '#06b6d4',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#0a0a0a',
  },
  sidebar: {
    showHome: true,
    showBrowse: true,
    showRadio: true,
    showArtists: true,
    showAlbums: true,
    showSongs: true,
    showPlaylists: true,
  },
  shortcuts: {
    playPause: ' ',
    prev: 'ArrowLeft',
    next: 'ArrowRight',
    loop: 'l',
    visualizer: 'v',
    zen: 'z'
  },
  eq: {
    enabled: false,
    preset: 'flat',
    autoEq: null,
    autoEqIndexFetchedAt: null,
    bands: {
      '32': 0,
      '64': 0,
      '125': 0,
      '250': 0,
      '500': 0,
      '1k': 0,
      '2k': 0,
      '4k': 0,
      '8k': 0,
      '16k': 0,
    }
  },
  miniPlayerMode: 'sidebar',
  progressVisualization: 'bar',
  magicCrossfade: false,
  alwaysShowZenControls: false,
};

const parseIcyMetadata = (bytes: Uint8Array): Pick<IRadioMetadata, 'title' | 'artist' | 'album' | 'rawTitle'> | null => {
  const text = new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
  if (!text) return null;

  const streamTitleMatch = text.match(/StreamTitle='([^']*)'/i) || text.match(/StreamTitle="([^"]*)"/i);
  const rawTitle = (streamTitleMatch?.[1] || '').trim();
  if (!rawTitle) return null;

  const [artistPart, ...titleParts] = rawTitle.split(/\s+-\s+/);
  if (artistPart && titleParts.length > 0) {
    return {
      artist: artistPart.trim(),
      title: titleParts.join(' - ').trim(),
      rawTitle,
    };
  }

  return { title: rawTitle, rawTitle };
};

const fetchRadioArtwork = async (metadata: Pick<IRadioMetadata, 'title' | 'artist'>, signal: AbortSignal): Promise<string | undefined> => {
  const query = [metadata.artist, metadata.title].filter(Boolean).join(' ').trim();
  if (!query) return undefined;

  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`, { signal });
    if (!response.ok) return undefined;
    const data = await response.json();
    const artwork = data?.results?.[0]?.artworkUrl100;
    return typeof artwork === 'string' ? artwork.replace('100x100bb', '600x600bb') : undefined;
  } catch (error: any) {
    if (error?.name !== 'AbortError') console.warn('Radio artwork lookup failed', error);
    return undefined;
  }
};

const isHlsStreamUrl = (streamUrl: string) => {
  try {
    return new URL(streamUrl).pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return streamUrl.toLowerCase().split('?')[0].endsWith('.m3u8');
  }
};

type EqBandKey = keyof AppSettings['eq']['bands'];

const EQ_BAND_FREQUENCIES: Record<EqBandKey, number> = {
  '32': 32,
  '64': 64,
  '125': 125,
  '250': 250,
  '500': 500,
  '1k': 1000,
  '2k': 2000,
  '4k': 4000,
  '8k': 8000,
  '16k': 16000,
};

const EQ_BAND_KEYS = Object.keys(EQ_BAND_FREQUENCIES) as EqBandKey[];
const PLAY_HISTORY_KEY = 'nebula_play_history';
const RECENT_HISTORY_KEY = 'nebula_history';
const RADIO_STATIONS_KEY = 'nebula_radio_stations';
const WAVEFORM_CACHE_PREFIX = 'nebula_waveform_v4:';
const MAX_PLAY_HISTORY_ENTRIES = 200;
const MAX_RECENT_HISTORY_ENTRIES = 50;

type PlayHistoryEntry = { count: number, song: ISong };
type PlayHistoryMap = Record<string, PlayHistoryEntry>;

const isQuotaExceededError = (error: unknown) => {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
};

const clearWaveformCache = () => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(WAVEFORM_CACHE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  return keysToRemove.length;
};

const safeLocalStorageSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn(`Failed to persist ${key}`, error);
      return false;
    }

    const removedWaveforms = clearWaveformCache();
    try {
      localStorage.setItem(key, value);
      if (removedWaveforms > 0) {
        console.warn(`Cleared ${removedWaveforms} waveform cache entries after localStorage quota was reached.`);
      }
      return true;
    } catch (retryError) {
      console.warn(`Failed to persist ${key} after clearing waveform cache`, retryError);
      return false;
    }
  }
};

const compactSongForStorage = (song: ISong): ISong => ({
  id: song.id,
  parent: song.parent,
  title: song.title,
  album: song.album,
  artist: song.artist,
  coverArt: song.coverArt,
  duration: song.duration,
  track: song.track,
  discNumber: song.discNumber,
  year: song.year,
  genre: song.genre,
  suffix: song.suffix,
  contentType: song.contentType,
  isVideo: song.isVideo,
  albumId: song.albumId,
  artistId: song.artistId,
  starred: song.starred,
  playCount: song.playCount,
});

const trimPlayHistory = (history: PlayHistoryMap, limit = MAX_PLAY_HISTORY_ENTRIES): PlayHistoryMap => {
  const entries = Object.entries(history)
    .map(([id, entry]) => [id, { count: entry.count || 0, song: compactSongForStorage(entry.song) }] as const)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, limit);
  return Object.fromEntries(entries);
};

const parsePlayHistory = (raw: string | null): PlayHistoryMap => {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return trimPlayHistory(parsed as PlayHistoryMap);
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [service] = useState(() => new SubsonicService(null));
  const [currentView, setCurrentView] = useState<View>('HOME');
  const [viewData, setViewData] = useState<any>(undefined);
  const [navigationStack, setNavigationStack] = useState<NavigationTarget[]>([]);
  const [credentials, setCredentialsState] = useState<SubsonicCredentials | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [queue, setQueue] = useState<ISong[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [radioStations, setRadioStations] = useState<IRadioStation[]>([]);
  const [currentRadioStation, setCurrentRadioStation] = useState<IRadioStation | null>(null);
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const [radioMetadata, setRadioMetadata] = useState<IRadioMetadata | null>(null);
  const [isRadioMetadataLoading, setIsRadioMetadataLoading] = useState(false);
  const [radioPitch, setRadioPitchState] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [pitchCorrection, setPitchCorrection] = useState(true);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('OFF');
  const [pitch, setPitchState] = useState(0);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('BARS');
  const [isZenMode, setZenMode] = useState(false);

  const [playlists, setPlaylists] = useState<IPlaylist[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<ISong | null>(null);

  const [searchResults, setSearchResults] = useState<{ artists: IArtist[], albums: IAlbum[], songs: ISong[] }>({ artists: [], albums: [], songs: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const [playHistory, setPlayHistory] = useState<Record<string, { count: number, song: ISong }>>({});
  const [history, setHistory] = useState<ISong[]>([]);
  const lastPlayedSongIdRef = useRef<string | null>(null);
  const hasScrobbledRef = useRef(false);
  const lastLogTimeRef = useRef(0);

  // Caching State
  const [homeData, setHomeData] = useState<HomeData>({
    randomSongs: [],
    recentAlbums: [],
    newestAlbums: [],
    exploreAlbums: [],
    recommendedTracks: [],
    lastFetched: 0
  });
  const [cachedArtists, setCachedArtists] = useState<IArtist[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const radioAudioRef = useRef<HTMLAudioElement>(null);
  const crossfadeAudioRef = useRef<HTMLAudioElement>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dspInputRef = useRef<GainNode | null>(null);
  const eqFiltersRef = useRef<Array<{ key: EqBandKey; filter: BiquadFilterNode }>>([]);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const crossfadeAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const radioAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const radioPitchShiftNodeRef = useRef<AudioWorkletNode | null>(null);
  const pitchWorkletLoadRef = useRef<Promise<void> | null>(null);
  const radioHlsRef = useRef<import('hls.js').default | null>(null);
  const navigationStackRef = useRef<NavigationTarget[]>([]);
  const crossfadeAnimationRef = useRef<number | null>(null);
  const isCrossfadingRef = useRef(false);
  const isCrossfadeStartingRef = useRef(false);
  const crossfadeHandoffRef = useRef<{ songId: string; currentTime: number } | null>(null);
  const endAdvanceTimerRef = useRef<number | null>(null);
  const playbackProgressRef = useRef<{ songId: string | null; time: number; changedAt: number }>({ songId: null, time: 0, changedAt: 0 });

  // Use refs for state accessed inside event listeners to avoid constant re-binding
  const stateRef = useRef({ queue, currentSongIndex, isPlaying, repeatMode, volume, playbackRate, pitch, pitchCorrection, magicCrossfade: settings.magicCrossfade });

  const currentSong = queue[currentSongIndex];

  useEffect(() => {
    stateRef.current = { queue, currentSongIndex, isPlaying, repeatMode, volume, playbackRate, pitch, pitchCorrection, magicCrossfade: settings.magicCrossfade };
  }, [queue, currentSongIndex, isPlaying, repeatMode, volume, playbackRate, pitch, pitchCorrection, settings.magicCrossfade]);

  useEffect(() => {
    navigationStackRef.current = navigationStack;
  }, [navigationStack]);

  const getMostPlayedSongs = useCallback(() => {
    const historyItems = Object.values(playHistory) as { count: number, song: ISong }[];
    const sorted = historyItems.sort((a, b) => b.count - a.count);
    return sorted.map(item => item.song);
  }, [playHistory]);

  const shuffleSongs = <T,>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const uniquePlayableSongs = (songs: ISong[]) => {
    const seen = new Set<string>();
    return songs.filter(song => {
      if (!song || song.isVideo || seen.has(song.id)) return false;
      seen.add(song.id);
      return true;
    });
  };

  const getTopGenreFromSongs = (songs: ISong[]) => {
    const genreCounts: Record<string, number> = {};
    songs.forEach(song => {
      if (song.genre) genreCounts[song.genre] = (genreCounts[song.genre] || 0) + (song.playCount || 1);
    });
    return Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a])[0] || '';
  };

  const refreshQuickPicks = useCallback(async () => {
    const topSongs = getMostPlayedSongs();
    const topGenre = getTopGenreFromSongs(topSongs);
    const randomGenre = shuffleSongs(topSongs.map(song => song.genre).filter(Boolean) as string[])[0] || '';
    const [randomA, randomB, topGenreSongs, randomGenreSongs] = await Promise.all([
      service.getRandomSongs(24),
      service.getRandomSongs(24),
      service.getRandomSongs(18, topGenre ? { genre: topGenre } : {}),
      service.getRandomSongs(18, randomGenre && randomGenre !== topGenre ? { genre: randomGenre } : {}),
    ]);
    const random = shuffleSongs(uniquePlayableSongs([
      ...randomA,
      ...shuffleSongs(topGenreSongs).slice(0, 10),
      ...shuffleSongs(randomGenreSongs).slice(0, 8),
      ...randomB,
    ])).slice(0, 24);
    setHomeData(prev => ({ ...prev, randomSongs: random }));
  }, [getMostPlayedSongs, service]);

  const refreshDiscovery = useCallback(async () => {
    let strategy = 'random';
    let params = {};

    const topSongs = getMostPlayedSongs();
    if (topSongs.length > 0) {
      const genreCounts: Record<string, number> = {};
      topSongs.forEach(s => {
        if (s.genre) genreCounts[s.genre] = (genreCounts[s.genre] || 0) + 1;
      });
      const topGenre = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a])[0];
      if (topGenre) {
        strategy = 'byGenre';
        params = { genre: topGenre };
      }
    }

    const offset = Math.floor(Math.random() * 50);
    let results = await service.getAlbumList(strategy, 10, offset, params);

    // Ensure we have enough items to fill the row (max 8)
    if (results.length < 10) {
      const fill = await service.getAlbumList('random', 10 - results.length);
      results = [...results, ...fill];
    }

    setHomeData(prev => ({ ...prev, exploreAlbums: results }));
  }, [service, getMostPlayedSongs]);

  // Data Fetching Logic for Home
  const refreshHomeData = useCallback(async (force = false) => {
    if (!force && homeData.lastFetched > 0 && (Date.now() - homeData.lastFetched) < 3600000) {
      return;
    }

    const loadExplore = async () => {
      const today = new Date().toDateString();
      const storedDate = localStorage.getItem('nebula_explore_date');
      const storedData = localStorage.getItem('nebula_explore_data');

      if (!force && storedDate === today && storedData) {
        try {
          return JSON.parse(storedData);
        } catch (e) { }
      }

      let strategy = 'random';
      let params = {};

      const topSongs = getMostPlayedSongs();
      if (topSongs.length > 0) {
        const genreCounts: Record<string, number> = {};
        topSongs.forEach(s => {
          if (s.genre) genreCounts[s.genre] = (genreCounts[s.genre] || 0) + 1;
        });
        const topGenre = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a])[0];
        if (topGenre) {
          strategy = 'byGenre';
          params = { genre: topGenre };
        }
      }

      const offset = (force && strategy !== 'random') ? Math.floor(Math.random() * 50) : 0;
      let results = await service.getAlbumList(strategy, 10, offset, params);

      // Ensure we have enough items to fill the row
      if (results.length < 10) {
        const fill = await service.getAlbumList('random', 10 - results.length);
        results = [...results, ...fill];
      }

      if (!force) {
        safeLocalStorageSetItem('nebula_explore_date', today);
        safeLocalStorageSetItem('nebula_explore_data', JSON.stringify(results));
      }
      return results;
    };

    const loadRecommended = async () => {
      const topSongs = getMostPlayedSongs();
      const topGenre = getTopGenreFromSongs(topSongs);
      const seedSongs = shuffleSongs(topSongs).slice(0, 4);
      const similarGroups = await Promise.all(seedSongs.map(song => service.getSimilarSongs(song.id, 10).catch(() => [])));
      const [randomA, randomB, genreSongs] = await Promise.all([
        service.getRandomSongs(30),
        service.getRandomSongs(30),
        service.getRandomSongs(30, topGenre ? { genre: topGenre } : {}),
      ]);
      return shuffleSongs(uniquePlayableSongs([
        ...shuffleSongs(similarGroups.flat()).slice(0, 25),
        ...shuffleSongs(genreSongs).slice(0, 20),
        ...shuffleSongs(topSongs).slice(0, 12),
        ...randomA,
        ...randomB,
      ])).slice(0, 50);
    };

    const [random, recent, newest, explore, recs] = await Promise.all([
      (async () => {
        const topSongs = getMostPlayedSongs();
        const topGenre = getTopGenreFromSongs(topSongs);
        const [randomA, randomB, genreSongs] = await Promise.all([
          service.getRandomSongs(24),
          service.getRandomSongs(24),
          service.getRandomSongs(18, topGenre ? { genre: topGenre } : {}),
        ]);
        return shuffleSongs(uniquePlayableSongs([...randomA, ...shuffleSongs(genreSongs).slice(0, 10), ...randomB])).slice(0, 24);
      })(),
      service.getAlbumList('recent', 24),
      service.getAlbumList('newest', 24),
      loadExplore(),
      loadRecommended()
    ]);

    setHomeData({
      randomSongs: random,
      recentAlbums: recent,
      newestAlbums: newest,
      exploreAlbums: explore,
      recommendedTracks: recs,
      lastFetched: Date.now()
    });
  }, [service, homeData.lastFetched, getMostPlayedSongs]);

  // Stats
  const [mostPlayed, setMostPlayed] = useState<ISong[]>([]);

  const loadMostPlayedSongs = useCallback(async (limit: number = 50) => {
    if (!service.getCredentials() && !credentials) return [];

    // Full library scan because Subsonic-compatible servers expose user play counts
    // on song records, but not a portable "top played tracks" endpoint.
    const BATCH_SIZE = 500;
    let offset = 0;
    let allSongs: ISong[] = [];
    let fetched = 0;

    do {
      const batch = await service.searchSongs('', BATCH_SIZE, offset);
      fetched = batch.length;
      allSongs = [...allSongs, ...batch.filter(s => (s.playCount || 0) > 0 && !s.isVideo)];
      offset += BATCH_SIZE;
    } while (fetched === BATCH_SIZE && offset < 20000);

    allSongs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    return allSongs.slice(0, limit);
  }, [credentials, service]);

  const refreshMostPlayed = useCallback(async () => {
    try {
      setMostPlayed(await loadMostPlayedSongs(50));
    } catch (e) {
      console.warn("Failed to perform library scan for stats", e);
    }
  }, [loadMostPlayedSongs]);

  const fetchArtists = useCallback(async (force = false) => {
    if (!force && cachedArtists.length > 0) return;
    const artists = await service.getArtists();
    setCachedArtists(artists);
  }, [service, cachedArtists.length]);

  useEffect(() => {
    const init = async () => {
      await db.init();
      const savedCreds = await db.getCredentials();
      if (savedCreds) {
        service.setCredentials(savedCreds);
        setCredentialsState(savedCreds);
        setIsDemoMode(false);

        // Clear any cached demo data from localStorage
        localStorage.removeItem('nebula_explore_data');
        localStorage.removeItem('nebula_explore_date');
        localStorage.removeItem(PLAY_HISTORY_KEY); // Clear play history to prevent demo songs in Most Played

        // Reset homeData and playHistory to empty to prevent demo content from showing
        setHomeData({
          randomSongs: [],
          recentAlbums: [],
          newestAlbums: [],
          exploreAlbums: [],
          recommendedTracks: [],
          lastFetched: 0
        });
        setPlayHistory({}); // Clear play history state

        service.getPing();
        service.getPlaylists().then(setPlaylists);
        fetchArtists();
      }
      const savedSettings = await db.get('settings', 'user_settings');
      if (savedSettings) {
        // Migration: Convert old flat EQ to new nested structure
        if (savedSettings.eq && !savedSettings.eq.bands) {
          console.warn("Migrating old EQ settings to new structure...");
          const oldBands = {
            '32': savedSettings.eq['32'] || 0,
            '64': savedSettings.eq['64'] || 0,
            '125': savedSettings.eq['125'] || 0,
            '250': savedSettings.eq['250'] || 0,
            '500': savedSettings.eq['500'] || 0,
            '1k': savedSettings.eq['1k'] || 0,
            '2k': savedSettings.eq['2k'] || 0,
            '4k': savedSettings.eq['4k'] || 0,
            '8k': savedSettings.eq['8k'] || 0,
            '16k': savedSettings.eq['16k'] || 0,
          };
          savedSettings.eq = {
            enabled: !!savedSettings.eq.enabled,
            preset: 'custom',
            bands: oldBands
          };
        }

        if (savedSettings.magicCrossfade === undefined && (savedSettings.crossfadeSeconds || 0) > 0) {
          savedSettings.magicCrossfade = true;
        }

        setSettings(prev => ({
          ...prev,
          ...savedSettings,
          theme: { ...prev.theme, ...savedSettings.theme },
          sidebar: { ...prev.sidebar, ...savedSettings.sidebar },
          shortcuts: { ...prev.shortcuts, ...savedSettings.shortcuts },
          eq: {
            ...prev.eq,
            ...(savedSettings.eq || {}),
            bands: {
              ...prev.eq.bands,
              ...(savedSettings.eq?.bands || {}),
            },
          },
        }));
      }
      try {
        const storedStats = localStorage.getItem(PLAY_HISTORY_KEY);
        if (storedStats) {
          const parsedStats = parsePlayHistory(storedStats);
          setPlayHistory(parsedStats);
          safeLocalStorageSetItem(PLAY_HISTORY_KEY, JSON.stringify(parsedStats));
        }
        const storedList = localStorage.getItem(RECENT_HISTORY_KEY);
        if (storedList) {
          const parsedList = JSON.parse(storedList);
          if (Array.isArray(parsedList)) {
            const compactHistory = parsedList.slice(0, MAX_RECENT_HISTORY_ENTRIES).map(compactSongForStorage);
            setHistory(compactHistory);
            safeLocalStorageSetItem(RECENT_HISTORY_KEY, JSON.stringify(compactHistory));
          }
        }
        const storedStations = localStorage.getItem(RADIO_STATIONS_KEY);
        if (storedStations) {
          const parsedStations = JSON.parse(storedStations);
          if (Array.isArray(parsedStations)) setRadioStations(parsedStations);
        }
      } catch (e) { }
      // Mark initialization as complete
      setIsInitialized(true);
    };
    init();
  }, [service]);

  useEffect(() => {
    if (isPlaying && currentSongIndex >= 0 && queue[currentSongIndex]) {
      const song = queue[currentSongIndex];
      if (song.id !== lastPlayedSongIdRef.current) {
        hasScrobbledRef.current = false;
        setPlayHistory(prev => {
          const currentCount = prev[song.id]?.count || 0;
          const updated = trimPlayHistory({ ...prev, [song.id]: { count: currentCount + 1, song } });
          safeLocalStorageSetItem(PLAY_HISTORY_KEY, JSON.stringify(updated));
          return updated;
        });
        setHistory(prev => {
          const withoutCurrent = prev.filter(s => s.id !== song.id);
          const newHistory = [compactSongForStorage(song), ...withoutCurrent.map(compactSongForStorage)].slice(0, MAX_RECENT_HISTORY_ENTRIES);
          safeLocalStorageSetItem(RECENT_HISTORY_KEY, JSON.stringify(newHistory));
          return newHistory;
        });
        lastPlayedSongIdRef.current = song.id;
      }
    }
  }, [currentSongIndex, isPlaying, queue]);

  const applyEqToGraph = useCallback(() => {
    const ctx = audioContextRef.current;
    const now = ctx?.currentTime ?? 0;

    eqFiltersRef.current.forEach(({ key, filter }) => {
      const targetGain = settings.eq.enabled ? settings.eq.bands[key] || 0 : 0;
      filter.gain.cancelScheduledValues(now);
      filter.gain.setTargetAtTime(targetGain, now, 0.015);
    });
  }, [settings.eq.bands, settings.eq.enabled]);

  const ensureDspGraph = useCallback((ctx: AudioContext) => {
    if (dspInputRef.current && analyserRef.current) {
      applyEqToGraph();
      return;
    }

    const input = ctx.createGain();
    input.gain.value = 1;
    dspInputRef.current = input;

    let currentNode: AudioNode = input;
    eqFiltersRef.current = EQ_BAND_KEYS.map((key, index) => {
      const filter = ctx.createBiquadFilter();
      filter.type = index === 0 ? 'lowshelf' : index === EQ_BAND_KEYS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = EQ_BAND_FREQUENCIES[key];
      filter.Q.value = index === 0 || index === EQ_BAND_KEYS.length - 1 ? 0.707 : 1.1;
      filter.gain.value = 0;
      currentNode.connect(filter);
      currentNode = filter;
      return { key, filter };
    });

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -1;
    compressor.knee.value = 6;
    compressor.ratio.value = 2;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    currentNode.connect(compressor);
    compressorRef.current = compressor;

    const ana = ctx.createAnalyser();
    ana.fftSize = 2048;
    ana.smoothingTimeConstant = 0.85;
    compressor.connect(ana);
    ana.connect(ctx.destination);

    analyserRef.current = ana;
    setAnalyser(ana);
    applyEqToGraph();
  }, [applyEqToGraph]);

  const ensureRadioPitchNode = useCallback(async (ctx: AudioContext) => {
    if (!('audioWorklet' in ctx)) return null;

    if (!pitchWorkletLoadRef.current) {
      pitchWorkletLoadRef.current = ctx.audioWorklet.addModule('/audio/pitch-shift-processor.js');
    }

    await pitchWorkletLoadRef.current;

    if (!radioPitchShiftNodeRef.current) {
      radioPitchShiftNodeRef.current = new AudioWorkletNode(ctx, 'nebula-pitch-shift', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        parameterData: { semitones: radioPitch },
      });
    }

    radioPitchShiftNodeRef.current.parameters.get('semitones')?.setTargetAtTime(radioPitch, ctx.currentTime, 0.02);
    return radioPitchShiftNodeRef.current;
  }, [radioPitch]);

  useEffect(() => {
    applyEqToGraph();
  }, [applyEqToGraph]);

  // Audio Context Initialization (Lazy)
  const initAudioContext = useCallback(async (target: 'music' | 'crossfade' | 'radio' = 'music') => {
    try {
      let ctx = audioContextRef.current;

      if (!ctx) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioContext();
        audioContextRef.current = ctx;
      }

      ensureDspGraph(ctx);

      if (ctx.state === 'suspended') {
        ctx.resume().catch(e => console.warn("Context resume failed", e));
      }

      const dspInput = dspInputRef.current;
      if (!dspInput) return;

      if (target === 'radio') {
        const radioAudio = radioAudioRef.current;
        if (radioAudio && !radioAudioSourceRef.current) {
          radioAudioSourceRef.current = ctx.createMediaElementSource(radioAudio);
        }

        if (radioAudioSourceRef.current) {
          radioAudioSourceRef.current.disconnect();
          const pitchNode = await ensureRadioPitchNode(ctx);
          if (pitchNode) {
            pitchNode.disconnect();
            radioAudioSourceRef.current.connect(pitchNode);
            pitchNode.connect(dspInput);
          } else {
            radioAudioSourceRef.current.connect(dspInput);
          }
        }
      } else if (target === 'crossfade') {
        const crossfadeAudio = crossfadeAudioRef.current;
        if (crossfadeAudio && !crossfadeAudioSourceRef.current) {
          crossfadeAudioSourceRef.current = ctx.createMediaElementSource(crossfadeAudio);
          crossfadeAudioSourceRef.current.connect(dspInput);
        }
      } else {
        const audio = audioRef.current;
        if (audio && !audioSourceRef.current) {
          audioSourceRef.current = ctx.createMediaElementSource(audio);
          audioSourceRef.current.connect(dspInput);
        }
      }
    } catch (e) { console.warn("Audio Context init error:", e); }
  }, [ensureDspGraph, ensureRadioPitchNode]);

  useEffect(() => {
    const ctx = audioContextRef.current;
    const pitchNode = radioPitchShiftNodeRef.current;
    if (!ctx || !pitchNode) return;
    pitchNode.parameters.get('semitones')?.setTargetAtTime(radioPitch, ctx.currentTime, 0.02);
  }, [radioPitch]);

  const applyPlaybackAttributes = useCallback((audio: HTMLAudioElement) => {
    const { playbackRate, pitch, pitchCorrection } = stateRef.current;
    const pitchMultiplier = Math.pow(2, pitch / 12);
    audio.playbackRate = playbackRate * pitchMultiplier;

    const a = audio as any;
    if (a.preservesPitch !== undefined) a.preservesPitch = pitchCorrection;
    else if (a.mozPreservesPitch !== undefined) a.mozPreservesPitch = pitchCorrection;
    else if (a.webkitPreservesPitch !== undefined) a.webkitPreservesPitch = pitchCorrection;
  }, []);

  const stopCrossfadeAudio = useCallback(() => {
    const nextAudio = crossfadeAudioRef.current;
    if (nextAudio) {
      nextAudio.pause();
      nextAudio.removeAttribute('src');
      delete nextAudio.dataset.nebulaSongId;
      nextAudio.load();
      nextAudio.volume = 0;
    }
  }, []);

  const cancelCrossfade = useCallback(() => {
    if (crossfadeAnimationRef.current !== null) {
      window.cancelAnimationFrame(crossfadeAnimationRef.current);
      crossfadeAnimationRef.current = null;
    }
    isCrossfadingRef.current = false;
    isCrossfadeStartingRef.current = false;
    crossfadeHandoffRef.current = null;
    stopCrossfadeAudio();
    if (audioRef.current) audioRef.current.volume = stateRef.current.volume;
  }, [stopCrossfadeAudio]);

  const getNextPlaybackIndex = useCallback((songIndex: number, songQueue: ISong[], mode: RepeatMode) => {
    if (songQueue.length === 0) return -1;
    if (songIndex < songQueue.length - 1) return songIndex + 1;
    if (mode === 'ALL') return 0;
    return -1;
  }, []);

  const getMagicFadeSeconds = useCallback((duration: number) => {
    if (!Number.isFinite(duration) || duration <= 0) return 3;
    return Math.min(5, Math.max(2.25, duration * 0.025));
  }, []);

  const prepareCrossfadeTrack = useCallback((nextIndex: number) => {
    const nextAudio = crossfadeAudioRef.current;
    const { queue } = stateRef.current;
    const nextSong = queue[nextIndex];

    if (!nextAudio || !nextSong) return;
    if (nextAudio.dataset.nebulaSongId === nextSong.id && nextAudio.src) {
      applyPlaybackAttributes(nextAudio);
      return;
    }

    nextAudio.pause();
    nextAudio.volume = 0;
    nextAudio.src = service.getStreamUrl(nextSong.id, nextSong.suffix);
    nextAudio.dataset.nebulaSongId = nextSong.id;
    nextAudio.dataset.nebulaQueueIndex = nextIndex.toString();
    applyPlaybackAttributes(nextAudio);
    nextAudio.load();
  }, [applyPlaybackAttributes, service]);

  const activatePreparedTrack = useCallback((nextIndex: number) => {
    const nextAudio = crossfadeAudioRef.current;
    const { queue, volume } = stateRef.current;
    const nextSong = queue[nextIndex];

    if (!nextAudio || !nextSong || nextAudio.dataset.nebulaSongId !== nextSong.id || !nextAudio.src) {
      return false;
    }

    if (crossfadeAnimationRef.current !== null) {
      window.cancelAnimationFrame(crossfadeAnimationRef.current);
      crossfadeAnimationRef.current = null;
    }

    isCrossfadeStartingRef.current = false;
    isCrossfadingRef.current = true;
    nextAudio.volume = volume;
    applyPlaybackAttributes(nextAudio);
    initAudioContext('crossfade');

    const commitHandoff = () => {
      crossfadeHandoffRef.current = {
        songId: nextSong.id,
        currentTime: Number.isFinite(nextAudio.currentTime) ? nextAudio.currentTime : 0,
      };
      setCurrentSongIndex(nextIndex);
      setIsPlaying(true);
    };

    if (nextAudio.paused) {
      const playPromise = nextAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          if (e.name !== 'AbortError') console.warn("Prepared track start failed", e);
        });
      }
    }

    commitHandoff();
    return true;
  }, [applyPlaybackAttributes, initAudioContext]);

  const startCrossfade = useCallback((nextIndex: number) => {
    const audio = audioRef.current;
    const nextAudio = crossfadeAudioRef.current;
    const { queue, currentSongIndex, volume, magicCrossfade } = stateRef.current;
    const nextSong = queue[nextIndex];

    if (!audio || !nextAudio || !nextSong || isCrossfadingRef.current || isCrossfadeStartingRef.current || !magicCrossfade) return;

    prepareCrossfadeTrack(nextIndex);
    isCrossfadeStartingRef.current = true;
    const remaining = Math.max(0.5, (audio.duration || 0) - audio.currentTime);
    const fadeMs = Math.min(getMagicFadeSeconds(audio.duration || 0), remaining) * 1000;
    let startedAt = 0;
    const startingVolume = audio.volume;
    nextAudio.volume = 0;
    applyPlaybackAttributes(nextAudio);
    initAudioContext('crossfade');

    const step = (now: number) => {
      if (
        !isCrossfadingRef.current ||
        !stateRef.current.isPlaying ||
        stateRef.current.currentSongIndex !== currentSongIndex
      ) {
        cancelCrossfade();
        return;
      }

      const progress = Math.min(1, (now - startedAt) / fadeMs);
      audio.volume = startingVolume * (1 - progress);
      nextAudio.volume = volume * progress;

      if (progress < 1) {
        crossfadeAnimationRef.current = window.requestAnimationFrame(step);
        return;
      }

      crossfadeAnimationRef.current = null;
      activatePreparedTrack(nextIndex);
    };

    const beginFade = () => {
      if (
        !isCrossfadeStartingRef.current ||
        !stateRef.current.isPlaying ||
        stateRef.current.currentSongIndex !== currentSongIndex
      ) {
        cancelCrossfade();
        return;
      }
      isCrossfadeStartingRef.current = false;
      isCrossfadingRef.current = true;
      startedAt = performance.now();
      crossfadeAnimationRef.current = window.requestAnimationFrame(step);
    };

    const playPromise = nextAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(beginFade)
        .catch(e => {
          if (e.name !== 'AbortError') console.warn("Crossfade start failed", e);
          cancelCrossfade();
        });
    } else {
      beginFade();
    }
  }, [activatePreparedTrack, applyPlaybackAttributes, cancelCrossfade, getMagicFadeSeconds, initAudioContext, prepareCrossfadeTrack]);

  const playInstantMix = useCallback(async () => {
    cancelCrossfade();
    const RECENT_MIX_KEY = 'nebula_instant_mix_recent';

    const shuffle = <T,>(items: T[]) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const uniqueSongs = (songs: ISong[], excludeIds = new Set<string>()) => {
      const seen = new Set<string>();
      return songs.filter(song => {
        if (!song || song.isVideo || seen.has(song.id) || excludeIds.has(song.id)) return false;
        seen.add(song.id);
        return true;
      });
    };

    const sample = <T,>(items: T[], count: number) => shuffle(items).slice(0, Math.min(count, items.length));
    const sampleWeightedByRank = (songs: ISong[], count: number) => {
      const pool = songs.map((song, index) => ({ song, weight: 1 / Math.pow(index + 4, 0.35) }));
      const selected: ISong[] = [];

      while (pool.length > 0 && selected.length < count) {
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        let cursor = Math.random() * totalWeight;
        const index = pool.findIndex(item => {
          cursor -= item.weight;
          return cursor <= 0;
        });
        const [picked] = pool.splice(index >= 0 ? index : pool.length - 1, 1);
        selected.push(picked.song);
      }

      return selected;
    };
    const getRecentMixIds = () => {
      try {
        const raw = localStorage.getItem(RECENT_MIX_KEY);
        const ids = raw ? JSON.parse(raw) : [];
        return new Set<string>(Array.isArray(ids) ? ids : []);
      } catch (e) {
        return new Set<string>();
      }
    };
    const rememberMixIds = (songs: ISong[]) => {
      try {
        const previous = Array.from(getRecentMixIds());
        const next = [...songs.map(song => song.id), ...previous].slice(0, 120);
        localStorage.setItem(RECENT_MIX_KEY, JSON.stringify(next));
      } catch (e) { }
    };

    const seeds = mostPlayed.length > 0 ? mostPlayed.slice(0, 100) : await loadMostPlayedSongs(100);
    if (seeds.length === 0) return [];
    if (mostPlayed.length === 0) setMostPlayed(seeds);

    const recentIds = getRecentMixIds();
    const seedPool = sampleWeightedByRank(shuffle(seeds), Math.min(10, Math.max(4, Math.floor(seeds.length / 6))));
    const similarGroups = await Promise.all(
      seedPool.map(song => service.getSimilarSongs(song.id, 6 + Math.floor(Math.random() * 7)).catch(() => []))
    );

    const genreCounts: Record<string, number> = {};
    seeds.forEach(song => {
      if (song.genre) genreCounts[song.genre] = (genreCounts[song.genre] || 0) + (song.playCount || 1);
    });
    const topGenres = sample(Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a]).slice(0, 6), 2);
    const genreGroups = await Promise.all(
      topGenres.map(genre => service.getRandomSongs(10 + Math.floor(Math.random() * 11), { genre }).catch(() => []))
    );
    const serverRandom = await service.getRandomSongs(25).catch(() => []);
    const playedSample = sampleWeightedByRank(seeds, 12);

    let mix = uniqueSongs([
      ...shuffle(playedSample),
      ...shuffle(similarGroups.flat()),
      ...shuffle(genreGroups.flat()),
      ...shuffle(homeData.recommendedTracks),
      ...shuffle(homeData.randomSongs),
      ...serverRandom,
    ], recentIds).slice(0, 50);

    if (mix.length < 20) {
      mix = uniqueSongs([
        ...mix,
        ...shuffle(playedSample),
        ...shuffle(similarGroups.flat()),
        ...shuffle(genreGroups.flat()),
        ...serverRandom,
      ]).slice(0, 50);
    }

    if (mix.length < 20) {
      const fallback = await service.getRandomSongs(50 - mix.length);
      mix = uniqueSongs([...mix, ...fallback]).slice(0, 50);
    }

    mix = shuffle(mix);
    rememberMixIds(mix);
    setQueue(mix);
    setCurrentSongIndex(0);
    setIsPlaying(mix.length > 0);
    return mix;
  }, [cancelCrossfade, homeData.randomSongs, homeData.recommendedTracks, loadMostPlayedSongs, mostPlayed, service]);

  // Scrobbling Logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !queue[currentSongIndex]) return;

    let hasScrobbled = false;
    let lastReportedTime = 0;

    const handleTimeUpdate = () => {
      const current = audio.currentTime;
      const duration = audio.duration;

      // Report Now Playing every 30 seconds or on start (if needed, but usually once per track is enough for some servers, 
      // though Subsonic often likes periodic updates. optimizing for once per track start for now)

      // Scrobble at 50% or 4 minutes, whichever is sooner
      if (!hasScrobbled && duration > 30) {
        const threshold = Math.min(duration / 2, 240);
        if (current >= threshold) {
          service.scrobble(queue[currentSongIndex].id, true);
          hasScrobbled = true;
        }
      }
    };

    const handlePlay = () => {
      service.reportNowPlaying(queue[currentSongIndex].id);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
    };
  }, [currentSongIndex, queue, service]);

  useEffect(() => {
    // When song changes, reset state is handled by the effect above re-running
  }, [currentSongIndex]);

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const clearEndAdvanceTimer = () => {
      if (endAdvanceTimerRef.current !== null) {
        window.clearTimeout(endAdvanceTimerRef.current);
        endAdvanceTimerRef.current = null;
      }
    };

    const getExpectedDuration = () => {
      const { queue, currentSongIndex } = stateRef.current;
      const songDuration = queue[currentSongIndex]?.duration;
      const catalogDuration = Number.isFinite(songDuration) && songDuration > 0 ? songDuration : 0;
      const mediaDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;

      if (catalogDuration && mediaDuration) {
        return Math.abs(catalogDuration - mediaDuration) <= 8
          ? Math.max(catalogDuration, mediaDuration)
          : Math.min(catalogDuration, mediaDuration);
      }

      return mediaDuration || catalogDuration;
    };

    const isNearTrackEnd = () => {
      const duration = getExpectedDuration();
      if (!duration || audio.currentTime <= 0) return false;
      const endWindow = Math.max(4, getMagicFadeSeconds(duration) + 1);
      return duration - audio.currentTime <= endWindow;
    };

    const rememberProgress = () => {
      const songId = stateRef.current.queue[stateRef.current.currentSongIndex]?.id ?? null;
      const now = performance.now();
      const previous = playbackProgressRef.current;

      if (previous.songId !== songId || Math.abs(audio.currentTime - previous.time) > 0.25) {
        playbackProgressRef.current = { songId, time: audio.currentTime, changedAt: now };
      }
    };

    const advanceAfterTrackEnd = (reason: string) => {
      clearEndAdvanceTimer();
      const { repeatMode, queue, currentSongIndex } = stateRef.current;

      if (repeatMode === 'ONE') {
        if (isCrossfadeStartingRef.current || isCrossfadingRef.current) cancelCrossfade();
        audio.currentTime = 0;
        audio.play().catch(e => console.warn("Loop play failed", e));
        return;
      }

      if (queue.length === 0) return;
      const nextIndex = getNextPlaybackIndex(currentSongIndex, queue, repeatMode);
      if (nextIndex >= 0) {
        if (activatePreparedTrack(nextIndex)) return;
        if (isCrossfadeStartingRef.current || isCrossfadingRef.current) cancelCrossfade();
        if (reason !== 'ended') console.warn(`Advancing after ${reason} near track end.`);
        setCurrentSongIndex(nextIndex);
        setIsPlaying(true);
      } else {
        if (isCrossfadeStartingRef.current || isCrossfadingRef.current) cancelCrossfade();
        setIsPlaying(false);
        setCurrentSongIndex(0);
      }
    };

    const scheduleEndAdvanceCheck = (reason: string, delay = 2500) => {
      const { isPlaying, repeatMode, queue, currentSongIndex } = stateRef.current;
      const songId = queue[currentSongIndex]?.id;
      if (!isPlaying || repeatMode === 'ONE' || !songId || !isNearTrackEnd() || endAdvanceTimerRef.current !== null) return;

      endAdvanceTimerRef.current = window.setTimeout(() => {
        endAdvanceTimerRef.current = null;

        const latest = stateRef.current;
        if (!latest.isPlaying || latest.repeatMode === 'ONE' || latest.queue[latest.currentSongIndex]?.id !== songId) return;
        if (!isNearTrackEnd()) return;

        const duration = getExpectedDuration();
        const remaining = duration ? duration - audio.currentTime : Number.POSITIVE_INFINITY;
        const stalledFor = performance.now() - playbackProgressRef.current.changedAt;
        const hasStoppedProgressing = audio.ended || audio.paused || audio.readyState < 3 || stalledFor >= 2200;

        if (remaining <= Math.max(2.5, getMagicFadeSeconds(duration)) && hasStoppedProgressing) {
          advanceAfterTrackEnd(reason);
        } else if (isNearTrackEnd()) {
          scheduleEndAdvanceCheck(reason, 1500);
        }
      }, delay);
    };

    const handleTimeUpdate = () => {
      const { queue, currentSongIndex, isPlaying, repeatMode, magicCrossfade } = stateRef.current;
      const cTime = audio.currentTime;
      const dur = audio.duration || 0;
      rememberProgress();

      if ('mediaSession' in navigator && !isNaN(dur) && dur > 0) {
        try {
          navigator.mediaSession.setPositionState({ duration: dur, playbackRate: audio.playbackRate, position: cTime });
        } catch (e) { }
      }

      if (isPlaying && dur > 0 && cTime > 0 && !hasScrobbledRef.current && queue[currentSongIndex]) {
        if (cTime > 30 || cTime > dur / 2) {
          service.scrobble(queue[currentSongIndex].id);
          hasScrobbledRef.current = true;
        }
      }

      if (
        isPlaying &&
        magicCrossfade &&
        repeatMode !== 'ONE' &&
        Number.isFinite(dur) &&
        dur > 3 &&
        dur - cTime <= getMagicFadeSeconds(dur) &&
        cTime > 0
      ) {
        const nextIndex = getNextPlaybackIndex(currentSongIndex, queue, repeatMode);
        if (nextIndex >= 0) startCrossfade(nextIndex);
      }

      scheduleEndAdvanceCheck('stalled stream');
    };

    const onEnded = () => {
      advanceAfterTrackEnd('ended');
    };

    const onError = (e: any) => {
      console.error("Playback Error Detected:", audio.error);
      if (audio.error?.code === 4) {
        console.warn("Media resource not suitable. Likely codec mismatch or CORS block on the stream.");
      }
      if (stateRef.current.isPlaying) {
        scheduleEndAdvanceCheck('playback error', 800);
      }
    };

    const onPlayEvent = () => {
      rememberProgress();
      initAudioContext();
    };

    const onLoadingTrouble = () => {
      scheduleEndAdvanceCheck('stalled stream', 1200);
    };

    const onRecovered = () => {
      rememberProgress();
      if (!isNearTrackEnd()) clearEndAdvanceTimer();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlayEvent);
    audio.addEventListener('playing', onRecovered);
    audio.addEventListener('canplay', onRecovered);
    audio.addEventListener('loadedmetadata', onRecovered);
    audio.addEventListener('seeked', onRecovered);
    audio.addEventListener('waiting', onLoadingTrouble);
    audio.addEventListener('stalled', onLoadingTrouble);
    audio.addEventListener('suspend', onLoadingTrouble);

    return () => {
      clearEndAdvanceTimer();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('play', onPlayEvent);
      audio.removeEventListener('playing', onRecovered);
      audio.removeEventListener('canplay', onRecovered);
      audio.removeEventListener('loadedmetadata', onRecovered);
      audio.removeEventListener('seeked', onRecovered);
      audio.removeEventListener('waiting', onLoadingTrouble);
      audio.removeEventListener('stalled', onLoadingTrouble);
      audio.removeEventListener('suspend', onLoadingTrouble);
    };
  }, [activatePreparedTrack, cancelCrossfade, getMagicFadeSeconds, getNextPlaybackIndex, initAudioContext, startCrossfade]);

  useEffect(() => {
    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r} ${g} ${b}`;
    };
    document.documentElement.style.setProperty('--color-primary', hexToRgb(settings.theme.primaryColor));
    document.documentElement.style.setProperty('--color-secondary', hexToRgb(settings.theme.secondaryColor));
  }, [settings.theme]);

  const setPitch = useCallback((val: number) => {
    setPitchState(val);
  }, []);

  const setRadioPitch = useCallback((val: number) => {
    setRadioPitchState(Math.max(-12, Math.min(12, val)));
  }, []);

  // Apply pitch shifting via playbackRate
  useEffect(() => {
    if (audioRef.current) applyPlaybackAttributes(audioRef.current);
    if (crossfadeAudioRef.current) applyPlaybackAttributes(crossfadeAudioRef.current);
  }, [pitch, playbackRate, applyPlaybackAttributes]);

  // Ensure volume and pitch preservation are synced
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !isCrossfadingRef.current) audio.volume = volume;
    if (audio) applyPlaybackAttributes(audio);
    if (crossfadeAudioRef.current) applyPlaybackAttributes(crossfadeAudioRef.current);
    if (radioAudioRef.current) {
      radioAudioRef.current.volume = volume;
    }
  }, [volume, pitchCorrection, applyPlaybackAttributes]);

  useEffect(() => {
    const audio = radioAudioRef.current;
    if (!audio) return;
    let cancelled = false;

    const destroyRadioHls = () => {
      radioHlsRef.current?.destroy();
      radioHlsRef.current = null;
    };

    const syncRadioPlayback = async () => {
      if (!currentRadioStation) {
        destroyRadioHls();
        audio.pause();
        audio.removeAttribute('src');
        delete audio.dataset.nebulaRadioUrl;
        audio.load();
        return;
      }

      const streamUrl = currentRadioStation.streamUrl;
      const isHls = isHlsStreamUrl(streamUrl);

      if (isHls) {
        const canPlayNativeHls = audio.canPlayType('application/vnd.apple.mpegurl') || audio.canPlayType('application/x-mpegURL');

        if (canPlayNativeHls) {
          destroyRadioHls();
          if (audio.src !== streamUrl) {
            audio.src = streamUrl;
            audio.load();
          }
        } else {
          const { default: Hls } = await import('hls.js');
          if (cancelled) return;

          if (!Hls.isSupported()) {
            console.warn('This browser does not support HLS radio streams.');
            setIsRadioPlaying(false);
            return;
          }

          if (!radioHlsRef.current || audio.dataset.nebulaRadioUrl !== streamUrl) {
            destroyRadioHls();
            audio.pause();
            audio.removeAttribute('src');
            audio.load();

            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 30,
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
              console.warn('HLS radio stream error', data);
              if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                else {
                  destroyRadioHls();
                  setIsRadioPlaying(false);
                }
              }
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(audio);
            radioHlsRef.current = hls;
            audio.dataset.nebulaRadioUrl = streamUrl;
          }
        }
      } else {
        destroyRadioHls();
        if (audio.src !== streamUrl) {
          audio.src = streamUrl;
          audio.load();
        }
        audio.dataset.nebulaRadioUrl = streamUrl;
      }

      audio.volume = volume;
      audio.playbackRate = 1;
      if (isRadioPlaying) {
        initAudioContext('radio');
        audio.play().catch(e => {
          if (e.name !== 'AbortError') console.warn("Radio play failed", e);
          audio.pause();
          audio.load();
          setIsRadioPlaying(false);
        });
      } else {
        audio.pause();
      }
    };

    syncRadioPlayback();

    return () => {
      cancelled = true;
    };
  }, [currentRadioStation, initAudioContext, isRadioPlaying, volume]);

  useEffect(() => {
    if (!currentRadioStation) {
      setRadioMetadata(null);
      setIsRadioMetadataLoading(false);
      return;
    }

    if (isHlsStreamUrl(currentRadioStation.streamUrl)) {
      setRadioMetadata(null);
      setIsRadioMetadataLoading(false);
      return;
    }

    if (!isRadioPlaying) {
      setIsRadioMetadataLoading(false);
      return;
    }

    let cancelled = false;
    let activeController: AbortController | null = null;
    setRadioMetadata(null);

    const readStreamMetadata = async () => {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);
      setIsRadioMetadataLoading(true);

      try {
        const response = await fetch(currentRadioStation.streamUrl, {
          headers: { 'Icy-MetaData': '1' },
          cache: 'no-store',
          signal: controller.signal,
        });

        const metaInterval = Number(response.headers.get('icy-metaint'));
        if (!response.body || !Number.isFinite(metaInterval) || metaInterval <= 0) {
          if (!cancelled) setIsRadioMetadataLoading(false);
          return;
        }

        const reader = response.body.getReader();
        let audioBytesRemaining = metaInterval;
        let metadataBytesRemaining = 0;
        let metadataBytes: number[] = [];
        let hasMetadataLengthByte = false;

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done || !value) break;

          let offset = 0;
          while (!cancelled && offset < value.length) {
            if (audioBytesRemaining > 0) {
              const skipped = Math.min(audioBytesRemaining, value.length - offset);
              audioBytesRemaining -= skipped;
              offset += skipped;
              continue;
            }

            if (!hasMetadataLengthByte) {
              metadataBytesRemaining = value[offset] * 16;
              hasMetadataLengthByte = true;
              offset += 1;

              if (metadataBytesRemaining === 0) {
                audioBytesRemaining = metaInterval;
                hasMetadataLengthByte = false;
              }
              continue;
            }

            const take = Math.min(metadataBytesRemaining, value.length - offset);
            metadataBytes.push(...value.slice(offset, offset + take));
            metadataBytesRemaining -= take;
            offset += take;

            if (metadataBytesRemaining === 0) {
              const parsed = parseIcyMetadata(new Uint8Array(metadataBytes));
              metadataBytes = [];
              audioBytesRemaining = metaInterval;
              hasMetadataLengthByte = false;

              if (parsed) {
                const nextMetadata: IRadioMetadata = { ...parsed, updatedAt: Date.now() };
                if (!cancelled) setRadioMetadata(nextMetadata);

                await reader.cancel().catch(() => undefined);
                const artworkUrl = await fetchRadioArtwork(nextMetadata, controller.signal);
                if (!cancelled) {
                  setRadioMetadata(prev => prev ? { ...prev, artworkUrl } : { ...nextMetadata, artworkUrl });
                }
                return;
              }
            }
          }
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') console.warn('Radio metadata unavailable', error);
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setIsRadioMetadataLoading(false);
      }
    };

    readStreamMetadata();
    const intervalId = window.setInterval(readStreamMetadata, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      activeController?.abort();
    };
  }, [currentRadioStation, isRadioPlaying]);

  useEffect(() => {
    const audio = radioAudioRef.current;
    if (!audio) return;

    const onEnded = () => setIsRadioPlaying(false);
    const onError = () => {
      console.warn("Internet radio stream error", audio.error);
      setIsRadioPlaying(false);
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    if (!settings.magicCrossfade && (isCrossfadingRef.current || isCrossfadeStartingRef.current)) cancelCrossfade();
  }, [cancelCrossfade, settings.magicCrossfade]);

  useEffect(() => {
    if (!isPlaying) cancelCrossfade();
  }, [cancelCrossfade, isPlaying]);

  useEffect(() => {
    if (isCrossfadingRef.current || isCrossfadeStartingRef.current) return;

    if (!isPlaying || repeatMode === 'ONE') {
      stopCrossfadeAudio();
      return;
    }

    const nextIndex = getNextPlaybackIndex(currentSongIndex, queue, repeatMode);
    if (nextIndex >= 0) prepareCrossfadeTrack(nextIndex);
    else stopCrossfadeAudio();
  }, [currentSongIndex, getNextPlaybackIndex, isPlaying, prepareCrossfadeTrack, queue, repeatMode, stopCrossfadeAudio]);

  // Handle Playback State
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const song = queue[currentSongIndex];

    if (song) {
      const url = service.getStreamUrl(song.id, song.suffix);

      if (audio.src !== url) {
        const handoff = crossfadeHandoffRef.current?.songId === song.id
          ? crossfadeHandoffRef.current
          : null;

        audio.src = url;
        audio.volume = volume;
        audio.load();

        applyPlaybackAttributes(audio);

        if (isPlaying) {
          const finishCrossfadeHandoff = () => {
            stopCrossfadeAudio();
            crossfadeHandoffRef.current = null;
            isCrossfadingRef.current = false;

            const nextIndex = getNextPlaybackIndex(currentSongIndex, stateRef.current.queue, stateRef.current.repeatMode);
            if (stateRef.current.isPlaying && nextIndex >= 0) {
              prepareCrossfadeTrack(nextIndex);
            }
          };

          const startPlayback = () => {
            if (handoff && Number.isFinite(handoff.currentTime)) {
              try {
                const handoffAudio = crossfadeAudioRef.current;
                const liveHandoffTime = handoffAudio?.dataset.nebulaSongId === song.id && !handoffAudio.paused
                  ? handoffAudio.currentTime
                  : handoff.currentTime;
                if (Number.isFinite(liveHandoffTime) && liveHandoffTime > 0) audio.currentTime = liveHandoffTime;
              } catch (e) { }
            }

            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  if (handoff) {
                    window.setTimeout(finishCrossfadeHandoff, 180);
                  }
                })
                .catch(e => {
                  if (e.name !== 'AbortError') console.warn("Play failed", e);
                });
            } else if (handoff) {
              window.setTimeout(finishCrossfadeHandoff, 180);
            }
            initAudioContext(); // Ensure context is ready
          };

          if (handoff && audio.readyState < 1) {
            audio.addEventListener('loadedmetadata', startPlayback, { once: true });
          } else {
            startPlayback();
          }
        }
      } else {
        if (isPlaying && audio.paused) {
          audio.play().then(() => initAudioContext()).catch(e => console.warn("Resume failed", e));
        } else if (!isPlaying && !audio.paused) {
          audio.pause();
        }
      }
    } else {
      cancelCrossfade();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, [applyPlaybackAttributes, cancelCrossfade, currentSongIndex, getNextPlaybackIndex, initAudioContext, isPlaying, pitch, pitchCorrection, playbackRate, prepareCrossfadeTrack, queue, service, stopCrossfadeAudio, volume]);

  const playSong = (song: ISong, contextQueue?: ISong[]) => {
    cancelCrossfade();
    if (radioAudioRef.current) radioAudioRef.current.pause();
    setIsRadioPlaying(false);
    setCurrentRadioStation(null);
    if (contextQueue) {
      setQueue(contextQueue);
      const idx = contextQueue.findIndex(s => s.id === song.id);
      setCurrentSongIndex(idx);
    } else {
      setQueue([song]);
      setCurrentSongIndex(0);
    }
    setIsPlaying(true);
    // Audio context will be init by useEffect or onPlayEvent
  };

  const togglePlay = () => {
    if (currentRadioStation) {
      setIsRadioPlaying(!isRadioPlaying);
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const nextSong = () => {
    cancelCrossfade();
    if (queue.length === 0) return;
    if (currentSongIndex < queue.length - 1) {
      setCurrentSongIndex(currentSongIndex + 1);
      setIsPlaying(true);
    } else {
      if (repeatMode === 'ALL') {
        setCurrentSongIndex(0);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
        setCurrentSongIndex(0);
      }
    }
  };

  const prevSong = () => {
    cancelCrossfade();
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (currentSongIndex > 0) {
      setCurrentSongIndex(currentSongIndex - 1);
      setIsPlaying(true);
    }
  };

  // Media Session Updates
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (currentSongIndex >= 0 && queue[currentSongIndex]) {
      const song = queue[currentSongIndex];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album,
        artwork: [
          { src: service.getCoverArtUrl(song.id, 96),  sizes: '96x96',   type: 'image/jpeg' },
          { src: service.getCoverArtUrl(song.id, 128), sizes: '128x128', type: 'image/jpeg' },
          { src: service.getCoverArtUrl(song.id, 256), sizes: '256x256', type: 'image/jpeg' },
          { src: service.getCoverArtUrl(song.id, 512), sizes: '512x512', type: 'image/jpeg' },
        ]
      });
    } else { navigator.mediaSession.metadata = null; }

    navigator.mediaSession.setActionHandler('play', () => { setIsPlaying(true); initAudioContext(); });
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', prevSong);
    navigator.mediaSession.setActionHandler('nexttrack', () => nextSong());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) audioRef.current.currentTime = details.seekTime;
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset ?? 10));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (audioRef.current) audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + (details.seekOffset ?? 10));
    });
  }, [currentSongIndex, queue, service, isPlaying, initAudioContext]);

  useEffect(() => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  };

  const toggleLike = (song: ISong) => {
    const newStatus = !song.starred;
    const updateList = (list: ISong[]) => list.map(s => s.id === song.id ? { ...s, starred: newStatus } : s);
    setQueue(prev => updateList(prev));
    service.toggleStar(song.id, newStatus);
  };

  const addToQueue = (song: ISong) => { setQueue(prev => [...prev, song]); };
  const setView = useCallback((v: View, data?: any, options?: { replace?: boolean; clearHistory?: boolean }) => {
    const sameTarget = currentView === v && viewData === data;
    if (sameTarget) return;

    if (options?.clearHistory) {
      navigationStackRef.current = [];
      setNavigationStack([]);
    } else if (!options?.replace) {
      const nextStack = [...navigationStackRef.current, { view: currentView, data: viewData }].slice(-50);
      navigationStackRef.current = nextStack;
      setNavigationStack(nextStack);
    }

    setCurrentView(v);
    setViewData(data);
  }, [currentView, viewData]);
  const goBack = useCallback((fallbackView: View = 'HOME', fallbackData?: any) => {
    const stack = navigationStackRef.current;

    if (stack.length === 0) {
      setCurrentView(fallbackView);
      setViewData(fallbackData);
      return;
    }

    const target = stack[stack.length - 1];
    const nextStack = stack.slice(0, -1);
    navigationStackRef.current = nextStack;
    setNavigationStack(nextStack);
    setCurrentView(target.view);
    setViewData(target.data);
  }, []);
  const performSearch = async (query: string) => {
    setLastSearchQuery(query); setIsSearching(true);
    const results = await service.search(query);
    setSearchResults(results); setIsSearching(false);
    setView('SEARCH');
  };
  const openSearchModal = () => setIsSearchModalOpen(true);
  const closeSearchModal = () => setIsSearchModalOpen(false);
  const canGoBack = navigationStack.length > 0;
  const backTarget = canGoBack ? navigationStack[navigationStack.length - 1] : undefined;

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      // Deep merge for EQ to prevent overwriting bands with partial updates
      let updatedEQ = prev.eq;
      if (newSettings.eq) {
        updatedEQ = {
          ...prev.eq,
          ...newSettings.eq,
          bands: {
            ...prev.eq.bands,
            ...(newSettings.eq.bands || {})
          }
        };
      }

      const updated = {
        ...prev,
        ...newSettings,
        theme: { ...prev.theme, ...(newSettings.theme || {}) },
        sidebar: { ...prev.sidebar, ...(newSettings.sidebar || {}) },
        shortcuts: { ...prev.shortcuts, ...(newSettings.shortcuts || {}) },
        eq: updatedEQ
      };

      // Removed db.set from here to prevent blocking rendering during drag
      return updated;
    });
  };

  // Debounced persistence for settings
  useEffect(() => {
    if (!isInitialized) return;
    const handler = setTimeout(() => {
      db.set('settings', 'user_settings', settings);
    }, 1000);
    return () => clearTimeout(handler);
  }, [settings, isInitialized]);


  const connectToSubsonic = async (url: string, user: string, pass: string) => {
    const { token, salt } = SubsonicService.hashPassword(pass);
    const creds: SubsonicCredentials = { serverUrl: url, username: user, token, salt };
    service.setCredentials(creds);
    const success = await service.getPing();
    if (success) {
      setCredentialsState(creds);
      setIsDemoMode(false);
      // Clear any demo mode data to prevent mixing
      setQueue([]);
      setCurrentSongIndex(-1);
      setIsPlaying(false);
      setCurrentRadioStation(null);
      setIsRadioPlaying(false);
      setHomeData({ randomSongs: [], recentAlbums: [], newestAlbums: [], exploreAlbums: [], recommendedTracks: [], lastFetched: 0 });
      setCachedArtists([]);
      setMostPlayed([]);
      // Fetch real playlists from server
      db.saveCredentials(creds);
      service.getPlaylists().then(setPlaylists);
      fetchArtists(true);
      return true;
    }
    else { service.setCredentials(null as any); return false; }
  };

  const disconnect = async () => {
    cancelCrossfade();
    service.setCredentials(null as any); setCredentialsState(null);
    await db.clear('settings'); await db.clear('api_cache');
    setQueue([]); setPlaylists([]); setCurrentSongIndex(-1); setIsPlaying(false); setIsDemoMode(false);
    setCurrentRadioStation(null); setIsRadioPlaying(false);
    navigationStackRef.current = [];
    setNavigationStack([]);
    setCurrentView('HOME');
    setViewData(undefined);
    setHomeData({ randomSongs: [], recentAlbums: [], newestAlbums: [], exploreAlbums: [], recommendedTracks: [], lastFetched: 0 });
    setCachedArtists([]);
    setMostPlayed([]);
  };

  const enableDemoMode = () => { setIsDemoMode(true); setPlaylists(MOCK_PLAYLISTS); };
  const openPlaylistModal = (song: ISong) => { setSongToAddToPlaylist(song); setModalOpen(true); };
  const closePlaylistModal = () => { setModalOpen(false); setSongToAddToPlaylist(null); };

  const createPlaylist = (name: string) => {
    const newPl: IPlaylist = { id: `local-${Date.now()}`, name, songCount: 0, duration: 0, created: new Date().toISOString(), songs: [] };
    setPlaylists(prev => [...prev, newPl]);
  };
  const savePlaylist = (playlist: IPlaylist) => {
    const newPl: IPlaylist = { ...playlist, id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`, created: new Date().toISOString() };
    setPlaylists(prev => [...prev, newPl]);
  };
  const deletePlaylist = (id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (currentView === 'PLAYLIST_DETAIL' && viewData === id) setView('PLAYLISTS');
  };


  // Debug Helper
  const debugIncrementStats = async () => {
    if (!currentSong) return;
    let creds = credentials || service.getCredentials();
    if (creds) {
      const normalizedUrl = creds.serverUrl.replace(/\/$/, '');
      const serverId = `${normalizedUrl}:${creds.username}`;
      console.warn('MANUAL STATS INCREMENT:', { serverId, song: currentSong.title, id: currentSong.id });
      await db.incrementPlayCount(currentSong, serverId);
      await refreshMostPlayed();
    } else {
      console.error('Manual Increment Failed: No Credentials');
    }
  };

  useEffect(() => {
    refreshMostPlayed();
  }, [credentials, refreshMostPlayed]);

  // Reset scrobble status when song changes
  useEffect(() => {
    hasScrobbledRef.current = false;
  }, [currentSong?.id]);

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!audio) return;
      const progress = (audio.currentTime / audio.duration) * 100;
      const durationErr = 4 * 60; // 4 minutes

      if ('mediaSession' in navigator && audio.duration && !isNaN(audio.duration)) {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: audio.currentTime,
        });
      }

      // Report now playing if not already done
      if (currentSong && isPlaying && !hasScrobbledRef.current) {
        // Optionally report "Now Playing" status to server repeatedly or once
      }

      // Scrobble at 50% or 4 minutes
      if (currentSong && !hasScrobbledRef.current) {
        const timeScrobble = audio.currentTime > durationErr;
        const percentScrobble = progress > 50;

        if (timeScrobble || percentScrobble) {
          console.warn(`Scrobbling and updating stats for: ${currentSong.title}`);
          hasScrobbledRef.current = true;

          service.scrobble(currentSong.id, true);

          let creds = credentials;
          if (!creds && service.getCredentials()) {
            creds = service.getCredentials();
            setCredentialsState(creds);
          }

          if (creds) {
            const normalizedUrl = creds.serverUrl.replace(/\/$/, '');
            const serverId = `${normalizedUrl}:${creds.username}`;

            db.incrementPlayCount(currentSong, serverId).then(() => {
              refreshMostPlayed();
            }).catch(err => console.error('DB Increment Failed:', err));
          } else {
            console.error('CRITICAL: No credentials found for local stats.');
          }
        }
      }
    };

    // Reset scrobble flag on play (new song logic is handled in playSong)
    // Actually, playSong handles resetting hasScrobbledRef.

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentSong?.id, isPlaying, credentials]); // DEPENDENCY ARRAY CHANGED: Added currentSong?.id instead of currentSong object to avoid deep equality issues

  const addSongToPlaylist = (playlistId: string, song: ISong) => {
    setPlaylists(playlists.map(pl => {
      if (pl.id === playlistId) {
        const currentSongs = pl.songs || [];
        return { ...pl, songCount: currentSongs.length + 1, duration: pl.duration + song.duration, songs: [...currentSongs, song], coverArt: currentSongs.length === 0 ? song.coverArt : pl.coverArt };
      }
      return pl;
    }));
  };

  useEffect(() => {
    if (!isInitialized) return;
    safeLocalStorageSetItem(RADIO_STATIONS_KEY, JSON.stringify(radioStations));
  }, [radioStations, isInitialized]);

  const playRadioStation = (station: IRadioStation) => {
    cancelCrossfade();
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    setCurrentRadioStation({ ...station, lastPlayed: new Date().toISOString() });
    setIsRadioPlaying(true);
    setRadioStations(prev => prev.map(s => s.id === station.id ? { ...s, lastPlayed: new Date().toISOString() } : s));
  };

  const toggleRadioPlay = () => {
    if (!currentRadioStation) return;
    setIsRadioPlaying(prev => !prev);
  };

  const stopRadio = () => {
    setIsRadioPlaying(false);
    setCurrentRadioStation(null);
  };

  const addRadioStation = (station: Omit<IRadioStation, 'id' | 'created'>) => {
    const newStation: IRadioStation = {
      ...station,
      id: `radio-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      created: new Date().toISOString(),
    };
    setRadioStations(prev => [newStation, ...prev]);
  };

  const updateRadioStation = (station: IRadioStation) => {
    setRadioStations(prev => prev.map(s => s.id === station.id ? station : s));
    setCurrentRadioStation(prev => prev?.id === station.id ? station : prev);
  };

  const deleteRadioStation = (id: string) => {
    setRadioStations(prev => prev.filter(s => s.id !== id));
    if (currentRadioStation?.id === id) stopRadio();
  };

  const reorderPlaylist = (playlistId: string, fromIndex: number, toIndex: number) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id === playlistId && pl.songs) {
        const newSongs = [...pl.songs]; const [movedSong] = newSongs.splice(fromIndex, 1); newSongs.splice(toIndex, 0, movedSong); return { ...pl, songs: newSongs };
      }
      return pl;
    }));
  };

  return (
    <StoreContext.Provider value={{
      currentView, setView, goBack, canGoBack, backTarget, viewData, queue, currentSongIndex, isPlaying, radioStations, currentRadioStation, isRadioPlaying, radioMetadata, isRadioMetadataLoading, radioPitch, volume, playbackRate, pitch, pitchCorrection, visualizerMode, repeatMode,
      credentials, isDemoMode, isInitialized, settings, playlists, modalOpen, songToAddToPlaylist,
      playSong, playRadioStation, toggleRadioPlay, stopRadio, setRadioPitch, togglePlay, nextSong, prevSong, setVolume, setPlaybackRate, setPitch, setPitchCorrection, setVisualizerMode, toggleRepeat, toggleLike,
      connectToSubsonic, disconnect, enableDemoMode, addToQueue, updateSettings,
      openPlaylistModal, closePlaylistModal, createPlaylist, savePlaylist, addSongToPlaylist, deletePlaylist, reorderPlaylist, addRadioStation, updateRadioStation, deleteRadioStation,
      performSearch, searchResults, isSearching, lastSearchQuery, isSearchModalOpen, openSearchModal, closeSearchModal,
      getMostPlayedSongs: () => mostPlayed, refreshMostPlayed, playInstantMix, history: [], service, audioRef, radioAudioRef, analyser, isZenMode, setZenMode,
      homeData, cachedArtists, refreshHomeData, refreshQuickPicks, refreshDiscovery, fetchArtists
    }}>
      {children}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="auto"
      />
      <audio
        ref={crossfadeAudioRef}
        crossOrigin="anonymous"
        preload="auto"
      />
      <audio
        ref={radioAudioRef}
        crossOrigin="anonymous"
        preload="none"
      />
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
