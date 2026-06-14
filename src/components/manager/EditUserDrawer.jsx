import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { getUnitManagers } from '../../services/agentManagementService';
import { listBranches } from '../../services/branchService';
import {
  updateUserFields,
  callUpdateUser,
  MANAGER_EDITABLE_FIELDS,
  setLeaderboardVisibility,
} from '../../services/userService';
import { getRoleLabel, getUnitDisplayName } from '../../utils/formatters';
import Avatar from '../ui/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';

const GAME_PLAN_LOOP_ENABLED = import.meta.env.VITE_GAME_PLAN_LOOP_ENABLED !== 'false';

// Mirror of functions/index.js CREATION_MATRIX. Two-sided gate: caller must be
// able to create both the target's current role AND the target's new role.
const CREATION_MATRIX = {
  platform_admin: ['platform_admin', 'tenant_admin', 'sales_manager', 'branch_manager', 'unit_manager', 'agent'],
  tenant_admin:   ['tenant_admin', 'sales_manager', 'branch_manager', 'unit_manager', 'agent'],
  sales_manager:  ['branch_manager', 'unit_manager', 'agent'],
  branch_manager: ['unit_manager', 'agent'],
  unit_manager:   ['agent'],
};

const CROSS_BRANCH_ROLES = ['platform_admin', 'tenant_admin', 'sales_manager'];

const ROLE_DISPLAY = {
  platform_admin: 'Platform Admin',
  tenant_admin:   'Tenant Admin',
  sales_manager:  'Sales Manager',
  branch_manager: 'Branch Manager',
  unit_manager:   'Unit Manager',
  agent:          'Agent',
};

// Editor-role × target-role capability matrix for PR-4 fields (non-claim).
function getEditableFieldsFor(editorRole, targetRole) {
  const fields = new Set(['name', 'phone', 'bio']);

  if (targetRole === 'agent' && editorRole !== 'unit_manager') {
    fields.add('unitId');
    fields.add('agentNumber');
    fields.add('contractStartDate');
    fields.add('licenseStatus');
    fields.add('cbttExamPassedDate');
    fields.add('cbttExtensionGranted');
    fields.add('licenseProfile');
  }

  if (targetRole === 'unit_manager' && editorRole !== 'unit_manager') {
    fields.add('unitName');
    if (editorRole === 'tenant_admin' || editorRole === 'platform_admin') {
      fields.add('canConfirmSettlements');
    }
  }

  return fields;
}

// Allowed role transitions for an editor on a target. Mirrors CF's two-sided
// CREATION_MATRIX gate. platform_admin is always excluded (cross-tenant).
function getAllowedRoleTransitions(editorRole, targetCurrentRole) {
  const editorCreatable = CREATION_MATRIX[editorRole] ?? [];
  if (!editorCreatable.includes(targetCurrentRole)) return [];
  return editorCreatable.filter(
    (r) => r !== targetCurrentRole && r !== 'platform_admin'
  );
}

function normaliseSaveValue(key, raw) {
  if (key === 'canConfirmSettlements') return Boolean(raw);
  if (key === 'cbttExtensionGranted') return Boolean(raw);
  if (typeof raw === 'string') return raw.trim();
  return raw ?? '';
}

const TODAY = () => new Date().toISOString().slice(0, 10);
const TENANT_ADMIN_PHRASE = 'PROMOTE TO TENANT ADMIN';

