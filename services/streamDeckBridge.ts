import {
  parsePluginMessage,
  serializeBrowserMessage,
  STREAM_DECK_MAX_MESSAGE_BYTES,
  STREAM_DECK_PROTOCOL,
  type BrowserToPluginMessage,
  type StreamDeckCommand,
  type StreamDeckErrorCode,
  type StreamDeckSnapshot,
} from './streamDeckProtocol';
import { createAuthenticationProof } from './streamDeckAuthentication';

export type StreamDeckConnectionStatus =
  | 'disabled'
  | 'connecting'
  | 'pairing-required'
  | 'authenticating'
  | 'connected'
  | 'disconnected'
  | 'protocol-mismatch'
  | 'error';

export interface StreamDeckBridgeStatus {
  state: StreamDeckConnectionStatus;
  endpoint: string;
  retryInMs?: number;
  message?: string;
}

export interface StreamDeckTokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export interface StreamDeckCommandFailure {
  code: StreamDeckErrorCode;
  message: string;
}

export interface StreamDeckBridgeOptions {
  sessionId: string;
  clientId: string;
  origin: string;
  nebulaVersion: string;
  tokenStore: StreamDeckTokenStore;
  socketFactory?: (url: string) => WebSocket;
  onSocketOpen?: (connectedAt: number) => void;
  onStatus: (status: StreamDeckBridgeStatus) => void;
  onCommand: (command: StreamDeckCommand) => Promise<void>;
  getSnapshot: () => StreamDeckSnapshot;
  createProof?: typeof createAuthenticationProof;
}

const RETRY_DELAYS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;
const HEARTBEAT_INTERVAL_MS = 15_000;
const STATE_THROTTLE_MS = 1_000;
const REVOCATION_TIMEOUT_MS = 5_000;
const COMMAND_ERROR_CODES = new Set<StreamDeckErrorCode>([
  'unauthorized',
  'disconnected',
  'stale_playlist',
  'empty_playlist',
  'playback_failed',
  'invalid_command',
  'internal_error',
]);

const failureFromUnknown = (error: unknown): StreamDeckCommandFailure => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    COMMAND_ERROR_CODES.has(error.code as StreamDeckErrorCode) &&
    typeof error.message === 'string'
  ) {
    return {
      code: error.code as StreamDeckErrorCode,
      message: error.message,
    };
  }
  return { code: 'internal_error', message: 'The command could not be completed.' };
};

export class StreamDeckBridge {
  private readonly socketFactory: (url: string) => WebSocket;
  private readonly createProof: typeof createAuthenticationProof;
  private socket: WebSocket | null = null;
  private enabled = false;
  private authenticated = false;
  private port = 37921;
  private token: string | null = null;
  private retryAttempt = 0;
  private retryTimer: number | undefined;
  private heartbeatTimer: number | undefined;
  private stateTimer: number | undefined;
  private lastStateSentAt = 0;
  private lastTrackId: string | null = null;
  private forceFullState = true;
  private forceArtwork = true;
  private generation = 0;
  private protocolTerminal = false;
  private pendingRevocation:
    | {
        resolve: () => void;
        reject: (error: Error) => void;
        timer: number;
      }
    | undefined;

