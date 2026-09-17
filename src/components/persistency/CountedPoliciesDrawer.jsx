import React, { useCallback, useEffect, useMemo } from 'react';
import { X, AlertTriangle, HeartPulse, ListChecks } from 'lucide-react';

import { formatCurrency } from '../../utils/formatters';

/**
 * CountedPoliciesDrawer — answers "which policies?" for a persistency figure.
 *
 * A manager told an agent is at 86.6% can open this and see the exact policies
 * behind the denominator. That is the whole reason `deriveFromLedger` returns
 * `evidence` instead of just totals: a bare percentage is not reviewable, and a
 * wrong one is not debuggable.
 *
 * THREE SECTIONS, deliberately separate (dispatcher ruling 2):
 *   1. Counted — the policies in the denominator, by number and API.
 *   2. Pending death claim — surfaced on its own so it cannot be forgotten. A
 *      death inside the grace period is NOT a lapse, and the one policy in this
 *      state is the easiest thing in the whole model to mis-handle.
 *   3. At-risk annuities — what the `lapse` rule WOULD count, with the
 *      percentage it would produce, so the cost of the switch is visible
 *      without flipping it.
 *
 * Sections 2 and 3 are not subsets of section 1 and are not summed with it.
 * Blending them is how a container gets added to its own contents.
 */
export default function CountedPoliciesDrawer({ ledger, onClose }) {
  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // API per policy number, so the list can show a figure next to each row
  // without the drawer re-deriving anything.
  const apiByNumber = useMemo(() => {
    const m = {};
    for (const a of ledger?.atRisk?.annuities ?? []) m[a.policyNumber] = a.api;
    for (const c of ledger?.atRisk?.pendingDeathClaims ?? []) m[c.policyNumber] = c.api;
    return m;
  }, [ledger]);

  if (!ledger) return null;

  const counted = ledger.evidence?.businessPlaced ?? [];
  const lapses = new Set(ledger.evidence?.lapses ?? []);
  const claims = ledger.atRisk?.pendingDeathClaims ?? [];
  const atRisk = ledger.atRisk?.annuities ?? [];

  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Policies counted for this persistency figure"
      data-testid="counted-policies-drawer"
    >
      <div className="fixed inset-0 z-40 bg-ink/20" aria-hidden="true" onClick={onClose} />

      <div className="fixed top-0 right-0 h-full w-full sm:w-[520px] z-50 bg-card shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center gap-3 px-4 py-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Counted policies · {ledger.monthKey}
            </p>
            <p className="text-base font-semibold text-ink">
              {ledger.counted} {ledger.counted === 1 ? 'policy' : 'policies'} in the denominator
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg hover:bg-card-raised flex items-center justify-center text-ink-muted shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 flex flex-col gap-5">
          {/* Window, so the list is never read against the wrong months. */}
          <p className="text-xs text-ink-muted" data-testid="counted-window">
            Issue month {ledger.window?.startMonth} to {ledger.window?.endMonth}
            {' · '}{ledger.window?.windowMonths}-month window
          </p>

          {/* ── 1. Counted ─────────────────────────────────────────────── */}
          <section data-testid="counted-section">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink mb-2">
              <ListChecks size={14} className="text-ink-muted" />
              Gross Settled — {formatCurrency(ledger.inputs?.businessPlaced ?? 0)}
            </h3>
            {counted.length === 0 ? (
              <p className="text-sm text-ink-muted">No policies in the window.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
                {counted.map((n) => (
                  <li key={n} className="flex items-center gap-2 px-3 py-2 bg-card-raised" data-testid="counted-row">
                    <span className="font-mono text-xs text-ink flex-1 min-w-0 truncate">{n}</span>
                    {lapses.has(n) && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-danger">
                        lapsed
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                      {apiByNumber[n] != null ? formatCurrency(apiByNumber[n]) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-muted mt-2">
              Lapses {formatCurrency(ledger.inputs?.lapses ?? 0)} · Not Takens {formatCurrency(ledger.inputs?.notTakens ?? 0)}
            </p>
          </section>

          {/* ── 2. Pending death claim ─────────────────────────────────── */}
          <section data-testid="death-claim-section">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink mb-2">
              <HeartPulse size={14} className="text-gold-ink" />
              Pending death claim
            </h3>
            {claims.length === 0 ? (
              <p className="text-sm text-ink-muted">None.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2.5 p-3 rounded-xl bg-gold-tint">
                  <AlertTriangle size={14} className="text-gold-ink shrink-0 mt-0.5" />
                  <p className="text-sm text-gold-ink leading-snug">
                    A death inside the grace period is <strong>not a lapse</strong>. These are counted
                    as settled with a death claim outstanding.
                  </p>
                </div>
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {claims.map((c) => (
                    <li key={c.policyNumber} className="flex items-center gap-2 px-3 py-2 bg-card-raised" data-testid="death-claim-row">
                      <span className="font-mono text-xs text-ink flex-1 min-w-0 truncate">{c.policyNumber}</span>
                      <span className="shrink-0 text-xs text-ink-muted tabular-nums">{formatCurrency(c.api)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── 3. At-risk annuities ───────────────────────────────────── */}
          <section data-testid="at-risk-section">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink mb-2">
              <AlertTriangle size={14} className="text-ink-muted" />
              At-risk annuities — {atRisk.length}
            </h3>
            {atRisk.length === 0 ? (
              <p className="text-sm text-ink-muted">None behind on premium.</p>
            ) : (
              <>
                <p className="text-xs text-ink-muted mb-2" data-testid="at-risk-explainer">
                  Settled annuities more than 60 days behind on premium. They are
                  <strong> not </strong>
                  lapses under the current setting.
                  {' '}Switching to &quot;counted as lapse&quot; would add{' '}
                  {formatCurrency(ledger.atRisk?.annuityApiTotal ?? 0)} of lapses and move
                  persistency from {pct(ledger.atRisk?.persistencyUnderIgnore ?? 0)} to{' '}
                  {pct(ledger.atRisk?.persistencyUnderLapse ?? 0)}.
                </p>
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {atRisk.map((a) => (
                    <li key={a.policyNumber} className="flex items-center gap-2 px-3 py-2 bg-card-raised" data-testid="at-risk-row">
                      <span className="font-mono text-xs text-ink flex-1 min-w-0 truncate">{a.policyNumber}</span>
                      <span className="shrink-0 text-[11px] text-ink-muted">paid to {a.paidToDate ?? '—'}</span>
                      <span className="shrink-0 text-xs text-ink-muted tabular-nums">{formatCurrency(a.api)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
