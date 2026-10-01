# Studio design system

Studio is the proposed tactile design direction derived from refinement E. The catalog uses local component state. The Studio app composes the actual renderer with demo data, a preview-only IndexedDB database, and a local audio fixture; it does not touch a Nebula desktop session.

Run `npm run design-system`, then open the [Studio catalog](http://localhost:3100/studio-catalog.html) and the [Studio app](http://localhost:3100/studio.html). The catalog is the source of visual decisions; the app is the integration exercise.

## Design contract

- **Tone:** calm, tactile, and compact. Raised controls and recessed tracks make selection and transport feel physical without relying on animation.
- **Typography:** Inter for interface text and JetBrains Mono for technical labels. The scale is 32/20/14/12/10px for display, title, body, supporting, and metadata.
- **Spacing:** a 4px rhythm, with 16px standard component padding and 24–48px section spacing.
- **Shape:** 14px controls, 16px cards, 22px artwork, and pills only where content is intrinsically compact.
- **Motion:** 120ms press feedback, 180ms controls, and 200ms panel/tab changes. `prefers-reduced-motion` removes nonessential movement.
- **Accessibility:** semantic controls, visible keyboard focus, selected state expressed by more than color, and explicit empty/loading/error copy.

The exact preview values live in `design-system/tokens.ts` as `studioTokens`. They deliberately remain separate from the current runtime palette until adoption has been reviewed.

## Functionality comparison

This matrix is an audit of source in this repository as of the Studio proposal. “Preview” means local fixture/state only. “Desktop required” means the capability relies on Electron or a connected service and is not represented by a standalone Studio preview.

| Capability | Nebula app evidence | Studio app/catalog | Parity assessment |
| --- | --- | --- | --- |
| Library navigation and detail routes | `App.tsx` switches Home, Browse, Radio, library, artist, album, playlist, and search views | Studio composes `AppContent` and `StudioNavDrawer`, including the same view set against demo data | Route parity in the preview shell; server data remains demo-backed |
| Search | `SearchView` and `SearchModal` are mounted by `App.tsx` | The same renderer is composed; catalog also demonstrates query, clear, and empty states | Interaction parity for demo data; no user server search |
| Music playback, queue, transport, volume | Store-backed panels include transport, queue, volume, repeat, like, speed, and pitch controls | Studio reuses the Store/player and `PreviewSubsonicService` supplies a local seekable WAV fixture | Functional preview parity for these controls; fixture audio is not a music-server stream |
| Radio | `InternetRadioView` and radio player variants are routed by `App.tsx` | The view is present through the reused renderer | UI route is present; live stations and network playback are not verified in the Studio fixture |
| Playlists and likes | `PlaylistModal` plus Store actions are mounted by `App.tsx` | Demo mode seeds playlist state; preview persistence is isolated | Local preview persistence only; no Subsonic mutation |
| Settings and personalization | `views/Settings.tsx` exposes appearance, player mode, visualizer, navigation, shortcuts, EQ, AI DJ, Stream Deck, updates, and desktop panels | Same settings UI can render against preview storage; catalog toggles/dialog remain local | Renderer coverage is broad; desktop- and backend-backed actions cannot claim success in preview |
| Theme and accent | Runtime `ThemeContext`, Store settings, and `themeColors` support current app theming | Catalog switches isolated Studio light/dark palettes; preview app uses its own persisted preview data | Studio tokens are a proposal, separate from runtime theme tokens |
| Desktop integration and updates | Electron settings store, updater, title bars, media keys, tray, and window controls | UI may be visible where the shared renderer renders it, but the browser preview has no Electron bridge | Desktop required; no functional parity claimed |
| AI DJ | Electron AI DJ orchestrator/settings and local synthesis paths | Settings UI may be visible through the shared renderer | Backend/local model capability required; no functional parity claimed |
| Accessibility and reduced motion | Existing app has partial component-level support; no verified app-wide motion audit | Catalog supplies keyboard demo, focus ring, native dialog, semantic status, and reduced-motion CSS; Studio drawer traps focus | Catalog and drawer coverage only; app-wide parity unverified |

## Adoption boundary

Studio is not a claim that the application has migrated. Before adopting it in production, map `studioTokens` into the existing theme system, update shared primitives without breaking current consumers, connect each demo to real Store/service outcomes, and test both themes plus keyboard and reduced-motion behavior in the actual Electron shell.
