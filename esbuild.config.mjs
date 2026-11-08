import { build } from 'esbuild';

const shared = {
  platform: 'node',
  target: 'node22',
  bundle: true,
  // Inline maps more than triple the shipped main bundle. Keep them opt-in
  // for debugging rather than parsing their source text on every app launch.
  // Release CI sets NEBULA_SOURCEMAPS=1 to write external maps (no URL comment)
  // for upload to Sentry; they are deleted before packaging and never shipped.
  sourcemap: process.env.NEBULA_DEBUG_BUILD === '1' ? 'inline'
    : process.env.NEBULA_SOURCEMAPS === '1' ? 'external' : false,
  // Minified code is parsed faster and takes less memory in the main process
  // at every launch. Function and class names are kept so stack traces in logs
  // stay readable; debug builds skip minification entirely.
  minify: process.env.NEBULA_DEBUG_BUILD !== '1',
  keepNames: true,
  // The crash-report DSN is not secret, but injecting it only in release CI
  // keeps local and fork builds from ever reporting to the Nebula project.
  define: { __NEBULA_CRASH_DSN__: JSON.stringify(process.env.NEBULA_CRASH_DSN ?? '') },
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

await build({ ...shared, entryPoints: ['electron/aiDj/voiceWorker.ts'], format: 'cjs' });

// Loaded by main.cjs only after the user opts in to crash reports.
await build({ ...shared, entryPoints: ['electron/sentryMain.ts'], format: 'cjs' });
