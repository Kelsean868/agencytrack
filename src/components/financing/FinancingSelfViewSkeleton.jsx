// PERF-01 — FinancingSelfView's own "loading" placeholder, lifted out of the
// lazy-loaded component so it can also serve as the React.lazy() Suspense
// fallback (see AgentDashboard.jsx / ManagerDashboard.jsx). Keeping this in
// its own tiny, eagerly-imported file means the fallback renders instantly
// on tab-open — it never waits on the FinancingSelfView chunk it is a
// placeholder FOR (that would defeat the point of lazy-loading it). The
// markup is identical to what FinancingSelfView itself showed inline before
// PERF-01, so the chunk-load wait and the component's own first data-fetch
// wait render as one continuous, unbroken loading state instead of two
// different-looking spinners back to back.
import React from 'react';

export default function FinancingSelfViewSkeleton() {
  return (
    <div
      className="flex items-center justify-center h-28 rounded-xl border border-border bg-card-raised text-ink-muted text-sm"
      data-testid="financing-self-view"
    >
      Loading your financing…
    </div>
  );
}
