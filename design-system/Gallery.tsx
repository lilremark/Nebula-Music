import React, { useEffect, useState } from 'react';
import { AudioLines, ArrowDownToLine, Check, ChevronRight, Disc3, Heart, Home, Layers, Menu, Moon, Pause, Play, RotateCcw, Search, Settings, SkipBack, SkipForward, Sun, Volume2 } from 'lucide-react';
import { Badge, Button, Card, Input, SettingPanel, ToggleRow, Tooltip } from '../components/ui';
import { defaultAccent, themeColors, type ThemeMode } from './tokens';
import { nebulaTailwindPreset } from './tailwind-preset';

const foundations = nebulaTailwindPreset.theme.extend;
const sections = ['Overview', 'Foundations', 'Components', 'Patterns', 'Refinements'];
const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const typeScale = [
  { name: 'Display', size: 48, weight: 700, text: 'Made for listening.', usage: 'Large page titles · use sparingly' },
  { name: 'Page title', size: 32, weight: 700, text: 'Your music, your space.', usage: 'Page hierarchy · tight tracking' },
  { name: 'Section', size: 20, weight: 700, text: 'Recently added', usage: 'Library sections and groups' },
  { name: 'UI / body', size: 14, weight: 500, text: 'Find something worth playing again.', usage: 'Controls, track titles, body copy' },
  { name: 'Supporting', size: 12, weight: 400, text: '12 tracks · 48 minutes', usage: 'Artist names and supporting information' },
  { name: 'Metadata', size: 10, weight: 400, text: 'FLAC · 24 BIT / 96 KHZ', usage: 'JetBrains Mono · technical metadata' },
];
const tracks = [
  { title: 'Quiet Geometry', artist: 'Studio Sessions', duration: '4:32', color: 'teal' },
  { title: 'After Hours', artist: 'Night Archive', duration: '3:48', color: 'violet' },
  { title: 'A Place to Return', artist: 'Open Circuit', duration: '5:16', color: 'amber' },
];

function Section({ id, number, title, description, children }: { id: string; number: string; title: string; description: string; children: React.ReactNode }) {
  return <section id={id} className="ds-section" aria-labelledby={`${id}-heading`}>
    <div className="ds-section-heading"><span className="ds-index">{number}</span><div><h2 id={`${id}-heading`}>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>;
}

function Source({ children }: { children: React.ReactNode }) {
  return <p className="ds-source">Source <code>{children}</code></p>;
}

function Recipe({ children }: { children: string }) {
  return <details className="ds-recipe"><summary>Usage <ChevronRight size={14} /></summary><pre><code>{children}</code></pre></details>;
}

function Artwork({ color, small = false }: { color: string; small?: boolean }) {
  return <div className={`ds-artwork ds-artwork-${color} ${small ? 'ds-artwork-small' : ''}`} aria-hidden="true"><div /><span>NEBULA<br />SESSIONS</span></div>;
}

