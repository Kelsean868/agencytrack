import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Loader2, UserCircle, AlertTriangle, Upload, Pencil, MailPlus, Link, ChevronDown, Copy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createUser,
  deactivateUser,
  getUnitManagers,
  getAllUsers,
} from '../../services/agentManagementService';
import { listBranches } from '../../services/branchService';
import { resendInvite, getInviteLink } from '../../services/userService';
import { formatDateDisplay, formatDateFriendly, getRoleLabel, getUnitDisplayName } from '../../utils/formatters';
import { EMAIL_RE } from '../../utils/validators';
import useToast from '../../hooks/useToast';
import useFocusTrap from '../../hooks/useFocusTrap';
import Avatar from '../ui/Avatar';
import StatusPill from '../ui/StatusPill';
import ConfirmDialog from '../ui/ConfirmDialog';
import EditUserDrawer from './EditUserDrawer';
import BulkImportUsersModal from '../admin/BulkImportUsersModal';
import BulkImportGoalsModal from '../admin/BulkImportGoalsModal';

// Mirrors CREATION_MATRIX in functions/index.js
// 'cro' (Tier-3 3.1): tenant-level back-office role — creatable by
// platform_admin + tenant_admin, matching the CF matrix exactly.
const CREATABLE_ROLES = {
  platform_admin: ['platform_admin', 'tenant_admin', 'sales_manager', 'branch_manager', 'unit_manager', 'agent', 'cro'],
  tenant_admin:   ['tenant_admin', 'sales_manager', 'branch_manager', 'unit_manager', 'agent', 'cro'],
  sales_manager:  ['branch_manager', 'unit_manager', 'agent'],
  branch_manager: ['unit_manager', 'agent'],
  unit_manager:   ['agent'],
};

const ROLE_DISPLAY = {
  platform_admin: 'Platform Admin',
  tenant_admin:   'Tenant Admin',
  sales_manager:  'Sales Manager',
  branch_manager: 'Branch Manager',
  unit_manager:   'Unit Manager',
  cro:            'CRO',
  agent:          'Agent',
};


