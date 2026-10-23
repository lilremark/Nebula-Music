import { afterEach, describe, expect, it, vi } from 'vitest';
import { monitorServerConnection } from './serverConnection';

afterEach(() => vi.useRealTimers());

describe('server connection monitor', () => {
  it('detects server loss while the browser remains online and recovers on retry', async () => {
    vi.useFakeTimers();
    const events = new EventTarget();
    const probe = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValue(true);
    const update = vi.fn();
    const monitor = monitorServerConnection({ probe, update, events, isOnline: () => true });
    await vi.advanceTimersByTimeAsync(0);
    expect(update).toHaveBeenLastCalledWith('connected', false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(update).toHaveBeenLastCalledWith('disconnected', false);
    await monitor.retry();
    expect(update).toHaveBeenLastCalledWith('connected', false);
    monitor.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(probe).toHaveBeenCalledTimes(3);
  });

  it('bounds hung checks and ignores late results after logout or a server switch', async () => {
    vi.useFakeTimers();
    let resolve!: (value: boolean) => void;
    const probe = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    const update = vi.fn();
    const monitor = monitorServerConnection({ probe, update, events: new EventTarget(), isOnline: () => true });
    await vi.advanceTimersByTimeAsync(8_000);
    expect(update).toHaveBeenLastCalledWith('disconnected', false);
    monitor.stop();
    update.mockClear();
    resolve(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('shows offline immediately, preserves the warning while checking, and probes on reconnect', async () => {
    vi.useFakeTimers();
    const events = new EventTarget();
    let online = false;
    const update = vi.fn();
    const probe = vi.fn().mockResolvedValue(true);
    const monitor = monitorServerConnection({ probe, update, events, isOnline: () => online });
    expect(update).toHaveBeenLastCalledWith('disconnected', false);
    expect(probe).not.toHaveBeenCalled();
    online = true;
    events.dispatchEvent(new Event('online'));
    expect(update).toHaveBeenLastCalledWith('disconnected', true);
    await vi.advanceTimersByTimeAsync(0);
    expect(update).toHaveBeenLastCalledWith('connected', false);
    events.dispatchEvent(new Event('offline'));
    expect(update).toHaveBeenLastCalledWith('disconnected', false);
    monitor.stop();
  });
});
