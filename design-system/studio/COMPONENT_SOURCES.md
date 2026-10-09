# Nebula Studio component sources

The Studio prototype adapts copy-and-paste components into Nebula's existing React, Vite, Framer Motion, and Store architecture. No source component creates its own playback pipeline.

| Nebula primitive | Source | Adaptation |
| --- | --- | --- |
| `HookNavigation` | [RareUI Hook Sidebar](https://www.rareui.com/components/hooksidebar) | Replaces Next.js routing with controlled Nebula `View` navigation while retaining the measured dashed hook rail and reduced-motion spring. |
| `StepPlayer` | [RareUI Step Player](https://www.rareui.com/components/stepplayer) | Uses the expanding active step and timed fill for Nebula's five-track Featured rotation, using the project's existing Framer Motion dependency. |
| `CommandSearch` | [Spectrum UI Command Search](https://ui.spectrumhq.in/docs/command-search) | Converts the demonstration palette into a real controlled search field with grouped Nebula destinations, playlist commands, keyboard navigation, and server search. |
| `AnimatedSwitch` | [Spectrum UI Animated Switch](https://ui.spectrumhq.in/docs/animated-switch) | Retains the spring knob, pressed stretch, `role="switch"`, and reduced-motion behavior; binds directly to Nebula settings. |
| `ArtworkTrackCard` | [Spell UI Spotify Card](https://spell.sh/docs/spotify-card) | Reuses the blurred artwork field, cover motion, and peeking record metaphor with Nebula cover URLs and the shared playback owner rather than Spotify's API. |

Spell UI is MIT-licensed. Spectrum UI documents its components under Apache 2.0. RareUI permits free use and modification of its components; attribution is retained here and beside the implementation.
