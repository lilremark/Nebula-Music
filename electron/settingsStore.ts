import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  desktopSettingsSchema,
  DESKTOP_SETTINGS_DEFAULTS,
  type DesktopSettings,
} from './settingsSchema';

/**
 * Atomic, schema-validated desktop settings store. Single writer: all reads and
 * writes go through the main process (the renderer accesses it over IPC).
 * Invalid values fall back to defaults instead of crashing.
 */
export class SettingsStore {
  private data: DesktopSettings;
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(private readonly filePath: string) {
    this.data = { ...DESKTOP_SETTINGS_DEFAULTS };
  }

  static async open(filePath: string): Promise<SettingsStore> {
    const store = new SettingsStore(filePath);
    await store.load();
    return store;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = desktopSettingsSchema.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.schemaVersion === DESKTOP_SETTINGS_DEFAULTS.schemaVersion) {
        this.data = parsed.data;
        return;
      }
    } catch {
      // Missing/corrupt file falls back to defaults.
    }
    this.data = { ...DESKTOP_SETTINGS_DEFAULTS };
  }

  get<T = unknown>(key: string): T | undefined {
    return (this.data as Record<string, unknown>)[key] as T | undefined;
  }

  snapshot(): DesktopSettings {
    return { ...this.data };
  }

  async set(key: string, value: unknown): Promise<void> {
    const candidate = { ...this.data, [key]: value };
    const parsed = desktopSettingsSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(
        issue ? `Invalid desktop setting "${key}": ${issue.message}` : `Invalid desktop setting "${key}".`,
      );
    }
    this.data = parsed.data;
    await this.persist();
  }

  private persist(): Promise<void> {
    this.writeChain = this.writeChain.then(() => this.atomicWrite());
    return this.writeChain;
  }

  private async atomicWrite(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp-${process.pid}`;
    await writeFile(tmp, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    await rename(tmp, this.filePath);
  }
}
