// @vitest-environment jsdom
//
// Role gate for the "Import portfolio" button that PolicyLedgerPanel renders
// next to "New Policy". Lives alongside the rest of the portfolio-import
// tests (per the P4c brief) even though the button itself is wired into
// PolicyLedgerPanel.jsx rather than into a file in this folder.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  getOwnPolicies: vi.fn(),
  createPolicy: vi.fn(),
  transitionPolicyStatus: vi.fn(),
  getPolicyHistory: vi.fn(),
  getPolicyPlans: vi.fn(),
  useAuth: vi.fn(),
  useFeatureFlag: vi.fn(() => false),
  getActiveCampaignsForAgent: vi.fn(),
}));

vi.mock('../../../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../../../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: hoisted.useFeatureFlag,
}));

vi.mock('../../../../../services/campaignService', () => ({
  getActiveCampaignsForAgent: hoisted.getActiveCampaignsForAgent,
}));

vi.mock('../../../../../services/policiesService', () => ({
  getOwnPolicies: hoisted.getOwnPolicies,
  createPolicy: hoisted.createPolicy,
  transitionPolicyStatus: hoisted.transitionPolicyStatus,
  getPolicyHistory: hoisted.getPolicyHistory,
}));

vi.mock('../../../../../services/prospectInfoService', () => ({
  PROSPECTING_SOURCES: [{ value: 'referral', label: 'Referral' }],
  PROSPECTING_SOURCE_LABELS: { referral: 'Referral' },
}));

vi.mock('../../../../../services/planCatalogService', () => ({
  getPolicyPlans: hoisted.getPolicyPlans,
}));

vi.mock('../../../../../constants/policyLifecycle', () => ({
  POLICY_STATUSES: ['written', 'submitted', 'rated', 'postponed', 'ntu', 'denied', 'settled', 'lapsed'],
  LEGAL_AGENT_TRANSITIONS: {},
  POLICY_STATUS_LABELS: {},
}));

import PolicyLedgerPanel from '../../../PolicyLedgerPanel';

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.getOwnPolicies.mockResolvedValue([]);
  hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [] });
  hoisted.useFeatureFlag.mockReturnValue(false);
  hoisted.getActiveCampaignsForAgent.mockResolvedValue([]);
});

function renderAsRole(role) {
  hoisted.useAuth.mockReturnValue({
    user: { uid: 'agent1' },
    userProfile: { name: 'Agent Name' },
    role,
    tenantId: 'tenant1',
  });
  return render(<PolicyLedgerPanel />);
}

describe('PolicyLedgerPanel — Import portfolio role gate', () => {
  it.each(['agent', 'unit_manager', 'branch_manager'])('shows the button for %s', async (role) => {
    renderAsRole(role);
    await waitFor(() => expect(screen.getByTestId('policy-ledger-surface')).toBeInTheDocument());
    expect(screen.getByTestId('import-portfolio-button')).toBeInTheDocument();
  });

  it.each(['sales_manager', 'tenant_admin'])('hides the button for %s', async (role) => {
    renderAsRole(role);
    await waitFor(() => expect(screen.getByTestId('policy-ledger-surface')).toBeInTheDocument());
    expect(screen.queryByTestId('import-portfolio-button')).not.toBeInTheDocument();
  });
});
