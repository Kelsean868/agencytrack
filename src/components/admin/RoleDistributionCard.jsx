import React, { useMemo } from 'react';
import PanelSkeleton, { SkeletonText } from '../ui/PanelSkeleton';

/**
 * Users-by-role distribution card (Design System v2 — B5, TA-CLEANUP).
 *
 * Renders 5 horizontal bars matching the mock — Agents, Unit Managers,
 * Branch Managers, Sales Managers, Tenant Admins — sized proportionally
 * against the total user count.
 *
 * Reads from the `users` array passed in by the parent. Parent owns the
 * fetch (TenantAdminDashboard calls getTenantUsers() once and shares the
 * result with this card and BranchHealthCards).
 *
 * TA-CLEANUP removed the previous "Manage roles & permissions · Coming
 * soon" disabled CTA per the manager-portal audit's "no placeholder text
 * in production" guidance. The CTA can return once a real Roles &
 * Permissions surface exists.
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
            <SkeletonText loading={loading} reserveCh={10}>{`Total: ${total}`}</SkeletonText>
          </p>
        </div>
      </div>

      {loading ? (
        <PanelSkeleton variant="list" count={5} label="Loading users by role…" />
      ) : (
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
      )}

    </section>
  );
}
