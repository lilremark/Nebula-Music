import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamDeckBridge, type StreamDeckBridgeStatus } from './streamDeckBridge';
import { STREAM_DECK_PROTOCOL, type StreamDeckSnapshot } from './streamDeckProtocol';

class FakeSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  receive(value: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }));
  }

  close(): void {
    this.readyState = FakeSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
}

const snapshot: StreamDeckSnapshot = {
  sessionId: 'session-1',
  clientId: 'client-1',
  origin: 'https://music.example.com',
  nebulaVersion: '2.1.3',
  visible: true,
  lastActiveAt: 1,
  connectedAt: 2,
  playing: false,
  positionSeconds: 0,
  durationSeconds: 100,
  volume: 1,
  muted: false,
  track: null,
  playlists: [],
};

describe('StreamDeckBridge', () => {
  beforeEach(() => {
    Object.assign(globalThis, {
      window: globalThis,
      WebSocket: FakeSocket,
    });
  });

  it('authenticates a returning browser and sends a requested snapshot', async () => {
    const socket = new FakeSocket();
    const statuses: StreamDeckBridgeStatus[] = [];
    const bridge = new StreamDeckBridge({
      sessionId: snapshot.sessionId,
      clientId: snapshot.clientId,
      origin: snapshot.origin,
      nebulaVersion: snapshot.nebulaVersion,
      tokenStore: {
        get: vi.fn(async () => 'stored-token-that-is-at-least-32-bytes'),
        set: vi.fn(),
        clear: vi.fn(),
      },
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: (status) => statuses.push(status),
      onCommand: vi.fn(),
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('connecting'));
    socket.open();
    expect(socket.sent.map((value) => JSON.parse(value)).map((message) => message.type)).toEqual([
      'hello',
      'authenticate',
    ]);
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('connected'));
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'requestSnapshot' });
    expect(socket.sent.map((value) => JSON.parse(value)).at(-1)?.type).toBe('state');
    bridge.destroy();
  });

  it('pairs a new browser, persists the token, and executes authenticated commands', async () => {
    const socket = new FakeSocket();
    const setToken = vi.fn();
    const onCommand = vi.fn(async () => undefined);
    const bridge = new StreamDeckBridge({
      sessionId: snapshot.sessionId,
      clientId: snapshot.clientId,
      origin: snapshot.origin,
      nebulaVersion: snapshot.nebulaVersion,
      tokenStore: {
        get: vi.fn(async () => null),
        set: setToken,
        clear: vi.fn(),
      },
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: vi.fn(),
      onCommand,
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await vi.waitFor(() => expect(socket.readyState).toBe(FakeSocket.CONNECTING));
    socket.open();
    await bridge.pair('123456');
    expect(socket.sent.map((value) => JSON.parse(value)).at(-1)).toMatchObject({ type: 'pair', code: '123456' });

    const token = 'new-token-that-is-definitely-longer-than-32-bytes';
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true, token });
    await vi.waitFor(() => expect(setToken).toHaveBeenCalledWith(token));
    expect(socket.sent.map((value) => JSON.parse(value)).at(-1)).toMatchObject({
      type: 'authenticate',
      clientId: snapshot.clientId,
      token,
    });
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'requestSnapshot' });
    expect(socket.sent.map((value) => JSON.parse(value)).at(-1)?.type).toBe('state');
    socket.receive({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'command',
      requestId: 'next-1',
      command: { name: 'next' },
    });
    await vi.waitFor(() => expect(onCommand).toHaveBeenCalledWith({ name: 'next' }));
    expect(socket.sent.map((value) => JSON.parse(value))).toContainEqual(
      expect.objectContaining({ type: 'commandResult', requestId: 'next-1', ok: true }),
    );
    bridge.destroy();
  });

  it('rejects commands before pairing', async () => {
    const socket = new FakeSocket();
    const onCommand = vi.fn();
    const bridge = new StreamDeckBridge({
      sessionId: snapshot.sessionId,
      clientId: snapshot.clientId,
      origin: snapshot.origin,
      nebulaVersion: snapshot.nebulaVersion,
      tokenStore: { get: vi.fn(async () => null), set: vi.fn(), clear: vi.fn() },
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: vi.fn(),
      onCommand,
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await Promise.resolve();
    socket.open();
    socket.receive({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'command',
      requestId: 'unauthorized-1',
      command: { name: 'next' },
    });
    await vi.waitFor(() =>
      expect(socket.sent.map((value) => JSON.parse(value))).toContainEqual(
        expect.objectContaining({
          type: 'commandResult',
          requestId: 'unauthorized-1',
          ok: false,
          error: expect.objectContaining({ code: 'unauthorized' }),
        }),
      ),
    );
    expect(onCommand).not.toHaveBeenCalled();
    bridge.destroy();
  });
});
