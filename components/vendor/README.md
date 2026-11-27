# UI component sources

These are source components used in the Nebula app. Their behavior remains in the original implementations; local changes are limited to imports, type compatibility, and integration with Nebula state.

| File | Source | Use |
| --- | --- | --- |
| `rare-step-player.tsx` | [Rare UI Step Player](https://www.rareui.com/components/stepplayer) | Featured track progression |
| `spectrum-animated-switch.tsx` | [Spectrum UI Animated Switch](https://ui.spectrumhq.in/docs/animated-switch) | Settings toggles |
| `aceternity-tabs.tsx` | [Aceternity UI Tabs](https://ui.aceternity.com/components/tabs) | Library browsing tabs |
| `magic-blur-fade.tsx` | [Magic UI Blur Fade](https://magicui.design/docs/components/blur-fade) | Route transitions |
| `reactbits-spotlight-card.tsx` | [React Bits Spotlight Card](https://reactbits.dev/components/spotlight-card) | Art-led collection surfaces |

### Animated backgrounds (`components/backgrounds/`)

These are lean local re-implementations inspired by the components below, not copies: no source was vendored, nothing is installed, and colours come from Nebula's theme tokens.

| File / variant | Inspired by | Use |
| --- | --- | --- |
| `backgrounds.css` — Aurora | [Aceternity UI Aurora Background](https://ui.aceternity.com/components/aurora-background) | Drifting accent glow (CSS only) |
| `backgrounds.css` — Dot grid | [Magic UI Dot Pattern](https://magicui.design/docs/components/dot-pattern) | Static dotted pattern with radial mask |
| `backgrounds.css` — Grid | [Magic UI Grid Pattern](https://magicui.design/docs/components/grid-pattern) | Slowly drifting grid lines |
| `canvasScenes.ts` — Flickering grid | [Magic UI Flickering Grid](https://magicui.design/docs/components/flickering-grid) | Canvas squares with flickering opacity |
| `canvasScenes.ts` — Particles | [Magic UI Particles](https://magicui.design/docs/components/particles) | Sparse drifting specks (no mouse interaction) |
| `canvasScenes.ts` — ASCII field / ASCII rain | Classic density-ramp ASCII art and "digital rain" | Glyph backgrounds that pair with the terminal themes |

[loading.dev Arc](https://loading.dev/) is installed from the `loading-dev` package and used for loading states.

Rare UI requires attribution. Credit: [Rare UI](https://www.rareui.com/).
