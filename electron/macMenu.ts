import {
  app,
  Menu,
  nativeImage,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron';
import { createCommandClient, type CommandClient } from '../playback/commandClient';
import { getPlaybackMenuKey } from '../playback/playbackMenuKey';
import type {
  DesktopCommand,
  DesktopCommandEnvelope,
  DesktopSnapshot,
} from '../playback/desktopProtocol';

interface MacMenuOptions {
  getWindow: () => BrowserWindow | null;
  getEpoch: () => number;
  onCommand: (envelope: DesktopCommandEnvelope) => void;
  toggleMiniPlayer: () => void;
  openSettings: () => void;
}

let activeOptions: MacMenuOptions | null = null;
let activeClient: CommandClient | null = null;
let lastPlaybackKey = '';
let lastSnapshotForMenu: DesktopSnapshot | null = null;

const send = (command: DesktopCommand): void => {
  if (!activeClient) return;
  activeOptions?.onCommand(activeClient.send(command));
};

const dockMenu = (): MenuItemConstructorOptions[] => [
  { label: 'Show Nebula', click: () => {
      const win = activeOptions?.getWindow();
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } },
  { type: 'separator' },
  { label: 'Play / Pause', click: () => send({ name: 'togglePlayback' }) },
  { label: 'Next', click: () => send({ name: 'next' }) },
  { label: 'Previous', click: () => send({ name: 'previous' }) },
];

const buildTemplate = (snapshot: DesktopSnapshot | null): MenuItemConstructorOptions[] => {
  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `About ${app.name}` },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'Cmd+,', click: () => activeOptions?.openSettings() },
      { type: 'separator' },
      { role: 'hide', label: `Hide ${app.name}` },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit', label: `Quit ${app.name}` },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  const nowPlayingItems: MenuItemConstructorOptions[] = [];
  const track = snapshot?.track ?? null;
  if (track) {
    let coverIcon: Electron.NativeImage | undefined;
    if (track.coverArtUrl) {
      const image = nativeImage.createFromDataURL(track.coverArtUrl);
      if (!image.isEmpty()) coverIcon = image;
    }
    const subtitle = track.album ? `${track.artist} — ${track.album}` : track.artist;
    nowPlayingItems.push(
      {
        label: `${track.title}`,
        ...(coverIcon ? { icon: coverIcon } : {}),
        enabled: false,
      },
      { label: subtitle, enabled: false },
      { type: 'separator' },
    );
  }

  const playbackMenu: MenuItemConstructorOptions = {
    label: 'Playback',
    submenu: [
      ...nowPlayingItems,
      {
        label: snapshot?.playing ? 'Pause' : 'Play',
        click: () => send({ name: 'togglePlayback' }),
      },
      { label: 'Next', click: () => send({ name: 'next' }) },
      { label: 'Previous', click: () => send({ name: 'previous' }) },
      { type: 'separator' },
      { label: 'Mini Player', click: () => activeOptions?.toggleMiniPlayer() },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [
      { role: 'minimize', label: 'Minimize' },
      { role: 'zoom', label: 'Zoom' },
      { type: 'separator' },
      { role: 'front', label: 'Bring All to Front' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Toggle Full Screen' },
    ],
  };

  return [appMenu, editMenu, playbackMenu, windowMenu];
};

const install = (): void => {
  if (!activeOptions) return;
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildTemplate(lastSnapshotForMenu)));
  app.dock?.setMenu(Menu.buildFromTemplate(dockMenu()));
};

export const installMacAppMenu = (options: MacMenuOptions): void => {
  activeOptions = options;
  activeClient = createCommandClient('nebula-app-menu', options.getEpoch);
  install();
};

/**
 * Rebuilds the Playback menu with the current song when the track or play
 * state changes. No-op unless the app menu was installed (darwin).
 */
export const updateMacPlaybackMenu = (snapshot: DesktopSnapshot | null): void => {
  if (!activeOptions || !activeClient) return;
  const key = getPlaybackMenuKey(snapshot);
  if (key === lastPlaybackKey) return;
  lastPlaybackKey = key;
  lastSnapshotForMenu = snapshot;
  install();
};