export function Gallery() {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [accent, setAccent] = useState({ ...defaultAccent });
  const [query, setQuery] = useState('');
  const [crossfade, setCrossfade] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [liked, setLiked] = useState(false);
  const [seek, setSeek] = useState(38);
  const [volume, setVolume] = useState(70);
  const [message, setMessage] = useState('Ready to explore.');
  const [activeSection, setActiveSection] = useState('overview');

  // Preview preferences are deliberately ephemeral; never mount Store or write app settings.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    Object.entries(themeColors[mode]).forEach(([key, value]) => root.style.setProperty(`--theme-${key}`, value));
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ');
    root.style.setProperty('--color-primary', rgb(accent.primaryColor));
    root.style.setProperty('--color-secondary', rgb(accent.secondaryColor));
  }, [mode, accent]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.find(entry => entry.isIntersecting);
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-15% 0px -65% 0px' });
    document.querySelectorAll('.ds-main > section').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const exportTokens = () => {
    const snapshot = { description: 'Nebula current design reference. Preview accents are included; this export does not update the app.', themes: themeColors, accent, spacing, typography: typeScale, radius: { lg: '0.5rem', ...foundations.borderRadius }, motion: foundations.transitionTimingFunction };
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nebula-design-tokens.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Token snapshot exported.');
  };

  const changeTrack = (index: number) => { setSelectedTrack(index); setSeek(0); setPlaying(true); };
  const track = tracks[selectedTrack];

  return <div className="ds-app">
    <a href="#overview" className="ds-skip">Skip to design system</a>
    <aside className="ds-sidebar">
      <a className="ds-brand" href="#overview"><span className="ds-logo"><AudioLines size={22} /></span><span>NEBULA<small>Design system</small></span></a>
      <div className="ds-nav-label">REFERENCE / 01</div>
      <nav aria-label="Design system sections">{sections.map((section, index) => <a href={`#${section.toLowerCase()}`} key={section} aria-current={activeSection === section.toLowerCase() ? 'location' : undefined}><span>0{index + 1}</span>{section}</a>)}</nav>
      <div className="ds-sidebar-note"><span className="ds-dot" /> Current design baseline<p>Built from the app.<br />Ready for what comes next.</p><code>React · Tailwind · Lucide</code></div>
    </aside>

    <div className="ds-workspace">
      <header className="ds-toolbar"><div className="ds-breadcrumb">Nebula <ChevronRight size={13} /><strong>Design system</strong></div><div className="ds-toolbar-actions"><div className="ds-theme-switch" aria-label="Preview theme">{(['light', 'dark'] as const).map(theme => <button key={theme} type="button" aria-pressed={mode === theme} onClick={() => setMode(theme)}>{theme === 'light' ? <Sun size={15} /> : <Moon size={15} />}<span>{theme === 'light' ? 'Light' : 'Dark'}</span></button>)}</div><button type="button" className="ds-export" onClick={exportTokens}><ArrowDownToLine size={15} /><span>Export tokens</span></button></div></header>

      <main className="ds-main">
        <section id="overview" className="ds-overview" aria-labelledby="overview-heading">
          <div className="ds-eyebrow"><span className="ds-dot" /> NEBULA / THE CURRENT DESIGN</div>
          <h1 id="overview-heading">One place.<br /><span>Every detail.</span></h1>
          <p className="ds-intro">The foundations, components, and patterns behind Nebula. A living reference for refining the listening experience.</p>
          <div className="ds-overview-bottom"><a className="ds-jump" href="#components">Explore the components <ChevronRight size={16} /></a><span><a className="ds-refinements-link" href="/studio.html">Open Studio app ↗</a> <a className="ds-refinements-link" href="/studio-catalog.html">Studio catalog ↗</a> <a className="ds-refinements-link" href="/refinements.html?variant=A">Review archived refinements ↗</a></span></div>
          <div className="ds-feature-strip"><div><AudioLines size={20} /><strong>Music comes first</strong><p>Artwork leads. Neutral surfaces give it room.</p></div><div><Layers size={20} /><strong>Depth with restraint</strong><p>Glass for the shell. Solid surfaces for dense content.</p></div><div><Settings size={20} /><strong>Yours to refine</strong><p>Theme, accent, and artwork colors have distinct roles.</p></div></div>
        </section>

        <Section id="foundations" number="02" title="Foundations" description="Existing values, brought together. Change the preview accents to inspect the system in context.">
          <div className="ds-subheading"><h3>Color</h3><span>Neutral structure. Personal accents.</span></div>
          <div className="ds-accent-controls"><label>Primary accent <input type="color" value={accent.primaryColor} onChange={e => setAccent({ ...accent, primaryColor: e.target.value })} /><code>{accent.primaryColor}</code></label><label>Secondary accent <input type="color" value={accent.secondaryColor} onChange={e => setAccent({ ...accent, secondaryColor: e.target.value })} /><code>{accent.secondaryColor}</code></label><button type="button" onClick={() => setAccent({ ...defaultAccent })}><RotateCcw size={14} /> Reset accents</button></div>
          <div className="ds-swatches">{Object.entries(themeColors[mode]).map(([name, color]) => <div className="ds-swatch" key={name}><div style={{ backgroundColor: color }} /><strong>{name}</strong><code>{color}</code></div>)}</div>
          <Source>design-system/tokens.ts → ThemeContext + Store defaults</Source>
          <p className="ds-note">Theme colors set the neutral shell. <code>--color-primary</code> and <code>--color-secondary</code> carry user accents. <code>--adaptive-*</code> belongs to artwork-driven player surfaces. Custom accent contrast is a review task, not automatically guaranteed.</p>
          <Recipe>{`import { themeColors, defaultAccent } from './design-system/tokens';
// In application components:
const { colors } = useTheme();
<div style={{ background: colors.bgSecondary, color: colors.text }} />
// In CSS: color: var(--theme-text);
// User accent utility: className="bg-primary text-black"`}</Recipe>

          <div className="ds-subheading"><h3>Typography</h3><span>Inter + JetBrains Mono</span></div>
          <div className="ds-type-list">{typeScale.map(type => <div className="ds-type-row" key={type.name}><div><strong>{type.name}</strong><code>{type.size}px / {type.weight}</code></div><div><p style={{ fontSize: type.size, fontWeight: type.weight, fontFamily: type.name === 'Metadata' ? 'JetBrains Mono, monospace' : undefined }}>{type.text}</p><small>{type.usage}</small></div></div>)}</div>
          <Source>index.html · tailwind-preset.js · views/Home.tsx</Source>

          <div className="ds-two-columns"><div><div className="ds-subheading"><h3>Spacing</h3><span>4px rhythm · bars at 2×</span></div><div className="ds-spacing">{spacing.map(size => <div key={size}><code>{size}</code><span style={{ width: size * 2 }} /><small>{size / 4} units</small></div>)}</div></div><div><div className="ds-subheading"><h3>Shape</h3><span>Context determines the corner</span></div><div className="ds-radii">{Object.entries({ lg: '0.5rem', ...foundations.borderRadius, full: '9999px' }).map(([key, radius]) => <div key={key}><div style={{ borderRadius: radius }} /><strong>{key}</strong><code>{radius}</code></div>)}</div><p className="ds-note">8px is common in library and settings. The sign-in Card uses 18px; the shared Button uses a pill. These coexist in the current app.</p></div></div>

          <div className="ds-subheading"><h3>Motion & elevation</h3><span>Inspect with hover and keyboard focus</span></div>
          <div className="ds-elevations">{([1, 2, 3, 4] as const).map(level => <Card key={level} elevation={level} padding="sm"><Layers size={20} /><h4>Elevation {level}</h4><p>Shared Card</p><code>elevation={level}</code></Card>)}</div>
          <div className="ds-motion"><span><strong>100–150ms</strong>Press & scale</span><span><strong>200–300ms</strong>Controls & surfaces</span><span><strong>400ms</strong>Panel entrance</span><span><strong>500ms</strong>Fade & reveal</span></div>
          <Source>components/ui/Card.tsx · index.css · design-system/tailwind-preset.js</Source>
          <p className="ds-note">Card, floating-card utilities, and Tailwind shadows have different elevation values today. The gallery honors reduced motion; a full application motion pass remains in the refinement list.</p>
        </Section>

        <Section id="components" number="03" title="Components" description="Real components imported from components/ui. Previews exercise their existing variants and states.">
          <div className="ds-specimen"><div className="ds-specimen-title"><div><h3>Buttons</h3><p>Sign-in actions · pill shape · three sizes</p></div><code>Button</code></div>
            <div className="ds-demo-row"><Button icon={<Play size={16} />} onClick={() => setMessage('Primary action selected.')}>Primary</Button><Button variant="secondary" onClick={() => setMessage('Secondary action selected.')}>Secondary</Button><Button variant="ghost" onClick={() => setMessage('Ghost action selected.')}>Ghost</Button><Tooltip content="Favorite" position="top"><Button variant="icon" aria-label="Favorite preview" aria-pressed={liked} onClick={() => setLiked(!liked)} icon={<Heart size={17} fill={liked ? 'currentColor' : 'none'} />} /></Tooltip></div>
            <div className="ds-demo-row ds-demo-divider"><Button size="sm" onClick={() => setMessage('Small button selected.')}>Small</Button><Button size="md" onClick={() => setMessage('Medium button selected.')}>Medium</Button><Button size="lg" onClick={() => setMessage('Large button selected.')}>Large</Button><Button disabled>Disabled</Button><Button loading aria-label="Connecting" aria-busy="true">Connecting</Button><span className="ds-state-label">Loading</span></div>
            <Recipe>{`import { Button } from './components/ui';
<Button type="submit" loading={connecting} aria-label="Connect to server"
  aria-busy={connecting}>Connect</Button>
<Button variant="icon" aria-label="Play" icon={<Play size={16} />} />`}</Recipe>
          </div>

          <div className="ds-specimen"><div className="ds-specimen-title"><div><h3>Inputs</h3><p>Search, credentials, and validation</p></div><code>Input</code></div>
            <div className="ds-inputs"><label>Search library<Input icon={<Search size={16} />} placeholder="Search artists, albums, tracks" value={query} onChange={e => setQuery(e.target.value)} clearable onClear={() => setQuery('')} /><small>{query ? `Preview query: ${query}` : 'Type to reveal the clear action.'}</small></label><label>Server address<Input defaultValue="https://" error="Enter a complete server address." aria-invalid="true" /></label><label>Unavailable field<Input value="Managed by your server" disabled readOnly /></label></div>
            <Recipe>{`<label htmlFor="server">Server address</label>
<Input id="server" value={url} onChange={e => setUrl(e.target.value)}
  error={error} aria-invalid={Boolean(error)} />
// Supply a visible label; placeholder text is supplementary.`}</Recipe>
          </div>

          <div className="ds-specimen"><div className="ds-specimen-title"><div><h3>Badges & tooltips</h3><p>Small metadata and supplementary descriptions</p></div><code>Badge · Tooltip</code></div><div className="ds-demo-row">{(['default', 'primary', 'secondary', 'success', 'warning', 'error'] as const).map(variant => <Badge key={variant} variant={variant}>{variant}</Badge>)}</div><div className="ds-demo-row ds-demo-divider">{(['top', 'bottom', 'left', 'right'] as const).map(position => <Tooltip key={position} content={`Tooltip on ${position}`} position={position}><Button variant="secondary" size="sm" onClick={() => setMessage(`${position} tooltip trigger selected.`)}>{position}</Button></Tooltip>)}</div><p className="ds-note">Badge is an existing, mostly unadopted primitive with dark-oriented colors. Inspect light mode before reuse. Tooltip supplements a label; it must never be the only accessible name.</p></div>

          <div className="ds-subheading"><h3>Settings panels & toggles</h3><span>Extracted from the current Settings view</span></div>
          <SettingPanel icon={Volume2} title="Playback" description="A shared production panel. These switches change only the preview."><ToggleRow label="Crossfade" description="Blend the ending of one track into the next." checked={crossfade} onChange={setCrossfade} /><ToggleRow label="Playback notifications" description="Show a notification when the track changes." checked={notifications} onChange={setNotifications} /></SettingPanel>
          <Source>components/ui/SettingPanel.tsx · components/ui/ToggleRow.tsx → views/Settings.tsx</Source>
          <Recipe>{`import { SettingPanel, ToggleRow } from './components/ui';
<SettingPanel icon={Volume2} title="Playback" description="Playback preferences">
  <ToggleRow label="Crossfade" checked={enabled} onChange={setEnabled} />
</SettingPanel>
// ToggleRow is controlled and exposes aria-pressed on its button.`}</Recipe>
          <p role="status" className="ds-feedback"><Check size={14} />{message}</p>
        </Section>

        <Section id="patterns" number="04" title="Patterns in context" description="Composed reference specimens based on current screens. Sample artwork and track names are illustrative; playback here changes preview state only.">
          <div className="ds-player-layout">
            <div className="ds-library"><div className="ds-library-header"><Home size={19} /><h3>Quick picks</h3><span>3 tracks</span></div><div className="ds-albums">{tracks.map((item, index) => <button type="button" className="ds-album" key={item.title} onClick={() => changeTrack(index)} aria-label={`Play ${item.title}`}><div className="ds-album-image"><Artwork color={item.color} /><span className="ds-play-overlay"><Play size={26} fill="currentColor" /></span></div><strong>{item.title}</strong><small>{item.artist}</small></button>)}</div><div className="ds-track-list">{tracks.map((item, index) => <button className="ds-track" key={item.title} aria-pressed={selectedTrack === index} onClick={() => changeTrack(index)}><span className="ds-track-number">{selectedTrack === index && playing ? <AudioLines size={15} /> : String(index + 1).padStart(2, '0')}</span><Artwork color={item.color} small /><span><strong>{item.title}</strong><small>{item.artist}</small></span><code>{item.duration}</code></button>)}</div></div>
            <div className="ds-now-playing"><span className="ds-eyebrow">NOW PLAYING / PREVIEW</span><Artwork color={track.color} /><div className="ds-now-title"><div><h3>{track.title}</h3><p>{track.artist}</p></div><button type="button" aria-label="Like current preview track" aria-pressed={liked} onClick={() => setLiked(!liked)}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /></button></div><label className="ds-range-label">Track progress<input type="range" min="0" max="100" value={seek} onChange={e => setSeek(Number(e.target.value))} aria-valuetext={`${seek} percent`} /></label><div className="ds-time"><code>{seek}%</code><code>{track.duration}</code></div><div className="ds-transport"><button type="button" aria-label="Previous preview track" onClick={() => changeTrack((selectedTrack + tracks.length - 1) % tracks.length)}><SkipBack size={20} fill="currentColor" /></button><button className="ds-play" type="button" aria-label={playing ? 'Pause preview' : 'Play preview'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button><button type="button" aria-label="Next preview track" onClick={() => changeTrack((selectedTrack + 1) % tracks.length)}><SkipForward size={20} fill="currentColor" /></button></div><label className="ds-volume"><Volume2 size={15} /><span className="sr-only">Volume</span><input type="range" value={volume} onChange={e => setVolume(Number(e.target.value))} min="0" max="100" /><code>{volume}%</code></label><p className="ds-preview-state" role="status">{playing ? 'Playing' : 'Paused'} · {track.title} · preview only</p></div>
          </div>
          <Source>views/Home.tsx · views/AlbumDetail.tsx · components/player/NowPlayingPanel.tsx</Source>
          <div className="ds-subheading"><h3>Application shell</h3><span>Current layout, measured from the source</span></div>
          <div className="ds-shell"><div className="ds-shell-top"><Menu size={18} /><AudioLines size={18} /><strong>Home</strong><span>64px top bar</span><Search size={18} /></div><div className="ds-shell-body"><div><Disc3 size={28} /><strong>Library & discovery</strong><p>24–32px home gutters<br />1600px content maximum</p><code>Nav drawer: 288px / max 85vw</code></div><aside><AudioLines size={26} /><strong>Now Playing</strong><code>380px at lg+</code><p>Collapses into a floating player.</p></aside></div></div>
          <Source>components/layout/TopBar.tsx · SplitLayout.tsx · navigation/NavDrawer.tsx</Source>
          <p className="ds-note">This page’s reference navigation belongs to the gallery. The application uses a top bar and an overlay navigation drawer, with an optional player on the right.</p>
        </Section>

        <Section id="refinements" number="05" title="Ready for refinement" description="The current baseline is intentionally visible. These are decisions to make next, not changes silently applied to the product.">
          <div className="ds-refinement-list">{[
            ['01', 'Unify the component families', 'Decide when pills and glass belong alongside the denser 8px library and settings controls. The shared sign-in primitives are not yet an app-wide standard.'],
            ['02', 'Audit contrast in both themes', 'Review dark-oriented badges, tertiary text, custom accent combinations, and the player’s black icon over artwork-derived colors.'],
            ['03', 'Align depth and accent effects', 'Consolidate Card, floating-card, and Tailwind shadow values. Several cyan and violet glows still ignore user accent overrides.'],
            ['04', 'Complete interaction coverage', 'Review keyboard access to media tiles, tooltip associations, focus visibility, disabled fields, and reduced motion across the application.'],
            ['05', 'Resolve typography and density', 'Some views request 900 weight while the font loader supplies 300–700. Page headings and gutters also vary between contexts.'],
          ].map(([number, title, description]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div><span className="ds-review-label">To review</span></article>)}</div>
          <div className="ds-next"><h3>A practical refinement loop</h3><p>Change the shared token or component. Review its states here in both themes. Check the consuming screen, then expand adoption. Keep contextual differences explicit until a replacement is agreed.</p><code>docs/design-system.md</code><span>Usage, ownership, API reference, and validation checklist.</span></div>
        </Section>
        <footer className="ds-footer"><span><AudioLines size={15} /> NEBULA DESIGN SYSTEM</span><span>Current foundation / room to evolve</span></footer>
      </main>
    </div>
  </div>;
}
