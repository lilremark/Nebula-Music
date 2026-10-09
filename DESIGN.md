---
name: "Nebula Studio — Precision Rail"
description: "A compact, art-led precision listening console, documented as a Studio-only design world."
colors:
  listening-canvas: "#070707"
  instrument-panel: "#0d0d0e"
  raised-panel: "#131315"
  control-well: "#1a1a1d"
  control-hover: "#222226"
  hairline: "rgba(255,255,255,.1)"
  hairline-strong: "rgba(255,255,255,.18)"
  warm-white: "#f8f7f3"
  warm-muted: "#aba8a2"
  warm-faint: "#aaa69f"
  ember: "#ff5a36"
  ember-hot: "#ff3d1f"
  ember-ink: "#200702"
  connected-green: "#63ca79"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(40px, 6vw, 78px)"
    fontWeight: 800
    lineHeight: 0.91
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(34px, 4vw, 56px)"
    fontWeight: 760
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  control-label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  section-label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.08em"
  caption:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  artwork-small: "9px"
  compact: "10px"
  control: "11px"
  brand: "12px"
  search: "13px"
  artwork: "14px"
  room: "16px"
  round: "999px"
spacing:
  tight: "7px"
  compact: "9px"
  card: "13px"
  control-inline: "17px"
  panel: "24px"
  route-section: "44px"
  page-desktop: "30px 34px 118px"
  page-mobile: "25px 18px 110px"
  feature-copy: "42px 44px 76px"
components:
  action-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.ember-ink}"
    rounded: "{rounded.control}"
    padding: "0 17px"
    height: "44px"
  hook-navigation-item:
    backgroundColor: "transparent"
    textColor: "{colors.warm-muted}"
    rounded: "{rounded.compact}"
    padding: "7px 10px 7px 21px"
    height: "44px"
  step-player-control:
    backgroundColor: "{colors.warm-white}"
    textColor: "{colors.ember-ink}"
    rounded: "{rounded.round}"
    size: "44px"
  command-search:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.room}"
    width: "min(650px, 100%)"
  animated-switch:
    backgroundColor: "transparent"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.round}"
    width: "48px"
    height: "44px"
  artwork-track-card:
    backgroundColor: "{colors.instrument-panel}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.artwork}"
    padding: "13px"
    height: "112px"
  sidebar-player:
    backgroundColor: "{colors.instrument-panel}"
    textColor: "{colors.warm-white}"
    rounded: "0"
    width: "326px"
    height: "100%"
  floating-player:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.room}"
    padding: "9px 11px"
    width: "min(850px, calc(100vw - 310px))"
    height: "70px"
  settings-surface:
    backgroundColor: "{colors.instrument-panel}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.room}"
    width: "100%"
  immersive-player:
    backgroundColor: "{colors.listening-canvas}"
    textColor: "{colors.warm-white}"
    rounded: "0"
    width: "100%"
    height: "100%"
---

# Design System: Nebula Studio — Precision Rail

## Overview

**Creative North Star: "Precision Rail"**

Nebula is a precision listening console: music carries the emotion while the shell stays compact, exact, and immediately operable. Precision Rail gives that thesis a distinct Studio expression through near-black instrument surfaces, warm white type, one ember action color, hairline divisions, restrained corners, and real album artwork. This is the revised, selected concept 1 with direction seed `b32f1836`.

The story is continuous rather than dashboard-like. A listener scans one large five-track feature, starts a song through the shared playback owner, browses quiet artwork shelves, tunes the device, and controls the shared queue without leaving the music. A RareUI-inspired hooked navigation rail anchors the left edge; Spectrum-inspired command search and explicit state controls keep operation immediate; a Spell-inspired artwork card and fresh Studio player compositions let the music carry the visual weight.

This world is source-backed by `design-system/studio.html` and `design-system/studio/**`. It consumes Nebula's real `StoreProvider`, service surface, navigation, settings, queue, audio clock, player state, and desktop bridges. It does not replace the production renderer, production theme, or the architecture described in `PRODUCT.md` and ADR 0003. Studio uses isolated preview persistence, local artwork, and generated fixture audio while the mounted React session remains the only playback owner.

**Key Characteristics:**

