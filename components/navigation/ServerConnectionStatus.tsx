import React from 'react';
import { useStore } from '../../context/Store';

export const ServerConnectionStatus: React.FC = () => {
  const { credentials, isDemoMode } = useStore();
  let server = '';
  if (credentials && !isDemoMode) {
    try {
      const url = new URL(credentials.serverUrl);
      // Identify the server without exposing credentials or query parameters.
      server = `${url.host}${url.pathname.replace(/\/+$/, '')}`;
    } catch { server = 'Server'; }
  }
  const state = isDemoMode ? 'demo' : credentials ? 'connected' : 'offline';
  return <div className="nebula-rail-status" data-state={state}>
    <span className="nebula-rail-status-dot" aria-hidden="true" />
    <div>
      <strong>{isDemoMode ? 'Demo library' : credentials ? 'Connected to server' : 'Offline'}</strong>
      {server && <span className="nebula-rail-server" title={server}>{server}</span>}
    </div>
  </div>;
};
