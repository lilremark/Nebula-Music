// Sentry release management for Nebula release builds (ADR 0005).
//
//   node scripts/sentryRelease.mjs create   --version 3.0.2-beta.2
//   node scripts/sentryRelease.mjs finalize --version 3.0.2-beta.2 [--deploy]
//   node scripts/sentryRelease.mjs deploy   --version 3.0.1
//
// create:   creates `nebula@<version>` (idempotent; source map uploads need it).
// finalize: links the release's commits through Sentry's GitHub integration
//           (suspect commits), marks it released, and with --deploy records a
//           deploy to its environment.
// deploy:   records a deploy to the release's environment: `beta` for
//           `-beta.N` versions, `stable` otherwise, matching the app's
//           environment tag (electron/crashReporting.ts).
//
// Needs SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT in the environment.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO_URL = 'https://github.com/lilremark/Nebula-Music';
const cli = path.resolve('node_modules/@sentry/cli/bin/sentry-cli');

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const option = (name) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : undefined;
};

const version = option('version');
if (!['create', 'finalize', 'deploy'].includes(command) || !version || !/^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(version)) {
  console.error('Usage: sentryRelease.mjs <create|finalize|deploy> --version <x.y.z[-beta.N]> [--deploy]');
  process.exit(2);
}
const missing = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`sentryRelease: missing ${missing.join(', ')}.`);
  process.exit(1);
}

const release = `nebula@${version}`;
const environment = /-beta\.\d+$/.test(version) ? 'beta' : 'stable';
const scope = ['--org', process.env.SENTRY_ORG, '--project', process.env.SENTRY_PROJECT];
const run = (args) => execFileSync(process.execPath, [cli, ...args], { stdio: 'inherit' });

const deploy = () => {
  run(['deploys', 'new', ...scope, '--release', release, '--env', environment,
    '--name', `v${version}`, '--url', `${REPO_URL}/releases/tag/v${version}`]);
  console.log(`sentryRelease: recorded ${environment} deploy of ${release}.`);
};

if (command === 'create') {
  run(['releases', 'new', ...scope, release]);
} else if (command === 'finalize') {
  run(['releases', 'new', ...scope, release]);
  // --auto resolves the tagged commit and the previous release's commit through
  // the GitHub integration; --ignore-missing tolerates a previous release whose
  // commit Sentry cannot find (the first release, or history rewritten since).
  run(['releases', 'set-commits', ...scope, release, '--auto', '--ignore-missing']);
  run(['releases', 'finalize', ...scope, release]);
  console.log(`sentryRelease: finalized ${release} with commits.`);
  if (flag('deploy')) deploy();
} else {
  deploy();
}
