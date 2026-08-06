import {
  DESKTOP_PROTOCOL_VERSION,
  type DesktopCommand,
  type DesktopCommandEnvelope,
} from '../playback/desktopProtocol';

/**
 * Builds monotonic command envelopes for a named remote client (tray, media
 * keys, and later the mini-player). Each client keeps its own sequence; the
 * epoch is read from the latest published snapshot so commands are not rejected
 * as stale by the owner bridge.
 */
export interface CommandClient {
  send: (command: DesktopCommand) => DesktopCommandEnvelope;
}

export const createCommandClient = (clientId: string, getEpoch: () => number): CommandClient => {
  let seq = 0;
  return {
    send: (command) => ({
      v: DESKTOP_PROTOCOL_VERSION,
      clientId,
      epoch: getEpoch(),
      seq: ++seq,
      issuedAt: Date.now(),
      command,
    }),
  };
};
