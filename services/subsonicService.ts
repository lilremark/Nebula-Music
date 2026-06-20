
import { SubsonicCredentials, ISong, IAlbum, IArtist, IPlaylist } from '../types';
import { MOCK_ALBUMS, MOCK_ARTISTS, MOCK_SONGS, MOCK_PLAYLISTS } from '../constants';
import { db } from './db';
import md5 from 'blueimp-md5';

const SUBSONIC_API_VERSION = '1.16.1';
const SUBSONIC_PROTOCOL_FALLBACKS = [SUBSONIC_API_VERSION, '1.15.0', '1.14.0'] as const;
const SUBSONIC_CLIENT_NAME = 'NebulaMusic';

interface OpenSubsonicExtension {
  name: string;
  versions?: number[];
}

interface SubsonicResponse {
  status: 'ok' | 'failed';
  version?: string;
  type?: string;
  serverVersion?: string;
  openSubsonic?: boolean;
  error?: {
    code?: number;
    message?: string;
    helpUrl?: string;
  };
  openSubsonicExtensions?: OpenSubsonicExtension[] | {
    openSubsonicExtension?: OpenSubsonicExtension[];
  };
  [key: string]: any;
}

class SubsonicApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly helpUrl?: string,
  ) {
    super(message);
    this.name = 'SubsonicApiError';
  }
}

export class SubsonicService {
  private creds: SubsonicCredentials | null = null;
  private isDemo: boolean = true;
  private streamUrlCache = new Map<string, string>();
  private coverArtUrlCache = new Map<string, string>();
  private openSubsonicExtensions = new Map<string, number[]>();
  private serverInfo: Pick<SubsonicResponse, 'version' | 'type' | 'serverVersion' | 'openSubsonic'> = {};
  private protocolVersion = SUBSONIC_API_VERSION;
  private readonly maxUrlCacheEntries = 500;

  constructor(creds: SubsonicCredentials | null) {
    this.creds = creds;
    this.isDemo = !creds;
  }

  public setCredentials(creds: SubsonicCredentials | null) {
    this.creds = creds;
    this.isDemo = !creds;
    this.streamUrlCache.clear();
    this.coverArtUrlCache.clear();
    this.openSubsonicExtensions.clear();
    this.serverInfo = {};
    this.protocolVersion = SUBSONIC_API_VERSION;
  }

  public getCredentials(): SubsonicCredentials | null {
    return this.creds;
  }

  public static hashPassword(password: string): { token: string, salt: string } {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const salt = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    const token = md5(password + salt);
    return { token, salt };
  }

