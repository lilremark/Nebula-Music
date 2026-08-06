import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SubsonicCredentials } from '../types';

/**
 * Phase 1 credential vault: plaintext JSON behind a swappable interface.
 * Phase 2 replaces the storage backing with `safeStorage.encryptString` and
 * refuses plaintext records; the renderer-facing contract does not change.
 */
const VAULT_VERSION = 1 as const;

type StoredRecord =
  | {
      version: typeof VAULT_VERSION;
      storage: 'plaintext';
      serverUrl: string;
      credentials: SubsonicCredentials;
    }
  | { version: typeof VAULT_VERSION; storage: 'encrypted'; ciphertext: string };

interface VaultFile {
  version: typeof VAULT_VERSION;
  records: Record<string, StoredRecord>;
}

const isSubsonicCredentials = (value: unknown): value is SubsonicCredentials => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.serverUrl !== 'string' || record.serverUrl.length === 0) return false;
  if (record.authType === 'apiKey') return typeof record.apiKey === 'string';
  return (
    typeof record.username === 'string' &&
    typeof record.token === 'string' &&
    typeof record.salt === 'string'
  );
};

export class CredentialVault {
  private records = new Map<string, SubsonicCredentials>();

  private constructor(private readonly filePath: string) {}

  static async open(filePath: string): Promise<CredentialVault> {
    const vault = new CredentialVault(filePath);
    await vault.load();
    return vault;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<VaultFile>;
      if (parsed.version !== VAULT_VERSION || !parsed.records) return;
      for (const [serverUrl, record] of Object.entries(parsed.records)) {
        if (record.storage === 'plaintext' && isSubsonicCredentials(record.credentials)) {
          this.records.set(serverUrl, record.credentials);
        }
        // Encrypted records (Phase 2) are not decryptable here and are ignored.
      }
    } catch {
      // Missing/corrupt file means no stored credentials.
    }
  }

  async get(serverUrl: string): Promise<SubsonicCredentials | null> {
    if (typeof serverUrl !== 'string' || serverUrl.length === 0 || serverUrl.length > 2048) {
      return null;
    }
    return this.records.get(serverUrl) ?? null;
  }

  async set(credentials: SubsonicCredentials): Promise<void> {
    if (!isSubsonicCredentials(credentials)) {
      throw new Error('Invalid Subsonic credentials.');
    }
    this.records.set(credentials.serverUrl, credentials);
    await this.persist();
  }

  async clear(serverUrl: string): Promise<void> {
    this.records.delete(serverUrl);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const file: VaultFile = {
      version: VAULT_VERSION,
      records: Object.fromEntries(
        [...this.records.entries()].map(([serverUrl, credentials]) => [
          serverUrl,
          { version: VAULT_VERSION, storage: 'plaintext', serverUrl, credentials },
        ]),
      ),
    };
    const tmp = `${this.filePath}.tmp-${process.pid}`;
    await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    await rename(tmp, this.filePath);
  }
}
