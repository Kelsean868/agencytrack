import React, { useMemo } from 'react';

/**
 * Branch overview card (Design System v2 — B5, TA-CLEANUP).
 *
 * Renders one inner card per branch derived from the users collection
 * (group by `branchId`), joined against the `branches/` collection for
 * the display name.
 *
 * Name resolution order:
 *   1. branches/{branchId}.name — the canonical name from the C1 surface.
 *   2. humaniseBranchId(branchId) — only when the id is slug-shaped
 *      (lowercase alnum + `_`/`-`). Preserves legacy pre-C1 slugs like
 *      "tatil_south" → "Tatil South" until those are backfilled into the
 *      branches/ collection.
 *   3. "Unnamed branch" — fallback for Firestore auto-IDs (mixed case)
 *      whose branch doc is missing. Previously the raw id rendered
 *      verbatim (e.g. "Ljbbhp1g7lbzxvhlpcdn") — that's the bug this
 *      change closes.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

function humaniseSlug(branchId) {
  return String(branchId)
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function resolveBranchName(branchId, branchById) {
  if (!branchId || branchId === '__unassigned') return 'Unassigned';
  const fromDoc = branchById?.get?.(branchId)?.name;
  if (typeof fromDoc === 'string' && fromDoc.trim()) return fromDoc.trim();
  if (SLUG_RE.test(branchId)) return humaniseSlug(branchId);
  return 'Unnamed branch';
}

export default function BranchHealthCards({ users, branches, loading }) {
  const branchById = useMemo(() => {
    const map = new Map();
    if (Array.isArray(branches)) {
      for (const b of branches) {
        if (b?.id) map.set(b.id, b);
      }
    }
    return map;
  }, [branches]);

  const grouped = useMemo(() => {
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

      {loading && grouped.length === 0 ? (
        <p className="text-sm text-ink-muted italic">Loading branches…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-ink-muted italic">
          No branches found. Branches are derived from user records.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map((b) => (
            <article
              key={b.branchId}
              className="p-3.5 rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">{resolveBranchName(b.branchId, branchById)}</h3>
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
