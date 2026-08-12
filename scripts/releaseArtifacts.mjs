import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredFiles = (platform, version) => platform === 'windows'
  ? [
      `Nebula-${version}-setup.exe`,
      `Nebula-${version}-setup.exe.blockmap`,
      `Nebula-${version}-setup.appx`,
      'latest.yml',
    ]
  : [
      `Nebula-${version}-arm64.dmg`,
      `Nebula-${version}-arm64.dmg.blockmap`,
      `Nebula-${version}-arm64.zip`,
      `Nebula-${version}-arm64.zip.blockmap`,
      'latest-mac.yml',
    ];

export const parseUpdateMetadata = (text) => ({
  version: text.match(/^version:\s*(\S+)\s*$/m)?.[1] ?? null,
  urls: [...text.matchAll(/^\s*-\s+url:\s*(\S+)\s*$/gm)].map((match) => match[1]),
  path: text.match(/^path:\s*(\S+)\s*$/m)?.[1] ?? null,
});

export const validateReleaseArtifacts = ({ platform, version, files, metadataText }) => {
  const errors = [];
  const counts = new Map();
  for (const file of files) counts.set(file, (counts.get(file) ?? 0) + 1);
  for (const [file, count] of counts) if (count > 1) errors.push(`duplicate ${file}`);
  for (const required of requiredFiles(platform, version)) {
    if (!counts.has(required)) errors.push(`missing ${required}`);
  }
  const metadata = parseUpdateMetadata(metadataText);
  if (metadata.version !== version) {
    errors.push(`metadata version ${metadata.version} does not match ${version}`);
  }
  for (const reference of [...metadata.urls, metadata.path].filter(Boolean)) {
    if (!counts.has(reference)) errors.push(`metadata references ${reference} but that file is absent`);
  }
  const primary = platform === 'windows'
    ? `Nebula-${version}-setup.exe`
    : `Nebula-${version}-arm64.zip`;
  if (metadata.path !== primary) errors.push(`metadata path ${metadata.path} does not match ${primary}`);
  return errors;
};

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const readArtifactEntries = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (!entry.isDirectory()) return [{ name: entry.name, path: entryPath }];
    return fs.readdirSync(entryPath, { withFileTypes: true })
      .filter((child) => !child.isDirectory())
      .map((child) => ({ name: child.name, path: path.join(entryPath, child.name) }));
  });

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const platform = argument('--platform');
  const version = argument('--version');
  const dir = argument('--dir');
  if (!['windows', 'mac'].includes(platform) || !version || !dir) {
    console.error('usage: --platform windows|mac --version VERSION --dir DIRECTORY');
    process.exitCode = 1;
  } else {
    const entries = readArtifactEntries(dir);
    const metadataName = platform === 'windows' ? 'latest.yml' : 'latest-mac.yml';
    const metadataPath = entries.find((entry) => entry.name === metadataName)?.path;
    const metadataText = metadataPath ? fs.readFileSync(metadataPath, 'utf8') : '';
    const errors = validateReleaseArtifacts({
      platform,
      version,
      files: entries.map((entry) => entry.name),
      metadataText,
    });
    if (errors.length) {
      for (const error of errors) console.error(error);
      process.exitCode = 1;
    } else {
      console.log(`${platform} ${version} release artifacts are complete`);
    }
  }
}
