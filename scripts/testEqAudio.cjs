// Exercise the production preamp code in Chromium's real Web Audio engine.
// The hidden window uses OfflineAudioContext; no sound reaches the speakers.
const { app, BrowserWindow } = require('electron');
const { build } = require('esbuild');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-eq-audio-')));
const timeout = setTimeout(() => { console.error('EQ audio test timed out'); app.exit(1); }, 30_000);

app.whenReady().then(async () => {
  const bundle = await build({
    stdin: {
      resolveDir: path.resolve(__dirname, '..'), loader: 'ts',
      contents: `
        import { getEqPreampGain, applyEqPreamp } from './services/eqPreamp';
        export async function run() {
          const eq = {
            enabled: true, preset: 'custom', bands: {},
            autoEq: { name: 'Test', source: 'Test', path: 'Test', appliedAt: 0, preamp: -7 },
          };
          async function render(settings, change = false) {
            const rate = 48000;
            const ctx = new OfflineAudioContext(1, rate, rate);
            const buffer = ctx.createBuffer(1, rate, rate);
            const samples = buffer.getChannelData(0);
            for (let i = 0; i < samples.length; i++) samples[i] = 0.99 * Math.sin(2 * Math.PI * 2000 * i / rate);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const preamp = ctx.createGain();
            preamp.gain.value = getEqPreampGain(settings);
            const boost = ctx.createBiquadFilter();
            boost.type = 'peaking'; boost.frequency.value = 2000; boost.Q.value = 1.1;
            boost.gain.value = settings.enabled ? 6 : 0;
            source.connect(preamp); preamp.connect(boost); boost.connect(ctx.destination);
            if (change) applyEqPreamp(preamp, { ...settings, autoEq: { ...settings.autoEq, preamp: -12 } }, 0.25);
            source.start();
            const result = (await ctx.startRendering()).getChannelData(0);
            const peak = (start, end) => {
              let maximum = 0;
              for (let i = Math.floor(start * rate); i < Math.floor(end * rate); i++) maximum = Math.max(maximum, Math.abs(result[i]));
              return maximum;
            };
            return { total: peak(0, 1), settled: peak(0.8, 1) };
          }
          const corrected = await render(eq);
          const uncompensated = await render({ ...eq, autoEq: null });
          const bypassed = await render({ ...eq, enabled: false });
          const changed = await render(eq, true);
          if (corrected.total >= 1 || corrected.settled < 0.87 || corrected.settled > 0.90)
            throw new Error('Preamp did not provide the expected headroom: ' + JSON.stringify(corrected));
          if (uncompensated.settled < 1.9) throw new Error('Test tone did not exercise clipping risk');
          if (Math.abs(bypassed.settled - 0.99) > 0.001) throw new Error('EQ bypass changed the original signal');
          if (changed.total >= 1 || changed.settled < 0.49 || changed.settled > 0.51)
            throw new Error('Live preamp change produced unexpected output: ' + JSON.stringify(changed));
          return { corrected, uncompensated, bypassed, changed };
        }
      `,
    },
    bundle: true, write: false, format: 'iife', globalName: 'eqAudioTest', platform: 'browser',
  });
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadURL('data:text/html,<title>EQ audio regression</title>');
  const peaks = await win.webContents.executeJavaScript(`${bundle.outputFiles[0].text}\neqAudioTest.run()`);
  console.log(JSON.stringify({ eqAudio: 'passed', peaks }));
  clearTimeout(timeout);
  win.destroy();
  app.exit(0);
}).catch(error => { console.error(error); clearTimeout(timeout); app.exit(1); });
