// @vitest-environment jsdom
//
// Slice 2.1a — wizard entry-gate.
// Asserts that the "Submit Weekly Report" button renders for unit_manager
// (when onSubmitReport is provided) and is absent for BM/SM/TA (undefined).

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../hooks/useBranchOverview', () => ({
  useBranchOverview: vi.fn().mockReturnValue({
    loading: false,
    error: null,
    teamYTDAPI: 0,
    teamAnnualGoal: 0,
    goalSet: false,
    inScopeAgentCount: 1,
    kpiData: { compliance: [], api: [], apps: [], ffi: [] },
    activityEvents: [],
    badgeCounts: [],
  }),
}));

vi.mock('../ManagerHeroSection', () => ({ default: () => null }));
vi.mock('../BranchKPIStrip',     () => ({ default: () => null }));
vi.mock('../BranchActivityFeed', () => ({ default: () => null }));
vi.mock('../TeamMedalsPanel',    () => ({ default: () => null }));

import ManagerOverviewTab from '../ManagerOverviewTab';

describe('ManagerOverviewTab — Submit Weekly Report wizard gate (Slice 2.1a)', () => {
  it('renders button for unit_manager when onSubmitReport is provided', () => {
    const managerRole = 'unit_manager';
    render(
      <ManagerOverviewTab
        role={managerRole}
        userProfile={{}}
        tenantId="t1"
        onSubmitReport={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /submit weekly report/i })).toBeInTheDocument();
  });

  it.each([
    ['branch_manager'],
    ['sales_manager'],
    ['tenant_admin'],
  ])('hides button for %s (onSubmitReport=undefined)', (role) => {
    render(
      <ManagerOverviewTab
        role={role}
        userProfile={{}}
        tenantId="t1"
        onSubmitReport={undefined}
      />
    );
    expect(screen.queryByRole('button', { name: /submit weekly report/i })).toBeNull();
  });
});
