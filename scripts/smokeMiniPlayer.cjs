// Exercises the built mini-player and real preload with offline snapshots.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-mini-ui-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('mute-audio');
const commands = [];
let opened = 0;
ipcMain.on('nebula:app:info', event => { event.returnValue = { os: process.platform, appName: 'Nebula', appVersion: 'test' }; });
ipcMain.on('nebula:playback:client-command', (_event, envelope) => commands.push(envelope));
ipcMain.handle('nebula:mini-player:show-main', () => { opened++; });
const snapshot = {
  v: 1, ownerId: 'fixture', epoch: 7, playing: true,
  track: { id: 'current', title: 'Get Money', artist: 'Jadakiss', album: 'The Champ Is Here Pt. 1' },
  positionSeconds: 84, durationSeconds: 120, volume: 0.7, muted: false,
  playbackRate: 1, repeatMode: 'OFF', updatedAt: Date.now(),
  upcoming: ['Professional Hood Shit', "It’s Nothing (Feat. Styles P)", 'Shakedown (Feat. Steele)', 'Domier', 'One more track with a long title'].map((title, i) => ({
    id: i === 4 ? 'next-0' : `next-${i}`, title, artist: i ? 'Sean Price' : 'Jadakiss',
    album: 'An album title long enough to need truncation without hiding controls', durationSeconds: 102 + i,
  })),
};
const server = http.createServer((request, response) => {
  const file = path.join(root, 'dist', new URL(request.url, 'http://localhost').pathname);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).on('error', () => { response.statusCode = 404; response.end(); }).pipe(response);
});
let win;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const publish = async value => {
  for (let i = 0; i < 20; i++) {
    win.webContents.send('nebula:playback:snapshot-to-client', value);
    await pause(50);
    if (await win.webContents.executeJavaScript(`document.body.textContent.includes(${JSON.stringify(value.track?.title || 'Not playing')})`)) return;
  }
  throw new Error('Mini-player did not subscribe to snapshots');
};
const capture = async name => {
  const [width, height] = win.getContentSize();
  win.setContentSize(width + 1, height);
  await pause(100);
  win.setContentSize(width, height);
  await pause(200);
  fs.writeFileSync(path.join(profile, name), (await win.webContents.capturePage()).toPNG());
};
const timeout = setTimeout(() => { console.error('Mini-player smoke check timed out'); app.exit(1); }, 45_000);
app.whenReady().then(async () => {
  const artwork = await require('sharp')(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#7b3b28"/><circle cx="80" cy="38" r="28" fill="#e8af70"/><path d="M0 94L120 64V120H0Z" fill="#332e39"/></svg>')).jpeg().toBuffer();
  snapshot.track.coverArtUrl = `data:image/jpeg;base64,${artwork.toString('base64')}`;
  snapshot.upcoming.forEach(item => { item.coverArtUrl = snapshot.track.coverArtUrl; });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  win = new BrowserWindow({ width: 380, height: 320, useContentSize: true, show: false, frame: false, webPreferences: {
    preload: path.join(root, 'electron/dist/preload.cjs'), contextIsolation: true, sandbox: true, backgroundThrottling: false,
  } });
  win.webContents.on('console-message', event => { if (event.level === 'error') console.error(event.message); });
  await win.loadURL(`http://127.0.0.1:${server.address().port}/mini-player.html`);
  await publish(snapshot);
  await capture('initial.png');
  for (const [width, height] of [[380, 320], [470, 390]]) {
    win.setContentSize(width, height);
    await pause(150);
    await win.webContents.executeJavaScript(`(() => {
      const root = document.getElementById('mini-player-root');
      if (Math.abs(root.getBoundingClientRect().height - innerHeight) > 1) throw new Error('Mini-player root does not fill the window; queue leaves a blank bottom strip');
      if (document.documentElement.scrollWidth > innerWidth) throw new Error('Mini-player overflows horizontally');
      if (![...document.images].every(image => image.complete && image.naturalWidth)) throw new Error('Artwork did not load');
      const buttons = [...document.querySelectorAll('button')];
      for (const button of buttons) {
        const bounds = button.getBoundingClientRect();
        if (bounds.right > innerWidth || bounds.left < 0) throw new Error('Mini-player control is clipped');
      }
      const play = document.querySelector('[aria-label="Pause"]');
      if (getComputedStyle(play).backgroundColor !== 'rgb(255, 255, 255)' || parseFloat(getComputedStyle(play).borderRadius) !== 8) throw new Error('Mini-player transport does not match the current square white controls');
      const queue = document.querySelector('[aria-label="Up next"]');
      if (!queue || queue.getBoundingClientRect().bottom < innerHeight - 18) throw new Error('Queue does not use the available window height');
      const last = queue.querySelector('button:last-child');
      last.scrollIntoView({ block: 'nearest' });
      if (last.getBoundingClientRect().bottom > queue.getBoundingClientRect().bottom + 1) throw new Error('Last queue entry is unreachable');
      queue.scrollTop = 0;
    })()`);
    await capture(`mini-${width}.png`);
  }
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('[aria-label="Previous track"]').click();
    document.querySelector('[aria-label="Pause"]').click();
    document.querySelector('[aria-label="Next track"]').click();
    document.querySelector('[aria-label="Up next"] button:last-child').click();
    document.querySelector('[aria-label="Open Nebula window"]').click();
  })()`);
  await pause(100);
  if (commands.map(value => value.command.name).join(',') !== 'previous,setPlayback,next,playQueueIndex' || commands[1].command.playing !== false || commands[3].command.index !== 4 || commands.some(value => value.epoch !== 7) || opened !== 1) throw new Error('Mini-player remote commands changed');
  await publish({ ...snapshot, playing: false, track: null, upcoming: [] });
  await win.webContents.executeJavaScript(`(() => {
    if (document.querySelector('[aria-label="Up next"]')) throw new Error('Stale queue remains in empty state');
    if (!document.querySelector('[aria-label="Play"]') || !document.body.textContent.includes('Nothing queued')) throw new Error('Empty state is missing');
    if (document.querySelector('.nebula-mini-times').textContent !== '0:00--:--') throw new Error('Empty state shows stale track timing');
  })()`);
  await capture('mini-empty.png');
  await publish({ ...snapshot, track: { ...snapshot.track, title: 'AI DJ' }, dj: { active: true, speech: true, preview: false, playing: true, position: 2, duration: 10, sessionId: 'fixture' } });
  await win.webContents.executeJavaScript(`(() => {
    if (!document.querySelector('[data-speaking="true"]') || !document.body.textContent.includes('Introducing your next set')) throw new Error('DJ presentation missing');
  })()`);
  console.log(JSON.stringify({ miniPlayer: 'passed', screenshots: profile, sizes: ['380×320', '470×390'], remoteCommands: true, emptyState: true, dj: true }));
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  clearTimeout(timeout);
  console.log(`Mini-player screenshots: ${profile}`);
  server.close();
  app.exit(process.exitCode || 0);
});
