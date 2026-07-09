import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Hoisted mock state — applies before imports.
// userService is fully mocked (not importActual) so the firebase chain in
// userService.js doesn't run during this test — same pattern as
// KioskModeTab.toast.test.jsx.
const hoisted = vi.hoisted(() => ({
  updateUserFields: vi.fn(),
  callUpdateUser: vi.fn(),
  getUnitManagers: vi.fn(),
  listBranches: vi.fn(),
}));

vi.mock('../../../services/userService', () => ({
  updateUserFields: hoisted.updateUserFields,
  callUpdateUser: hoisted.callUpdateUser,
  // MANAGER_EDITABLE_FIELDS — duplicated literally from src/services/userService.js.
  // Keep in lockstep with the real export; if the real list changes, this list
  // must change too, otherwise the test loses parity with production.
  MANAGER_EDITABLE_FIELDS: Object.freeze([
    'name', 'phone', 'bio',
    'unitId', 'unitName',
    'agentNumber', 'contractStartDate',
    'canConfirmSettlements',
    'licenseStatus', 'cbttExamPassedDate', 'cbttExtensionGranted', 'licenseProfile',
  ]),
  CLAIM_KEYED_FIELDS: Object.freeze(['role', 'branchId']),
}));

vi.mock('../../../services/agentManagementService', () => ({
  getUnitManagers: hoisted.getUnitManagers,
}));

vi.mock('../../../services/branchService', () => ({
  listBranches: hoisted.listBranches,
}));

import EditUserDrawer from '../EditUserDrawer';

const AGENT = {
  uid:               'agent-1',
  id:                'agent-1',
  role:              'agent',
  name:              'Test Agent',
  email:             'agent@example.com',
  phone:             '',
  bio:               '',
  unitId:            'unit-mgr-1',
  agentNumber:       'A-100',
  contractStartDate: '2026-01-01',
};

const UNIT_MANAGER = {
  uid:      'um-1',
  id:       'um-1',
  role:     'unit_manager',
  name:     'Test Unit Manager',
  email:    'um@example.com',
  unitName: 'Phoenix',
  branchId: 'branch-1',
};

const BRANCH_MANAGER_PROFILE = {
  uid:      'bm-1',
  branchId: 'branch-1',
  role:     'branch_manager',
};

const UNITS = [
  { uid: 'unit-mgr-1', name: 'UM One',  unitName: 'Phoenix', branchId: 'branch-1' },
  { uid: 'unit-mgr-2', name: 'UM Two',  unitName: 'Apollo',  branchId: 'branch-1' },
  { uid: 'unit-mgr-3', name: 'UM Cross', unitName: 'Other',  branchId: 'branch-other' },
];

