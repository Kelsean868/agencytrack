import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Building2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import {
  listBranches,
  getBranch,
  setBranchActive,
} from '../../services/branchService';
import { getBranchManagers, getAllUsers } from '../../services/agentManagementService';
import StatusPill from '../ui/StatusPill';
import BranchEditorModal from './BranchEditorModal';
import DeactivateBranchConfirmDialog from './DeactivateBranchConfirmDialog';

// Compact per-role breakdown for the branch user count. Short labels keep the
// secondary line tight; order is lowest-to-highest tier so "agents" leads.
const ROLE_LABELS = {
  agent:          'agents',
  unit_manager:   'UM',
  branch_manager: 'BM',
  sales_manager:  'SM',
  tenant_admin:   'TA',
  platform_admin: 'PA',
};
const ROLE_ORDER = ['agent', 'unit_manager', 'branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'];

// roles: { [role]: count } → "2 agents, 1 UM, 1 BM" (omits zero-count roles).
// Any role not in ROLE_ORDER (a future/unrecognized role) is appended with its
// raw name so the breakdown always reconciles with the total.
function formatRoleBreakdown(roles) {
  if (!roles) return '';
  const known = ROLE_ORDER
    .filter((r) => roles[r])
    .map((r) => `${roles[r]} ${ROLE_LABELS[r]}`);
  const others = Object.keys(roles)
    .filter((r) => roles[r] && !ROLE_ORDER.includes(r))
    .map((r) => `${roles[r]} ${ROLE_LABELS[r] ?? r}`);
  return [...known, ...others].join(', ');
}

/**
 * Tenant Admin Branches management surface (Track C — C1).
 *
 * Mock-vs-code: the mock has a sidebar stub (mock:1839) and a read-only
 * Branch overview card (mock:2026-2047) on the Dashboard tab, but no
 * full management UI. This panel designs the management surface from
 * B5's tile-and-modal vocabulary and matches UserManagementPanel's
 * table-style row treatment for visual consistency across tenant-admin
 * surfaces.
 *
 * Read pattern:
 *   - On mount: Promise.all([listBranches, getBranchManagers, getAllUsers])
 *   - getAllUsers feeds the per-row TOTAL user count — all active users with
 *     branchId === thisBranchId, any role — plus a compact per-role breakdown.
 *     branchId is stamped on every user doc at creation (doCreateUser stamps it
 *     for managers too), so the branchId-keyed total captures non-agent members
 *     including the assigned branch manager. No new query.
 *   - getBranchManagers feeds the editor modal's manager dropdown.
 *
 * Backwards-compat: this surface is the only consumer of the new
 * branches collection in C1. Existing dashboards (BranchHealthCards,
 * UserManagementPanel branch dropdown) keep deriving from user.branchId
 * — those callsites are not modified in C1. When the new collection is
 * empty for a tenant, this panel renders the empty state; everything
 * else still works.
 */
