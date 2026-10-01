import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Heart,
  Home,
  Library,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  Radio,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from 'lucide-react';
import './styles.css';

const asset = (name: string) => new URL(`../../../design-system/studio/assets/${name}`, import.meta.url).href;

const tracks = [
  { title: 'Binary Sunset', artist: 'The Algorithms', album: 'Slow Machines', length: '4:12', art: asset('cover-binary-sunset.png'), tone: 'ember' },
  { title: 'Digital Rain', artist: 'Cyber Punkers', album: 'Glitch in the Matrix', length: '3:47', art: asset('cover-digital-rain.png'), tone: 'blue' },
  { title: 'Midnight City', artist: 'Neon Void', album: 'Nocturne', length: '5:08', art: asset('cover-midnight-city.png'), tone: 'slate' },
  { title: 'Quiet Weather', artist: 'Lo-Fi Dreams', album: 'Study Beats', length: '2:54', art: asset('cover-quiet-weather.png'), tone: 'gold' },
  { title: 'Afterimage', artist: 'The Algorithms', album: 'Slow Machines', length: '4:31', art: asset('cover-study-beats.png'), tone: 'violet' },
];

type Track = typeof tracks[number];
type Variant = 'A' | 'B' | 'C';

const variants: Array<{ key: Variant; name: string; note: string }> = [
  { key: 'A', name: 'Listening Canvas', note: 'Immersive, art-led, cinematic' },
  { key: 'B', name: 'Library Index', note: 'Editorial, precise, information-first' },
  { key: 'C', name: 'Cover Wall', note: 'Visual, direct, collection-first' },
];

