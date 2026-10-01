import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronRight, CircleAlert, LoaderCircle, Moon, Play, Search, Settings2, SlidersHorizontal, Sun } from 'lucide-react';
import { Button, Card, Input, ToggleRow } from '../../components/ui';
import { studioTokens, type ThemeMode } from '../tokens';
import './catalog.css';

type Status = 'empty' | 'loading' | 'error' | 'ready';
const tokenGroups = ['color', 'type', 'space', 'radius', 'shadow', 'motion'] as const;
const comparisonRows = [
  ['Views and navigation', 'Full shared renderer and Studio navigation operate against demo data.', 'No user music-server account or library.'],
  ['Search, playlists, and likes', 'Shared UI and Store interactions run against local demo state.', 'Preview persistence only; no Subsonic mutations.'],
  ['Transport, queue, and volume', 'Shared player controls work with a local, seekable WAV fixture.', 'Fixture audio is not a music-server stream.'],
  ['Settings and personalization', 'Shared settings renderer runs with preview-only storage.', 'Electron, updater, Stream Deck, and AI DJ actions cannot succeed in the browser.'],
  ['Radio', 'The shared route and player UI are available.', 'Live stations and network playback are not verified by the fixture.'],
] as const;

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return <section className="studio-section" id={id}><p className="studio-kicker">{kicker}</p><h2>{title}</h2>{children}</section>;
}

function Dialog({ onClose }: { onClose: () => void }) {
  const label = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={dialogRef} className="studio-dialog" aria-labelledby={label} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div><p className="studio-kicker">DIALOG / CONFIRM</p><h2 id={label}>Save Studio preference?</h2><p>Catalog controls are isolated preview state. Nothing is written to Nebula settings.</p></div><div className="studio-dialog-actions"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onClose}>Save preview</Button></div></dialog>;
}

