import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateVersionSources } from './releaseVersion.mjs';

const scriptPath = fileURLToPath(new URL('./releaseVersion.mjs', import.meta.url));
const rootDir = fileURLToPath(new URL('..', import.meta.url));

const synced = {
  packageVersion: '2.4.0',
  lockVersion: '2.4.0',
  rootLockVersion: '2.4.0',
  appVersion: '2.4.0',
};

describe('release version contract', () => {
  it('accepts synchronized v2.4.0 sources and matching tag', () => {
    expect(validateVersionSources(synced, 'v2.4.0')).toEqual({ errors: [], warnings: [] });
  });

  it.each([
    ['lockVersion', '2.3.1'],
    ['rootLockVersion', '2.3.1'],
    ['appVersion', '2.3.1'],
  ])('rejects drift in %s against package.json', (key, value) => {
    expect(validateVersionSources({ ...synced, [key]: value }, 'v2.4.0').errors)
      .toContain(`${key} ${value} does not match 2.4.0`);
  });

  it('rejects drift in packageVersion against the other sources', () => {
    const { errors } = validateVersionSources({ ...synced, packageVersion: '2.3.4' }, 'v2.4.0');
    expect(errors).toContain('lockVersion 2.4.0 does not match 2.3.4');
    expect(errors).toContain('appVersion 2.4.0 does not match 2.3.4');
  });

  it('warns (does not fail) when a tag does not match the package version', () => {
    const { errors, warnings } = validateVersionSources(synced, 'v2.4.1');
    expect(errors).toEqual([]);
    expect(warnings).toContain('tag v2.4.1 does not match v2.4.0 (building source as 2.4.0)');
  });

  it('rejects an explicitly empty tag', () => {
    expect(validateVersionSources(synced, '').errors).toContain('tag value is required');
  });

  it('allows validation without a tag for pull requests', () => {
    expect(validateVersionSources(synced)).toEqual({ errors: [], warnings: [] });
  });

  it('rejects consistent sources that do not match the semver shape', () => {
    const malformed = {
      packageVersion: '2.4',
      lockVersion: '2.4',
      rootLockVersion: '2.4',
      appVersion: '2.4',
    };
    expect(validateVersionSources(malformed).errors)
      .toContain('packageVersion 2.4 is not a valid semver version');
  });

  it.each(['2.4.0', '2.5.0-beta.1'])('accepts the semver shape for %s', (version) => {
    const sources = {
      packageVersion: version,
      lockVersion: version,
      rootLockVersion: version,
      appVersion: version,
    };
    expect(validateVersionSources(sources)).toEqual({ errors: [], warnings: [] });
  });

  it('rejects --tag without a value', () => {
    const result = spawnSync(process.execPath, [scriptPath, '--tag'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('tag value is required');
  });
});
