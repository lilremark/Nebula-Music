/**
 * IPC channel names shared by the main process and the preload script.
 * Kept in a single module so both sides can never drift.
 */
export const IPC = {
  app: {
    info: 'nebula:app:info',
    openExternal: 'nebula:app:open-external',
  },
  window: {
    minimize: 'nebula:window:minimize',
    toggleMaximize: 'nebula:window:toggle-maximize',
    close: 'nebula:window:close',
    isMaximized: 'nebula:window:is-maximized',
    isFullScreen: 'nebula:window:is-full-screen',
  },
  settings: {
    get: 'nebula:settings:get',
    set: 'nebula:settings:set',
  },
  vault: {
    get: 'nebula:vault:get',
    set: 'nebula:vault:set',
    clear: 'nebula:vault:clear',
  },
  http: {
    fetchJson: 'nebula:http:fetch-json',
  },
  playback: {
    command: 'nebula:playback:command',
    snapshot: 'nebula:playback:snapshot',
  },
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC][keyof (typeof IPC)[keyof typeof IPC]];
