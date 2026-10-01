// Production Electron UI regression check. Uses a disposable profile, hidden
// windows, muted audio, and demo data; never connects an installed account.
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-player-ui-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('mute-audio');
app.getAppPath = () => path.resolve(__dirname, '..');
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};
let finished = false;
const finish = error => {
  if (finished) return;
  finished = true;
  console.log(JSON.stringify({ playerUi: error ? 'failed' : 'passed', screenshots: profile, error: error?.message }));
  app.exit(error ? 1 : 0);
};
const timeout = setTimeout(() => finish(new Error('Player UI check timed out')), 45_000);
app.whenReady().then(() => {
  // Offline demo playback keeps the check deterministic and avoids external media.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://*/*', 'http://*/*'] }, (_details, callback) => callback({ cancel: true }));
});
app.on('browser-window-created', (_event, win) => {
  win.setContentSize(1450, 1050);
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async (check, label) => {
          for (let i = 0; i < 200; i++) {
            if (check()) return;
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          throw new Error('UI did not reach: ' + label);
        };
        const findButton = text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text);
        await waitFor(() => findButton('Try Demo Mode'), 'demo setup');
        findButton('Try Demo Mode').click();
        await waitFor(() => document.querySelector('.nebula-quick-song-play'), 'demo library');
        [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === "Close what's new")?.click();
        document.querySelector('.nebula-quick-song-play').click();
        await waitFor(() => document.querySelector('.nebula-transport'), 'bottom player');
        const waveform = document.querySelector('.nebula-transport-waveform');
        const slider = waveform?.querySelector('input[aria-label="Playback position"]');
        if (!slider || waveform.querySelectorAll('span').length !== 180 || slider.getBoundingClientRect().height < 27)
          throw new Error('Bottom waveform is missing or its seek input is compressed');
        document.querySelector('[aria-label="Open now playing panel"]').click();
        await waitFor(() => document.querySelector('[data-nebula-panel="now-playing"]'), 'side player');
        if (document.querySelector('.nebula-transport')) throw new Error('Bottom and side players are visible together');
      })()`);
      // An open sidebar must give way to the bottom player below its breakpoint.
      win.setContentSize(1100, 850);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await win.webContents.executeJavaScript(`(() => {
        if (!document.querySelector('.nebula-transport') || document.querySelector('[data-nebula-panel="now-playing"]'))
          throw new Error('Responsive layout did not replace the side player');
      })()`);
      win.setContentSize(1450, 1050);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const result = await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async (check, label) => {
          for (let i = 0; i < 200; i++) {
            if (check()) return;
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          throw new Error('UI did not reach: ' + label);
        };
        const findButton = text => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text);
        await waitFor(() => document.querySelector('[data-nebula-panel="now-playing"]'), 'restored side player');
        if (document.querySelector('.nebula-transport')) throw new Error('Wide layout showed both players');
        document.querySelector('[aria-label="Collapse now playing panel"]').click();
        await waitFor(() => document.querySelector('.nebula-transport'), 'restored bottom player');
        if (document.querySelector('[data-nebula-panel="now-playing"]')) throw new Error('Side player remained mounted after collapse');
        findButton('Settings').click();
        await waitFor(() => document.querySelector('[data-nebula-settings-jumps]'), 'settings');
        await waitFor(() => document.querySelector('[data-nebula-http-consent]'), 'HTTP consent');
        const nav = document.querySelector('[data-nebula-settings-jumps]');
        const buttons = [...nav.querySelectorAll('button')];
        const bounds = buttons.map(button => button.getBoundingClientRect());
        if (bounds.some(bound => bound.height < 39) || bounds.slice(1).some((bound, i) => bound.top === bounds[i].top && bound.left - bounds[i].right < 7))
          throw new Error('Settings section buttons are cramped');
        const consent = document.querySelector('[data-nebula-http-consent]');
        const checkbox = consent.querySelector('input');
        const copy = consent.querySelector('label > span');
        const action = consent.parentElement.querySelector('button[type="submit"]');
        if (checkbox.getBoundingClientRect().width < 15 || copy.children[1].getBoundingClientRect().top <= copy.children[0].getBoundingClientRect().top)
          throw new Error('HTTP consent label and warning are not separated');
        if (action.getBoundingClientRect().top - consent.getBoundingClientRect().bottom < 15)
          throw new Error('HTTP consent crowds the connection button');
        return { exclusivePlayers: true, waveform: true, settingsTabGap: getComputedStyle(nav).gap, consentSpacing: true };
      })()`);
      console.log(JSON.stringify(result));
      // Hidden windows can retain an old compositor frame until resized.
      win.setContentSize(1451, 1050);
      await new Promise(resolve => setTimeout(resolve, 100));
      win.setContentSize(1450, 1050);
      await new Promise(resolve => setTimeout(resolve, 1000));
      fs.writeFileSync(path.join(profile, 'settings-bottom-player.png'), (await win.webContents.capturePage()).toPNG());
      // Verify responsive tab wrapping and transport sizing in a narrower window.
      win.setContentSize(1100, 850);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const narrow = await win.webContents.executeJavaScript(`(() => {
        const nav = document.querySelector('[data-nebula-settings-jumps]');
        const bounds = nav.getBoundingClientRect();
        const overflow = [...nav.querySelectorAll('button')].some(button => button.getBoundingClientRect().right > bounds.right + 1);
        const slider = document.querySelector('.nebula-transport-waveform input');
        if (overflow || !slider || slider.getBoundingClientRect().height < 27) throw new Error('Narrow layout overflow');
        return { narrowLayout: true };
      })()`);
      console.log(JSON.stringify(narrow));
      fs.writeFileSync(path.join(profile, 'settings-narrow.png'), (await win.webContents.capturePage()).toPNG());
      clearTimeout(timeout);
      finish();
    } catch (error) { finish(error); }
  });
});
require('../electron/dist/main.cjs');
