import React from 'react';
import { WifiOff } from 'lucide-react';
import { useStore } from '../context/Store';
import './server-connection-banner.css';

export const ServerConnectionBanner: React.FC = () => {
  const { credentials, isDemoMode, serverConnection, isCheckingConnection, retryServerConnection } = useStore();
  if (!credentials || isDemoMode || serverConnection !== 'disconnected') return null;
  return (
    <div className="nebula-server-warning nebula-banner nebula-banner-row" data-tone="warning" role="alert">
      <WifiOff className="nebula-banner-icon" aria-hidden="true" />
      <div className="nebula-server-warning-copy nebula-banner-copy">
        <strong>Connection to music server lost.</strong>{' '}
        <span>Check your connection. Nebula will keep trying.</span>
      </div>
      <button type="button" className="nebula-banner-button" onClick={retryServerConnection} disabled={isCheckingConnection}>
        {isCheckingConnection ? 'Checking connection…' : 'Retry connection'}
      </button>
    </div>
  );
};
