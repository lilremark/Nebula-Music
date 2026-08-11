import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const readVersionSources = (rootDir) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));
  const constants = fs.readFileSync(path.join(rootDir, 'constants.ts'), 'utf8');
  const match = constants.match(/export const APP_VERSION = '([^']+)'/);
  if (!match) throw new Error('constants.ts does not declare APP_VERSION');
  return {
    packageVersion: pkg.version,
    lockVersion: lock.version,
    rootLockVersion: lock.packages?.['']?.version,
    appVersion: match[1],
  };
};

export const validateVersionSources = (sources, tag) => {
  const expected = tag?.startsWith('v') ? tag.slice(1) : sources.packageVersion;
  const errors = [];
  for (const key of ['packageVersion', 'lockVersion', 'rootLockVersion', 'appVersion']) {
    if (sources[key] !== expected) {
      errors.push(`${key} ${sources[key]} does not match ${expected}`);
    }
  }
  if (tag === '') {
    errors.push('tag value is required');
  } else if (tag !== undefined && tag !== `v${sources.packageVersion}`) {
    errors.push(`tag ${tag} does not match v${sources.packageVersion}`);
  }
  return errors;
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const tagIndex = process.argv.indexOf('--tag');
  const tag = tagIndex >= 0 ? (process.argv[tagIndex + 1] ?? '') : undefined;
  const sources = readVersionSources(process.cwd());
  const errors = validateVersionSources(sources, tag);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`release version ${sources.packageVersion} is synchronized`);
  }
}