describe('EditUserDrawer', () => {
  beforeEach(() => {
    hoisted.updateUserFields.mockReset();
    hoisted.callUpdateUser.mockReset();
    hoisted.getUnitManagers.mockReset();
    hoisted.listBranches.mockReset();
    hoisted.getUnitManagers.mockResolvedValue(UNITS);
    hoisted.listBranches.mockResolvedValue([
      { id: 'branch-1',     name: 'South Branch', isActive: true },
      { id: 'branch-other', name: 'North Branch', isActive: true },
      { id: 'branch-inact', name: 'Old Branch',   isActive: false },
    ]);
  });

  // ── Render baseline ──────────────────────────────────────────────────────

  it('renders identity card with name, email, and role label', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('agent@example.com')).toBeInTheDocument();
    // role label rendered by getRoleLabel('agent') => 'Agent' (exact match,
    // case-sensitive, to avoid colliding with the email substring).
    expect(screen.getByText('Agent')).toBeInTheDocument();
  });

  // ── Permission matrix ────────────────────────────────────────────────────

  it('unit_manager editing an agent: shows name/phone/bio, hides unitId / agentNumber / contractStartDate', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="unit_manager"
        callerProfile={{ uid: 'um-1', branchId: 'branch-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bio/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Unit \*/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Agent Number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Contract Start Date/i)).not.toBeInTheDocument();
  });

  it('branch_manager editing an agent: shows unitId, agentNumber, contractStartDate', async () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/Agent Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contract Start Date/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText(/^Unit \*/i)).toBeInTheDocument();
    });
  });

  it('branch_manager editing a unit_manager: shows unitName, hides unitId / canConfirmSettlements', () => {
    render(
      <EditUserDrawer
        user={UNIT_MANAGER}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/Unit Name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Unit \*/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Can confirm settlements/i)).not.toBeInTheDocument();
  });

  it('tenant_admin editing a unit_manager: shows canConfirmSettlements toggle', () => {
    render(
      <EditUserDrawer
        user={UNIT_MANAGER}
        callerRole="tenant_admin"
        callerProfile={{ uid: 'ta-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/Can confirm settlements/i)).toBeInTheDocument();
  });

  it('branch_manager unit dropdown is filtered to caller branch only', async () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    await waitFor(() => {
      const el = screen.getByLabelText(/^Unit \*/i);
      expect(within(el).getAllByRole('option').length).toBeGreaterThan(1);
    });
    const select = screen.getByLabelText(/^Unit \*/i);
    const options = within(select).getAllByRole('option');
    // Placeholder + 2 in-branch units (Phoenix + Apollo); out-of-branch "Other" excluded.
    const labels = options.map((o) => o.textContent);
    expect(labels.some((l) => l?.includes('Phoenix'))).toBe(true);
    expect(labels.some((l) => l?.includes('Apollo'))).toBe(true);
    expect(labels.some((l) => l?.includes('Other'))).toBe(false);
  });

  // ── Validation ───────────────────────────────────────────────────────────

  it('blocks save when name is empty', async () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Full name is required/i)).toBeInTheDocument();
    expect(hoisted.updateUserFields).not.toHaveBeenCalled();
  });

  it('blocks save when name is shorter than 2 chars', async () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(hoisted.updateUserFields).not.toHaveBeenCalled();
  });

  it('blocks save when no fields have changed', async () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/No changes to save/i)).toBeInTheDocument();
    expect(hoisted.updateUserFields).not.toHaveBeenCalled();
  });

  // ── Save round-trip ──────────────────────────────────────────────────────

  it('saves only the diff and calls onSaved with the new name', async () => {
    hoisted.updateUserFields.mockResolvedValue();
    const onSaved = vi.fn();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: '868-555-1234' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(hoisted.updateUserFields).toHaveBeenCalledTimes(1));
    // Diff includes only phone — name/bio/unitId/etc. unchanged.
    expect(hoisted.updateUserFields).toHaveBeenCalledWith('t1', 'agent-1', { phone: '868-555-1234' });
    expect(onSaved).toHaveBeenCalledWith('Test Agent');
  });

  it('surfaces a backend error inline and keeps the drawer open', async () => {
    hoisted.updateUserFields.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    const onSaved = vi.fn();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Updated Agent' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/don't have permission/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // ── unitId reassignment confirmation ─────────────────────────────────────

  it('unitId change opens ConfirmDialog before save; cancel keeps modal open and skips save', async () => {
    hoisted.updateUserFields.mockResolvedValue();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    await waitFor(() => {
      const el = screen.getByLabelText(/^Unit \*/i);
      expect(within(el).getAllByRole('option').length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText(/^Unit \*/i), { target: { value: 'unit-mgr-2' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // Reassignment confirm dialog appears
    expect(await screen.findByText(/Reassign unit\?/i)).toBeInTheDocument();
    // Cancel
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(hoisted.updateUserFields).not.toHaveBeenCalled();
  });

  it('unitId change saves after explicit confirmation', async () => {
    hoisted.updateUserFields.mockResolvedValue();
    const onSaved = vi.fn();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    await waitFor(() => {
      const el = screen.getByLabelText(/^Unit \*/i);
      expect(within(el).getAllByRole('option').length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getByLabelText(/^Unit \*/i), { target: { value: 'unit-mgr-2' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Reassign unit\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Reassign$/i }));
    await waitFor(() => expect(hoisted.updateUserFields).toHaveBeenCalledTimes(1));
    expect(hoisted.updateUserFields).toHaveBeenCalledWith('t1', 'agent-1', { unitId: 'unit-mgr-2' });
    expect(onSaved).toHaveBeenCalled();
  });

  // ── PR-4b: role + branchId edit permission matrix ───────────────────────

  it('unit_manager caller sees no role or branch dropdown (no transitions allowed)', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="unit_manager"
        callerProfile={{ uid: 'um-1', branchId: 'branch-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.queryByTestId('edit-user-role')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-user-branch')).not.toBeInTheDocument();
    // Footer note rendered when no role/branch editable.
    expect(screen.getByText(/Role and branch are not editable here/i)).toBeInTheDocument();
  });

  it('branch_manager editing an agent: role dropdown lists unit_manager but no branch dropdown', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    const roleSel = screen.getByTestId('edit-user-role');
    const labels = within(roleSel).getAllByRole('option').map((o) => o.textContent);
    // Current role first, then allowed transition.
    expect(labels.some((l) => l?.includes('Agent') && l?.includes('current'))).toBe(true);
    expect(labels.some((l) => l === 'Unit Manager')).toBe(true);
    // branch_manager is not a cross-branch role → branch dropdown hidden.
    expect(screen.queryByTestId('edit-user-branch')).not.toBeInTheDocument();
  });

  it('tenant_admin editing an agent: both role and branch dropdowns visible', async () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="tenant_admin"
        callerProfile={{ uid: 'ta-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByTestId('edit-user-role')).toBeInTheDocument();
    // Branch dropdown and its async-loaded options — wait for both the element
    // AND the populated options (listBranches resolves in a useEffect after mount).
    await waitFor(() => {
      const branchSel = screen.getByTestId('edit-user-branch');
      const labels = within(branchSel).getAllByRole('option').map((o) => o.textContent);
      expect(labels.some((l) => l === 'South Branch')).toBe(true);
    });
    // Branch dropdown filtered to active branches only.
    const branchSel = screen.getByTestId('edit-user-branch');
    const branchLabels = within(branchSel).getAllByRole('option').map((o) => o.textContent);
    expect(branchLabels.some((l) => l === 'South Branch')).toBe(true);
    expect(branchLabels.some((l) => l === 'North Branch')).toBe(true);
    expect(branchLabels.some((l) => l === 'Old Branch')).toBe(false);
  });

  it('role change opens role-change ConfirmDialog with sign-out warning', async () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByTestId('edit-user-role'), { target: { value: 'unit_manager' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Change role\?/i)).toBeInTheDocument();
    expect(screen.getByText(/signed out immediately/i)).toBeInTheDocument();
  });

  it('role change confirmed → callUpdateUser invoked with role; updateUserFields not called', async () => {
    hoisted.callUpdateUser.mockResolvedValue({ success: true, updatedFields: ['role'] });
    const onSaved = vi.fn();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    fireEvent.change(screen.getByTestId('edit-user-role'), { target: { value: 'unit_manager' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Change role\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Change role$/i }));

    await waitFor(() => expect(hoisted.callUpdateUser).toHaveBeenCalledTimes(1));
    expect(hoisted.callUpdateUser).toHaveBeenCalledWith({
      uid: 'agent-1',
      updates: { role: 'unit_manager' },
      confirmationPhrase: undefined,
    });
    expect(hoisted.updateUserFields).not.toHaveBeenCalled();
    // onSaved called with (name, message) for CF path.
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0]).toBe('Test Agent');
    expect(onSaved.mock.calls[0][1]).toMatch(/role updated to Unit Manager/i);
  });

  it('promote to tenant_admin requires typed confirmation phrase', async () => {
    hoisted.callUpdateUser.mockResolvedValue({ success: true, updatedFields: ['role'] });
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="tenant_admin"
        callerProfile={{ uid: 'ta-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByTestId('edit-user-role'), { target: { value: 'tenant_admin' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Promote to Tenant Admin\?/i)).toBeInTheDocument();

    // Promote button starts disabled until phrase typed.
    const promoteBtn = screen.getByRole('button', { name: /^Promote$/ });
    expect(promoteBtn).toBeDisabled();

    // Type the wrong phrase — still disabled.
    fireEvent.change(screen.getByLabelText(/Type "PROMOTE TO TENANT ADMIN" to confirm/i), {
      target: { value: 'PROMOTE' },
    });
    expect(promoteBtn).toBeDisabled();

    // Type the correct phrase — enabled.
    fireEvent.change(screen.getByLabelText(/Type "PROMOTE TO TENANT ADMIN" to confirm/i), {
      target: { value: 'PROMOTE TO TENANT ADMIN' },
    });
    expect(promoteBtn).not.toBeDisabled();
    fireEvent.click(promoteBtn);

    await waitFor(() => expect(hoisted.callUpdateUser).toHaveBeenCalledTimes(1));
    expect(hoisted.callUpdateUser).toHaveBeenCalledWith({
      uid: 'agent-1',
      updates: { role: 'tenant_admin' },
      confirmationPhrase: 'PROMOTE TO TENANT ADMIN',
    });
  });

  it('demoting to agent requires unitId selection before save', async () => {
    render(
      <EditUserDrawer
        user={UNIT_MANAGER}
        callerRole="tenant_admin"
        callerProfile={{ uid: 'ta-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByTestId('edit-user-role'), { target: { value: 'agent' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Select a unit before demoting to agent/i)).toBeInTheDocument();
    expect(hoisted.callUpdateUser).not.toHaveBeenCalled();
  });

  it('demoting to agent with unitId selected → callUpdateUser includes role + unitId', async () => {
    hoisted.callUpdateUser.mockResolvedValue({ success: true, updatedFields: ['role'] });
    render(
      <EditUserDrawer
        user={UNIT_MANAGER}
        callerRole="tenant_admin"
        callerProfile={{ uid: 'ta-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByTestId('edit-user-role'), { target: { value: 'agent' } });
    // Demotion surfaces the "Assign unit *" dropdown.
    await waitFor(() => expect(screen.getByLabelText(/Assign unit/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Assign unit/i), { target: { value: 'unit-mgr-2' } });
    // Wait for React to flush unit-select state before clicking save (CI race fix).
    await waitFor(() =>
      expect(screen.getByLabelText(/Assign unit/i)).toHaveValue('unit-mgr-2')
    );
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Change role\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Change role$/i }));

    await waitFor(() => expect(hoisted.callUpdateUser).toHaveBeenCalledTimes(1));
    expect(hoisted.callUpdateUser).toHaveBeenCalledWith({
      uid: 'um-1',
      updates: { role: 'agent', unitId: 'unit-mgr-2' },
      confirmationPhrase: undefined,
    });
  });

  it('CF permission-denied error surfaces user-facing copy and keeps drawer open', async () => {
    const cfErr = Object.assign(new Error('caller cannot edit this user'), {
      code: 'permission-denied',
    });
    hoisted.callUpdateUser.mockRejectedValue(cfErr);
    const onSaved = vi.fn();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    fireEvent.change(screen.getByTestId('edit-user-role'), { target: { value: 'unit_manager' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Change role\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Change role$/i }));

    await waitFor(() => expect(hoisted.callUpdateUser).toHaveBeenCalled());
    expect(await screen.findByText(/don't have permission/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

// ── licenseProfile dropdown ──────────────────────────────────────────────────

describe('EditUserDrawer — licenseProfile dropdown', () => {
  it('branch_manager editing agent: licenseProfile dropdown is visible', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/License Profile/i)).toBeInTheDocument();
  });

  it('unit_manager editing agent: licenseProfile dropdown is hidden', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="unit_manager"
        callerProfile={{ uid: 'um-1', branchId: 'branch-1' }}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.queryByLabelText(/License Profile/i)).not.toBeInTheDocument();
  });

  it('branch_manager editing unit_manager: licenseProfile dropdown is hidden', () => {
    render(
      <EditUserDrawer
        user={UNIT_MANAGER}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.queryByLabelText(/License Profile/i)).not.toBeInTheDocument();
  });

  it('licenseProfile change saves the new value via updateUserFields', async () => {
    hoisted.updateUserFields.mockResolvedValue();
    const onSaved = vi.fn();
    render(
      <EditUserDrawer
        user={{ ...AGENT, licenseProfile: 'composite' }}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={onSaved}
      />
    );
    fireEvent.change(screen.getByLabelText(/License Profile/i), { target: { value: 'life_only' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(hoisted.updateUserFields).toHaveBeenCalledTimes(1));
    expect(hoisted.updateUserFields).toHaveBeenCalledWith('t1', 'agent-1', { licenseProfile: 'life_only' });
    expect(onSaved).toHaveBeenCalled();
  });

  it('dropdown initialises to the user current licenseProfile value', () => {
    render(
      <EditUserDrawer
        user={{ ...AGENT, licenseProfile: 'composite' }}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByLabelText(/License Profile/i)).toHaveValue('composite');
  });
});

// ── Dialog a11y contract (§4 dialog sweep) ───────────────────────────────────

describe('EditUserDrawer — dialog a11y', () => {
  it('exposes role=dialog + aria-modal=true', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'edit-user-drawer-title');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={onClose}
        onSaved={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when Escape is pressed while saving', async () => {
    hoisted.updateUserFields.mockImplementation(() => new Promise(() => {})); // never resolves
    const onClose = vi.fn();
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={onClose}
        onSaved={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Changed Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(hoisted.updateUserFields).toHaveBeenCalled());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', () => {
    render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll(
        'button:not([disabled]):not([aria-hidden="true"]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('restores focus to the invoking element when the drawer unmounts', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open drawer';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <EditUserDrawer
        user={AGENT}
        callerRole="branch_manager"
        callerProfile={BRANCH_MANAGER_PROFILE}
        tenantId="t1"
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
