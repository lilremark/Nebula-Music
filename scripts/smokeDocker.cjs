// Run against the real NGINX container with a disposable browser profile and
// deterministic audio/artwork. No preload bridge or personal server is used.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const baseUrl = process.env.NEBULA_DOCKER_URL || 'http://127.0.0.1:18080';
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-docker-')));
app.commandLine.appendSwitch('mute-audio');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const timeout = setTimeout(() => { console.error('Docker UI smoke timed out'); app.exit(1); }, 60_000);

app.whenReady().then(async () => {
  const response = await fetch(baseUrl + '/healthz');
  if (response.status !== 204) throw new Error('Container health endpoint failed');
  const page = await fetch(baseUrl + '/');
  for (const [header, expected] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['cache-control', 'no-store']]) {
    if (page.headers.get(header) !== expected) throw new Error('Incorrect header: ' + header);
  }
  if (!page.headers.get('content-security-policy')?.includes("script-src 'self'")) throw new Error('Missing CSP');
  if ((await fetch(baseUrl + '/missing-route')).status !== 200) throw new Error('SPA fallback failed');
  if ((await fetch(baseUrl + '/assets/missing.js')).status !== 404) throw new Error('Missing asset must return 404');
  const win = new BrowserWindow({ show: false, width: 1440, height: 960, webPreferences: { contextIsolation: true, sandbox: true } });
  const errors = [];
  win.webContents.on('render-process-gone', (_event, details) => errors.push(details.reason));
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
  const wav = Buffer.alloc(44 + 16000 * 60 * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 44; i < wav.length; i += 2) wav.writeInt16LE(Math.round(Math.sin(i * Math.PI * 440 / 16000) * 3000), i);
  const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#c06040"/></svg>';
  win.webContents.session.protocol.handle('https', request => {
    const audio = request.url.startsWith('https://cdn.pixabay.com/download/audio/');
    return new Response(audio ? wav : artwork, { headers: { 'Content-Type': audio ? 'audio/wav' : 'image/svg+xml', 'Access-Control-Allow-Origin': '*' } });
  });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['https://*/*'] }, (details, callback) => callback({
    cancel: details.resourceType !== 'image' && !details.url.startsWith('https://cdn.pixabay.com/download/audio/'),
  }));
  await win.loadURL(baseUrl);
  await win.webContents.executeJavaScript(`(async () => {
    const wait = async (check, label) => { for (let i = 0; i < 240; i++) { if (check()) return; await new Promise(r => setTimeout(r, 25)); } throw new Error('Timed out: ' + label); };
    window.smokeWait = wait;
    const buttons = () => [...document.querySelectorAll('button')];
    await wait(() => buttons().some(b => b.textContent.trim() === 'Try Demo Mode'), 'setup');
    if (window.desktop) throw new Error('Web test unexpectedly has a desktop bridge');
    buttons().find(b => b.textContent.trim() === 'Try Demo Mode').click();
    await wait(() => document.querySelector('.nebula-quick-song-play'), 'demo home');
    document.querySelector('[aria-label^="Close what"]')?.click();
    if (document.querySelector('.nebula-rail [aria-label="AI DJ"]')) throw new Error('AI DJ navigation visible');
    document.querySelector('.nebula-rail [aria-label="Settings"]').click();
    await wait(() => document.getElementById('settings-server-connection-tab'), 'settings');
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    if (tabs.map(t => t.textContent.trim()).join(',') !== 'Connection,Sound,Interface,Integrations') throw new Error('Incorrect web settings sections');
    for (const tab of tabs) {
      tab.click();
      await wait(() => tab.getAttribute('aria-selected') === 'true', 'settings ' + tab.textContent);
      if (!document.querySelector('[role="tabpanel"]').textContent.trim()) throw new Error('Empty settings section');
    }
    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await wait(() => tabs.at(-1).getAttribute('aria-selected') === 'true', 'keyboard tab navigation');
    document.querySelector('.nebula-rail [aria-label="Home"]').click();
    await wait(() => document.querySelector('.nebula-quick-song-play'), 'home navigation');
    const dark = document.documentElement.classList.contains('dark');
    document.querySelector('.nebula-topbar-theme').click();
    await wait(() => document.documentElement.classList.contains('dark') !== dark, 'theme');
    document.querySelector('.nebula-quick-song-play').click();
    await wait(() => [...document.querySelectorAll('audio')].some(a => !a.paused && a.currentTime > 0.1), 'decoded audio playback');
    document.querySelector('.nebula-transport [aria-label="Pause"]').click();
    await wait(() => [...document.querySelectorAll('audio')].every(a => a.paused), 'pause');
    document.querySelector('.nebula-transport [aria-label="Play"]').click();
    await wait(() => [...document.querySelectorAll('audio')].some(a => !a.paused), 'resume');
    document.querySelector('.nebula-transport [aria-label="Mute"]').click();
    await wait(() => document.querySelector('.nebula-transport [aria-label="Unmute"]'), 'mute');
    document.querySelector('.nebula-transport [aria-label="Unmute"]').click();
    const title = document.querySelector('.nebula-transport-track button').textContent;
    document.querySelector('.nebula-transport [aria-label="Next track"]').click();
    await wait(() => document.querySelector('.nebula-transport-track button').textContent !== title && [...document.querySelectorAll('audio')].some(a => !a.paused && a.currentTime > 0), 'next track');
  })()`);
  win.setContentSize(390, 844);
  await win.webContents.executeJavaScript(`(async () => {
    await new Promise(r => setTimeout(r, 400));
    document.querySelector('.nebula-topbar-menu').click();
    await window.smokeWait(() => document.getElementById('app-navigation'), 'mobile navigation');
    const drawer = document.getElementById('app-navigation');
    if ([...drawer.querySelectorAll('button')].some(b => b.textContent.trim() === 'AI DJ')) throw new Error('Mobile AI DJ visible');
    [...drawer.querySelectorAll('button')].find(b => b.textContent.trim() === 'Settings').click();
    await window.smokeWait(() => document.getElementById('settings-server-connection-tab'), 'mobile settings');
    if (document.getElementById('settings-desktop-integration-tab') || document.getElementById('settings-ai-dj-tab')) throw new Error('Unsupported mobile settings visible');
  })()`);
  const fatal = errors.filter(message => !message.startsWith('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT') && !message.includes('404 (Not Found)'));
  if (fatal.length) throw new Error('Browser errors: ' + fatal.join('\n'));
  console.log(JSON.stringify({ dockerUrl: baseUrl, health: 'passed', headersAndRouting: 'passed', webAndMobileSettings: 'passed', theme: 'passed', playbackPauseResumeMuteNext: 'passed' }));
  clearTimeout(timeout);
  win.destroy();
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
