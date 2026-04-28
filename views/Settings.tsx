import React, { useState, useEffect } from 'react';
import { useStore } from '../context/Store';
import { useTheme } from '../context/ThemeContext';
import {
    Server, Palette, Layout, CheckCircle, AlertCircle,
    Activity, ShieldAlert, LogOut, Keyboard, Sliders, Monitor, Volume2, Sun, Moon
} from 'lucide-react';
import { VisualizerMode } from '../types';
import { EQ_PRESETS, EQ_BAND_LABELS, EQ_PRESET_LABELS } from '../constants/eqPresets';
import { CustomDropdown } from '../components/CustomDropdown';

// Helper components moved outside to prevent re-renders
const ToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div
        className="flex items-center justify-between py-4 px-6 hover:bg-neutral-200/60 dark:hover:bg-white/5 cursor-pointer transition-colors border-b border-neutral-200 dark:border-white/10"
        onClick={() => onChange(!checked)}
    >
        <div>
            <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
            {description && <p className="text-xs text-neutral-600 dark:text-white/50 mt-0.5">{description}</p>}
        </div>
        <div className={`w-12 h-7 rounded-full p-1 transition-all ${checked ? 'bg-primary' : 'bg-neutral-300 dark:bg-white/20'}`}>
            <div className={`w-5 h-5 bg-white dark:bg-white rounded-full shadow transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
    </div>
);

const ShortcutRow = ({ id, label, value, editingKey, setEditingKey }: { id: string; label: string; value: string, editingKey: string | null, setEditingKey: (k: string | null) => void }) => (
    <div className="flex items-center justify-between py-4 px-6 hover:bg-neutral-200/60 dark:hover:bg-white/5 transition-colors border-b border-neutral-200 dark:border-white/10">
        <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
        <button
            onClick={() => setEditingKey(id)}
            className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${editingKey === id
                ? 'bg-primary text-black font-bold'
                : 'bg-neutral-200 text-neutral-900 dark:bg-white/10 dark:text-white hover:bg-neutral-300 dark:hover:bg-white/20'
                }`}
        >
            {editingKey === id ? 'Press key...' : (value === ' ' ? 'SPACE' : value.toUpperCase())}
        </button>
    </div>
);

const EQSlider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div className="py-4 px-6 border-b border-neutral-200 dark:border-white/10">
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
            <span className="text-xs font-mono text-neutral-600 dark:text-white/50">{value > 0 ? `+${value}` : value} dB</span>
        </div>
        <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full h-2 bg-neutral-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
        />
    </div>
);

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div className="mb-4 bg-white/80 dark:bg-neutral-900/80 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10">
        <div className="flex items-center gap-3 py-4 px-6 bg-neutral-100 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
            <Icon className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{title}</h2>
        </div>
        <div>
            {children}
        </div>
    </div>
);

const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center justify-between py-4 px-6 border-b border-neutral-200 dark:border-white/10">
        <div>
            <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
            <p className="text-xs text-neutral-600 dark:text-white/60 font-mono mt-0.5">{value}</p>
        </div>
        <div className="relative">
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-14 h-10 rounded-lg cursor-pointer bg-transparent border-2 border-neutral-300 dark:border-white/20"
            />
        </div>
    </div>
);

