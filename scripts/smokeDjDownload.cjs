// Explicit real-source download through production IPC, in a disposable profile.
// Uses hidden windows; never reads an installed account or changes its models.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-dj-download-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('mute-audio');
const asar = process.env.NEBULA_DJ_REVIEW_ASAR;
app.getAppPath = () => asar || path.resolve(__dirname, '..');
if (asar) {
  Object.defineProperty(app, 'isPackaged', { get: () => true });
  Object.defineProperty(process, 'resourcesPath', { value: path.dirname(asar), configurable: true });
}
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
let finished = false;
const finish = error => {
  if (finished) return;
  finished = true;
  console.log(JSON.stringify({ modelDownload: error ? 'failed' : 'passed', profile, error: error?.stack }));
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  app.exit(error ? 1 : 0);
};
const timeout = setTimeout(() => finish(new Error('Model download check timed out')), 15 * 60_000);
app.on('browser-window-created', (_event, win) => {
  if (BrowserWindow.getAllWindows().length > 1) return;
  win.webContents.once('did-finish-load', async () => {
    try {
      const js = source => win.webContents.executeJavaScript(source);
      const before = await js('window.desktop.aiDj.modelsStatus()');
      if (before.ready) throw new Error('Empty profile unexpectedly ready');
      await js('window.downloadStates = []; window.desktop.aiDj.onModelsStatus(state => { downloadStates.push(state.phase); }); void 0;');
      const started = Date.now();
      const installed = await js('window.desktop.aiDj.downloadModels()');
      if (!installed.ready || installed.received !== installed.total) throw new Error(JSON.stringify(installed));
      const states = await js('[...new Set(downloadStates)]');
      if (!states.includes('downloading') || !states.includes('installing') || !states.includes('ready')) throw new Error('Missing download lifecycle');
      const ready = await js('window.desktop.aiDj.readiness()');
      if (!ready.ready) throw new Error(ready.error);
      // Source networking must no longer be needed by either voice.
      session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://*/*', 'http://*/*'] }, (_details, callback) => callback({ cancel: true }));
      for (const voice of ['Michael', 'Heart']) {
        const result = await js(`window.desktop.aiDj.preview('${voice}').then(result => ({ length: result.wavBase64.length, header: atob(result.wavBase64.slice(0, 8)).slice(0, 4) }))`);
        if (result.header !== 'RIFF' || result.length < 1000) throw new Error('Voice preview failed: ' + voice);
        await js('window.desktop.aiDj.cancel()');
      }
      console.log(JSON.stringify({ bytes: installed.total, seconds: (Date.now() - started) / 1000, states, voices: ['Michael', 'Heart'], packaged: !!asar }));
      clearTimeout(timeout); finish();
    } catch (error) { finish(error); }
  });
});
require(asar ? path.join(asar, 'electron/dist/main.cjs') : '../electron/dist/main.cjs');
