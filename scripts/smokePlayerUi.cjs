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
const timeout = setTimeout(() => finish(new Error('Player UI check timed out')), 60_000);
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
        document.querySelector('[aria-label="Switch to waveform"]')?.click();
        await waitFor(() => document.querySelector('.nebula-transport-waveform span'), 'decoded stereo waveform');
        const waveform = document.querySelector('.nebula-transport-waveform');
        const slider = waveform?.querySelector('input[aria-label="Playback position"]');
        if (!slider || waveform.querySelectorAll('span').length < 500 || slider.getBoundingClientRect().height < 95)
          throw new Error('Bottom waveform is missing or its seek input is compressed');
        const dock = document.querySelector('.nebula-transport');
        const dockBounds = dock.getBoundingClientRect();
        const paneBounds = document.querySelector('[data-nebula-content-shell]').getBoundingClientRect();
        if (dockBounds.width >= paneBounds.width - 20 || Math.abs(dockBounds.left + dockBounds.width / 2 - paneBounds.left - paneBounds.width / 2) > 1 || parseFloat(getComputedStyle(dock).borderRadius) < 18)
          throw new Error('Bottom dock is not centered and rounded');
        if (document.querySelector('.nebula-transport-progress').getBoundingClientRect().bottom > document.querySelector('.nebula-transport-track').getBoundingClientRect().top + 1)
          throw new Error('Dock waveform is not above the control row');
        await waitFor(() => [...document.querySelectorAll('audio')].some(audio => !audio.paused && audio.currentTime > 0), 'fixture audio playback');
        const marker = waveform.querySelector('[style*="left: calc"]');
        const before = marker.style.left;
        await new Promise(resolve => setTimeout(resolve, 80));
        if (marker.style.left === before) throw new Error('Playhead is not advancing with real audio');
        document.querySelector('[aria-label="Switch to progress bar"]').click();
        await waitFor(() => document.querySelector('.has-progress-bar'), 'progress bar toggle');
        document.querySelector('[aria-label="Switch to waveform"]').click();
        await waitFor(() => document.querySelector('.has-waveform'), 'waveform toggle');
        document.querySelector('[aria-label="Speed and pitch controls"]').click();
        if (!document.querySelector('.nebula-speed-pitch[open] input[aria-label="Playback speed"]') || !document.querySelector('input[aria-label="Playback pitch"]')) throw new Error('Speed and pitch controls missing');
        document.querySelector('[aria-label="Speed and pitch controls"]').click();
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
        const expected = { Connection: ['Server Connection'], Sound: ['Equalizer', 'Playback'], Interface: ['Appearance', 'Player Display', 'Visualizer Style', 'Navigation Items', 'Keyboard Shortcuts'], Integrations: ['Stream Deck'], Desktop: ['Desktop Integration', 'Updates'] };
        for (const button of buttons) {
          button.click();
          await new Promise(resolve => setTimeout(resolve, 50));
          const titles = [...document.querySelectorAll('[data-nebula-settings-panel-heading] h2')].map(heading => heading.textContent);
          if (JSON.stringify(titles) !== JSON.stringify(expected[button.textContent.trim()])) throw new Error('Settings section does not isolate its options: ' + titles);
        }
        buttons[0].click();
        await new Promise(resolve => setTimeout(resolve, 50));
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
        if (overflow || !slider || slider.getBoundingClientRect().height < 95) throw new Error('Narrow layout overflow');
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
          if (actual.left < document.querySelector('.nebula-rail').getBoundingClientRect().right - 1 || getComputedStyle(document.querySelector('.nebula-transport')).position !== 'fixed' || layer.contains(document.querySelector('.nebula-transport')))
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
      const checkCollection = async kind => {
        const scrollResult = await win.webContents.executeJavaScript(`(async () => {
          const view = document.querySelector('[data-nebula-view="${kind}-detail"]');
          const scroller = document.querySelector('[data-nebula-main-scroll]');
          const header = view.querySelector('[data-nebula-collection-header]');
          const list = view.querySelector('[data-nebula-track-list]');
          const row = list.querySelector('[data-nebula-track-row]');
          if (parseFloat(getComputedStyle(list).borderTopWidth) !== 0 || parseFloat(getComputedStyle(list).borderRadius) !== 0 || parseFloat(getComputedStyle(row).borderBottomWidth) <= 0)
            throw new Error('${kind} track list still uses a card or lacks dividers');
          const rowBounds = row.getBoundingClientRect();
          const paneBounds = scroller.getBoundingClientRect();
          if (Math.abs(rowBounds.left - paneBounds.left) > 1 || Math.abs(rowBounds.right - paneBounds.left - scroller.clientWidth) > 1) throw new Error('${kind} rows do not reach the pane edges');
          // Add offline DOM rows to exercise scrolling through a long collection.
          for (let i = 0; i < 16; i++) list.append(row.cloneNode(true));
          scroller.scrollTop = 0;
          await new Promise(resolve => setTimeout(resolve, 100));
          const fullHeight = header.getBoundingClientRect().height;
          const documentHeight = scroller.scrollHeight;
          scroller.scrollTo({ top: 420, behavior: 'instant' });
          for (let i = 0; i < 100 && header.dataset.compact !== 'true'; i++) await new Promise(resolve => setTimeout(resolve, 25));
          const cover = header.querySelector('[data-nebula-detail-cover]').getBoundingClientRect();
          const compact = header.getBoundingClientRect();
          if (header.dataset.compact !== 'true' || compact.height >= fullHeight || cover.width > 49 || Math.abs(compact.top - scroller.getBoundingClientRect().top) > 1)
            throw new Error('${kind} header does not shrink and stick above the tracks');
          if (Math.abs(scroller.scrollHeight - documentHeight) > 1) throw new Error('${kind} header changes document height while scrolling');
          if (!header.querySelector('h1').textContent.trim() || !header.querySelector('[data-nebula-album-options] button')) throw new Error('Compact collection controls are missing');
          return { collection: '${kind}', stickyHeader: true, stableScrollHeight: true, compactCover: cover.width };
        })()`);
        console.log(JSON.stringify(scrollResult));
        win.setContentSize(1101, 850);
        await new Promise(resolve => setTimeout(resolve, 100));
        win.setContentSize(1100, 850);
        await new Promise(resolve => setTimeout(resolve, 300));
        fs.writeFileSync(path.join(profile, kind + '-compact.png'), (await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript(`(async () => {
          const header = document.querySelector('[data-nebula-collection-header]');
          document.querySelector('[data-nebula-main-scroll]').scrollTo({ top: 0, behavior: 'instant' });
          for (let i = 0; i < 100 && header.dataset.compact !== 'false'; i++) await new Promise(resolve => setTimeout(resolve, 25));
          if (header.dataset.compact !== 'false' || header.querySelector('[data-nebula-detail-cover]').getBoundingClientRect().width < 279) throw new Error('Collection header did not expand again');
        })()`);
      };
      await checkCollection('album');
      await win.webContents.executeJavaScript(`(async () => {
        [...document.querySelectorAll('.nebula-rail button')].find(button => button.textContent.trim() === 'Playlists').click();
        for (let i = 0; i < 200; i++) {
          const card = document.querySelector('[data-nebula-library="playlists"] [data-nebula-collection-card]');
          if (card) { card.click(); break; }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        for (let i = 0; i < 200; i++) {
          if (document.querySelector('[data-nebula-view="playlist-detail"] [data-nebula-track-row]')) return;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        throw new Error('Playlist did not open');
      })()`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await checkCollection('playlist');
      // The shared web layout must also fit a phone-sized content pane.
      win.setMinimumSize(320, 480);
      win.setContentSize(390, 760);
      await new Promise(resolve => setTimeout(resolve, 500));
      await win.webContents.executeJavaScript(`(async () => {
        const view = document.querySelector('[data-nebula-view="playlist-detail"]');
        if (document.querySelectorAll('footer[aria-label="Playback controls"]').length !== 1 || document.querySelector('.fixed.bottom-0.left-0.right-0.z-50')) throw new Error('Mobile player ownership is duplicated');
        const mobileDock = document.querySelector('.nebula-transport');
        if (mobileDock.scrollWidth > mobileDock.clientWidth + 1) throw new Error('Mobile dock overflows');
        if (view.scrollWidth > view.clientWidth + 1) throw new Error('Mobile collection overflows horizontally');
        const scroller = document.querySelector('[data-nebula-main-scroll]');
        const header = view.querySelector('[data-nebula-collection-header]');
        scroller.scrollTo({ top: 420, behavior: 'instant' });
        for (let i = 0; i < 100 && header.dataset.compact !== 'true'; i++) await new Promise(resolve => setTimeout(resolve, 25));
        if (header.dataset.compact !== 'true' || header.querySelector('[data-nebula-detail-cover]').getBoundingClientRect().width > 49) throw new Error('Mobile header does not compact');
        scroller.scrollTo({ top: 0, behavior: 'instant' });
      })()`);
      fs.writeFileSync(path.join(profile, 'collection-mobile.png'), (await win.webContents.capturePage()).toPNG());
      win.setContentSize(1100, 600);
      await new Promise(resolve => setTimeout(resolve, 500));
      const compact = await win.webContents.executeJavaScript(`(() => {
        const body = document.querySelector('.nebula-rail-body');
        if (getComputedStyle(body).overflowY !== 'hidden' || body.scrollHeight > body.clientHeight + 1) throw new Error('Sidebar still needs scrolling');
        const core = document.querySelector('.nebula-rail-core').getBoundingClientRect();
        if (core.bottom > body.getBoundingClientRect().bottom + 1) throw new Error('Sidebar navigation is clipped');
        const count = document.querySelectorAll('.nebula-rail-playlist').length;
        const navRows = [...document.querySelectorAll('.nebula-rail-core .nebula-rail-item')].map(item => item.getBoundingClientRect());
        if (navRows.some((row, index) => index > 0 && row.top < navRows[index - 1].bottom - 1)) throw new Error('Sidebar navigation is not vertical');
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
      if (tallPlaylists < compact.playlistCount || tallPlaylists > 4) throw new Error('Playlist shortcuts do not fit the available height');
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
      win.setContentSize(900, 760);
      await new Promise(resolve => setTimeout(resolve, 400));
      await win.webContents.executeJavaScript(`(async () => {
        const dock = document.querySelector('.nebula-transport');
        if (!dock || document.querySelector('[data-nebula-panel="now-playing"]')) throw new Error('Narrow desktop player is missing or duplicated');
        const bounds = dock.getBoundingClientRect();
        if (Math.abs(bounds.left + bounds.width / 2 - innerWidth / 2) > 1 || dock.querySelector('[aria-label="Volume"]').getBoundingClientRect().width < 50) throw new Error('Narrow dock controls do not fit');
        dock.querySelector('[aria-label="Open full screen player"]').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const full = document.querySelector('[data-nebula-player="fullscreen"]');
        if (!full.classList.contains('translate-y-0') || Number(getComputedStyle(full).zIndex) <= Number(getComputedStyle(dock).zIndex)) throw new Error('Full player is covered by the dock');
        full.querySelector('[aria-label="Close player"]').click();
      })()`);
      console.log(JSON.stringify({ mobileCollection: true, narrowDock: true, fullscreenLayering: true }));
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