- Full-bleed, square application framing with depth reserved for interior music rooms.
- A precision three-panel desktop console: hooked navigation, music canvas, and shared queue/player.
- One five-track Featured bar with real Store actions, timed progression, and deliberate pause controls.
- DM Sans for interface density and Manrope for display authority.
- Near-black tonal layers, raised-contrast muted and faint text, hairline divisions, and scarce ember state.
- Artwork-first shelves and flat ledgers instead of a field of equal cards.
- Source-backed primitives with explicit keyboard, focus, disabled, loading, empty, and active states.
- A sidebar player on wide desktop, a persistent floating dock in compact/mobile modes, and a full-screen player overlay.
- Full Nebula feature behavior inside a deliberately isolated Studio data boundary.

### Scope and review history

The last recorded Impeccable reviewer disposition is exactly **PARTIAL**. That pass preceded the final post-review cleanup and is not a new verdict on the current files. After that review, the implementation fixed playlist object and QA routing, local/generated playlist resolution, destructive playlist deletion confirmation, the remaining key 44px targets, desktop-only field disabling, and the final Songs and Playlist captures. This document describes the current cleaned-up implementation while preserving the historical disposition.

## Colors

The dark theme is the normative visual world: adjacent neutral blacks establish hierarchy, warm text remains legible at compact sizes, and the Appearance-selected primary is the only saturated action voice. Ember is the default seed, not a hard-coded override. The implemented light mode remaps the same semantic roles to warm paper, never to cool blue-gray.

### Primary

- **Ember Action** (`ember`): Default seed for current destination, primary playback, selected settings state, progress, focus, and live visual signals. Studio replaces this role at runtime with the primary color selected in Appearance.
- **Hot Ember** (`ember-hot`): Intensified hover or active emphasis for the most important transport action.
- **Ember Ink** (`ember-ink`): Default foreground on accent surfaces. Runtime contrast chooses black or white ink for the selected primary color.

### Tertiary

- **Connected Green** (`connected-green`): Tiny connected-state confirmation in the navigation footer. It is a status signal, not a second call-to-action color.

### Neutral

- **Listening Canvas** (`listening-canvas`): Full viewport and immersive-player ground.
- **Instrument Panel** (`instrument-panel`): Navigation, sidebar player, artwork cards, settings, and quiet contained tasks.
- **Raised Panel** (`raised-panel`): Command search, dialogs, and elevated fields that need clear separation.
- **Control Well** and **Control Hover** (`control-well`, `control-hover`): Resting and hover fills for bounded controls.
- **Warm White**, **Warm Muted**, and **Warm Faint** (`warm-white`, `warm-muted`, `warm-faint`): Primary content, secondary metadata, and de-emphasized labels. The muted and faint values are intentionally close and sufficiently raised for compact UI copy.
- **Hairline** and **Strong Hairline** (`hairline`, `hairline-strong`): Separators and elevated boundaries between close dark surfaces.

### Named Rules

**The Ember Is Action Rule.** Ember marks current state, playback intent, focus, progress, or an active signal; it never decorates passive panels.

**The Appearance Accent Rule.** The selected Appearance primary drives Studio play controls, progress, focus, switches, and selected state. The selected background seeds the dark neutral stack, and the secondary color participates only in the immersive visualizer. These values remain scoped to `.nebula-remix`.

**The Warm Black Rule.** Use the neutral-black stack and warm foregrounds; do not substitute cool graphite, blue-black, or an extra accent family.

**The Semantic Theme Rule.** Light mode may invert semantic surfaces to warm paper, but it must preserve the same hierarchy, scarce accent, and hairline discipline.

## Typography

**Display Font:** Manrope (with sans-serif fallback)  
**Body Font:** DM Sans (with sans-serif fallback)  
**Label Font:** DM Sans (with sans-serif fallback)

**Character:** Manrope supplies compact editorial authority without becoming ornamental; DM Sans keeps navigation, metadata, settings, and transport controls calm and readable. The pairing is deliberately practical: titles carry the music's confidence while the interface stays quiet. The shared Studio scale starts at `11px` for tertiary utility data, steps through `12–15px` for metadata, controls, and body text, and uses `20px` for instrument titles so dense surfaces remain readable without zoom.

### Hierarchy

- **Display** (`display`): Featured track titles. Use the tightest line height and the heaviest title weight only where one music object owns the viewport.
- **Headline** (`headline`): Route, album, playlist, and artist titles. Keep titles balanced and capped to short measures.
- **Title** (`title`): Shelf headings, settings surfaces, playlist dialogs, and compact focal labels.
- **Body** (`body`): Route descriptions and supporting product copy, generally held to approximately 68 characters.
- **Control Label** (`control-label`): Primary actions, navigation labels, track titles, and settings names.
- **Section Label** (`section-label`): Uppercase navigation groups and command-result group labels.
- **Caption** (`caption`): Artist, album, count, format, connection, and help metadata.

