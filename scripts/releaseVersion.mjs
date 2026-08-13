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

const VERSION_SHAPE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

/**
 * Validates that every version source (package.json, package-lock.json, its
 * root entry, and constants.ts) agrees with package.json on one valid semver
 * version. package.json is the canonical source of truth.
 *
 * When a tag is provided it is informational: a mismatch between the tag and
 * the committed package version is only a warning, not a hard error — so
 * release workflows triggered by any `v*` tag can build from the checked-out
 * source even when the tag and the committed version differ.
 *
 * @returns {{ errors: string[], warnings: string[] }}
 */
export const validateVersionSources = (sources, tag) => {
  const errors = [];
  const warnings = [];
  const expected = sources.packageVersion;
  for (const key of ['packageVersion', 'lockVersion', 'rootLockVersion', 'appVersion']) {
    if (!VERSION_SHAPE.test(sources[key])) {
      errors.push(`${key} ${sources[key]} is not a valid semver version`);
    } else if (sources[key] !== expected) {
      errors.push(`${key} ${sources[key]} does not match ${expected}`);
    }
  }
  if (tag === '') {
    errors.push('tag value is required');
  } else if (tag !== undefined && tag !== `v${expected}`) {
    warnings.push(`tag ${tag} does not match v${expected} (building source as ${expected})`);
  }
  return { errors, warnings };
};

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const tagIndex = process.argv.indexOf('--tag');
  const tag = tagIndex >= 0 ? (process.argv[tagIndex + 1] ?? '') : undefined;
  const sources = readVersionSources(process.cwd());
  const { errors, warnings } = validateVersionSources(sources, tag);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`release version ${sources.packageVersion} is synchronized`);
  }
}
