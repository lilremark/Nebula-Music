// Run with Electron, after build:electron. Reports per-process memory and CPU for the
// real desktop app in a disposable profile, signed into demo mode:
// visible-and-idle, then hidden (the tray case). The window is shown fully transparent and without
// focus, so nothing appears on screen. Usage: npm run measure:memory [-- --settle=8000]
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const settleArg = process.argv.find(arg => arg.startsWith('--settle='));
const SETTLE_MS = settleArg ? Number(settleArg.slice('--settle='.length)) : 8_000;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-memory-'));
app.setPath('userData', profile);
app.getAppPath = () => path.resolve(__dirname, '..');
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.focus = function () {};

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const mb = kb => Math.round((kb / 1024) * 10) / 10;

const sample = async win => {
  // Let GC and compositor settle, then take the median of a few samples.
  await win.webContents.executeJavaScript('new Promise(r => setTimeout(r, 0))');
  const runs = [];
  for (let i = 0; i < 5; i++) {
    runs.push(app.getAppMetrics());
    await pause(500);
  }
  const byType = {};
  const cpuByType = {};
  for (const metrics of runs) {
    const totals = {};
    const cpu = {};
    for (const proc of metrics) {
      const key = proc.name ? `${proc.type}:${proc.name}` : proc.type;
      const value = proc.memory.privateBytes ?? proc.memory.workingSetSize;
      totals[key] = (totals[key] ?? 0) + value;
      cpu[key] = (cpu[key] ?? 0) + proc.cpu.percentCPUUsage;
    }
    for (const [key, value] of Object.entries(totals)) (byType[key] ??= []).push(value);
    for (const [key, value] of Object.entries(cpu)) (cpuByType[key] ??= []).push(value);
  }
  const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const processes = Object.fromEntries(Object.entries(byType).map(([key, values]) => [key, mb(median(values))]));
  const cpuPercent = Object.fromEntries(Object.entries(cpuByType).map(([key, values]) => [key, Math.round(median(values) * 10) / 10]));
  const { heap, visibility } = await win.webContents.executeJavaScript(`({
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null,
    visibility: document.visibilityState,
  })`);
  const total = Math.round(Object.values(processes).reduce((sum, value) => sum + value, 0) * 10) / 10;
  return { totalMB: total, visibility, rendererJsHeapMB: heap, processesMB: processes, cpuPercent };
};

let finished = false;
const finish = (result, error) => {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  console.log(JSON.stringify({ memory: error ? 'failed' : 'measured', metric: process.platform === 'win32' ? 'privateBytes' : 'workingSet', ...result, error: error?.message }, null, 2));
  setImmediate(() => error ? app.exit(1) : app.quit());
};
const timeout = setTimeout(() => finish({}, new Error('Memory measurement timed out.')), 120_000);

app.once('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      win.setOpacity(0);
      win.setSkipTaskbar(true);
      win.showInactive();
      const entered = await win.webContents.executeJavaScript(`(async () => {
        for (let i = 0; i < 100; i++) {
          const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Try Demo Mode'));
          if (button) { button.click(); return true; }
          await new Promise(r => setTimeout(r, 100));
        }
        return false;
      })()`);
      if (!entered) throw new Error('Demo mode button not found.');
      await pause(SETTLE_MS);
      const visible = await sample(win);
      win.hide();
      await pause(SETTLE_MS);
      const hidden = await sample(win);
      finish({ settleMs: SETTLE_MS, visible, hidden });
    } catch (error) { finish({}, error); }
  });
});
require('../electron/dist/main.cjs');
