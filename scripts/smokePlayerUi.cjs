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
  console.log(JSON.stringify({ playerUi: error ? 'failed' : 'passed', screenshots: profile, error: error?.stack }));
  app.exit(error ? 1 : 0);
};
const timeout = setTimeout(() => finish(new Error('Player UI check timed out')), 45_000);
app.whenReady().then(() => {
  // Offline artwork exercises real color extraction; all media/API traffic is blocked.
  const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#c06040"/><circle cx="340" cy="160" r="80" fill="#e8af70"/><path d="M0 400L512 230V512H0Z" fill="#722c24"/></svg>';
  for (const scheme of ['https', 'http']) session.defaultSession.protocol.handle(scheme, () => new Response(artwork, { headers: {
    'Content-Type': 'image/svg+xml', 'Access-Control-Allow-Origin': '*',
  } }));
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://*/*', 'http://*/*'] }, (details, callback) => callback({ cancel: details.resourceType !== 'image' }));
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
        document.querySelector('.nebula-topbar-theme[aria-label="Switch to dark theme"]')?.click();
        await waitFor(() => document.documentElement.classList.contains('dark'), 'dark theme');
        const intro = document.querySelector('.nebula-home-intro');
        if (intro.querySelector('h1').textContent !== 'Home') throw new Error('Home was not renamed');
        if (intro.querySelector('button, p') || document.querySelector('.nebula-rail-brand small'))
          throw new Error('Home shortcuts or introductory copy remained visible');
        if (document.querySelector('.nebula-rail-footer button[aria-label*="theme"]'))
          throw new Error('Sidebar appearance toggle remained visible');
        const logo = document.querySelector('.nebula-rail-brand img');
        await waitFor(() => logo?.complete && logo.naturalWidth > 0, 'official logo');
        if (!logo.src.includes('logo-') || getComputedStyle(document.querySelector('.nebula-next')).backgroundColor !== 'rgb(0, 0, 0)')
          throw new Error('Official branding or OLED background was not applied');
        if (parseFloat(getComputedStyle(document.querySelector('.nebula-rail-status strong')).fontSize) < 13)
          throw new Error('Sidebar connection status is too small');
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
      win.setContentSize(1451, 1050);
      await new Promise(resolve => setTimeout(resolve, 100));
      win.setContentSize(1450, 1050);
      await new Promise(resolve => setTimeout(resolve, 1000));
      fs.writeFileSync(path.join(profile, 'home-side-player.png'), (await win.webContents.capturePage()).toPNG());
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
        if (!document.querySelector('[data-nebula-settings-panel-heading] p'))
          throw new Error('Settings descriptions were removed');
        if (document.querySelector('[data-nebula-settings-intro] p')) throw new Error('Settings introductory copy remained');
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
      const visual = await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async (check, label) => {
          for (let i = 0; i < 200; i++) {
            if (check()) return;
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          throw new Error('UI did not reach: ' + label);
        };
        const railButton = text => {
          const button = [...document.querySelectorAll('.nebula-rail button')].find(button => button.textContent.trim() === text);
          if (!button) throw new Error('Missing sidebar button: ' + text);
          return button;
        };
        const click = selector => {
          const element = document.querySelector(selector);
          if (!element) throw new Error('Missing click target: ' + selector);
          element.click();
        };
        railButton('Internet Radio').click();
        await waitFor(() => document.querySelector('[data-nebula-view="radio"]'), 'radio view');
        [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'New Station').click();
        await waitFor(() => document.querySelector('[data-nebula-radio-modal]'), 'station dialog');
        const shell = document.querySelector('[data-nebula-content-shell]');
        const assertOverlay = (kind, blur) => {
          const layer = document.querySelector('[data-nebula-content-modal="' + kind + '"]');
          const backdrop = layer.querySelector('[data-nebula-modal-backdrop]');
          const actual = backdrop.getBoundingClientRect();
          const expected = shell.getBoundingClientRect();
          if (layer.parentElement !== shell || ['top', 'left', 'width', 'height'].some(key => Math.abs(actual[key] - expected[key]) > 1))
            throw new Error(kind + ' backdrop does not fill the central pane');
          if (getComputedStyle(backdrop).backdropFilter !== 'blur(' + blur + 'px)') throw new Error(kind + ' blur is incorrect');
          if (actual.left < document.querySelector('.nebula-rail').getBoundingClientRect().right - 1 || actual.bottom > document.querySelector('.nebula-transport').getBoundingClientRect().top + 1)
            throw new Error(kind + ' overlay covers navigation or bottom playback');
        };
        assertOverlay('radio', 4);
        click('[aria-label="Close station modal"]');
        railButton('Browse').click();
        await waitFor(() => document.querySelector('[data-nebula-view="browse"]'), 'browse view');
        if (document.querySelector('.nebula-browse-categories')) throw new Error('Browse shortcuts remained');
        railButton('Search').click();
        await waitFor(() => document.querySelector('[data-nebula-content-modal="search"]'), 'search dialog');
        assertOverlay('search', 2);
        click('[data-nebula-modal-backdrop]');
        railButton('Albums').click();
        await waitFor(() => {
          const card = document.querySelector('[data-nebula-library="albums"] [data-nebula-collection-card]');
          if (!card) return false;
          card.click();
          return true;
        }, 'album library');
        await waitFor(() => document.querySelector('[data-nebula-view="album-detail"] [data-nebula-track-row]'), 'album view');
        const album = document.querySelector('[data-nebula-view="album-detail"]');
        await waitFor(() => album.style.getPropertyValue('--album-color').startsWith('#'), 'artwork palette');
        const hero = album.querySelector('[data-nebula-detail-hero-inner]');
        if (hero.querySelector(':scope > button') || !document.querySelector('[aria-label="Go back"]')) throw new Error('Album back navigation is incorrect');
        if (album.querySelector('[data-nebula-detail-cover]').getBoundingClientRect().width < 279 || parseFloat(getComputedStyle(album.querySelector('h1')).fontSize) < 36)
          throw new Error('Album hero was not enlarged');
        if (parseFloat(getComputedStyle(album.querySelector('[data-nebula-track-title]')).fontSize) < 16 || album.querySelector('[data-nebula-track-actions] button').getBoundingClientRect().height < 40)
          throw new Error('Album track controls are too small');
        if (!getComputedStyle(album).backgroundImage.includes('gradient')) throw new Error('Album colors are not blended');
        return { albumColor: album.style.getPropertyValue('--album-color'), modalScoping: true, subtleSearchBlur: true, albumControls: true };
      })()`);
      console.log(JSON.stringify(visual));
      win.setContentSize(1101, 850);
      await new Promise(resolve => setTimeout(resolve, 100));
      win.setContentSize(1100, 850);
      await new Promise(resolve => setTimeout(resolve, 1000));
      fs.writeFileSync(path.join(profile, 'album-detail.png'), (await win.webContents.capturePage()).toPNG());
      win.setContentSize(1100, 600);
      await new Promise(resolve => setTimeout(resolve, 500));
      const compact = await win.webContents.executeJavaScript(`(() => {
        const body = document.querySelector('.nebula-rail-body');
        if (getComputedStyle(body).overflowY !== 'hidden' || body.scrollHeight > body.clientHeight + 1) throw new Error('Sidebar still needs scrolling');
        const core = document.querySelector('.nebula-rail-core').getBoundingClientRect();
        if (core.bottom > body.getBoundingClientRect().bottom + 1) throw new Error('Sidebar navigation is clipped');
        const count = document.querySelectorAll('.nebula-rail-playlist').length;
        if (count > 4) throw new Error('Too many sidebar playlists');
        return { compactSidebar: true, playlistCount: count };
      })()`);
      console.log(JSON.stringify(compact));
      fs.writeFileSync(path.join(profile, 'sidebar-compact.png'), (await win.webContents.capturePage()).toPNG());
      // Exercise the taller connected-server footer without opening a real account.
      await win.webContents.executeJavaScript(`(() => {
        const status = document.querySelector('.nebula-rail-status > div');
        status.querySelector('strong').textContent = 'Connected to server';
        const server = document.createElement('span');
        server.className = 'nebula-rail-server';
        server.textContent = 'music.example.test/a-long-server-path';
        status.append(server);
      })()`);
      for (const height of [650, 700, 750, 800, 845, 850, 1050]) {
        win.setContentSize(1100, height);
        await new Promise(resolve => setTimeout(resolve, 150));
        await win.webContents.executeJavaScript(`(() => {
          const body = document.querySelector('.nebula-rail-body');
          if (body.scrollHeight > body.clientHeight + 1) throw new Error('Sidebar clips at window height ${height}: ' + body.scrollHeight + '/' + body.clientHeight);
        })()`);
      }
      console.log(JSON.stringify({ sidebarHeightSweep: true }));
      const tallPlaylists = await win.webContents.executeJavaScript(`document.querySelectorAll('.nebula-rail-playlist').length`);
      if (tallPlaylists <= compact.playlistCount || tallPlaylists > 4) throw new Error('Playlist shortcuts do not adapt to available height');
      win.setContentSize(1100, 850);
      await win.webContents.executeJavaScript(`(async () => {
        const radio = [...document.querySelectorAll('.nebula-rail button')].find(button => button.textContent.trim() === 'Internet Radio');
        radio.click();
        for (let i = 0; i < 200; i++) {
          const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'New Station');
          if (button) { button.click(); return; }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        throw new Error('Radio did not open for visual capture');
      })()`);
      win.setContentSize(1101, 850);
      await new Promise(resolve => setTimeout(resolve, 100));
      win.setContentSize(1100, 850);
      await new Promise(resolve => setTimeout(resolve, 1000));
      fs.writeFileSync(path.join(profile, 'radio-modal.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`(() => {
        document.querySelector('[aria-label="Close station modal"]').click();
        [...document.querySelectorAll('.nebula-rail button')].find(button => button.textContent.trim() === 'Search').click();
      })()`);
      win.setContentSize(1101, 850);
      await new Promise(resolve => setTimeout(resolve, 100));
      win.setContentSize(1100, 850);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const searchDialog = await win.webContents.executeJavaScript(`(() => {
        const style = getComputedStyle(document.querySelector('.nebula-search-dialog'));
        if (style.backdropFilter !== 'none' || style.backgroundColor !== 'rgb(16, 16, 16)') throw new Error('Search dialog has an extra glass backdrop');
        return { searchDialogOpaque: true, opacity: style.opacity };
      })()`);
      console.log(JSON.stringify(searchDialog));
      fs.writeFileSync(path.join(profile, 'search-modal.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`document.querySelector('[data-nebula-modal-backdrop]').click()`);
      await win.webContents.executeJavaScript(`(async () => {
        document.querySelector('.nebula-topbar-theme[aria-label="Switch to light theme"]').click();
        await new Promise(resolve => setTimeout(resolve, 300));
        if (document.documentElement.classList.contains('dark') || getComputedStyle(document.querySelector('.nebula-next')).backgroundColor === 'rgb(0, 0, 0)')
          throw new Error('Light theme no longer works');
      })()`);
      clearTimeout(timeout);
      finish();
    } catch (error) { finish(error); }
  });
});
require('../electron/dist/main.cjs');
