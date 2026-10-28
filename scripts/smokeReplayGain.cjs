// Run against a built Vite preview with Playwright available in NODE_PATH.
const { chromium } = require('playwright');
const { build } = require('esbuild');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseUrl = process.env.NEBULA_SMOKE_URL || 'http://127.0.0.1:3014';
const output = path.resolve('out/replaygain');
const songs = [
  { id: '1', title: 'Gain fixture one', replayGain: { trackGain: -6, albumGain: -3, trackPeak: 0.8 } },
  { id: '2', title: 'Gain fixture two', replayGain: { trackGain: -12, albumGain: -9, trackPeak: 0.7 } },
  { id: '3', title: 'Gain fixture three', replayGain: {} },
].map(song => ({ ...song, artist: 'Fixture server', album: 'Gain tests', albumId: 'album', duration: 60, suffix: 'wav' }));
const wav = Buffer.alloc(44 + 8000 * 2 * 60);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    Math.random = () => 0.999999;
    window.__gainTargets = new Map();
    const createSource = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      const source = createSource.call(this, element);
      const connect = source.connect;
      source.connect = function (target, ...args) {
        window.__gainTargets.set(element, target);
        return connect.call(this, target, ...args);
      };
      return source;
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://nebula-fixture.invalid/**', async route => {
    const url = new URL(route.request().url());
    const method = url.pathname.split('/').pop();
    if (method === 'stream.view') {
      await route.fulfill({ contentType: 'audio/wav', body: wav, headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    if (method === 'getCoverArt.view') {
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#303544"/></svg>' });
      return;
    }
    await route.fulfill({ json: { 'subsonic-response': {
      status: 'ok', version: '1.16.1', randomSongs: { song: songs },
      song: songs.find(song => song.id === url.searchParams.get('id')),
      albumList2: { album: [] }, playlists: { playlist: [] }, artists: { index: [] },
      genres: { genre: [] }, starred2: { song: [], album: [], artist: [] }, openSubsonicExtensions: [],
    } }, headers: { 'access-control-allow-origin': '*' } });
  });
  const gainNear = async (index, expected) => page.waitForFunction(({ index, expected }) => {
    const element = document.querySelectorAll('audio')[index];
    const gain = window.__gainTargets.get(element)?.gain.value;
    return Math.abs(gain - expected) < 0.002;
  }, { index, expected });
  const soundSettings = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await page.getByRole('tab', { name: 'Sound', exact: true }).click();
  };
  try {
    await page.goto(baseUrl);
    await page.getByPlaceholder('https://music.yourserver.com', { exact: true }).fill('https://nebula-fixture.invalid');
    await page.getByPlaceholder('Username', { exact: true }).fill('fixture');
    await page.getByPlaceholder('Enter password', { exact: true }).fill('fixture');
    await page.getByRole('button', { name: 'Connect Server', exact: true }).click();
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await page.getByRole('button', { name: 'Play Gain fixture one', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('audio').paused);
    await gainNear(0, 1);
    const before = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return { volume: audio.volume, src: audio.src };
    });
    await soundSettings();
    await page.getByLabel('ReplayGain mode', { exact: true }).selectOption('track');
    await gainNear(0, 10 ** (-6 / 20));
    await page.getByLabel('ReplayGain mode', { exact: true }).selectOption('album');
    await gainNear(0, 10 ** (-3 / 20));
    await page.getByLabel('ReplayGain preamp:', { exact: false }).fill('3');
    await gainNear(0, 1);
    await page.getByRole('switch', { name: 'Prevent ReplayGain clipping', exact: true }).click();
    await page.getByLabel('ReplayGain preamp:', { exact: false }).fill('12');
    await gainNear(0, 10 ** (9 / 20));
    await page.getByRole('switch', { name: 'Prevent ReplayGain clipping', exact: true }).click();
    await gainNear(0, 1 / 0.8);
    assert.deepEqual(await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return { volume: audio.volume, src: audio.src };
    }), before);
    await page.getByLabel('ReplayGain preamp:', { exact: false }).fill('0');
    await page.getByLabel('ReplayGain mode', { exact: true }).selectOption('track');
    await page.getByRole('switch', { name: 'Magic Crossfade', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('audio').currentTime > 3);
    await page.evaluate(() => {
      const audio = document.querySelector('audio');
      // The HTTP fixture has no range support, so simulate only the end boundary.
      Object.defineProperty(audio, 'duration', { configurable: true, value: audio.currentTime + 1.5 });
      audio.dispatchEvent(new Event('timeupdate'));
    });
    await page.waitForFunction(() => !document.querySelectorAll('audio')[1].paused);
    await page.evaluate(() => { delete document.querySelector('audio').duration; });
    await gainNear(0, 10 ** (-6 / 20));
    await gainNear(1, 10 ** (-12 / 20));
    await page.waitForFunction(() => document.querySelector('audio').src.includes('id=2') && document.querySelectorAll('audio')[1].paused);
    await gainNear(0, 10 ** (-12 / 20));
    await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('ended')));
    await page.waitForFunction(() => document.querySelector('audio').src.includes('id=3'));
    await gainNear(0, 1);
    await page.getByLabel('ReplayGain mode', { exact: true }).selectOption('off');
    assert.equal(await page.getByLabel('ReplayGain preamp:', { exact: false }).isDisabled(), true);
    await page.getByLabel('ReplayGain mode', { exact: true }).selectOption('album');
    assert.equal(await page.locator('#replaygain-mode').inputValue(), 'album');
    let persisted = false;
    for (let attempt = 0; attempt < 50 && !persisted; attempt++) {
      persisted = await page.evaluate(() => new Promise(resolve => {
        const request = indexedDB.open('nebula_music_db');
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction('settings').objectStore('settings').get('user_settings');
          get.onsuccess = () => { db.close(); resolve(get.result?.replayGain?.mode === 'album'); };
        };
      }));
      if (!persisted) await page.waitForTimeout(100);
    }
    assert.equal(persisted, true);
    await page.reload();
    await soundSettings();
    assert.equal(await page.getByLabel('ReplayGain mode', { exact: true }).inputValue(), 'album');
    for (const dark of [true, false]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1100 });
        await page.locator('#replaygain-mode').scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: path.join(output, `${dark ? 'dark' : 'light'}-${width}.png`) });
      }
    }
    await page.locator('#replaygain-preamp').press('ArrowRight');
    assert.equal(await page.locator('#replaygain-preamp').inputValue(), '0.5');

    const bundle = await build({ entryPoints: [path.resolve('services/replayGain.ts')], bundle: true, write: false, format: 'iife', globalName: 'rg', platform: 'browser' });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const peaks = await page.evaluate(async () => {
      const preferences = { mode: 'track', preampDb: 0, preventClipping: true };
      async function render(tags, settings, change) {
        const rate = 48000;
        const ctx = new OfflineAudioContext(1, rate, rate);
        const source = ctx.createOscillator(); source.frequency.value = 1000;
        const amplitude = ctx.createGain(); amplitude.gain.value = 0.8;
        const gain = ctx.createGain();
        rg.applyReplayGain(gain, tags, settings, 0, true);
        if (change) rg.applyReplayGain(gain, tags, { ...settings, preampDb: -6 }, 0.25);
        source.connect(amplitude); amplitude.connect(gain); gain.connect(ctx.destination); source.start();
        const samples = (await ctx.startRendering()).getChannelData(0);
        return samples.slice(rate * 0.8).reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
      }
      return {
        off: await render({ trackGain: -6 }, { ...preferences, mode: 'off' }),
        track: await render({ trackGain: -6 }, preferences),
        album: await render({ trackGain: -6, albumGain: -3 }, { ...preferences, mode: 'album' }),
        clipped: await render({ trackGain: 6, trackPeak: 0.8 }, preferences),
        boost: await render({ trackGain: 6, trackPeak: 0.8 }, { ...preferences, preventClipping: false }),
        changed: await render({ trackGain: -6 }, preferences, true),
      };
    });
    for (const [key, expected] of Object.entries({ off: 0.8, track: 0.8 * 10 ** (-6 / 20), album: 0.8 * 10 ** (-3 / 20), clipped: 1, boost: 0.8 * 10 ** (6 / 20), changed: 0.8 * 10 ** (-12 / 20) })) {
      assert.ok(Math.abs(peaks[key] - expected) < 0.001, `${key}: ${peaks[key]} vs ${expected}`);
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ replayGain: 'passed', browser: 'Chromium', peaks, screenshots: output }));
  } catch (error) {
    console.error(await page.evaluate(() => ({
      mode: document.querySelector('#replaygain-mode')?.value,
      audio: [...document.querySelectorAll('audio')].map(element => ({ src: element.src, paused: element.paused, gain: window.__gainTargets.get(element)?.gain.value, context: window.__gainTargets.get(element)?.context.state })),
    })));
    await page.screenshot({ path: path.join(output, 'failure.png') });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
