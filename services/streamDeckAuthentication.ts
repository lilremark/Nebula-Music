import { STREAM_DECK_PROTOCOL } from './streamDeckProtocol';

const CRYPTOGRAPHIC_VALUE = /^[A-Za-z0-9_-]{43}$/;

const decodeBase64Url = (value: string): ArrayBuffer => {
  if (!CRYPTOGRAPHIC_VALUE.test(value)) {
    throw new Error('Authentication value must encode exactly 32 bytes.');
  }
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '=';
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
};

const encodeBase64Url = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

export const authenticationTranscript = (
  clientId: string,
  sessionId: string,
  nonce: string,
): string =>
  `${STREAM_DECK_PROTOCOL}\nauthenticate\n${clientId}\n${sessionId}\n${nonce}`;

export const createAuthenticationProof = async (
  token: string,
  clientId: string,
  sessionId: string,
  nonce: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    decodeBase64Url(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(authenticationTranscript(clientId, sessionId, nonce)),
  );
  return encodeBase64Url(signature);
};
