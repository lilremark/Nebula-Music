/**
 * PROTOTYPE ONLY — five redesign concepts for Nebula Music, switchable with
 * `?designPrototype=1&variant=A` on the existing app entry point.
 *
 * The concepts preserve the product's information and control model while
 * deliberately disagreeing about hierarchy, density, navigation, and mood.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Album,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  ChevronRight,
  Clock3,
  Disc3,
  Grid3X3,
  Headphones,
  Heart,
  Home,
  Library,
  ListMusic,
  Menu,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat2,
  Search,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from 'lucide-react';
import './NebulaDesignPrototype.css';

type VariantKey = 'A' | 'B' | 'C' | 'D' | 'E';
type Song = {
  title: string;
  artist: string;
  album: string;
  duration: string;
  art: string;
  accent: string;
};

const coverArt = (background: string, accent: string, title: string, motif: string) => {
  const shapes = motif === 'steps'
    ? `<path d="M90 560H220V430H350V315H480V190H640" fill="none" stroke="${accent}" stroke-width="54"/>`
    : motif === 'orbit'
      ? `<circle cx="360" cy="360" r="205" fill="none" stroke="${accent}" stroke-width="28"/><circle cx="360" cy="360" r="72" fill="${accent}"/>`
      : motif === 'matrix'
        ? Array.from({ length: 12 }, (_, i) => `<path d="M${70 + i * 52} 80V640" stroke="${accent}" stroke-width="${i % 3 === 0 ? 16 : 5}" opacity="${.25 + (i % 4) * .18}"/>`).join('')
        : motif === 'road'
          ? `<path d="M110 630L320 95H400L610 630" fill="none" stroke="${accent}" stroke-width="28"/><path d="M360 120V650" stroke="${accent}" stroke-width="8" stroke-dasharray="38 28"/>`
          : motif === 'rain'
            ? Array.from({ length: 13 }, (_, i) => `<path d="M${40 + i * 55} ${40 + (i % 3) * 40}l-95 360" stroke="${accent}" stroke-width="${i % 2 ? 8 : 18}" opacity="${.28 + (i % 4) * .15}"/>`).join('')
            : `<circle cx="360" cy="270" r="165" fill="${accent}"/><path d="M85 650L360 350L635 650" fill="${background}" stroke="${accent}" stroke-width="18"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720"><rect width="720" height="720" fill="${background}"/>${shapes}<text x="48" y="665" fill="${accent}" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="2">${title.toUpperCase()}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const SONGS: Song[] = [
  { title: 'Sorting Array', artist: 'The Algorithms', album: 'Binary Sunset', duration: '7:00', art: coverArt('#17191c', '#f7c56b', 'Binary Sunset', 'steps'), accent: '#f7c56b' },
  { title: 'Coffee Shop Noise', artist: 'Lo-Fi Dreams', album: 'Study Beats', duration: '3:00', art: coverArt('#502e2f', '#f1c0a8', 'Study Beats', 'orbit'), accent: '#e28b65' },
  { title: 'Glitch in the Matrix', artist: 'Cyber Punkers', album: 'Digital Rain', duration: '5:05', art: coverArt('#102b2c', '#8ed8d0', 'Digital Rain', 'matrix'), accent: '#8ed8d0' },
  { title: 'Neon Highway', artist: 'Neon Void', album: 'Midnight City', duration: '4:05', art: coverArt('#292446', '#f19172', 'Midnight City', 'road'), accent: '#a7b3ff' },
  { title: 'Rainy Window', artist: 'Lo-Fi Dreams', album: 'Study Beats', duration: '2:30', art: coverArt('#27343c', '#b4d176', 'Rainy Window', 'rain'), accent: '#b4d176' },
  { title: 'Nightcall', artist: 'Retro Wave', album: 'Drive OST', duration: '4:10', art: coverArt('#261628', '#ed719e', 'Nightcall', 'moon'), accent: '#ed719e' },
];

const VARIANTS: Array<{ key: VariantKey; name: string; note: string }> = [
  { key: 'A', name: 'Sleeve Index', note: 'A record-catalog interface with strict sequencing and generous black space.' },
  { key: 'B', name: 'Listening Room', note: 'Album art becomes the room: quiet, cinematic, and focused on one decision.' },
  { key: 'C', name: 'Signal Desk', note: 'A tactile studio console for listeners who want dense, legible control.' },
  { key: 'D', name: 'Liner Notes', note: 'A cool-paper journal that turns discovery into an annotated weekly edition.' },
  { key: 'E', name: 'Patch Bay', note: 'A modular music map where artists, moods, and the queue connect visibly.' },
];

const formatVariant = (value: string | null): VariantKey => {
  const key = value?.toUpperCase();
  return VARIANTS.some((item) => item.key === key) ? key as VariantKey : 'A';
};

const WaveBars: React.FC<{ count?: number }> = ({ count = 28 }) => (
  <span className="np-wave-bars" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <i key={index} style={{ '--bar': `${18 + ((index * 17) % 74)}%`, '--delay': `${(index % 7) * -80}ms` } as React.CSSProperties} />
    ))}
  </span>
);

const PlaybackControls: React.FC<{
  playing: boolean;
  liked: boolean;
  onToggle: () => void;
  onLike: () => void;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}> = ({ playing, liked, onToggle, onLike, onPrevious, onNext, className = '' }) => (
  <div className={`np-playback-controls ${className}`}>
    <button type="button" aria-label="Shuffle"><Shuffle /></button>
    <button type="button" aria-label="Previous track" onClick={onPrevious}><SkipBack /></button>
    <button type="button" className="np-primary-play" aria-label={playing ? 'Pause' : 'Play'} onClick={onToggle}>
      {playing ? <Pause /> : <Play />}
    </button>
    <button type="button" aria-label="Next track" onClick={onNext}><SkipForward /></button>
    <button type="button" aria-label={liked ? 'Remove from liked songs' : 'Like song'} aria-pressed={liked} onClick={onLike}>
      <Heart className={liked ? 'is-filled' : ''} />
    </button>
  </div>
);

const Art: React.FC<{ song: Song; className?: string }> = ({ song, className = '' }) => (
  <img className={className} src={song.art} alt={`${song.album} cover`} />
);

const ConceptA: React.FC<ConceptProps> = ({ song, songIndex, playing, liked, actions }) => (
  <section className="np-concept np-concept-a">
    <header className="np-a-header">
      <button className="np-a-wordmark" type="button" onClick={() => actions.setNav('Home')}>NEBULA®</button>
      <nav aria-label="Primary">
        {['Index', 'Playlists', 'Radio'].map((item) => <button type="button" key={item} onClick={() => actions.setNav(item)}>{item}</button>)}
      </nav>
      <button type="button" aria-label="Search"><Search /></button>
    </header>
    <main className="np-a-main">
      <aside className="np-a-index" aria-label="Album index">
        <div className="np-a-index-heading"><span>FAC / NB</span><span>2026</span></div>
        {SONGS.map((item, index) => (
          <button type="button" className={index === songIndex ? 'is-active' : ''} key={item.title} onClick={() => actions.selectSong(index)}>
            <span>NB-{String(index + 1).padStart(3, '0')}</span>
            <strong>{item.album}</strong>
            <i style={{ backgroundColor: item.accent }} />
          </button>
        ))}
        <p>Your library, catalogued without the noise.</p>
      </aside>
      <div className="np-a-feature">
        <div className="np-a-plot"><WaveBars count={38} /><span className="np-a-orbit" /></div>
        <div className="np-a-copy">
          <span>NB-{String(songIndex + 1).padStart(3, '0')} / NOW</span>
          <h1>{song.title}</h1>
          <p>{song.artist} · {song.album}</p>
        </div>
        <Art song={song} className="np-a-art" />
        <div className="np-a-mobile-player">
          <PlaybackControls {...actions} playing={playing} liked={liked} />
          <div><span>2:14</span><i><b /></i><span>{song.duration}</span></div>
        </div>
      </div>
      <aside className="np-a-player">
        <div><span>PLAYING</span><span>{songIndex + 1} / {SONGS.length}</span></div>
        <div className="np-a-time"><b>2:14</b><span><i /></span><b>{song.duration}</b></div>
        <PlaybackControls {...actions} playing={playing} liked={liked} />
        <div className="np-a-meta"><span>LOSSLESS</span><span>44.1 KHZ</span><span>STEREO</span></div>
      </aside>
    </main>
  </section>
);

const ConceptB: React.FC<ConceptProps> = ({ song, songIndex, playing, liked, actions }) => (
  <section className="np-concept np-concept-b" style={{ '--room-accent': song.accent, '--room-image': `url(${song.art})` } as React.CSSProperties}>
    <div className="np-b-atmosphere" />
    <header className="np-b-header">
      <button type="button" className="np-b-brand" onClick={() => actions.setNav('Home')}><AudioLines /> Nebula</button>
      <nav aria-label="Primary">
        {['Home', 'Discover', 'Library', 'Radio'].map((item) => <button type="button" key={item} onClick={() => actions.setNav(item)}>{item}</button>)}
      </nav>
      <div><button type="button" aria-label="Search"><Search /></button><button type="button" aria-label="Settings"><Settings /></button></div>
    </header>
    <main className="np-b-main">
      <button type="button" className="np-b-previous" onClick={actions.onPrevious}><ArrowLeft /><span>{SONGS[(songIndex - 1 + SONGS.length) % SONGS.length].title}</span></button>
      <div className="np-b-stage">
        <div className="np-b-art-wrap">
          <Art song={song} />
          <span className={playing ? 'is-playing' : ''}><Disc3 /></span>
        </div>
        <div className="np-b-copy">
          <h1>{song.title}</h1>
          <p>{song.artist}</p>
          <button type="button" onClick={() => actions.setNav('Album')}>{song.album}<ChevronRight /></button>
        </div>
        <PlaybackControls {...actions} playing={playing} liked={liked} />
        <div className="np-b-progress">
          <span>2:14</span><input aria-label="Track position" type="range" min="0" max="100" defaultValue="38" /><span>{song.duration}</span>
        </div>
      </div>
      <button type="button" className="np-b-next" onClick={actions.onNext}><span>{SONGS[(songIndex + 1) % SONGS.length].title}</span><ArrowRight /></button>
    </main>
    <footer className="np-b-footer"><span>Up next · {SONGS[(songIndex + 1) % SONGS.length].artist}</span><WaveBars count={20} /><span>Volume 72</span></footer>
  </section>
);

const ConceptC: React.FC<ConceptProps> = ({ song, songIndex, playing, liked, actions, activeNav }) => (
  <section className="np-concept np-concept-c">
    <aside className="np-c-sidebar">
      <button type="button" className="np-c-brand" onClick={() => actions.setNav('Home')}><AudioLines />NB</button>
      <nav aria-label="Primary">
        {[['Home', Home], ['Discover', Sparkles], ['Library', Library], ['Radio', Radio], ['Playlists', ListMusic]].map(([label, Icon]) => {
          const NavIcon = Icon as React.ComponentType;
          return <button type="button" key={label as string} className={activeNav === label ? 'is-active' : ''} onClick={() => actions.setNav(label as string)}><NavIcon /><span>{label as string}</span></button>;
        })}
      </nav>
      <button type="button" className="np-c-settings" onClick={() => actions.setNav('Settings')}><Settings /><span>Settings</span></button>
    </aside>
    <main className="np-c-main">
      <header className="np-c-header">
        <div><h1>Signal desk</h1><span>Good evening · 42 albums indexed</span></div>
        <label><Search /><input aria-label="Search library" placeholder="Search the archive" /></label>
      </header>
      <section className="np-c-deck">
        <div className="np-c-now">
          <Art song={song} />
          <div><span>CHANNEL A · PLAYING</span><h2>{song.title}</h2><p>{song.artist} / {song.album}</p></div>
        </div>
        <div className="np-c-meter"><span>L</span>{Array.from({ length: 18 }, (_, i) => <i key={i} className={i < 13 ? 'is-on' : ''} />)}<span>R</span></div>
        <PlaybackControls {...actions} playing={playing} liked={liked} />
        <div className="np-c-knobs">
          <label><span>BASS</span><input aria-label="Bass" type="range" min="0" max="100" defaultValue="54" /></label>
          <label><span>SPACE</span><input aria-label="Space" type="range" min="0" max="100" defaultValue="31" /></label>
          <label><span>VOLUME</span><input aria-label="Volume" type="range" min="0" max="100" defaultValue="72" /></label>
        </div>
      </section>
      <section className="np-c-browser">
        <div className="np-c-browser-head"><h2>Quick channels</h2><button type="button"><SlidersHorizontal />Filter</button></div>
        <div className="np-c-song-table">
          {SONGS.map((item, index) => (
            <button type="button" key={item.title} className={songIndex === index ? 'is-active' : ''} onClick={() => actions.selectSong(index)}>
              <span>{String(index + 1).padStart(2, '0')}</span><Art song={item} /><strong>{item.title}<small>{item.artist}</small></strong><WaveBars count={14} /><span>{item.album}</span><time>{item.duration}</time><MoreHorizontal />
            </button>
          ))}
        </div>
      </section>
    </main>
  </section>
);

const ConceptD: React.FC<ConceptProps> = ({ song, songIndex, playing, liked, actions }) => (
  <section className="np-concept np-concept-d">
    <header className="np-d-header">
      <button type="button" className="np-d-brand" onClick={() => actions.setNav('Home')}>Nebula <i>Journal</i></button>
      <p>Issue 36 · Tuesday listening</p>
      <nav aria-label="Primary">{['Discover', 'Library', 'Playlists'].map((item) => <button type="button" key={item} onClick={() => actions.setNav(item)}>{item}</button>)}</nav>
      <button type="button" aria-label="Search"><Search /></button>
    </header>
    <main className="np-d-main">
      <article className="np-d-lead">
        <div className="np-d-title"><h1>{song.title}</h1><p>Selected for a slower evening: {song.artist} folds patient rhythm into {song.album}, a record that rewards the second listen.</p><button type="button" onClick={actions.onToggle}>{playing ? <Pause /> : <Play />} {playing ? 'Pause' : 'Play the selection'}</button></div>
        <div className="np-d-image"><Art song={song} /><span>{song.album}<i>{song.artist}</i></span></div>
        <aside><blockquote>“The detail arrives quietly, then stays in the room.”</blockquote><div><span>Duration</span><strong>{song.duration}</strong></div><div><span>Format</span><strong>Lossless</strong></div></aside>
      </article>
      <section className="np-d-edition">
        <div className="np-d-section-title"><h2>This week’s listening</h2><span>Six records, sequenced by mood</span></div>
        <div className="np-d-grid">
          {SONGS.map((item, index) => (
            <button type="button" key={item.title} className={index === songIndex ? 'is-active' : ''} onClick={() => actions.selectSong(index)}>
              <span>{String(index + 1).padStart(2, '0')}</span><Art song={item} /><strong>{item.title}<small>{item.artist}</small></strong><time>{item.duration}</time>
            </button>
          ))}
        </div>
      </section>
    </main>
    <footer className="np-d-player">
      <Art song={song} /><div><strong>{song.title}</strong><span>{song.artist}</span></div><PlaybackControls {...actions} playing={playing} liked={liked} /><span className="np-d-line"><i /></span><button type="button" aria-label="Queue"><ListMusic /></button>
    </footer>
  </section>
);

const ConceptE: React.FC<ConceptProps> = ({ song, songIndex, playing, liked, actions, activeNav }) => {
  const nodes = [
    { label: 'Focus', icon: Headphones, x: '8%', y: '12%', color: '#d8ff62' },
    { label: song.artist, icon: Music2, x: '37%', y: '7%', color: '#f0a6ff' },
    { label: 'Night drive', icon: Disc3, x: '69%', y: '14%', color: '#ff9b65' },
    { label: 'Discovery', icon: Sparkles, x: '16%', y: '60%', color: '#78d8ff' },
    { label: song.album, icon: Album, x: '59%', y: '63%', color: '#ffd95a' },
  ];

  return (
    <section className="np-concept np-concept-e">
      <header className="np-e-header">
        <button type="button" className="np-e-brand" onClick={() => actions.setNav('Home')}><AudioLines />NEBULA</button>
        <nav aria-label="Primary">
          {['Home', 'Map', 'Library', 'Radio'].map((item) => <button type="button" className={activeNav === item ? 'is-active' : ''} key={item} onClick={() => actions.setNav(item)}>{item}</button>)}
        </nav>
        <label><Search /><input aria-label="Search" placeholder="Find a signal" /></label>
        <button type="button" aria-label="Open profile" className="np-e-avatar">R</button>
      </header>
      <main className="np-e-main">
        <section className="np-e-map">
          <div className="np-e-map-title"><div><h1>Find your next frequency.</h1><p>Move through the library by connection, not category.</p></div><button type="button"><Grid3X3 />Re-seed map</button></div>
          <svg className="np-e-cables" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">
            <path d="M120,135 C260,120 280,105 430,105" /><path d="M480,130 C620,90 720,130 810,150" /><path d="M160,175 C160,320 220,400 260,460" /><path d="M450,150 C470,310 600,380 700,470" /><path d="M300,480 C460,520 560,500 690,480" />
          </svg>
          {nodes.map(({ label, icon: Icon, x, y, color }, index) => (
            <button type="button" key={label} className={`np-e-node np-e-node-${index}`} style={{ left: x, top: y, '--node': color } as React.CSSProperties} onClick={() => actions.selectSong(index % SONGS.length)}>
              <span><Icon /></span><strong>{label}</strong><small>{index === 1 ? 'Artist · 24 tracks' : index === 4 ? 'Album · 12 tracks' : 'Mood collection'}</small><i />
            </button>
          ))}
          <div className="np-e-active-node" style={{ '--active-art': `url(${song.art})`, '--node': song.accent } as React.CSSProperties}>
            <Art song={song} /><div><span>ACTIVE SIGNAL</span><h2>{song.title}</h2><p>{song.artist}</p></div><button type="button" onClick={actions.onToggle}>{playing ? <Pause /> : <Play />}</button>
          </div>
        </section>
        <aside className="np-e-queue">
          <div className="np-e-queue-head"><div><span>QUEUE</span><strong>Signal path</strong></div><button type="button" aria-label="Add to queue"><Plus /></button></div>
          {SONGS.slice(0, 4).map((item, index) => (
            <button type="button" key={item.title} className={songIndex === index ? 'is-active' : ''} onClick={() => actions.selectSong(index)}><Art song={item} /><strong>{item.title}<small>{item.artist}</small></strong><time>{item.duration}</time></button>
          ))}
          <div className="np-e-volume"><Volume2 /><input aria-label="Volume" type="range" min="0" max="100" defaultValue="72" /><span>72</span></div>
        </aside>
      </main>
      <footer className="np-e-player">
        <div><Art song={song} /><strong>{song.title}<small>{song.artist}</small></strong></div>
        <PlaybackControls {...actions} playing={playing} liked={liked} />
        <div className="np-e-progress"><span>2:14</span><span><i /></span><span>{song.duration}</span></div>
        <button type="button"><ListMusic />Queue</button>
      </footer>
    </section>
  );
};

type Actions = {
  onToggle: () => void;
  onLike: () => void;
  onPrevious: () => void;
  onNext: () => void;
  selectSong: (index: number) => void;
  setNav: (nav: string) => void;
};

type ConceptProps = {
  song: Song;
  songIndex: number;
  playing: boolean;
  liked: boolean;
  activeNav: string;
  actions: Actions;
};

export const NebulaDesignPrototype: React.FC = () => {
  const [variant, setVariant] = useState<VariantKey>(() => formatVariant(new URLSearchParams(window.location.search).get('variant')));
  const [songIndex, setSongIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [liked, setLiked] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');

  const cycleVariant = (direction: -1 | 1) => {
    const current = VARIANTS.findIndex((item) => item.key === variant);
    const next = VARIANTS[(current + direction + VARIANTS.length) % VARIANTS.length].key;
    const params = new URLSearchParams(window.location.search);
    params.set('designPrototype', '1');
    params.set('variant', next);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setVariant(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') cycleVariant(-1);
      if (event.key === 'ArrowRight') cycleVariant(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [variant]);

  const actions = useMemo<Actions>(() => ({
    onToggle: () => setPlaying((value) => !value),
    onLike: () => setLiked((value) => !value),
    onPrevious: () => setSongIndex((value) => (value - 1 + SONGS.length) % SONGS.length),
    onNext: () => setSongIndex((value) => (value + 1) % SONGS.length),
    selectSong: (index) => { setSongIndex(index); setPlaying(true); },
    setNav: setActiveNav,
  }), []);

  const props: ConceptProps = { song: SONGS[songIndex], songIndex, playing, liked, activeNav, actions };
  const currentMeta = VARIANTS.find((item) => item.key === variant) ?? VARIANTS[0];

  return (
    <div className="np-prototype-root">
      {variant === 'A' && <ConceptA {...props} />}
      {variant === 'B' && <ConceptB {...props} />}
      {variant === 'C' && <ConceptC {...props} />}
      {variant === 'D' && <ConceptD {...props} />}
      {variant === 'E' && <ConceptE {...props} />}

      <aside className="np-prototype-switcher" aria-label="Design concept switcher">
        <button type="button" aria-label="Previous concept" onClick={() => cycleVariant(-1)}><ArrowLeft /></button>
        <div><span>{variant} / {VARIANTS.length}</span><strong>{currentMeta.name}</strong><small>{currentMeta.note}</small></div>
        <button type="button" aria-label="Next concept" onClick={() => cycleVariant(1)}><ArrowRight /></button>
      </aside>
    </div>
  );
};