### Named Rules

**The Artwork Speaks First Rule.** Give display scale to the active track, artist, or collection, then step sharply down to metadata; do not seed every panel with another large heading.

**The Family Ownership Rule.** Manrope owns display and titles. DM Sans owns body, labels, inputs, timing, and controls. Do not reintroduce Inter or a decorative display family inside Studio.

**The Tracking Floor Rule.** Tight display tracking stops at the established floor; compression must never damage title legibility.

**The Readability Floor Rule.** Essential Studio copy never renders below `11px`; time, format, artist, help, and queue metadata use the shared readable scale instead of one-off micro type.

## Layout

The browser viewport is the frame. `.studio-app`, `.studio-stage`, and the main remix shell fill it without an outer mat, border, radius, or shadow. The wide layout is a true three-column instrument: a `242px` navigation rail, a flexible music canvas, and a `326px` sidebar player. Closing navigation eases the rail and its grid column out as one continuity gesture while preserving the music canvas and player columns.

The route canvas is capped at `1480px` and uses the normative desktop and mobile page insets. Sections breathe with the route-section spacing while individual controls stay dense. Home and Browse reserve the strongest plane for the Featured bar, then transition to quieter artwork cards, collection shelves, mixes, and ledgers.

### Responsive boundaries

- **Compact desktop (`1260px` and below):** Navigation narrows to `218px`; the right sidebar player is removed from the grid and the floating player becomes the persistent transport. Collection shelves reduce to four columns, the Home split stacks, and quick artwork cards can form a four-column rail.
- **Mobile/tablet (`900px` and below):** The shell becomes a single block. Navigation becomes a left modal drawer up to `min(300px, 88vw)`, content remains full width, the search trigger collapses to an icon, collection shelves use three columns, detail layouts tighten, Settings navigation becomes a horizontal scroller, and the floating player hides timeline and volume to protect transport. The large player's secondary aside is hidden and its primary content centers.
- **Small (`620px` and below):** Page edges tighten, route headings and the Featured title reduce, the feature becomes a bottom-anchored editorial stack, collection shelves use two columns, track ledgers remove lower-priority album/format/time/actions, detail heroes stack, Radio and forms become single-column, and large-player artwork shrinks.

### Focus, overlays, and scroll

Command Search, Add to Playlist, and Large Now Playing share overlay semantics: focus moves into the surface, Tab and Shift+Tab remain contained, Escape dismisses, background siblings become `inert` and `aria-hidden`, body scrolling locks where the shared helper is used, previous accessibility state is restored, and focus returns to the invoking control. The mobile navigation drawer applies the same containment and restoration behavior at its responsive boundary, exposes dialog semantics only while mobile, closes from Escape or the scrim, and remains inert and hidden when closed.

**The Three-Panel Rule.** On wide screens, navigation, listening canvas, and now-playing remain distinct siblings; do not translate the composition into a generic card dashboard.

**The Breakpoint Ownership Rule.** Player mode changes at the compact-desktop boundary, dialog navigation begins at the mobile boundary, and content simplification happens at the small boundary. Do not invent extra near-duplicate breakpoints.

**The 44px Target Rule.** Interactive targets are at least `44px` in either their fixed box or their minimum block size. Small visible icons, rails, dots, and artwork may sit inside that target, but they do not shrink it.

## Elevation & Depth

Depth is mostly tonal. The canvas, rail, settings rows, ledgers, and shelves remain flat; shadows lift only the Featured room, artwork, modal surfaces, the mobile drawer, and persistent player overlays. Blurred artwork is allowed as music-derived atmosphere in detail/player contexts. The floating and immersive player surfaces may use restrained backdrop blur because they are overlays; ordinary application panels must not become glass.

### Shadow Vocabulary

- **Featured Depth** (`studio-depth`): A broad low-opacity shadow under the Featured bar.
- **Artwork Lift:** Small artwork and shelf covers use compact shadows; detail and immersive covers use deeper shadows proportional to their scale.
- **Mobile Drawer Lift:** A directional shadow separates the modal rail from the inert canvas.
- **Floating Player Lift:** A strong ambient shadow keeps the persistent dock readable over changing route content.
- **Modal Lift:** Command Search and Playlist surfaces use the deepest ambient shadow in the system.
- **Switch Knob Lift:** A small local shadow keeps the white switch knob distinct from the control track.

