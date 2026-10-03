import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve('electron/aiDj/resources');
// Git Bash's GNU tar treats Windows drive letters as remote archive hosts.
const archiveTool = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const lock = JSON.parse(await fs.readFile('electron/aiDj/assets.lock.json', 'utf8'));
const verifyOnly = process.argv.includes('--verify');
const includeModels = process.argv.includes('--models');
const catalog = await fs.readFile('electron/aiDj/downloadCatalog.ts', 'utf8');
const downloads = JSON.parse(catalog.match(/DJ_DOWNLOADS = (\[[\s\S]*?\]) as const/)[1]);
const expected = lock.assets.filter(asset => ['model', 'tts'].includes(asset.kind));
if (downloads.length !== expected.length || expected.some(asset => !downloads.some(entry => entry.file === asset.file && entry.url === asset.url && entry.sha256 === asset.sha256 && entry.size === asset.size))) throw new Error('DJ download catalog differs from pinned assets.');
await fs.mkdir(path.join(root, 'downloads'), { recursive: true });
const digest = async file => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
for (const asset of lock.assets.filter(asset => includeModels || !['tts', 'model'].includes(asset.kind))) {
  const target = path.join(root, 'downloads', asset.file);
  const valid = await digest(target).then(hash => hash === asset.sha256).catch(() => false);
  if (!valid) {
    if (verifyOnly) throw new Error('Missing or corrupt AI DJ asset: ' + asset.file);
    console.log('Downloading ' + asset.file);
    const response = await fetch(asset.url);
    if (!response.ok || !response.body) throw new Error('Asset download failed: ' + response.status);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(target + '.partial'));
    if (await digest(target + '.partial') !== asset.sha256) throw new Error('Asset checksum mismatch: ' + asset.file);
    await fs.rename(target + '.partial', target);
  }
  if (verifyOnly) continue;
  if (asset.kind === 'notice' || asset.kind === 'source') { await fs.mkdir(path.join(root, 'notices'), { recursive: true }); await fs.copyFile(target, path.join(root, 'notices', asset.file)); }
  if (asset.kind === 'model') await fs.copyFile(target, path.join(root, asset.file));
  if (asset.kind === 'tts') {
    await fs.mkdir(path.join(root, 'packages'), { recursive: true });
    execFileSync(archiveTool, ['-xf', target, '-C', path.join(root, 'packages')], { windowsHide: true });
  }
  if (asset.kind === 'runtime') {
    const runtime = path.join(root, 'llama');
    await fs.mkdir(runtime, { recursive: true });
    if (process.platform !== 'win32') throw new Error('Prepare the Windows runtime on Windows.');
    execFileSync(archiveTool, ['-xf', target, '-C', runtime], { windowsHide: true });
  }
}
if (!verifyOnly) await fs.copyFile('electron/aiDj/NOTICE.md', path.join(root, 'NOTICE.md'));
// A separate manifest checks the installed resources, not merely the downloads.
async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'downloads' || entry.name === 'manifest.json' || (!includeModels && (entry.name === 'packages' || entry.name.endsWith('.gguf')))) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push({ file: path.relative(root, file).replaceAll('\\', '/'), sha256: await digest(file), size: (await fs.stat(file)).size });
  }
  return files;
}
if (verifyOnly) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (!includeModels && manifest.files.some(entry => entry.file.endsWith('.gguf') || entry.file.startsWith('packages/'))) throw new Error('Rebuild the helper-only DJ resource manifest before packaging.');
  for (const entry of manifest.files) {
    const file = path.resolve(root, entry.file);
    if (!file.startsWith(root + path.sep) || (await fs.stat(file)).size !== entry.size || await digest(file) !== entry.sha256) throw new Error('Corrupt extracted DJ resource: ' + entry.file);
  }
}
if (!verifyOnly) await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ files: await walk(root) }, null, 2));
console.log('AI DJ assets verified.');
