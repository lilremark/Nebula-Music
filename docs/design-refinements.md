# Nebula refinement lab

Five refinements of the existing layout, focused on raised cards, shadows, buttons, typography, and quiet animation. Each uses the same content so comparisons are about visual treatment.

Start with `npm run design-system`, then open [the Studio app](http://localhost:3100/studio.html). The five-direction refinement lab remains available as an archived comparison at [refinements.html](http://localhost:3100/refinements.html?variant=A).

Studio’s token contract, component catalog, and scope comparison are in [studio-design-system.md](studio-design-system.md).

| Iteration | Review link | Treatment |
| --- | --- | --- |
| A · Graphite | [Open A](http://localhost:3100/refinements.html?variant=A) | Closest to the current design. Crisp 10px cards, tight layered shadows, semibold type; 160ms / 2px lift. |
| B · Contour | [Open B](http://localhost:3100/refinements.html?variant=B) | Softer 20px cards, broad shadows, pill controls, lighter headings; 240ms / 3px lift. |
| C · Precision | [Open C](http://localhost:3100/refinements.html?variant=C) | Compact 6px surfaces, defined bottom edges, dense controls, segmented player tabs; 120ms / 1px lift. |
| D · Suspended | [Open D](http://localhost:3100/refinements.html?variant=D) | Floating 14px glass surfaces, detached top bar and player, translucent controls; 220ms / 3px lift. |
| E · Studio | [Open E](http://localhost:3100/refinements.html?variant=E) | Substantial 16px cards, calm type, raised buttons over recessed transport and tab controls; 200ms / 1px lift. |

Use the A–E buttons to switch without resetting playback selection or settings. Light/dark mode works in all five. Variant and theme are retained in the URL (`&theme=light`); application settings are never read or written.

## What to review

- Home: featured album, raised album cards, recently played rows, button hover/press/focus.
- Settings: open the gear to inspect actual shared SettingPanel, ToggleRow, Input, Card, and Button components with scoped refinement styles. Edit a library name, toggle preferences, and save to see feedback. Values survive navigation within the preview and reset on refresh.
- Player: play/pause, next/previous, favorite, seek, volume, queue/details, and collapsed player. Playback changes local UI state only; there is no audio engine or progressing clock.
- Navigation and overlays: open the menu, search sample tracks (including empty results), and open an album detail dialog. Dialogs use native focus containment and Escape dismissal.
- Narrow screens: the player becomes a compact bottom bar; the reference controls and album grid adapt. Reduced-motion preferences disable transitions and hover lifts.

## Production fidelity and boundaries

The lab uses the repository's React 19, TypeScript, Tailwind 4/PostCSS, Vite, Lucide, Inter, and JetBrains Mono setup. No new dependencies were added. It imports **the production SplitLayout**, retaining its 380px desktop player and responsive collapse behavior, plus the six shared UI components listed above.

Top-bar content, media cards, player content, search, and album dialogs are local compositions based on the current app. They do not mount Store, authentication, networking, Electron, or playback. Artwork is local illustrative SVG. This is a browser-rendered shell for human review, not five completed application implementations.

All refinement styles are scoped beneath `.rf-app` in `design-system/refinements/refinements.css`. Direction definitions, palette/elevation/type/shape recipes, and local fixtures live alongside the shell. Production components are unchanged by this exploration. Earlier `components/design-prototype/` concepts remain separate.

Build with `npm run design-system:build`. Vite emits both the original gallery and `refinements.html` into `dist-design-system/`. The normal application build remains separate.

## Choosing the next pass

Studio is the selected direction. Its follow-up pass keeps the 16px cards and calm typography, with 14px rounded action/navigation buttons, 22px sidebar artwork corners, 38px circular secondary transport controls, and a 54px primary play/pause control. The Queue/Details rail now has a rounded sliding selection pill and a quiet 200ms panel entrance. Keyboard selection supports Left/Right, Home, and End with a single tab stop; reduced motion removes transitions and press movement. The other four directions retain their original controls. These changes remain in the Studio review shell, ready for review before production adoption.

Record a preferred direction and any individual treatments to borrow, for example: “Graphite structure, Studio transport, Contour card shadows.” Review the same home and settings content in light and dark before selecting. A chosen treatment can then move into shared tokens/components and be checked against the real screens.