### Named Rules

**The Flat Instrument Rule.** Start with adjacent surface tones and hairlines. Add one shadow only when a surface genuinely overlaps another plane.

**The Music-Derived Atmosphere Rule.** Blur may come from current artwork or a true overlay surface; it is not a generic material for cards, navigation, or settings rows.

## Motion

Motion explains ownership and continuity; it does not decorate still surfaces. Route changes use one short clip-and-settle transition. Segmented controls share one restrained spring indicator so every option stays equal in width regardless of label length. Drawer, sidebar, and floating-player changes preserve spatial continuity. Play/pause icons use a compact scale-and-rotate swap, while hover and press feedback stay local to the control.

Large Now Playing owns the only authored ambient sequence: the real visualizer sits behind the full view, while the record begins fully hidden. Activating the album artwork slides the cover onto the shared control rail and reveals the record in its reserved stage. The record rotates only while the Store reports active playback; pausing stops it in place, and a second artwork activation hides it again. It never clips into the queue column.

When `prefers-reduced-motion` is active, route and selector transitions resolve immediately, player arrival animation is removed, the record does not rotate, and the ambient visualizer is hidden. State, focus, and selected affordances remain legible without motion.

## Shapes

The viewport and large structural columns are square. Interior forms use a restrained `9–16px` radius ladder: tiny artwork and queue thumbnails begin at the small end, controls cluster near the middle, search and artwork cards are slightly softer, and only Featured, settings, command, dialog, and overlay rooms reach the largest radius. Circles are reserved for transport, record/vinyl metaphors, signals, progress tracks, and switches.

Hairlines follow the silhouette without creating boxes around every object. Track rows remain square and flat. Pills are not a general-purpose style; an effectively infinite radius belongs only to controls whose behavior or geometry is continuous.

**The Restrained Corner Rule.** Use the smallest radius that communicates the component's role. Do not inflate all panels toward soft-card styling.

**The Square Ledger Rule.** Track lists are divided rows on the canvas, never a stack of independently rounded cards.

## Components

Studio components are quiet at rest, clear in hover and focus, and decisive in selected or playing state. Every named primitive below is implemented in the Studio source and retains Nebula's real Store/service behavior.

### Studio Button

- **Shape:** Compact rounded rectangle with the normative 44px minimum target.
- **Primary:** Ember field with ember ink, used for Play, Add, Save, Connect, and other immediate intent.
- **Secondary:** Instrument-panel fill and a hairline; image-backed heroes may use a dark translucent version.
- **Quiet:** Transparent at rest for low-priority actions that still require a full target.
- **Danger:** Strong ember treatment reserved for destructive confirmation.
- **States:** Hover changes color or surface without shifting layout; disabled state lowers opacity; focus uses the global two-pixel ember outline with a three-pixel offset.

### RareUI-inspired HookNavigation

- **Structure:** Measured dashed vertical line and hooked corner point to the active item, with a subtler hover/focus preview rail.
- **State:** `aria-current="page"` identifies selection. Text shifts from warm muted to warm white; selected state is expressed by the ember rail rather than a large accent fill. No route is falsely selected when the current surface, such as Settings, sits outside the primary route list.
- **Motion:** The rail follows a restrained spring. Reduced motion makes position and opacity changes immediate.
- **Use:** Primary navigation and the Settings section chooser; at mobile width the Settings instance becomes a horizontal scroller and removes the decorative rail.

### RareUI-inspired StepPlayer and Featured Bar

- **Structure:** Exactly five Store-backed tracks. One active step expands while completed and inactive steps remain compact; every step retains a 44px target.
- **Timing:** Rotation advances every `6.5s` and updates the visible fill on an `80ms` clock.
- **Pause behavior:** Rotation pauses during pointer hover or contained keyboard focus, can be paused/resumed explicitly, and does not autoplay when reduced motion is requested.
- **Manual behavior:** Direct step selection and Left/Right keyboard navigation remain available. Choosing a step resets its progress. Play and Open Album operate on the real Store and service route.

### Spectrum-inspired CommandSearch

