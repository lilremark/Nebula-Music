import React, { useState, useEffect } from 'react';
import {
    Activity, AlertCircle, Cable, CheckCircle, Download, Headphones, Keyboard, Layout, Loader2, LogOut, Monitor,
    Moon, Palette, RefreshCw, Search, Server, ShieldAlert, ShieldCheck, Sliders, Sun, Unplug, X
} from 'lucide-react';
import { useCrashReporting } from '../hooks/useCrashReporting';
import { CrashReportsDisclosure } from '../components/CrashReportsDisclosure';
import { useStore } from '../context/Store';
import { useTheme } from '../context/ThemeContext';
import { SegmentedControl, SettingPanel, ToggleRow } from '../components/ui';
import { usePlatform } from '../platform/PlatformContext';
import { isLocalDjPlatform } from '../platform/aiDjAvailability';
import { InsecureHttpSetting } from '../components/InsecureHttpSetting';
import { isInsecureHttpUrl, useInsecureHttpSetting } from '../hooks/useInsecureHttpSetting';
import type { UpdaterState } from '../electron/updater';
import { VISUALIZER_MODES, type ReplayGainSettings, type VisualizerMode } from '../types';
import { EQ_PRESETS, EQ_BAND_LABELS, EQ_PRESET_LABELS } from '../constants/eqPresets';
import { getAutoEqPreampDb } from '../services/eqPreamp';
import { CustomDropdown } from '../components/CustomDropdown';
import { BackgroundPicker, FontSelect, ThemePresetPicker } from '../components/appearance/AppearancePickers';
import { getBackgroundOption, getFontOption, getThemePreset } from '../constants/appearance';
import { getUpdateAction } from '../components/updateAction';
import { AiDjSettings } from '../components/AiDjSettings';
import {
    AutoEqIndexEntry,
    fetchAutoEqIndex,
    fetchAutoEqProfile,
    getCachedAutoEqIndexInfo,
    searchAutoEqProfiles,
} from '../services/autoEqService';
import { useStreamDeckBridge } from '../context/StreamDeckBridgeContext';
import { STREAM_DECK_DEFAULT_PORT } from '../services/streamDeckProtocol';

// Row, field and control styles live in next-ui.css (.nebula-setting-*, .nebula-control-*).
const inputClass = 'nebula-control-input';
const SETTINGS_JUMPS = [
    ['settings-server-connection', 'Connection'],
    ['settings-equalizer', 'Sound'],
    ['settings-appearance', 'Interface'],
    ['settings-stream-deck', 'Integrations'],
    ['settings-ai-dj', 'AI DJ'],
    ['settings-desktop-integration', 'Desktop'],
] as const;

/** Label (and optional description) on the left, one right-aligned control. */
const SettingRow = ({ label, description, labelFor, controlWidth, children }: {
    label: React.ReactNode;
    description?: React.ReactNode;
    /** id of a native control to associate the visible label with */
    labelFor?: string;
    controlWidth?: 'sm' | 'md';
    children: React.ReactNode;
}) => (
    <div className="nebula-setting-row">
        <span className="nebula-setting-copy">
            {labelFor
                ? <label htmlFor={labelFor} className="nebula-setting-label">{label}</label>
                : <span className="nebula-setting-label">{label}</span>}
            {description && <span className="nebula-setting-desc">{description}</span>}
        </span>
        <span className="nebula-setting-control" data-width={controlWidth}>{children}</span>
    </div>
);

const StaticRow = ({ label, description }: { label: string; description?: string }) => (
    <SettingRow label={label} description={description}>
        <span className="nebula-setting-value">On</span>
    </SettingRow>
);

// Friendly names for stored KeyboardEvent.key values: [visible glyph, spoken name].
const SHORTCUT_KEY_NAMES: Record<string, [string, string]> = {
    ' ': ['Space', 'Space'],
    Spacebar: ['Space', 'Space'],
    ArrowLeft: ['←', 'Left arrow'],
    ArrowRight: ['→', 'Right arrow'],
    ArrowUp: ['↑', 'Up arrow'],
    ArrowDown: ['↓', 'Down arrow'],
    Escape: ['Esc', 'Escape'],
    Enter: ['Enter', 'Enter'],
    Backspace: ['⌫', 'Backspace'],
    Delete: ['Del', 'Delete'],
    Tab: ['Tab', 'Tab'],
    PageUp: ['Page Up', 'Page Up'],
    PageDown: ['Page Down', 'Page Down'],
    Control: ['Ctrl', 'Control'],
    Meta: ['Meta', 'Meta'],
};

