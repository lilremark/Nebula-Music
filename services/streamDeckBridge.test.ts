import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamDeckBridge, type StreamDeckBridgeStatus } from './streamDeckBridge';
import {
  STREAM_DECK_PROTOCOL,
  type StreamDeckCommand,
  type StreamDeckSnapshot,
} from './streamDeckProtocol';

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

const TOKEN = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';
const NONCE = 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8';
const PROOF = 'CnvJhNfU-cGHrqdx9AObUC4wGx5D-MsSXcLQCU_QUt8';
const messages = (socket: FakeSocket): Record<string, unknown>[] =>
  socket.sent.map((value) => JSON.parse(value));

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
        get: vi.fn(async () => TOKEN),
        set: vi.fn(),
        clear: vi.fn(),
      },
      createProof: vi.fn(async () => PROOF),
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: (status) => statuses.push(status),
      onCommand: vi.fn(),
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('connecting'));
    socket.open();
    expect(messages(socket).map((message) => message.type)).toEqual(['hello']);
    expect(messages(socket)[0]).toMatchObject({
      type: 'hello',
      capabilities: ['seekAbsolute', 'progressVolume'],
    });
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'authChallenge', nonce: NONCE });
    await vi.waitFor(() =>
      expect(messages(socket).at(-1)).toMatchObject({
        type: 'authenticate',
        clientId: snapshot.clientId,
        proof: PROOF,
      }),
    );
    expect(socket.sent.join('')).not.toContain(TOKEN);
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('connected'));
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'requestSnapshot' });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('state'));
    bridge.destroy();
  });

  it('pairs a new browser, persists the token, and executes authenticated commands', async () => {
    const socket = new FakeSocket();
    const order: string[] = [];
    const setToken = vi.fn(async () => {
      order.push('store-start');
      await Promise.resolve();
      order.push('store-finish');
    });
    const createProof = vi.fn(async () => {
      order.push('proof');
      return PROOF;
    });
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
      createProof,
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: vi.fn(),
      onCommand,
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await vi.waitFor(() => expect(socket.readyState).toBe(FakeSocket.CONNECTING));
    socket.open();
    await bridge.pair('123456');
    expect(messages(socket).at(-1)).toMatchObject({ type: 'pair', code: '123456' });

    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true, token: TOKEN });
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'authChallenge', nonce: NONCE });
    await vi.waitFor(() => expect(setToken).toHaveBeenCalledWith(TOKEN));
    await vi.waitFor(() => expect(createProof).toHaveBeenCalledWith(
      TOKEN,
      snapshot.clientId,
      snapshot.sessionId,
      NONCE,
    ));
    expect(order).toEqual(['store-start', 'store-finish', 'proof']);
    expect(messages(socket).at(-1)).toMatchObject({
      type: 'authenticate',
      clientId: snapshot.clientId,
      proof: PROOF,
    });
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'requestSnapshot' });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('state'));
    const commandMessageStart = socket.sent.length;
    socket.receive({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'command',
      requestId: 'next-1',
      command: { name: 'next' },
    });
    await vi.waitFor(() => expect(onCommand).toHaveBeenCalledWith({ name: 'next' }));
    expect(messages(socket)).toContainEqual(
      expect.objectContaining({ type: 'commandResult', requestId: 'next-1', ok: true }),
    );
    await vi.waitFor(() =>
      expect(messages(socket).slice(commandMessageStart).map((message) => message.type)).toContain(
        'progress',
      ),
    );
    expect(
      messages(socket).slice(commandMessageStart).filter((message) => message.type === 'state'),
    ).toHaveLength(0);
    expect(messages(socket).at(-1)).toMatchObject({
      type: 'progress',
      volume: snapshot.volume,
      muted: snapshot.muted,
    });
    bridge.destroy();
  });

  it('acknowledges frequent controls without resending playlist snapshots', async () => {
    const socket = new FakeSocket();
    const largeSnapshot: StreamDeckSnapshot = {
      ...snapshot,
      track: { id: 'track-1', title: 'Song', artist: 'Artist' },
      playlists: Array.from({ length: 1000 }, (_, index) => ({
        id: `playlist-${index}`,
        name: `Playlist ${index}`,
        trackCount: index,
      })),
    };
    const bridge = new StreamDeckBridge({
      sessionId: snapshot.sessionId,
      clientId: snapshot.clientId,
      origin: snapshot.origin,
      nebulaVersion: snapshot.nebulaVersion,
      tokenStore: { get: vi.fn(async () => TOKEN), set: vi.fn(), clear: vi.fn() },
      createProof: vi.fn(async () => PROOF),
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: vi.fn(),
      onCommand: vi.fn(async () => undefined),
      getSnapshot: () => largeSnapshot,
    });
    bridge.configure(true, 37921);
    await Promise.resolve();
    socket.open();
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'authChallenge', nonce: NONCE });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('authenticate'));
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'requestSnapshot' });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('state'));

    const commandMessageStart = socket.sent.length;
    socket.receive({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'command',
      requestId: 'volume-1',
      command: { name: 'setVolume', volume: 0.42 },
    });
    await vi.waitFor(() =>
      expect(messages(socket).slice(commandMessageStart).map((message) => message.type)).toEqual([
        'commandResult',
        'progress',
      ]),
    );
    const commandTraffic = socket.sent.slice(commandMessageStart);
    expect(commandTraffic.join('')).not.toContain('"type":"state"');
    expect(commandTraffic.reduce((bytes, message) => bytes + message.length, 0)).toBeLessThan(
      1_000,
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
      expect(messages(socket)).toContainEqual(
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

  it('waits for confirmed authenticated revocation before clearing the token', async () => {
    const socket = new FakeSocket();
    const clear = vi.fn(async () => undefined);
    const bridge = new StreamDeckBridge({
      sessionId: snapshot.sessionId,
      clientId: snapshot.clientId,
      origin: snapshot.origin,
      nebulaVersion: snapshot.nebulaVersion,
      tokenStore: { get: vi.fn(async () => TOKEN), set: vi.fn(), clear },
      createProof: vi.fn(async () => PROOF),
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: vi.fn(),
      onCommand: vi.fn(),
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await Promise.resolve();
    socket.open();
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'authChallenge', nonce: NONCE });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('authenticate'));
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('authenticate'));

    const revocation = bridge.unpair();
    await vi.waitFor(() =>
      expect(messages(socket).at(-1)).toMatchObject({
        type: 'revoke',
        clientId: snapshot.clientId,
      }),
    );
    expect(clear).not.toHaveBeenCalled();
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'revocationResult', ok: true });
    await revocation;
    expect(clear).toHaveBeenCalledOnce();
    bridge.destroy();
  });

  it('serializes commands received on the same socket', async () => {
    const socket = new FakeSocket();
    let finishFirst: (() => void) | undefined;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const onCommand = vi
      .fn<(command: StreamDeckCommand) => Promise<void>>()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce();
    const bridge = new StreamDeckBridge({
      sessionId: snapshot.sessionId,
      clientId: snapshot.clientId,
      origin: snapshot.origin,
      nebulaVersion: snapshot.nebulaVersion,
      tokenStore: { get: vi.fn(async () => TOKEN), set: vi.fn(), clear: vi.fn() },
      createProof: vi.fn(async () => PROOF),
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: vi.fn(),
      onCommand,
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await Promise.resolve();
    socket.open();
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'authChallenge', nonce: NONCE });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('authenticate'));
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    socket.receive({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'command',
      requestId: 'first',
      command: { name: 'next' },
    });
    socket.receive({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'command',
      requestId: 'second',
      command: { name: 'previous' },
    });
    await vi.waitFor(() => expect(onCommand).toHaveBeenCalledTimes(1));
    finishFirst?.();
    await vi.waitFor(() => expect(onCommand).toHaveBeenCalledTimes(2));
    expect(onCommand.mock.calls.map(([command]) => command.name)).toEqual(['next', 'previous']);
    bridge.destroy();
  });

  it('sends an immediate heartbeat when activity is reported', async () => {
    const socket = new FakeSocket();
    const bridge = new StreamDeckBridge({
      sessionId: snapshot.sessionId,
      clientId: snapshot.clientId,
      origin: snapshot.origin,
      nebulaVersion: snapshot.nebulaVersion,
      tokenStore: { get: vi.fn(async () => TOKEN), set: vi.fn(), clear: vi.fn() },
      createProof: vi.fn(async () => PROOF),
      socketFactory: () => socket as unknown as WebSocket,
      onStatus: vi.fn(),
      onCommand: vi.fn(),
      getSnapshot: () => snapshot,
    });
    bridge.configure(true, 37921);
    await Promise.resolve();
    socket.open();
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'authChallenge', nonce: NONCE });
    await vi.waitFor(() => expect(messages(socket).at(-1)?.type).toBe('authenticate'));
    socket.receive({ protocol: STREAM_DECK_PROTOCOL, type: 'pairingResult', ok: true });
    await vi.waitFor(() => {
      bridge.notifyActivity();
      expect(messages(socket).at(-1)?.type).toBe('heartbeat');
    });
    bridge.destroy();
  });

  it('treats a protocol mismatch as terminal until explicit reconnect', async () => {
    vi.useFakeTimers();
    try {
      const sockets: FakeSocket[] = [];
      const statuses: StreamDeckBridgeStatus[] = [];
      const bridge = new StreamDeckBridge({
        sessionId: snapshot.sessionId,
        clientId: snapshot.clientId,
        origin: snapshot.origin,
        nebulaVersion: snapshot.nebulaVersion,
        tokenStore: { get: vi.fn(async () => null), set: vi.fn(), clear: vi.fn() },
        createProof: vi.fn(async () => PROOF),
        socketFactory: () => {
          const socket = new FakeSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
        onStatus: (status) => statuses.push(status),
        onCommand: vi.fn(),
        getSnapshot: () => snapshot,
      });
      bridge.configure(true, 37921);
      await Promise.resolve();
      expect(sockets).toHaveLength(1);
      sockets[0].open();
      sockets[0].receive({
        protocol: 'nebula-streamdeck/2',
        type: 'authChallenge',
        nonce: NONCE,
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(statuses.at(-1)?.state).toBe('protocol-mismatch');
      await vi.runAllTimersAsync();
      expect(sockets).toHaveLength(1);

      bridge.reconnect();
      await Promise.resolve();
      expect(sockets).toHaveLength(2);
      bridge.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
