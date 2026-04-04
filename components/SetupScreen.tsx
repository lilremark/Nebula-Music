import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Disc3,
  ShieldAlert,
  Sparkles,
  Server,
  User,
  LockKeyhole,
  Radio,
} from 'lucide-react';
import { useStore } from '../context/Store';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

const nebulaFeatures = [
  { icon: Disc3, label: 'Full library playback' },
  { icon: Radio, label: 'Waveform + visualizer views' },
  { icon: Sparkles, label: 'Adaptive, album-driven color' },
];

export const SetupScreen: React.FC = () => {
  const { connectToSubsonic, enableDemoMode } = useStore();
  const [url, setUrl] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const isInsecure = useMemo(() => {
    return url && !url.startsWith('https://') && url.length > 7;
  }, [url]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    const success = await connectToSubsonic(url, user, pass);
    if (!success) {
      setStatus('error');
      return;
    }
    setStatus('idle');
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (status === 'error') setStatus('idle');
  };

  const handleUserChange = (value: string) => {
    setUser(value);
    if (status === 'error') setStatus('idle');
  };

  const handlePassChange = (value: string) => {
    setPass(value);
    if (status === 'error') setStatus('idle');
  };

  return (
    <div className="fixed inset-0 overflow-auto bg-neutral-100 text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }} />
      <div
        className="absolute top-[-12rem] left-[8%] h-[28rem] w-[28rem] rounded-full blur-[180px] opacity-[0.10] pointer-events-none"
        style={{ backgroundColor: 'rgb(var(--color-primary))' }}
      />
      <div
        className="absolute bottom-[-10rem] right-[6%] h-[24rem] w-[24rem] rounded-full blur-[170px] opacity-[0.10] pointer-events-none"
        style={{ backgroundColor: 'rgb(var(--color-secondary))' }}
      />

      <div className="relative min-h-full px-5 py-8 md:px-8 md:py-10 lg:px-12">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
          <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
            <Card
              elevation={3}
              hover={false}
              padding="lg"
              className="relative overflow-hidden border-neutral-200/70 bg-white/75 dark:border-white/10 dark:bg-neutral-950/60"
            >
              <div
                className="absolute inset-x-0 top-0 h-28 opacity-80"
                style={{ background: 'linear-gradient(180deg, rgba(var(--color-primary),0.16) 0%, rgba(var(--color-secondary),0.04) 70%, transparent 100%)' }}
              />

              <div className="relative flex h-full flex-col justify-between gap-10">
                <div>
                  <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-white">
                      <svg viewBox="0 0 24 24" className="h-7 w-7 stroke-current" fill="none" strokeWidth="2.6" strokeLinecap="round">
                        <path d="M4 10v4" className="opacity-40" />
                        <path d="M8 7v10" className="opacity-60" />
                        <path d="M12 3v18" />
                        <path d="M16 7v10" className="opacity-60" />
                        <path d="M20 10v4" className="opacity-40" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500 dark:text-white/45">Nebula Music</p>
                      <h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
                        Connect your
                        <br />
                        music universe.
                      </h1>
                    </div>
                  </div>

                  <p className="max-w-xl text-sm leading-7 text-neutral-600 dark:text-white/60 md:text-base">
                    Sign in with your Subsonic-compatible server and drop straight into the same immersive playback UI,
                    queue controls, waveform views, and adaptive visuals used across the rest of the app.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {nebulaFeatures.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-neutral-200 bg-neutral-100/80 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                    >
                      <Icon className="mb-3 h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-neutral-800 dark:text-white/80">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-100/80 p-4 dark:border-white/10 dark:bg-black/20">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">Security</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-white/60">
                    Nebula stores a token and salt generated from your password. Your raw password is not kept after sign-in.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              elevation={4}
              hover={false}
              padding="lg"
              className="border-neutral-200/70 bg-white/90 dark:border-white/10 dark:bg-neutral-950/82"
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">Server Access</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">Sign in to Nebula</h2>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-white/55">
                    Use the same server connection details you use for your Subsonic setup.
                  </p>
                </div>
                <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-700 dark:flex dark:bg-white/5 dark:text-white/65">
                  <Server className="h-5 w-5" />
                </div>
              </div>

              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                    Server URL
                  </label>
                  <Input
                    required
                    type="text"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://music.yourserver.com"
                    autoComplete="url"
                    icon={<Server className="h-4 w-4" />}
                    className={`py-3 ${isInsecure ? 'border-yellow-500/40 focus:border-yellow-500/60 focus:ring-yellow-500/20' : ''}`}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                    Username
                  </label>
                  <Input
                    required
                    type="text"
                    value={user}
                    onChange={(e) => handleUserChange(e.target.value)}
                    placeholder="Username"
                    autoComplete="username"
                    icon={<User className="h-4 w-4" />}
                    className="py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
                    Password
                  </label>
                  <Input
                    required
                    type="password"
                    value={pass}
                    onChange={(e) => handlePassChange(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    icon={<LockKeyhole className="h-4 w-4" />}
                    className="py-3"
                  />
                </div>

                {isInsecure && (
                  <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-3 text-xs text-yellow-700 dark:text-yellow-400">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>HTTP connections work, but HTTPS is strongly recommended for secure server access.</span>
                  </div>
                )}

                {status === 'error' && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Connection failed. Check the URL, username, and password, then try again.</span>
                  </div>
                )}

                <div className="space-y-3 pt-2">
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

              <div className="mt-8 border-t border-neutral-200 pt-5 text-xs text-neutral-500 dark:border-white/10 dark:text-white/45">
                Subsonic-compatible client. Connect, browse, and play with the same UI system used throughout Nebula.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
