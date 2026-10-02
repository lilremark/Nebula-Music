import React from 'react';
import { createPortal } from 'react-dom';

// Keep overlays outside animated views and inside the central content pane.
export const ContentModal: React.FC<{
  kind: 'search' | 'radio';
  onDismiss: () => void;
  children: React.ReactNode;
}> = ({ kind, onDismiss, children }) => createPortal(
  <div className="nebula-content-modal" data-nebula-content-modal={kind} onKeyDown={event => {
    if (event.key === 'Escape') onDismiss();
  }}>
    <div className="nebula-content-backdrop" data-nebula-modal-backdrop onClick={onDismiss} />
    {children}
  </div>,
  document.querySelector('[data-nebula-content-shell]') || document.body,
);
