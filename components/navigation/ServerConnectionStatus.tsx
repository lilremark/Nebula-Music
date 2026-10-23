import React from 'react';
import { useStore } from '../../context/Store';

export const ServerConnectionStatus: React.FC = () => {
  const { credentials, isDemoMode, serverConnection } = useStore();
  const connected = !!credentials && serverConnection !== 'disconnected';
  let server = '';
  if (credentials && !isDemoMode) {
    try {
      const url = new URL(credentials.serverUrl);
      // Identify the server without exposing credentials or query parameters.
      server = `${url.host}${url.pathname.replace(/\/+$/, '')}`;
    } catch { server = 'Server'; }
  }
  const label = `${isDemoMode ? 'Demo library' : connected ? 'Connected to server' : 'Offline'}${server ? `: ${server}` : ''}`;
  const state = isDemoMode ? 'demo' : connected ? 'connected' : 'offline';
  return <div className="nebula-rail-status" data-state={state} role="status" aria-label={label} title={label}>
    <span className="nebula-rail-status-dot" aria-hidden="true" />
    <div>
      <strong>{isDemoMode ? 'Demo library' : connected ? 'Connected to server' : 'Offline'}</strong>
      {server && <span className="nebula-rail-server" title={server}>{server}</span>}
    </div>
  </div>;
};
