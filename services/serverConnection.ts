export type ServerConnectionStatus = 'connected' | 'disconnected';

export const monitorServerConnection = ({ probe, update, events, isOnline }: {
  probe: () => Promise<boolean>;
  update: (status: ServerConnectionStatus, checking: boolean) => void;
  events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  isOnline: () => boolean;
}) => {
  let stopped = false;
  let checking = false;
  let generation = 0;
  let status: ServerConnectionStatus = 'connected';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const retry = async () => {
    if (stopped || checking) return;
    clearTimeout(timer);
    if (!isOnline()) {
      status = 'disconnected';
      update(status, false);
      timer = setTimeout(() => { void retry(); }, 15_000);
      return;
    }
    checking = true;
    const current = ++generation;
    update(status, true);
    const reachable = await Promise.race([
      Promise.resolve().then(probe).catch(() => false),
      new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), 8_000); }),
    ]);
    if (stopped || current !== generation) return;
    clearTimeout(timeout);
    checking = false;
    status = reachable ? 'connected' : 'disconnected';
    update(status, false);
    timer = setTimeout(() => { void retry(); }, 15_000);
  };

  const offline = () => {
    generation += 1;
    clearTimeout(timer);
    clearTimeout(timeout);
    checking = false;
    status = 'disconnected';
    update(status, false);
    timer = setTimeout(() => { void retry(); }, 15_000);
  };
  const online = () => { void retry(); };
  events.addEventListener('offline', offline);
  events.addEventListener('online', online);
  events.addEventListener('focus', online);
  void retry();
  return {
    retry,
    stop: () => {
      stopped = true;
      generation += 1;
      clearTimeout(timer);
      clearTimeout(timeout);
      events.removeEventListener('offline', offline);
      events.removeEventListener('online', online);
      events.removeEventListener('focus', online);
    },
  };
};
