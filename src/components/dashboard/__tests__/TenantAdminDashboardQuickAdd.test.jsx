// @vitest-environment jsdom
//
// TenantAdminDashboard Quick-Add wiring (Tier 1 · 1.3).
//
// Covers:
//   1. quickAddActions (New branch primary + New user) are passed to Shell,
//      so the command palette auto-enriches for tenant_admin.
//   2. Firing 'new-branch' routes to the branches tab AND bumps
//      BranchesPanel's openCreateSignal to a truthy value (fires the real
//      create flow, not just tab navigation).
//   3. Firing 'new-user' routes to the users tab AND bumps
//      UserManagementPanel's openCreateSignal to a truthy value.
//   4. The signal settles back to 0 after firing (TenantAdminDashboard's own
//      reset effect), so a later plain tab revisit does not incorrectly
//      reopen the create surface — see the BranchesPanel /
//      UserManagementPanel openCreateSignal unit tests for the mount-time
//      contract this depends on.
//
// Follows the Shell-prop-capturing mock scaffold from
// ManagerDashboardNav.test.jsx, adapted to also capture the child panels'
// openCreateSignal prop across every render (not just the last one), since
// TenantAdminDashboard's reset effect intentionally settles it back to 0
// shortly after the panel consumes it.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  captured: { onAction: null, activeTab: null, quickAddActions: null },
  branchSignals: [],
  userSignals: [],
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        { uid: 'ta-uid' },
    userProfile: { name: 'Test Admin' },
    role:        'tenant_admin',
    tenantId:    'tenant-test',
  }),
}));

vi.mock('../../../services/authService', () => ({ signOut: vi.fn() }));
vi.mock('../../../services/managerService', () => ({
  getTenantUsers:       vi.fn().mockResolvedValue([]),
  getAllYTDSubmissions: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/branchService', () => ({
  listBranches: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../utils/extractFields', () => ({ extractFields: () => ({ apiSold: 0 }) }));
vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (v) => `$${v}`,
  getRoleLabel:   () => 'Tenant Admin',
}));

// Shell — captures activeTab / onAction / quickAddActions for direct
// assertion + invocation, renders children (mirrors ManagerDashboardNav.test.jsx).
vi.mock('../../shell/Shell', () => ({
  default: ({ children, activeTab, onAction, quickAddActions }) => {
    hoisted.captured.activeTab       = activeTab;
    hoisted.captured.onAction        = onAction;
    hoisted.captured.quickAddActions = quickAddActions;
    return React.createElement('div', { 'data-testid': 'shell-mock' }, children);
  },
}));

vi.mock('../../shell/QuickAddMenu', () => ({ default: () => null }));

vi.mock('../../admin/CompanyConfigPanel',    () => ({ default: () => null }));
vi.mock('../../admin/ActivityStandardsPanel', () => ({ default: () => null }));
vi.mock('../../admin/AwardsRulesetPanel',    () => ({ default: () => null }));
vi.mock('../../admin/RoleDistributionCard',  () => ({ default: () => null }));
vi.mock('../../admin/BranchHealthCards',     () => ({ default: () => null }));
vi.mock('../../campaigns/CampaignPanel',     () => ({ default: () => null }));
vi.mock('../../profile/ProfileScreen',       () => ({ default: () => null }));

// BranchesPanel / UserManagementPanel — capture EVERY openCreateSignal value
// they're rendered with (not just the last), since TenantAdminDashboard's own
// reset effect settles the counter back to 0 one render after the panel
// consumes the nonzero value.
vi.mock('../../admin/BranchesPanel', () => ({
  default: ({ openCreateSignal }) => {
    hoisted.branchSignals.push(openCreateSignal);
    return React.createElement('div', { 'data-testid': 'branches-panel' });
  },
}));
vi.mock('../../manager/UserManagementPanel', () => ({
  default: ({ openCreateSignal }) => {
    hoisted.userSignals.push(openCreateSignal);
    return React.createElement('div', { 'data-testid': 'user-management-panel' });
  },
}));

import TenantAdminDashboard from '../TenantAdminDashboard';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.captured.onAction        = null;
  hoisted.captured.activeTab       = null;
  hoisted.captured.quickAddActions = null;
  hoisted.branchSignals = [];
  hoisted.userSignals   = [];
});

describe('TenantAdminDashboard — Quick-Add palette enrichment', () => {
  it('passes tenantAdmin quickAddActions (New branch primary + New user) to Shell', () => {
    render(<TenantAdminDashboard />);
    expect(hoisted.captured.quickAddActions.map((a) => a.key)).toEqual(['new-branch', 'new-user']);
    expect(hoisted.captured.quickAddActions.find((a) => a.key === 'new-branch').primary).toBe(true);
  });
});

describe('TenantAdminDashboard — Quick-Add action dispatch', () => {
  it('firing "new-branch" sets activeTab to branches', async () => {
    render(<TenantAdminDashboard />);
    expect(hoisted.captured.activeTab).toBe('dashboard');
    await act(async () => { hoisted.captured.onAction('new-branch'); });
    expect(hoisted.captured.activeTab).toBe('branches');
  });

  it('firing "new-branch" bumps BranchesPanel\'s openCreateSignal to a truthy value (fires the real create flow)', async () => {
    render(<TenantAdminDashboard />);
    expect(hoisted.branchSignals).toEqual([]); // not mounted yet (activeTab === 'dashboard')
    await act(async () => { hoisted.captured.onAction('new-branch'); });
    expect(hoisted.branchSignals.some((v) => v > 0)).toBe(true);
  });

  it('the branch signal settles back to 0 after firing (safe for a later plain tab revisit)', async () => {
    render(<TenantAdminDashboard />);
    await act(async () => { hoisted.captured.onAction('new-branch'); });
    expect(hoisted.branchSignals[hoisted.branchSignals.length - 1]).toBe(0);
  });

  it('firing "new-user" sets activeTab to users', async () => {
    render(<TenantAdminDashboard />);
    await act(async () => { hoisted.captured.onAction('new-user'); });
    expect(hoisted.captured.activeTab).toBe('users');
  });

  it('firing "new-user" bumps UserManagementPanel\'s openCreateSignal to a truthy value', async () => {
    render(<TenantAdminDashboard />);
    expect(hoisted.userSignals).toEqual([]);
    await act(async () => { hoisted.captured.onAction('new-user'); });
    expect(hoisted.userSignals.some((v) => v > 0)).toBe(true);
  });

  it('the user signal settles back to 0 after firing', async () => {
    render(<TenantAdminDashboard />);
    await act(async () => { hoisted.captured.onAction('new-user'); });
    expect(hoisted.userSignals[hoisted.userSignals.length - 1]).toBe(0);
  });

  it('"quick-add" action does not throw and does not change the active tab', async () => {
    render(<TenantAdminDashboard />);
    await act(async () => { hoisted.captured.onAction('quick-add'); });
    expect(hoisted.captured.activeTab).toBe('dashboard');
  });
});