export default function BranchesPanel() {
  const { tenantId, user } = useAuth();
  const toast = useToast();

  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [branchManagers, setBranchManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(null);

  const [editorMode, setEditorMode] = useState(null); // null | 'create' | 'edit'
  const [editorBranch, setEditorBranch] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setReadError(null);
    try {
      const [b, bm, u] = await Promise.all([
        listBranches(tenantId),
        getBranchManagers(tenantId),
        getAllUsers(tenantId, { includeInactive: false }),
      ]);
      setBranches(b);
      setBranchManagers(bm);
      setUsers(u);
    } catch (err) {
      setReadError(err?.message ?? 'Failed to load branches.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { reload(); }, [reload]);

  const sortedBranches = useMemo(() => {
    const list = [...branches];
    list.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aTs = a.createdAt?.toMillis?.() ?? 0;
      const bTs = b.createdAt?.toMillis?.() ?? 0;
      return bTs - aTs;
    });
    return list;
  }, [branches]);

  const managerById = useMemo(() => {
    const map = new Map();
    for (const bm of branchManagers) map.set(bm.uid, bm);
    return map;
  }, [branchManagers]);

  // Total active users per branch (all roles) + per-role breakdown, keyed by
  // branchId. Active-only (mirrors getAllUsers' own filter); the role filter is
  // intentionally dropped so the count reflects every member of the branch.
  const usersByBranch = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (u.active === false) continue;
      if (!u.branchId) continue;
      if (!u.role) continue; // malformed doc — don't inflate the total with an unrenderable role
      const entry = map.get(u.branchId) ?? { total: 0, roles: {} };
      entry.total += 1;
      entry.roles[u.role] = (entry.roles[u.role] ?? 0) + 1;
      map.set(u.branchId, entry);
    }
    return map;
  }, [users]);

  function openCreate() {
    setEditorBranch(null);
    setEditorMode('create');
  }

  async function openEdit(branchId) {
    setEditorLoading(true);
    setEditorMode(null);
    try {
      const fresh = await getBranch(tenantId, branchId);
      if (!fresh) {
        setReadError('Branch was removed by another admin. Reloading the list.');
        reload();
        return;
      }
      setEditorBranch(fresh);
      setEditorMode('edit');
    } catch (err) {
      setReadError(err?.message ?? 'Failed to open branch for editing.');
    } finally {
      setEditorLoading(false);
    }
  }

  function closeEditor() {
    setEditorMode(null);
    setEditorBranch(null);
  }

  async function handleConfirm(shouldBeActive) {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      await setBranchActive(tenantId, confirmTarget.id, shouldBeActive, user?.uid ?? null);
      setConfirmTarget(null);
      await reload();
    } catch (err) {
      const code = err?.code ?? '';
      let message;
      if (code === 'permission-denied') {
        message = "You don't have permission to manage branches.";
      } else if (
        code === 'unavailable' ||
        code === 'deadline-exceeded' ||
        code === 'cancelled'
      ) {
        message = "Couldn't reach the server. Check your connection and try again.";
      } else if (err?.message) {
        message = err.message;
      } else {
        message = 'Action failed. Please try again.';
      }
      toast.show({ variant: 'error', message });
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <section aria-labelledby="branches-panel-heading" className="card">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h2 id="branches-panel-heading" className="text-lg font-bold text-ink">
            Branches
          </h2>
          <p className="text-sm text-ink-muted mt-0.5">
            Create and manage branch records for your tenant.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={loading || !!readError}
          className="btn-primary flex items-center gap-1.5 text-sm px-3 h-11 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Plus size={15} aria-hidden="true" />
          <span>Add branch</span>
        </button>
      </div>

      {readError && (
        <div
          role="alert"
          className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink flex items-start gap-2 flex-wrap"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span className="flex-1 min-w-[200px]">{readError}</span>
          <button
            type="button"
            onClick={reload}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-border/30 animate-pulse" />
          ))}
        </div>
      ) : readError ? null : sortedBranches.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-3">
          <Building2 size={40} className="text-border" aria-hidden="true" />
          <p className="text-sm text-ink-muted italic">
            No branches yet. Click <span className="font-semibold text-ink">Add Branch</span> to create your first branch.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Card-scoped vertical + horizontal scroll (§5) — scroll lives
              inside this card, never the page. */}
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-sm border-separate border-spacing-0" aria-label="Branches roster">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[160px]">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[160px]">Manager</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[160px]">Users</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[100px]">Status</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[150px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedBranches.map((b, i) => {
                  const manager = b.managerId ? managerById.get(b.managerId) : null;
                  const managerLabel = manager?.name ?? manager?.email ?? (b.managerId ? '—' : 'Unassigned');
                  const branchUsers = usersByBranch.get(b.id) ?? { total: 0, roles: {} };
                  const userCount = branchUsers.total;
                  const roleBreakdown = formatRoleBreakdown(branchUsers.roles);
                  const inactive = b.isActive === false;
                  const zebra = i % 2 === 1 ? 'bg-card-raised/40' : '';
                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-border/60 last:border-0 ${zebra} ${inactive ? 'opacity-70' : ''}`}
                    >
                      <td className="px-3 py-3">
                        <span className="block truncate max-w-[200px] text-sm font-semibold text-ink" title={b.name}>
                          {b.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-muted">
                        <span className="block truncate max-w-[200px]" title={managerLabel}>{managerLabel}</span>
                      </td>
                      <td className="px-3 py-3 text-xs min-w-0" data-testid={`branch-user-count-${b.id}`}>
                        <span className="text-ink-muted">{userCount} {userCount === 1 ? 'user' : 'users'}</span>
                        {roleBreakdown && (
                          <span className="block text-[10px] text-ink-muted truncate max-w-[180px]" title={roleBreakdown}>
                            {roleBreakdown}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill
                          variant={inactive ? 'muted' : 'success'}
                          label={inactive ? 'Inactive' : 'Active'}
                          className="uppercase tracking-wide"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(b.id)}
                            disabled={editorLoading}
                            className="text-xs font-semibold px-2.5 h-8 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            {editorLoading ? <Loader2 size={13} className="animate-spin" aria-label="Loading" /> : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmTarget(b)}
                            className={`text-xs font-semibold px-2.5 h-8 rounded-lg transition-colors min-w-[80px] ${
                              inactive
                                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                                : 'text-danger-ink bg-danger/10 hover:bg-danger/20'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
                          >
                            {inactive ? 'Reactivate' : 'Deactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Live footer count (§5) */}
          <div
            data-testid="branches-roster-footer"
            className="px-3 py-2 border-t border-border bg-surface text-xs text-ink-muted"
          >
            {sortedBranches.length} branch{sortedBranches.length !== 1 ? 'es' : ''} •{' '}
            {sortedBranches.filter((b) => b.isActive !== false).length} active •{' '}
            {sortedBranches.filter((b) => b.isActive === false).length} inactive
          </div>
        </div>
      )}

      {editorMode && (
        <BranchEditorModal
          mode={editorMode}
          tenantId={tenantId}
          currentUid={user?.uid ?? null}
          branch={editorBranch}
          branchManagers={branchManagers}
          onClose={closeEditor}
          onSaved={() => { reload(); }}
        />
      )}

      {confirmTarget && (
        <DeactivateBranchConfirmDialog
          branch={confirmTarget}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmTarget(null)}
          loading={confirmLoading}
        />
      )}
    </section>
  );
}
