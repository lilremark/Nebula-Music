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
  setImmediate(() => {
    if (error) return app.exit(1);
    app.quit();
    // Shutdown is part of the check: a quit that never completes would
    // otherwise hold a CI job until its timeout.
    setTimeout(() => {
      console.error(JSON.stringify({ desktopSmoke: 'failed', error: 'App did not exit within 15s of quit.' }));
      app.exit(1);
    }, 15_000);
  });
};
// Without a handler, Electron reports an uncaught main-process error in a modal
// dialog, which blocks exit indefinitely on a headless runner. Fail instead,
// including for errors thrown while the app shuts down.
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({ desktopSmoke: 'failed', error: `Uncaught main-process error: ${error?.stack || error}` }));
  app.exit(1);
});
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
          crashReporting: await bridge?.diagnostics.getCrashReporting(),
          installIdReadable: (await bridge?.settings.get('crashReportsInstallId')) !== null,
          consentWritable: await bridge?.settings.set('crashReports', 'enabled').then(() => true, () => false),
        };
      })()`);
      if (result.info?.os !== process.platform || result.djApiAvailable !== (process.platform === 'win32') || result.secureHttpDefault !== false ||
          typeof result.maximized !== 'boolean' || !result.rendererMounted) {
        throw new Error(`Invalid desktop startup result: ${JSON.stringify(result)}`);
      }
      // Crash reporting is opt-in: a fresh profile has not been asked, the
      // renderer can neither grant consent through settings nor read the
      // install id, and the Sentry SDK bundle has not been loaded.
      const sentryLoaded = Object.keys(require.cache).some((file) => file.endsWith('sentryMain.cjs'));
      if (result.crashReporting?.consent !== 'unset' || typeof result.crashReporting?.available !== 'boolean' ||
          result.installIdReadable || result.consentWritable || sentryLoaded) {
        throw new Error(`Invalid crash reporting state: ${JSON.stringify({ ...result.crashReporting, installIdReadable: result.installIdReadable, consentWritable: result.consentWritable, sentryLoaded })}`);
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
