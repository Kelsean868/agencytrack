// @vitest-environment jsdom
//
// quickAddConfig — tenantAdmin config (Tier 1 · 1.3).
//
// TenantAdminDashboard's Quick-Add menu fires real create flows (BranchesPanel
// / UserManagementPanel), unlike the route-to-tab-only actions in the other
// configs. This covers the value contract getQuickAddActions('tenantAdmin')
// must satisfy for TenantAdminDashboard + QuickAddMenu to wire correctly.

import { describe, it, expect } from 'vitest';
import { getQuickAddActions } from '../quickAddConfig';

describe('quickAddConfig — tenantAdmin', () => {
  it('returns exactly New branch then New user, in that order', () => {
    const actions = getQuickAddActions('tenantAdmin');
    expect(actions.map((a) => a.key)).toEqual(['new-branch', 'new-user']);
  });

  it('marks New branch as the primary (highlighted) action', () => {
    const branch = getQuickAddActions('tenantAdmin').find((a) => a.key === 'new-branch');
    expect(branch.primary).toBe(true);
    expect(branch.label).toBe('New branch');
  });

  it('New user is not primary and carries no soon flag', () => {
    const user = getQuickAddActions('tenantAdmin').find((a) => a.key === 'new-user');
    expect(user.primary).toBeUndefined();
    expect(user.soon).toBeUndefined();
    expect(user.label).toBe('New user');
  });

  it('every action carries an Icon component (QuickAddMenu renders <Icon /> unconditionally)', () => {
    for (const action of getQuickAddActions('tenantAdmin')) {
      expect(action.Icon).toBeTruthy();
    }
  });

  it('falls back to an empty array for an unrecognized configKey (existing contract)', () => {
    expect(getQuickAddActions('not-a-real-role')).toEqual([]);
  });
});
