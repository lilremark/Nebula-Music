/**
 * IPC channel names shared by the main process and the preload script.
 * Kept in a single module so both sides can never drift.
 */
export const IPC = {
  app: {
    info: 'nebula:app:info',
    openExternal: 'nebula:app:open-external',
    openSettings: 'nebula:app:open-settings',
  },
  window: {
    minimize: 'nebula:window:minimize',
    toggleMaximize: 'nebula:window:toggle-maximize',
    close: 'nebula:window:close',
    isMaximized: 'nebula:window:is-maximized',
    isFullScreen: 'nebula:window:is-full-screen',
    maximizeChanged: 'nebula:window:maximize-changed',
  },
  settings: {
    get: 'nebula:settings:get',
    set: 'nebula:settings:set',
  },
  vault: {
    get: 'nebula:vault:get',
    set: 'nebula:vault:set',
    clear: 'nebula:vault:clear',
    getSecret: 'nebula:vault:get-secret',
    setSecret: 'nebula:vault:set-secret',
    clearSecret: 'nebula:vault:clear-secret',
  },
  http: {
    fetchJson: 'nebula:http:fetch-json',
  },
  playback: {
    command: 'nebula:playback:command',
    snapshot: 'nebula:playback:snapshot',
    snapshotToClient: 'nebula:playback:snapshot-to-client',
    clientCommand: 'nebula:playback:client-command',
  },
  miniPlayer: {
    toggle: 'nebula:mini-player:toggle',
    showMain: 'nebula:mini-player:show-main',
  },
  updater: {
    getState: 'nebula:updater:get-state',
    check: 'nebula:updater:check',
    installAndRestart: 'nebula:updater:install-and-restart',
    status: 'nebula:updater:status',
  },
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC][keyof (typeof IPC)[keyof typeof IPC]];
