
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, ISong, View, SubsonicCredentials, AppSettings, IPlaylist, VisualizerMode, RepeatMode, IArtist, IAlbum, HomeData, NavigationTarget } from '../types';
import { SubsonicService } from '../services/subsonicService';
import { MOCK_PLAYLISTS } from '../constants';
import { db } from '../services/db';

interface StoreContextType extends AppState {
  setView: (view: View, data?: any, options?: { replace?: boolean; clearHistory?: boolean }) => void;
  goBack: (fallbackView?: View, fallbackData?: any) => void;
  canGoBack: boolean;
  backTarget?: NavigationTarget;
  playSong: (song: ISong, contextQueue?: ISong[]) => void;
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

  // Search
  performSearch: (query: string) => void;
  isSearchModalOpen: boolean;
  openSearchModal: () => void;
  closeSearchModal: () => void;

  // Stats & History
  getMostPlayedSongs: () => ISong[];
  refreshMostPlayed: () => Promise<void>;
  history: ISong[];

  service: SubsonicService;
  audioRef: React.RefObject<HTMLAudioElement>;
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
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const navigationStackRef = useRef<NavigationTarget[]>([]);

  // Use refs for state accessed inside event listeners to avoid constant re-binding
  const stateRef = useRef({ queue, currentSongIndex, isPlaying, repeatMode });

  const currentSong = queue[currentSongIndex];

  useEffect(() => {
    stateRef.current = { queue, currentSongIndex, isPlaying, repeatMode };
  }, [queue, currentSongIndex, isPlaying, repeatMode]);

  useEffect(() => {
    navigationStackRef.current = navigationStack;
  }, [navigationStack]);

  const getMostPlayedSongs = useCallback(() => {
    const historyItems = Object.values(playHistory) as { count: number, song: ISong }[];
    const sorted = historyItems.sort((a, b) => b.count - a.count);
    return sorted.map(item => item.song);
  }, [playHistory]);

