import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CredentialVault, type VaultCipher } from './credentialVault';
import type { SubsonicCredentials } from '../types';

const fakeCipher = (available: boolean): VaultCipher => ({
  isEncryptionAvailable: () => available,
  encryptString: (plain) => Buffer.from(plain, 'utf8'),
  decryptString: (encrypted) => encrypted.toString('utf8'),
});

const passwordCreds = (serverUrl = 'https://demo.example'): SubsonicCredentials => ({
  serverUrl,
  username: 'testuser',
  token: 'token123',
  salt: 'salted',
});

const apiKeyCreds = (serverUrl = 'https://demo.example'): SubsonicCredentials => ({
  authType: 'apiKey',
  serverUrl,
  apiKey: 'abcdef0123456789',
});

describe('CredentialVault', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'nebula-vault-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips credentials through ciphertext', async () => {
    const file = path.join(dir, 'vault.json');
    const vault = await CredentialVault.open(file, fakeCipher(true));
    await vault.set(passwordCreds());
    expect(await vault.get('https://demo.example')).toEqual(passwordCreds());
    const raw = await readFile(file, 'utf8');
    expect(raw).not.toContain('testuser');
    expect(raw).not.toContain('token123');
  });

  it('stores apiKey credentials', async () => {
    const file = path.join(dir, 'vault.json');
    const vault = await CredentialVault.open(file, fakeCipher(true));
    await vault.set(apiKeyCreds());
    expect(await vault.get('https://demo.example')).toEqual(apiKeyCreds());
  });

  it('persists across vault instances', async () => {
    const file = path.join(dir, 'vault.json');
    await (await CredentialVault.open(file, fakeCipher(true))).set(passwordCreds());
    const reopened = await CredentialVault.open(file, fakeCipher(true));
    expect(await reopened.get('https://demo.example')).toEqual(passwordCreds());
  });

  it('clears a single server', async () => {
    const file = path.join(dir, 'vault.json');
    const vault = await CredentialVault.open(file, fakeCipher(true));
    await vault.set(passwordCreds('https://one.example'));
    await vault.set(passwordCreds('https://two.example'));
    await vault.clear('https://one.example');
    expect(await vault.get('https://one.example')).toBeNull();
    expect(await vault.get('https://two.example')).toEqual(passwordCreds('https://two.example'));
  });

  it('rejects invalid credentials', async () => {
    const file = path.join(dir, 'vault.json');
    const vault = await CredentialVault.open(file, fakeCipher(true));
    await expect(
      vault.set({ serverUrl: '', username: '', token: '', salt: '' }),
    ).rejects.toThrow('Invalid Subsonic credentials');
  });

  it('refuses to write plaintext when encryption is unavailable', async () => {
    const file = path.join(dir, 'vault.json');
    const vault = await CredentialVault.open(file, fakeCipher(false));
    await expect(vault.set(passwordCreds())).rejects.toThrow(
      'Secure credential storage is unavailable',
    );
  });

  it('ignores undecryptable records on load', async () => {
    const file = path.join(dir, 'vault.json');
    const first = await CredentialVault.open(file, fakeCipher(true));
    await first.set(passwordCreds('https://good.example'));
    const second = await CredentialVault.open(file, fakeCipher(true));
    await second.set(passwordCreds('https://also-good.example'));
    // Tamper with the ciphertext of the second record by hand.
    const raw = await readFile(file, 'utf8');
    const tampered = raw.replace(
      Buffer.from(JSON.stringify(passwordCreds('https://also-good.example')), 'utf8').toString('base64'),
      'YmFk',
    );
    const { writeFile } = await import('node:fs/promises');
    await writeFile(file, tampered, 'utf8');
    const reopened = await CredentialVault.open(file, fakeCipher(true));
    expect(await reopened.get('https://good.example')).toEqual(passwordCreds('https://good.example'));
    expect(await reopened.get('https://also-good.example')).toBeNull();
  });

  it('migrates legacy plaintext records to ciphertext', async () => {
    const file = path.join(dir, 'vault.json');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        records: {
          'https://legacy.example': {
            version: 1,
            storage: 'plaintext',
            serverUrl: 'https://legacy.example',
            credentials: passwordCreds('https://legacy.example'),
          },
        },
      }),
    );
    const vault = await CredentialVault.open(file, fakeCipher(true));
    expect(await vault.get('https://legacy.example')).toEqual(
      passwordCreds('https://legacy.example'),
    );
    const raw = await readFile(file, 'utf8');
    expect(raw).toContain('"storage": "encrypted"');
    expect(raw).not.toContain('"storage": "plaintext"');
    expect(raw).not.toContain('testuser');
  });
});