function CreateUserDrawer({ onClose, onCreated, callerRole, callerProfile, tenantId }) {
  const drawerRef = useFocusTrap({ onEscape: onClose });
  const creatableRoles = CREATABLE_ROLES[callerRole] ?? ['agent'];
  const isUnitManager  = callerRole === 'unit_manager';

  const [targetRole, setTargetRole] = useState(creatableRoles[creatableRoles.length - 1]);
  const [form, setForm] = useState({
    name: '', email: '', agentNumber: '', contractStartDate: '', unitId: '', branchId: '', unitName: '',
  });
  const [unitManagers, setUnitManagers]     = useState([]);
  const [branches, setBranches] = useState([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (isUnitManager) {
      setForm((f) => ({ ...f, unitId: callerProfile?.uid ?? callerProfile?.id ?? '' }));
      return;
    }
    if (!tenantId) return;
    getUnitManagers(tenantId).then(setUnitManagers).catch(console.error);
    listBranches(tenantId)
      .then((all) => {
        const active = all.filter((b) => b.isActive !== false);
        active.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        setBranches(active);
      })
      .catch(console.error);
    if (callerRole === 'branch_manager') {
      setForm((f) => ({ ...f, branchId: callerProfile?.branchId ?? '' }));
    }
  }, [isUnitManager, callerProfile, tenantId, callerRole]);

  const effectiveRole = isUnitManager ? 'agent' : targetRole;

  function validate() {
    if (!form.name.trim()) return 'Full name is required.';
    if (!EMAIL_RE.test(form.email)) return 'A valid email address is required.';
    if (effectiveRole === 'agent') {
      if (!form.unitId) return 'Unit assignment is required.';
      if (!form.contractStartDate) return 'Contract start date is required.';
      if (form.contractStartDate > new Date().toISOString().slice(0, 10)) {
        return 'Contract start date cannot be in the future.';
      }
    }
    if (effectiveRole === 'unit_manager' && !form.branchId) return 'Branch is required.';
    if (effectiveRole === 'branch_manager' && !form.branchId) return 'Branch is required.';
    return null;
  }

  async function handleSave() {
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      const payload = {
        role:  effectiveRole,
        name:  form.name.trim(),
        email: form.email.trim().toLowerCase(),
      };

      if (effectiveRole === 'agent') {
        payload.agentNumber       = form.agentNumber.trim();
        payload.unitId            = form.unitId;
        payload.contractStartDate = form.contractStartDate;
      } else if (effectiveRole === 'unit_manager') {
        payload.branchId = form.branchId;
        if (form.unitName.trim()) payload.unitName = form.unitName.trim();
      } else if (effectiveRole === 'branch_manager') {
        payload.branchId = form.branchId;
      } else if (effectiveRole === 'tenant_admin') {
        payload.confirmationPhrase = 'CREATE TENANT ADMIN';
      }

      const result = await createUser(payload);
      onCreated(payload.email, effectiveRole, result?.emailQueued !== false);
    } catch (err) {
      const code = err?.code ?? '';
      if (code.includes('already-exists')) {
        setError('An account with this email already exists.');
      } else if (code.includes('permission-denied')) {
        setError("You don't have permission to create this role.");
      } else if (code.includes('unimplemented')) {
        setError('Creating platform admins via this panel is not yet supported.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={onClose}
        className="flex-1 bg-black/40 border-0 p-0 m-0 cursor-pointer"
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-drawer-title"
        className="w-full max-w-md bg-card shadow-2xl flex flex-col h-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p id="create-user-drawer-title" className="text-sm font-bold text-ink">Add New User</p>
          <button aria-label="Close create user drawer" onClick={onClose} className="w-11 h-11 -m-1.5 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Role selector — hidden for unit_manager (locked to agent) */}
          {!isUnitManager && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-user-role" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Role *</label>
              <select
                id="create-user-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {creatableRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_DISPLAY[r] ?? r}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sensitive-role warning banners */}
          {effectiveRole === 'tenant_admin' && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle size={15} className="text-warning-ink mt-0.5 shrink-0" />
              <p className="text-xs text-ink">Tenant admin has full power within this company. Assign carefully.</p>
            </div>
          )}
          {effectiveRole === 'platform_admin' && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger/10 border border-danger/30">
              <AlertTriangle size={15} className="text-danger-ink mt-0.5 shrink-0" />
              <p className="text-xs text-ink">Platform admin has cross-tenant access. This role is rare — confirm intent.</p>
            </div>
          )}

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-user-name" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Full Name *</label>
            <input
              id="create-user-name"
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Jordan Smith"
              className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="create-user-email" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Email Address *</label>
            <input
              id="create-user-email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="user@example.com"
              className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Agent-specific fields */}
          {effectiveRole === 'agent' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-user-agent-number" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Agent Number</label>
                <input
                  id="create-user-agent-number"
                  type="text"
                  value={form.agentNumber}
                  onChange={set('agentNumber')}
                  placeholder="Optional"
                  className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-user-contract-start" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Contract Start Date *</label>
                <input
                  id="create-user-contract-start"
                  type="date"
                  value={form.contractStartDate}
                  onChange={set('contractStartDate')}
                  max={new Date().toISOString().slice(0, 10)}
                  className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {form.contractStartDate && (
                  <p className="text-[10px] text-ink-muted">{formatDateFriendly(form.contractStartDate)}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-user-unit" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Unit *</label>
                {isUnitManager ? (
                  <div className="h-10 px-3 rounded-lg border border-border bg-border/30 text-sm text-ink-muted flex items-center">
                    {callerProfile?.name ?? 'Your unit'} (locked)
                  </div>
                ) : (
                  <select
                    id="create-user-unit"
                    value={form.unitId}
                    onChange={set('unitId')}
                    className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Select a unit…</option>
                    {unitManagers.map((um) => (
                      <option key={um.uid} value={um.uid}>
                        {getUnitDisplayName(um)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          {/* unit_manager fields: unit name + branch */}
          {effectiveRole === 'unit_manager' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-user-unit-name" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                  Unit Name <span className="font-normal normal-case text-ink-muted">(optional)</span>
                </label>
                <input
                  id="create-user-unit-name"
                  type="text"
                  value={form.unitName}
                  onChange={set('unitName')}
                  placeholder='e.g. "Phoenix Unit"'
                  maxLength={50}
                  className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="create-user-um-branch" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Branch *</label>
                {callerRole === 'branch_manager' ? (
                  <div className="h-10 px-3 rounded-lg border border-border bg-border/30 text-sm text-ink-muted flex items-center">
                    {callerProfile?.branchId ?? 'Your branch'} (locked)
                  </div>
                ) : (
                  <select
                    id="create-user-um-branch"
                    value={form.branchId}
                    onChange={set('branchId')}
                    className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Select a branch…</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          {/* branch_manager field: branch */}
          {effectiveRole === 'branch_manager' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-user-bm-branch" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Branch *</label>
              {callerRole === 'branch_manager' ? (
                <div className="h-10 px-3 rounded-lg border border-border bg-border/30 text-sm text-ink-muted flex items-center">
                  {callerProfile?.branchId ?? 'Your branch'} (locked)
                </div>
              ) : (
                <select
                  id="create-user-bm-branch"
                  value={form.branchId}
                  onChange={set('branchId')}
                  className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">Select a branch…</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-danger-ink bg-danger/10 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Creating…</>
              : `Create ${ROLE_DISPLAY[effectiveRole] ?? 'User'} Account`}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * openCreateSignal (Tier 1 · 1.3 — TenantAdminDashboard Quick-Add): an
 * external trigger for the "Add User" create drawer. TenantAdminDashboard
 * bumps this counter when its own Quick-Add "New user" action fires; a
 * change-only effect below (initial mount skipped) opens the same
 * CreateUserDrawer the "Add User" button already opens. Defaults to 0 so
 * existing callers/tests that don't pass it are unaffected and never
 * auto-open on mount.
 */
export default function UserManagementPanel({ openCreateSignal = 0 }) {
  const { role, user: currentUser, userProfile, tenantId } = useAuth();
  const toast = useToast();

  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [showDrawer, setShowDrawer]     = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBulkImportGoals, setShowBulkImportGoals] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editTarget, setEditTarget]     = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [resendTarget, setResendTarget] = useState(null);
  const [resending, setResending]       = useState(false);
  const [inviteMenuUid, setInviteMenuUid] = useState(null);
  const [copyLinkUser, setCopyLinkUser]   = useState(null);
  const [copyLinkValue, setCopyLinkValue] = useState('');
  const [copyLinkLoading, setCopyLinkLoading] = useState(false);
  const [copied, setCopied]               = useState(false);

  const canCreate = (CREATABLE_ROLES[role]?.length ?? 0) > 0;
  const canBulkImport = role === 'tenant_admin' || role === 'platform_admin';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const list = await getAllUsers(tenantId, { includeInactive: showInactive });
      list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setUsers(list);
    } catch (err) {
      console.error('[UserManagementPanel] loadUsers:', err);
      setLoadError(true);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [showInactive, tenantId]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // External create trigger (Tier 1 · 1.3, TenantAdminDashboard Quick-Add).
  // UserManagementPanel is only mounted while the Users tab is active (see
  // `activeTab === 'users' && <UserManagementPanel .../>` in
  // TenantAdminDashboard) — it unmounts on every tab switch. That means
  // Quick-Add's "New user" action mounts this component FRESH, already
  // carrying the nonzero signal it needs to react to; a naive "skip only the
  // very first render" guard would never fire in that case. Instead this
  // tracks the last-seen signal value (seeded at the prop's neutral default,
  // 0) and opens the drawer whenever the value changes to something truthy —
  // on first mount (arrived via Quick-Add) or on a later prop change while
  // already mounted. TenantAdminDashboard resets its own counter back to 0
  // immediately after (its reset effect runs after this child effect, per
  // React's child-before-parent passive-effect order within one commit), so a
  // later plain tab click remounts with openCreateSignal back at 0 and never
  // re-opens the drawer.
  const lastSeenCreateSignal = useRef(0);
  useEffect(() => {
    if (openCreateSignal === lastSeenCreateSignal.current) return;
    lastSeenCreateSignal.current = openCreateSignal;
    if (openCreateSignal > 0) setShowDrawer(true);
  }, [openCreateSignal]);

  useEffect(() => {
    if (!copyLinkUser) return;
    function onKey(e) { if (e.key === 'Escape') setCopyLinkUser(null); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [copyLinkUser]);

  useEffect(() => {
    if (inviteMenuUid === null) return;
    function onClickOutside(e) {
      if (!e.target.closest('.invite-menu-container')) setInviteMenuUid(null);
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, [inviteMenuUid]);

  function handleCreated(email, createdRole, emailQueued) {
    setShowDrawer(false);
    loadUsers();
    const roleLabel = ROLE_DISPLAY[createdRole] ?? 'User';
    if (emailQueued) {
      toast.show({
        variant: 'success',
        message: `${roleLabel} account created. Password reset email on its way to ${email}.`,
        duration: 6000,
      });
    } else {
      toast.show({
        variant: 'warning',
        message: `${roleLabel} account created, but the password reset email may not have sent. Contact support or recreate the user if they don't receive it.`,
        duration: 10000,
      });
    }
  }

  function handleEditSaved(savedName, customMessage) {
    setEditTarget(null);
    loadUsers();
    // PR-4b: role/branch changes pass a custom message describing the sign-out
    // side effect. PR-4 field edits fall through to the generic "updated" copy.
    toast.show({
      variant: 'success',
      message: customMessage ?? `${savedName} updated.`,
      duration: customMessage ? 6000 : 4000,
    });
  }

  async function handleResendConfirm() {
    if (!resendTarget) return;
    setResending(true);
    const targetName = resendTarget.name ?? resendTarget.email;
    try {
      const result = await resendInvite(resendTarget.uid);
      setResendTarget(null);
      if (result?.emailQueued === false) {
        toast.show({
          variant: 'warning',
          message: `Resend attempted for ${targetName}, but the email may not have sent. Contact support if they don't receive it.`,
          duration: 10000,
        });
      } else {
        toast.show({
          variant: 'success',
          message: `Invite email resent to ${targetName}.`,
          duration: 4000,
        });
      }
    } catch (err) {
      console.error('[UserManagementPanel] resend invite:', err);
      const msg = err?.message?.includes('permission')
        ? "You don't have permission to do this."
        : 'Could not resend invite. Please try again.';
      toast.show({ variant: 'error', message: msg, duration: 4000 });
      setResendTarget(null);
    } finally {
      setResending(false);
    }
  }

  async function handleCopyLink(u) {
    setCopyLinkUser(u);
    setCopyLinkValue('');
    setCopyLinkLoading(true);
    setCopied(false);
    try {
      const link = await getInviteLink(u.uid);
      setCopyLinkValue(link);
    } catch (err) {
      setCopyLinkUser(null);
      const msg = err?.message?.includes('permission')
        ? "You don't have permission to do this."
        : err?.message?.includes('precondition') || err?.message?.includes('inactive')
        ? 'Cannot generate a link for an inactive account.'
        : 'Could not generate invite link. Please try again.';
      toast.show({ variant: 'error', message: msg, duration: 4000 });
    } finally {
      setCopyLinkLoading(false);
    }
  }

  async function handleCopyToClipboard() {
    if (!copyLinkValue) return;
    try {
      await navigator.clipboard.writeText(copyLinkValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.show({ variant: 'error', message: 'Could not copy to clipboard. Please copy manually.', duration: 4000 });
    }
  }

  async function handleDeactivateConfirm(active) {
    if (!deactivateTarget) return;
    setDeactivating(true);
    const targetName = deactivateTarget.name ?? deactivateTarget.email;
    try {
      await deactivateUser(deactivateTarget.uid, active);
      setDeactivateTarget(null);
      await loadUsers();
      toast.show({
        variant: 'success',
        message: active ? `${targetName} reactivated.` : `${targetName} deactivated.`,
        duration: 4000,
      });
    } catch (err) {
      console.error('[UserManagementPanel] deactivate:', err);
      const msg = err?.message?.includes('permission')
        ? "You don't have permission to do this."
        : 'Action failed. Please try again.';
      toast.show({ variant: 'error', message: msg, duration: 4000 });
      setDeactivateTarget(null);
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          User Roster{users.length > 0 ? ` — ${users.length} user${users.length !== 1 ? 's' : ''}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="text-xs h-11 px-2 transition-colors hover:text-ink"
          >
            {showInactive
              ? <span className="font-semibold text-primary">Hide inactive</span>
              : <span className="text-ink-muted">Show inactive</span>}
          </button>
          {canBulkImport && (
            <button
              onClick={() => setShowBulkImport(true)}
              className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 h-9 rounded-lg transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Upload size={14} /> Bulk Import Users
            </button>
          )}
          {canBulkImport && (
            <button
              onClick={() => setShowBulkImportGoals(true)}
              className="text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 h-9 rounded-lg transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Upload size={14} /> Bulk Import Goals
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => setShowDrawer(true)}
              className="btn-primary flex items-center gap-1.5 text-sm px-3 h-9"
            >
              <Plus size={15} /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-border/30 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="card text-center py-10 flex flex-col items-center gap-3">
          <AlertTriangle size={40} className="text-danger-ink" />
          <p className="text-sm text-ink-muted italic">Couldn&apos;t load users — check your connection and try again.</p>
          <button
            type="button"
            onClick={loadUsers}
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="card text-center py-10 flex flex-col items-center gap-3">
          <UserCircle size={40} className="text-border" />
          <p className="text-sm text-ink-muted italic">
            {showInactive ? 'No users found.' : 'No users yet — create the first user above.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Card-scoped vertical + horizontal scroll (§5) — scroll lives
              inside this card, never the page. Narrow viewports rely on the
              horizontal scroll here rather than a separate mobile layout. */}
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-sm border-separate border-spacing-0" aria-label="User roster">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[200px]">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[200px]">Email</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[130px]">Role</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[100px]">Joined</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[90px]">Status</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide text-ink-muted border-b border-border sticky top-0 z-20 bg-surface min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const joinedDate = u.createdAt?.toDate?.().toISOString().slice(0, 10) ?? '';
                  const isInactive = u.active === false;
                  const canAct = CREATABLE_ROLES[role]?.includes(u.role) && u.uid !== currentUser?.uid;
                  const zebra = i % 2 === 1 ? 'bg-card-raised/40' : '';
                  return (
                    <tr
                      key={u.uid ?? u.id}
                      className={`border-b border-border/60 last:border-0 ${zebra} ${isInactive ? 'opacity-70' : ''}`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
                          <Avatar name={u.name} size="sm" />
                          <span className="text-sm font-semibold text-ink truncate block" title={u.name ?? ''}>
                            {u.name ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-muted">
                        <span className="block truncate max-w-[220px]" title={u.email ?? ''}>{u.email ?? '—'}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-muted whitespace-nowrap">{getRoleLabel(u.role)}</td>
                      <td className="px-3 py-3 text-xs text-ink-muted whitespace-nowrap">
                        {joinedDate ? formatDateDisplay(joinedDate) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill
                          variant={isInactive ? 'danger' : 'success'}
                          label={isInactive ? 'Deactivated' : 'Active'}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end items-center gap-1">
                          {canAct && !isInactive && (
                            <button
                              type="button"
                              onClick={() => setEditTarget(u)}
                              aria-label={`Edit ${u.name ?? u.email ?? 'user'}`}
                              data-testid={`user-edit-${u.uid ?? u.id}`}
                              className="text-xs font-semibold text-ink-muted hover:text-ink bg-border/20 hover:bg-border/40 min-w-[44px] min-h-[44px] rounded-lg transition-colors flex items-center justify-center"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canAct && !isInactive && (
                            <div className="relative invite-menu-container">
                              <button
                                type="button"
                                onClick={() => setInviteMenuUid((prev) => (prev === (u.uid ?? u.id) ? null : (u.uid ?? u.id)))}
                                aria-label={`Invite options for ${u.name ?? u.email ?? 'user'}`}
                                aria-expanded={inviteMenuUid === (u.uid ?? u.id)}
                                aria-haspopup="true"
                                data-testid={`user-invite-${u.uid ?? u.id}`}
                                className="text-xs font-semibold text-ink-muted hover:text-ink bg-border/20 hover:bg-border/40 min-w-[44px] min-h-[44px] rounded-lg transition-colors flex items-center justify-center gap-0.5"
                              >
                                <Link size={14} /><ChevronDown size={11} />
                              </button>
                              {inviteMenuUid === (u.uid ?? u.id) && (
                                <div
                                  role="menu"
                                  className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-md min-w-[160px] py-1 overflow-hidden"
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { setInviteMenuUid(null); handleCopyLink(u); }}
                                    className="w-full text-left text-xs font-medium text-ink-muted hover:text-ink hover:bg-border/30 px-3 py-2.5 flex items-center gap-2 transition-colors"
                                  >
                                    <Copy size={13} /> Copy link
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => { setInviteMenuUid(null); setResendTarget(u); }}
                                    className="w-full text-left text-xs font-medium text-ink-muted hover:text-ink hover:bg-border/30 px-3 py-2.5 flex items-center gap-2 transition-colors"
                                  >
                                    <MailPlus size={13} /> Resend email
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {canAct && (
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget(u)}
                              className={`text-xs font-semibold px-2.5 min-h-[44px] rounded-lg transition-colors min-w-[80px] ${
                                isInactive
                                  ? 'text-primary bg-primary/10 hover:bg-primary/20'
                                  : 'text-danger-ink bg-danger/10 hover:bg-danger/20'
                              }`}
                            >
                              {isInactive ? 'Reactivate' : 'Deactivate'}
                            </button>
                          )}
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
            data-testid="user-roster-footer"
            className="px-3 py-2 border-t border-border bg-surface text-xs text-ink-muted"
          >
            {users.length} user{users.length !== 1 ? 's' : ''} •{' '}
            {users.filter((u) => u.active !== false).length} active •{' '}
            {users.filter((u) => u.active === false).length} deactivated
          </div>
        </div>
      )}

      {/* Create drawer */}
      {showDrawer && (
        <CreateUserDrawer
          onClose={() => setShowDrawer(false)}
          onCreated={handleCreated}
          callerRole={role}
          callerProfile={userProfile}
          tenantId={tenantId}
        />
      )}

      {/* Edit drawer */}
      {editTarget && (
        <EditUserDrawer
          user={editTarget}
          callerRole={role}
          callerProfile={userProfile}
          tenantId={tenantId}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* Deactivate dialog */}
      <ConfirmDialog
        open={Boolean(deactivateTarget) && deactivateTarget?.active !== false}
        title="Deactivate account?"
        message={<>This signs <span className="font-semibold text-ink">{deactivateTarget?.name ?? deactivateTarget?.email}</span> out immediately, blocks login, and preserves their submissions and settlements.</>}
        variant="danger"
        confirmLabel="Deactivate"
        loadingLabel="Deactivating…"
        confirmValue={deactivateTarget?.email}
        confirmValueLabel="Type their email to confirm"
        confirmValuePlaceholder={deactivateTarget?.email ?? ''}
        loading={deactivating}
        onConfirm={() => handleDeactivateConfirm(false)}
        onCancel={() => setDeactivateTarget(null)}
      />

      {/* Reactivate dialog */}
      <ConfirmDialog
        open={Boolean(deactivateTarget) && deactivateTarget?.active === false}
        title="Reactivate account?"
        message={<><span className="font-semibold text-ink">{deactivateTarget?.name ?? deactivateTarget?.email}</span> will be able to sign in and use AgencyTrack again immediately.</>}
        variant="primary"
        confirmLabel="Reactivate"
        loadingLabel="Reactivating…"
        loading={deactivating}
        onConfirm={() => handleDeactivateConfirm(true)}
        onCancel={() => setDeactivateTarget(null)}
      />

      {/* Resend invite dialog */}
      <ConfirmDialog
        open={Boolean(resendTarget)}
        title="Resend invite email?"
        message={<>A new password-reset email will be sent to <span className="font-semibold text-ink">{resendTarget?.email}</span>. Previous reset email link will stop working.</>}
        variant="primary"
        confirmLabel="Resend"
        loadingLabel="Resending…"
        loading={resending}
        onConfirm={handleResendConfirm}
        onCancel={() => setResendTarget(null)}
      />

      {/* Copy-link modal */}
      {copyLinkUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-link-title"
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-lg w-full max-w-md p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="copy-link-title" className="text-base font-semibold text-ink">Copy invite link</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  For <span className="font-medium text-ink">{copyLinkUser.name ?? copyLinkUser.email}</span>
                </p>
              </div>
              <button
                onClick={() => setCopyLinkUser(null)}
                aria-label="Close copy link modal"
                className="text-ink-muted hover:text-ink p-1 rounded-lg transition-colors mt-0.5 shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            {copyLinkLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-muted py-2">
                <Loader2 size={16} className="animate-spin" /> Generating link…
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={copyLinkValue}
                    readOnly
                    aria-label="Invite link"
                    data-testid="copy-link-input"
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => e.target.select()}
                    className="flex-1 text-xs bg-surface border border-border rounded-lg px-3 py-2.5 text-ink font-mono truncate focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={handleCopyToClipboard}
                    data-testid="copy-link-button"
                    className="btn-primary flex items-center gap-1.5 px-3 text-sm shrink-0"
                  >
                    {copied ? 'Copied!' : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
                <span aria-live="polite" className="sr-only">{copied ? 'Link copied to clipboard' : ''}</span>
                <ul className="text-xs text-ink-muted flex flex-col gap-1.5 list-disc pl-4">
                  <li>This link expires in approximately 1 hour.</li>
                  <li>Generating this link invalidates any previous invite link for this user.</li>
                  <li>Send it privately — anyone with the link can set the password.</li>
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk import users (tenant_admin / platform_admin only) */}
      {showBulkImport && (
        <BulkImportUsersModal
          tenantId={tenantId}
          onClose={() => setShowBulkImport(false)}
          onImported={() => loadUsers()}
        />
      )}

      {/* Bulk import 2026 personal commitments (tenant_admin / platform_admin only) */}
      {showBulkImportGoals && (
        <BulkImportGoalsModal
          tenantId={tenantId}
          onClose={() => setShowBulkImportGoals(false)}
          onImported={() => { /* user list does not change; no reload needed */ }}
        />
      )}
    </div>
  );
}
