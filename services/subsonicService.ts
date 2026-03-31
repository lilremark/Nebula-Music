
import { SubsonicCredentials, ISong, IAlbum, IArtist, IPlaylist } from '../types';
import { MOCK_ALBUMS, MOCK_ARTISTS, MOCK_SONGS, MOCK_PLAYLISTS } from '../constants';
import { db } from './db';
import md5 from 'blueimp-md5';

export class SubsonicService {
  private creds: SubsonicCredentials | null = null;
  private isDemo: boolean = true;

  constructor(creds: SubsonicCredentials | null) {
    this.creds = creds;
    this.isDemo = !creds;
  }

  public setCredentials(creds: SubsonicCredentials) {
    this.creds = creds;
    this.isDemo = false;
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
    const { serverUrl, username, token, salt } = this.creds;

    try {
      const url = new URL(serverUrl);
      const basePath = url.pathname.replace(/\/$/, '');
      url.pathname = `${basePath}/rest/${method}`;

      url.searchParams.set('u', username);
      url.searchParams.set('t', token);
      url.searchParams.set('s', salt);
      url.searchParams.set('v', '1.16.1');
      url.searchParams.set('c', 'NebulaMusic');
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

  private stripHtml(html: string): string {
    if (!html) return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    let text = tmp.textContent || tmp.innerText || "";
    text = text.replace(/<[^>]*>?/gm, '');
    text = text.replace(/\s*Read more on Last\.fm.*/i, '');
    return text.trim();
  }

  async scrobble(id: string, submission: boolean = true): Promise<void> {
    if (this.isDemo || !this.creds) return;
    try {
      const url = this.buildUrl('scrobble.view', { id, submission: submission ? 'true' : 'false' });
      await fetch(url);
    } catch (e) {
      console.error("Scrobble failed", e);
    }
  }

  async reportNowPlaying(id: string): Promise<void> {
    if (this.isDemo || !this.creds) return;
    try {
      const url = this.buildUrl('scrobble.view', { id, submission: 'false', time: '0' }); // time=0 indicates now playing
      await fetch(url);
    } catch (e) {
      console.error("Report Now Playing failed", e);
    }
  }

  async getPing(): Promise<boolean> {
    if (this.isDemo) return true;
    try {
      const res = await fetch(this.buildUrl('ping.view'));
      const data = await res.json();
      return data['subsonic-response'].status === 'ok';
    } catch (e) {
      console.error("Ping failed", e);
      return false;
    }
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

  async toggleStar(id: string, star: boolean, type: 'song' | 'album' | 'artist' = 'song'): Promise<boolean> {
    if (this.isDemo) return true;
    try {
      const method = star ? 'star.view' : 'unstar.view';
      const params: any = {};
      if (type === 'album') params.albumId = id;
      else if (type === 'artist') params.artistId = id;
      else params.id = id;
      const res = await fetch(this.buildUrl(method, params));
      const data = await res.json();
      return data['subsonic-response'].status === 'ok';
    } catch (e) { return false; }
  }

  async getStarred(): Promise<{ songs: ISong[], albums: IAlbum[], artists: IArtist[] }> {
    if (this.isDemo) {
      const songs = MOCK_SONGS.map(s => ({ ...s, starred: true })).slice(0, 5);
      const albums = MOCK_ALBUMS.map(a => ({ ...a, starred: true })).slice(0, 3);
      return { songs, albums, artists: [] };
    }
    try {
      const res = await fetch(this.buildUrl('getStarred.view'));
      const data = await res.json();
      const starred = data['subsonic-response'].starred;
      if (!starred) return { songs: [], albums: [], artists: [] };
      return {
        songs: (starred.song || []).map((s: any) => this.mapSong(s)),
        albums: starred.album || [],
        artists: starred.artist || []
      };
    } catch (e) { return { songs: [], albums: [], artists: [] }; }
  }



  async getGenres(): Promise<string[]> {
    if (this.isDemo) return ['Electronic', 'Rock', 'Jazz', 'Synthwave', 'Pop', 'Classical'];
    const cacheKey = 'genres_list';
    const cached = await db.getCachedResponse(cacheKey, 1440);
    if (cached) return cached;
    try {
      const res = await fetch(this.buildUrl('getGenres.view'));
      const data = await res.json();
      const genres = data['subsonic-response'].genres?.genre || [];
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
      const res = await fetch(this.buildUrl('getRandomSongs.view', queryParams));
      const data = await res.json();
      const songs = data['subsonic-response'].randomSongs?.song || [];
      return songs.map((s: any) => this.mapSong(s));
    } catch (e) { return []; }
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
    try {
      const res = await fetch(this.buildUrl('getAlbumList.view', { type, size: size.toString(), offset: offset.toString(), ...params }));
      const data = await res.json();
      const result = data['subsonic-response'].albumList?.album || [];
      if (type !== 'random' && result.length > 0) { await db.cacheResponse(cacheKey, result); }
      return result;
    } catch (e) { return []; }
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
      const res = await fetch(this.buildUrl('getAlbum.view', { id }));
      const data = await res.json();
      const albumData = data['subsonic-response'].album;
      if (!albumData) return null;
      const songs = (albumData.song || []).map((s: any) => this.mapSong(s));
      let info = {};
      try {
        const infoRes = await fetch(this.buildUrl('getAlbumInfo2.view', { id }));
        const infoData = await infoRes.json();
        const ai = infoData['subsonic-response'].albumInfo;
        if (ai) {
          info = {
            notes: this.stripHtml(ai.notes),
            lastFmUrl: ai.lastFmUrl,
            musicBrainzId: ai.musicBrainzId
          };
        }
      } catch (e) { }

      const result = { ...albumData, songs, info, starred: albumData.starred !== undefined };
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
      const res = await fetch(this.buildUrl('getArtists.view'));
      const data = await res.json();
      const index = data['subsonic-response'].artists?.index || [];
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
      const res = await fetch(this.buildUrl('getArtist.view', { id }));
      const data = await res.json();
      const artistData = data['subsonic-response'].artist;
      let albums: IAlbum[] = [];
      if (artistData.album) {
        albums = Array.isArray(artistData.album) ? artistData.album : [artistData.album];
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
      const res = await fetch(this.buildUrl('getArtistInfo2.view', { id }));
      const data = await res.json();
      const info = data['subsonic-response'].artistInfo2;
      if (info) {
        bio = this.stripHtml(info.biography);
        image = info.largeImageUrl || info.mediumImageUrl || info.smallImageUrl;
      }
    } catch (e) { }
    if ((!bio || !image) && name) {
      try {
        const res = await fetch(this.buildUrl('getArtistInfo.view', { artist: name }));
        const data = await res.json();
        const info = data['subsonic-response'].artistInfo;
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
      const res = await fetch(this.buildUrl('getTopSongs.view', { artist: artistName, count: count.toString() }));
      const data = await res.json();
      const songs = data['subsonic-response'].topSongs?.song || [];
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
      const res = await fetch(this.buildUrl('search3.view', { query, songCount: size.toString(), songOffset: offset.toString() }));
      const data = await res.json();
      const songs = data['subsonic-response'].searchResult3?.song || [];
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
      const res = await fetch(this.buildUrl('search3.view', { query, albumCount: size.toString(), albumOffset: offset.toString() }));
      const data = await res.json();
      return data['subsonic-response'].searchResult3?.album || [];
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
      const res = await fetch(this.buildUrl('search3.view', { query, artistCount: '20', albumCount: '20', songCount: '40' }));
      const data = await res.json();
      const r = data['subsonic-response'].searchResult3;
      if (!r) return { artists: [], albums: [], songs: [] };
      return {
        artists: r.artist || [],
        albums: r.album || [],
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
        const res = await fetch(this.buildUrl('getLyricsBySongId.view', { id }));
        const data = await res.json();
        const structured = data['subsonic-response']?.lyricsList?.structuredLyrics;
        if (Array.isArray(structured) && structured.length > 0) {
          const synced = structured.find((s: { synced: boolean }) => s.synced) ?? structured[0];
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
              const validMatches = list.filter((item: { duration: number }) => duration ? Math.abs(item.duration - duration) > 2 : true);
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
        const res = await fetch(this.buildUrl('getLyrics.view', params));
        const data = await res.json();
        lyrics = data['subsonic-response'].lyrics?.value;
      } catch (e) { }
    }
    if (!lyrics && unsyncedFallback) lyrics = unsyncedFallback;
    if (lyrics) { await db.cacheResponse(cacheKey, lyrics); return lyrics; }
    return "";
  }

  async getPlaylists(): Promise<IPlaylist[]> {
    if (this.isDemo) return MOCK_PLAYLISTS;
    try {
      const res = await fetch(this.buildUrl('getPlaylists.view'));
      const data = await res.json();
      const raw = data['subsonic-response'].playlists?.playlist || [];
      return raw.map((p: any) => ({
        id: p.id, name: p.name, comment: p.comment, owner: p.owner, public: p.public, songCount: p.songCount, duration: p.duration, created: p.created, coverArt: p.coverArt
      }));
    } catch (e) { return []; }
  }

  async getPlaylist(id: string): Promise<IPlaylist | null> {
    if (this.isDemo) return MOCK_PLAYLISTS.find(p => p.id === id) || null;
    try {
      const res = await fetch(this.buildUrl('getPlaylist.view', { id }));
      const data = await res.json();
      const p = data['subsonic-response'].playlist;
      if (!p) return null;
      const songs = (p.entry || []).map((s: any) => this.mapSong(s));
      return { id: p.id, name: p.name, comment: p.comment, owner: p.owner, public: p.public, songCount: p.songCount || songs.length, duration: p.duration, created: p.created, coverArt: p.coverArt, songs };
    } catch (e) { return null; }
  }

  getStreamUrl(songId: string, suffix?: string): string {
    if (this.isDemo) {
      const samples = [
        'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3',
        'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
        'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3',
      ];
      const index = songId.charCodeAt(songId.length - 1) % samples.length;
      return samples[index];
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

    return this.buildUrl('stream.view', params);
  }

  getCoverArtUrl(id: string, size: number = 300): string {
    if (!id) return 'https://picsum.photos/300/300?grayscale';
    if (id.startsWith('http') || id.startsWith('/')) return id;
    if (this.isDemo) {
      const song = MOCK_SONGS.find(s => s.id === id);
      const album = MOCK_ALBUMS.find(a => a.id === id);
      const artist = MOCK_ARTISTS.find(a => a.id === id);
      const url = song?.coverArt || album?.coverArt || artist?.coverArt;
      if (url && url.startsWith('http')) return url;
      return 'https://picsum.photos/300/300';
    }
    return this.buildUrl('getCoverArt.view', { id, size: size.toString() });
  }
}
