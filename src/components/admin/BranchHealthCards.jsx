import { useMemo } from 'react';

/**
 * Branch overview card (Design System v2 — B5).
 *
 * Renders one inner card per branch derived from the users collection
 * (group by `branchId`). Per the locked Q9 decision, only branch ID and
 * agent count render with derived data. `% to YTD goal` and `Last sync`
 * render as `—` with a "Coming soon" sub-text — those metrics require
 * branch-level aggregations (settlements + submissions.updatedAt per
 * branch) that aren't built yet and would expand B5's scope.
 *
 * Branch ID → display name mapping is best-effort: if a humanised name is
 * available on a manager's user doc it could be used in a future PR, but
 * for B5 we render the branchId verbatim with simple title-casing.
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
            Health &amp; activity · Goal &amp; sync metrics coming in a future release
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
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-bold text-ink">{humaniseBranchId(b.branchId)}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-ink-muted/10 text-ink-muted">
                  {b.agentCount} {b.agentCount === 1 ? 'agent' : 'agents'}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                <span aria-hidden="true">— </span>
                <span>% to YTD goal</span>
                <span aria-hidden="true"> · — </span>
                <span>Last sync</span>
                <span> · Coming soon</span>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