const OptionRow = ({ label, description, options, value, onChange }: {
    label: string;
    description?: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void
}) => (
    <div className="py-4 px-6 border-b border-neutral-200 dark:border-white/10">
        <div className="mb-3">
            <span className="text-sm font-medium text-neutral-900 dark:text-white">{label}</span>
            {description && <p className="text-xs text-neutral-600 dark:text-white/50 mt-0.5">{description}</p>}
        </div>
        <div className="flex gap-2">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`flex-1 py-3 px-4 rounded-lg text-xs font-semibold transition-all ${value === opt.value
                        ? 'bg-primary text-black'
                        : 'bg-neutral-200 text-neutral-800 dark:bg-white/10 dark:text-white/70 hover:bg-neutral-300 dark:hover:bg-white/15 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

export const SettingsView: React.FC = () => {
    const { settings, updateSettings, connectToSubsonic, isDemoMode, credentials, visualizerMode, setVisualizerMode, disconnect } = useStore();
    const { mode, setTheme } = useTheme();

    const [url, setUrl] = useState(credentials?.serverUrl || '');
    const [user, setUser] = useState(credentials?.username || '');
    const [pass, setPass] = useState('');
    const [connStatus, setConnStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [isInsecure, setIsInsecure] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const settingsInputClass = 'w-full rounded-lg px-4 py-3 border transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 text-neutral-900 placeholder-neutral-500 bg-neutral-100 border-neutral-300 hover:bg-neutral-50 dark:bg-neutral-900 dark:border-white/10 dark:text-white dark:placeholder-white/30 dark:hover:bg-neutral-800';

    useEffect(() => {
        if (url && !url.startsWith('https://') && url.length > 7) {
            setIsInsecure(true);
        } else {
            setIsInsecure(false);
        }
    }, [url]);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnStatus('loading');
        const success = await connectToSubsonic(url, user, pass);
        setConnStatus(success ? 'success' : 'error');
    };

    useEffect(() => {
        if (!editingKey) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const newShortcuts = { ...settings.shortcuts, [editingKey]: e.key };
            updateSettings({ shortcuts: newShortcuts });
            setEditingKey(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingKey, settings, updateSettings]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-neutral-50 dark:bg-neutral-950">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-neutral-50/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-200 dark:border-white/10">
                <div className="flex items-center justify-between px-6 lg:px-10 py-5">
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Settings</h1>
                    {!isDemoMode && (
                        <button
                            onClick={disconnect}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 transition-all text-sm font-medium border border-red-500/30"
                        >
                            <LogOut className="w-4 h-4" />
                            Disconnect
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="px-6 lg:px-10 py-6 pb-32 text-neutral-900 dark:text-white">

                {/* Server Connection */}
                <Section icon={Server} title="Server Connection">
                    <form onSubmit={handleConnect}>
                        <div className="py-4 px-6 border-b border-neutral-200 dark:border-white/10">
                            <label className="block text-xs font-medium text-neutral-700 dark:text-white/60 uppercase tracking-wider mb-2">Server URL</label>
                            <input
                                type="text"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                placeholder="https://music.example.com"
                                className={`${settingsInputClass} ${isInsecure ? 'border-yellow-500/50' : 'border-neutral-300 dark:border-white/10'
                                    }`}
                            />
                            {isInsecure && (
                                <div className="flex items-center gap-1.5 mt-2 text-yellow-600 dark:text-yellow-500 text-xs">
                                    <ShieldAlert className="w-3 h-3" />
                                    <span>Warning: Not using HTTPS</span>
                                </div>
                            )}
                        </div>
                        <div className="py-4 px-6 border-b border-neutral-200 dark:border-white/10">
                            <label className="block text-xs font-medium text-neutral-700 dark:text-white/60 uppercase tracking-wider mb-2">Username</label>
                            <input
                                type="text"
                                value={user}
                                onChange={e => setUser(e.target.value)}
                                placeholder="admin"
                                className={settingsInputClass}
                            />
                        </div>
                        <div className="py-4 px-6 border-b border-neutral-200 dark:border-white/10">
                            <label className="block text-xs font-medium text-neutral-700 dark:text-white/60 uppercase tracking-wider mb-2">Password</label>
                            <input
                                type="password"
                                value={pass}
                                onChange={e => setPass(e.target.value)}
                                placeholder="••••••••"
                                className={settingsInputClass}
                            />
                        </div>
                        <div className="py-4 px-6">
                            <button
                                disabled={connStatus === 'loading'}
                                className="w-full bg-white text-black font-bold py-3.5 rounded-lg hover:bg-primary hover:text-white transition-all text-sm"
                            >
                                {connStatus === 'loading' ? 'Connecting...' : 'Save & Connect'}
                            </button>
                            {connStatus === 'success' && (
                                <div className="flex items-center justify-center gap-2 text-green-400 text-sm mt-3">
                                    <CheckCircle className="w-4 h-4" />
                                    Connected successfully
                                </div>
                            )}
                            {connStatus === 'error' && (
                                <div className="flex items-center justify-center gap-2 text-red-400 text-sm mt-3">
                                    <AlertCircle className="w-4 h-4" />
                                    Connection failed
                                </div>
                            )}
                            {isDemoMode && connStatus === 'idle' && (
                                <p className="text-xs text-neutral-600 dark:text-white/60 text-center mt-3">Currently in Demo Mode</p>
                            )}
                        </div>
                    </form>
                </Section>

                {/* Theme Colors */}
                <Section icon={Palette} title="Theme Colors">
                    <ColorRow
                        label="Primary Color"
                        value={settings.theme.primaryColor}
                        onChange={(v) => updateSettings({ theme: { ...settings.theme, primaryColor: v } })}
                    />
                    <ColorRow
                        label="Secondary Color"
                        value={settings.theme.secondaryColor}
                        onChange={(v) => updateSettings({ theme: { ...settings.theme, secondaryColor: v } })}
                    />
                    <ColorRow
                        label="Background Tint"
                        value={settings.theme.backgroundColor}
                        onChange={(v) => updateSettings({ theme: { ...settings.theme, backgroundColor: v } })}
                    />
                </Section>

                {/* Appearance Mode */}
                <Section icon={Layout} title="Appearance">
                    <OptionRow
                        label="Theme Mode"
                        description="Switch between light and dark modes"
                        options={[
                            { value: 'dark', label: '🌙 Dark' },
                            { value: 'light', label: '☀️ Light' },
                        ]}
                        value={mode}
                        onChange={(v) => setTheme(v as 'light' | 'dark')}
                    />
                </Section>

                {/* Player Settings */}
                <Section icon={Monitor} title="Player Display">
                    <OptionRow
                        label="Mini Player Style"
                        description="Choose how the mini player appears when music is playing"
                        options={[
                            { value: 'sidebar', label: 'Sidebar Panel' },
                            { value: 'floating', label: 'Floating Bar' },
                        ]}
                        value={settings.miniPlayerMode}
                        onChange={(v) => updateSettings({ miniPlayerMode: v as 'floating' | 'sidebar' })}
                    />
                    <div
                        className="flex items-center justify-between py-4 px-6 hover:bg-neutral-200/60 dark:hover:bg-white/5 cursor-pointer transition-colors border-b border-neutral-200 dark:border-white/10"
                        onClick={() => updateSettings({ magicCrossfade: !settings.magicCrossfade })}
                    >
                        <div>
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">Magic Crossfade</span>
                            <p className="text-xs text-neutral-600 dark:text-white/50 mt-0.5">Detects track endings and fades into the next song</p>
                        </div>
                        <div className={`w-12 h-7 rounded-full p-1 transition-all ${settings.magicCrossfade ? 'bg-primary' : 'bg-neutral-300 dark:bg-white/20'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${settings.magicCrossfade ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </Section>

                {/* Enhanced Equalizer */}
                <Section icon={Sliders} title="Equalizer">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-8">
                            <ToggleRow
                                label="Enable Equalizer"
                                checked={settings.eq.enabled}
                                onChange={(v) => updateSettings({ eq: { ...settings.eq, enabled: v } })}
                            />

                            {/* Preset Selector */}
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium text-neutral-700 dark:text-white/60 uppercase tracking-wider">Preset</span>
                                <div className="w-48">
                                    <CustomDropdown
                                        value={settings.eq.preset}
                                        onChange={(newPreset) => {
                                            const typedPreset = newPreset as typeof settings.eq.preset;
                                            const newBands = newPreset === 'custom' ? settings.eq.bands : { ...EQ_PRESETS[newPreset] };
                                            updateSettings({
                                                eq: {
                                                    ...settings.eq,
                                                    preset: typedPreset,
                                                    bands: { ...settings.eq.bands, ...newBands }
                                                }
                                            });
                                        }}
                                        options={Object.entries(EQ_PRESET_LABELS).map(([key, label]) => ({
                                            value: key,
                                            label,
                                        }))}
                                        disabled={!settings.eq.enabled}
                                        className="text-xs font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Mixing Board Style EQ */}
                        <div className={`transition-all duration-500 ${settings.eq.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                            <div className="relative bg-neutral-100 dark:bg-black/20 rounded-xl p-6 border border-neutral-200 dark:border-white/5 shadow-inner">
                                {/* Grid Background */}
                                <div className="absolute inset-0 opacity-10"
                                    style={{ backgroundImage: 'linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                                />

                                <div className="flex items-end justify-between gap-2 relative z-10 h-64">
                                    {/* Center Line */}
                                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-neutral-300 dark:bg-white/10 -z-10" />

                                    {Object.entries(EQ_BAND_LABELS).map(([freq, label]) => {
                                        const val = settings.eq.bands[freq as keyof typeof settings.eq.bands] || 0;
                                        const percent = ((val + 12) / 24) * 100;

                                        return (
                                            <div key={freq} className="flex-1 flex flex-col items-center group relative h-full">
                                                {/* Fader Track */}
                                                <div className="relative w-full h-full flex justify-center pb-8 pt-2">
                                                    {/* Slot */}
                                                    <div className="absolute top-2 bottom-8 w-2 bg-black/20 dark:bg-black/50 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] border border-neutral-300 dark:border-white/5">
                                                        {/* Center Notch */}
                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-0.5 bg-neutral-400 dark:bg-white/20" />
                                                    </div>

                                                    {/* Active Fill (Neon Glow) */}
                                                    <div
                                                        className={`absolute w-1 rounded-full text-primary transition-all duration-200 pointer-events-none ${val === 0 ? 'opacity-0' : 'opacity-100 shadow-[0_0_8px_currentColor]'}`}
                                                        style={{
                                                            height: `${Math.abs(val) / 24 * 100}%`,
                                                            top: val > 0 ? 'auto' : '50%',
                                                            bottom: val > 0 ? '50%' : 'auto',
                                                            backgroundColor: 'currentColor'
                                                        }}
                                                    />

                                                    {/* Hidden Range Input - Rotated -90deg for stable vertical behavior */}
                                                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                                        <input
                                                            type="range"
                                                            min="-12"
                                                            max="12"
                                                            step="1"
                                                            value={val}
                                                            onChange={(e) => {
                                                                const newVal = parseInt(e.target.value);
                                                                updateSettings({
                                                                    eq: {
                                                                        ...settings.eq,
                                                                        preset: 'custom',
                                                                        bands: { ...settings.eq.bands, [freq]: newVal }
                                                                    }
                                                                });
                                                            }}
                                                            className="w-[220px] h-10 opacity-0 cursor-pointer pointer-events-auto appearance-none bg-transparent"
                                                            style={{
                                                                transform: 'rotate(-90deg)',
                                                                height: '40px' // Touch target width when rotated
                                                            }}
                                                            title={`${label}: ${val > 0 ? '+' : ''}${val}dB`}
                                                        />
                                                    </div>

                                                    {/* Realistic Fader Handle (Thumb) */}
                                                    <div
                                                        className="absolute w-8 h-12 pointer-events-none transition-all duration-75 z-10 flex items-center justify-center"
                                                        style={{ bottom: `calc(${percent}% - 24px + 10px)` }} // Adjust for track padding
                                                    >
                                                        {/* Physical Cap */}
                                                        <div className={`w-8 h-12 rounded bg-gradient-to-b from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 shadow-[0_4px_6px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-neutral-300 dark:border-black group-hover:from-neutral-300 group-hover:to-neutral-400 dark:group-hover:from-neutral-600 dark:group-hover:to-neutral-700 relative flex flex-col items-center justify-center gap-1`}>
                                                            {/* Grip Lines */}
                                                            <div className="w-6 h-0.5 bg-black/20 dark:bg-black/30 shadow-[0_1px_0_rgba(255,255,255,0.1)]" />
                                                            <div className="w-6 h-0.5 bg-black/20 dark:bg-black/30 shadow-[0_1px_0_rgba(255,255,255,0.1)]" />
                                                            <div className="w-6 h-0.5 bg-black/20 dark:bg-black/30 shadow-[0_1px_0_rgba(255,255,255,0.1)]" />

                                                            {/* Indicator Colored Line */}
                                                            <div className="w-full h-0.5 bg-primary shadow-[0_0_5px_rgba(var(--primary-rgb),0.8)] mt-1" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Label */}
                                                <div className="absolute bottom-0 text-[10px] font-bold text-neutral-600 dark:text-white/60 uppercase tracking-widest text-center w-full truncate group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                                                    {label}
                                                </div>

                                                {/* Value Floating Bubble */}
                                                <div className="absolute -top-6 bg-primary text-black text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 pointer-events-none">
                                                    {val > 0 ? '+' : ''}{val}dB
                                                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rotate-45" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Visualizer */}
                <Section icon={Activity} title="Visualizer Style">
                    <div className="py-4 px-6">
                        <div className="grid grid-cols-3 gap-2">
                            {(['BARS', 'WAVE', 'CIRCLE', 'MIRROR', 'SPECTRUM', 'PARTICLES', 'HEXAGON', 'CUBE', 'GRID'] as VisualizerMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setVisualizerMode(mode)}
                                    className={`py-3 px-4 rounded-lg text-xs font-semibold transition-all ${visualizerMode === mode
                                        ? 'bg-primary text-black'
                                        : 'bg-neutral-200 text-neutral-800 dark:bg-white/10 dark:text-white/60 hover:bg-neutral-300 dark:hover:bg-white/15 hover:text-neutral-900 dark:hover:text-white'
                                        }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </Section>

                {/* Navigation */}
                <Section icon={Layout} title="Navigation Items">
                    <ToggleRow
                        label="Show Home"
                        checked={settings.sidebar.showHome}
                        onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showHome: v } })}
                    />
                    <ToggleRow
                        label="Show Browse"
                        checked={settings.sidebar.showBrowse}
                        onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showBrowse: v } })}
                    />
                    <ToggleRow
                        label="Show Internet Radio"
                        checked={settings.sidebar.showRadio}
                        onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showRadio: v } })}
                    />
                    <ToggleRow
                        label="Show Artists"
                        checked={settings.sidebar.showArtists}
                        onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showArtists: v } })}
                    />
                    <ToggleRow
                        label="Show Albums"
                        checked={settings.sidebar.showAlbums}
                        onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showAlbums: v } })}
                    />
                    <ToggleRow
                        label="Show Songs"
                        checked={settings.sidebar.showSongs}
                        onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showSongs: v } })}
                    />
                    <ToggleRow
                        label="Show Playlists"
                        checked={settings.sidebar.showPlaylists}
                        onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showPlaylists: v } })}
                    />
                </Section>

                {/* Keyboard Shortcuts */}
                <Section icon={Keyboard} title="Keyboard Shortcuts">
                    <ShortcutRow id="playPause" label="Play / Pause" value={settings.shortcuts.playPause} editingKey={editingKey} setEditingKey={setEditingKey} />
                    <ShortcutRow id="prev" label="Previous Song" value={settings.shortcuts.prev} editingKey={editingKey} setEditingKey={setEditingKey} />
                    <ShortcutRow id="next" label="Next Song" value={settings.shortcuts.next} editingKey={editingKey} setEditingKey={setEditingKey} />
                    <ShortcutRow id="loop" label="Toggle Loop" value={settings.shortcuts.loop} editingKey={editingKey} setEditingKey={setEditingKey} />
                    <ShortcutRow id="zen" label="Toggle Zen Mode" value={settings.shortcuts.zen} editingKey={editingKey} setEditingKey={setEditingKey} />
                    <ShortcutRow id="visualizer" label="Cycle Visualizer" value={settings.shortcuts.visualizer} editingKey={editingKey} setEditingKey={setEditingKey} />
                </Section>
            </div>
        </div>
    );
};

