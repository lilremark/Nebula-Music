import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './ipc';
import type { DesktopBridge } from '../platform/desktopBridge';

const info = ipcRenderer.sendSync(IPC.app.info) as DesktopBridge['info'];

const bridge: DesktopBridge = {
  info,
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
  },
};

contextBridge.exposeInMainWorld('desktop', bridge);
