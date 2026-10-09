import React from 'react';

/** Keep a failed route chunk from unmounting the playback controls and owner. */
export class ViewErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="p-8 text-neutral-600 dark:text-neutral-300">
        <p className="font-semibold">This view could not load.</p>
        <p className="mt-2 text-sm">You can open another view or reload the app to try again.</p>
        <button type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={() => window.location.reload()}>
          Reload app
        </button>
      </div>
    );
  }
}
