import React, { useMemo } from 'react';
import { PackageCheck } from 'lucide-react';
import { deriveClawback } from '../../../utils/clawbackClock';
import ClawbackChip from '../../cro/ClawbackChip';

/**
 * DeliveryStripCard — the agent's "Policies to deliver" strip on the v2 home
 * (Tier-3 3.1, un-stubbed).
 *
 * Design intent: docs/design-system/screens-v2/cro-v2-* — the agent-side view
 * of the CRO delivery pipeline. Shows the agent's OWN settled policies that are
 * not yet delivered (`policyDeliveryDate == null`), each with the 30-day
 * clawback clock (display-only, derived from `dateIssued`). Delivery is
 * confirmed by the CRO — the agent view is read-only; the strip is a nudge to
 * chase the CRO on anything approaching the deadline.
 *
 * Reuses AgentDashboard's already-loaded `policies` (getOwnPolicies, existing
 * canAccessOwn read) — no new Firestore read. Self-guard preserved: renders
 * null when there is no data or no undelivered policies, never an error.
 */
export default function DeliveryStripCard({ policies }) {
  const items = useMemo(() => {
    if (!Array.isArray(policies)) return [];
    return policies
      .filter((p) => p.status === 'settled' && p.policyDeliveryDate == null && p.dateIssued != null)
      .map((p) => ({ policy: p, clock: deriveClawback(p.dateIssued) }))
      // Most urgent first (fewest days left / most overdue).
      .sort((a, b) => {
        const da = a.clock.daysLeft == null ? Infinity : a.clock.daysLeft;
        const db = b.clock.daysLeft == null ? Infinity : b.clock.daysLeft;
        return da - db;
      });
  }, [policies]);

  if (items.length === 0) return null;

  const atRiskCount = items.filter(({ clock }) => clock.overdue || clock.atRisk).length;

  return (
    <div className="card" data-testid="delivery-strip-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <PackageCheck size={16} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-ink">Policies to deliver</h3>
        <span className="ml-auto text-xs text-ink-muted tabular-nums">{items.length}</span>
      </div>

      {atRiskCount > 0 && (
        <p className="text-xs text-warning-ink mb-2">
          {atRiskCount} approaching the 30-day clawback deadline — chase your CRO.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border/60">
        {items.map(({ policy }) => (
          <li key={policy.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{policy.ownerName ?? policy.insuredName ?? '—'}</p>
              {policy.policyNumber && (
                <p className="text-[11px] text-ink-muted tabular-nums truncate">{policy.policyNumber}</p>
              )}
            </div>
            <ClawbackChip dateIssued={policy.dateIssued} />
          </li>
        ))}
      </ul>
    </div>
  );
}
