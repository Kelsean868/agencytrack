// Explicit React import — required for vitest compatibility per banked rule
// (Vite supports automatic JSX transform but vitest does not always apply it).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { registerSignOutConfirmHandler } from '../../lib/signOutConfirmBridge';

/**
 * SignOutConfirmHost (SEC-10 in-PR extension) — mounted once at the app root
 * (main.jsx). Renders the "you have unsynced changes" ConfirmDialog on
 * demand, driven by authService.signOut() via signOutConfirmBridge.js.
 *
 * Registers a Promise-returning handler on mount: calling it opens the
 * dialog and returns a Promise that resolves true (confirmed — proceed with
 * sign-out) or false (cancelled — stay signed in, nothing cleared).
 */
export default function SignOutConfirmHost() {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef(null);

  const handler = useCallback(() => new Promise((resolve) => {
    resolveRef.current = resolve;
    setOpen(true);
  }), []);

  useEffect(() => {
    registerSignOutConfirmHandler(handler);
    return () => registerSignOutConfirmHandler(null);
  }, [handler]);

  const settle = (value) => {
    setOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  };

  return (
    <ConfirmDialog
      open={open}
      title="Unsaved changes"
      message="You have changes that haven't synced yet. Sign out anyway?"
      confirmLabel="Sign out"
      cancelLabel="Cancel"
      variant="warning"
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
}
