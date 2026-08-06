import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SubsonicCredentials } from '../types';

/**
 * Phase 2 credential vault. Records are encrypted with the OS-backed
 * `safeStorage` cipher before hitting disk; the vault refuses to fall back to
 * plaintext when encryption is unavailable. Legacy Phase 1 plaintext records
 * are read once and migrated to ciphertext on the next write.
 */
const VAULT_VERSION = 1 as const;

export interface VaultCipher {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

type StoredRecord =
  | { version: typeof VAULT_VERSION; storage: 'encrypted'; ciphertext: string }
  | { version: typeof VAULT_VERSION; storage: 'plaintext'; serverUrl: string; credentials: SubsonicCredentials };

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

  private constructor(
    private readonly filePath: string,
    private readonly cipher: VaultCipher,
  ) {}

  static async open(filePath: string, cipher: VaultCipher): Promise<CredentialVault> {
    const vault = new CredentialVault(filePath, cipher);
    const migrated = await vault.load();
    if (migrated) {
      try {
        await vault.persist();
      } catch {
        // Migration will retry on the next write; plaintext remains in memory.
      }
    }
    return vault;
  }

  /** Returns true when legacy plaintext records were loaded and need re-encryption. */
  private async load(): Promise<boolean> {
    let hasPlaintext = false;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<VaultFile>;
      if (parsed.version !== VAULT_VERSION || !parsed.records) return hasPlaintext;
      for (const [serverUrl, record] of Object.entries(parsed.records)) {
        if (record.storage === 'encrypted') {
          const decrypted = this.decrypt(record.ciphertext);
          if (decrypted && isSubsonicCredentials(decrypted) && decrypted.serverUrl === serverUrl) {
            this.records.set(serverUrl, decrypted);
          }
        } else if (record.storage === 'plaintext' && isSubsonicCredentials(record.credentials)) {
          this.records.set(serverUrl, record.credentials);
          hasPlaintext = true;
        }
      }
    } catch {
      // Missing/corrupt file means no stored credentials.
    }
    return hasPlaintext;
  }

  private decrypt(ciphertext: string): SubsonicCredentials | null {
    if (!this.cipher.isEncryptionAvailable()) return null;
    try {
      const parsed = JSON.parse(this.cipher.decryptString(Buffer.from(ciphertext, 'base64')));
      return isSubsonicCredentials(parsed) ? parsed : null;
    } catch {
      return null;
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
    if (!this.cipher.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable on this device.');
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
    if (!this.cipher.isEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable on this device.');
    }
    const file: VaultFile = {
      version: VAULT_VERSION,
      records: Object.fromEntries(
        [...this.records.entries()].map(([serverUrl, credentials]) => [
          serverUrl,
          {
            version: VAULT_VERSION,
            storage: 'encrypted',
            ciphertext: this.cipher.encryptString(JSON.stringify(credentials)).toString('base64'),
          },
        ]),
      ),
    };
    const tmp = `${this.filePath}.tmp-${process.pid}`;
    await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    await rename(tmp, this.filePath);
  }
}
