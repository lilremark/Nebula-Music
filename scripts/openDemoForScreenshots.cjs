// Open the real app with a fresh profile for Computer Use screenshots.
// No installed settings, vault, library or playback session is read.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-readme-demo-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('mute-audio');
app.getAppPath = () => path.resolve(__dirname, '..');
app.on('browser-window-created', (_event, win) => {
  if (BrowserWindow.getAllWindows().length === 1) win.setContentSize(1440, 960);
});
console.log(JSON.stringify({ demoScreenshotProfile: profile }));
require('../electron/dist/main.cjs');
