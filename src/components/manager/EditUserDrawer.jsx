import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { getUnitManagers } from '../../services/agentManagementService';
import { updateUserFields, MANAGER_EDITABLE_FIELDS } from '../../services/userService';
import { getRoleLabel, getUnitDisplayName } from '../../utils/formatters';
import Avatar from '../ui/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';

// Editor-role × target-role capability matrix. Mirrors firestore.rules
// manager-edit allowlist + the Phase 3 permission matrix locked for PR-4.
// Returns the Set of field keys this caller may edit on this target.
//
// unit_manager: only edits agents in their own unit (UI prevents anyone else),
//   and cannot reassign units — only profile basics.
// branch_manager / sales_manager: can edit profile + role-specific operational
//   fields (unitId reassignment, agentNumber, contractStartDate, unitName).
// tenant_admin / platform_admin: full operational set + canConfirmSettlements
//   permission overlay (meaningful only on unit_manager targets).
function getEditableFieldsFor(editorRole, targetRole) {
  const fields = new Set(['name', 'phone', 'bio']);

  if (targetRole === 'agent' && editorRole !== 'unit_manager') {
    fields.add('unitId');
    fields.add('agentNumber');
    fields.add('contractStartDate');
  }

  if (targetRole === 'unit_manager' && editorRole !== 'unit_manager') {
    fields.add('unitName');
    if (editorRole === 'tenant_admin' || editorRole === 'platform_admin') {
      fields.add('canConfirmSettlements');
    }
  }

  return fields;
}

function normaliseSaveValue(key, raw) {
  if (key === 'canConfirmSettlements') return Boolean(raw);
  if (typeof raw === 'string') return raw.trim();
  return raw ?? '';
}

const TODAY = () => new Date().toISOString().slice(0, 10);

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

  const [form, setForm] = useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    bio: user?.bio ?? '',
    unitId: user?.unitId ?? '',
    unitName: user?.unitName ?? '',
    agentNumber: user?.agentNumber ?? '',
    contractStartDate: user?.contractStartDate ?? '',
    canConfirmSettlements: Boolean(user?.canConfirmSettlements),
  });

  const [unitManagers, setUnitManagers] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingUnitConfirm, setPendingUnitConfirm] = useState(null);

  const firstFieldRef = useRef(null);

  // Load unit-managers list if unitId is editable (agent target).
  useEffect(() => {
    if (!editable.has('unitId') || !tenantId) return;
    let cancelled = false;
    setLoadingUnits(true);
    getUnitManagers(tenantId)
      .then((list) => {
        if (cancelled) return;
        // Branch managers see units in their own branch only. tenant_admin+ see all.
        const filtered = callerRole === 'branch_manager'
          ? list.filter((u) => u.branchId === callerProfile?.branchId)
          : list;
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
  }, [editable, tenantId, callerRole, callerProfile?.branchId]);

  // ESC + initial focus management. Mirrors ConfirmDialog pattern.
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
    return null;
  }

  function buildDiff() {
    const diff = {};
    for (const key of MANAGER_EDITABLE_FIELDS) {
      if (!editable.has(key)) continue;
      const current = normaliseSaveValue(key, user?.[key]);
      const next = normaliseSaveValue(key, form[key]);
      if (current !== next) diff[key] = next;
    }
    return diff;
  }

  function unitNameForId(unitId) {
    if (!unitId) return '—';
    const um = unitManagers.find((u) => (u.uid ?? u.id) === unitId);
    return um ? getUnitDisplayName(um) : unitId;
  }

  async function doSave(diff) {
    setSaving(true);
    setError('');
    try {
      await updateUserFields(user.uid ?? user.id, diff);
      onSaved?.(form.name.trim());
    } catch (err) {
      console.error('[EditUserDrawer] updateUserFields:', err);
      const message = err?.message?.includes('Missing or insufficient permissions')
        ? "You don't have permission to make this change."
        : err?.message?.includes('Disallowed field')
          ? 'Internal error: tried to save a restricted field.'
          : 'Update failed. Please try again.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    const diff = buildDiff();
    if (Object.keys(diff).length === 0) {
      setError('No changes to save.');
      return;
    }

    // unitId reassignment requires explicit confirmation — agent's submission
    // history stays attached to their old unit.
    if ('unitId' in diff && user?.role === 'agent') {
      setPendingUnitConfirm({
        diff,
        oldUnitName: unitNameForId(user.unitId),
        newUnitName: unitNameForId(diff.unitId),
      });
      return;
    }

    await doSave(diff);
  }

  if (!user) return null;

  const targetRoleLabel = getRoleLabel(user.role);

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
        className="w-full max-w-md bg-[var(--color-surface)] shadow-2xl flex flex-col h-full overflow-hidden"
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
              className="h-11 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              className="h-11 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
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
              className="px-3 py-2 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
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
                className="h-11 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                className="h-11 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          {editable.has('unitId') && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-unit" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Unit *</label>
              <select
                id="edit-user-unit"
                value={form.unitId}
                onChange={(e) => setField('unitId', e.target.value)}
                disabled={loadingUnits}
                className="h-11 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
              >
                <option value="">{loadingUnits ? 'Loading units…' : 'Select a unit…'}</option>
                {unitManagers.map((um) => (
                  <option key={um.uid ?? um.id} value={um.uid ?? um.id}>
                    {getUnitDisplayName(um)}
                  </option>
                ))}
              </select>
              {form.unitId !== (user.unitId ?? '') && (
                <p className="text-[10px] text-warning leading-snug">
                  Reassigning will require confirmation. Submission history stays with the old unit.
                </p>
              )}
            </div>
          )}

          {/* Unit-manager-only fields */}
          {editable.has('unitName') && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-user-unit-name" className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                Unit Name <span className="font-normal normal-case text-ink-faint">(optional)</span>
              </label>
              <input
                id="edit-user-unit-name"
                type="text"
                value={form.unitName}
                onChange={(e) => setField('unitName', e.target.value)}
                maxLength={50}
                placeholder='e.g. "Phoenix Unit"'
                className="h-11 px-3 rounded-lg border border-border bg-[var(--color-surface)] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
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

          {/* Read-only footer note for fields not editable in v1 */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-border/20 border border-border">
            <AlertTriangle size={14} className="text-ink-muted mt-0.5 shrink-0" />
            <p className="text-[11px] text-ink-muted leading-snug">
              Role and branch are not editable here. Contact a tenant admin to change them.
              To deactivate this account, use the Deactivate button on the user list.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2"
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

      {/* unitId reassignment confirmation */}
      <ConfirmDialog
        open={Boolean(pendingUnitConfirm)}
        title="Reassign unit?"
        message={
          pendingUnitConfirm ? (
            <>
              Reassign <span className="font-semibold text-ink">{form.name.trim() || user.name}</span> from{' '}
              <span className="font-semibold text-ink">{pendingUnitConfirm.oldUnitName}</span> to{' '}
              <span className="font-semibold text-ink">{pendingUnitConfirm.newUnitName}</span>?
              Their submission history will remain attached to their old unit.
            </>
          ) : null
        }
        variant="warning"
        confirmLabel="Reassign"
        loadingLabel="Reassigning…"
        loading={saving}
        onConfirm={async () => {
          const diff = pendingUnitConfirm?.diff;
          setPendingUnitConfirm(null);
          if (diff) await doSave(diff);
        }}
        onCancel={() => !saving && setPendingUnitConfirm(null)}
      />
    </div>
  );
}
