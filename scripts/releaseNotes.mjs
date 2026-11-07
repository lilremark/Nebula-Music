// Validates and renders the release notes for a version.
//
//   node scripts/releaseNotes.mjs check  [--version x.y.z]
//   node scripts/releaseNotes.mjs github [--version x.y.z] [--out file.md]
//
// The version defaults to package.json. Notes live in docs/release/v<version>.md;
// see docs/release/README.md for the format.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReleaseNotes, renderGitHubReleaseNotes } from '../utils/releaseNotes.ts';

export const releaseNotesPath = (rootDir, version) => path.join(rootDir, 'docs', 'release', `v${version}.md`);

/** @returns {{ notes: import('../utils/releaseNotes.ts').ReleaseNotes | null, errors: string[] }} */
export const loadReleaseNotes = (rootDir, version) => {
  const file = releaseNotesPath(rootDir, version);
  if (!fs.existsSync(file)) {
    return { notes: null, errors: [`missing ${path.relative(rootDir, file)} (see docs/release/README.md)`] };
  }
  const { notes, errors } = parseReleaseNotes(fs.readFileSync(file, 'utf8'));
  if (notes && notes.version !== version) {
    return { notes: null, errors: [`frontmatter version ${notes.version} does not match ${version}`] };
  }
  return { notes, errors };
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const [command] = process.argv.slice(2);
  const option = name => {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const rootDir = process.cwd();
  const version = (option('version') ?? JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version)
    .replace(/^v/, '');

  if (command !== 'check' && command !== 'github') {
    console.error('usage: node scripts/releaseNotes.mjs <check|github> [--version x.y.z] [--out file]');
    process.exit(2);
  }
  const { notes, errors } = loadReleaseNotes(rootDir, version);
  if (!notes) {
    for (const error of errors) console.error(`release notes v${version}: ${error}`);
    process.exit(1);
  }
  if (command === 'check') {
    const counts = notes.sections.map(section => `${section.heading}: ${section.items.length}`).join(', ');
    console.log(`release notes v${version} ok (${counts})`);
  } else {
    const rendered = renderGitHubReleaseNotes(notes);
    const out = option('out');
    if (out) fs.writeFileSync(out, rendered);
    else process.stdout.write(rendered);
  }
}
