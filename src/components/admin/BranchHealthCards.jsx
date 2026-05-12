import React, { useMemo } from 'react';

/**
 * Branch overview card (Design System v2 — B5, TA-CLEANUP).
 *
 * Renders one inner card per branch derived from the users collection
 * (group by `branchId`). Only branch ID and agent count render with
 * derived data today.
 *
 * TA-CLEANUP removed the prior per-branch placeholder line ("— % to YTD
 * goal · — Last sync · Coming soon") per the manager-portal audit's "no
 * placeholder text in production" guidance. Branch-level aggregations
 * (settlements + submissions.updatedAt per branch) can re-introduce those
 * metrics when the data is real.
 *
 * Branch ID → display name mapping is best-effort: if a humanised name is
 * available on a manager's user doc it could be used in a future PR, but
 * here we render the branchId verbatim with simple title-casing.
 */
function humaniseBranchId(branchId) {
  if (!branchId) return 'Unassigned';
  return String(branchId)
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default function BranchHealthCards({ users, loading }) {
  const branches = useMemo(() => {
    if (!Array.isArray(users)) return [];
    const groups = new Map();
    for (const u of users) {
      const key = u.branchId ?? '__unassigned';
      if (!groups.has(key)) groups.set(key, { branchId: key, agentCount: 0, total: 0 });
      const g = groups.get(key);
      g.total += 1;
      if (u.role === 'agent') g.agentCount += 1;
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [users]);

  return (
    <section aria-labelledby="branch-overview-heading" className="card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 id="branch-overview-heading" className="text-lg font-bold text-ink">
            Branch overview
          </h2>
          <p className="text-sm text-ink-muted mt-0.5">
            Branches &amp; agent assignment
          </p>
        </div>
      </div>

      {loading && branches.length === 0 ? (
        <p className="text-sm text-ink-muted italic">Loading branches…</p>
      ) : branches.length === 0 ? (
        <p className="text-sm text-ink-muted italic">
          No branches found. Branches are derived from user records.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {branches.map((b) => (
            <article
              key={b.branchId}
              className="p-3.5 rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">{humaniseBranchId(b.branchId)}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-ink-muted/10 text-ink-muted">
                  {b.agentCount} {b.agentCount === 1 ? 'agent' : 'agents'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