const formatShortcutKey = (key: string): [string, string] => {
    const named = SHORTCUT_KEY_NAMES[key];
    if (named) return named;
    if (key.length === 1) return [key.toUpperCase(), key.toUpperCase()];
    const spaced = key.replace(/([a-z])([A-Z0-9])/g, '$1 $2');
    return [spaced, spaced];
};

const ShortcutRow = ({ id, label, value, editingKey, setEditingKey }: { id: string; label: string; value: string, editingKey: string | null, setEditingKey: (k: string | null) => void }) => {
    const editing = editingKey === id;
    const [glyph, spoken] = formatShortcutKey(value);
    return (
        <SettingRow label={label}>
            <button
                type="button"
                onClick={() => setEditingKey(id)}
                data-editing={editing ? 'true' : undefined}
                aria-label={editing ? `${label}: press a key` : `${label} shortcut: ${spoken}. Change`}
                className="nebula-setting-kbd"
            >
                {editing ? 'Press a key' : <kbd>{glyph}</kbd>}
            </button>
        </SettingRow>
    );
};

const ColorRow = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <SettingRow label={label}>
        <label className="nebula-setting-swatch">
            <span className="nebula-time">{value.toUpperCase()}</span>
            <span className="nebula-setting-swatch-chip" style={{ backgroundColor: value }} aria-hidden="true" />
            <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label={label}
            />
        </label>
    </SettingRow>
);

const OptionRow = ({ label, description, options, value, onChange, disabled }: {
    label: string;
    description?: string;
    options: { value: string; label: string; icon?: React.ElementType }[];
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) => (
    <SettingRow label={label} description={description}>
        <SegmentedControl ariaLabel={label} value={value} options={options} onChange={onChange} disabled={disabled} />
    </SettingRow>
);

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const DesktopSettingsPanel = () => {
    const platform = usePlatform();
    const isWindows = platform?.info.os === 'win32';
    const isMac = platform?.info.os === 'darwin';
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
                description={isMac ? 'Closing the window keeps Nebula running in the menu bar.' : 'Closing the window keeps Nebula running in the system tray.'}
                checked={loaded ? values.trayOnClose ?? true : true}
                onChange={(v) => setValue('trayOnClose', v)}
            />
            <ToggleRow
                label="Minimize to Tray"
                description={isMac ? 'Minimizing hides the window to the menu bar instead of the Dock.' : 'Minimizing hides the window to the tray instead of the taskbar.'}
                checked={loaded ? values.minimizeToTray ?? false : false}
                onChange={(v) => setValue('minimizeToTray', v)}
            />
            {isWindows ? (
                <ToggleRow
                    label="Global Media Keys"
                    description="Control playback with your keyboard's media keys even when Nebula is in the background."
                    checked={loaded ? values.mediaKeysEnabled ?? true : true}
                    onChange={(v) => setValue('mediaKeysEnabled', v)}
                />
            ) : (
                <StaticRow
                    label="Now Playing"
                    description="Media keys and Control Center are handled by macOS while music is playing."
                />
            )}
            {isWindows && (
                <ToggleRow
                    label="Taskbar Progress"
                    description="Show playback progress in the Windows taskbar."
                    checked={loaded ? values.taskbarProgressEnabled ?? true : true}
                    onChange={(v) => setValue('taskbarProgressEnabled', v)}
                />
            )}
        </SettingPanel>
    );
};

