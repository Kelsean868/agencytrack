// Explicit React import — required for vitest compatibility per banked rule
// (Vite supports automatic JSX transform but vitest does not always apply it).
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { isFirestoreAssertionFailure, repairFirestoreCache } from '../../lib/firestoreRecovery';

/**
 * FirestoreCorruptionBoundary (SEC-10) — wraps the whole app (see main.jsx)
 * and catches the Firestore `INTERNAL ASSERTION FAILED` family two ways:
 *
 *  1. Render-time throw → getDerivedStateFromError/componentDidCatch, the
 *     standard React error-boundary path.
 *  2. Async throw ("at app start") → most Firestore internal-assertion
 *     failures actually surface as a rejected promise or an uncaught throw
 *     inside the SDK's own IndexedDB job queue, never inside a React
 *     render, so an error boundary alone never sees them. componentDidMount
 *     registers window 'error' / 'unhandledrejection' listeners as early as
 *     this component mounts — the top of the tree — so they're live for
 *     the whole session, including the initial data load that the
 *     2026-09-23 incident (ID: b815) got stuck on.
 *
 * Both paths converge on the same fallback UI and the same
 * repairFirestoreCache() (src/lib/firestoreRecovery.js), which clears ONLY
 * the Firestore IndexedDB cache — never the Firebase Auth store.
 *
 * A non-matching render error is deliberately rethrown from
 * getDerivedStateFromError so React looks for a boundary above this one;
 * since this is the outermost boundary, that reproduces the pre-existing
 * behavior (an uncaught render error unmounts the tree) for any error this
 * component does not own — no scope creep into a general-purpose catch-all.
 */
class FirestoreCorruptionBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, repairing: false };
    this.handleRepair = this.handleRepair.bind(this);
    this.handleWindowError = this.handleWindowError.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
  }

  static getDerivedStateFromError(error) {
    if (isFirestoreAssertionFailure(error)) return { hasError: true };
    throw error;
  }

  componentDidCatch(error, info) {
    console.error('[FirestoreCorruptionBoundary] caught during render:', error, info);
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleWindowError(event) {
    const err = event?.error ?? event?.message;
    if (isFirestoreAssertionFailure(err)) {
      console.error('[FirestoreCorruptionBoundary] caught via window error event:', err);
      this.setState({ hasError: true });
    }
  }

  handleUnhandledRejection(event) {
    if (isFirestoreAssertionFailure(event?.reason)) {
      console.error('[FirestoreCorruptionBoundary] caught via unhandledrejection:', event.reason);
      this.setState({ hasError: true });
    }
  }

  async handleRepair() {
    this.setState({ repairing: true });
    await repairFirestoreCache();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-surface px-6"
          data-testid="state-firestore-corrupt"
          role="alert"
        >
          <div className="card max-w-sm w-full text-center flex flex-col items-center gap-6 py-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-ink mb-2">
                The app&apos;s saved data is damaged
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                AgencyTrack&apos;s local data cache on this device has become corrupted.
                Repairing clears that cache only — you&apos;ll stay signed in.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleRepair}
              disabled={this.state.repairing}
              className="btn-primary w-full h-11"
              data-testid="firestore-repair-button"
            >
              {this.state.repairing ? 'Repairing…' : 'Repair app data'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default FirestoreCorruptionBoundary;
