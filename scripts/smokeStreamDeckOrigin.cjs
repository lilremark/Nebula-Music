// Run with Electron, after build:electron. Verifies the filtered webRequest hook
// still rewrites the Origin header on the Stream Deck loopback WebSocket
// handshake (any port) and leaves other loopback requests untouched.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-streamdeck-smoke-'));
app.setPath('userData', profile);
app.getAppPath = () => path.resolve(__dirname, '..');
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};

const seen = { bridge: null, other: null };
const server = http.createServer((req, res) => {
  seen.other = req.headers.origin ?? null;
  res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
  res.end('ok');
});
server.on('upgrade', (req, socket) => {
  if (req.url === '/nebula/v1') seen.bridge = req.headers.origin ?? null;
  socket.destroy();
});

let finished = false;
const finish = (error) => {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  server.close();
  console.log(JSON.stringify({ streamDeckOriginSmoke: error ? 'failed' : 'passed', seen, error: error?.message }));
  setImmediate(() => error ? app.exit(1) : app.quit());
};
const timeout = setTimeout(() => finish(new Error('Stream Deck origin smoke timed out.')), 30_000);

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  app.once('browser-window-created', (_event, win) => {
    win.webContents.once('did-finish-load', async () => {
      try {
        await win.webContents.executeJavaScript(`(async () => {
          await new Promise(resolve => {
            const ws = new WebSocket('ws://127.0.0.1:${port}/nebula/v1');
            ws.onerror = ws.onclose = () => resolve();
          });
          await fetch('http://127.0.0.1:${port}/other', { mode: 'cors' }).catch(() => {});
        })()`);
        if (seen.bridge !== 'http://localhost') throw new Error('Bridge handshake Origin was not rewritten.');
        if (seen.other === 'http://localhost') throw new Error('Non-bridge request Origin was rewritten.');
        finish();
      } catch (error) { finish(error); }
    });
  });
  require('../electron/dist/main.cjs');
});
