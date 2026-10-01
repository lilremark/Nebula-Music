import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsStore } from './settingsStore';

describe('SettingsStore persistence', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(path.join(os.tmpdir(), 'nebula-settings-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('requires HTTP opt-in for new settings and preserves existing saved consent', async () => {
    const file = path.join(dir, 'settings.json');
    const first = await SettingsStore.open(file);
    expect(first.get('permitInsecureHttp')).toBe(false);
    await first.set('permitInsecureHttp', true);
    expect((await SettingsStore.open(file)).get('permitInsecureHttp')).toBe(true);
  });

  it('resumes persistence after a transient filesystem failure', async () => {
    const blockedParent = path.join(dir, 'blocked');
    await writeFile(blockedParent, 'not a directory');
    const file = path.join(blockedParent, 'settings.json');
    const store = await SettingsStore.open(file);
    await expect(store.set('trayOnClose', false)).rejects.toThrow();
    await rm(blockedParent);
    await store.set('mediaKeysEnabled', false);
    expect(JSON.parse(await readFile(file, 'utf8')).mediaKeysEnabled).toBe(false);
  });
});
