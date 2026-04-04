import React, { useMemo, useState } from 'react';
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
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

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

  const resetError = () => {
    if (status === 'error') setStatus('idle');
  };

  return (
    <div className="fixed inset-0 overflow-auto bg-neutral-100 text-neutral-900 dark:bg-[#0a0a0a] dark:text-white">
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

      <div className="relative flex min-h-screen items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <Card
            elevation={4}
            hover={false}
            padding="lg"
            className="border-neutral-200/70 bg-white/90 dark:border-white/10 dark:bg-neutral-950/82"
          >
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.18)] dark:bg-white">
                <svg viewBox="0 0 24 24" className="h-7 w-7 stroke-current" fill="none" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M4 10v4" className="opacity-40" />
                  <path d="M8 7v10" className="opacity-60" />
                  <path d="M12 3v18" />
                  <path d="M16 7v10" className="opacity-60" />
                  <path d="M20 10v4" className="opacity-40" />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500 dark:text-white/40">Nebula Music</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Sign in to Nebula</h1>
              <p className="mt-2 text-sm text-neutral-600 dark:text-white/55">
                Connect your Subsonic-compatible server and start listening.
              </p>
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
                  onChange={(e) => {
                    setUrl(e.target.value);
                    resetError();
                  }}
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
                  onChange={(e) => {
                    setUser(e.target.value);
                    resetError();
                  }}
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
                  onChange={(e) => {
                    setPass(e.target.value);
                    resetError();
                  }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  icon={<LockKeyhole className="h-4 w-4" />}
                  className="py-3"
                />
              </div>

              {isInsecure && (
                <div className="flex items-start gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-3 text-xs text-yellow-700 dark:text-yellow-400">
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
          </Card>

          <Card
            elevation={2}
            hover={false}
            padding="md"
            className="mt-4 border-neutral-200/70 bg-white/75 dark:border-white/10 dark:bg-neutral-950/60"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">
              About Nebula
            </p>
            <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-white/60">
              Nebula is a Subsonic-compatible music player built around focused playback, waveform progress, adaptive color,
              and a cleaner listening-first interface.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