  constructor(private readonly options: StreamDeckBridgeOptions) {
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url));
    this.createProof = options.createProof ?? createAuthenticationProof;
  }

  configure(enabled: boolean, port: number): void {
    const nextPort = Math.min(65_535, Math.max(1_024, Math.round(port)));
    const changed = this.enabled !== enabled || this.port !== nextPort;
    this.enabled = enabled;
    this.port = nextPort;
    if (!changed) return;
    this.disconnect(false);
    if (enabled) void this.connect();
    else this.publishStatus('disabled');
  }

  reconnect(): void {
    if (!this.enabled) return;
    this.protocolTerminal = false;
    this.retryAttempt = 0;
    this.disconnect(false);
    void this.connect();
  }

  async pair(code: string): Promise<void> {
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Enter the six-digit code shown by the Stream Deck plugin.');
    }
    if (!this.isSocketOpen()) {
      throw new Error('The Stream Deck plugin is not reachable.');
    }
    this.publishStatus('authenticating');
    this.send({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'pair',
      clientId: this.options.clientId,
      code,
    });
  }

  async unpair(): Promise<void> {
    if (!this.token) return;
    if (!this.authenticated || !this.isSocketOpen()) {
      throw new Error('Reconnect to Stream Deck before revoking this pairing.');
    }
    if (this.pendingRevocation) {
      throw new Error('Pairing revocation is already in progress.');
    }
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (!this.pendingRevocation) return;
        this.pendingRevocation = undefined;
        reject(new Error('Stream Deck did not confirm pairing revocation.'));
      }, REVOCATION_TIMEOUT_MS);
      this.pendingRevocation = { resolve, reject, timer };
      this.send({
        protocol: STREAM_DECK_PROTOCOL,
        type: 'revoke',
        clientId: this.options.clientId,
      });
    });
  }

  notifyActivity(): void {
    this.sendHeartbeat();
  }

  notifyStateChanged(immediate = false, full = false, includeArtwork = false): void {
    if (!this.isSocketOpen()) return;
    this.forceFullState ||= full;
    this.forceArtwork ||= includeArtwork;
    const elapsed = Date.now() - this.lastStateSentAt;
    if (immediate || elapsed >= STATE_THROTTLE_MS) {
      this.flushState();
      return;
    }
    if (this.stateTimer !== undefined) return;
    this.stateTimer = window.setTimeout(() => {
      this.stateTimer = undefined;
      this.flushState();
    }, STATE_THROTTLE_MS - elapsed);
  }

  destroy(): void {
    this.enabled = false;
    this.generation += 1;
    this.disconnect(false);
  }

  private get endpoint(): string {
    return `ws://127.0.0.1:${this.port}/nebula/v1`;
  }

  private async connect(): Promise<void> {
    if (this.protocolTerminal) {
      this.publishStatus(
        'protocol-mismatch',
        'Protocol mismatch. Reconnect explicitly after updating Nebula or the plugin.',
      );
      return;
    }
    const generation = ++this.generation;
    this.clearRetry();
    this.publishStatus('connecting');
    this.token = await this.options.tokenStore.get();
    if (!this.enabled || generation !== this.generation) return;

    let socket: WebSocket;
    try {
      socket = this.socketFactory(this.endpoint);
    } catch {
      this.scheduleRetry('Unable to open the local Stream Deck connection.');
      return;
    }
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (socket !== this.socket) return;
      this.retryAttempt = 0;
      this.options.onSocketOpen?.(Date.now());
      this.send({
        protocol: STREAM_DECK_PROTOCOL,
        type: 'hello',
        sessionId: this.options.sessionId,
        clientId: this.options.clientId,
        origin: this.options.origin,
        nebulaVersion: this.options.nebulaVersion,
        visible: this.options.getSnapshot().visible,
        lastActiveAt: this.options.getSnapshot().lastActiveAt,
      });
      if (this.token) {
        this.publishStatus('authenticating');
      } else {
        this.publishStatus('pairing-required');
      }
      this.startHeartbeat();
    });
    let inbound = Promise.resolve();
    socket.addEventListener('message', (event) => {
      inbound = inbound
        .then(() => this.handleMessage(socket, event))
        .catch(() => {
          if (socket !== this.socket) return;
          this.publishStatus('error', 'Unable to process a Stream Deck message.');
          socket.close(1011, 'Message processing failed');
        });
    });
    socket.addEventListener('close', () => {
      if (socket !== this.socket) return;
      this.socket = null;
      this.authenticated = false;
      this.lastTrackId = null;
      this.forceFullState = true;
      this.forceArtwork = true;
      this.stopHeartbeat();
      if (this.stateTimer !== undefined) window.clearTimeout(this.stateTimer);
      this.stateTimer = undefined;
      this.rejectPendingRevocation('Stream Deck disconnected before revocation was confirmed.');
      if (this.enabled && !this.protocolTerminal) {
        this.scheduleRetry('Stream Deck disconnected.');
      }
    });
    socket.addEventListener('error', () => {
      if (socket === this.socket) socket.close();
    });
  }

  private async handleMessage(socket: WebSocket, event: MessageEvent): Promise<void> {
    if (socket !== this.socket) return;
    if (typeof event.data !== 'string') {
      socket.close(1003, 'Text messages required');
      return;
    }
    if (new Blob([event.data]).size > STREAM_DECK_MAX_MESSAGE_BYTES) {
      this.sendCommandError('', 'invalid_command', 'Message exceeds the 512 KiB limit.');
      socket.close(1009, 'Message too large');
      return;
    }
    const parsed = parsePluginMessage(event.data);
    if (!parsed.ok) {
      if (parsed.code === 'protocol_mismatch') {
        this.protocolTerminal = true;
        this.publishStatus('protocol-mismatch', parsed.message);
        socket.close(1002, 'Protocol mismatch');
      }
      this.sendCommandError('', 'invalid_command', parsed.message);
      return;
    }

    const message = parsed.message;
    if (message.type === 'authChallenge') {
      if (!this.token) {
        this.publishStatus('pairing-required');
        return;
      }
      this.publishStatus('authenticating');
      const token = this.token;
      const proof = await this.createProof(
        token,
        this.options.clientId,
        this.options.sessionId,
        message.nonce,
      );
      if (socket !== this.socket || token !== this.token) return;
      this.send({
        protocol: STREAM_DECK_PROTOCOL,
        type: 'authenticate',
        clientId: this.options.clientId,
        proof,
      });
      return;
    }

    if (message.type === 'revocationResult') {
      const pending = this.pendingRevocation;
      if (!pending) return;
      window.clearTimeout(pending.timer);
      this.pendingRevocation = undefined;
      if (!message.ok) {
        pending.reject(new Error('Stream Deck did not revoke this pairing.'));
        return;
      }
      this.authenticated = false;
      this.token = null;
      await this.options.tokenStore.clear();
      this.publishStatus('pairing-required', 'Pairing was revoked.');
      pending.resolve();
      return;
    }

    if (message.type === 'pairingResult') {
      if (!message.ok) {
        if (message.error === 'protocol_mismatch') {
          this.protocolTerminal = true;
          this.publishStatus(
            'protocol-mismatch',
            'Protocol mismatch. Reconnect explicitly after updating Nebula or the plugin.',
          );
          socket.close(1002, 'Protocol mismatch');
          return;
        }
        if (message.error === 'unauthorized' && this.token) {
          this.token = null;
          await this.options.tokenStore.clear();
        }
        this.publishStatus(
          'pairing-required',
          message.error
            ? `Pairing failed: ${message.error.replaceAll('_', ' ')}.`
            : 'Pairing or authentication failed.',
        );
        return;
      }
      if (message.token) {
        this.token = message.token;
        await this.options.tokenStore.set(message.token);
        if (socket !== this.socket) return;
        this.publishStatus('authenticating');
        return;
      }
      this.authenticated = true;
      this.publishStatus('connected');
      return;
    }

    if (message.type === 'requestSnapshot') {
      if (!this.authenticated) {
        this.publishStatus('pairing-required', 'Pairing is required.');
        return;
      }
      this.publishStatus('connected');
      this.notifyStateChanged(true, true, true);
      return;
    }

    if (!this.authenticated) {
      this.sendCommandError(message.requestId, 'unauthorized', 'Pairing is required.');
      return;
    }
    try {
      await this.options.onCommand(message.command);
      if (socket !== this.socket) return;
      this.send({
        protocol: STREAM_DECK_PROTOCOL,
        type: 'commandResult',
        requestId: message.requestId,
        ok: true,
      });
      this.notifyStateChanged(true, true);
    } catch (error) {
      const failure = failureFromUnknown(error);
      this.sendCommandError(message.requestId, failure.code, failure.message);
    }
  }

  private flushState(): void {
    if (!this.isSocketOpen() || !this.authenticated) return;
    const snapshot = this.options.getSnapshot();
    this.lastStateSentAt = Date.now();
    const trackChanged = snapshot.track?.id !== this.lastTrackId;
    this.lastTrackId = snapshot.track?.id ?? null;
    if (trackChanged || this.forceFullState) {
      const stateSnapshot =
        !trackChanged && !this.forceArtwork && snapshot.track?.artworkDataUrl
          ? {
              ...snapshot,
              track: {
                id: snapshot.track.id,
                title: snapshot.track.title,
                artist: snapshot.track.artist,
                ...(snapshot.track.album ? { album: snapshot.track.album } : {}),
              },
            }
          : snapshot;
      this.forceFullState = false;
      this.forceArtwork = false;
      this.send({ protocol: STREAM_DECK_PROTOCOL, type: 'state', snapshot: stateSnapshot });
      return;
    }
    this.send({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'progress',
      sessionId: snapshot.sessionId,
      positionSeconds: snapshot.positionSeconds,
      durationSeconds: snapshot.durationSeconds,
      playing: snapshot.playing,
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private sendHeartbeat(): void {
    if (!this.authenticated || !this.isSocketOpen()) return;
    const snapshot = this.options.getSnapshot();
    this.send({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'heartbeat',
      sessionId: snapshot.sessionId,
      visible: snapshot.visible,
      lastActiveAt: snapshot.lastActiveAt,
    });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private scheduleRetry(message: string): void {
    if (!this.enabled || this.protocolTerminal || this.retryTimer !== undefined) return;
    const delay = RETRY_DELAYS[Math.min(this.retryAttempt, RETRY_DELAYS.length - 1)];
    this.retryAttempt += 1;
    this.publishStatus('disconnected', message, delay);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = undefined;
      void this.connect();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer !== undefined) window.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }

  private disconnect(scheduleRetry: boolean): void {
    this.generation += 1;
    this.clearRetry();
    this.stopHeartbeat();
    if (this.stateTimer !== undefined) window.clearTimeout(this.stateTimer);
    this.stateTimer = undefined;
    const socket = this.socket;
    this.socket = null;
    this.authenticated = false;
    this.lastTrackId = null;
    this.forceFullState = true;
    this.forceArtwork = true;
    this.rejectPendingRevocation('Connection closed before revocation was confirmed.');
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Reconfigured');
    if (scheduleRetry && this.enabled) this.scheduleRetry('Stream Deck disconnected.');
  }

  private isSocketOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private send(message: BrowserToPluginMessage): void {
    if (!this.isSocketOpen()) return;
    try {
      this.socket?.send(serializeBrowserMessage(message));
    } catch {
      this.publishStatus('error', 'A Stream Deck message exceeded the safe size limit.');
    }
  }

  private rejectPendingRevocation(message: string): void {
    const pending = this.pendingRevocation;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    this.pendingRevocation = undefined;
    pending.reject(new Error(message));
  }

  private sendCommandError(
    requestId: string,
    code: StreamDeckErrorCode,
    message: string,
  ): void {
    if (!requestId) return;
    this.send({
      protocol: STREAM_DECK_PROTOCOL,
      type: 'commandResult',
      requestId,
      ok: false,
      error: { code, message: message.slice(0, 512) },
    });
  }

  private publishStatus(
    state: StreamDeckConnectionStatus,
    message?: string,
    retryInMs?: number,
  ): void {
    this.options.onStatus({
      state,
      endpoint: this.endpoint,
      ...(message ? { message } : {}),
      ...(retryInMs ? { retryInMs } : {}),
    });
  }
}

export const commandFailure = (
  code: StreamDeckErrorCode,
  message: string,
): StreamDeckCommandFailure => ({ code, message });
