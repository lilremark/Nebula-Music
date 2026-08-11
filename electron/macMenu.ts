import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { createCommandClient } from '../playback/commandClient';
import type { DesktopCommand, DesktopCommandEnvelope } from '../playback/desktopProtocol';

interface MacMenuOptions {
  getWindow: () => BrowserWindow | null;
  getEpoch: () => number;
  onCommand: (envelope: DesktopCommandEnvelope) => void;
  toggleMiniPlayer: () => void;
  openSettings: () => void;
}

export const installMacAppMenu = (options: MacMenuOptions): void => {
  const client = createCommandClient('nebula-app-menu', options.getEpoch);
  const send = (command: DesktopCommand) => options.onCommand(client.send(command));

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `About ${app.name}` },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'Cmd+,', click: () => options.openSettings() },
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

  const playbackMenu: MenuItemConstructorOptions = {
    label: 'Playback',
    submenu: [
      { label: 'Play / Pause', click: () => send({ name: 'togglePlayback' }) },
      { label: 'Next', click: () => send({ name: 'next' }) },
      { label: 'Previous', click: () => send({ name: 'previous' }) },
      { type: 'separator' },
      { label: 'Mini Player', click: () => options.toggleMiniPlayer() },
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

  const template: MenuItemConstructorOptions[] = [appMenu, editMenu, playbackMenu, windowMenu];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  const dockMenu = Menu.buildFromTemplate([
    { label: 'Show Nebula', click: () => {
        const win = options.getWindow();
        if (!win) return;
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      } },
    { type: 'separator' },
    { label: 'Play / Pause', click: () => send({ name: 'togglePlayback' }) },
    { label: 'Next', click: () => send({ name: 'next' }) },
    { label: 'Previous', click: () => send({ name: 'previous' }) },
  ]);
  app.dock?.setMenu(dockMenu);
};
