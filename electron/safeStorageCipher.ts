import { safeStorage } from 'electron';
import type { VaultCipher } from './credentialVault';

/**
 * Adapter from Electron's OS-backed `safeStorage` (DPAPI on Windows, Keychain
 * on macOS, libsecret on Linux) to the vault cipher contract. Only usable after
 * `app.whenReady()`.
 */
export const createSafeStorageCipher = (): VaultCipher => ({
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (plain) => safeStorage.encryptString(plain),
  decryptString: (encrypted) => safeStorage.decryptString(encrypted),
});
