// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  getOwnPolicies: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../../services/policiesService', () => ({
  getOwnPolicies:          hoisted.getOwnPolicies,
  createPolicy:            vi.fn(),
  transitionPolicyStatus:  vi.fn(),
}));

vi.mock('../../../services/prospectInfoService', () => ({
  PROSPECTING_SOURCES: [],
  PROSPECTING_SOURCE_LABELS: {},
}));

vi.mock('../../../constants/policyLifecycle', () => ({
  LEGAL_AGENT_TRANSITIONS: {
    submitted: ['rated', 'postponed', 'ntu', 'denied', 'settled'],
    rated:     ['settled', 'ntu'],
    postponed: ['submitted', 'settled', 'denied'],
    ntu:       [],
    denied:    [],
    settled:   [],
  },
  POLICY_STATUS_LABELS: {
    submitted: 'Submitted',
    rated:     'Rated',
    postponed: 'Postponed',
    ntu:       'NTU',
    denied:    'Denied',
    settled:   'Settled',
  },
}));

import PolicyLedgerPanel from '../PolicyLedgerPanel';

// ── Fixture factory ────────────────────────────────────────────────────────────

function makePolicy(overrides = {}) {
  return {
    id:              'p1',
    ownerName:       'Test Owner',
    insuredName:     'Test Owner',
    status:          'submitted',
    proposedAPI:     5000,
    sourceOfProspect: 'referral',
    cashWithApp:     { collected: false, amount: '' },
    dateWritten:     null,
    confirmedAt:     null,
    confirmedByManager: null,
    hasDiscrepancy:  false,
    settledAPI:      null,
    managerSettledAPI: null,
    managerNote:     null,
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.useAuth.mockReturnValue({
    user:        { uid: 'agent1' },
    userProfile: { name: 'Agent Name' },
    role:        'agent',
    tenantId:    'tenant1',
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PolicyLedgerPanel — confirmation strip', () => {
  it('confirmed + discrepancy → shows all chips, both values, and note', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([
      makePolicy({
        status:            'settled',
        proposedAPI:       3000,
        confirmedAt:       { toDate: () => new Date() },
        confirmedByManager: 'Test Branch Manager',
        hasDiscrepancy:    true,
        settledAPI:        5000,
        managerSettledAPI: 6000,
        managerNote:       'Adjusted per receipt.',
      }),
    ]);

    render(<PolicyLedgerPanel />);

    await waitFor(() =>
      expect(screen.getByText(/Confirmed by Test Branch Manager/)).toBeInTheDocument()
    );

    expect(screen.getByText('Discrepancy')).toBeInTheDocument();
    expect(screen.getByText(/TTD\s*5,000/)).toBeInTheDocument();
    expect(screen.getByText(/TTD\s*6,000/)).toBeInTheDocument();
    expect(screen.getByText(/Note: Adjusted per receipt\./)).toBeInTheDocument();
  });

  it('confirmed + clean → shows Confirmed chip and Settled value; no Discrepancy chip', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([
      makePolicy({
        status:            'settled',
        confirmedAt:       { toDate: () => new Date() },
        confirmedByManager: 'Branch Manager',
        hasDiscrepancy:    false,
        settledAPI:        4000,
        managerSettledAPI: 4000,
      }),
    ]);

    render(<PolicyLedgerPanel />);

    await waitFor(() =>
      expect(screen.getByText(/Confirmed by Branch Manager/)).toBeInTheDocument()
    );

    expect(screen.queryByText('Discrepancy')).not.toBeInTheDocument();
    expect(screen.getByText(/TTD\s*4,000/)).toBeInTheDocument();
  });

  it('confirmed + no managerNote → no Note line', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([
      makePolicy({
        status:            'settled',
        confirmedAt:       { toDate: () => new Date() },
        confirmedByManager: 'Branch Manager',
        hasDiscrepancy:    false,
        managerSettledAPI: 4000,
        managerNote:       null,
      }),
    ]);

    render(<PolicyLedgerPanel />);

    await waitFor(() =>
      expect(screen.getByText(/Confirmed by Branch Manager/)).toBeInTheDocument()
    );

    expect(screen.queryByText(/^Note:/)).not.toBeInTheDocument();
  });

  it('settled + not confirmed → shows "Awaiting manager confirmation"; no chip; no Update Status', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([
      makePolicy({
        status:      'settled',
        confirmedAt: null,
      }),
    ]);

    render(<PolicyLedgerPanel />);

    await waitFor(() =>
      expect(screen.getByText('Awaiting manager confirmation.')).toBeInTheDocument()
    );

    expect(screen.queryByText(/Confirmed by/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update Status/i })).not.toBeInTheDocument();
  });

  it('non-terminal (submitted) → Update Status button; no confirmation strip; no awaiting line', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([
      makePolicy({
        status:      'submitted',
        confirmedAt: null,
      }),
    ]);

    render(<PolicyLedgerPanel />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Update Status/i })).toBeInTheDocument()
    );

    expect(screen.queryByText(/Confirmed by/)).not.toBeInTheDocument();
    expect(screen.queryByText('Awaiting manager confirmation.')).not.toBeInTheDocument();
  });
});
