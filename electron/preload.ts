import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './ipc';
import type { DesktopBridge } from '../platform/desktopBridge';
import type { UpdaterState } from './updater';

const info = ipcRenderer.sendSync(IPC.app.info) as DesktopBridge['info'];

const bridge: DesktopBridge = {
  info,
  app: {
    onOpenSettings: (handler: () => void) => {
      const listener = (): void => handler();
      ipcRenderer.on(IPC.app.openSettings, listener);
      return () => {
        ipcRenderer.removeListener(IPC.app.openSettings, listener);
      };
    },
  },
  window: {
    minimize: async () => {
      ipcRenderer.send(IPC.window.minimize);
    },
    toggleMaximize: async () => {
      ipcRenderer.send(IPC.window.toggleMaximize);
    },
    close: async () => {
      ipcRenderer.send(IPC.window.close);
    },
    isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized),
    isFullScreen: () => ipcRenderer.invoke(IPC.window.isFullScreen),
    onMaximizeChanged: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: unknown) => {
        handler(Boolean(maximized));
      };
      ipcRenderer.on(IPC.window.maximizeChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC.window.maximizeChanged, listener);
      };
    },
  },
  openExternal: (url: string) => ipcRenderer.invoke(IPC.app.openExternal, url),
  settings: {
    get: (key: string) => ipcRenderer.invoke(IPC.settings.get, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC.settings.set, key, value),
  },
  vault: {
    get: (serverUrl: string) => ipcRenderer.invoke(IPC.vault.get, serverUrl),
    set: (credentials) => ipcRenderer.invoke(IPC.vault.set, credentials),
    clear: (serverUrl: string) => ipcRenderer.invoke(IPC.vault.clear, serverUrl),
    getSecret: (key: string) => ipcRenderer.invoke(IPC.vault.getSecret, key),
    setSecret: (key: string, value: string) =>
      ipcRenderer.invoke(IPC.vault.setSecret, key, value),
    clearSecret: (key: string) => ipcRenderer.invoke(IPC.vault.clearSecret, key),
  },
  http: {
    fetchJson: (url: string) => ipcRenderer.invoke(IPC.http.fetchJson, url),
    proxyUrl: (url: string) => `app://nebula/proxy?u=${encodeURIComponent(url)}`,
  },
  playback: {
    onCommand: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, envelope: unknown) => {
        handler(envelope as Parameters<typeof handler>[0]);
      };
      ipcRenderer.on(IPC.playback.command, listener);
      return () => {
        ipcRenderer.removeListener(IPC.playback.command, listener);
      };
    },
    publishSnapshot: (snapshot) => ipcRenderer.send(IPC.playback.snapshot, snapshot),
    onSnapshot: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: unknown) => {
        handler(snapshot as Parameters<typeof handler>[0]);
      };
      ipcRenderer.on(IPC.playback.snapshotToClient, listener);
      return () => {
        ipcRenderer.removeListener(IPC.playback.snapshotToClient, listener);
      };
    },
    sendCommand: (envelope) => ipcRenderer.send(IPC.playback.clientCommand, envelope),
  },
  miniPlayer: {
    toggle: () => ipcRenderer.invoke(IPC.miniPlayer.toggle),
    showMain: () => ipcRenderer.invoke(IPC.miniPlayer.showMain),
  },
  updater: {
    getState: () => ipcRenderer.invoke(IPC.updater.getState) as Promise<UpdaterState>,
    check: () => ipcRenderer.invoke(IPC.updater.check) as Promise<boolean>,
    installAndRestart: () => ipcRenderer.invoke(IPC.updater.installAndRestart),
    onStatus: (handler: (state: UpdaterState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: unknown) => {
        handler(state as UpdaterState);
      };
      ipcRenderer.on(IPC.updater.status, listener);
      return () => {
        ipcRenderer.removeListener(IPC.updater.status, listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('desktop', bridge);
