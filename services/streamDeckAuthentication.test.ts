import { describe, expect, it } from 'vitest';
import { authenticationTranscript, createAuthenticationProof } from './streamDeckAuthentication';

const TOKEN = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const NONCE = 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8';

describe('Stream Deck challenge authentication', () => {
  it('uses the exact transcript without a trailing newline', () => {
    expect(authenticationTranscript('client-123', 'session-456', NONCE)).toBe(
      `nebula-streamdeck/1\nauthenticate\nclient-123\nsession-456\n${NONCE}`,
    );
  });

  it('matches the plugin HMAC-SHA256 base64url test vector', async () => {
    await expect(
      createAuthenticationProof(TOKEN, 'client-123', 'session-456', NONCE),
    ).resolves.toBe('CnvJhNfU-cGHrqdx9AObUC4wGx5D-MsSXcLQCU_QUt8');
  });

  it('rejects tokens that do not decode to exactly 32 bytes', async () => {
    await expect(
      createAuthenticationProof('not-a-token', 'client-123', 'session-456', NONCE),
    ).rejects.toThrow('exactly 32 bytes');
  });
});
