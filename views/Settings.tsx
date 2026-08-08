import React, { useState, useEffect } from 'react';
import {
    Activity, AlertCircle, Cable, CheckCircle, Download, Headphones, Keyboard, Layout, Loader2, LogOut, Monitor,
    Moon, Palette, RefreshCw, Search, Server, ShieldAlert, Sliders, Sun, Unplug, X
} from 'lucide-react';
import { useStore } from '../context/Store';
import { useTheme } from '../context/ThemeContext';
import { usePlatform } from '../platform/PlatformContext';
import type { UpdaterState } from '../electron/updater';
import { VISUALIZER_MODES } from '../types';
import { EQ_PRESETS, EQ_BAND_LABELS, EQ_PRESET_LABELS } from '../constants/eqPresets';
import { CustomDropdown } from '../components/CustomDropdown';
import {
    AutoEqIndexEntry,
    fetchAutoEqIndex,
    fetchAutoEqProfile,
    getCachedAutoEqIndexInfo,
    searchAutoEqProfiles,
} from '../services/autoEqService';
import { useStreamDeckBridge } from '../context/StreamDeckBridgeContext';
import { STREAM_DECK_DEFAULT_PORT } from '../services/streamDeckProtocol';

const rowClass = 'flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-neutral-100 dark:hover:bg-white/5';
const inputClass = 'w-full rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-500 transition-all hover:bg-neutral-50 focus:border-primary/60 focus:outline-hidden focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-neutral-950/70 dark:text-white dark:placeholder-white/30 dark:hover:bg-neutral-900';

