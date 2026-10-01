import { SubsonicService as ProductionSubsonicService } from '../../services/subsonicService';
import { MOCK_SONGS } from '../../constants';
import binarySunsetArt from './assets/cover-binary-sunset.png';
import digitalRainArt from './assets/cover-digital-rain.png';
import midnightCityArt from './assets/cover-midnight-city.png';
import quietWeatherArt from './assets/cover-quiet-weather.png';
import studyBeatsArt from './assets/cover-study-beats.png';
import emberHeroArt from './assets/nebula-hero-ember.png';

/** Build a local, seekable 48-second fixture once per Studio session. */
const createStudioTone = (seconds: number) => {
  const sampleRate = 8_000;
  const samples = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  write(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    // Deliberately quiet enough for a design preview, but non-silent so media
    // controls, progress, scrubbing, and analyser states all remain real.
    const envelope = Math.sin((Math.PI * index) / samples);
    const sample = Math.round(Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 850 * envelope);
    view.setInt16(44 + index * 2, sample, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

const studioTones = new Map<string, string>();

const artworkByKey: Record<string, string> = {
  s1: midnightCityArt, s2: midnightCityArt, s8: midnightCityArt, al1: midnightCityArt, 'random=1': midnightCityArt,
  s3: digitalRainArt, al2: digitalRainArt, 'random=2': digitalRainArt,
  s4: studyBeatsArt, s5: studyBeatsArt, al3: studyBeatsArt, 'random=3': studyBeatsArt,
  s6: binarySunsetArt, al4: binarySunsetArt, 'random=4': binarySunsetArt,
  s7: quietWeatherArt, al5: quietWeatherArt, 'random=5': quietWeatherArt,
  ar1: midnightCityArt, ar2: digitalRainArt, ar3: studyBeatsArt, ar4: binarySunsetArt, ar5: quietWeatherArt,
};

const artFor = (id: string) => artworkByKey[id] || Object.entries(artworkByKey)
  .find(([key]) => id.includes(key))?.[1] || binarySunsetArt;

export class SubsonicService extends ProductionSubsonicService {
  override getStreamUrl(songId: string, _suffix?: string): string {
    const cached = studioTones.get(songId);
    if (cached) return cached;
    const song = MOCK_SONGS.find((candidate) => candidate.id === songId);
    const tone = createStudioTone(song?.duration || 48);
    studioTones.set(songId, tone);
    return tone;
  }

  override getCoverArtUrl(id: string, size = 300): string {
    if (size >= 700 && id.includes('random=4')) return emberHeroArt;
    return artFor(id);
  }

  override async search(query: string) {
    const results = await super.search(query);
    return {
      ...results,
      artists: results.artists.map((artist) => ({ ...artist, coverArt: artist.coverArt || artist.id })),
    };
  }

  override async getArtistInfo(id: string, name?: string): Promise<{ bio?: string; image?: string }> {
    return {
      image: artFor(id),
      bio: `${name || 'This artist'} is represented by Studio’s local fixture catalog.`,
    };
  }
}
