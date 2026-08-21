import { build } from 'esbuild';

const shared = {
  platform: 'node',
  target: 'node22',
  bundle: true,
  sourcemap: 'inline',
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