export default function EditUserDrawer({
  user,
  callerRole,
  callerProfile,
  tenantId,
  onClose,
  onSaved,
}) {
  const editable = useMemo(
    () => getEditableFieldsFor(callerRole, user?.role),
    [callerRole, user?.role]
  );

  const allowedRoleTransitions = useMemo(
    () => getAllowedRoleTransitions(callerRole, user?.role),
    [callerRole, user?.role]
  );

  const canEditBranch = CROSS_BRANCH_ROLES.includes(callerRole)
    && (CREATION_MATRIX[callerRole]?.includes(user?.role) ?? false);

  const [form, setForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    bio: user?.bio ?? '',
    unitId: user?.unitId ?? '',
    unitName: user?.unitName ?? '',
    agentNumber: user?.agentNumber ?? '',
    contractStartDate: user?.contractStartDate ?? '',
    canConfirmSettlements: Boolean(user?.canConfirmSettlements),
    licenseStatus: user?.licenseStatus ?? '',
    cbttExamPassedDate: user?.cbttExamPassedDate ?? '',
    cbttExtensionGranted: Boolean(user?.cbttExtensionGranted),
    licenseProfile: user?.licenseProfile ?? '',
    role: user?.role ?? '',
    branchId: user?.branchId ?? '',
  });

  const [unitManagers, setUnitManagers] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [hiddenFromLb, setHiddenFromLb] = useState(Boolean(user?.hiddenFromLeaderboard));
  const [hiddenSaving, setHiddenSaving] = useState(false);
  const [hiddenError, setHiddenError] = useState(null);

  const firstFieldRef = useRef(null);

  const roleChanged   = form.role !== (user?.role ?? '');
  const branchChanged = (form.branchId ?? '') !== (user?.branchId ?? '');
  const demotingToAgent = roleChanged && form.role === 'agent' && user?.role !== 'agent';
  const promotingToTenantAdmin = roleChanged && form.role === 'tenant_admin';

  // Show unit dropdown when target IS an agent (existing PR-4 behavior) OR
  // when demoting to agent (PR-4b: Q3 locked — require explicit unit pick).
  const showUnitDropdown = editable.has('unitId') || demotingToAgent;

  // Load unit-managers list when the unit dropdown is reachable.
  useEffect(() => {
    if (!showUnitDropdown || !tenantId) return;
    let cancelled = false;
    setLoadingUnits(true);
    getUnitManagers(tenantId)
      .then((list) => {
        if (cancelled) return;
        // Branch managers see units in their own branch only. Cross-branch
        // callers (sales_manager / tenant_admin / platform_admin) see units
        // in the user's target branch if one is selected, else all.
        let filtered = list;
        if (callerRole === 'branch_manager') {
          filtered = list.filter((u) => u.branchId === callerProfile?.branchId);
        } else if (CROSS_BRANCH_ROLES.includes(callerRole)) {
          const scopeBranchId = form.branchId || user?.branchId;
          if (scopeBranchId) {
            filtered = list.filter((u) => u.branchId === scopeBranchId);
          }
        }
        setUnitManagers(filtered);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[EditUserDrawer] getUnitManagers:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingUnits(false);
      });
    return () => { cancelled = true; };
  }, [showUnitDropdown, tenantId, callerRole, callerProfile?.branchId, form.branchId, user?.branchId]);

  // Load active branches list when branch is editable.
  useEffect(() => {
    if (!canEditBranch || !tenantId) return;
    let cancelled = false;
    setLoadingBranches(true);
    listBranches(tenantId)
      .then((list) => {
        if (cancelled) return;
        setBranches(list.filter((b) => b.isActive === true));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[EditUserDrawer] listBranches:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingBranches(false);
      });
    return () => { cancelled = true; };
  }, [canEditBranch, tenantId]);

  // ESC + initial focus management.
  useEffect(() => {
    const focusRaf = requestAnimationFrame(() => firstFieldRef.current?.focus());
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(focusRaf);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, saving]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function branchNameForId(branchId) {
    if (!branchId) return '—';
    const b = branches.find((x) => x.id === branchId);
    return b?.name ?? branchId;
  }

  function unitNameForId(unitId) {
    if (!unitId) return '—';
    const um = unitManagers.find((u) => (u.uid ?? u.id) === unitId);
    return um ? getUnitDisplayName(um) : unitId;
  }

  function validate() {
    const name = form.name.trim();
    if (!name) return 'Full name is required.';
    if (name.length < 2) return 'Full name must be at least 2 characters.';
    if (name.length > 100) return 'Full name must be 100 characters or fewer.';
    if (form.bio.length > 500) return 'Bio must be 500 characters or fewer.';
    if (form.unitName.length > 50) return 'Unit name must be 50 characters or fewer.';

    if (editable.has('contractStartDate') && form.contractStartDate) {
      if (form.contractStartDate > TODAY()) {
        return 'Contract start date cannot be in the future.';
      }
    }

    if (editable.has('unitId') && user?.role === 'agent' && !form.unitId) {
      return 'Unit assignment is required for agents.';
    }
    if (demotingToAgent && !form.unitId) {
      return 'Select a unit before demoting to agent.';
    }
    return null;
  }

  function buildPr4Diff() {
    const diff = {};
    for (const key of MANAGER_EDITABLE_FIELDS) {
      if (!editable.has(key)) continue;
      const current = normaliseSaveValue(key, user?.[key]);
      const next = normaliseSaveValue(key, form[key]);
      if (current !== next) diff[key] = next;
    }
    return diff;
  }

  function buildCfUpdates() {
    const updates = {};
    if (roleChanged && allowedRoleTransitions.includes(form.role)) {
      updates.role = form.role;
    }
    if (branchChanged && canEditBranch && form.branchId) {
      updates.branchId = form.branchId;
    }
    if (demotingToAgent && form.unitId) {
      updates.unitId = form.unitId;
    }
    return updates;
  }

  // Map Firebase HttpsError code/message → user-facing copy.
  function mapCfError(err) {
    const code = err?.code ?? '';
    const msg  = err?.message ?? '';
    if (code.includes('unauthenticated') || /Session/i.test(msg)) {
      return 'Session expired. Please sign in again.';
    }
    if (code.includes('permission-denied') || /permission/i.test(msg)) {
      return "You don't have permission to make this change.";
    }
    if (code.includes('failed-precondition')) {
      return msg || 'Update blocked by a precondition. Check branch + unit setup.';
    }
    if (code.includes('not-found')) {
      return 'User not found. The roster may be stale — refreshing.';
    }
    if (code.includes('unimplemented')) {
      return 'This change is not supported in this version.';
    }
    if (code.includes('invalid-argument')) {
      if (/typed confirmation/i.test(msg)) return 'Typed confirmation required to promote to Tenant Admin.';
      if (/already has this role/i.test(msg)) return 'User already has this role.';
      if (/already in this branch/i.test(msg)) return 'User already in this branch.';
      if (/unitId is required/i.test(msg)) return 'Select a unit before demoting to agent.';
      if (/branch.*not active/i.test(msg)) return 'Selected branch is not active.';
      return msg || 'Update rejected — check the form fields.';
    }
    if (code.includes('internal')) {
      return 'Update failed and was rolled back. Please retry.';
    }
    return 'Update failed. Please try again or contact support.';
  }

  function buildSuccessMessage(pr4Diff, cfUpdates) {
    const name = form.name.trim() || user?.name || user?.email || 'User';
    const parts = [];
    if (cfUpdates.role) {
      parts.push(`role updated to ${ROLE_DISPLAY[cfUpdates.role] ?? cfUpdates.role}`);
    }
    if (cfUpdates.branchId) {
      parts.push(`reassigned to ${branchNameForId(cfUpdates.branchId)}`);
    }
    if (parts.length === 0) return `${name} updated.`;
    return `${name}'s ${parts.join(' and ')}. They will be signed out and must sign in again.`;
  }

  async function runSave(pr4Diff, cfUpdates, confirmationPhrase) {
    setSaving(true);
    setError('');
    const hasPr4 = Object.keys(pr4Diff).length > 0;
    const hasCf  = Object.keys(cfUpdates).length > 0;
    // CF rejects unitId when no role change present, so strip it when only
    // a branch-only edit is being submitted.
    if (hasCf && !cfUpdates.role && cfUpdates.unitId) {
      delete cfUpdates.unitId;
    }
    try {
      if (hasPr4) {
        await updateUserFields(tenantId, user.uid ?? user.id, pr4Diff);
      }
      if (hasCf) {
        await callUpdateUser({
          uid: user.uid ?? user.id,
          updates: cfUpdates,
          confirmationPhrase: confirmationPhrase || undefined,
        });
      }
      // PR-4 path stays 1-arg for backward compat with existing tests +
      // call sites. PR-4b CF path passes the descriptive sign-out message.
      if (hasCf) {
        onSaved?.(form.name.trim(), buildSuccessMessage(pr4Diff, cfUpdates));
      } else {
        onSaved?.(form.name.trim());
      }
    } catch (err) {
      console.error('[EditUserDrawer] save failed:', err);
      if (Object.keys(cfUpdates).length > 0) {
        setError(mapCfError(err));
      } else {
        const message = err?.message?.includes('Missing or insufficient permissions')
          ? "You don't have permission to make this change."
          : err?.message?.includes('Disallowed field')
            ? 'Internal error: tried to save a restricted field.'
            : 'Update failed. Please try again.';
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const pr4Diff   = buildPr4Diff();
    const cfUpdates = buildCfUpdates();

    if (Object.keys(pr4Diff).length === 0 && Object.keys(cfUpdates).length === 0) {
      setError('No changes to save.');
      return;
    }

    // Confirmation routing. CF changes always require confirmation (sign-out
    // is destructive). unitId-only reassignment uses the existing PR-4 dialog.
    if (cfUpdates.role || cfUpdates.branchId) {
      const newRoleLabel   = cfUpdates.role     ? (ROLE_DISPLAY[cfUpdates.role] ?? cfUpdates.role) : null;
      const oldRoleLabel   = cfUpdates.role     ? (ROLE_DISPLAY[user?.role] ?? user?.role) : null;
      const newBranchName  = cfUpdates.branchId ? branchNameForId(cfUpdates.branchId) : null;
      const oldBranchName  = cfUpdates.branchId ? branchNameForId(user?.branchId) : null;
      const targetName     = form.name.trim() || user?.name || user?.email || 'this user';

      let variant = 'warning';
      let title;
      let message;
      let confirmLabel;
      let confirmValue;
      let confirmValueLabel;

      if (promotingToTenantAdmin) {
        variant = 'danger';
        title = 'Promote to Tenant Admin?';
        confirmLabel = 'Promote';
        confirmValue = TENANT_ADMIN_PHRASE;
        confirmValueLabel = `Type "${TENANT_ADMIN_PHRASE}" to confirm`;
        message = (
          <>
            Promote <span className="font-semibold text-ink">{targetName}</span> from{' '}
            <span className="font-semibold text-ink">{oldRoleLabel}</span> to{' '}
            <span className="font-semibold text-ink">Tenant Admin</span>. They will gain
            full access within this tenant — including the ability to create and
            edit other admins. They will be signed out immediately and must sign
            in again with the new permissions.
          </>
        );
      } else if (cfUpdates.role && cfUpdates.branchId) {
        title = 'Change role and branch?';
        confirmLabel = 'Apply changes';
        message = (
          <>
            Change <span className="font-semibold text-ink">{targetName}</span>&rsquo;s role
            to <span className="font-semibold text-ink">{newRoleLabel}</span> and reassign
            to <span className="font-semibold text-ink">{newBranchName}</span>?
            They will be signed out immediately and must sign in again. Their
            historical submissions and goals stay attached to their original branch/unit.
          </>
        );
      } else if (cfUpdates.role) {
        title = 'Change role?';
        confirmLabel = 'Change role';
        message = (
          <>
            Change <span className="font-semibold text-ink">{targetName}</span>&rsquo;s role
            from <span className="font-semibold text-ink">{oldRoleLabel}</span> to{' '}
            <span className="font-semibold text-ink">{newRoleLabel}</span>?
            They will be signed out immediately and must sign in again with the new
            permissions. Their submission history stays attached to their account.
          </>
        );
      } else {
        title = 'Reassign branch?';
        confirmLabel = 'Reassign';
        message = (
          <>
            Reassign <span className="font-semibold text-ink">{targetName}</span> from{' '}
            <span className="font-semibold text-ink">{oldBranchName}</span> to{' '}
            <span className="font-semibold text-ink">{newBranchName}</span>?
            They will be signed out immediately and must sign in again. Their
            existing submissions stay attached to {oldBranchName}.
          </>
        );
      }

      setPendingConfirm({
        kind: 'cf',
        pr4Diff,
        cfUpdates,
        confirmationPhrase: promotingToTenantAdmin ? TENANT_ADMIN_PHRASE : null,
        title,
        message,
        variant,
        confirmLabel,
        confirmValue,
        confirmValueLabel,
      });
      return;
    }

    // PR-4 unitId reassignment confirmation (existing behavior — applies when
    // unitId changes but role does not).
    if ('unitId' in pr4Diff && user?.role === 'agent') {
      setPendingConfirm({
        kind: 'unit',
        pr4Diff,
        cfUpdates: {},
        confirmationPhrase: null,
        title: 'Reassign unit?',
        message: (
          <>
            Reassign <span className="font-semibold text-ink">{form.name.trim() || user.name}</span> from{' '}
            <span className="font-semibold text-ink">{unitNameForId(user.unitId)}</span> to{' '}
            <span className="font-semibold text-ink">{unitNameForId(pr4Diff.unitId)}</span>?
            Their submission history will remain attached to their old unit.
          </>
        ),
        variant: 'warning',
        confirmLabel: 'Reassign',
      });
      return;
    }

    await runSave(pr4Diff, cfUpdates, null);
  }

  async function handleToggleHiddenFromLb(e) {
    const next = e.target.checked;
    setHiddenFromLb(next);
    setHiddenSaving(true);
    setHiddenError(null);
    try {
      await setLeaderboardVisibility(tenantId, user.uid ?? user.id, next);
    } catch (err) {
      setHiddenFromLb(!next);
      setHiddenError(err?.message ?? 'Failed to update visibility');
    } finally {
      setHiddenSaving(false);
    }
  }

  if (!user) return null;

  const targetRoleLabel = getRoleLabel(user.role);
  const showRoleDropdown   = allowedRoleTransitions.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Close drawer"
        onClick={() => !saving && onClose()}
        className="flex-1 bg-black/40 border-0 p-0 m-0 cursor-pointer"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-drawer-title"
        data-testid="edit-user-drawer"
        className="w-full max-w-md bg-card shadow-2xl flex flex-col h-full overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p id="edit-user-drawer-title" className="text-sm font-bold text-ink">Edit User</p>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            aria-label="Close drawer"
            className="w-11 h-11 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-border/40 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Identity card (read-only) */}
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-border/20 border border-border">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{user.name ?? '—'}</p>
              <p className="text-xs text-ink-muted truncate">{user.email ?? '—'}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mt-0.5">{targetRoleLabel}</p>
            </div>
          </div>

          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-name" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Full Name *</label>
            <input
              ref={firstFieldRef}
              id="edit-user-name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              maxLength={100}
              className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-phone" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Phone</label>
            <input
              id="edit-user-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="edit-user-bio" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Bio</label>
            <textarea
              id="edit-user-bio"
              value={form.bio}
              onChange={(e) => setField('bio', e.target.value)}
              placeholder="Optional"
              rows={3}
              maxLength={500}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          {/* Agent-only fields */}
          {editable.has('agentNumber') && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-agent-number" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Agent Number</label>
              <input
                id="edit-user-agent-number"
                type="text"
                value={form.agentNumber}
                onChange={(e) => setField('agentNumber', e.target.value)}
                placeholder="Optional"
                className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {editable.has('contractStartDate') && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-contract-start" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Contract Start Date</label>
              <input
                id="edit-user-contract-start"
                type="date"
                value={form.contractStartDate}
                onChange={(e) => setField('contractStartDate', e.target.value)}
                max={TODAY()}
                className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {editable.has('licenseStatus') && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-license-status" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">License Status</label>
              <select
                id="edit-user-license-status"
                value={form.licenseStatus}
                onChange={(e) => setField('licenseStatus', e.target.value)}
                className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">— Not tracked —</option>
                <option value="provisional">Provisional</option>
                <option value="official">Official</option>
              </select>
            </div>
          )}

          {editable.has('cbttExamPassedDate') && form.licenseStatus === 'official' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-cbtt-passed" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">CBTT Exam Passed Date</label>
              <input
                id="edit-user-cbtt-passed"
                type="date"
                value={form.cbttExamPassedDate}
                onChange={(e) => setField('cbttExamPassedDate', e.target.value)}
                max={TODAY()}
                className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {editable.has('cbttExtensionGranted') && form.licenseStatus === 'provisional' && (
            <label
              htmlFor="edit-user-cbtt-extension"
              className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border cursor-pointer hover:bg-border/20 transition-colors"
            >
              <input
                id="edit-user-cbtt-extension"
                type="checkbox"
                checked={form.cbttExtensionGranted}
                onChange={(e) => setField('cbttExtensionGranted', e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary"
              />
              <span className="flex-1 text-sm font-semibold text-ink">
                CBTT exam extension granted
                <span className="block text-[11px] font-normal text-ink-muted leading-snug mt-0.5">
                  Extends the 12-month provisional window to 24 months.
                </span>
              </span>
            </label>
          )}

          {GAME_PLAN_LOOP_ENABLED && editable.has('licenseProfile') && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-license-profile" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">License Profile</label>
              <select
                id="edit-user-license-profile"
                value={form.licenseProfile}
                onChange={(e) => setField('licenseProfile', e.target.value)}
                className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">— Not set —</option>
                <option value="composite">Composite (Life, A&amp;H, Property &amp; Motor)</option>
                <option value="life_only">Life &amp; A&amp;H</option>
                <option value="general_only">A&amp;H, Property &amp; Motor</option>
              </select>
            </div>
          )}

          {showUnitDropdown && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-unit" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                {demotingToAgent ? 'Assign unit *' : 'Unit *'}
              </label>
              <select
                id="edit-user-unit"
                value={form.unitId}
                onChange={(e) => setField('unitId', e.target.value)}
                disabled={loadingUnits}
                className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              >
                <option value="">{loadingUnits ? 'Loading units…' : 'Select a unit…'}</option>
                {unitManagers.map((um) => (
                  <option key={um.uid ?? um.id} value={um.uid ?? um.id}>
                    {getUnitDisplayName(um)}
                  </option>
                ))}
              </select>
              {form.unitId !== (user.unitId ?? '') && user?.role === 'agent' && !demotingToAgent && (
                <p className="text-[10px] text-warning-ink leading-snug">
                  Reassigning will require confirmation. Submission history stays with the old unit.
                </p>
              )}
              {demotingToAgent && (
                <p className="text-[10px] text-warning-ink leading-snug">
                  Required when demoting to agent. The user will sign in to the selected unit.
                </p>
              )}
            </div>
          )}

          {/* Unit-manager-only fields */}
          {editable.has('unitName') && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-unit-name" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                Unit Name <span className="font-normal normal-case text-ink-muted">(optional)</span>
              </label>
              <input
                id="edit-user-unit-name"
                type="text"
                value={form.unitName}
                onChange={(e) => setField('unitName', e.target.value)}
                maxLength={50}
                placeholder='e.g. "Phoenix Unit"'
                className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {editable.has('canConfirmSettlements') && (
            <label
              htmlFor="edit-user-can-confirm-settlements"
              className="flex items-start gap-3 px-3 py-3 rounded-xl border border-border cursor-pointer hover:bg-border/20 transition-colors"
            >
              <input
                id="edit-user-can-confirm-settlements"
                type="checkbox"
                checked={form.canConfirmSettlements}
                onChange={(e) => setField('canConfirmSettlements', e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary"
              />
              <span className="flex-1 text-sm font-semibold text-ink">
                Can confirm settlements
                <span className="block text-[11px] font-normal text-ink-muted leading-snug mt-0.5">
                  Grants write access to settlement confirmation. Defaults to off for unit managers.
                </span>
              </span>
            </label>
          )}

          {['branch_manager', 'sales_manager', 'tenant_admin'].includes(callerRole) && (
            <div className="flex flex-col gap-2 pt-3 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                Leaderboard
              </p>
              <label
                htmlFor="edit-user-hidden-from-lb"
                className={`flex items-start gap-3 px-3 py-3 rounded-xl border border-border transition-colors ${
                  hiddenSaving ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:bg-border/20'
                }`}
              >
                <input
                  id="edit-user-hidden-from-lb"
                  type="checkbox"
                  checked={hiddenFromLb}
                  disabled={hiddenSaving}
                  onChange={handleToggleHiddenFromLb}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />
                <span className="flex-1 text-sm font-semibold text-ink">
                  Hide from leaderboard
                  <span className="block text-[11px] font-normal text-ink-muted leading-snug mt-0.5">
                    {hiddenSaving
                      ? 'Saving…'
                      : "Hidden individuals won’t appear on the production leaderboard."}
                  </span>
                </span>
              </label>
              {hiddenError && (
                <p className="text-[11px] text-danger-ink px-1" role="alert">{hiddenError}</p>
              )}
            </div>
          )}

          {/* PR-4b: Role + branchId edit section (claim-keyed; goes through CF) */}
          {(showRoleDropdown || canEditBranch) && (
            <div className="flex flex-col gap-3 mt-2 pt-3 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                Role &amp; Branch
              </p>

              {showRoleDropdown && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-user-role" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Role</label>
                  <select
                    id="edit-user-role"
                    data-testid="edit-user-role"
                    value={form.role}
                    onChange={(e) => setField('role', e.target.value)}
                    className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value={user.role}>{ROLE_DISPLAY[user.role] ?? user.role} (current)</option>
                    {allowedRoleTransitions.map((r) => (
                      <option key={r} value={r}>{ROLE_DISPLAY[r] ?? r}</option>
                    ))}
                  </select>
                  {roleChanged && (
                    <p className="text-[10px] text-warning-ink leading-snug">
                      Changing role will sign the user out. They&rsquo;ll need to sign in again with the new permissions.
                    </p>
                  )}
                  {promotingToTenantAdmin && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger/10 border border-danger/30">
                      <AlertTriangle size={14} className="text-danger-ink mt-0.5 shrink-0" />
                      <p className="text-[11px] text-ink leading-snug">
                        Tenant Admin has full power within this company including
                        creating/editing other admins. Typed confirmation required.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {canEditBranch && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-user-branch" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Branch</label>
                  <select
                    id="edit-user-branch"
                    data-testid="edit-user-branch"
                    value={form.branchId}
                    onChange={(e) => setField('branchId', e.target.value)}
                    disabled={loadingBranches}
                    className="h-11 px-3 rounded-lg border border-border bg-card text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                  >
                    <option value="">{loadingBranches ? 'Loading branches…' : 'Select a branch…'}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {branchChanged && (
                    <p className="text-[10px] text-warning-ink leading-snug">
                      Reassigning will sign the user out. Submission history stays attached to the original branch.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Read-only footer note: only show when neither role nor branch is editable. */}
          {!showRoleDropdown && !canEditBranch && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-border/20 border border-border">
              <AlertTriangle size={14} className="text-ink-muted mt-0.5 shrink-0" />
              <p className="text-[11px] text-ink-muted leading-snug">
                Role and branch are not editable here. Contact a tenant admin to change them.
                To deactivate this account, use the Deactivate button on the user list.
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-xs text-danger-ink bg-danger/10 rounded-lg px-3 py-2"
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="edit-user-save"
            className="btn-primary w-full flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Unified confirmation dialog. Routes to CF or PR-4 save based on `kind`. */}
      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? null}
        variant={pendingConfirm?.variant ?? 'warning'}
        confirmLabel={pendingConfirm?.confirmLabel ?? 'Confirm'}
        loadingLabel="Saving…"
        loading={saving}
        confirmValue={pendingConfirm?.confirmValue}
        confirmValueLabel={pendingConfirm?.confirmValueLabel ?? 'Type to confirm'}
        confirmValuePlaceholder={pendingConfirm?.confirmValue ?? ''}
        onConfirm={async () => {
          const c = pendingConfirm;
          setPendingConfirm(null);
          if (c) {
            await runSave(c.pr4Diff, c.cfUpdates, c.confirmationPhrase);
          }
        }}
        onCancel={() => !saving && setPendingConfirm(null)}
      />
    </div>
  );
}