function IconButton({ label, children, onClick, active = false }: { label: string; children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return <button className="icon-button" type="button" aria-label={label} aria-pressed={active} onClick={onClick}>{children}</button>;
}

function Transport({ playing, onToggle, compact = false }: { playing: boolean; onToggle: () => void; compact?: boolean }) {
  return <div className={`transport ${compact ? 'transport-compact' : ''}`}>
    <IconButton label="Shuffle"><Shuffle /></IconButton>
    <IconButton label="Previous"><SkipBack /></IconButton>
    <button className="play-button" type="button" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
    <IconButton label="Next"><SkipForward /></IconButton>
    <IconButton label="Like"><Heart /></IconButton>
  </div>;
}

function Brand({ dark = true }: { dark?: boolean }) {
  return <div className={`brand ${dark ? '' : 'brand-dark'}`}><span className="brand-mark"><i /><i /><i /><i /></span><strong>NEBULA</strong></div>;
}

function VariantA({ current, playing, choose, toggle }: PrototypeProps) {
  return <main className="concept concept-a">
    <aside className="a-rail">
      <Brand />
      <nav aria-label="Primary">
        <button className="active"><Home /><span>Home</span></button>
        <button><Search /><span>Search</span></button>
        <button><Library /><span>Library</span></button>
        <button><Radio /><span>Radio</span></button>
      </nav>
      <button className="a-profile" aria-label="Open profile">RV</button>
    </aside>
    <section className="a-stage" style={{ '--hero': `url(${current.art})` } as React.CSSProperties}>
      <div className="a-topline"><span>Good evening, Remy</span><button><Search /> Search your library <kbd>⌘ K</kbd></button></div>
      <div className="a-hero-copy">
        <span className="eyebrow">Selected for this hour</span>
        <h1>{current.title}</h1>
        <p>{current.artist} <i /> {current.album}</p>
        <div className="a-actions"><button className="primary-action" onClick={toggle}>{playing ? <Pause /> : <Play fill="currentColor" />} {playing ? 'Pause' : 'Play now'}</button><button className="quiet-action">Open album <ArrowRight /></button></div>
      </div>
      <div className="a-signal" aria-label="Playback at 36 percent"><span>01:31</span><i><b /></i><span>{current.length}</span></div>
      <div className="a-bottom">
        <div className="a-shelf-head"><span>On rotation</span><small>Based on your recent listening</small></div>
        <div className="a-shelf">{tracks.slice(1).map((track, index) => <button key={track.title} onClick={() => choose(index + 1)}><img src={track.art} alt="" /><span><strong>{track.title}</strong><small>{track.artist}</small></span><Play /></button>)}</div>
      </div>
    </section>
    <aside className="a-player">
      <div className="a-player-head"><span>Now playing</span><MoreHorizontal /></div>
      <img src={current.art} alt={`${current.title} cover`} />
      <div className="a-player-title"><span><strong>{current.title}</strong><small>{current.artist}</small></span><Heart /></div>
      <Transport playing={playing} onToggle={toggle} />
      <div className="a-volume"><Volume2 /><i><b /></i></div>
      <div className="a-up-next"><span>Up next</span>{tracks.filter(track => track.title !== current.title).slice(0, 3).map(track => <button key={track.title} onClick={() => choose(tracks.indexOf(track))}><img src={track.art} alt="" /><span><strong>{track.title}</strong><small>{track.artist}</small></span><small>{track.length}</small></button>)}</div>
    </aside>
  </main>;
}

function VariantB({ current, playing, choose, toggle }: PrototypeProps) {
  return <main className="concept concept-b">
    <header className="b-header"><Brand dark={false} /><nav><button className="active">Listen</button><button>Browse</button><button>Radio</button></nav><div><button aria-label="Search"><Search /></button><button className="b-account">RV</button></div></header>
    <section className="b-main">
      <div className="b-intro"><span className="mono">MONDAY / 14 SEPTEMBER</span><h1>Your library,<br /><em>in focus.</em></h1><p>Music you own. Recommendations that make sense. No noise between you and the next record.</p></div>
      <div className="b-feature">
        <div className="b-feature-art"><img src={current.art} alt={`${current.title} cover`} /><button onClick={toggle}>{playing ? <Pause /> : <Play fill="currentColor" />}</button></div>
        <div className="b-feature-copy"><span className="mono">RECORD OF THE DAY · 01</span><h2>{current.album}</h2><p>{current.artist}</p><small>Atmospheric electronics for late light and long roads.</small><button onClick={toggle}>{playing ? 'Pause record' : 'Play record'} <ArrowRight /></button></div>
      </div>
      <section className="b-index">
        <div className="b-index-title"><span className="mono">RECENTLY ADDED</span><h2>New to your library</h2></div>
        <div className="b-table" role="list">{tracks.map((track, index) => <button role="listitem" key={track.title} className={track.title === current.title ? 'active' : ''} onClick={() => choose(index)}><span className="mono">0{index + 1}</span><img src={track.art} alt="" /><strong>{track.title}</strong><span>{track.artist}</span><span>{track.album}</span><small>{track.length}</small><Play /></button>)}</div>
      </section>
    </section>
    <footer className="b-player">
      <div><img src={current.art} alt="" /><span><strong>{current.title}</strong><small>{current.artist}</small></span></div>
      <div className="b-player-center"><Transport playing={playing} onToggle={toggle} compact /><div className="b-progress"><span>1:31</span><i><b /></i><span>{current.length}</span></div></div>
      <div className="b-player-tools"><ListMusic /><Volume2 /><i><b /></i></div>
    </footer>
  </main>;
}

function VariantC({ current, playing, choose, toggle }: PrototypeProps) {
  return <main className="concept concept-c">
    <header className="c-header"><Brand /><div className="c-weather"><Sparkles /><span><small>LISTENING MODE</small>Late-night focus</span></div><button className="c-search"><Search /> Find anything</button><button aria-label="Audio settings"><SlidersHorizontal /></button></header>
    <section className="c-layout">
      <aside className="c-nav"><nav><button className="active"><span>01</span>Discover</button><button><span>02</span>Albums</button><button><span>03</span>Artists</button><button><span>04</span>Playlists</button></nav><p>12,482 tracks<br />across 936 albums</p></aside>
      <section className="c-wall">
        <div className="c-title"><span className="mono">MADE FOR YOUR MONDAY</span><h1>Find your<br /><em>frequency.</em></h1><div><button><ChevronLeft /></button><button><ChevronRight /></button></div></div>
        <div className="c-grid">{tracks.map((track, index) => <button key={track.title} className={`c-cover c-cover-${index} ${current.title === track.title ? 'active' : ''}`} onClick={() => choose(index)}><img src={track.art} alt="" /><span><strong>{track.title}</strong><small>{track.artist}</small></span><i>{current.title === track.title && playing ? <Pause /> : <Play fill="currentColor" />}</i></button>)}</div>
      </section>
      <aside className="c-queue">
        <div className="c-queue-art" style={{ '--queue-art': `url(${current.art})` } as React.CSSProperties}><img src={current.art} alt={`${current.title} cover`} /><span className="mono">PLAYING NOW</span></div>
        <div className="c-queue-copy"><h2>{current.title}</h2><p>{current.artist}</p><div className="c-progress"><span>1:31</span><i><b /></i><span>{current.length}</span></div><Transport playing={playing} onToggle={toggle} /></div>
        <div className="c-coming"><span className="mono">COMING UP</span>{tracks.filter(track => track.title !== current.title).slice(0, 2).map(track => <button key={track.title} onClick={() => choose(tracks.indexOf(track))}><img src={track.art} alt="" /><span><strong>{track.title}</strong><small>{track.artist}</small></span><small>{track.length}</small></button>)}</div>
      </aside>
    </section>
  </main>;
}

type PrototypeProps = {
  current: Track;
  playing: boolean;
  choose: (index: number) => void;
  toggle: () => void;
};

function Prototype() {
  const [variant, setVariant] = useState<Variant>(() => {
    const value = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
    return value === 'B' || value === 'C' ? value : 'A';
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = tracks[currentIndex];

  const go = (delta: number) => {
    const nextIndex = (variants.findIndex(item => item.key === variant) + delta + variants.length) % variants.length;
    const next = variants[nextIndex].key;
    const params = new URLSearchParams(window.location.search);
    params.set('variant', next);
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    setVariant(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const props = useMemo<PrototypeProps>(() => ({ current, playing, choose: (index) => { setCurrentIndex(index); setPlaying(true); }, toggle: () => setPlaying(value => !value) }), [current, playing]);
  const meta = variants.find(item => item.key === variant)!;

  return <div className="prototype-root" data-variant={variant}>
    {variant === 'A' && <VariantA {...props} />}
    {variant === 'B' && <VariantB {...props} />}
    {variant === 'C' && <VariantC {...props} />}
    <div className="prototype-switcher" aria-label="Prototype directions">
      <button type="button" onClick={() => go(-1)} aria-label="Previous direction"><ArrowLeft /></button>
      <div><span>{variant} / {variants.length}</span><strong>{meta.name}</strong><small>{meta.note} · {playing ? `Playing ${current.title}` : 'Paused'}</small></div>
      <button type="button" onClick={() => go(1)} aria-label="Next direction"><ArrowRight /></button>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Prototype /></React.StrictMode>);
