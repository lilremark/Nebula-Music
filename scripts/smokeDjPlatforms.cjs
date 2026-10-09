// Verify production navigation/settings and real preload capabilities with
// web, macOS and Windows platform info. Every case uses isolated demo storage.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-dj-platforms-')));
app.commandLine.appendSwitch('mute-audio');
app.on('window-all-closed', () => {});
let currentOs = 'darwin';
let djCalls = 0;
ipcMain.on('nebula:app:info', event => { event.returnValue = { os: currentOs, appName: 'Nebula', appVersion: '3.0.0' }; });
ipcMain.handle('nebula:settings:get', (_event, key) => key === 'updateChannel' ? 'stable' : null);
ipcMain.handle('nebula:settings:set', () => {});
ipcMain.handle('nebula:vault:get', () => null);
ipcMain.handle('nebula:window:is-maximized', () => false);
ipcMain.handle('nebula:window:is-full-screen', () => false);
ipcMain.handle('nebula:updater:get-state', () => ({ enabled: false, phase: 'idle', currentVersion: '3.0.0' }));
ipcMain.handle('nebula:aiDj:modelsStatus', () => { djCalls++; return { phase: 'missing', ready: false }; });
ipcMain.handle('nebula:aiDj:readiness', () => { djCalls++; return { ready: false }; });
ipcMain.handle('nebula:aiDj:cancel', () => {});
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(root, 'dist', '.' + pathname);
  if (!file.startsWith(path.join(root, 'dist') + path.sep)) { response.writeHead(403).end(); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).on('error', () => { response.statusCode = 404; response.end(); }).pipe(response);
});
const timeout = setTimeout(() => { console.error('AI DJ platform check timed out'); app.exit(1); }, 60_000);
app.whenReady().then(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  for (const osName of ['web', 'darwin', 'win32']) {
    currentOs = osName;
    djCalls = 0;
    const win = new BrowserWindow({ width: 1440, height: 960, show: false, webPreferences: {
      partition: 'dj-platform-' + osName,
      preload: osName === 'web' ? undefined : path.join(root, 'electron/dist/preload.cjs'),
      contextIsolation: true, sandbox: true,
    } });
    win.webContents.on('console-message', event => { if (event.level === 'error') console.error(event.message); });
    win.webContents.session.webRequest.onBeforeRequest({ urls: ['https://*/*'] }, (_details, callback) => callback({ cancel: true }));
    await win.loadURL(`http://127.0.0.1:${server.address().port}/index.html`);
    const expected = osName === 'win32';
    await win.webContents.executeJavaScript(`(async () => {
      const wait = async check => { for (let i = 0; i < 160; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 25)); } throw new Error('Platform UI did not load'); };
      const buttons = () => [...document.querySelectorAll('button')];
      await wait(() => buttons().some(b => b.textContent.trim() === 'Try Demo Mode'));
      buttons().find(b => b.textContent.trim() === 'Try Demo Mode').click();
      await wait(() => document.querySelector('.nebula-rail'));
      await wait(() => !!document.querySelector('.nebula-rail [aria-label="AI DJ"]') === ${expected});
      document.querySelector('[aria-label^="Close what"]')?.click();
      if (!!window.desktop?.aiDj !== ${expected}) throw new Error('Incorrect preload AI DJ capability');
      if (!!document.querySelector('.nebula-rail [aria-label="AI DJ"]') !== ${expected}) throw new Error('Incorrect desktop AI DJ navigation');
      document.querySelector('.nebula-rail [aria-label="Settings"]').click();
      await wait(() => document.querySelector('[role="tablist"][aria-label="Settings sections"]'));
      if (!!document.getElementById('settings-ai-dj-tab') !== ${expected}) throw new Error('Incorrect AI DJ settings tab');
      if (!!document.querySelector('.nebula-rail [aria-label="AI DJ"]') !== ${expected}) throw new Error('AI DJ navigation changed after platform initialization');
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      if (tabs.filter(t => t.tabIndex === 0).length !== 1) throw new Error('Settings focus is invalid');
      if (${expected}) {
        document.querySelector('.nebula-rail [aria-label="AI DJ"]').click();
        await wait(() => document.querySelector('[aria-label="DJ settings"]'));
        document.querySelector('[aria-label="DJ settings"]').click();
        await wait(() => document.getElementById('settings-ai-dj-tab')?.getAttribute('aria-selected') === 'true');
        document.getElementById('settings-equalizer-tab').click();
        await wait(() => document.getElementById('settings-equalizer-tab')?.getAttribute('aria-selected') === 'true');
        await new Promise(resolve => setTimeout(resolve, 100));
        if (document.getElementById('settings-ai-dj-tab').getAttribute('aria-selected') === 'true') throw new Error('DJ settings deep link traps navigation');
      }
      document.querySelector('.nebula-rail [aria-label="Home"]').click();
      await wait(() => document.querySelector('.nebula-home-intro'));
    })()`);
    win.setContentSize(390, 844);
    await win.webContents.executeJavaScript(`(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
      document.querySelector('.nebula-topbar-menu').click();
      await new Promise(resolve => setTimeout(resolve, 350));
      const drawer = document.getElementById('app-navigation');
      if (!drawer || !![...drawer.querySelectorAll('button')].find(b => b.textContent.trim() === 'AI DJ') !== ${expected}) throw new Error('Incorrect mobile AI DJ navigation');
    })()`);
    if (!expected && djCalls !== 0) throw new Error('Unsupported platform contacted the AI DJ runtime');
    console.log(JSON.stringify({ platform: osName, aiDjVisible: expected, djRuntimeCalls: djCalls, navigationAndSettings: 'passed' }));
    win.destroy();
  }
  clearTimeout(timeout);
  server.close();
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
