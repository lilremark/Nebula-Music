import { build } from 'esbuild';

const shared = {
  platform: 'node',
  target: 'node22',
  bundle: true,
  // Inline maps more than triple the shipped main bundle. Keep them opt-in
  // for debugging rather than parsing their source text on every app launch.
  sourcemap: process.env.NEBULA_DEBUG_BUILD === '1' ? 'inline' : false,
  external: ['electron', 'echogarden', 'onnxruntime-node', 'sharp'],
  outdir: 'electron/dist',
  outExtension: { '.js': '.cjs' },
  logLevel: 'info',
};

await build({
  ...shared,
  entryPoints: ['electron/main.ts'],
  format: 'cjs',
});

await build({
  ...shared,
  entryPoints: ['electron/preload.ts'],
  format: 'cjs',
});

console.log('esbuild: main.cjs and preload.cjs written to electron/dist');
