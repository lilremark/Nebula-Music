// Production Electron UI regression check. Uses a disposable profile, hidden
// windows, muted audio, and demo data; never connects an installed account.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-dj-ui-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('mute-audio');
app.getAppPath = () => path.resolve(__dirname, '..');
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
let finished = false;
const finish = error => {
  if (finished) return;
  finished = true;
  console.log(JSON.stringify({ playerUi: error ? 'failed' : 'passed', screenshots: profile, error: error?.stack }));
  app.exit(error ? 1 : 0);
};
const timeout = setTimeout(() => finish(new Error('Player UI check timed out')), 180_000);
app.whenReady().then(() => {
  // Offline fixtures exercise real decoding and playback without network traffic.
  const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#c06040"/><circle cx="340" cy="160" r="80" fill="#e8af70"/><path d="M0 400L512 230V512H0Z" fill="#722c24"/></svg>';
  const samples = 16000 * 120;
  const wav = Buffer.alloc(44 + samples * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(64000, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 4, 40);
  for (let i = 0; i < samples; i++) {
    const amplitude = Math.floor(i / 16000) % 8 < 3 ? 0.75 : 0.15;
    const value = Math.round(Math.sin(i * 440 * Math.PI * 2 / 16000) * amplitude * 32767);
    wav.writeInt16LE(value, 44 + i * 4); wav.writeInt16LE(-value, 46 + i * 4);
  }
  const isFixtureStream = url => url.startsWith('https://cdn.pixabay.com/download/audio/');
  for (const scheme of ['https', 'http']) session.defaultSession.protocol.handle(scheme, request => new Response(isFixtureStream(request.url) ? wav : artwork, { headers: {
    'Content-Type': isFixtureStream(request.url) ? 'audio/wav' : 'image/svg+xml', 'Access-Control-Allow-Origin': '*',
    'Content-Length': String(isFixtureStream(request.url) ? wav.length : Buffer.byteLength(artwork)),
  } }));
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://*/*', 'http://*/*'] }, (details, callback) => callback({ cancel: details.resourceType !== 'image' && !isFixtureStream(details.url) }));
});
app.on('browser-window-created', (_event, win) => {
  win.setContentSize(1450, 1050);
  win.webContents.once('did-finish-load', async () => {
    try {
      const run = source => win.webContents.executeJavaScript(source);
      const wait = async source => { for (let attempt = 0; attempt < 1200; attempt++) { if (await run(source)) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('DJ UI wait timed out: ' + source); };
      const click = text => run(`([...document.querySelectorAll('button')].find(button => button.textContent.trim() === ${JSON.stringify(text)})).click()`);
      const capture = async name => { await run(`for (const animation of document.getAnimations()) if (animation instanceof CSSTransition) animation.finish()`); await new Promise(resolve => setTimeout(resolve, 650)); win.setContentSize(win.getContentSize()[0] + 1, win.getContentSize()[1]); await new Promise(resolve => setTimeout(resolve, 150)); fs.mkdirSync('release-review', { recursive: true }); fs.writeFileSync(path.resolve('release-review', name), (await win.webContents.capturePage()).toPNG()); };
      await wait(`[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Try Demo Mode')`);
      await click('Try Demo Mode'); await wait(`!!document.querySelector('.nebula-quick-song-play')`);
      await run(`document.querySelector('[aria-label="Close what\\'s new"]')?.click(); document.querySelector('.nebula-quick-song-play').click()`);
      await wait(`!!document.querySelector('.nebula-transport')`);
      await click('Settings'); await wait(`!!document.querySelector('[data-nebula-settings-jumps]')`);
      await run(`[...document.querySelectorAll('[data-nebula-settings-jumps] button')].find(button => button.textContent.trim() === 'AI DJ').click()`);
      await wait(`document.querySelector('.nebula-dj-settings-status')?.textContent.includes('Local models ready')`);
      await capture('dj-settings-dark.png');
      await click('Preview voice'); await wait(`!![...document.querySelectorAll('audio')].find(audio => audio.src.startsWith('blob:'))`);
      await wait(`![...document.querySelectorAll('audio')].some(audio => audio.src.startsWith('blob:'))`);
      await run(`document.querySelector('.nebula-rail [aria-label="AI DJ"]').click()`);
      await wait(`!!document.querySelector('[data-nebula-view="ai-dj"]')`);
      await click('Start AI DJ'); await wait(`document.querySelector('.nebula-dj-view-status')?.textContent.includes('Your DJ is speaking')`);
      await capture('dj-speaking-dark.png'); await click('Skip interlude');
      await wait(`document.querySelector('.nebula-dj-view-status')?.textContent.includes('0 of 5 tracks')`);
      await run(`document.querySelector('.nebula-transport [aria-label="Open full screen player"]').click()`);
      await wait(`document.querySelector('[data-nebula-player="fullscreen"]')?.classList.contains('translate-y-0')`); await capture('dj-expanded-dark.png');
      await run(`document.querySelector('[aria-label="Close player"]').click(); document.querySelector('.nebula-transport [aria-label="Open now playing panel"]').click()`);
      await wait(`!!document.querySelector('[data-nebula-player="sidebar"]')`); await capture('dj-sidebar-dark.png');
      await run(`document.querySelector('[aria-label="Collapse now playing panel"]').click(); document.querySelector('.nebula-topbar-theme[aria-label="Switch to light theme"]')?.click()`);
      win.setContentSize(720, 900); await new Promise(resolve => setTimeout(resolve, 300)); await capture('dj-discover-light-narrow.png');
      win.webContents.debugger.attach('1.3'); const accessibility = await win.webContents.debugger.sendCommand('Accessibility.getFullAXTree');
      if (!accessibility.nodes.some(node => node.name?.value === 'AI DJ queue')) throw new Error('DJ lacks an accessible queue label');
      fs.writeFileSync('release-review/dj-accessibility.json', JSON.stringify(accessibility, null, 2)); win.webContents.debugger.detach();
      await click('Stop DJ'); await wait(`[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Start AI DJ')`);
      await click('Return to previous queue');
      clearTimeout(timeout); console.log(JSON.stringify({ aiDjUi: 'passed', localPreview: true, explicitSession: true, playerSurfaces: true, darkLight: true, accessibleSession: true })); finish();
    } catch (error) { finish(error); }
  });
});
require('../electron/dist/main.cjs');
