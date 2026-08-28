import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsStore } from './settingsStore';
import { DESKTOP_SETTINGS_DEFAULTS } from './settingsSchema';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'nebula-settings-'));
  file = path.join(dir, 'settings.json');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('SettingsStore', () => {
  it('falls back to defaults when the file does not exist', async () => {
    const store = await SettingsStore.open(file);
    expect(store.snapshot()).toEqual(DESKTOP_SETTINGS_DEFAULTS);
  });

  it('falls back to defaults on corrupt json', async () => {
    await writeFile(file, 'not-json', 'utf8');
    const store = await SettingsStore.open(file);
    expect(store.snapshot()).toEqual(DESKTOP_SETTINGS_DEFAULTS);
  });

  it('persists a valid setting and reloads it atomically', async () => {
    const store = await SettingsStore.open(file);
    await store.set('trayOnClose', false);
    const reloaded = await SettingsStore.open(file);
    expect(reloaded.get('trayOnClose')).toBe(false);
  });

  it('throws on an invalid setting value', async () => {
    const store = await SettingsStore.open(file);
    await expect(store.set('updateChannel', 'nonsense')).rejects.toThrow(
      /Invalid desktop setting "updateChannel"/,
    );
  });

  it('serialised writes always land on a valid file with a trailing newline', async () => {
    const store = await SettingsStore.open(file);
    const a = store.set('mediaKeysEnabled', false);
    const b = store.set('taskbarProgressEnabled', false);
    await Promise.all([a, b]);
    const raw = await readFile(file, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw).mediaKeysEnabled).toBe(false);
    expect(JSON.parse(raw).taskbarProgressEnabled).toBe(false);
  });
});
