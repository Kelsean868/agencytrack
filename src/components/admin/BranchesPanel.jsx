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
function formatRoleBreakdown(roles) {
  return ROLE_ORDER
    .filter((r) => roles[r])
    .map((r) => `${roles[r]} ${ROLE_LABELS[r] ?? r}`)
    .join(', ');
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
          className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink flex items-start gap-2"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{readError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-border/30 animate-pulse" />
          ))}
        </div>
      ) : sortedBranches.length === 0 ? (
        <div className="text-center py-10 flex flex-col items-center gap-3">
          <Building2 size={40} className="text-border" aria-hidden="true" />
          <p className="text-sm text-ink-muted italic">
            No branches yet. Click <span className="font-semibold text-ink">Add Branch</span> to create your first branch.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-3 px-3 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            <span>Name</span>
            <span>Manager</span>
            <span>Users</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {sortedBranches.map((b) => {
            const manager = b.managerId ? managerById.get(b.managerId) : null;
            const managerLabel = manager?.name ?? manager?.email ?? (b.managerId ? '—' : 'Unassigned');
            const branchUsers = usersByBranch.get(b.id) ?? { total: 0, roles: {} };
            const userCount = branchUsers.total;
            const roleBreakdown = formatRoleBreakdown(branchUsers.roles);
            const inactive = b.isActive === false;
            return (
              <div
                key={b.id}
                className={`grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-3 items-center px-3 py-3 rounded-xl border ${
                  inactive
                    ? 'bg-border/20 border-border/40 opacity-70'
                    : 'bg-card border-border'
                }`}
              >
                <span className="text-sm font-semibold text-ink truncate">{b.name}</span>
                <span className="text-xs text-ink-muted truncate">{managerLabel}</span>
                <div className="text-xs min-w-0" data-testid={`branch-user-count-${b.id}`}>
                  <span className="text-ink-muted">{userCount} {userCount === 1 ? 'user' : 'users'}</span>
                  {roleBreakdown && (
                    <span className="block text-[10px] text-ink-muted truncate" title={roleBreakdown}>
                      {roleBreakdown}
                    </span>
                  )}
                </div>
                <span>
                  {inactive ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-ink-muted/10 text-ink-muted">
                      Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-success/15 text-success-ink">
                      Active
                    </span>
                  )}
                </span>
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
              </div>
            );
          })}
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
