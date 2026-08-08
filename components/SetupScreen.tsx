import React, { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Server,
  User,
  LockKeyhole,
} from 'lucide-react';
import { useStore } from '../context/Store';
import { CoverFlow } from './CoverFlow';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { WindowControls } from './window/WindowControls';

const appRegion = (region: 'drag' | 'no-drag'): CSSProperties =>
  ({ WebkitAppRegion: region }) as CSSProperties;

export const SetupScreen: React.FC = () => {
  const { connectToSubsonic, enableDemoMode } = useStore();
  const [url, setUrl] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [authMode, setAuthMode] = useState<'password' | 'apiKey'>('password');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const isInsecure = useMemo(() => {
    return url && !url.startsWith('https://') && url.length > 7;
  }, [url]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    const success = await connectToSubsonic(url, user, pass, authMode);
    if (!success) {
      setStatus('error');
      return;
    }
    setStatus('idle');
  };

  const resetError = () => {
    if (status === 'error') setStatus('idle');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
      {/* Drag region so the frameless window can be moved from the sign-in screen */}
      <div className="absolute top-0 inset-x-0 h-10 z-30" style={appRegion('drag')} />

      {/* Window controls (Windows only) */}
      <div className="absolute top-2 right-4 z-40" style={appRegion('no-drag')}>
        <WindowControls />
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="absolute top-[-10rem] left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full blur-[170px] opacity-[0.10] pointer-events-none"
        style={{ backgroundColor: 'rgb(var(--color-primary))' }}
      />

      {/* Left: cover flow (hidden below lg) */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] lg:block">
        <CoverFlow />
      </div>

      {/* Right: sign-in form */}
      <div className="absolute inset-y-0 right-0 flex w-full items-center justify-center px-5 py-6 lg:w-[45%]">
        <div className="w-full max-w-sm">
          <Card
            elevation={4}
            hover={false}
            padding="md"
            className="border-neutral-200/70 bg-white/90 dark:border-white/10 dark:bg-neutral-950/82"
          >
            <div className="mb-3 text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-white">
                <svg viewBox="0 0 24 24" className="h-7 w-7 stroke-current" fill="none" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M4 10v4" className="opacity-40" />
                  <path d="M8 7v10" className="opacity-60" />
                  <path d="M12 3v18" />
                  <path d="M16 7v10" className="opacity-60" />
                  <path d="M20 10v4" className="opacity-40" />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500 dark:text-white/40">Nebula Music</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Sign in to Nebula</h1>
              <p className="mt-1 text-sm text-neutral-600 dark:text-white/55">
                Connect your Subsonic-compatible server and start listening.
              </p>
            </div>

            <form onSubmit={handleConnect} className="space-y-2">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-white/5">
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
                      resetError();
                    }}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition ${authMode === mode
                      ? 'bg-white text-neutral-950 shadow-xs dark:bg-white dark:text-black'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-white/50 dark:hover:text-white'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                  Server URL
                </label>
                <Input
                  required
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    resetError();
                  }}
                  placeholder="https://music.yourserver.com"
                  autoComplete="url"
                  icon={<Server className="h-4 w-4" />}
                  className={`py-2 ${isInsecure ? 'border-yellow-500/40 focus:border-yellow-500/60 focus:ring-yellow-500/20' : ''}`}
                />
              </div>

              {authMode === 'password' && <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                  Username
                </label>
                <Input
                  required
                  type="text"
                  value={user}
                  onChange={(e) => {
                    setUser(e.target.value);
                    resetError();
                  }}
                  placeholder="Username"
                  autoComplete="username"
                  icon={<User className="h-4 w-4" />}
                  className="py-2"
                />
              </div>}

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                  {authMode === 'apiKey' ? 'API Key' : 'Password'}
                </label>
                <Input
                  required
                  type="password"
                  value={pass}
                  onChange={(e) => {
                    setPass(e.target.value);
                    resetError();
                  }}
                  placeholder={authMode === 'apiKey' ? 'Enter API key' : 'Enter password'}
                  autoComplete={authMode === 'apiKey' ? 'off' : 'current-password'}
                  icon={<LockKeyhole className="h-4 w-4" />}
                  className="py-2"
                />
              </div>

              {isInsecure && (
                <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>HTTPS is recommended for secure server access.</span>
                </div>
              )}

              {status === 'error' && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Connection failed. Check your details and try again.</span>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  size="md"
                  loading={status === 'loading'}
                  icon={status === 'loading' ? undefined : <ArrowRight className="h-4 w-4" />}
                  className="w-full justify-center rounded-2xl"
                >
                  Connect Server
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={enableDemoMode}
                  className="w-full justify-center rounded-2xl"
                >
                  Try Demo Mode
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
