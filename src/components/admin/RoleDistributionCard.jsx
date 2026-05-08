import { useMemo } from 'react';

/**
 * Users-by-role distribution card (Design System v2 — B5).
 *
 * Renders 5 horizontal bars matching the mock — Agents, Unit Managers,
 * Branch Managers, Sales Managers, Tenant Admins — sized proportionally
 * against the total user count.
 *
 * Reads from the `users` array passed in by the parent. Parent owns the
 * fetch (TenantAdminDashboard calls getTenantUsers() once and shares the
 * result with this card and BranchHealthCards).
 *
 * The "Manage roles & permissions" CTA in the mock points to a surface
 * that does not yet exist in the codebase. Per the locked stub-vs-defer
 * matrix, this is rendered as a disabled button with a "Coming soon"
 * affordance — NOT a route to a 404.
 */
const ROLES = [
  { key: 'agent',          label: 'Agents',          variant: 'primary' },
  { key: 'unit_manager',   label: 'Unit Managers',   variant: 'success' },
  { key: 'branch_manager', label: 'Branch Managers', variant: 'warning' },
  { key: 'sales_manager',  label: 'Sales Managers',  variant: 'gold'    },
  { key: 'tenant_admin',   label: 'Tenant Admins',   variant: 'ink'     },
];

export default function RoleDistributionCard({ users, loading }) {
  const counts = useMemo(() => {
    const map = { agent: 0, unit_manager: 0, branch_manager: 0, sales_manager: 0, tenant_admin: 0 };
    if (!Array.isArray(users)) return map;
    for (const u of users) {
      if (u.role && map[u.role] !== undefined) map[u.role] += 1;
    }
    return map;
  }, [users]);

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const safeTotal = total > 0 ? total : 1;

  return (
    <section aria-labelledby="role-distribution-heading" className="card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 id="role-distribution-heading" className="text-lg font-bold text-ink">
            Users by role
          </h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {loading ? 'Loading…' : `Total: ${total}`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {ROLES.map((role) => {
          const count = counts[role.key];
          const widthPct = (count / safeTotal) * 100;
          return (
            <div key={role.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-ink">{role.label}</span>
                <span className="text-sm font-bold text-ink">{count}</span>
              </div>
              <div className="role-bar" role="presentation">
                <div
                  className={`role-bar-fill role-bar-fill-${role.variant}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-5 w-full h-11 rounded-lg border border-border text-sm font-semibold text-ink-muted opacity-60 cursor-not-allowed"
        title="Roles & Permissions surface is coming in a future release"
      >
        Manage roles &amp; permissions · Coming soon
      </button>
    </section>
  );
}