const SettingPanel = ({
    icon: Icon,
    title,
    description,
    children,
    className = '',
}: {
    icon: React.ElementType;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}) => (
    <section className={`grid overflow-hidden rounded-lg border border-neutral-200 bg-white/70 shadow-xs dark:border-white/10 dark:bg-neutral-900/50 lg:grid-cols-[260px_minmax(0,1fr)] ${className}`}>
        <div className="flex items-start gap-3 border-b border-neutral-200 bg-neutral-100/70 px-5 py-4 dark:border-white/10 dark:bg-white/[0.03] lg:border-b-0 lg:border-r">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-900 dark:text-white">{title}</h2>
                {description && <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-white/50">{description}</p>}
            </div>
        </div>
        <div className="min-w-0 divide-y divide-neutral-200 dark:divide-white/10">
            {children}
        </div>
    </section>
);

const ToggleRow = ({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <button
        type="button"
        className={`${rowClass} w-full text-left`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
    >
        <span className="min-w-0">
            <span className="block text-sm font-semibold text-neutral-900 dark:text-white">{label}</span>
            {description && <span className="mt-1 block text-xs leading-relaxed text-neutral-600 dark:text-white/50">{description}</span>}
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-neutral-300 dark:bg-white/20'}`}>
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </span>
    </button>
);

const ShortcutRow = ({ id, label, value, editingKey, setEditingKey }: { id: string; label: string; value: string, editingKey: string | null, setEditingKey: (k: string | null) => void }) => (
    <div className={rowClass}>
        <span className="text-sm font-semibold text-neutral-900 dark:text-white">{label}</span>
        <button
            type="button"
            onClick={() => setEditingKey(id)}
            className={`min-w-24 rounded-lg px-4 py-2 text-xs font-bold transition-all ${editingKey === id
                ? 'bg-primary text-black shadow-lg shadow-primary/20'
                : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/15'
                }`}
        >
            {editingKey === id ? 'Press key' : (value === ' ' ? 'SPACE' : value.toUpperCase())}
        </button>
    </div>
);

const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className={rowClass}>
        <div className="min-w-0">
            <span className="block text-sm font-semibold text-neutral-900 dark:text-white">{label}</span>
            <span className="mt-1 block font-mono text-xs text-neutral-600 dark:text-white/50">{value}</span>
        </div>
        <label className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 shadow-inner dark:border-white/15 dark:bg-white/10">
            <span className="absolute inset-1 rounded-md" style={{ backgroundColor: value }} />
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={label}
            />
        </label>
    </div>
);

const OptionRow = ({ label, description, options, value, onChange }: {
    label: string;
    description?: string;
    options: { value: string; label: string; icon?: React.ElementType }[];
    value: string;
    onChange: (v: string) => void
}) => (
    <div className="px-5 py-4">
        <div className="mb-3">
            <span className="block text-sm font-semibold text-neutral-900 dark:text-white">{label}</span>
            {description && <span className="mt-1 block text-xs leading-relaxed text-neutral-600 dark:text-white/50">{description}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1 dark:bg-white/5">
            {options.map(opt => {
                const Icon = opt.icon;
                return (
                    <button
                        type="button"
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-bold transition-all ${value === opt.value
                            ? 'bg-white text-neutral-950 shadow-xs dark:bg-white dark:text-black'
                            : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
                            }`}
                    >
                        {Icon && <Icon className="h-4 w-4" />}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    </div>
);

const DesktopSettingsPanel = () => {
    const platform = usePlatform();
    const [values, setValues] = useState<Record<string, boolean>>({});
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!platform || platform.info.kind !== 'desktop') return;
        let cancelled = false;
        Promise.all([
            platform.settings.get('trayOnClose'),
            platform.settings.get('minimizeToTray'),
            platform.settings.get('mediaKeysEnabled'),
            platform.settings.get('taskbarProgressEnabled'),
        ]).then(([trayOnClose, minimizeToTray, mediaKeysEnabled, taskbarProgressEnabled]) => {
            if (cancelled) return;
            setValues({
                trayOnClose: trayOnClose !== false,
                minimizeToTray: minimizeToTray === true,
                mediaKeysEnabled: mediaKeysEnabled !== false,
                taskbarProgressEnabled: taskbarProgressEnabled !== false,
            });
            setLoaded(true);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [platform]);

    if (!platform || platform.info.kind !== 'desktop') return null;

    const setValue = async (key: string, value: boolean) => {
        setValues(prev => ({ ...prev, [key]: value }));
        try {
            await platform.settings.set(key, value);
        } catch (error) {
            console.warn('[nebula] failed to persist desktop setting', key, error);
            setValues(prev => ({ ...prev, [key]: !value }));
        }
    };

    return (
        <SettingPanel icon={Monitor} title="Desktop Integration">
            <ToggleRow
                label="Close to Tray"
                description="Closing the window keeps Nebula running in the system tray."
                checked={loaded ? values.trayOnClose ?? true : true}
                onChange={(v) => setValue('trayOnClose', v)}
            />
            <ToggleRow
                label="Minimize to Tray"
                description="Minimizing hides the window to the tray instead of the taskbar."
                checked={loaded ? values.minimizeToTray ?? false : false}
                onChange={(v) => setValue('minimizeToTray', v)}
            />
            <ToggleRow
                label="Global Media Keys"
                description="Control playback with your keyboard's media keys even when Nebula is in the background."
                checked={loaded ? values.mediaKeysEnabled ?? true : true}
                onChange={(v) => setValue('mediaKeysEnabled', v)}
            />
            <ToggleRow
                label="Taskbar Progress"
                description="Show playback progress in the Windows taskbar."
                checked={loaded ? values.taskbarProgressEnabled ?? true : true}
                onChange={(v) => setValue('taskbarProgressEnabled', v)}
            />
        </SettingPanel>
    );
};

const DesktopUpdatesPanel = () => {
    const platform = usePlatform();
    const [channel, setChannel] = useState('stable');
    const [updateState, setUpdateState] = useState<UpdaterState | null>(null);

    useEffect(() => {
        if (!platform || platform.info.kind !== 'desktop') return;
        let cancelled = false;
        Promise.all([
            platform.settings.get('updateChannel'),
            platform.updater.getState(),
        ]).then(([storedChannel, state]) => {
            if (cancelled) return;
            setChannel(typeof storedChannel === 'string' ? storedChannel : 'stable');
            setUpdateState(state);
        }).catch(() => {});
        const unsubscribe = platform.updater.onStatus((state) => setUpdateState(state));
        return () => { cancelled = true; unsubscribe(); };
    }, [platform]);

    if (!platform || platform.info.kind !== 'desktop') return null;

    const changeChannel = async (value: string) => {
        const previous = channel;
        setChannel(value);
        try {
            await platform.settings.set('updateChannel', value);
        } catch (error) {
            console.warn('[nebula] failed to persist update channel', error);
            setChannel(previous);
        }
    };

    const phase = updateState?.phase ?? 'idle';
    const enabled = updateState?.enabled ?? false;
    const busy = phase === 'checking' || phase === 'downloading';
    const readyToInstall = phase === 'downloaded';
    const currentVersion = updateState?.currentVersion ?? platform.info.appVersion;

    const badgeClass = phase === 'downloaded'
        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
        : phase === 'error'
            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
            : phase === 'not-available' || phase === 'idle'
                ? 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-white/50'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400';

    return (
        <SettingPanel icon={Download} title="Updates">
            <div className="px-5 py-6">
                <div className="flex flex-col items-center text-center">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${badgeClass}`}>
                        {phase.replace('-', ' ')}
                    </span>
                    <span className="mt-3 block text-lg font-bold text-neutral-900 dark:text-white">
                        {currentVersion ? `Nebula ${currentVersion}` : 'Nebula'}
                    </span>
                    <span className="mt-1 block max-w-xl text-xs leading-relaxed text-neutral-600 dark:text-white/50">
                        {updateState?.message ?? 'Updates are checked against GitHub Releases.'}
                    </span>

                    {phase === 'downloaded' ? (
                        <button
                            type="button"
                            onClick={() => platform.updater.installAndRestart()}
                            className="mt-5 flex w-56 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-black transition hover:brightness-110"
                        >
                            <Download className="h-4 w-4" />
                            Restart &amp; Install
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => platform.updater.check()}
                            disabled={!enabled || busy}
                            className="mt-5 flex w-56 items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                            {busy ? (phase === 'downloading' ? `Downloading\u2026 ${updateState?.progress ?? 0}%` : 'Checking\u2026') : 'Check for updates'}
                        </button>
                    )}

                    {phase === 'downloading' && (
                        <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${updateState?.progress ?? 0}%` }}
                            />
                        </div>
                    )}
                </div>

                <div className="mt-6 flex flex-col items-center">
                    <span className="block text-sm font-semibold text-neutral-900 dark:text-white">Update channel</span>
                    <span className="mt-1 block text-xs leading-relaxed text-neutral-600 dark:text-white/50">
                        Beta delivers pre-release builds from the beta channel.
                    </span>
                    <div className={`mt-3 grid w-48 grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1 dark:bg-white/5 ${enabled ? '' : 'pointer-events-none opacity-50'}`}>
                        {[{ value: 'stable', label: 'Stable' }, { value: 'beta', label: 'Beta' }].map(option => (
                            <button
                                type="button"
                                key={option.value}
                                onClick={() => changeChannel(option.value)}
                                className={`rounded-md px-3 py-2.5 text-xs font-bold transition-all ${channel === option.value
                                    ? 'bg-white text-neutral-950 shadow-xs dark:bg-white dark:text-black'
                                    : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </SettingPanel>
    );
};

export const SettingsView: React.FC = () => {
    const { settings, updateSettings, connectToSubsonic, isDemoMode, credentials, visualizerMode, setVisualizerMode, disconnect } = useStore();
    const { mode, setTheme } = useTheme();
    const streamDeckBridge = useStreamDeckBridge();

    const [url, setUrl] = useState(credentials?.serverUrl || '');
    const [user, setUser] = useState(credentials?.username || '');
    const [pass, setPass] = useState('');
    const [authMode, setAuthMode] = useState<'password' | 'apiKey'>(credentials?.authType === 'apiKey' ? 'apiKey' : 'password');
    const [connStatus, setConnStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [isInsecure, setIsInsecure] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [autoEqQuery, setAutoEqQuery] = useState('');
    const [autoEqResults, setAutoEqResults] = useState<AutoEqIndexEntry[]>([]);
    const [autoEqStatus, setAutoEqStatus] = useState<'idle' | 'loading' | 'applying' | 'error'>('idle');
    const [autoEqError, setAutoEqError] = useState('');
    const [autoEqLastFetchedAt, setAutoEqLastFetchedAt] = useState<number | null>(() => settings.eq.autoEqIndexFetchedAt || getCachedAutoEqIndexInfo()?.fetchedAt || null);
    const [pairingCode, setPairingCode] = useState('');
    const [pairingError, setPairingError] = useState('');

    useEffect(() => {
        setIsInsecure(Boolean(url && !url.startsWith('https://') && url.length > 7));
    }, [url]);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnStatus('loading');
        const success = await connectToSubsonic(url, user, pass, authMode);
        setConnStatus(success ? 'success' : 'error');
    };

    useEffect(() => {
        if (!editingKey) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();
            updateSettings({ shortcuts: { ...settings.shortcuts, [editingKey]: e.key } });
            setEditingKey(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingKey, settings.shortcuts, updateSettings]);

    const setEqBand = (freq: string, newVal: number) => {
        updateSettings({
            eq: {
                ...settings.eq,
                preset: 'custom',
                bands: { ...settings.eq.bands, [freq]: newVal }
            }
        });
    };

    const syncAutoEqFetchedAt = () => {
        const fetchedAt = getCachedAutoEqIndexInfo()?.fetchedAt || Date.now();
        setAutoEqLastFetchedAt(fetchedAt);
        if (settings.eq.autoEqIndexFetchedAt !== fetchedAt) {
            updateSettings({
                eq: { autoEqIndexFetchedAt: fetchedAt } as typeof settings.eq,
            });
        }
    };

    useEffect(() => {
        const query = autoEqQuery.trim();
        if (query.length < 2) {
            setAutoEqResults([]);
            setAutoEqError('');
            if (autoEqStatus === 'loading') setAutoEqStatus('idle');
            return;
        }

        let cancelled = false;
        setAutoEqStatus('loading');
        const handler = window.setTimeout(async () => {
            try {
                const results = await searchAutoEqProfiles(query);
                if (cancelled) return;
                setAutoEqResults(results);
                setAutoEqError(results.length === 0 ? 'No AutoEq profiles matched that search.' : '');
                setAutoEqStatus('idle');
                syncAutoEqFetchedAt();
            } catch (error) {
                if (cancelled) return;
                setAutoEqResults([]);
                setAutoEqError(error instanceof Error ? error.message : 'AutoEq search failed.');
                setAutoEqStatus('error');
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(handler);
        };
    }, [autoEqQuery]);

    const refreshAutoEqIndex = async () => {
        setAutoEqStatus('loading');
        setAutoEqError('');
        try {
            await fetchAutoEqIndex(true);
            syncAutoEqFetchedAt();
            const results = await searchAutoEqProfiles(autoEqQuery);
            setAutoEqResults(results);
            setAutoEqStatus('idle');
        } catch (error) {
            setAutoEqError(error instanceof Error ? error.message : 'AutoEq refresh failed.');
            setAutoEqStatus('error');
        }
    };

    const applyAutoEqProfile = async (entry: AutoEqIndexEntry) => {
        setAutoEqStatus('applying');
        setAutoEqError('');
        try {
            const profile = await fetchAutoEqProfile(entry);
            updateSettings({
                eq: {
                    ...settings.eq,
                    enabled: true,
                    preset: 'custom',
                    autoEq: {
                        name: entry.name,
                        source: entry.source,
                        path: entry.path,
                        preamp: profile.preamp,
                        appliedAt: Date.now(),
                    },
                    bands: {
                        ...settings.eq.bands,
                        ...profile.bands,
                    },
                },
            });
            setAutoEqStatus('idle');
        } catch (error) {
            setAutoEqError(error instanceof Error ? error.message : 'Unable to apply AutoEq profile.');
            setAutoEqStatus('error');
        }
    };

    const clearAutoEqProfile = () => {
        updateSettings({
            eq: {
                ...settings.eq,
                preset: 'custom',
                autoEq: null,
            },
        });
    };

    const autoEqLastFetchedLabel = autoEqLastFetchedAt
        ? new Date(autoEqLastFetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Not cached';

    return (
        <div className="h-full overflow-y-auto bg-neutral-50 text-neutral-900 custom-scrollbar dark:bg-neutral-950 dark:text-white">
            <div className="w-full px-6 py-8 pb-32 lg:px-10">
                <header className="mb-8">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary ring-1 ring-primary/20">
                            <Monitor className="h-3.5 w-3.5" />
                            Nebula Controls
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-neutral-950 dark:text-white">Settings</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-white/55">
                            Tune the connection, playback, appearance, navigation, and keyboard controls for this device.
                        </p>
                    </div>
                </header>

                <div className="space-y-5">
                        <SettingPanel icon={Server} title="Server Connection" description="Subsonic-compatible server credentials are stored locally.">
                            <form onSubmit={handleConnect} className="divide-y divide-neutral-200 dark:divide-white/10">
                                <div className="grid grid-cols-2 gap-1 px-5 py-4">
                                    {([
                                        ['password', 'Password'],
                                        ['apiKey', 'API Key'],
                                    ] as const).map(([mode, label]) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => {
                                                setAuthMode(mode);
                                                setPass('');
                                                setConnStatus('idle');
                                            }}
                                            className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${authMode === mode
                                                ? 'bg-neutral-900 text-white shadow-xs dark:bg-white dark:text-black'
                                                : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900 dark:bg-white/5 dark:text-white/50 dark:hover:text-white'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <div className="px-5 py-4">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">Server URL</label>
                                    <input
                                        type="text"
                                        value={url}
                                        onChange={e => setUrl(e.target.value)}
                                        placeholder="https://music.example.com"
                                        className={`${inputClass} ${isInsecure ? 'border-yellow-500/60 focus:border-yellow-500 focus:ring-yellow-500/20' : ''}`}
                                    />
                                    {isInsecure && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                                            <ShieldAlert className="h-3.5 w-3.5" />
                                            HTTPS is recommended for remote servers.
                                        </div>
                                    )}
                                </div>
                                <div className={`grid gap-px divide-y divide-neutral-200 dark:divide-white/10 ${authMode === 'password' ? 'md:grid-cols-2 md:divide-x md:divide-y-0' : ''}`}>
                                    {authMode === 'password' && <div className="px-5 py-4">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">Username</label>
                                        <input
                                            type="text"
                                            value={user}
                                            onChange={e => setUser(e.target.value)}
                                            placeholder="admin"
                                            className={inputClass}
                                        />
                                    </div>}
                                    <div className="px-5 py-4">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">{authMode === 'apiKey' ? 'API Key' : 'Password'}</label>
                                        <input
                                            type="password"
                                            value={pass}
                                            onChange={e => setPass(e.target.value)}
                                            placeholder={authMode === 'apiKey' ? 'API key' : 'Password'}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                                <div className="px-5 py-4">
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <button
                                            type="submit"
                                            disabled={connStatus === 'loading'}
                                            className="flex flex-1 items-center justify-center rounded-lg bg-neutral-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-black dark:hover:bg-primary"
                                        >
                                            {connStatus === 'loading' ? 'Connecting...' : 'Save & Connect'}
                                        </button>
                                        {(credentials || isDemoMode) && (
                                            <button
                                                type="button"
                                                onClick={disconnect}
                                                className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-3.5 text-sm font-bold text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
                                            >
                                                <LogOut className="h-4 w-4" />
                                                Disconnect Server
                                            </button>
                                        )}
                                    </div>
                                    {connStatus === 'success' && (
                                        <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                                            <CheckCircle className="h-4 w-4" />
                                            Connected successfully
                                        </div>
                                    )}
                                    {connStatus === 'error' && (
                                        <div className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
                                            <AlertCircle className="h-4 w-4" />
                                            Connection failed
                                        </div>
                                    )}
                                    {isDemoMode && connStatus === 'idle' && (
                                        <p className="mt-3 text-center text-xs text-neutral-600 dark:text-white/50">Currently in Demo Mode</p>
                                    )}
                                </div>
                            </form>
                        </SettingPanel>

                        <SettingPanel icon={Cable} title="Stream Deck" description="Control this browser tab from the Nebula Music Stream Deck plugin.">
                            <ToggleRow
                                label="Enable Stream Deck bridge"
                                description="Connect only to the plugin on this computer. Disabled by default."
                                checked={settings.streamDeck?.enabled ?? false}
                                onChange={(enabled) => updateSettings({
                                    streamDeck: {
                                        enabled,
                                        port: settings.streamDeck?.port ?? STREAM_DECK_DEFAULT_PORT,
                                    },
                                })}
                            />
                            <div className="px-5 py-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <span className="block text-sm font-semibold text-neutral-900 dark:text-white">Connection status</span>
                                        <span className="mt-1 block max-w-xl text-xs leading-relaxed text-neutral-600 dark:text-white/50">
                                            {streamDeckBridge.status.message || {
                                                disabled: 'The browser bridge is off.',
                                                connecting: 'Looking for the Stream Deck plugin.',
                                                'pairing-required': 'Connected locally. Enter the pairing code from Stream Deck.',
                                                authenticating: 'Verifying this browser with Stream Deck.',
                                                connected: 'Paired and ready to receive playback commands.',
                                                disconnected: 'The plugin is not currently reachable. Nebula will retry automatically.',
                                                'protocol-mismatch': 'The plugin and Nebula use incompatible bridge versions.',
                                                error: 'The local bridge encountered an error.',
                                            }[streamDeckBridge.status.state]}
                                        </span>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                                        streamDeckBridge.status.state === 'connected'
                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                            : streamDeckBridge.status.state === 'disabled'
                                                ? 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-white/50'
                                                : streamDeckBridge.status.state === 'protocol-mismatch' || streamDeckBridge.status.state === 'error'
                                                    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {streamDeckBridge.status.state.replace('-', ' ')}
                                    </span>
                                </div>
                                <div className="mt-3 rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-700 dark:bg-black/30 dark:text-white/60">
                                    {streamDeckBridge.status.endpoint}
                                </div>
                            </div>
                            <div className="grid gap-px divide-y divide-neutral-200 dark:divide-white/10 md:grid-cols-2 md:divide-x md:divide-y-0">
                                <div className="px-5 py-4">
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">Local port</label>
                                    <input
                                        type="number"
                                        min={1024}
                                        max={65535}
                                        value={settings.streamDeck?.port ?? STREAM_DECK_DEFAULT_PORT}
                                        disabled={settings.streamDeck?.enabled}
                                        onChange={(event) => {
                                            const port = Number(event.target.value);
                                            if (Number.isInteger(port) && port >= 1024 && port <= 65535) {
                                                updateSettings({
                                                    streamDeck: {
                                                        enabled: settings.streamDeck?.enabled ?? false,
                                                        port,
                                                    },
                                                });
                                            }
                                        }}
                                        className={inputClass}
                                    />
                                    <p className="mt-2 text-xs text-neutral-600 dark:text-white/50">Use the same port in the plugin. Disable the bridge before changing it.</p>
                                </div>
                                <form
                                    className="px-5 py-4"
                                    onSubmit={async (event) => {
                                        event.preventDefault();
                                        setPairingError('');
                                        try {
                                            await streamDeckBridge.pair(pairingCode);
                                            setPairingCode('');
                                        } catch (error) {
                                            setPairingError(error instanceof Error ? error.message : 'Pairing failed.');
                                        }
                                    }}
                                >
                                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">Pairing code</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={6}
                                            value={pairingCode}
                                            onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000000"
                                            aria-label="Six-digit Stream Deck pairing code"
                                            className={`${inputClass} font-mono tracking-[0.3em]`}
                                        />
                                        <button
                                            type="submit"
                                            disabled={pairingCode.length !== 6 || !settings.streamDeck?.enabled}
                                            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Pair
                                        </button>
                                    </div>
                                    {pairingError && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{pairingError}</p>}
                                </form>
                            </div>
                            <div className="flex flex-wrap gap-2 px-5 py-4">
                                <button
                                    type="button"
                                    onClick={streamDeckBridge.reconnect}
                                    disabled={!settings.streamDeck?.enabled}
                                    className="flex items-center gap-2 rounded-lg bg-neutral-200 px-4 py-2 text-xs font-bold text-neutral-800 transition hover:bg-neutral-300 disabled:opacity-40 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Reconnect
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setPairingError('');
                                        try {
                                            await streamDeckBridge.unpair();
                                        } catch (error) {
                                            setPairingError(error instanceof Error ? error.message : 'Unable to revoke pairing.');
                                        }
                                    }}
                                    className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
                                >
                                    <Unplug className="h-3.5 w-3.5" />
                                    Revoke pairing
                                </button>
                            </div>
                        </SettingPanel>

                        <SettingPanel icon={Sliders} title="Equalizer" description="Shape playback with presets or individual frequency bands.">
                            <div className="px-5 py-4">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <ToggleRow
                                        label="Enable Equalizer"
                                        checked={settings.eq.enabled}
                                        onChange={(v) => updateSettings({ eq: { ...settings.eq, enabled: v } })}
                                    />
                                    <div className="min-w-48">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">Preset</label>
                                        <CustomDropdown
                                            value={settings.eq.preset}
                                            onChange={(newPreset) => {
                                                const typedPreset = newPreset as typeof settings.eq.preset;
                                                const newBands = typedPreset === 'custom' ? settings.eq.bands : { ...EQ_PRESETS[typedPreset] };
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

                                <div className={`mt-6 transition-all duration-500 ${settings.eq.enabled ? 'opacity-100' : 'pointer-events-none opacity-40 grayscale'}`}>
                                    <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 p-5 dark:border-white/10 dark:bg-black/20">
                                        <div
                                            className="absolute inset-0 opacity-10"
                                            style={{ backgroundImage: 'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                                        />

                                        <div className="relative z-10 flex h-64 items-end justify-between gap-2">
                                            <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-neutral-300 dark:bg-white/10" />

                                            {Object.entries(EQ_BAND_LABELS).map(([freq, label]) => {
                                                const val = settings.eq.bands[freq as keyof typeof settings.eq.bands] || 0;
                                                const percent = ((val + 12) / 24) * 100;

                                                return (
                                                    <div key={freq} className="group relative flex h-full flex-1 flex-col items-center">
                                                        <div className="relative flex h-full w-full justify-center pb-8 pt-2">
                                                            <div className="absolute bottom-8 top-2 w-2 rounded-full border border-neutral-300 bg-black/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] dark:border-white/5 dark:bg-black/50">
                                                                <div className="absolute left-1/2 top-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 bg-neutral-400 dark:bg-white/20" />
                                                            </div>

                                                            <div
                                                                className={`pointer-events-none absolute w-1 rounded-full bg-primary transition-all duration-200 ${val === 0 ? 'opacity-0' : 'opacity-100 shadow-[0_0_8px_currentColor]'}`}
                                                                style={{
                                                                    height: `${Math.abs(val) / 24 * 100}%`,
                                                                    top: val > 0 ? 'auto' : '50%',
                                                                    bottom: val > 0 ? '50%' : 'auto',
                                                                }}
                                                            />

                                                            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                                                                <input
                                                                    type="range"
                                                                    min="-12"
                                                                    max="12"
                                                                    step="1"
                                                                    value={val}
                                                                    onChange={(e) => setEqBand(freq, parseInt(e.target.value))}
                                                                    className="pointer-events-auto h-10 w-[220px] cursor-pointer appearance-none bg-transparent opacity-0"
                                                                    style={{ transform: 'rotate(-90deg)' }}
                                                                    title={`${label}: ${val > 0 ? '+' : ''}${val}dB`}
                                                                />
                                                            </div>

                                                            <div
                                                                className="pointer-events-none absolute z-10 flex h-11 w-8 items-center justify-center transition-all duration-75"
                                                                style={{ bottom: `calc(${percent}% - 22px + 10px)` }}
                                                            >
                                                                <div className="relative flex h-11 w-8 flex-col items-center justify-center gap-1 rounded bg-gradient-to-b from-neutral-200 to-neutral-300 shadow-[0_4px_6px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.25)] ring-1 ring-neutral-300 group-hover:from-neutral-300 group-hover:to-neutral-400 dark:from-neutral-700 dark:to-neutral-800 dark:ring-black dark:group-hover:from-neutral-600 dark:group-hover:to-neutral-700">
                                                                    <div className="h-0.5 w-6 bg-black/20 dark:bg-black/30" />
                                                                    <div className="h-0.5 w-6 bg-black/20 dark:bg-black/30" />
                                                                    <div className="h-0.5 w-6 bg-black/20 dark:bg-black/30" />
                                                                    <div className="mt-1 h-0.5 w-full bg-primary shadow-[0_0_5px_rgba(var(--primary-rgb),0.8)]" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="absolute bottom-0 w-full truncate text-center text-[10px] font-bold uppercase tracking-widest text-neutral-600 transition-colors group-hover:text-neutral-900 dark:text-white/60 dark:group-hover:text-white">
                                                            {label}
                                                        </div>

                                                        <div className="pointer-events-none absolute -top-5 translate-y-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-black opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                                                            {val > 0 ? '+' : ''}{val}dB
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 rounded-lg border border-neutral-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
                                                <Headphones className="h-4 w-4 text-primary" />
                                                AutoEq Headphone Calibration
                                            </div>
                                            <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-white/50">
                                                Search AutoEq fixed-band profiles and apply them to Nebula's 10-band EQ.
                                            </p>
                                            {settings.eq.autoEq && (
                                                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
                                                    <span className="font-bold">Based on AutoEq:</span>
                                                    <span className="min-w-0 truncate">{settings.eq.autoEq.name}</span>
                                                    <span className="text-neutral-600 dark:text-white/45">{settings.eq.autoEq.source}</span>
                                                    {typeof settings.eq.autoEq.preamp === 'number' && (
                                                        <span className="text-neutral-600 dark:text-white/45">Preamp {settings.eq.autoEq.preamp.toFixed(1)} dB</span>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={clearAutoEqProfile}
                                                        className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 font-bold text-neutral-700 transition hover:bg-neutral-200 dark:text-white/70 dark:hover:bg-white/10"
                                                    >
                                                        <X className="h-3 w-3" />
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={refreshAutoEqIndex}
                                            disabled={autoEqStatus === 'loading' || autoEqStatus === 'applying'}
                                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-xs font-bold text-neutral-800 transition hover:bg-neutral-200 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${autoEqStatus === 'loading' ? 'animate-spin' : ''}`} />
                                            Refresh
                                        </button>
                                    </div>

                                    <div className="mt-4">
                                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-white/50">Headphone or Earbud Model</label>
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                                            <input
                                                type="search"
                                                value={autoEqQuery}
                                                onChange={(e) => setAutoEqQuery(e.target.value)}
                                                placeholder="Search Sony WH-1000XM5, HD 650, AirPods Pro..."
                                                className={`${inputClass} pl-10 pr-10`}
                                            />
                                            {(autoEqStatus === 'loading' || autoEqStatus === 'applying') && (
                                                <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-neutral-500 dark:text-white/35">
                                            <span>Index cache: {autoEqLastFetchedLabel}</span>
                                            <span>AutoEq preamp is stored for display and not applied yet.</span>
                                        </div>
                                    </div>

                                    {autoEqError && (
                                        <div className="mt-3 flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-700 dark:text-yellow-300">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            {autoEqError}
                                        </div>
                                    )}

                                    {autoEqResults.length > 0 && (
                                        <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-black/20">
                                            {autoEqResults.map(entry => (
                                                <div key={entry.id} className="flex flex-col gap-3 border-b border-neutral-200 px-3 py-3 last:border-b-0 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-bold text-neutral-900 dark:text-white">{entry.name}</div>
                                                        <div className="mt-1 truncate text-xs text-neutral-600 dark:text-white/45">{entry.source}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyAutoEqProfile(entry)}
                                                        disabled={autoEqStatus === 'applying'}
                                                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-black transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
                                                    >
                                                        {autoEqStatus === 'applying' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Headphones className="h-3.5 w-3.5" />}
                                                        Apply AutoEq
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SettingPanel>

                        <SettingPanel icon={Palette} title="Appearance">
                            <OptionRow
                                label="Theme Mode"
                                options={[
                                    { value: 'dark', label: 'Dark', icon: Moon },
                                    { value: 'light', label: 'Light', icon: Sun },
                                ]}
                                value={mode}
                                onChange={(v) => setTheme(v as 'light' | 'dark')}
                            />
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
                        </SettingPanel>

                        <SettingPanel icon={Monitor} title="Player Display">
                            <OptionRow
                                label="Mini Player Style"
                                options={[
                                    { value: 'sidebar', label: 'Sidebar Panel' },
                                    { value: 'floating', label: 'Floating Bar' },
                                ]}
                                value={settings.miniPlayerMode}
                                onChange={(v) => updateSettings({ miniPlayerMode: v as 'floating' | 'sidebar' })}
                            />
                            <ToggleRow
                                label="Magic Crossfade"
                                description="Detects track endings and fades into the next song."
                                checked={settings.magicCrossfade}
                                onChange={(v) => updateSettings({ magicCrossfade: v })}
                            />
                        </SettingPanel>

                        <SettingPanel icon={Activity} title="Visualizer Style">
                            <div className="grid grid-cols-3 gap-2 px-5 py-4">
                                {VISUALIZER_MODES.map((mode) => (
                                    <button
                                        type="button"
                                        key={mode}
                                        onClick={() => setVisualizerMode(mode)}
                                        className={`rounded-lg px-3 py-2.5 text-xs font-bold transition-all ${visualizerMode === mode
                                            ? 'bg-primary text-black shadow-lg shadow-primary/20'
                                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white'
                                            }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </SettingPanel>

                        <SettingPanel icon={Layout} title="Navigation Items">
                            <ToggleRow label="Show Home" checked={settings.sidebar.showHome} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showHome: v } })} />
                            <ToggleRow label="Show Browse" checked={settings.sidebar.showBrowse} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showBrowse: v } })} />
                            <ToggleRow label="Show Internet Radio" checked={settings.sidebar.showRadio} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showRadio: v } })} />
                            <ToggleRow label="Show Artists" checked={settings.sidebar.showArtists} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showArtists: v } })} />
                            <ToggleRow label="Show Albums" checked={settings.sidebar.showAlbums} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showAlbums: v } })} />
                            <ToggleRow label="Show Songs" checked={settings.sidebar.showSongs} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showSongs: v } })} />
                            <ToggleRow label="Show Playlists" checked={settings.sidebar.showPlaylists} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showPlaylists: v } })} />
                        </SettingPanel>

                        <SettingPanel icon={Keyboard} title="Keyboard Shortcuts">
                            <ShortcutRow id="playPause" label="Play / Pause" value={settings.shortcuts.playPause} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="prev" label="Previous Song" value={settings.shortcuts.prev} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="next" label="Next Song" value={settings.shortcuts.next} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="loop" label="Toggle Loop" value={settings.shortcuts.loop} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="zen" label="Toggle Zen Mode" value={settings.shortcuts.zen} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="visualizer" label="Cycle Visualizer" value={settings.shortcuts.visualizer} editingKey={editingKey} setEditingKey={setEditingKey} />
                        </SettingPanel>

                        <DesktopSettingsPanel />
                        <DesktopUpdatesPanel />
                </div>
            </div>
        </div>
    );
};
