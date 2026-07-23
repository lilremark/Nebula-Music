# ADR 0001: Built-in localhost bridge for Stream Deck

- Status: Accepted
- Date: 2026-07-23

## Context

The Stream Deck plugin needs the state and controls of the Nebula tab that is already
authenticated to a Subsonic server. Making the plugin a second Subsonic client would
duplicate credentials, playback state, queue behavior, and playlist semantics.

## Decision

Nebula includes an opt-in browser client for the versioned `nebula-streamdeck/1`
protocol. It connects only to `ws://127.0.0.1:<port>/nebula/v1`, where the Stream Deck
plugin hosts the loopback-only server. Commands call the existing Nebula store and
service functions. State messages contain bounded display metadata and rendered
artwork pixels, never Subsonic credentials, queue contents, or authenticated URLs.

The bridge is disabled by default. Its port is configurable while disabled, and
connections retry with exponential backoff capped at 30 seconds.

## Consequences

- Browser playback remains the single source of truth.
- The feature requires a Nebula tab to remain open.
- HTTPS deployments may be subject to browser mixed-content policy for local `ws:`
  connections; the Settings status exposes failures instead of silently degrading.
- Protocol evolution requires a new version rather than incompatible changes to v1.
