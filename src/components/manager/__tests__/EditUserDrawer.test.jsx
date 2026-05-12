import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Hoisted mock state — applies before imports.
// userService is fully mocked (not importActual) so the firebase chain in
// userService.js doesn't run during this test — same pattern as
// KioskModeTab.toast.test.jsx.
const hoisted = vi.hoisted(() => ({
  updateUserFields: vi.fn(),
  getUnitManagers: vi.fn(),
}));

vi.mock('../../../services/userService', () => ({
  updateUserFields: hoisted.updateUserFields,
  // MANAGER_EDITABLE_FIELDS — duplicated literally from src/services/userService.js.
  // Keep in lockstep with the real export; if the real list changes, this list
  // must change too, otherwise the test loses parity with production.
  MANAGER_EDITABLE_FIELDS: Object.freeze([
    'name', 'phone', 'bio',
    'unitId', 'unitName',
    'agentNumber', 'contractStartDate',
    'canConfirmSettlements',
  ]),
}));

vi.mock('../../../services/agentManagementService', () => ({
  getUnitManagers: hoisted.getUnitManagers,
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
    hoisted.getUnitManagers.mockReset();
    hoisted.getUnitManagers.mockResolvedValue(UNITS);
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
      expect(screen.getByLabelText(/^Unit \*/i)).toBeInTheDocument();
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
    expect(hoisted.updateUserFields).toHaveBeenCalledWith('agent-1', { phone: '868-555-1234' });
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
    await waitFor(() => expect(screen.getByLabelText(/^Unit \*/i)).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByLabelText(/^Unit \*/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Unit \*/i), { target: { value: 'unit-mgr-2' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/Reassign unit\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Reassign$/i }));
    await waitFor(() => expect(hoisted.updateUserFields).toHaveBeenCalledTimes(1));
    expect(hoisted.updateUserFields).toHaveBeenCalledWith('agent-1', { unitId: 'unit-mgr-2' });
    expect(onSaved).toHaveBeenCalled();
  });
});