- **Trigger:** A centered bordered search control in the top bar with a Ctrl/Cmd+K shortcut; it reduces to an icon at the mobile boundary.
- **Dialog:** Grouped real destinations and up to five playlists, controlled query input, filtered results, Arrow Up/Down movement, Enter selection, and fallback server search when no command matches.
- **Semantics:** Dialog, combobox, listbox, option, active-descendant, selected state, focus containment, inert background, Escape close, outside-pointer close, and focus restoration are all required.
- **Motion:** The palette clips and drops into place with the standard emphasized ease; reduced motion removes the transition.

### Spectrum-inspired AnimatedSwitch

- **Structure:** A 48-by-44px button exposes `role="switch"`, `aria-checked`, a 42px visual track, and an 18px knob.
- **State:** The track becomes ember when checked; the knob travels 20px and stretches during press.
- **Disabled:** Native `disabled` behavior is mandatory for desktop-only settings when Studio is running in a browser.
- **Motion:** The knob uses a short spring; reduced motion updates immediately and suppresses press stretch.

### Equal-width SegmentedControl

- **Structure:** Each choice occupies one equal grid column, independent of label length, with a shared indicator behind the selected label.
- **State:** `aria-pressed` identifies selection; a centered, shadow-free indicator and label color carry the visual state without changing control width.
- **Motion:** The indicator follows a restrained spring between options. Reduced motion updates it immediately.

### Spell-inspired ArtworkTrackCard

- **Structure:** Real cover art, a blurred artwork field, title/artist copy, and an optional secondary action in a compact 112px panel.
- **Interaction:** Hover or active playback shifts the cover left and reveals the peeking record to the right; the cover is the Play control and the title can open the collection.
- **Boundary:** It always controls Nebula's shared playback owner. It never talks to Spotify or creates its own media pipeline.

### Collection Shelves and Track Ledger

Collection shelves let real square artwork own the silhouette, with title and metadata directly below on the canvas. Albums and playlists use restrained corners and a low artwork shadow; artist portraits are circular. The 44px trailing action either starts an available collection or opens it when songs have not been resolved.

Track lists use one top hairline, square 61px rows, compact cover art, album/format/time columns, and contextual Like/Add actions. Hover or current playback reveals the ember play marker. Responsive reduction removes secondary columns before it threatens title or transport.

### Fresh Studio transport and player compositions

All player modes consume the same Store queue, `audioRef` clock, seek, volume, playback rate, pitch, repeat, like, view navigation, lyrics, visualizer, and playlist commands.

- **Shared Transport:** Sidebar, floating, and immersive players use one open transport language: quiet circular secondary actions, a centered previous/play/next cluster, a dominant accent play control, and a full-width thumb-free timeline with endpoint times. The timeline precedes transport in vertical players and sits between identity and transport in the floating dock.
- **SidebarPlayer:** The default wide-desktop mode when a song is queued, sidebar preference is selected, the player has not been collapsed, and the viewport is wider than the compact boundary. A masked, blurred copy of the active cover fades the artwork zone into the semantic panel surface. The distinct panel-collapse action, shared transport, Queue/Sound segments, upcoming rows, and speed/pitch/correction controls remain Store-backed.
- **FloatingPlayer:** Appears when the sidebar is unavailable, manually collapsed, or selected as the player preference. It preserves identity, the shared thumb-free timeline and transport cluster, volume, full-player expansion, and sidebar restoration. At the mobile boundary it becomes a left/right dock and hides seek/volume before compromising transport.
- **RadioDock:** Reuses the floating-player plane for live station identity, play/pause, volume, and stop. Radio and track playback remain mutually legible and share the playback owner.
- **LargeNowPlaying:** A full-viewport modal with a single close action, restrained art-derived atmosphere, and a full-view Store visualizer behind the composition. The artwork is an accessible pressed-state toggle: the record begins completely behind stationary artwork, then slides horizontally into its reserved stage when activated. Its continuous rotation pauses in place when playback pauses and resumes from that position. Artwork, metadata, actions, the shared timeline, transport, and tools remain stationary and aligned to one centered rail. The volume control changes only while held and dragged, while Arrow keys and Home/End preserve keyboard operation. All overlay surfaces inherit the active dark or light theme. The Queue/Lyrics/Sound workspace uses a `400–440px` desktop column and an expanded `760px` height ceiling; mobile hides it and centers the primary listening task.

