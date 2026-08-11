import sharp from 'sharp';
import toIco from 'png-to-ico';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'logo.svg');
const outDir = path.join(root, 'electron', 'assets');

if (!fs.existsSync(svg)) {
  throw new Error(`logo.svg not found at ${svg}`);
}

fs.mkdirSync(outDir, { recursive: true });

// 512x512 PNG (window icon source and app icon fallback)
const png512 = await sharp(svg).resize(512, 512).png().toBuffer();
await fs.promises.writeFile(path.join(outDir, 'icon.png'), png512);

// Multi-size ICO frames for Windows (taskbar, alt-tab, exe resource)
const sizes = [256, 128, 64, 48, 32, 24, 16];
const frames = [];
for (const size of sizes) {
  frames.push(await sharp(svg).resize(size, size).png().toBuffer());
}
const ico = await toIco(frames);
await fs.promises.writeFile(path.join(outDir, 'icon.ico'), ico);

// macOS .icns via the system-iconset directory + built-in `iconutil`.
const iconset = path.join(os.tmpdir(), `nebula-icon-${process.pid}.iconset`);
fs.mkdirSync(iconset, { recursive: true });
const iconSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];
for (const [name, size] of iconSizes) {
  await fs.promises.writeFile(path.join(iconset, name), await sharp(svg).resize(size, size).png().toBuffer());
}
const icnsPath = path.join(outDir, 'icon.icns');
try {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icnsPath], { stdio: 'pipe' });
} catch (error) {
  throw new Error(`Failed to generate ${icnsPath}; iconutil is only available on macOS. ${error instanceof Error ? error.message : ''}`);
} finally {
  fs.rmSync(iconset, { recursive: true, force: true });
}

// macOS menu-bar template image (black + alpha on transparent).
// The Nebula bars mark: a strong central bar flanked by lighter side bars.
const templateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <path d="M4 4v10" stroke="#000" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.45"/>
  <path d="M9 1.6v14.8" stroke="#000" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M14 4v10" stroke="#000" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.45"/>
</svg>`;
await fs.promises.writeFile(
  path.join(outDir, 'trayTemplate.png'),
  await sharp(Buffer.from(templateSvg)).resize(16, 16).png().toBuffer(),
);
await fs.promises.writeFile(
  path.join(outDir, 'trayTemplate@2x.png'),
  await sharp(Buffer.from(templateSvg)).resize(32, 32).png().toBuffer(),
);

console.log(
  `generated electron/assets/icon.png, icon.ico, icon.icns, trayTemplate.png, trayTemplate@2x.png`,
);