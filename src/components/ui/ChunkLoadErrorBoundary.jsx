// Explicit React import — required for vitest compatibility per banked rule
// (Vite supports automatic JSX transform but vitest does not always apply it).
import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ChunkLoadErrorBoundary — catches a FAILED lazy import() from the code-split
 * dashboards (EFF-002). `<Suspense>` handles the LOADING state but does NOT catch
 * a REJECTED dynamic import — the classic case is a returning user whose cached
 * index.html requests a chunk hash that a Vercel redeploy has since deleted, or a
 * mid-load network drop (ChunkLoadError / "Failed to fetch dynamically imported
 * module"). Without this boundary the rejection propagates uncaught and
 * white-screens the app. On error we render a themed "reload" fallback.
 *
 * The Reload button does a FULL `window.location.reload()` so the browser fetches
 * a fresh index.html with valid chunk hashes — a state-only reset would just
 * re-request the same dead chunk and loop, so it is deliberately NOT used.
 *
 * Scope (EFF-002 safety FU): error boundary + reload fallback ONLY — no retry
 * loop, no chunk-preload, no analytics.
 */
class ChunkLoadErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log only (no analytics) — surfaces chunk-load failures in the browser
    // console / Vercel logs for diagnosis.
    console.error('ChunkLoadErrorBoundary caught a load error:', error, info);
  }

  handleReload() {
    // FULL reload (not a state reset) so the browser re-fetches index.html and
    // the current, valid chunk hashes.
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-surface px-6"
          data-testid="state-chunk-error"
        >
          <div className="card max-w-sm w-full text-center flex flex-col items-center gap-6 py-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-primary" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-ink mb-2">Something didn&apos;t load</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                A part of the app failed to load. Please reload to continue.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="btn-primary w-full h-11"
              data-testid="chunk-error-reload"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChunkLoadErrorBoundary;
