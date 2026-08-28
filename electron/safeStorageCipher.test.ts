import { beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` factories are hoisted above imports/consts, so the mock object must
// be created with `vi.hoisted` to avoid a temporal-dead-zone ReferenceError.
const mockSafeStorage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn(),
}));
vi.mock('electron', () => ({ safeStorage: mockSafeStorage }));

import { createSafeStorageCipher } from './safeStorageCipher';

beforeEach(() => {
  vi.clearAllMocks();
  mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
  mockSafeStorage.encryptString.mockReturnValue('enc');
  mockSafeStorage.decryptString.mockReturnValue('plain');
});

describe('createSafeStorageCipher', () => {
  it('reports encryption availability from safeStorage', () => {
    const cipher = createSafeStorageCipher();
    expect(cipher.isEncryptionAvailable()).toBe(true);
  });

  it('delegates encryptString/decryptString to safeStorage', () => {
    const cipher = createSafeStorageCipher();
    expect(cipher.encryptString('secret')).toBe('enc');
    expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('secret');
    const encrypted = Buffer.from('enc');
    expect(cipher.decryptString(encrypted)).toBe('plain');
    expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(encrypted);
  });
});
