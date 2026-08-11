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
  it('accepts synchronized v2.4.0 sources and tag', () => {
    expect(validateVersionSources(synced, 'v2.4.0')).toEqual([]);
  });

  it.each([
    ['packageVersion', '2.3.4'],
    ['lockVersion', '2.3.1'],
    ['rootLockVersion', '2.3.1'],
    ['appVersion', '2.3.1'],
  ])('rejects drift in %s', (key, value) => {
    expect(validateVersionSources({ ...synced, [key]: value }, 'v2.4.0'))
      .toContain(`${key} ${value} does not match 2.4.0`);
  });

  it('rejects a tag that does not match the package version', () => {
    expect(validateVersionSources(synced, 'v2.4.1'))
      .toContain('tag v2.4.1 does not match v2.4.0');
  });

  it('rejects an explicitly empty tag', () => {
    expect(validateVersionSources(synced, '')).toContain('tag value is required');
  });

  it('allows validation without a tag for pull requests', () => {
    expect(validateVersionSources(synced)).toEqual([]);
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
