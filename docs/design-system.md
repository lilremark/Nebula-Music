# Nebula design system

This is a code-based reference extracted from Nebula's current interface. It gives future refinements a shared place to change foundations, inspect component states, and record deliberate differences. It is a baseline, not a completed redesign or a claim that every screen already uses one component family.

## Open the gallery

For the five raised-surface refinement proposals, see the [refinement lab guide](design-refinements.md) or open `/refinements.html` on the same development server.

```sh
npm run design-system
```

Open <http://localhost:3100>. The gallery runs alongside the application on its own Vite entry. It does not mount `App`, `StoreProvider`, audio, authentication, or the Electron bridge. Theme, accent, and player interactions are held only in memory; refreshing restores the reference defaults. The two font families use the same Google Fonts request as the app, with local fallbacks when offline.

```sh
npm run design-system:build
```

This produces a standalone static site in `dist-design-system/`. Serve that directory with a static HTTP server; don't open its HTML with `file://`. It is separate from the normal app and mini-player build. Export tokens in the gallery downloads a JSON snapshot including both palettes, the preview accents, spacing, typography, radii, and motion easing. The export is a reference snapshot, not an importable app settings file or a complete DTCG token package.

## Ownership and entry points

| Source | Owns | Current consumers |
| --- | --- | --- |
| [`design-system/tokens.ts`](../design-system/tokens.ts) | Typed light/dark palettes and default user accents | ThemeContext, Store defaults, gallery |
| [`design-system/tailwind-preset.js`](../design-system/tailwind-preset.js) | Existing font stacks, radius overrides, shadows, blur, animation, and easing configuration | Root Tailwind config and gallery |
| [`index.css`](../index.css) | Theme fallbacks, adaptive variables, glass/floating surface recipes, global focus, scrollbars, legacy animation | Application, mini-player, gallery |
| [`components/ui/`](../components/ui/) | Shared React components | Sign-in, Settings, gallery; see adoption below |
| [`design-system/Gallery.tsx`](../design-system/Gallery.tsx) | Interactive specimens, pattern compositions, illustrative content | Gallery only |
| [`design-system/gallery.css`](../design-system/gallery.css) | Reference page layout and illustrative pattern styles | Gallery only |

Change the palette in `tokens.ts` and keep the CSS fallbacks in `index.css` aligned. `tokens.test.ts` checks that contract. Existing `--theme-*` and RGB-channel `--color-*` names are preserved. Tailwind custom values were moved intact into the preset; utility names and values remain unchanged. Spacing and typography examples in the gallery are observed conventions; they are not yet a new global type or spacing API.

## Foundations

### Three color responsibilities

1. **Theme**: neutral light/dark structure through `useTheme().colors` or `var(--theme-text)`, `var(--theme-bgSecondary)`, etc. ThemeContext continues to apply the user's saved mode.
2. **User accents**: default primary cyan `#06b6d4` and secondary violet `#8b5cf6`. Store applies user overrides as space-separated RGB channels so utilities such as `bg-primary/20` keep working. CSS alone has historical monochrome accent fallbacks; the standalone gallery explicitly supplies the real Store defaults.
3. **Adaptive colors**: artwork-derived accents, surfaces, and contrast choices from [`useAdaptiveColors`](../hooks/useAdaptiveColors.ts). These are contextual to playback, not replacements for theme tokens. Gallery player artwork is illustrative and uses the preview primary accent; it does not run the artwork extraction algorithm.

Success, warning, and error use emerald, amber, and red. Status meaning needs a label or icon, not color alone. Existing `Badge` variants and app quality badges are separate implementations.

| Semantic role | Light | Dark |
| --- | --- | --- |
| Background | `#e8e8e8` | `#0a0a0a` |
| Secondary background | `#d4d4d4` | `#171717` |
| Tertiary background | `#c0c0c0` | `#262626` |
| Primary text | `#0a0a0a` | `#fafafa` |
| Secondary text | `#404040` | `#a3a3a3` |
| Tertiary text | `#737373` | `#525252` |
| Border | `#b0b0b0` | `#404040` |

These are source values, not a contrast certification. Tertiary text and arbitrary user accents require contrast review before carrying essential content.

### Typography, spacing, and shape

- Inter is the UI face; JetBrains Mono is used for durations, counts, shortcuts, and technical metadata. The existing font request loads Inter 300–700 and JetBrains Mono 400. Some screens request 900, which may be synthesized.
- Common sizes are 10px metadata, 12px secondary text, 14px controls/body, 18–20px section headings, and 24–48px page headings. The gallery shows representative specimens, not a newly mandated type scale.
- Spacing generally follows a 4px rhythm with half steps where needed. Home uses 24px / 32px gutters and a 1600px maximum. Settings and AlbumDetail use 24px / 40px gutters. Artwork grids commonly use 16px gaps.
- `rounded-lg` is 8px and common in the current library and Settings. Custom `xl`, `2xl`, `3xl`, `4xl` values are 14, 18, 24, and 32px. Shared Button is pill-shaped. Don't replace these differences until a context-specific refinement is agreed.
- Lucide icons are generally 16–20px inside controls. Give icon buttons an explicit accessible name; use tooltip text as supplementary information.

### Surfaces and motion

The current shell uses glass for the top bar, floating player, and overlays. Content and settings favor solid neutral fills and quiet borders. There are **three different elevation implementations** today: the Card component, `floating-card-*` CSS utilities, and Tailwind `shadow-float-*`. The gallery renders Card directly; it does not imply the other definitions match it.

