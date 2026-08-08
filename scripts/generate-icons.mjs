import sharp from 'sharp';
import toIco from 'png-to-ico';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'logo.svg');
const outDir = path.join(root, 'electron', 'assets');

if (!fs.existsSync(svg)) {
  throw new Error(`logo.svg not found at ${svg}`);
}

fs.mkdirSync(outDir, { recursive: true });

// 512x512 PNG (electron-builder / window icon source, and the largest frame)
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

console.log(`generated electron/assets/icon.png (512x512) and electron/assets/icon.ico (${sizes.join(',')}px)`);