  const refreshQuickPicks = useCallback(async () => {
    const random = await service.getRandomSongs(20);
    setHomeData(prev => ({ ...prev, randomSongs: random }));
  }, [service]);

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
        localStorage.setItem('nebula_explore_date', today);
        localStorage.setItem('nebula_explore_data', JSON.stringify(results));
      }
      return results;
    };

    const loadRecommended = async () => {
      const topSongs = getMostPlayedSongs();
      let topGenre = '';
      if (topSongs.length > 0) {
        const genreCounts: Record<string, number> = {};
        topSongs.forEach(s => {
          if (s.genre) genreCounts[s.genre] = (genreCounts[s.genre] || 0) + 1;
        });
        topGenre = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a])[0];
      }
      return await service.getRandomSongs(50, topGenre ? { genre: topGenre } : {});
    };

    const [random, recent, newest, explore, recs] = await Promise.all([
      service.getRandomSongs(20),
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

  const refreshMostPlayed = useCallback(async () => {
    if (!service.getCredentials() && !credentials) return;
    try {
      // FULL LIBRARY SCAN for Most Played (Top 50)
      // This is network intensive but requested by user for accuracy.
      const BATCH_SIZE = 500;
      let offset = 0;
      let allSongs: ISong[] = [];
      let fetched = 0;

      // Fetch all songs in batches
      do {
        const batch = await service.searchSongs('', BATCH_SIZE, offset);
        fetched = batch.length;

        // Optimization: Only keep songs with play counts during accumulation to save memory?
        // Actually, we need to scan everything to find them.
        const playedSongs = batch.filter(s => (s.playCount || 0) > 0);
        allSongs = [...allSongs, ...playedSongs];

        offset += BATCH_SIZE;

        // Safety break for massive libraries (e.g. > 20k processed) to avoid freezing UI
        // Check if we retrieved fewer than batch size, meaning end of list
      } while (fetched === BATCH_SIZE && offset < 20000);

      // Sort by play count descending
      allSongs.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

      // Take Top 50
      setMostPlayed(allSongs.slice(0, 50));

    } catch (e) {
      console.warn("Failed to perform library scan for stats", e);
    }
  }, [credentials, service]);

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
        localStorage.removeItem('nebula_play_history'); // Clear play history to prevent demo songs in Most Played

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

        setSettings(prev => ({ ...prev, ...savedSettings, theme: { ...prev.theme, ...savedSettings.theme }, shortcuts: { ...prev.shortcuts, ...savedSettings.shortcuts } }));
      }
      try {
        const storedStats = localStorage.getItem('nebula_play_history');
        if (storedStats) setPlayHistory(JSON.parse(storedStats));
        const storedList = localStorage.getItem('nebula_history');
        if (storedList) setHistory(JSON.parse(storedList));
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
          const updated = { ...prev, [song.id]: { count: currentCount + 1, song } };
          localStorage.setItem('nebula_play_history', JSON.stringify(updated));
          return updated;
        });
        setHistory(prev => {
          const withoutCurrent = prev.filter(s => s.id !== song.id);
          const newHistory = [song, ...withoutCurrent].slice(0, 50);
          localStorage.setItem('nebula_history', JSON.stringify(newHistory));
          return newHistory;
        });
        lastPlayedSongIdRef.current = song.id;
      }
    }
  }, [currentSongIndex, isPlaying, queue]);

  // Audio Context Initialization (Lazy)
  const initAudioContext = useCallback(() => {
    // If context exists, ensure it's running
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(e => console.warn("Context resume failed", e));
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const ana = ctx.createAnalyser();
      ana.fftSize = 2048;
      ana.smoothingTimeConstant = 0.85;

      // Connect to source
      // Note: this can fail if called multiple times on same element in some browsers/versions
      // but react refs + useRef guard usually prevents it.
      const source = ctx.createMediaElementSource(audio);
      source.connect(ana);
      ana.connect(ctx.destination);

      audioContextRef.current = ctx;
      setAnalyser(ana);
    } catch (e) { console.warn("Audio Context init error:", e); }
  }, []);

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

    const handleTimeUpdate = () => {
      const { queue, currentSongIndex, isPlaying } = stateRef.current;
      const cTime = audio.currentTime;
      const dur = audio.duration || 0;

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
    };

    const onEnded = () => {
      const { repeatMode, queue, currentSongIndex } = stateRef.current;
      if (repeatMode === 'ONE') {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.warn("Loop play failed", e));
        }
      } else {
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
      }
    };

    const onError = (e: any) => {
      console.error("Playback Error Detected:", audio.error);
      if (audio.error?.code === 4) {
        console.warn("Media resource not suitable. Likely codec mismatch or CORS block on the stream.");
      }
    };

    const onPlayEvent = () => {
      initAudioContext();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlayEvent);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('play', onPlayEvent);
    };
  }, [initAudioContext]);

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

  // Apply pitch shifting via playbackRate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Convert pitch semitones to playbackRate multiplier: rate = 2^(semitones/12)
    const pitchMultiplier = Math.pow(2, pitch / 12);

    // Combine base playback rate with pitch adjustment
    const finalRate = playbackRate * pitchMultiplier;

    audio.playbackRate = finalRate;
  }, [pitch, playbackRate]);

  // Ensure volume and pitch preservation are synced
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      const audio = audioRef.current as any;
      if (audio.preservesPitch !== undefined) audio.preservesPitch = pitchCorrection;
      else if (audio.mozPreservesPitch !== undefined) audio.mozPreservesPitch = pitchCorrection;
      else if (audio.webkitPreservesPitch !== undefined) audio.webkitPreservesPitch = pitchCorrection;
    }
  }, [volume, pitchCorrection]);

  // Handle Playback State
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const song = queue[currentSongIndex];

    if (song) {
      const url = service.getStreamUrl(song.id, song.suffix);

      if (audio.src !== url) {
        audio.src = url;
        audio.load();

        const pitchMultiplier = Math.pow(2, pitch / 12);
        const finalRate = playbackRate * pitchMultiplier;
        audio.playbackRate = finalRate;
        const a = audio as any;
        if (a.preservesPitch !== undefined) a.preservesPitch = pitchCorrection;
        else if (a.mozPreservesPitch !== undefined) a.mozPreservesPitch = pitchCorrection;
        else if (a.webkitPreservesPitch !== undefined) a.webkitPreservesPitch = pitchCorrection;

        if (isPlaying) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              if (e.name !== 'AbortError') console.warn("Play failed", e);
            });
          }
          initAudioContext(); // Ensure context is ready
        }
      } else {
        if (isPlaying && audio.paused) {
          audio.play().then(() => initAudioContext()).catch(e => console.warn("Resume failed", e));
        } else if (!isPlaying && !audio.paused) {
          audio.pause();
        }
      }
    } else {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, [currentSongIndex, queue, service, isPlaying, initAudioContext]);

  const playSong = (song: ISong, contextQueue?: ISong[]) => {
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
    setIsPlaying(!isPlaying);
  };

  const nextSong = () => {
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
      setHomeData({ randomSongs: [], recentAlbums: [], newestAlbums: [], exploreAlbums: [], recommendedTracks: [], lastFetched: 0 });
      setCachedArtists([]);
      // Fetch real playlists from server
      db.saveCredentials(creds);
      service.getPlaylists().then(setPlaylists);
      fetchArtists(true);
      return true;
    }
    else { service.setCredentials(null as any); return false; }
  };

  const disconnect = async () => {
    service.setCredentials(null as any); setCredentialsState(null);
    await db.clear('settings'); await db.clear('api_cache');
    setQueue([]); setPlaylists([]); setCurrentSongIndex(-1); setIsPlaying(false); setIsDemoMode(false);
    navigationStackRef.current = [];
    setNavigationStack([]);
    setCurrentView('HOME');
    setViewData(undefined);
    setHomeData({ randomSongs: [], recentAlbums: [], newestAlbums: [], exploreAlbums: [], recommendedTracks: [], lastFetched: 0 });
    setCachedArtists([]);
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
  }, [credentials]);

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
      currentView, setView, goBack, canGoBack, backTarget, viewData, queue, currentSongIndex, isPlaying, volume, playbackRate, pitch, pitchCorrection, visualizerMode, repeatMode,
      credentials, isDemoMode, isInitialized, settings, playlists, modalOpen, songToAddToPlaylist,
      playSong, togglePlay, nextSong, prevSong, setVolume, setPlaybackRate, setPitch, setPitchCorrection, setVisualizerMode, toggleRepeat, toggleLike,
      connectToSubsonic, disconnect, enableDemoMode, addToQueue, updateSettings,
      openPlaylistModal, closePlaylistModal, createPlaylist, savePlaylist, addSongToPlaylist, deletePlaylist, reorderPlaylist,
      performSearch, searchResults, isSearching, lastSearchQuery, isSearchModalOpen, openSearchModal, closeSearchModal,
      getMostPlayedSongs: () => mostPlayed, refreshMostPlayed, history: [], service, audioRef, analyser, isZenMode, setZenMode,
      homeData, cachedArtists, refreshHomeData, refreshQuickPicks, refreshDiscovery, fetchArtists
    }}>
      {children}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="auto"
      />
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