Press feedback is typically 100–150ms, controls and surfaces 200–300ms, panel entrance 400ms, and fade/reveal 500ms. `smooth` is `cubic-bezier(0.4, 0, 0.2, 1)` and `snappy` is `cubic-bezier(0.16, 1, 0.3, 1)`. The gallery disables animation for reduced motion, but the application still needs a complete motion pass.

## Shared component API and adoption

Import from `components/ui` or from an individual component file. The existing prop contracts are preserved.

| Component | Options | Defaults | Adoption |
| --- | --- | --- | --- |
| `Button` | `variant`: primary, secondary, ghost, icon; `size`: sm, md, lg; `loading`, `disabled`, `glow`, `icon`; native button props | primary, md | Sign-in and gallery |
| `Input` | Native input props/ref; `icon`, `iconPosition`, `error`, `clearable`, `onClear` | left icon, not clearable | Sign-in and gallery |
| `Card` | `elevation`: 1–4; `padding`: none, sm, md, lg; `hover`, `glow`; native div props | 1, md, hover enabled | Sign-in and gallery |
| `Badge` | `variant`: default, primary, secondary, success, warning, error; `size`: sm, md; `glow`, `icon` | default, md | Existing primitive; gallery exposes it, little app adoption |
| `Tooltip` | `content`, `position`: top, bottom, left, right; `delay`, `children` | top, 200ms | Gallery and dormant legacy Sidebar |
| `SettingPanel` | `icon`, `title`, optional `description`, `className`, `children` | 8px bordered panel | Extracted from Settings; shared by Settings and gallery |
| `ToggleRow` | `label`, optional `description`, `checked`, `onChange` | Controlled value, full-row target | Extracted from Settings; shared by Settings and gallery |

The settings extractions retain the original class recipes and behavior: a 260px explanatory column at `lg+`, 20px horizontal and 16px vertical row padding, and a 44×24px toggle with a 16px thumb. ToggleRow remains a button with `aria-pressed`; `onChange` receives the next boolean value.

```tsx
import { SettingPanel, ToggleRow } from './components/ui';
import { Volume2 } from 'lucide-react';

<SettingPanel icon={Volume2} title="Playback" description="Playback preferences">
  <ToggleRow
    label="Crossfade"
    description="Blend the ending of one track into the next."
    checked={enabled}
    onChange={setEnabled}
  />
</SettingPanel>
```

```tsx
import { Button, Input } from './components/ui';

<label htmlFor="server">Server address</label>
<Input id="server" value={url} onChange={e => setUrl(e.target.value)} />
<Button type="submit" loading={connecting}
  aria-label="Connect to server" aria-busy={connecting}>
  Connect
</Button>
```

For a non-submit action inside a form, explicitly set `type="button"`. The current Button inherits native submit behavior when type is omitted. Its loading state replaces children with a spinner, so provide `aria-label` and `aria-busy`. Input error text currently needs an explicit accessible association for production forms; simply passing `error` does not set `aria-describedby`. Use an external identified description with `aria-describedby` when needed. These behaviors are recorded for refinement rather than silently changed during extraction.

Use `hover={false}` for static Cards such as forms. Use native disabled state for unavailable actions, not opacity alone. A tooltip must not be the only name of a control. Review long text, field errors, loading labels, empty results, and focus with the keyboard before adopting a component more broadly.

## Current application patterns

| Pattern | Current source | Contract |
| --- | --- | --- |
| Top bar | [`TopBar`](../components/layout/TopBar.tsx) | 64px glass header; menu, title, search, settings |
| Main navigation | [`NavDrawer`](../components/navigation/NavDrawer.tsx) | Overlay drawer; 288px/max 85vw; solid primary active item with black text; 8px corners |
| Player split | [`SplitLayout`](../components/layout/SplitLayout.tsx) | Optional 380px right player at `lg+`; collapsed player floats bottom-center |
| Album tile | [`Home`](../views/Home.tsx) | Square 8px artwork; hover zoom/scrim/play; title + artist beneath |
| Track row | [`AlbumDetail`](../views/AlbumDetail.tsx) | Title, artist, monospace duration, favorite state, hover/current tint |
| Now Playing | [`NowPlayingPanel`](../components/player/NowPlayingPanel.tsx) | 240px artwork, 18px title, adaptive 48px circular play control |
| Full player | [`Player`](../components/Player.tsx) | Contextual 80px white rounded-square play control |

The gallery's music specimens are composed references using local illustrative artwork and local state. They are **not** newly extracted production media components. Its left reference navigation is gallery chrome; Nebula itself uses the top bar plus drawer. The older `components/Sidebar.tsx` is not mounted by App and should not define the current navigation baseline. Existing `components/design-prototype/` work is a separate exploration.

## Refinement queue

1. Agree where the sign-in pill/glass family and dense 8px library family should converge. Extract more production components after that decision, rather than establishing gallery-only lookalikes as a standard.
2. Audit contrast across both themes, dark-oriented Badge variants, tertiary text, and user-customized accents. Review the hardcoded black play icon over adaptive artwork colors.
3. Consolidate elevation definitions and replace hardcoded cyan/violet glows where they should follow user accents.
4. Complete keyboard interaction, tooltip association and dismissal, input error association, disabled-field presentation, and app-wide reduced motion.
5. Resolve font weights, page-title hierarchy, and contextual spacing variations.

## Validation for the next refinement

```sh
npm run typecheck
npm test
npm run build
npm run design-system:build
```

Review the gallery in both themes and at narrow widths; inspect hover, focus, disabled, error, loading, and long-content states. Exercise clearable inputs, toggle rows, player preview, and token export. Then inspect the actual consuming screen: the gallery intentionally doesn't exercise server, playback, or desktop integration. Keep app settings untouched while exploring the gallery.
