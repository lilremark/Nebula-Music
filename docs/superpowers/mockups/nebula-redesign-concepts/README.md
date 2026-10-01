# Nebula Music redesign concepts

Five development-only redesign concepts for the existing Nebula Music app shell.
They share the same music, navigation, queue, playback, like, search, and volume
affordances, but deliberately use different hierarchy and interaction models.

Run the app with `npm run dev`, then open:

`http://127.0.0.1:3000/?designPrototype=1&variant=A`

Use the bottom switcher or the left/right arrow keys to move between concepts.
The active `variant` query parameter is shareable.

| Key | Concept | Structural idea |
| --- | --- | --- |
| A | Sleeve Index | Strict record catalog with a numbered index and art-led feature field. |
| B | Listening Room | A cinematic, single-record listening space with adjacent-track wayfinding. |
| C | Signal Desk | A compact studio console with meters, channels, and a dense track table. |
| D | Liner Notes | A cool-paper weekly journal that treats discovery as an edited sequence. |
| E | Patch Bay | A spatial connection map linking mood, artist, album, discovery, and queue. |

The concept lab is guarded by `import.meta.env.DEV`, so it is not reachable in
production builds. It does not replace or modify the existing player behavior.
