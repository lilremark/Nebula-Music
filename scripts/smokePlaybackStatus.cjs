const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseUrl = process.env.NEBULA_SMOKE_URL || 'http://127.0.0.1:3012';
const output = path.resolve('out/playback-status');
const songs = [1, 2, 3].map(id => ({
  id: String(id), title: `Playback fixture ${id}`, artist: 'Test server', album: 'Connection test',
  albumId: 'album', artistId: 'artist', coverArt: 'cover', duration: 60, suffix: 'wav',
}));
const wav = Buffer.alloc(44 + 8000 * 2 * 60);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let serverAvailable = true;
  let releaseStreams;
  let streamGate = new Promise(resolve => { releaseStreams = resolve; });
  await page.route('https://nebula-fixture.invalid/**', async route => {
    const method = new URL(route.request().url()).pathname.split('/').pop();
    if (method === 'stream.view') {
      await streamGate;
      await route.fulfill({ status: 200, contentType: 'audio/wav', body: wav, headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    if (!serverAvailable) { await route.abort('connectionrefused'); return; }
    if (method === 'getCoverArt.view') {
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#303544"/><text x="20" y="100" fill="white">Test server</text></svg>' });
      return;
    }
    const body = { status: 'ok', version: '1.16.1',
      randomSongs: { song: songs }, albumList2: { album: [] }, albumList: { album: [] },
      playlists: { playlist: [] }, artists: { index: [] }, genres: { genre: [] },
      starred2: { song: [], album: [], artist: [] }, openSubsonicExtensions: [],
    };
    await route.fulfill({ json: { 'subsonic-response': body }, headers: { 'access-control-allow-origin': '*' } });
  });
  try {
    await page.goto(baseUrl);
    await page.getByPlaceholder('https://music.yourserver.com', { exact: true }).fill('https://nebula-fixture.invalid');
    await page.getByPlaceholder('Username', { exact: true }).fill('fixture');
    await page.getByPlaceholder('Enter password', { exact: true }).fill('fixture');
    await page.getByRole('button', { name: 'Connect Server', exact: true }).click();
    const dismiss = page.getByRole('button', { name: 'Got it', exact: true });
    await dismiss.click();
    const playFixture = page.locator('.nebula-quick-song-play').first();
    await playFixture.waitFor();
    const nextTitle = (await page.locator('.nebula-quick-song-play').nth(1).getAttribute('aria-label')).replace(/^Play /, '');
    await playFixture.click();
    const transport = page.getByRole('contentinfo', { name: 'Playback controls' });
    await transport.getByText('Loading track…', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'desktop-loading.png') });
    releaseStreams();
    await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelector('audio').readyState >= 3);
    await transport.getByText('Loading track…', { exact: true }).waitFor({ state: 'hidden' });
    await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('waiting')));
    await transport.getByText('Buffering…', { exact: true }).waitFor();
    await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('playing')));
    await transport.getByText('Buffering…', { exact: true }).waitFor({ state: 'hidden' });
    await transport.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(await transport.locator('.nebula-playback-status').count(), 0);
    await transport.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('audio').paused);
    await page.evaluate(() => {
      const audio = document.querySelector('audio');
      audio.dispatchEvent(new Event('ended'));
    });
    await transport.getByRole('button', { name: nextTitle, exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('audio').paused && document.querySelectorAll('audio')[1].paused);
    await page.evaluate(() => document.querySelector('audio').dispatchEvent(new Event('error')));
    await transport.getByText('Can’t play track. Press Play to retry or skip.').waitFor();
    await transport.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('audio').paused);
    await transport.locator('.nebula-playback-status').waitFor({ state: 'hidden' });

    serverAvailable = false;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const warning = page.locator('.nebula-next > .nebula-server-warning');
    await warning.waitFor();
    assert.equal(await page.evaluate(() => navigator.onLine), true);
    await page.screenshot({ path: path.join(output, 'desktop-disconnected.png') });
    await transport.getByRole('button', { name: 'Open full screen player', exact: true }).click();
    const fullPlayer = page.locator('[data-nebula-player="fullscreen"]');
    await fullPlayer.getByText('Connection to music server lost.').waitFor();
    await fullPlayer.getByRole('button', { name: 'Close player', exact: true }).click();
    await transport.waitFor();
    await warning.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await warning.getByRole('button', { name: 'Retry connection', exact: true }).waitFor();
    serverAvailable = true;
    await warning.getByRole('button', { name: 'Retry connection', exact: true }).focus();
    await page.keyboard.press('Enter');
    await warning.waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
    const settingsNav = page.getByRole('tablist', { name: 'Settings sections' });
    await settingsNav.waitFor();
    assert.equal(await settingsNav.getByRole('tab', { name: 'Desktop', exact: true }).count(), 0);
    await settingsNav.getByRole('tab', { name: 'Sound', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'web-settings.png') });

    for (const dark of [false, true]) {
      await page.evaluate(darkMode => document.documentElement.classList.toggle('dark', darkMode), dark);
      await page.setViewportSize({ width: 390, height: 844 });
      serverAvailable = false;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await warning.waitFor();
      await page.evaluate(() => {
        const audio = document.querySelector('audio');
        Object.defineProperty(audio, 'readyState', { configurable: true, value: 2 });
        audio.dispatchEvent(new Event('waiting'));
      });
      await transport.locator('.nebula-playback-status').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      const bounds = await warning.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const animation = await page.locator('.nebula-buffering-spinner').first().evaluate(element => getComputedStyle(element).animationName);
      assert.equal(animation, 'none');
      await page.screenshot({ path: path.join(output, `mobile-${dark ? 'dark' : 'light'}.png`) });
      await page.evaluate(() => {
        const audio = document.querySelector('audio');
        delete audio.readyState;
        audio.dispatchEvent(new Event('playing'));
      });
      serverAvailable = true;
      await warning.getByRole('button', { name: 'Retry connection', exact: true }).click();
      await warning.waitFor({ state: 'hidden' });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.nebula-rail [aria-label="Home"]').click();
    await page.locator('.nebula-quick-song-play').first().waitFor();
    serverAvailable = false;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await warning.waitFor();
    await page.evaluate(() => {
      const audio = document.querySelector('audio');
      Object.defineProperty(audio, 'readyState', { configurable: true, value: 2 });
      audio.dispatchEvent(new Event('waiting'));
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await transport.getByText('Buffering…', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'desktop-dark.png'), animations: 'disabled' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ playbackStatusSmoke: 'passed', checks: ['initial load', 'buffering and recovery', 'pause', 'automatic next track', 'playback error and retry', 'server loss while browser online', 'retry and keyboard recovery', 'web Settings gate', 'mobile light/dark', 'reduced motion', 'no page errors'], output }));
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png') });
    console.error(await page.locator('body').innerText());
    throw error;
  } finally {
    releaseStreams();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