Library routes are selected exclusively from the left navigation. Their page headings repeat the active navigation label exactly—Artists, Albums, Songs, Playlists, or Liked Songs—then the canvas begins with search, sort, and applicable genre/year filters. It does not repeat those destinations in a second segmented bar.

### Fresh Studio Settings composition

Settings uses HookNavigation for ten real sections: Playback, Appearance, Navigation, Equalizer, Shortcuts, Stream Deck, Desktop, Updates, AI DJ, and Server. One 190px sticky section rail aligns directly with a flexible 16px surface; rows are separated by hairlines rather than recarded. Section headers name the surface without repeating generic explanatory copy.

The composition binds directly to theme, sidebar visibility, crossfade, visualizer, equalizer, shortcut capture, Stream Deck pairing/status, desktop settings, updater actions/channel, AI DJ settings/vault/voice preview, and Subsonic connection. Progress uses one consistent seekable line rather than exposing a redundant display-style selector. In browser Studio, desktop switches, update controls/channel, and the entire AI DJ fieldset are actually disabled and accompanied by explanatory text; they must never look enabled while silently doing nothing.

### Playlist and destructive actions

Add to Playlist is a focus-contained dialog that creates local preview playlists or adds to existing playlists through Store methods. Playlist details resolve a supplied playlist object first, then the current Store list—including generated/local playlists—and finally the service. Destructive deletion requires a separate Confirm delete action before calling the Store and returning to Playlists.

### States and full feature parity

Loading, empty, idle, no-result, active, error, connected, disabled, and current-playing states use the same tonal grammar. The Studio route set covers Listen Now, Browse, Artists, Albums, Songs, Playlists, liked songs/albums, album/artist/playlist detail, Search, Internet Radio, and Settings. It exercises the full shared Store/service path for navigation, catalog fetch, filter/sort/pagination, search, playback, queue, likes, playlists, radio, theme, sound shaping, integrations, desktop settings, updates, AI DJ, and server connection while keeping preview data isolated.

### Named Rules

**The State Must Read Rule.** Every interaction changes at least one of color, border, surface, position, or accessible state while preserving the single-ember hierarchy.

**The Single Playback Owner Rule.** Sidebar, floating, radio, and immersive player surfaces issue commands to the shared Store owner; none may create a second audio element or independent queue.

**The Real Behavior Rule.** A Studio component is not a static facsimile. Navigation, search, settings, playlist, queue, radio, and playback specimens must exercise the real owner through isolated preview adapters.

## Do's and Don'ts

### Do:

- **Do** keep all Precision Rail rendering and overrides under `.studio-app`, `design-system/studio/**`, and `design-system/studio.html` until a separate production migration is explicitly approved.
- **Do** use DM Sans for interface and Manrope for display/title roles.
- **Do** use the exact near-black stack, warm foregrounds, ember action, hairlines, restrained corners, and 44px minimum targets defined in frontmatter.
- **Do** let real artwork and the active music object carry the emotional weight while navigation, metadata, and controls remain compact.
- **Do** preserve the `1260px`, `900px`, and `620px` responsive responsibilities and the corresponding sidebar, floating, and mobile player behavior.
- **Do** retain focus containment, background inertness, Escape dismissal, restored accessibility state, and focus restoration for overlays and the mobile drawer.
- **Do** keep the five-track carousel's timing, interaction pause, reduced-motion stop, and manual selection behavior together.
- **Do** preserve the shared Store/service feature path and isolated Studio persistence, fixtures, and generated audio.
- **Do** require a confirmation step for destructive playlist deletion and actual disabling for unavailable desktop-only fields.

### Don't:

- **Don't** treat this Studio world as the production renderer or silently generalize its tokens into the existing production theme.
- **Don't** introduce a second playback owner, audio pipeline, queue, or player-only state model.
- **Don't** restore Inter, cool blue-black neutrals, competing accent hues, or low-contrast metadata.
- **Don't** surround the viewport, shelves, or track rows with generic soft cards, borders, and shadows.
- **Don't** use pills as the default control shape or shrink interaction targets below the 44px minimum.
- **Don't** autoplay the Featured carousel or animate rails, switches, overlays, artwork, loaders, or radio signals when reduced motion is requested.
- **Don't** leave browser-only desktop controls visually active or let a destructive icon delete immediately.
- **Don't** replace real Store-backed navigation, search, playlist, radio, settings, queue, or playback behavior with mock-only controls.
