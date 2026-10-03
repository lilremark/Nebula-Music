// Production Electron UI regression check. Uses a disposable profile, hidden
// windows, muted audio, and demo data; never connects an installed account.
const { app, BrowserWindow, session, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-dj-ui-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('mute-audio');
app.getAppPath = () => process.env.NEBULA_DJ_REVIEW_ASAR || path.resolve(__dirname, '..');
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
let finished = false;
const finish = error => {
  if (finished) return;
  finished = true;
  console.log(JSON.stringify({ djUi: error ? 'failed' : 'passed', screenshots: profile, error: error?.stack }));
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  app.exit(error ? 1 : 0);
};
const timeout = setTimeout(() => finish(new Error('Player UI check timed out')), 120_000);
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
  if (BrowserWindow.getAllWindows().length > 1) return;
  win.setContentSize(1450, 1000);
  win.webContents.once('did-finish-load', async () => {
    try {
      // Hidden windows do not advance CSS transitions reliably. Capture settled layouts.
      await win.webContents.insertCSS('* { transition-duration: 0s !important; animation-duration: 0s !important; } [data-nebula-main-scroll] > div > div { filter: none !important; opacity: 1 !important; transform: none !important; }');
      const wav = Buffer.alloc(44 + 16000 * 90 * 2);
      wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
      wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
      for (let i = 0; i < (wav.length - 44) / 2; i++) wav.writeInt16LE(Math.round(Math.sin(i * .17) * (Math.sin(i / 1200) * .3 + .4) * 25000), 44 + i * 2);
      const audio = { text: 'A few familiar favorites, with something new in the mix.', wavBase64: wav.toString('base64'), fallback: false };
      for (const name of ['prepare', 'preview', 'readiness', 'modelsStatus', 'downloadModels', 'cancelDownload']) ipcMain.removeHandler('nebula:aiDj:' + name);
      ipcMain.handle('nebula:aiDj:prepare', (_event, request) => ({ ...audio, sessionId: request.sessionId, requestId: request.requestId }));
      ipcMain.handle('nebula:aiDj:preview', () => ({ ...audio, sessionId: 'preview', requestId: 'preview' }));
      ipcMain.handle('nebula:aiDj:readiness', () => ({ ready: true }));
      ipcMain.handle('nebula:aiDj:modelsStatus', () => ({ phase: 'missing', ready: false, received: 0, total: 100 }));
      ipcMain.handle('nebula:aiDj:cancelDownload', () => {});
      ipcMain.handle('nebula:aiDj:downloadModels', async () => {
        win.webContents.send('nebula:aiDj:modelsChanged', { phase: 'downloading', ready: false, received: 40, total: 100, file: 'model.gguf' });
        await new Promise(resolve => setTimeout(resolve, 500));
        const status = { phase: 'ready', ready: true, received: 100, total: 100 };
        win.webContents.send('nebula:aiDj:modelsChanged', status); return status;
      });
      const js = source => win.webContents.executeJavaScript(source);
      const capture = async name => {
        const [width, height] = win.getContentSize();
        win.setContentSize(width + 1, height);
        await new Promise(resolve => setTimeout(resolve, 100));
        win.setContentSize(width, height);
        await new Promise(resolve => setTimeout(resolve, 650));
        fs.writeFileSync(path.join(profile, name + '.png'), (await win.webContents.capturePage()).toPNG());
      };
      await js(`window.waitForDj = async (check, name) => { for (let i=0;i<240;i++) { if(check()) return; await new Promise(r=>setTimeout(r,25)); } throw new Error(name); }; window.djButton = text => [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text); void 0;`);
      await js(`(async () => {
        await waitForDj(()=>djButton('Try Demo Mode'),'demo'); djButton('Try Demo Mode').click();
        await waitForDj(()=>document.querySelector('.nebula-quick-song-play'),'library');
        [...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')?.startsWith('Close what'))?.click();
        document.querySelector('.nebula-topbar-theme[aria-label="Switch to dark theme"]')?.click();
        document.querySelector('.nebula-quick-song-play').click();
        await waitForDj(()=>document.querySelector('.nebula-transport'),'dock');
        const nav=[...document.querySelectorAll('.nebula-rail-section[aria-label="Discover"] .nebula-rail-item')];
        if(nav[2]?.getAttribute('aria-label')!=='AI DJ') throw new Error('Discover ordering');
        document.querySelector('.nebula-rail [aria-label="AI DJ"]').click();
        await waitForDj(()=>document.querySelector('[data-nebula-view="ai-dj"]'),'DJ view');
        if(document.querySelector('.nebula-dj-badge')) throw new Error('Navigation started a session');
        if(!djButton('Start AI DJ').disabled) throw new Error('DJ enabled without models');
        djButton('DJ settings').click();
        await waitForDj(()=>document.querySelector('#settings-ai-dj-tab[aria-selected="true"]'),'settings link');
        if(djButton('Start AI DJ') || djButton('Stop DJ') || document.querySelector('.nebula-dj-transcript')) throw new Error('Session controls remained in settings');
        const toggle=document.querySelector('.nebula-dj-transcript-setting [role="switch"]');
        if(toggle?.getAttribute('aria-checked')!=='true') throw new Error('Transcript default');
        document.querySelector('#settings-ai-dj [aria-label="Tracks between interludes"]').click();
        await waitForDj(()=>djButton('4 tracks'),'cadence dropdown');
        if(djButton('Clear')) throw new Error('Required DJ preference can be cleared');
        djButton('4 tracks').click();
        await waitForDj(()=>document.querySelector('#settings-ai-dj [aria-label="Tracks between interludes"]').textContent.trim()==='4 tracks','cadence setting');
      })()`);
      win.setContentSize(1450, 1400);
      await capture('settings-model-download');
      await js(`document.querySelector('.nebula-topbar-theme[aria-label="Switch to light theme"]').click()`);
      await capture('settings-model-download-light');
      await js(`(async () => {
        djButton('Reset DJ learning').click();
        await waitForDj(()=>djButton('Confirm reset'),'learning reset confirmation');
        djButton('Cancel').click();
        await waitForDj(()=>!djButton('Confirm reset'),'learning reset cancelled');
      })()`);
      win.setContentSize(940, 1000);
      await capture('settings-model-download-compact');
      await js(`(() => {
        const panel=document.querySelector('#settings-ai-dj');
        if(panel.scrollWidth > panel.clientWidth + 1) throw new Error('DJ settings overflow');
        document.querySelector('.nebula-topbar-theme[aria-label="Switch to dark theme"]').click();
      })()`);
      win.setContentSize(1450, 1000);
      await js(`(async () => {
        djButton('Download DJ models').click();
        await waitForDj(()=>document.querySelector('progress[aria-label="AI DJ model download"]'),'download progress');
        await waitForDj(()=>djButton('Repair models'),'models activated');
        document.querySelector('.nebula-rail [aria-label="AI DJ"]').click();
        await waitForDj(()=>djButton('Start AI DJ'),'DJ start'); djButton('Start AI DJ').click();
        await waitForDj(()=>document.querySelector('.nebula-transport [aria-label="AI DJ cover"]'),'speaking cover');
        await waitForDj(()=>document.querySelector('.nebula-dj-caption'),'transcript');
        if(!document.querySelector('.nebula-transport .nebula-dj-haze[data-speaking="true"]')) throw new Error('Dock haze');
        if(document.querySelector('.nebula-transport input[aria-label="Playback position"]')) throw new Error('Speech was seekable');
        if(document.querySelector('.nebula-transport .nebula-dj-launch')) throw new Error('DJ launch remained in player');
        if(!document.querySelector('.nebula-dj-track-row')) throw new Error('DJ queue missing');
      })()`);
      await js(`waitForDj(()=> !navigator.gpu || [...document.querySelectorAll('.nebula-dj-cover canvas')].some(c=>getComputedStyle(c).opacity==='1'), 'shader paint')`);
      await capture('discover-speaking-dark');
      const shader = await js(`(() => { const canvases=[...document.querySelectorAll('.nebula-dj-cover canvas')]; return { gpu:!!navigator.gpu, visibility:document.visibilityState, canvases:canvases.length, painted:canvases.filter(c=>getComputedStyle(c).opacity==='1').length }; })()`);
      console.log(JSON.stringify({ shader }));
      if (shader.gpu && shader.visibility === 'visible' && shader.painted === 0) throw new Error('WebGPU orb did not paint');
      await js(`(async () => {
        djButton('DJ settings').click(); await waitForDj(()=>document.querySelector('.nebula-dj-transcript-setting'),'settings');
        if(!document.querySelector('#settings-ai-dj [aria-label="Tracks between interludes"]').disabled) throw new Error('Cadence editable during session');
        document.querySelector('.nebula-dj-transcript-setting [role="switch"]').click();
        document.querySelector('.nebula-rail [aria-label="AI DJ"]').click(); await waitForDj(()=>document.querySelector('[data-nebula-view="ai-dj"]'),'DJ');
        if(document.querySelector('.nebula-dj-caption')) throw new Error('Hidden transcription rendered');
        document.querySelector('.nebula-transport [aria-label="Pause"]').click();
        await waitForDj(()=>document.querySelector('.nebula-transport [aria-label="Play"]'),'paused');
        if(!document.querySelector('.nebula-transport [aria-label="AI DJ cover"]')) throw new Error('Pause lost DJ cover');
        document.querySelector('.nebula-transport [aria-label="Play"]').click();
        document.querySelector('.nebula-transport [aria-label="Open full screen player"]').click();
        await waitForDj(()=>document.querySelector('[data-nebula-player="fullscreen"].translate-y-0'),'full');
        const full=document.querySelector('[data-nebula-player="fullscreen"]');
        if([...full.querySelectorAll('[data-nebula-fullscreen-tabs] button')].some(b=>['lyrics','AI DJ'].includes(b.textContent.trim()))) throw new Error('DJ options in full player');
        if(!full.querySelector('[aria-label="AI DJ cover"]')) throw new Error('Full cover');
      })()`);
      await capture('fullscreen-speaking-dark');
      await js(`(async () => {
        const full=document.querySelector('[data-nebula-player="fullscreen"]');
        [...full.querySelectorAll('[data-nebula-fullscreen-tabs] button')].find(b=>b.textContent.trim()==='queue').click();
        await waitForDj(()=>full.querySelector('.nebula-dj-queue-player [aria-label="AI DJ cover"]'),'queue cover');
        full.querySelector('[aria-label="Close player"]').click();
        document.querySelector('.nebula-transport [aria-label="Open now playing panel"]').click();
        await waitForDj(()=>document.querySelector('[data-nebula-player="sidebar"]'),'sidebar');
        if(!document.querySelector('[data-nebula-player="sidebar"] [aria-label="AI DJ cover"]')) throw new Error('Sidebar cover');
        if(document.querySelector('.nebula-dj-tabs')) throw new Error('Sidebar DJ tab remained');
      })()`);
      await capture('sidebar-speaking-dark');
      for (const width of [940, 1100, 1280]) {
        win.setContentSize(width, 900);
        await new Promise(resolve => setTimeout(resolve, 150));
        for (const [label, selector] of [['Home', '[data-nebula-view="home"]'], ['Browse', '[data-nebula-view="browse"]'], ['Songs', '[data-nebula-library]'], ['Settings', '[data-nebula-view="settings"]'], ['AI DJ', '[data-nebula-view="ai-dj"]']]) {
          await js(`(async () => {
            document.querySelector('.nebula-rail [aria-label="${label}"]').click();
            await waitForDj(()=>document.querySelector('${selector}'),'${label} view');
            const content=document.querySelector('[data-nebula-content-shell]').getBoundingClientRect();
            const panel=document.querySelector('[data-nebula-panel="now-playing"]').getBoundingClientRect();
            const actions=document.querySelector('[data-nebula-topbar-actions]').getBoundingClientRect();
            const main=document.querySelector('[data-nebula-main-scroll]');
            const hero=document.querySelector('[data-nebula-home-hero]');
            if(hero) {
              const album=[...hero.querySelectorAll('button')].find(button=>button.textContent.trim()==='View Album');
              const steps=hero.querySelector('.nebula-featured-steps');
              const gap=steps.getBoundingClientRect().top-album.getBoundingClientRect().bottom;
              if(gap<15) throw new Error('Slideshow controls overlap album action: '+gap);
            }
            if(content.right > panel.left + 1 || actions.right > content.right + 1 || main.scrollWidth > main.clientWidth + 1) throw new Error('${label} overlaps sidebar at ${width}px');
            if(document.querySelector('[data-nebula-topbar-settings]')) throw new Error('Topbar settings remained');
          })()`);
          if (label === 'Home' && width === 1280) await capture('home-both-sidebars');
        }
        await capture('sidebar-' + width);
      }
      win.setContentSize(1450, 1000);
      await js(`(async () => {
        document.querySelector('[aria-label="Collapse now playing panel"]').click();
        djButton('DJ settings').click(); await waitForDj(()=>document.querySelector('#settings-ai-dj-tab'),'settings');
        document.querySelector('#settings-appearance-tab').click(); await waitForDj(()=>djButton('Floating Bar'),'layout'); djButton('Floating Bar').click();
        await waitForDj(()=>document.querySelector('[data-nebula-player="floating"]'),'floating');
        if(!document.querySelector('[data-nebula-player="floating"] [aria-label="AI DJ cover"]')) throw new Error('Floating cover');
        document.querySelector('.nebula-topbar-theme[aria-label="Switch to light theme"]')?.click();
      })()`);
      await capture('floating-speaking-light');
      await js(`window.desktop.miniPlayer.toggle()`);
      const mini = BrowserWindow.getAllWindows().find(window => window !== win);
      await new Promise(resolve => setTimeout(resolve, 800));
      const miniState = await mini.webContents.executeJavaScript(`({cover:!!document.querySelector('[aria-label="AI DJ cover"]'),badge:!!document.querySelector('.nebula-dj-badge'),queue:document.querySelectorAll('[title^="Play"]').length})`);
      if (!miniState.cover || !miniState.badge || !miniState.queue) throw new Error('Native mini-player did not synchronize: ' + JSON.stringify(miniState));
      fs.writeFileSync(path.join(profile, 'native-speaking.png'), (await mini.webContents.capturePage()).toPNG());
      await mini.webContents.executeJavaScript(`window.energyReceived = []; window.desktop.playback.onDjEnergy(value => energyReceived.push(value)); void 0`);
      mini.isVisible = () => true;
      win.webContents.send('nebula:mini-player:visibility', true);
      await new Promise(resolve => setTimeout(resolve, 500));
      const levels = await mini.webContents.executeJavaScript(`energyReceived.slice()`);
      if (!levels.length || !levels.some(value => value > 0) || levels.some(value => value < 0 || value > 1)) throw new Error('Native voice energy missing or unbounded');
      mini.isVisible = () => false;
      win.webContents.send('nebula:mini-player:visibility', false);
      await mini.webContents.executeJavaScript(`document.querySelector('[aria-label="Next track"]').click()`);
      await js(`waitForDj(()=>!document.querySelector('[data-nebula-player="floating"] [aria-label="AI DJ cover"]'),'restore track')`);
      await js(`(async () => {
        document.querySelector('.nebula-rail [aria-label="Settings"]').click();
        await waitForDj(()=>document.querySelector('#settings-appearance-tab'),'appearance');
        document.querySelector('#settings-appearance-tab').click(); await waitForDj(()=>djButton('Bottom Bar'),'sidebar option'); djButton('Bottom Bar').click();
        await waitForDj(()=>document.querySelector('.nebula-transport'),'music dock');
        if(!document.querySelector('.nebula-transport .nebula-dj-haze[data-session="true"][data-speaking="false"]')) throw new Error('Music dock lost session gradient');
        document.querySelector('.nebula-transport [aria-label="Open now playing panel"]').click();
        await waitForDj(()=>document.querySelector('[data-nebula-player="sidebar"]'),'music sidebar');
        if(!document.querySelector('[data-nebula-player="sidebar"] .nebula-dj-haze[data-session="true"][data-speaking="false"]')) throw new Error('Music sidebar lost session gradient');
      })()`);
      await capture('sidebar-session-music-light');
      await js(`document.querySelector('.nebula-topbar-theme[aria-label="Switch to dark theme"]')?.click(); document.querySelector('.nebula-rail [aria-label="Home"]').click(); void 0;`);
      await js(`waitForDj(()=>document.querySelector('[data-nebula-view="home"]'),'home screenshot')`);
      await capture('home-beta-dark');
      await js(`document.querySelector('.nebula-rail [aria-label="Settings"]').click(); void 0;`);
      await js(`waitForDj(()=>document.querySelector('#settings-appearance-tab'),'settings screenshot')`);
      await js(`(async () => {
        document.querySelector('[aria-label="Collapse now playing panel"]').click();
        document.querySelector('#settings-appearance-tab').click(); await waitForDj(()=>djButton('Floating Bar'),'floating option'); djButton('Floating Bar').click();
        document.querySelector('.nebula-rail [aria-label="AI DJ"]').click(); await waitForDj(()=>djButton('Stop DJ'),'stop');
        if(!document.querySelector('.nebula-dj-badge')) throw new Error('Music lost DJ identity');
        djButton('Stop DJ').click(); await waitForDj(()=>djButton('Start AI DJ'),'stopped');
        if(document.querySelector('.nebula-dj-badge')) throw new Error('Stale DJ badge after stop');
        djButton('Return to previous queue').click();
        djButton('DJ settings').click(); await waitForDj(()=>djButton('Preview voice'),'preview'); djButton('Preview voice').click();
        await waitForDj(()=>document.querySelector('[data-nebula-player="floating"] [aria-label="AI DJ cover"]'),'preview cover');
        if(document.querySelector('.nebula-dj-badge')) throw new Error('Preview started a DJ session');
      })()`);
      console.log(JSON.stringify({ discover: true, settingsOnly: true, transcriptOptOut: true, players: ['dock','full','queue','sidebar','floating','native'], shader, native: miniState }));
      clearTimeout(timeout); finish();
    } catch (error) { finish(error); }
  });
});
require(process.env.NEBULA_DJ_REVIEW_ASAR ? path.join(process.env.NEBULA_DJ_REVIEW_ASAR, 'electron/dist/main.cjs') : '../electron/dist/main.cjs');
