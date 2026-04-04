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
  AudioWaveform,
  Music4,
} from 'lucide-react';
import { useStore } from '../context/Store';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

const equalizerBars = [
  'h-8',
  'h-14',
  'h-10',
  'h-16',
  'h-9',
  'h-12',
  'h-7',
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

              <div className="relative flex h-full flex-col justify-between gap-8">
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
                        Built for
                        <br />
                        focused listening.
                      </h1>
                    </div>
                  </div>

                  <p className="max-w-xl text-sm leading-7 text-neutral-600 dark:text-white/60 md:text-base">
                    Nebula is a Subsonic-compatible player designed around immersive playback, tactile controls, and
                    a visual language that reacts like a real music surface instead of a plain admin client.
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-100/80 p-5 dark:border-white/10 dark:bg-black/20">
                  <div
                    className="absolute inset-x-0 top-0 h-24 opacity-70"
                    style={{ background: 'linear-gradient(180deg, rgba(var(--color-primary),0.20) 0%, rgba(var(--color-secondary),0.08) 60%, transparent 100%)' }}
                  />
                  <div className="relative">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-white/40">Now Playing</p>
                        <p className="mt-1 text-lg font-bold tracking-tight text-neutral-900 dark:text-white">A screen that feels like music</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white/80 text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                        <Music4 className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-[1.5rem] border border-neutral-200 bg-white/85 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-neutral-950/70">
                        <div className="flex items-center gap-4">
                          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-primary/30 via-neutral-200 to-secondary/30 dark:from-primary/20 dark:via-neutral-900 dark:to-secondary/20">
                            <div className="absolute inset-3 rounded-full border border-black/10 dark:border-white/10" />
                            <div className="absolute h-20 w-20 rounded-full border border-black/10 dark:border-white/10" />
                            <div className="absolute h-16 w-16 rounded-full bg-neutral-950 shadow-[0_0_25px_rgba(0,0,0,0.35)]" />
                            <div className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-neutral-800 to-black text-white">
                              <Disc3 className="h-8 w-8 animate-spin" style={{ animationDuration: '5s' }} />
                            </div>
                            <div className="absolute h-3 w-3 rounded-full bg-white/90" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-white/35">Waveform Mode</p>
                            <h3 className="mt-2 truncate text-lg font-bold text-neutral-900 dark:text-white">Midnight Receiver</h3>
                            <p className="truncate text-sm text-neutral-600 dark:text-white/55">Nebula Session</p>

                            <div className="mt-4">
                              <div className="mb-2 flex items-end gap-1">
                                {equalizerBars.map((height, index) => (
                                  <div
                                    key={height + index}
                                    className={`w-1.5 rounded-full bg-neutral-300 dark:bg-white/15 ${height} animate-pulse`}
                                    style={{
                                      animationDuration: '1.2s',
                                      animationDelay: `${index * 120}ms`,
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="relative h-12 overflow-hidden rounded-xl">
                                <div className="absolute inset-x-0 bottom-1 flex items-end gap-[2px]">
                                  {Array.from({ length: 40 }, (_, index) => (
                                    <div
                                      key={index}
                                      className={`flex-1 rounded-full ${
                                        index < 23 ? 'bg-primary' : 'bg-neutral-300 dark:bg-white/15'
                                      }`}
                                      style={{ height: `${10 + ((index * 11) % 30)}px` }}
                                    />
                                  ))}
                                </div>
                                <div className="absolute inset-y-0 left-[57%] w-[2px] bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="rounded-[1.5rem] border border-neutral-200 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5">
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-white/35">Reactive UI</p>
                              <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-white/80">Album color, motion, waveform</p>
                            </div>
                            <AudioWaveform className="h-4 w-4 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <div className="h-2 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
                              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary to-secondary animate-pulse" />
                            </div>
                            <div className="h-2 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
                              <div className="h-full w-[42%] rounded-full bg-neutral-400/60 dark:bg-white/25" />
                            </div>
                            <div className="h-2 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
                              <div className="h-full w-[84%] rounded-full bg-gradient-to-r from-secondary/70 to-primary/60 animate-pulse" style={{ animationDelay: '220ms' }} />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-100/90 p-4 dark:border-white/10 dark:bg-neutral-950/60">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-white/35">What you get</p>
                          <div className="mt-3 space-y-3 text-sm text-neutral-700 dark:text-white/65">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-primary shadow-glow-sm" />
                              <span>Fast queue-first playback</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-secondary shadow-glow-sm" />
                              <span>Immersive full-screen player</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-primary shadow-glow-sm animate-pulse" />
                              <span>Waveform and visualizer-driven progress</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-white/55">
                    Sign in and you land in a player that behaves like a listening environment, not a utility panel.
                  </p>
                </div>
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

            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