const CrashReportsPanel = () => {
    const { state, setEnabled } = useCrashReporting();
    const [saving, setSaving] = useState(false);

    if (!state?.available) return null;

    const change = async (enabled: boolean) => {
        setSaving(true);
        try {
            await setEnabled(enabled);
        } catch (error) {
            console.warn('[nebula] failed to save crash report preference', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingPanel icon={ShieldCheck} title="Crash Reports" description="Anonymous and off unless you turn it on.">
            <ToggleRow
                label="Share anonymous crash reports"
                description="When Nebula crashes, send error details that help fix the problem. Turning this off also deletes your install ID."
                checked={state.consent === 'enabled'}
                disabled={saving}
                onChange={(v) => void change(v)}
            />
            <div className="nebula-setting-block">
                <CrashReportsDisclosure />
            </div>
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
    const currentVersion = updateState?.currentVersion ?? platform.info.appVersion;
    const action = updateState
        ? getUpdateAction(updateState)
        : { kind: 'none' as const, label: 'Loading update status' };

    const hasUpdate = phase === 'available' || phase === 'downloaded';
    const badgeLabel = hasUpdate ? 'Available' : phase === 'not-available' ? 'Up to Date'
        : phase === 'idle' ? 'Not Checked' : phase === 'error' ? 'Check Failed'
        : phase === 'checking' ? 'Checking' : 'Downloading';
    const badgeClass = hasUpdate ? 'bg-red-700 text-white'
        : phase === 'not-available' ? 'bg-green-700 text-white'
        : phase === 'error' ? 'bg-red-700 text-white'
        : 'bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-white/70';

    return (
        <SettingPanel icon={Download} title="Updates">
            <SettingRow
                label={(
                    <span className="nebula-setting-title-line">
                        {currentVersion ? `Nebula ${currentVersion}` : 'Nebula'}
                        <span role="status" data-nebula-update-status={phase} className={`nebula-setting-badge ${badgeClass}`}>
                            {badgeLabel}
                        </span>
                    </span>
                )}
                description={(
                    <>
                        {hasUpdate && updateState?.newVersion && <span className="block">Version {updateState.newVersion} available</span>}
                        {updateState?.installMode === 'manual'
                            ? 'Unsigned macOS builds download updates from GitHub for manual installation.'
                            : updateState?.message ?? 'Updates are checked against GitHub Releases.'}
                        {updateState?.installMode === 'automatic' && phase === 'downloading' && (
                            <span className="nebula-setting-progress">
                                <span style={{ width: `${updateState?.progress ?? 0}%` }} />
                            </span>
                        )}
                    </>
                )}
            >
                <button
                    type="button"
                    onClick={() => {
                        if (action.kind === 'check') void platform.updater.check();
                        if (action.kind === 'download') void platform.updater.openDownloadPage();
                        if (action.kind === 'install') void platform.updater.installAndRestart();
                    }}
                    disabled={action.kind === 'none'}
                    className="nebula-control-button"
                    data-variant="primary"
                >
                    {action.kind === 'download' || action.kind === 'install' ? (
                        <Download aria-hidden="true" />
                    ) : (
                        <RefreshCw aria-hidden="true" className={busy ? 'animate-spin' : ''} />
                    )}
                    {action.label}
                </button>
            </SettingRow>
            <OptionRow
                label="Update channel"
                description="Beta delivers pre-release builds from the beta channel."
                options={[{ value: 'stable', label: 'Stable' }, { value: 'beta', label: 'Beta' }]}
                value={channel}
                onChange={changeChannel}
                disabled={!enabled}
            />
        </SettingPanel>
    );
};

export const SettingsView: React.FC = () => {
    const platform = usePlatform();
    const { settings, updateSettings, connectToSubsonic, isDemoMode, credentials, visualizerMode, setVisualizerMode, disconnect } = useStore();
    const { mode, setTheme } = useTheme();
    const activePreset = getThemePreset(settings.theme.preset);
    const streamDeckBridge = useStreamDeckBridge();

    const [url, setUrl] = useState(credentials?.serverUrl || '');
    const [user, setUser] = useState(credentials?.username || '');
    const [pass, setPass] = useState('');
    const [authMode, setAuthMode] = useState<'password' | 'apiKey'>(credentials?.authType === 'apiKey' ? 'apiKey' : 'password');
    const [connStatus, setConnStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [isInsecure, setIsInsecure] = useState(false);
    const httpSetting = useInsecureHttpSetting();
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [autoEqQuery, setAutoEqQuery] = useState('');
    const [autoEqResults, setAutoEqResults] = useState<AutoEqIndexEntry[]>([]);
    const [autoEqStatus, setAutoEqStatus] = useState<'idle' | 'loading' | 'applying' | 'error'>('idle');
    const [autoEqError, setAutoEqError] = useState('');
    const [autoEqLastFetchedAt, setAutoEqLastFetchedAt] = useState<number | null>(() => settings.eq.autoEqIndexFetchedAt || getCachedAutoEqIndexInfo()?.fetchedAt || null);
    const [pairingCode, setPairingCode] = useState('');
    const [pairingError, setPairingError] = useState('');
    const { viewData } = useStore();
    const djAvailable = isLocalDjPlatform(platform?.info);
    const desktopAvailable = platform?.info.kind === 'desktop';
    const settingsJumps = SETTINGS_JUMPS.filter(([id]) =>
        (id !== 'settings-ai-dj' || djAvailable) &&
        (id !== 'settings-desktop-integration' || desktopAvailable));
    const [activeSettingsJump, setActiveSettingsJump] = useState<string>(djAvailable && viewData === 'settings-ai-dj' ? 'settings-ai-dj' : SETTINGS_JUMPS[0][0]);
    useEffect(() => {
        if (djAvailable && viewData === 'settings-ai-dj') setActiveSettingsJump('settings-ai-dj');
        else setActiveSettingsJump(current =>
            (!djAvailable && current === 'settings-ai-dj') ||
            (!desktopAvailable && current === 'settings-desktop-integration') ? SETTINGS_JUMPS[0][0] : current);
    }, [djAvailable, desktopAvailable, viewData]);

    useEffect(() => {
        setIsInsecure(isInsecureHttpUrl(url));
    }, [url]);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!httpSetting.canConnect(url)) return;
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

    const jumpToSetting = (panelId: string) => {
        setActiveSettingsJump(panelId);
        setEditingKey(null);
        document.querySelector('[data-nebula-view="settings"]')?.scrollTo({ top: 0 });
    };

    return (
        <div data-nebula-view="settings" className="h-full overflow-y-auto bg-neutral-50 text-neutral-900 custom-scrollbar dark:bg-neutral-950 dark:text-white">
            <div data-nebula-settings-canvas>
                <header data-nebula-settings-header>
                    <div data-nebula-settings-intro>
                        <h1 className="nebula-page-title">Settings</h1>
                    </div>
                </header>

                <nav data-nebula-settings-jumps className="nebula-segmented" role="tablist" aria-label="Settings sections">
                    {settingsJumps.map(([panelId, label]) => (
                        <button
                            key={panelId}
                            type="button"
                            role="tab"
                            id={panelId + '-tab'}
                            aria-selected={activeSettingsJump === panelId}
                            aria-controls="settings-options"
                            tabIndex={activeSettingsJump === panelId ? 0 : -1}
                            onKeyDown={event => {
                                const index = settingsJumps.findIndex(([id]) => id === panelId);
                                const next = event.key === 'ArrowRight' ? (index + 1) % settingsJumps.length
                                    : event.key === 'ArrowLeft' ? (index + settingsJumps.length - 1) % settingsJumps.length
                                    : event.key === 'Home' ? 0 : event.key === 'End' ? settingsJumps.length - 1 : -1;
                                if (next < 0) return;
                                event.preventDefault();
                                jumpToSetting(settingsJumps[next][0]);
                                document.getElementById(settingsJumps[next][0] + '-tab')?.focus();
                            }}
                            aria-current={activeSettingsJump === panelId ? 'true' : undefined}
                            onClick={() => jumpToSetting(panelId)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                <div data-nebula-settings-stack id="settings-options" role="tabpanel" aria-labelledby={activeSettingsJump + '-tab'}>
                        {activeSettingsJump === 'settings-server-connection' && (<SettingPanel icon={Server} title="Server Connection" description="Subsonic-compatible server credentials are stored locally.">
                            <form onSubmit={handleConnect} className="nebula-setting-group">
                                <OptionRow
                                    label="Sign in with"
                                    options={[{ value: 'password', label: 'Password' }, { value: 'apiKey', label: 'API Key' }]}
                                    value={authMode}
                                    onChange={mode => {
                                        setAuthMode(mode as 'password' | 'apiKey');
                                        setPass('');
                                        setConnStatus('idle');
                                    }}
                                />
                                <div className="nebula-setting-block">
                                    <div className="nebula-setting-fields">
                                        <div className="nebula-setting-field-wide">
                                            <label htmlFor="settings-server-url" className="nebula-setting-field-label">Server URL</label>
                                            <input
                                                id="settings-server-url"
                                                type="text"
                                                value={url}
                                                onChange={e => setUrl(e.target.value)}
                                                placeholder="https://music.example.com"
                                                data-warning={isInsecure ? 'true' : undefined}
                                                className={inputClass}
                                            />
                                            {isInsecure && (
                                                <p className="nebula-setting-hint" data-tone="warning">
                                                    <ShieldAlert aria-hidden="true" />
                                                    HTTPS is recommended for remote servers.
                                                </p>
                                            )}
                                        </div>
                                        {authMode === 'password' && <div>
                                            <label htmlFor="settings-username" className="nebula-setting-field-label">Username</label>
                                            <input
                                                id="settings-username"
                                                type="text"
                                                value={user}
                                                onChange={e => setUser(e.target.value)}
                                                placeholder="admin"
                                                className={inputClass}
                                            />
                                        </div>}
                                        <div>
                                            <label htmlFor="settings-password" className="nebula-setting-field-label">{authMode === 'apiKey' ? 'API Key' : 'Password'}</label>
                                            <input
                                                id="settings-password"
                                                type="password"
                                                value={pass}
                                                onChange={e => setPass(e.target.value)}
                                                placeholder={authMode === 'apiKey' ? 'API key' : 'Password'}
                                                className={inputClass}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="nebula-setting-block">
                                    <InsecureHttpSetting setting={httpSetting} />
                                    <div className="nebula-setting-actions">
                                        <span className="nebula-setting-actions-status" aria-live="polite">
                                            {connStatus === 'success' && (
                                                <span className="nebula-setting-hint" data-tone="success">
                                                    <CheckCircle aria-hidden="true" />
                                                    Connected successfully
                                                </span>
                                            )}
                                            {connStatus === 'error' && (
                                                <span className="nebula-setting-hint" data-tone="error">
                                                    <AlertCircle aria-hidden="true" />
                                                    Connection failed
                                                </span>
                                            )}
                                            {isDemoMode && connStatus === 'idle' && (
                                                <span className="nebula-setting-hint">Currently in Demo Mode</span>
                                            )}
                                        </span>
                                        {/* Demo mode has no server to disconnect, but still needs a way back to sign-in. */}
                                        {isDemoMode && (
                                            <button type="button" onClick={disconnect} className="nebula-control-button" data-variant="quiet">
                                                <LogOut aria-hidden="true" />
                                                Exit Demo Mode
                                            </button>
                                        )}
                                        {credentials && !isDemoMode && (
                                            <button
                                                type="button"
                                                onClick={disconnect}
                                                className="nebula-control-button"
                                                data-variant="danger"
                                            >
                                                <LogOut aria-hidden="true" />
                                                Disconnect Server
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={connStatus === 'loading' || !httpSetting.canConnect(url)}
                                            className="nebula-control-button"
                                            data-variant="primary"
                                        >
                                            {connStatus === 'loading' ? 'Connecting...' : 'Save & Connect'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-stream-deck' && (<SettingPanel icon={Cable} title="Stream Deck" description="Control this browser tab from the Nebula Music Stream Deck plugin.">
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
                            <SettingRow
                                label="Connection status"
                                description={(
                                    <>
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
                                        {streamDeckBridge.status.endpoint && (
                                            <span className="nebula-setting-endpoint">{streamDeckBridge.status.endpoint}</span>
                                        )}
                                    </>
                                )}
                            >
                                <span className={`nebula-setting-badge ${
                                    streamDeckBridge.status.state === 'connected'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                        : streamDeckBridge.status.state === 'disabled'
                                            ? 'bg-neutral-200 text-neutral-600 dark:bg-white/10 dark:text-white/60'
                                            : streamDeckBridge.status.state === 'protocol-mismatch' || streamDeckBridge.status.state === 'error'
                                                ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                }`}>
                                    {sentenceCase(streamDeckBridge.status.state.replace('-', ' '))}
                                </span>
                            </SettingRow>
                            <SettingRow
                                label="Local port"
                                labelFor="stream-deck-port"
                                description="Use the same port in the plugin. Disable the bridge before changing it."
                                controlWidth="sm"
                            >
                                <input
                                    id="stream-deck-port"
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
                                    className={`${inputClass} nebula-time`}
                                />
                            </SettingRow>
                            <form
                                className="nebula-setting-row"
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
                                <span className="nebula-setting-copy">
                                    <label htmlFor="stream-deck-pairing-code" className="nebula-setting-label">Pairing code</label>
                                    {pairingError && <span className="nebula-setting-hint" data-tone="error">{pairingError}</span>}
                                </span>
                                <span className="nebula-setting-control">
                                    <input
                                        id="stream-deck-pairing-code"
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        value={pairingCode}
                                        onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        aria-label="Six-digit Stream Deck pairing code"
                                        className={`${inputClass} nebula-time nebula-setting-code-input`}
                                    />
                                    <button
                                        type="submit"
                                        disabled={pairingCode.length !== 6 || !settings.streamDeck?.enabled}
                                        className="nebula-control-button"
                                        data-variant="primary"
                                    >
                                        Pair
                                    </button>
                                </span>
                            </form>
                            <div className="nebula-setting-block">
                                <div className="nebula-setting-actions">
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
                                        className="nebula-control-button"
                                        data-variant="danger"
                                    >
                                        <Unplug aria-hidden="true" />
                                        Revoke pairing
                                    </button>
                                    <button
                                        type="button"
                                        onClick={streamDeckBridge.reconnect}
                                        disabled={!settings.streamDeck?.enabled}
                                        className="nebula-control-button"
                                    >
                                        <RefreshCw aria-hidden="true" />
                                        Reconnect
                                    </button>
                                </div>
                            </div>
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-equalizer' && (<SettingPanel icon={Sliders} title="Equalizer" description="Shape playback with presets or individual frequency bands.">
                            <ToggleRow
                                label="Enable Equalizer"
                                checked={settings.eq.enabled}
                                onChange={(v) => updateSettings({ eq: { ...settings.eq, enabled: v } })}
                            />
                            <SettingRow label="Preset" controlWidth="md">
                                <CustomDropdown
                                    ariaLabel="Preset"
                                    clearable={false}
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
                                />
                            </SettingRow>
                            <div className="nebula-setting-block">
                                <div className={`transition-all duration-500 ${settings.eq.enabled ? 'opacity-100' : 'pointer-events-none opacity-40 grayscale'}`}>
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
                                                                    aria-label={`${label} equalizer gain`}
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

                                <div className="nebula-setting-subcard mt-5">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="nebula-setting-label">
                                                <span className="nebula-setting-title-line">
                                                    <Headphones className="h-4 w-4 text-primary" aria-hidden="true" />
                                                    AutoEq Headphone Calibration
                                                </span>
                                            </div>
                                            <p className="nebula-setting-desc">
                                                Search AutoEq fixed-band profiles and apply them to Nebula's 10-band EQ.
                                            </p>
                                            {settings.eq.autoEq && (
                                                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
                                                    <span className="font-bold">Based on AutoEq:</span>
                                                    <span className="min-w-0 truncate">{settings.eq.autoEq.name}</span>
                                                    <span className="text-neutral-600 dark:text-white/45">{settings.eq.autoEq.source}</span>
                                                    <span className="text-neutral-600 dark:text-white/45">
                                                        Preamp {getAutoEqPreampDb(settings.eq).toFixed(1)} dB{settings.eq.enabled ? ' · Applied' : ' · EQ bypassed'}
                                                    </span>
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
                                            className="nebula-control-button shrink-0"
                                        >
                                            <RefreshCw aria-hidden="true" className={autoEqStatus === 'loading' ? 'animate-spin' : ''} />
                                            Refresh
                                        </button>
                                    </div>

                                    <div className="mt-4">
                                        <label htmlFor="autoeq-search" className="nebula-setting-field-label">Headphone or earbud model</label>
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
                                            <input
                                                id="autoeq-search"
                                                type="search"
                                                value={autoEqQuery}
                                                onChange={(e) => setAutoEqQuery(e.target.value)}
                                                placeholder="Search Sony WH-1000XM5, HD 650, AirPods Pro..."
                                                data-icon="both"
                                                className={inputClass}
                                            />
                                            {(autoEqStatus === 'loading' || autoEqStatus === 'applying') && (
                                                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-neutral-500 dark:text-white/45">
                                            <span>Index cache: {autoEqLastFetchedLabel}</span>
                                            <span>AutoEq preamp applies with the EQ to music and radio, providing headroom for boosted bands. Clearing the profile removes its preamp and keeps your band settings.</span>
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
                                                        className="nebula-control-button shrink-0"
                                                    >
                                                        {autoEqStatus === 'applying' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Headphones aria-hidden="true" />}
                                                        Apply AutoEq
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-equalizer' && (<SettingPanel icon={Headphones} title="Playback">
                            <ToggleRow
                                label="Magic Crossfade"
                                description="Detects track endings and fades into the next song."
                                checked={settings.magicCrossfade}
                                onChange={(v) => updateSettings({ magicCrossfade: v })}
                            />
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-equalizer' && (<SettingPanel icon={Sliders} title="ReplayGain" description="Use loudness tags supplied by your music server to balance playback volume.">
                            <SettingRow
                                label="ReplayGain mode"
                                description="Track balances individual songs. Album preserves volume differences within an album. Missing tags use the other mode or the server fallback; untagged songs stay unchanged."
                                controlWidth="md"
                            >
                                {/* The trigger's accessible name matches the visible label. */}
                                <span id="replaygain-mode" data-value={settings.replayGain.mode}>
                                    <CustomDropdown
                                        ariaLabel="ReplayGain mode"
                                        clearable={false}
                                        value={settings.replayGain.mode}
                                        onChange={mode => updateSettings({ replayGain: { ...settings.replayGain, mode: mode as ReplayGainSettings['mode'] } })}
                                        options={[
                                            { value: 'off', label: 'Off' },
                                            { value: 'track', label: 'Track' },
                                            { value: 'album', label: 'Album' },
                                        ]}
                                    />
                                </span>
                            </SettingRow>
                            <SettingRow
                                label={<>ReplayGain preamp: <span className="nebula-time">{settings.replayGain.preampDb > 0 ? '+' : ''}{settings.replayGain.preampDb} dB</span></>}
                                labelFor="replaygain-preamp"
                                controlWidth="md"
                            >
                                <input id="replaygain-preamp" type="range" min="-12" max="12" step="0.5" className="nebula-setting-range"
                                    disabled={settings.replayGain.mode === 'off'} value={settings.replayGain.preampDb}
                                    onChange={event => updateSettings({ replayGain: { ...settings.replayGain, preampDb: Number(event.target.value) } })} />
                            </SettingRow>
                            <ToggleRow label="Prevent ReplayGain clipping" description="Limit gain using available peak tags. EQ boosts and overlapping fades can still raise the output level."
                                checked={settings.replayGain.preventClipping} disabled={settings.replayGain.mode === 'off'}
                                onChange={preventClipping => updateSettings({ replayGain: { ...settings.replayGain, preventClipping } })} />
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-appearance' && (<SettingPanel icon={Palette} title="Appearance">
                            <OptionRow
                                label="Theme Mode"
                                options={[
                                    { value: 'dark', label: 'Dark', icon: Moon },
                                    { value: 'light', label: 'Light', icon: Sun },
                                ]}
                                value={mode}
                                onChange={(v) => setTheme(v as 'light' | 'dark')}
                            />
                            <div className="nebula-appearance-block">
                                <span className="nebula-setting-copy">
                                    <span className="nebula-setting-label">Theme</span>
                                    <span className="nebula-setting-desc">{activePreset.description}</span>
                                </span>
                                <ThemePresetPicker
                                    value={activePreset.id}
                                    mode={mode}
                                    accents={[settings.theme.primaryColor, settings.theme.secondaryColor]}
                                    onChange={(preset) => updateSettings({ theme: { ...settings.theme, preset } })}
                                />
                            </div>
                            <SettingRow
                                label="Font"
                                description={activePreset.kind === 'ascii'
                                    ? `${activePreset.name} uses JetBrains Mono while it is active. Your choice applies again with any other theme.`
                                    : 'Typeface for the whole interface.'}
                                controlWidth="md"
                            >
                                <FontSelect
                                    value={getFontOption(settings.theme.font).id}
                                    onChange={(font) => updateSettings({ theme: { ...settings.theme, font } })}
                                />
                            </SettingRow>
                            {activePreset.id === 'default' ? (<>
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
                            </>) : (
                                <SettingRow
                                    label="Custom colors"
                                    description={`${activePreset.name} sets its own colors. Your primary and secondary colors are kept and return with the Nebula theme.`}
                                >
                                    <button
                                        type="button"
                                        className="nebula-control-button"
                                        onClick={() => updateSettings({ theme: { ...settings.theme, preset: 'default' } })}
                                    >
                                        Use Nebula theme
                                    </button>
                                </SettingRow>
                            )}
                            <div className="nebula-appearance-block">
                                <span className="nebula-setting-copy">
                                    <span className="nebula-setting-label">Animated background</span>
                                    <span className="nebula-setting-desc">A subtle backdrop behind the content area. Pauses when the window is hidden and stays still with reduced motion.</span>
                                </span>
                                <BackgroundPicker
                                    value={getBackgroundOption(settings.theme.background).id}
                                    onChange={(background) => updateSettings({ theme: { ...settings.theme, background } })}
                                />
                            </div>
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-appearance' && (<SettingPanel icon={Monitor} title="Player Display">
                            <OptionRow
                                label="Desktop Playback Layout"
                                options={[
                                    { value: 'sidebar', label: 'Bottom Bar' },
                                    { value: 'floating', label: 'Floating Bar' },
                                ]}
                                value={settings.miniPlayerMode}
                                onChange={(v) => updateSettings({ miniPlayerMode: v as 'floating' | 'sidebar' })}
                            />

                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-appearance' && (<SettingPanel icon={Activity} title="Visualizer Style">
                            <OptionRow
                                label="Style"
                                options={VISUALIZER_MODES.map(visualizer => ({ value: visualizer, label: sentenceCase(visualizer) }))}
                                value={visualizerMode}
                                onChange={(v) => setVisualizerMode(v as VisualizerMode)}
                            />
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-appearance' && (<SettingPanel icon={Layout} title="Navigation Items">
                            <ToggleRow label="Show Home" checked={settings.sidebar.showHome} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showHome: v } })} />
                            <ToggleRow label="Show Browse" checked={settings.sidebar.showBrowse} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showBrowse: v } })} />
                            <ToggleRow label="Show Internet Radio" checked={settings.sidebar.showRadio} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showRadio: v } })} />
                            <ToggleRow label="Show Artists" checked={settings.sidebar.showArtists} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showArtists: v } })} />
                            <ToggleRow label="Show Albums" checked={settings.sidebar.showAlbums} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showAlbums: v } })} />
                            <ToggleRow label="Show Songs" checked={settings.sidebar.showSongs} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showSongs: v } })} />
                            <ToggleRow label="Show Playlists" checked={settings.sidebar.showPlaylists} onChange={(v) => updateSettings({ sidebar: { ...settings.sidebar, showPlaylists: v } })} />
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-appearance' && (<SettingPanel icon={Keyboard} title="Keyboard Shortcuts">
                            <ShortcutRow id="playPause" label="Play / Pause" value={settings.shortcuts.playPause} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="prev" label="Previous Song" value={settings.shortcuts.prev} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="next" label="Next Song" value={settings.shortcuts.next} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="loop" label="Toggle Loop" value={settings.shortcuts.loop} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="zen" label="Toggle Zen Mode" value={settings.shortcuts.zen} editingKey={editingKey} setEditingKey={setEditingKey} />
                            <ShortcutRow id="visualizer" label="Cycle Visualizer" value={settings.shortcuts.visualizer} editingKey={editingKey} setEditingKey={setEditingKey} />
                        </SettingPanel>)}

                        {activeSettingsJump === 'settings-desktop-integration' && <DesktopSettingsPanel />}
                        {activeSettingsJump === 'settings-desktop-integration' && <DesktopUpdatesPanel />}
                        {activeSettingsJump === 'settings-desktop-integration' && <CrashReportsPanel />}
                        {djAvailable && activeSettingsJump === 'settings-ai-dj' && <AiDjSettings />}
                </div>
            </div>
        </div>
    );
};
