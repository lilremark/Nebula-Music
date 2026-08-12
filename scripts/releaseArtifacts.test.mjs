import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parseUpdateMetadata, validateReleaseArtifacts } from './releaseArtifacts.mjs';

const scriptPath = fileURLToPath(new URL('./releaseArtifacts.mjs', import.meta.url));
const temporaryDirectories = [];

const windowsFiles = [
  'Nebula-2.4.0-setup.exe',
  'Nebula-2.4.0-setup.exe.blockmap',
  'Nebula-2.4.0-setup.appx',
  'latest.yml',
];
const windowsMetadata = `version: 2.4.0\npath: Nebula-2.4.0-setup.exe\n`;

const macFiles = [
  'Nebula-2.4.0-arm64.dmg',
  'Nebula-2.4.0-arm64.dmg.blockmap',
  'Nebula-2.4.0-arm64.zip',
  'Nebula-2.4.0-arm64.zip.blockmap',
  'latest-mac.yml',
];
const macMetadata = `version: 2.4.0\nfiles:\n  - url: Nebula-2.4.0-arm64.zip\n  - url: Nebula-2.4.0-arm64.dmg\npath: Nebula-2.4.0-arm64.zip\n`;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('release artifact contract', () => {
  it('parses version, URLs, and path', () => {
    expect(parseUpdateMetadata(macMetadata)).toEqual({
      version: '2.4.0',
      urls: ['Nebula-2.4.0-arm64.zip', 'Nebula-2.4.0-arm64.dmg'],
      path: 'Nebula-2.4.0-arm64.zip',
    });
  });

  it('accepts complete Windows assets', () => {
    expect(validateReleaseArtifacts({ platform: 'windows', version: '2.4.0', files: windowsFiles, metadataText: windowsMetadata })).toEqual([]);
  });

  it('accepts complete macOS assets', () => {
    expect(validateReleaseArtifacts({ platform: 'mac', version: '2.4.0', files: macFiles, metadataText: macMetadata })).toEqual([]);
  });

  it('rejects missing assets, wrong versions, and missing references', () => {
    expect(validateReleaseArtifacts({ platform: 'windows', version: '2.4.0', files: windowsFiles.slice(1), metadataText: windowsMetadata })).toContain('missing Nebula-2.4.0-setup.exe');
    expect(validateReleaseArtifacts({ platform: 'mac', version: '2.4.0', files: macFiles, metadataText: macMetadata.replace('version: 2.4.0', 'version: 2.4.1') })).toContain('metadata version 2.4.1 does not match 2.4.0');
    expect(validateReleaseArtifacts({ platform: 'mac', version: '2.4.0', files: macFiles, metadataText: macMetadata.replace('Nebula-2.4.0-arm64.dmg', 'missing.dmg') })).toContain('metadata references missing.dmg but that file is absent');
  });

  it('rejects duplicate asset names', () => {
    expect(validateReleaseArtifacts({ platform: 'windows', version: '2.4.0', files: [...windowsFiles, windowsFiles[0]], metadataText: windowsMetadata })).toContain('duplicate Nebula-2.4.0-setup.exe');
  });

  it('detects duplicate basenames across structured artifact directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-release-'));
    temporaryDirectories.push(root);
    const windowsDirectory = path.join(root, 'windows-release');
    const macDirectory = path.join(root, 'macos-release');
    fs.mkdirSync(windowsDirectory);
    fs.mkdirSync(macDirectory);
    for (const file of windowsFiles) {
      fs.writeFileSync(path.join(windowsDirectory, file), file === 'latest.yml' ? windowsMetadata : '');
    }
    fs.writeFileSync(path.join(macDirectory, windowsFiles[0]), 'duplicate');

    const result = spawnSync(process.execPath, [
      scriptPath,
      '--platform', 'windows',
      '--version', '2.4.0',
      '--dir', root,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('duplicate Nebula-2.4.0-setup.exe');
  });

  it('ignores files nested inside unpacked application directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-release-'));
    temporaryDirectories.push(root);
    for (const file of windowsFiles) {
      fs.writeFileSync(path.join(root, file), file === 'latest.yml' ? windowsMetadata : '');
    }
    const packagedResources = path.join(root, 'win-unpacked', 'resources', 'app');
    fs.mkdirSync(packagedResources, { recursive: true });
    fs.writeFileSync(path.join(packagedResources, windowsFiles[0]), 'packaged copy');

    const result = spawnSync(process.execPath, [
      scriptPath,
      '--platform', 'windows',
      '--version', '2.4.0',
      '--dir', root,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('windows 2.4.0 release artifacts are complete');
  });
});