export function StudioCatalog() {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [query, setQuery] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(62);
  const [tab, setTab] = useState<'Queue' | 'Details'>('Queue');
  const [status, setStatus] = useState<Status>('ready');
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState('Studio catalog ready.');
  const palette = studioTokens.color[mode];
  const tabsRef = useRef<HTMLDivElement>(null);
  const selectTab = (next: 'Queue' | 'Details') => setTab(next);
  const moveTab = (event: React.KeyboardEvent<HTMLButtonElement>, current: 'Queue' | 'Details') => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'Queue' : event.key === 'End' ? 'Details' : current === 'Queue' ? 'Details' : 'Queue';
    selectTab(next);
    tabsRef.current?.querySelector<HTMLButtonElement>(`#studio-tab-${next.toLowerCase()}`)?.focus();
  };
  const cssVariables = { colorScheme: mode, ...Object.fromEntries(Object.entries(palette).map(([key, value]) => [`--studio-${key}`, value])) } as React.CSSProperties;
  return <div className={`studio-catalog ${mode === 'dark' ? 'dark' : ''}`} data-theme={mode} style={cssVariables}>
    <a className="studio-skip" href="#foundations">Skip to Studio foundations</a>
    <header className="studio-header"><a href="/" className="studio-wordmark">NEBULA <span>/ STUDIO</span></a><div className="studio-header-actions"><div className="studio-theme" aria-label="Catalog theme">{(['light', 'dark'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'light' ? <Sun size={15} /> : <Moon size={15} />} {value}</button>)}</div><a href="/studio.html" className="studio-link">Open Studio app <ChevronRight size={14} /></a></div></header>
    <main className="studio-main">
      <section className="studio-hero"><p className="studio-kicker"><span /> DESIGN REFERENCE / E</p><h1>Calm, tactile<br /><em>listening controls.</em></h1><p>Studio collects the proposed design direction without claiming a product migration. Every interaction below is a local preview.</p><div className="studio-meta"><span>14px controls</span><span>22px artwork</span><span>200ms motion</span></div></section>

      <Section id="foundations" kicker="01 / FOUNDATIONS" title="A quiet system with physical cues."><div className="studio-token-grid">{tokenGroups.map(group => <article key={group}><h3>{group}</h3>{group === 'color' ? <div className="studio-swatches">{Object.entries(palette).map(([name, value]) => <span key={name}><i style={{ background: value }} /><b>{name}</b><code>{value}</code></span>)}</div> : <dl>{Object.entries(studioTokens[group]).map(([name, value]) => <div key={name}><dt>{name}</dt><dd><code>{String(value)}</code></dd></div>)}</dl>}</article>)}</div><p className="studio-caption">Color names describe roles, not utility classes. Raised controls use a top edge and low outer shadow; inset tracks use the reciprocal shadow.</p></Section>

      <Section id="controls" kicker="02 / CONTROLS" title="Controls state their intent."><div className="studio-showcase"><article><h3>Buttons</h3><div className="studio-row"><Button icon={<Play size={15} fill="currentColor" />} onClick={() => setNotice('Play action selected.')}>Play</Button><Button variant="secondary" onClick={() => setDialog(true)}>Open dialog</Button><Button variant="ghost" onClick={() => setNotice('Ghost action selected.')}>Ghost</Button><Button disabled>Disabled</Button><Button loading aria-label="Loading preview">Loading</Button></div><p>Default, hover, focus-visible, active, disabled, and loading are demonstrated by the shared Button. Studio’s proposed rectangular control shape is documented below, pending component adoption.</p></article><article><h3>Inputs & range</h3><label className="studio-field">Search library<Input icon={<Search size={15} />} value={query} onChange={event => setQuery(event.target.value)} clearable onClear={() => setQuery('')} placeholder="Artist, album, track" /><small>{query ? `Searching preview for “${query}”` : 'Type to reveal clear state.'}</small></label><label className="studio-slider">Volume <input type="range" min="0" max="100" value={volume} onChange={event => setVolume(Number(event.target.value))} /><output>{volume}%</output></label><ToggleRow label="Tactile controls" description="Preview only; does not change app settings." checked={enabled} onChange={setEnabled} /></article></div></Section>

      <Section id="navigation" kicker="03 / NAVIGATION & SURFACES" title="One selection, clearly held."><div className="studio-showcase"><article><h3>Segmented tabs</h3><div ref={tabsRef} className="studio-tabs" role="tablist" aria-label="Studio catalog preview">{(['Queue', 'Details'] as const).map(item => <button id={`studio-tab-${item.toLowerCase()}`} key={item} role="tab" aria-selected={tab === item} aria-controls="studio-tab-panel" tabIndex={tab === item ? 0 : -1} onKeyDown={event => moveTab(event, item)} onClick={() => selectTab(item)}>{item}{item === 'Queue' && <span>3</span>}</button>)}</div><div id="studio-tab-panel" className="studio-tabpanel" role="tabpanel" aria-labelledby={`studio-tab-${tab.toLowerCase()}`}><strong>{tab === 'Queue' ? 'Up next' : 'Track details'}</strong><p>{tab === 'Queue' ? 'Queue rows retain title, artist, and duration.' : 'Metadata stays secondary to the active listening task.'}</p></div></article><article><h3>Cards</h3><div className="studio-card-set"><Card className="studio-card studio-card-raised" padding="sm"><Settings2 size={18} /><strong>Raised surface</strong><p>Actionable content with a lit edge.</p></Card><Card className="studio-card studio-card-inset" padding="sm"><SlidersHorizontal size={18} /><strong>Recessed surface</strong><p>Tracks and grouped controls.</p></Card></div></article></div></Section>

      <Section id="feedback" kicker="04 / STATUS & RECOVERY" title="No silent states."><div className="studio-status-switch" aria-label="Status specimen">{(['ready', 'empty', 'loading', 'error'] as Status[]).map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{value}</button>)}</div><div className={`studio-status studio-status-${status}`} role={status === 'error' ? 'alert' : 'status'}>{status === 'ready' && <><Check /><div><strong>Saved locally</strong><p>The catalog preview is ready to inspect.</p></div></>}{status === 'empty' && <><Search /><div><strong>No matches yet</strong><p>Try an artist, album, or track name.</p></div></>}{status === 'loading' && <><LoaderCircle className="studio-spin" /><div><strong>Loading library</strong><p>Keep the layout stable while results arrive.</p></div></>}{status === 'error' && <><CircleAlert /><div><strong>Couldn’t reach the server</strong><p>Check the address and try again.</p><button type="button" onClick={() => setStatus('loading')}>Try again</button></div></>}</div><p className="studio-caption">Status language is a proposed catalog pattern. Production states still need to be connected to actual service outcomes.</p></Section>

      <Section id="capabilities" kicker="05 / PREVIEW SCOPE" title="What the Studio preview actually exercises."><details className="studio-comparison" open><summary>Functionality comparison <span>Open review matrix</span></summary><div className="studio-table-wrap"><table><thead><tr><th scope="col">Capability</th><th scope="col">Studio preview</th><th scope="col">Boundary</th></tr></thead><tbody>{comparisonRows.map(([capability, preview, boundary]) => <tr key={capability}><th scope="row">{capability}</th><td>{preview}</td><td>{boundary}</td></tr>)}</tbody></table></div></details><p className="studio-caption">Studio composes the existing renderer, so this is not a mock screen. Its data, persistence, and audio are deliberately isolated from a running desktop application.</p></Section>

      <Section id="accessibility" kicker="06 / ACCESSIBILITY & MOTION" title="The tactile effect must not be required."><div className="studio-access"><div><h3>Keyboard and focus</h3><p>Every demo uses native buttons, inputs, labels, roles where needed, and a high-contrast <code>:focus-visible</code> ring. The dialog closes with Escape and by clicking its backdrop. Tabs also support arrow keys, Home, and End.</p></div><div><h3>Reduced motion</h3><p>Studio transitions stay to control feedback and panel selection. <code>prefers-reduced-motion</code> reduces them to effectively instant changes; no status depends on animation.</p></div><div><h3>Color and language</h3><p>Status uses an icon and direct text alongside color. Accent is not the only selected-state cue; tabs also use a raised surface and text contrast.</p></div></div></Section>
      <p className="studio-live" role="status"><Check size={14} /> {notice}</p>
    </main>
    {dialog && <Dialog onClose={() => { setDialog(false); setNotice('Dialog closed; no settings changed.'); }} />}
  </div>;
}

export default StudioCatalog;
