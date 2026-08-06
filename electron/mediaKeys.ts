import { globalShortcut } from 'electron';
import { createCommandClient, type CommandClient } from './commandClient';
import type { DesktopCommand, DesktopCommandEnvelope } from '../playback/desktopProtocol';

/**
 * Registers Windows media-key global shortcuts as a remote playback client.
 * Commands are forwarded through the same envelope path as the tray, so the
 * owner bridge deduplicates/orders them identically.
 */

interface MediaKeysOptions {
  getEpoch: () => number;
  onCommand: (envelope: DesktopCommandEnvelope) => void;
}

const BINDINGS: Array<{ accelerator: string; command: DesktopCommand }> = [
  { accelerator: 'MediaPlayPause', command: { name: 'togglePlayback' } },
  { accelerator: 'MediaNextTrack', command: { name: 'next' } },
  { accelerator: 'MediaPreviousTrack', command: { name: 'previous' } },
  { accelerator: 'MediaStop', command: { name: 'setPlayback', playing: false } },
];

let client: CommandClient | null = null;

export const registerMediaKeys = (options: MediaKeysOptions): void => {
  if (client) return;
  client = createCommandClient('nebula-media-keys', options.getEpoch);

  for (const { accelerator, command } of BINDINGS) {
    const ok = globalShortcut.register(accelerator, () => {
      options.onCommand(client!.send(command));
    });
    if (!ok) {
      console.warn(`[nebula] media key shortcut not registered: ${accelerator}`);
    }
  }
};

export const unregisterMediaKeys = (): void => {
  client = null;
  globalShortcut.unregisterAll();
};
