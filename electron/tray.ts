import {
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
} from 'electron';
import path from 'node:path';
import { IPC } from './ipc';
import { createCommandClient } from '../playback/commandClient';
import type { DesktopCommand, DesktopCommandEnvelope } from '../playback/desktopProtocol';

/**
 * Tray icon: a 32x32 render of the Nebula logo (embedding the base64 avoids
 * runtime asset-path lookups inside the asar).
 */
const TRAY_ICON_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAADt0lEQVRYhcXX/08TZxwH8OcP2A9qRLOYZVmWxZjFZFnMshhCzHQKccYNNW5ZzMJg6JgzbvM7hnoOFEVWUJkLirJNhtJS5he2WozfEhVUQJBA6Td6vdJe6bX27lrsNV3ey7WxAzfT9pj089P99rzyPO/n+dyHkGfqw3JXXj7FNq+jWHp9mUf6pMyDT/eOYUPpGD7b40XBLi+KdnIo3s5h0zYfSr7zY/M3fmzZ+hhbtzzGt18HsO2rAHaU8Nj1JY/dG3mptFigVYXCb6rCYC55Xr1f5Z6z6oDr6uoKNz763o01+1mso1isV3kwVcSejQL2FgtQFYmgCoWOigIh61+L5x5yWldWurDqgAsvGrHvc9EyCbG0irm6/LATeYdGMX0IwRBbPEfN5L1XzWDZESemGxHLRI6abl6iZpAJRFmR0ESya2k6p8aBDCHsZPExWsqudSATCPmKkneP01h8jIYSRFmDH6pT/ikhyDs/2qEEUdsWwNOqa+UVI8iiE3YoQVzpDiUAHffHFR8HefunEaSDKNf5cflBEPfN4QTggSkMfdc4fmgOpI0gb9WPIFXEmqMu9NFh9NMSvHw0AeD4KAZGJAzYJHxx0JsWgiw8aUMyRH69C9UGP+quBdDPhGMIn/hXAuATohiwSxi0Szjzp4iTFwSUVHIpIcibDTYkQ6jaOTTe5aHtFmFiI+hzyIB/dkD+fmSXYHVH0N4ZguZ6ELUtqR0HWXDaimSI/Vc4nOnkoe0RYfZE8PA5ABsbweXOEFpuBHG8lU8pmGR+oxXJEJSBw+lOHppeEeaxOIB7BiDnQgZc6grh/M0gjuoCKT1W5I2fLUiGKNV70dAVQEuviGGPhF7mvwEWdwQX74Vw7qaIam0gpReTvP6LGckQeY0MDl7zQX3Lj4fOcBwQnHALxGgsmAMOCfUGHnXtPArUnpSebfLaWTNSQcg7sfwUg27mCXqYMDwTdmBMiMaCKSM+rmHT6h3k1SYT0kHs/MMLbZ+A27bxBOCO9Ql+7wmCavOl3cDIK80mpIuQg9n2SEwALvYHFXdRMu/cMJQg9nVwCUC5nlPcysnL54ehFFHcymKTllXUyp8iyByNUZoKYir/E/LcQbK0RnquxohMINZS7AiZpRtsytIakQlEPuX+lcxsNebO0g0hE4h8anRFbDaYoRvqyABCn5iMXmoxZc1oG7RMG6Jy1PLBkdHZk+bDOGLI8KIRS6uc+twK1+ThdGLFMzHYNFtjtP9PV1TKrnHYc2ros0vUjviZT6i/Abci4w8+3cVBAAAAAElFTkSuQmCC';

let tray: Tray | null = null;
let updateClickHandler: (() => void) | null = null;
let showWindowHandler: (() => void) | null = null;

interface TrayOptions {
  getWindow: () => BrowserWindow | null;
  getEpoch: () => number;
  onCommand: (envelope: DesktopCommandEnvelope) => void;
  onToggleMiniPlayer: () => void;
  onQuit: () => void;
  onUpdateClick: () => void;
}

export const createTray = (options: TrayOptions): Tray => {
  if (tray) return tray;
  updateClickHandler = options.onUpdateClick;

  const templatePath = path.join(__dirname, '..', 'assets', 'trayTemplate.png');
  const isDarwin = process.platform === 'darwin';
  const icon = isDarwin
    ? nativeImage.createFromPath(templatePath)
    : nativeImage.createFromDataURL(TRAY_ICON_PNG);
  if (isDarwin) icon.setTemplateImage(true);
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

  showWindowHandler = showWindow;

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
  tray.on('balloon-click', () => { updateClickHandler?.(); showWindow(); });

  return tray;
};

export const showUpdateBalloon = (version: string): void => {
  if (!tray) return;
  if (process.platform !== 'win32') {
    if (!Notification.isSupported()) return;
    new Notification({
      title: 'Nebula update ready',
      body: `Version ${version} is downloaded. Click to install.`,
    })
      .on('click', () => {
        updateClickHandler?.();
        showWindowHandler?.();
      })
      .show();
    return;
  }
  tray.displayBalloon({
    title: 'Nebula update ready',
    content: `Version ${version} is downloaded. Click to install.`,
  });
};

export const destroyTray = (): void => {
  tray?.destroy();
  tray = null;
};
