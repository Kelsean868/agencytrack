import React from 'react';

// Track K — Strategic Plan · Nexus v2 four-state wrapper (loading / error /
// empty / content). Every section renders through this so the four states are
// consistent (brief acceptance #7).
export function SectionState({
  loading, error, empty, emptyLabel = 'No data for this period yet.', onRetry, children,
}) {
  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-ink-muted" role="status" aria-live="polite">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-10 text-center" role="alert">
        <p className="text-sm font-medium text-danger-ink">Couldn’t load this section.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-[44px] items-center text-sm text-primary underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }
  if (empty) {
    return <div className="py-10 text-center text-sm text-ink-muted">{emptyLabel}</div>;
  }
  return children;
}

// Section card wrapper. `hero` applies the teal glass hero treatment; hero ink
// (text-[--hero-ink]) stays inside hero panes per the bidirectional ink guard.
export function SectionCard({ id, num, title, subtitle, hero = false, actions, children }) {
  return (
    <section
      id={id}
      data-testid={`sp-section-${id}`}
      className={`overflow-hidden rounded-2xl border border-border shadow-sm ${hero ? 'glass hero teal' : 'bg-card'}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {num && (
              <span className={`font-mono text-xs font-bold tracking-widest ${hero ? 'text-[--hero-ink-muted-teal]' : 'text-primary'}`}>
                {num}
              </span>
            )}
            <h2 className={`truncate font-display text-lg font-bold ${hero ? 'text-[--hero-ink]' : 'text-ink'}`}>
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className={`mt-0.5 text-xs ${hero ? 'text-[--hero-ink-muted-teal]' : 'text-ink-muted'}`}>{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
