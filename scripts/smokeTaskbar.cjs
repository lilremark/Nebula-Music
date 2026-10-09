// Run after build:electron. Uses a disposable profile and an unfocused,
// offscreen window; never changes the installed Nebula session.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-taskbar-smoke-'));
app.setPath('userData', profile);
app.getAppPath = () => path.resolve(__dirname, '..');
BrowserWindow.prototype.show = function () {
  this.setPosition(-10000, -10000);
  this.showInactive();
};
BrowserWindow.prototype.focus = function () {};
const nativeSetButtons = BrowserWindow.prototype.setThumbarButtons;
// Control playback snapshots without contacting a music server.
const nativeEmit = ipcMain.emit;
ipcMain.emit = function (channel, ...args) {
  if (channel === 'nebula:playback:snapshot' && args[1]?.ownerId !== 'taskbar-smoke') return false;
  return nativeEmit.call(this, channel, ...args);
};
let attempts = 0;
let registered = false;
let latestButtons = [];
const registrations = [];
BrowserWindow.prototype.setThumbarButtons = function (buttons) {
  if (buttons.length !== 3) return nativeSetButtons.call(this, buttons);
  attempts += 1;
  latestButtons = buttons;
  registrations.push(buttons);
  if (buttons.some(button => button.icon.isEmpty())) throw new Error('Missing taskbar icon');
  // Model Windows rejecting registration before its taskbar button is ready.
  if (attempts === 1) return false;
  const accepted = nativeSetButtons.call(this, buttons);
  registered ||= accepted;
  return accepted;
};

let finished = false;
const finish = (error) => {
  if (finished) return;
  finished = true;
  console.log(JSON.stringify({ taskbarSmoke: error ? 'failed' : 'passed', attempts, registered, error: error?.message }));
  app.exit(error ? 1 : 0);
};
setTimeout(() => finish(new Error('Taskbar startup timed out')), 15000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!registrations.some(buttons => buttons.every(button => button.flags?.includes('disabled')))) {
        throw new Error('Toolbar was not initialized before the first playback snapshot');
      }
      // Same playback state on both publishes: a failed registration must retry.
      const publish = `window.desktop.playback.publishSnapshot({
        v: 1, ownerId: 'taskbar-smoke', epoch: 1, playing: false,
        track: { id: 'fixture', title: 'Fixture', artist: 'Smoke test' },
        positionSeconds: 0, durationSeconds: 180, volume: 1, muted: false,
        playbackRate: 1, repeatMode: 'OFF', updatedAt: Date.now(), upcoming: []
      })`;
      await win.webContents.executeJavaScript(publish);
      await new Promise(resolve => setTimeout(resolve, 500));
      await win.webContents.executeJavaScript(publish);
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (!registered || attempts < 2) throw new Error('Preview controls missing after rejected initial registration');
      if (latestButtons.map(button => button.tooltip).join(',') !== 'Previous,Play,Next') {
        throw new Error('Incorrect transport controls');
      }
      const acceptedAttempts = attempts;
      await win.webContents.executeJavaScript(publish);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (attempts !== acceptedAttempts) throw new Error('Unchanged snapshots unnecessarily rebuild the toolbar');

      await win.webContents.executeJavaScript(publish.replace('playing: false', 'playing: true'));
      await new Promise(resolve => setTimeout(resolve, 100));
      if (latestButtons[1].tooltip !== 'Pause') throw new Error('Play/Pause did not follow playback');
      const commands = [];
      const nativeSend = win.webContents.send.bind(win.webContents);
      win.webContents.send = (channel, ...args) => {
        if (channel === 'nebula:playback:command') commands.push(args[0]);
        else nativeSend(channel, ...args);
      };
      latestButtons.forEach(button => button.click());
      if (commands.map(envelope => envelope.command.name).join(',') !== 'previous,togglePlayback,next' ||
          commands.some(envelope => envelope.epoch !== 1) ||
          new Set(commands.map(envelope => envelope.seq)).size !== 3) {
        throw new Error('Transport buttons did not dispatch through the playback owner');
      }
      const beforeShow = attempts;
      win.hide();
      win.show();
      await new Promise(resolve => setTimeout(resolve, 200));
      if (attempts <= beforeShow || latestButtons[1].tooltip !== 'Pause') {
        throw new Error('Toolbar was not restored when returning from the tray');
      }
      finish();
    } catch (error) { finish(error); }
  });
});
require('../electron/dist/main.cjs');
