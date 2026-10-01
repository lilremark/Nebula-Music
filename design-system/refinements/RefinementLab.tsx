import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, ArrowLeft, ArrowUpRight, Check, ChevronRight, Disc3, Heart, Home, ListMusic, Menu, Moon, MoreHorizontal, PanelRightClose, PanelRightOpen, Pause, Play, Search, Settings, Shuffle, SkipBack, SkipForward, SlidersHorizontal, Sun, Volume2, X } from 'lucide-react';
import { Button, Card, Input, SettingPanel, ToggleRow } from '../../components/ui';
import { SplitLayout } from '../../components/layout/SplitLayout';
import { StudioPlayerTabs } from './StudioPlayerTabs';
import { defaultAccent, themeColors, type ThemeMode } from '../tokens';
import { directions, parseDirection, songs, time, type DirectionId, type PreviewSong } from './directions';

type View = 'Home' | 'Albums' | 'Settings';
const initial = new URLSearchParams(window.location.search);

function IconButton({ label, children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className={`rf-icon ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

function ReviewDialog({ title, onClose, children, drawer = false }: { title: string; onClose: () => void; children: React.ReactNode; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`rf-dialog ${drawer ? 'rf-drawer' : ''}`} onClose={event => { if (!event.currentTarget.open) onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-label={title}>
    <div className="rf-dialog-heading"><h2>{title}</h2><IconButton label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={18} /></IconButton></div>{children}
  </dialog>;
}

export function RefinementLab() {
  const [variant, setVariant] = useState<DirectionId>(() => parseDirection(initial.get('variant')));
  const [mode, setMode] = useState<ThemeMode>(() => initial.get('theme') === 'light' ? 'light' : 'dark');
  const [view, setView] = useState<View>('Home');
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState<string[]>(['study']);
  const [progress, setProgress] = useState(126);
  const [volume, setVolume] = useState(72);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [album, setAlbum] = useState<PreviewSong | null>(null);
  const [crossfade, setCrossfade] = useState(true);
  const [normalize, setNormalize] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [saved, setSaved] = useState(false);
  const [libraryName, setLibraryName] = useState('My music');
  const [queueTab, setQueueTab] = useState<'Queue' | 'Details'>('Queue');
  const [notice, setNotice] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const direction = directions.find(item => item.id === variant)!;
  const track = songs[trackIndex];

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    Object.entries(themeColors[mode]).forEach(([key, value]) => root.style.setProperty(`--theme-${key}`, value));
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ');
    root.style.setProperty('--color-primary', rgb(defaultAccent.primaryColor));
    root.style.setProperty('--color-secondary', rgb(defaultAccent.secondaryColor));
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variant);
    url.searchParams.set('theme', mode);
    window.history.replaceState(null, '', url);
  }, [variant, mode]);

  useEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [view]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const playTrack = (index: number) => { setTrackIndex(index); setProgress(0); setPlaying(true); };
  const toggleLike = (id: string) => setLiked(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  const go = (next: View) => { setView(next); setDrawer(false); };
  const results = songs.filter(song => `${song.title} ${song.album} ${song.artist}`.toLowerCase().includes(query.toLowerCase()));

  const transport = <div className="rf-transport">
    <IconButton label="Shuffle" aria-pressed={shuffle} onClick={() => setShuffle(!shuffle)}><Shuffle size={17} /></IconButton>
    <IconButton label="Previous track" onClick={() => playTrack((trackIndex + songs.length - 1) % songs.length)}><SkipBack size={19} fill="currentColor" /></IconButton>
    <Button variant="icon" size="lg" className="rf-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)} icon={playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />} />
    <IconButton label="Next track" onClick={() => playTrack((trackIndex + 1) % songs.length)}><SkipForward size={19} fill="currentColor" /></IconButton>
    <IconButton label="Like current track" aria-pressed={liked.includes(track.id)} onClick={() => toggleLike(track.id)}><Heart size={17} fill={liked.includes(track.id) ? 'currentColor' : 'none'} /></IconButton>
  </div>;

  const queueContent = <div className="rf-queue"><div className="rf-queue-label">Up next <ListMusic size={14} /></div>{[1, 2, 3].map(offset => { const index = (trackIndex + offset) % songs.length; const song = songs[index]; return <button type="button" key={song.id} className="rf-queue-row" onClick={() => playTrack(index)}><img src={song.art} alt="" /><span><strong>{song.title}</strong><small>{song.artist}</small></span><span>{time(song.seconds)}</span></button>; })}</div>;
  const detailsContent = <dl className="rf-track-details"><div><dt>Album</dt><dd>{track.album}</dd></div><div><dt>Format</dt><dd>FLAC · 24 bit</dd></div><div><dt>Sample rate</dt><dd>96 kHz</dd></div><div><dt>Playback</dt><dd>{playing ? 'Playing' : 'Paused'} · preview</dd></div></dl>;

  const player = <div className="rf-player">
    <div className="rf-player-header"><span><span className="rf-live-dot" /> Now playing</span><IconButton label="Collapse player" onClick={() => setCollapsed(true)}><PanelRightClose size={17} /></IconButton></div>
    <button type="button" className="rf-player-art" onClick={() => setAlbum(track)} aria-label={`View ${track.album}`}><img src={track.art} alt={track.album} /><span><ArrowUpRight size={20} /></span></button>
    <div className="rf-track-info"><h2>{track.title}</h2><p>{track.artist}</p><span>{track.album} <i /> 2024</span></div>
    <div className="rf-progress"><input aria-label="Track progress" type="range" min={0} max={track.seconds} value={progress} onChange={event => setProgress(Number(event.target.value))} /><div><span>{time(progress)}</span><span>{time(track.seconds)}</span></div></div>
    {transport}
    <label className="rf-volume"><Volume2 size={15} /><span className="sr-only">Volume</span><input type="range" value={volume} min="0" max="100" onChange={event => setVolume(Number(event.target.value))} /><span>{volume}%</span></label>
    {variant === 'E' ? <StudioPlayerTabs selected={queueTab} onSelect={setQueueTab} queueCount={songs.length} queue={queueContent} details={detailsContent} /> : <>
    <div className="rf-player-tabs" aria-label="Player information">{(['Queue', 'Details'] as const).map(item => <button type="button" key={item} aria-pressed={queueTab === item} onClick={() => setQueueTab(item)}>{item}{item === 'Queue' && <span>{songs.length}</span>}</button>)}</div>
    {queueTab === 'Queue' ? queueContent : detailsContent}
    </>}
    <p className="rf-audio-note">Interactive preview · no audio</p>
  </div>;

  const miniPlayer = <div className="rf-mini-player"><img src={track.art} alt="" /><div><strong>{track.title}</strong><small>{track.artist}</small></div><IconButton label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={18} /> : <Play size={18} />}</IconButton><IconButton label="Expand player" onClick={() => setCollapsed(false)}><PanelRightOpen size={18} /></IconButton></div>;

  return <div className={`rf-app rf-${variant}`} data-direction={variant}>
    <a className="rf-skip" href="#refinement-content">Skip to preview</a>
    <header className="rf-review">
      <div className="rf-review-top"><a href="/" className="rf-back"><ArrowLeft size={14} /> Design system</a><span className="rf-review-title">NEBULA <span>/</span> Refinement lab</span><div className="rf-theme"><button type="button" aria-label="Light theme" aria-pressed={mode === 'light'} onClick={() => setMode('light')}><Sun size={14} /></button><button type="button" aria-label="Dark theme" aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}><Moon size={14} /></button></div></div>
      <nav className="rf-directions" aria-label="Refinement iterations">{directions.map(item => <button type="button" key={item.id} aria-pressed={variant === item.id} onClick={() => setVariant(item.id)}><span>{item.id}</span><strong>{item.name}</strong><small>{item.character}</small></button>)}</nav>
      <div className="rf-direction-note"><p>{direction.description}</p><div><span>{direction.shape}</span><span>{direction.motion}</span></div></div>
    </header>

    <div className="rf-shell">
      <SplitLayout rightPanel={player} isPlayerVisible isCollapsed={collapsed} floatingPlayer={miniPlayer}>
        <header className="rf-topbar"><div><IconButton label="Open navigation" onClick={() => setDrawer(true)}><Menu size={19} /></IconButton><button type="button" className="rf-nebula-logo" aria-label="Go to Home" onClick={() => go('Home')}><AudioLines size={19} /></button><h1>{view}</h1></div><div className="rf-topbar-actions"><IconButton label="Search library" onClick={() => setSearch(true)}><Search size={18} /></IconButton><IconButton label="Open Settings" aria-pressed={view === 'Settings'} onClick={() => go(view === 'Settings' ? 'Home' : 'Settings')}><Settings size={18} /></IconButton>{collapsed && <IconButton label="Expand player" className="rf-expand-top" onClick={() => setCollapsed(false)}><PanelRightOpen size={18} /></IconButton>}</div></header>
        <div className="rf-content custom-scrollbar" ref={contentRef} id="refinement-content" tabIndex={-1}>
          {view !== 'Settings' ? <>
            {view === 'Home' && <Card className="rf-hero rf-surface" padding="none" hover={false}><div className="rf-hero-wash" style={{ backgroundImage: `url("${songs[0].art}")` }} /><div className="rf-hero-copy"><span className="rf-eyebrow"><span /> FROM YOUR LIBRARY</span><h2>Binary Sunset</h2><p>The Algorithms <span>·</span> A little space to get lost in.</p><div className="rf-hero-actions"><Button className="rf-button rf-primary" size="sm" icon={<Play size={15} fill="currentColor" />} onClick={() => playTrack(0)}>Play now</Button><Button className="rf-button rf-secondary" size="sm" variant="secondary" onClick={() => setAlbum(songs[0])}>View album <ChevronRight size={14} /></Button></div><div className="rf-hero-meta">FLAC <i /> 24 BIT / 96 KHZ</div></div><button className="rf-hero-art" type="button" onClick={() => setAlbum(songs[0])} aria-label="View Binary Sunset"><img src={songs[0].art} alt="Binary Sunset cover" /></button></Card>}
            <div className="rf-section-title"><div><h2>{view === 'Home' ? 'Quick picks' : 'Your albums'}</h2><p>{view === 'Home' ? 'A few favorites, ready when you are.' : 'All the records in this preview.'}</p></div><button type="button" className="rf-text-action" onClick={() => go(view === 'Home' ? 'Albums' : 'Home')}>{view === 'Home' ? 'View all' : 'Back home'} <ChevronRight size={14} /></button></div>
            <div className="rf-album-grid">{songs.map((song, index) => <Card className="rf-album-card rf-surface" key={song.id} padding="none" hover={false}><button type="button" className="rf-album-action" onClick={() => playTrack(index)} aria-label={`Play ${song.album}`}><div className="rf-album-cover"><img src={song.art} alt="" /><span className="rf-cover-play">{trackIndex === index && playing ? <AudioLines size={18} /> : <Play size={18} fill="currentColor" />}</span></div><div className="rf-album-label"><h3>{song.album}</h3><p>{song.artist}</p></div></button><IconButton className="rf-album-more" label={`Details for ${song.album}`} onClick={() => setAlbum(song)}><MoreHorizontal size={16} /></IconButton></Card>)}</div>
            <div className="rf-section-title"><div><h2>Recently played</h2><p>Pick up where you left off.</p></div><button type="button" className="rf-text-action" onClick={() => { setShuffle(!shuffle); setNotice(shuffle ? 'Shuffle off' : 'Shuffle enabled for this preview'); }}><Shuffle size={13} /> Shuffle</button></div>
            <Card className="rf-recent rf-surface" padding="none" hover={false}>{songs.slice(0, 3).map((song, index) => <div className="rf-recent-row" key={song.id}><button type="button" onClick={() => playTrack(index)} className="rf-recent-track" aria-label={`Play ${song.title}`}><span className="rf-track-number">{playing && trackIndex === index ? <AudioLines size={14} /> : `0${index + 1}`}</span><img src={song.art} alt="" /><span><strong>{song.title}</strong><small>{song.artist}</small></span><span className="rf-row-album">{song.album}</span></button><IconButton label={`Like ${song.title}`} aria-pressed={liked.includes(song.id)} onClick={() => toggleLike(song.id)}><Heart size={15} fill={liked.includes(song.id) ? 'currentColor' : 'none'} /></IconButton><time>{time(song.seconds)}</time></div>)}</Card>
          </> : <div className="rf-settings"><div className="rf-settings-heading"><span className="rf-eyebrow">MAKE YOURSELF AT HOME</span><h2>The finer details.</h2><p>A settings sample for comparing controls, text, and elevation.</p></div><div className="rf-setting-surface"><SettingPanel icon={Volume2} title="Playback" description="A smoother listening experience."><ToggleRow label="Crossfade" description="Gently blend one track into the next." checked={crossfade} onChange={value => { setCrossfade(value); setSaved(false); }} /><ToggleRow label="Normalize volume" description="Keep a consistent level between tracks." checked={normalize} onChange={value => { setNormalize(value); setSaved(false); }} /><div className="rf-quality-row"><span><strong>Streaming quality</strong><small>Original quality, as it should be.</small></span><button type="button" className="rf-quality" disabled>Lossless <Check size={13} /></button></div></SettingPanel></div><div className="rf-setting-surface"><SettingPanel icon={SlidersHorizontal} title="Library" description="Small touches that make it yours."><div className="rf-setting-field"><label htmlFor="rf-library-name">Library name</label><Input id="rf-library-name" className="rf-input" value={libraryName} onChange={event => { setLibraryName(event.target.value); setSaved(false); }} placeholder="Name your library" /></div><div className="rf-quality-row"><span><strong>Connection</strong><small>Local preview library</small></span><span className="rf-connected"><span /> Connected</span></div></SettingPanel></div><Card padding="md" hover={false} className="rf-save-card rf-surface"><div><h3>Just right?</h3><p>Save this preview’s preferences to see the confirmation state.</p></div><Button size="sm" className="rf-button rf-primary" icon={saved ? <Check size={15} /> : undefined} onClick={() => { setSaved(true); setNotice('Preview preferences saved for this session'); }}>Save changes</Button></Card><p className="rf-settings-note">Preview settings stay in this page and reset on refresh.</p></div>}
          <footer className="rf-content-footer"><AudioLines size={14} /><span>Your music. Your space.</span><span>NEBULA</span></footer>
        </div>
      </SplitLayout>
    </div>
    <div className="rf-mobile-player"><img src={track.art} alt="" /><div><strong>{track.title}</strong><small>{track.artist}</small></div><IconButton label={playing ? 'Pause mobile playback' : 'Play mobile playback'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={19} /> : <Play size={19} />}</IconButton><IconButton label="Next mobile track" onClick={() => playTrack((trackIndex + 1) % songs.length)}><SkipForward size={18} /></IconButton></div>
    {notice && <div className="rf-toast" role="status"><Check size={15} />{notice}</div>}
    {drawer && <ReviewDialog title="Nebula" drawer onClose={() => setDrawer(false)}><p className="rf-drawer-label">YOUR LIBRARY</p>{([{ title: 'Home', icon: Home }, { title: 'Albums', icon: Disc3 }, { title: 'Settings', icon: Settings }] as const).map(item => <button key={item.title} type="button" className="rf-nav-item" aria-current={view === item.title ? 'page' : undefined} onClick={() => go(item.title)}><item.icon size={18} />{item.title}<ChevronRight size={14} /></button>)}<p className="rf-drawer-note">A compact navigation sample.<br />Your listening space stays familiar.</p></ReviewDialog>}
    {search && <ReviewDialog title="Search library" onClose={() => setSearch(false)}><label className="sr-only" htmlFor="rf-search">Search tracks, albums, artists</label><Input id="rf-search" autoFocus className="rf-input" icon={<Search size={17} />} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tracks, albums, artists…" clearable onClear={() => setQuery('')} /><div className="rf-search-results">{results.length ? results.map(song => <button type="button" key={song.id} className="rf-queue-row" onClick={() => { playTrack(songs.indexOf(song)); setSearch(false); }}><img src={song.art} alt="" /><span><strong>{song.title}</strong><small>{song.artist} · {song.album}</small></span><Play size={16} /></button>) : <p className="rf-empty">No matches. Try a different artist or album.</p>}</div></ReviewDialog>}
    {album && <ReviewDialog title={album.album} onClose={() => setAlbum(null)}><div className="rf-album-detail"><img src={album.art} alt={`${album.album} cover`} /><div><span className="rf-eyebrow">ALBUM</span><h3>{album.album}</h3><p>{album.artist}</p><small>2024 · FLAC · 24 bit / 96 kHz</small><Button size="sm" className="rf-button rf-primary" icon={<Play size={15} />} onClick={() => { playTrack(songs.indexOf(album)); setAlbum(null); }}>Play album</Button></div></div><p className="rf-dialog-note">A single-track album sample for reviewing surfaces and controls.</p></ReviewDialog>}
  </div>;
}
