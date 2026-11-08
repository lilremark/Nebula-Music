// Runs in dist:win / dist:mac between the build and electron-builder.
//
// With NEBULA_SOURCEMAPS=1 the build writes source maps (no URL comment). This
// script injects Sentry debug IDs into the bundles and their maps, uploads the
// maps when NEBULA_SOURCEMAPS_UPLOAD=1 (release tags only), and always deletes
// every map so none is packaged. Without maps it does nothing.
//
// Upload needs SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['dist', 'electron/dist'];
const cli = path.resolve('node_modules/@sentry/cli/bin/sentry-cli');

const findMaps = (dir) => {
  let found = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found = found.concat(findMaps(full));
    else if (entry.name.endsWith('.map')) found.push(full);
  }
  return found;
};

const run = (args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });

const maps = ROOTS.flatMap(findMaps);
if (maps.length === 0) {
  console.log('sentrySourcemaps: no source maps (NEBULA_SOURCEMAPS is not 1); nothing to do.');
  process.exit(0);
}

try {
  run(['sourcemaps', 'inject', ...ROOTS]);

  if (process.env.NEBULA_SOURCEMAPS_UPLOAD === '1') {
    const missing = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'].filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`Source map upload needs ${missing.join(', ')}.`);
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    const release = `nebula@${version}`;
    const common = ['--org', process.env.SENTRY_ORG, '--project', process.env.SENTRY_PROJECT, '--release', release];
    // Idempotent; both packaging jobs run it. Commits, finalize and deploys
    // happen later in scripts/sentryRelease.mjs.
    run(['releases', 'new', '--org', process.env.SENTRY_ORG, '--project', process.env.SENTRY_PROJECT, release]);
    // Renderer frames are app://nebula/assets/…; main-process frames are
    // normalized by the SDK to app:///electron/dist/…. `~/` matches any origin.
    run(['sourcemaps', 'upload', ...common, '--url-prefix', '~/', 'dist']);
    run(['sourcemaps', 'upload', ...common, '--url-prefix', '~/electron/dist', 'electron/dist']);
    console.log(`sentrySourcemaps: uploaded ${maps.length} maps for ${release}.`);
  }
} finally {
  for (const map of maps) rmSync(map, { force: true });
}

const left = ROOTS.flatMap(findMaps);
if (left.length) {
  console.error(`sentrySourcemaps: maps still present and would be packaged: ${left.join(', ')}`);
  process.exit(1);
}
console.log(`sentrySourcemaps: removed ${maps.length} maps before packaging.`);
