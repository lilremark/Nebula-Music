// Run with Electron, after build:electron. All state uses a disposable profile
// and windows remain hidden so this does not touch an installed Nebula session.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-desktop-smoke-'));
app.setPath('userData', profile);
// Electron treats the launcher's directory as the app root in script mode.
app.getAppPath = () => path.resolve(__dirname, '..');
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
let loaded = 0;
let finished = false;
const finish = (error) => {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  console.log(JSON.stringify({ desktopSmoke: error ? 'failed' : 'passed', windows: loaded, error: error?.message }));
  // Defer shutdown out of the window's load callback and let the real app's
  // before-quit handlers release tray/native resources before terminating.
  setImmediate(() => error ? app.exit(1) : app.quit());
};
const timeout = setTimeout(() => finish(new Error('Desktop startup timed out.')), 30_000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('did-fail-load', (_event, code, message) => finish(new Error(`${code}: ${message}`)));
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const bridge = window.desktop;
        return {
          info: bridge?.info,
          djApiAvailable: Boolean(bridge?.aiDj),
          secureHttpDefault: await bridge?.settings.get('permitInsecureHttp'),
          maximized: await bridge?.window.isMaximized(),
          rendererMounted: Boolean(document.querySelector('#root > *, #mini-player-root > *')),
        };
      })()`);
      if (result.info?.os !== process.platform || result.djApiAvailable !== (process.platform === 'win32') || result.secureHttpDefault !== false ||
          typeof result.maximized !== 'boolean' || !result.rendererMounted) {
        throw new Error(`Invalid desktop startup result: ${JSON.stringify(result)}`);
      }
      loaded += 1;
      if (loaded === 1) {
        await win.webContents.executeJavaScript('window.desktop.miniPlayer.toggle()');
      } else {
        clearTimeout(timeout);
        finish();
      }
    } catch (error) { finish(error); }
  });
});
require('../electron/dist/main.cjs');