  private buildUrl(method: string, params: Record<string, string> = {}): string {
    if (!this.creds) return '';
    const { serverUrl } = this.creds;

    try {
      const url = new URL(serverUrl);
      const basePath = url.pathname.replace(/\/$/, '');
      url.pathname = `${basePath}/rest/${method}`;

      if (this.creds.authType === 'apiKey') {
        url.searchParams.set('apiKey', this.creds.apiKey);
      } else {
        url.searchParams.set('u', this.creds.username);
        url.searchParams.set('t', this.creds.token);
        url.searchParams.set('s', this.creds.salt);
      }
      url.searchParams.set('v', this.protocolVersion);
      url.searchParams.set('c', SUBSONIC_CLIENT_NAME);
      url.searchParams.set('f', 'json');

      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, v);
        }
      });

      return url.toString();
    } catch (e) {
      console.error("Failed to build URL:", e);
      return '';
    }
  }

  private async request(method: string, params: Record<string, string> = {}): Promise<SubsonicResponse> {
    const url = this.buildUrl(method, params);
    if (!url) throw new Error('Subsonic credentials are not configured.');

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Subsonic request failed (${res.status} ${res.statusText}).`);
    }

    const data = await res.json();
    const response = data?.['subsonic-response'] as SubsonicResponse | undefined;
    if (!response) throw new Error('Subsonic server returned an invalid response.');

    if (response.status !== 'ok') {
      const code = response.error?.code;
      const message = response.error?.message || 'Unknown Subsonic API error.';
      throw new SubsonicApiError(
        `Subsonic error${code !== undefined ? ` ${code}` : ''}: ${message}`,
        code,
        response.error?.helpUrl,
      );
    }

    return response;
  }

  private async discoverOpenSubsonicExtensions(): Promise<void> {
    this.openSubsonicExtensions.clear();
    try {
      const response = await this.request('getOpenSubsonicExtensions.view');
      const raw = response.openSubsonicExtensions;
      const extensions = Array.isArray(raw) ? raw : raw?.openSubsonicExtension || [];
      extensions.forEach(extension => {
        if (extension?.name) {
          this.openSubsonicExtensions.set(extension.name, extension.versions || []);
        }
      });
    } catch {
      // Legacy Subsonic servers do not expose extension discovery.
    }
  }

  private supportsExtension(name: string, minimumVersion = 1): boolean {
    const versions = this.openSubsonicExtensions.get(name) || [];
    return versions.some(version => version >= minimumVersion);
  }

  public getServerInfo() {
    return {
      ...this.serverInfo,
      clientProtocolVersion: this.protocolVersion,
      extensions: Array.from(this.openSubsonicExtensions, ([name, versions]) => ({ name, versions })),
    };
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    let text = tmp.textContent || tmp.innerText || "";
    text = text.replace(/<[^>]*>?/gm, '');
    text = text.replace(/\s*Read more on Last\.fm.*/i, '');
    return text.trim();
  }

  private setCachedUrl(cache: Map<string, string>, key: string, value: string) {
    cache.set(key, value);
    if (cache.size <= this.maxUrlCacheEntries) return;

    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }

  async scrobble(id: string, submission: boolean = true): Promise<void> {
    if (this.isDemo || !this.creds) return;
    try {
      await this.request('scrobble.view', { id, submission: submission ? 'true' : 'false' });
    } catch (e) {
      console.error("Scrobble failed", e);
    }
  }

  async reportNowPlaying(id: string): Promise<void> {
    if (this.isDemo || !this.creds) return;
    try {
      await this.request('scrobble.view', { id, submission: 'false' });
    } catch (e) {
      console.error("Report Now Playing failed", e);
    }
  }

  async getPing(): Promise<boolean> {
    if (this.isDemo) return true;
    for (const version of SUBSONIC_PROTOCOL_FALLBACKS) {
      this.protocolVersion = version;
      try {
        const response = await this.request('ping.view');
        this.serverInfo = {
          version: response.version,
          type: response.type,
          serverVersion: response.serverVersion,
          openSubsonic: response.openSubsonic,
        };
        await this.discoverOpenSubsonicExtensions();
        return true;
      } catch (error) {
        if (error instanceof SubsonicApiError && error.code === 30 && version !== SUBSONIC_PROTOCOL_FALLBACKS.at(-1)) {
          continue;
        }
        console.error("Ping failed", error);
        return false;
      }
    }
    return false;
  }

  private mapSong(s: any): ISong {
    return {
      id: s.id,
      parent: s.parent,
      title: s.title,
      album: s.album,
      albumId: s.albumId || s.parent,
      artist: s.artist,
      artistId: s.artistId,
      coverArt: s.coverArt || s.id,
      duration: s.duration,
      track: s.track,
      discNumber: s.discNumber,
      year: s.year,
      genre: s.genre,
      size: s.size,
      suffix: s.suffix,
      contentType: s.contentType,
      isVideo: s.isVideo,
      path: s.path,
      created: s.created,
      starred: s.starred !== undefined,
      bitRate: s.bitRate,
      playCount: s.userPlayCount !== undefined ? s.userPlayCount : s.playCount
    };
  }

  private mapAlbum(album: any): IAlbum {
    return {
      ...album,
      name: album.name || album.album || album.title || 'Unknown Album',
      artist: album.artist || 'Unknown Artist',
      songCount: album.songCount || 0,
      duration: album.duration || 0,
      created: album.created || '',
      starred: album.starred !== undefined,
    };
  }

  async toggleStar(id: string, star: boolean, type: 'song' | 'album' | 'artist' = 'song'): Promise<boolean> {
    if (this.isDemo) return true;
    try {
      const method = star ? 'star.view' : 'unstar.view';
      const params: any = {};
      if (type === 'album') params.albumId = id;
      else if (type === 'artist') params.artistId = id;
      else params.id = id;
      await this.request(method, params);
      return true;
    } catch (e) { return false; }
  }

  async getStarred(): Promise<{ songs: ISong[], albums: IAlbum[], artists: IArtist[] }> {
    if (this.isDemo) {
      const songs = MOCK_SONGS.map(s => ({ ...s, starred: true })).slice(0, 5);
      const albums = MOCK_ALBUMS.map(a => ({ ...a, starred: true })).slice(0, 3);
      return { songs, albums, artists: [] };
    }
    for (const [method, responseKey] of [['getStarred2.view', 'starred2'], ['getStarred.view', 'starred']] as const) {
      try {
        const response = await this.request(method);
        const starred = response[responseKey];
        if (!starred) continue;
        return {
          songs: (starred.song || []).map((s: any) => this.mapSong(s)),
          albums: (starred.album || []).map((album: any) => this.mapAlbum(album)),
          artists: starred.artist || []
        };
      } catch {
        // Fall back to the legacy file-structure endpoint.
      }
    }
    return { songs: [], albums: [], artists: [] };
  }



  async getGenres(): Promise<string[]> {
    if (this.isDemo) return ['Electronic', 'Rock', 'Jazz', 'Synthwave', 'Pop', 'Classical'];
    const cacheKey = 'genres_list';
    const cached = await db.getCachedResponse(cacheKey, 1440);
    if (cached) return cached;
    try {
      const response = await this.request('getGenres.view');
      const genres = response.genres?.genre || [];
      const genreNames = genres.map((g: any) => g.value || g.name).sort();
      await db.cacheResponse(cacheKey, genreNames);
      return genreNames;
    } catch (e) { return []; }
  }

  async getRandomSongs(size: number = 10, params: { fromYear?: number, toYear?: number, genre?: string } = {}): Promise<ISong[]> {
    if (this.isDemo) {
      const pool = [...MOCK_SONGS, ...MOCK_SONGS, ...MOCK_SONGS];
      let filtered = pool.sort(() => 0.5 - Math.random());
      if (params.toYear) filtered = filtered.filter(s => (s.year || 2024) <= params.toYear!);
      return filtered.slice(0, size);
    }
    try {
      const queryParams: Record<string, string> = { size: size.toString() };
      if (params.fromYear) queryParams.fromYear = params.fromYear.toString();
      if (params.toYear) queryParams.toYear = params.toYear.toString();
      if (params.genre) queryParams.genre = params.genre;
      const response = await this.request('getRandomSongs.view', queryParams);
      const songs = response.randomSongs?.song || [];
      return songs.map((s: any) => this.mapSong(s));
    } catch (e) { return []; }
  }

  async getSimilarSongs(id: string, count: number = 20): Promise<ISong[]> {
    if (this.isDemo) {
      const seed = MOCK_SONGS.find(s => s.id === id);
      const pool = MOCK_SONGS.filter(s =>
        s.id !== id && (seed ? (s.artist === seed.artist || s.genre === seed.genre) : true)
      );
      return (pool.length > 0 ? pool : MOCK_SONGS.filter(s => s.id !== id)).slice(0, count);
    }

    const methods = ['getSimilarSongs2.view', 'getSimilarSongs.view'];

    for (const method of methods) {
      try {
        const response = await this.request(method, { id, count: count.toString() });
        const songs = response?.similarSongs2?.song || response?.similarSongs?.song || [];
        if (songs.length > 0) return songs.map((s: any) => this.mapSong(s));
      } catch (e) { }
    }

    return [];
  }

  async getAlbumList(type: string, size: number = 20, offset: number = 0, params: Record<string, string> = {}): Promise<IAlbum[]> {
    if (this.isDemo) {
      let sorted = [...MOCK_ALBUMS];
      if (sorted.length < 20) {
        for (let i = 0; i < 50; i++) sorted.push({ ...MOCK_ALBUMS[i % MOCK_ALBUMS.length], id: `mock-al-${i}`, name: `Mock Album ${i}`, year: 2020 + (i % 5) });
      }
      if (params.fromYear && params.toYear) {
        const from = parseInt(params.fromYear);
        const to = parseInt(params.toYear);
        sorted = sorted.filter(a => (a.year || 0) >= from && (a.year || 0) <= to);
      }
      if (type === 'newest' || type === 'recent') sorted.sort((a, b) => b.created.localeCompare(a.created));
      if (type === 'random') sorted.sort(() => 0.5 - Math.random());
      if (type === 'alphabeticalByName') sorted.sort((a, b) => a.name.localeCompare(b.name));
      return sorted.slice(offset, offset + size);
    }
    const paramString = Object.entries(params).map(([k, v]) => `${k}-${v}`).join('_');
    const cacheKey = `albumList_${type}_${size}_${offset}_${paramString}`;
    if (type !== 'random') {
      const cached = await db.getCachedResponse(cacheKey, 30);
      if (cached) return cached;
    }
    for (const [method, responseKey] of [['getAlbumList2.view', 'albumList2'], ['getAlbumList.view', 'albumList']] as const) {
      try {
        const response = await this.request(method, { type, size: size.toString(), offset: offset.toString(), ...params });
        const result = (response[responseKey]?.album || []).map((album: any) => this.mapAlbum(album));
        if (type !== 'random' && result.length > 0) { await db.cacheResponse(cacheKey, result); }
        return result;
      } catch {
        // Fall back for older servers without the ID3 endpoint.
      }
    }
    return [];
  }

  async getAlbum(id: string): Promise<IAlbum | null> {
    if (this.isDemo) {
      const album = MOCK_ALBUMS.find(a => a.id === id) || MOCK_ALBUMS[0];
      const songs = MOCK_SONGS.filter(s => s.album === album.name || s.albumId === id);
      return { ...album, songs, info: { notes: "A journey through digital soundscapes." }, starred: false };
    }

    const cacheKey = `album_detail_${id}`;
    const cached = await db.getCachedResponse(cacheKey, 60); // Cache for 1 hour
    if (cached) return cached;

    try {
      const response = await this.request('getAlbum.view', { id });
      const albumData = response.album;
      if (!albumData) return null;
      const songs = (albumData.song || []).map((s: any) => this.mapSong(s));
      let info = {};
      try {
        const infoResponse = await this.request('getAlbumInfo2.view', { id });
        const ai = infoResponse.albumInfo;
        if (ai) {
          info = {
            notes: this.stripHtml(ai.notes),
            lastFmUrl: ai.lastFmUrl,
            musicBrainzId: ai.musicBrainzId
          };
        }
      } catch (e) { }

      const result = { ...this.mapAlbum(albumData), songs, info };
      await db.cacheResponse(cacheKey, result);
      return result;
    } catch (e) { return null; }
  }

  async getArtists(): Promise<IArtist[]> {
    if (this.isDemo) return MOCK_ARTISTS;
    const cacheKey = 'all_artists';
    const cached = await db.getCachedResponse(cacheKey, 1440);
    if (cached) return cached;
    try {
      const response = await this.request('getArtists.view');
      const index = response.artists?.index || [];
      let allArtists: IArtist[] = [];
      index.forEach((idx: any) => {
        if (idx.artist) allArtists = [...allArtists, ...idx.artist];
      });
      if (allArtists.length > 0) { await db.cacheResponse(cacheKey, allArtists); }
      return allArtists;
    } catch (e) { return [] }
  }

  async getArtist(id: string): Promise<{ artist: IArtist, albums: IAlbum[] }> {
    if (this.isDemo) {
      const artist = MOCK_ARTISTS.find(a => a.id === id) || MOCK_ARTISTS[0];
      const albums = MOCK_ALBUMS.filter(a => a.artistId === id || a.artist === artist.name);
      return { artist, albums };
    }

    const cacheKey = `artist_detail_${id}`;
    const cached = await db.getCachedResponse(cacheKey, 60);
    if (cached) return cached;

    try {
      const response = await this.request('getArtist.view', { id });
      const artistData = response.artist;
      if (!artistData) return { artist: { id, name: 'Unknown' }, albums: [] };
      let albums: IAlbum[] = [];
      if (artistData.album) {
        const rawAlbums = Array.isArray(artistData.album) ? artistData.album : [artistData.album];
        albums = rawAlbums.map((album: any) => this.mapAlbum(album));
      }

      const result = {
        artist: { id: artistData.id, name: artistData.name, albumCount: artistData.albumCount, coverArt: artistData.coverArt },
        albums
      };
      await db.cacheResponse(cacheKey, result);
      return result;
    } catch (e) { return { artist: { id, name: 'Unknown' }, albums: [] }; }
  }

  async getArtistInfo(id: string, name?: string): Promise<{ bio?: string, image?: string }> {
    if (this.isDemo) return { bio: "A legendary entity formed in the digital void.", image: "https://picsum.photos/1200/600?grayscale" };

    const cacheKey = `artist_info_${id}`;
    const cached = await db.getCachedResponse(cacheKey, 1440); // 24 hours
    if (cached) return cached;

    let bio, image;
    try {
      const response = await this.request('getArtistInfo2.view', { id });
      const info = response.artistInfo2;
      if (info) {
        bio = this.stripHtml(info.biography);
        image = info.largeImageUrl || info.mediumImageUrl || info.smallImageUrl;
      }
    } catch (e) { }
    if ((!bio || !image) && name) {
      try {
        const response = await this.request('getArtistInfo.view', { artist: name });
        const info = response.artistInfo;
        if (info) {
          if (!bio) bio = this.stripHtml(info.biography);
          if (!image) image = info.largeImageUrl || info.mediumImageUrl || info.smallImageUrl;
        }
      } catch (e) { }
    }

    const result = { bio, image };
    if (bio || image) await db.cacheResponse(cacheKey, result);
    return result;
  }

  async getTopSongs(artistName: string, count: number = 10): Promise<ISong[]> {
    if (this.isDemo) return MOCK_SONGS.filter(s => s.artist === artistName).slice(0, count);

    const cacheKey = `top_songs_${artistName}_${count}`;
    const cached = await db.getCachedResponse(cacheKey, 1440);
    if (cached) return cached;

    try {
      const response = await this.request('getTopSongs.view', { artist: artistName, count: count.toString() });
      const songs = response.topSongs?.song || [];
      const result = songs.map((s: any) => this.mapSong(s));
      if (result.length > 0) await db.cacheResponse(cacheKey, result);
      return result;
    } catch (e) { return []; }
  }

  async getAllSongs(size: number = 100, offset: number = 0): Promise<ISong[]> {
    return this.searchSongs('', size, offset);
  }

  async searchSongs(query: string, size: number = 50, offset: number = 0): Promise<ISong[]> {
    if (this.isDemo) {
      let allMockSongs = [...MOCK_SONGS];
      for (let i = 0; i < 5; i++) allMockSongs = [...allMockSongs, ...MOCK_SONGS];
      if (query) {
        const q = query.toLowerCase();
        allMockSongs = allMockSongs.filter(s =>
          s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album.toLowerCase().includes(q)
        );
      }
      return allMockSongs.slice(offset, offset + size);
    }
    const cacheKey = `searchSongs_${query}_${size}_${offset}`;
    const cached = await db.getCachedResponse(cacheKey, 60);
    if (cached) return cached;
    try {
      const response = await this.request('search3.view', { query, songCount: size.toString(), songOffset: offset.toString() });
      const songs = response.searchResult3?.song || [];
      const mapped = songs.map((s: any) => this.mapSong(s));
      await db.cacheResponse(cacheKey, mapped);
      return mapped;
    } catch (e) { return []; }
  }

  async searchAlbums(query: string, size: number = 50, offset: number = 0): Promise<IAlbum[]> {
    if (this.isDemo) {
      const q = query.toLowerCase();
      const filtered = MOCK_ALBUMS.filter(a => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q));
      return filtered.slice(offset, offset + size);
    }
    try {
      const response = await this.request('search3.view', { query, albumCount: size.toString(), albumOffset: offset.toString() });
      return (response.searchResult3?.album || []).map((album: any) => this.mapAlbum(album));
    } catch (e) { return []; }
  }

  async search(query: string): Promise<{ artists: IArtist[], albums: IAlbum[], songs: ISong[] }> {
    if (!query) return { artists: [], albums: [], songs: [] };
    if (this.isDemo) {
      const q = query.toLowerCase();
      return {
        artists: MOCK_ARTISTS.filter(a => a.name.toLowerCase().includes(q)),
        albums: MOCK_ALBUMS.filter(a => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)),
        songs: MOCK_SONGS.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album.toLowerCase().includes(q))
      };
    }
    try {
      const response = await this.request('search3.view', { query, artistCount: '20', albumCount: '20', songCount: '40' });
      const r = response.searchResult3;
      if (!r) return { artists: [], albums: [], songs: [] };
      return {
        artists: r.artist || [],
        albums: (r.album || []).map((album: any) => this.mapAlbum(album)),
        songs: (r.song || []).map((s: any) => this.mapSong(s))
      };
    } catch (e) { return { artists: [], albums: [], songs: [] }; }
  }

  private cleanMetadata(str: string): string {
    return str.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*\[.*?\]\s*/g, ' ').replace(/\b(feat\.|ft\.|featuring|Live|Remix|Mix|Radio Edit)\b.*$/i, '').replace(/\s+/g, ' ').trim();
  }

  async getLyrics(artist: string, title: string, album?: string, duration?: number, id?: string): Promise<string> {
    if (this.isDemo) return `[00:00.50] (Instrumental Intro)\n[00:04.00] Standing on the edge of the neon light\n[00:08.00] Watching code flow through the night\n[00:12.00] Digital dreams in a binary stream\n[00:16.00] Waking up from a silicon dream`;
    const cacheKey = `lyrics_${id || ''}_${artist}_${title}_${duration || 0}`;
    const cached = await db.getCachedResponse(cacheKey, 1440);
    if (cached) return cached;
    let lyrics = '';
    let unsyncedFallback = '';
    if (id) {
      try {
        const lyricsParams: Record<string, string> = { id };
        if (this.supportsExtension('songLyrics', 2)) lyricsParams.enhanced = 'true';
        const response = await this.request('getLyricsBySongId.view', lyricsParams);
        const structured = response.lyricsList?.structuredLyrics;
        if (Array.isArray(structured) && structured.length > 0) {
          const mainLyrics = structured.filter((entry: { kind?: string }) => !entry.kind || entry.kind === 'main');
          const synced = mainLyrics.find((entry: { synced: boolean }) => entry.synced) ?? mainLyrics[0] ?? structured[0];
          if (synced.synced && Array.isArray(synced.line)) {
            lyrics = (synced.line as { start: number; value: string }[])
              .map(l => {
                const ms = (l.start ?? 0) + (synced.offset ?? 0);
                const totalSecs = Math.max(0, ms) / 1000;
                const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
                const secs = (totalSecs % 60).toFixed(2).padStart(5, '0');
                return `[${mins}:${secs}] ${l.value}`;
              })
              .join('\n');
          } else if (Array.isArray(synced.line)) {
            unsyncedFallback = (synced.line as { value: string }[]).map(l => l.value).join('\n');
          }
        }
      } catch (e) { }
    }
    if (!lyrics) {
      try {
        const url = new URL('https://lrclib.net/api/get');
        url.searchParams.append('artist_name', artist);
        url.searchParams.append('track_name', title);
        if (album) url.searchParams.append('album_name', album);
        if (duration) url.searchParams.append('duration', duration.toString());
        const res = await fetch(url.toString());
        if (res.ok) { const data = await res.json(); lyrics = data.syncedLyrics || data.plainLyrics; }
      } catch (e) { }
    }
    if (!lyrics) {
      const searchAndMatch = async (qArtist: string, qTitle: string) => {
        try {
          const url = new URL('https://lrclib.net/api/search');
          url.searchParams.append('q', `${qArtist} ${qTitle}`);
          const res = await fetch(url.toString());
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0) {
              const validMatches = list.filter((item: { duration: number }) => duration ? Math.abs(item.duration - duration) <= 2 : true);
              validMatches.sort((a: { syncedLyrics: string }, b: { syncedLyrics: string }) => (a.syncedLyrics && !b.syncedLyrics) ? -1 : 1);
              if (validMatches.length > 0) return (validMatches[0] as { syncedLyrics: string; plainLyrics: string }).syncedLyrics || validMatches[0].plainLyrics;
            }
          }
        } catch (e) { }
        return null;
      };
      lyrics = await searchAndMatch(artist, title) || '';
      if (!lyrics) {
        const cleanT = this.cleanMetadata(title);
        const cleanA = this.cleanMetadata(artist);
        if (cleanT !== title || cleanA !== artist) lyrics = await searchAndMatch(cleanA, cleanT) || '';
      }
    }
    if (!lyrics) {
      try {
        const params: Record<string, string> = { artist, title };
        if (id) params.id = id;
        const response = await this.request('getLyrics.view', params);
        lyrics = response.lyrics?.value;
      } catch (e) { }
    }
    if (!lyrics && unsyncedFallback) lyrics = unsyncedFallback;
    if (lyrics) { await db.cacheResponse(cacheKey, lyrics); return lyrics; }
    return "";
  }

  async getPlaylists(): Promise<IPlaylist[]> {
    if (this.isDemo) return MOCK_PLAYLISTS;
    try {
      const response = await this.request('getPlaylists.view');
      const raw = response.playlists?.playlist || [];
      return raw.map((p: any) => ({
        id: p.id, name: p.name, comment: p.comment, owner: p.owner, public: p.public, songCount: p.songCount, duration: p.duration, created: p.created, coverArt: p.coverArt
      }));
    } catch (e) { return []; }
  }

  async getPlaylist(id: string): Promise<IPlaylist | null> {
    if (this.isDemo) return MOCK_PLAYLISTS.find(p => p.id === id) || null;
    try {
      const response = await this.request('getPlaylist.view', { id });
      const p = response.playlist;
      if (!p) return null;
      const songs = (p.entry || []).map((s: any) => this.mapSong(s));
      return { id: p.id, name: p.name, comment: p.comment, owner: p.owner, public: p.public, songCount: p.songCount || songs.length, duration: p.duration, created: p.created, coverArt: p.coverArt, songs };
    } catch (e) { return null; }
  }

  getStreamUrl(songId: string, suffix?: string): string {
    const cacheKey = `${songId}:${suffix || ''}:${this.creds?.serverUrl || 'demo'}`;
    const cached = this.streamUrlCache.get(cacheKey);
    if (cached) return cached;

    if (this.isDemo) {
      const samples = [
        'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3',
        'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
        'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3',
      ];
      const index = songId.charCodeAt(songId.length - 1) % samples.length;
      const sampleUrl = samples[index];
      this.setCachedUrl(this.streamUrlCache, cacheKey, sampleUrl);
      return sampleUrl;
    }

    // estimateContentLength is critical for browsers to handle duration and seeking on streams
    const params: Record<string, string> = {
      id: songId,
      estimateContentLength: 'true'
    };

    if (suffix) {
      const s = suffix.toLowerCase();
      // Force transcoding for formats that are often problematic as raw browser streams
      // Browsers handle AAC (mp4/m4a) well, but raw ALAC files (.alac) usually fail.
      // If a file is failing with "not suitable", forcing a transcode to MP3 is the safest fix.
      if (s === 'alac' || s === 'aif' || s === 'aiff' || s === 'wav') {
        params.format = 'flac'; // High quality transcode for lossless sources
      }

      // M4A/MP4 often fail in browsers if the codec is ALAC or high-profile AAC
      // and the server doesn't provide strict MP4 audio headers.
      if (s === 'm4a' || s === 'mp4' || s === 'm4b' || s === 'mkv') {
        params.format = 'mp3';
      }
    }

    const streamUrl = this.buildUrl('stream.view', params);
    this.setCachedUrl(this.streamUrlCache, cacheKey, streamUrl);
    return streamUrl;
  }

  getCoverArtUrl(id: string, size: number = 300): string {
    if (!id) return 'https://picsum.photos/300/300?grayscale';
    if (id.startsWith('http') || id.startsWith('/')) return id;
    const cacheKey = `${id}:${size}:${this.creds?.serverUrl || 'demo'}`;
    const cached = this.coverArtUrlCache.get(cacheKey);
    if (cached) return cached;

    if (this.isDemo) {
      const song = MOCK_SONGS.find(s => s.id === id);
      const album = MOCK_ALBUMS.find(a => a.id === id);
      const artist = MOCK_ARTISTS.find(a => a.id === id);
      const url = song?.coverArt || album?.coverArt || artist?.coverArt;
      const coverUrl = url && url.startsWith('http') ? url : 'https://picsum.photos/300/300';
      this.setCachedUrl(this.coverArtUrlCache, cacheKey, coverUrl);
      return coverUrl;
    }
    const coverUrl = this.buildUrl('getCoverArt.view', { id, size: size.toString() });
    this.setCachedUrl(this.coverArtUrlCache, cacheKey, coverUrl);
    return coverUrl;
  }
}
