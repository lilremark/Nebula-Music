import {
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
} from 'electron';
import { IPC } from './ipc';
import { createCommandClient } from '../playback/commandClient';
import type { DesktopCommand, DesktopCommandEnvelope } from '../playback/desktopProtocol';

/**
 * Tray icon: a 32x32 violet dot (embedding the base64 avoids runtime asset-path
 * lookups inside the asar).
 */
const TRAY_ICON_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAJnSURBVFhH7ZfPSxRhHMZFQuwUHaKIiIgwJDwskUgEQaf+AAVxHUc9KAReUhAFGyq23W1ndtWLguXPKY/d+gM6dfLkvWNXf+zszDuCE8/IivP0zjjv5CXqgQ8Lu+/7PDPv+32/M9vS8l9/owwjaC2NBVcYfM9jL1SF/sPrNc3rNAcbj02t8UQGfn+vBzd47h8Jd2dq9RyHJaI7D4sDe1fZS1nlUefmb+YKVAfcu+yZWqa238GGWagOiQfK9VHKO7fYiFmedEc+TLsT+OTfmFreu88ZscLesUGTpZeNvF0U37YrfsDYRfF9Zcod5zlNUhdnXMFtvBKFzxUhOJix3/pb1WH3Gc+3hvxu42lwifMiwlXyRLA+55oclMTWO/8Le4Ca7t7hzIisYdHFk7Dsae6cQX2wF44nZ54KyyNrMnbpaIfN0/CpLH6yF7B6jy9zdqiThhMdjL1kYxWWJrxe9kRH5exQhZGDazwYVc2mKqzOejPsiSPO2aFkBahafMzGG2+VPee1xm3ODoWl4cEfZ7xJNlUBR5c9Yy9AVgMLL9znbKqCrEvG1oCh/2jnwQDVzMZpwNFlL4Ab5exTybpg1m1Ye+0tsxe6IWdGhP3hSWCzIL5yQBJ22d9ljxP2OzgzIjQjXCVPRC3gYcNBMhAuO/9ocrFN6KySXkLCB1JZHHIowJ7Llr2J0stJ+O4nMWmCPr9ueIs45/iU9v0I9ZzSSwkGywoyC5W88wgnjDPOVVgPkqejGvVcpvCzwjNc9pQ8D2tw757SsifJ6NttwxGydKeHgyKhutOD979U1Z5V6GToF8yF/A/45/QLOk1/1X2nGUgAAAAASUVORK5CYII=';

let tray: Tray | null = null;

interface TrayOptions {
  getWindow: () => BrowserWindow | null;
  getEpoch: () => number;
  onCommand: (envelope: DesktopCommandEnvelope) => void;
  onToggleMiniPlayer: () => void;
  onQuit: () => void;
}

export const createTray = (options: TrayOptions): Tray => {
  if (tray) return tray;

  const icon = nativeImage.createFromDataURL(TRAY_ICON_PNG);
  tray = new Tray(icon);
  tray.setToolTip('Nebula');

  const commands = createCommandClient('nebula-tray', options.getEpoch);
  const send = (command: DesktopCommand): void => {
    options.onCommand(commands.send(command));
  };

  const showWindow = (): void => {
    const win = options.getWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  };

  const menu: MenuItemConstructorOptions[] = [
    { label: 'Show Nebula', click: showWindow },
    { type: 'separator' },
    { label: 'Play / Pause', click: () => send({ name: 'togglePlayback' }) },
    { label: 'Next', click: () => send({ name: 'next' }) },
    { label: 'Previous', click: () => send({ name: 'previous' }) },
    { type: 'separator' },
    { label: 'Mini Player', click: () => options.onToggleMiniPlayer() },
    { type: 'separator' },
    { label: 'Quit', click: () => options.onQuit() },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(menu));
  tray.on('click', showWindow);

  return tray;
};

export const destroyTray = (): void => {
  tray?.destroy();
  tray = null;
};
