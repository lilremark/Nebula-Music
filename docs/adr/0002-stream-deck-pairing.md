# ADR 0002: Pair Stream Deck clients with scoped bearer tokens

- Status: Accepted
- Date: 2026-07-23

## Context

Loopback is not an authentication boundary: any process or webpage on the computer
can attempt to contact a localhost service. Nebula must not accept control commands
merely because a socket opened.

## Decision

The plugin displays a six-digit, single-use code that expires after five minutes and
rate-limits attempts. Nebula submits the code only after an explicit user action.
Successful pairing returns a random token, stored in Nebula's OS-safeStorage-backed
credential vault on desktop (the Stream Deck pairing token is a 32-byte secret and must
not rest in plaintext storage); the web build keeps the token in IndexedDB, and desktop
migrates an IndexedDB token into the vault on first read. For every connection, the
plugin sends a fresh 32-byte nonce. Nebula proves possession of the token with
HMAC-SHA256 over the versioned client/session transcript; the token itself is never sent
back across the socket.

Nebula applies 512 KiB message and 512,000-character artwork limits, validates every
plugin message, and uses structured command errors. Tokens, codes, server metadata,
and music metadata are not logged. Revocation is sent only after authentication, and
Nebula clears its local token only after the plugin confirms deletion.

Nebula honors only the first authentication challenge per connection, so replayed
challenges cannot drive a second authenticate exchange. A pairing-success message that
carries no token is accepted only after Nebula has answered a challenge, so a plugin
cannot claim a connection is authenticated without Nebula proving possession of the
token.

## Consequences

- First use requires confirmation in both products.
- Clearing Nebula site data or disconnecting its stored data requires pairing again.
- Each browser client can revoke only its own pairing.
