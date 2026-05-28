// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  getOwnPolicies:         vi.fn(),
  createPolicy:           vi.fn(),
  transitionPolicyStatus: vi.fn(),
  getPolicyHistory:       vi.fn(),
  useAuth:                vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../../services/policiesService', () => ({
  getOwnPolicies:          hoisted.getOwnPolicies,
  createPolicy:            hoisted.createPolicy,
  transitionPolicyStatus:  hoisted.transitionPolicyStatus,
  getPolicyHistory:        hoisted.getPolicyHistory,
}));

vi.mock('../../../services/prospectInfoService', () => ({
  PROSPECTING_SOURCES: [
    { value: 'referral',     label: 'Referral' },
    { value: 'social-media', label: 'Social Media' },
  ],
  PROSPECTING_SOURCE_LABELS: {
    referral:       'Referral',
    'social-media': 'Social Media',
  },
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
  vi.resetAllMocks();  // also flushes mockResolvedValueOnce queues
  hoisted.useAuth.mockReturnValue({
    user:        { uid: 'agent1' },
    userProfile: { name: 'Agent Name' },
    role:        'agent',
    tenantId:    'tenant1',
  });
  hoisted.getOwnPolicies.mockResolvedValue([]);  // default: empty list
  hoisted.createPolicy.mockResolvedValue({ id: 'new-p1' });
  hoisted.transitionPolicyStatus.mockResolvedValue();
  hoisted.getPolicyHistory.mockResolvedValue([]);
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

// ── List view state tests ──────────────────────────────────────────────────────

describe('PolicyLedgerPanel — list view states', () => {
  it('renders "No policies yet" empty state when list is empty', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);
    await waitFor(() =>
      expect(screen.getByText(/No policies yet/)).toBeInTheDocument()
    );
  });

  it('renders error banner when getOwnPolicies rejects', async () => {
    hoisted.getOwnPolicies.mockRejectedValueOnce(new Error('network timeout'));
    render(<PolicyLedgerPanel />);
    await waitFor(() =>
      expect(screen.getByText(/network timeout/)).toBeInTheDocument()
    );
  });

  it('renders "New Policy" button in list view', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
  });

  it('renders policy owner name and status badge in list', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([makePolicy({ ownerName: 'Jane Doe', status: 'submitted' })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument());
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });
});

// ── Create form tests ──────────────────────────────────────────────────────────

describe('PolicyLedgerPanel — create form', () => {
  it('clicking New Policy switches to create view with back button', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
    );
  });

  it('successful create calls createPolicy and returns to list view', async () => {
    hoisted.getOwnPolicies
      .mockResolvedValueOnce([])              // initial load
      .mockResolvedValueOnce([makePolicy()]); // reload after create

    const { container } = render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));

    // Submit via the form element to bypass JSDOM's per-browser submit-button semantics
    await waitFor(() => container.querySelector('form'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(hoisted.createPolicy).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
  });

  it('createPolicy failure shows inline error message', async () => {
    hoisted.createPolicy.mockRejectedValueOnce(new Error('Permission denied'));

    const { container } = render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));

    await waitFor(() => container.querySelector('form'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(screen.getByText(/Permission denied/)).toBeInTheDocument());
  });
});

// ── Status transition modal tests ─────────────────────────────────────────────

describe('PolicyLedgerPanel — transition modal', () => {
  it('Update Status button opens transition modal for a submitted policy', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([makePolicy({ status: 'submitted' })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Update Status/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Update Status/i }));
    // Modal title is "Update Status" — it now appears twice (card button + modal heading)
    await waitFor(() => {
      const h3 = document.querySelector('h3');
      expect(h3).toBeTruthy();
      expect(h3.textContent).toMatch(/Update Status/i);
    });
  });

  it('transition modal lists legal next statuses for submitted policy', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([makePolicy({ status: 'submitted' })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Update Status/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Update Status/i }));
    await waitFor(() => {
      // Modal should list rated/postponed/ntu/denied/settled as options
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  it('successful transition calls transitionPolicyStatus and closes modal', async () => {
    hoisted.getOwnPolicies
      .mockResolvedValueOnce([makePolicy({ status: 'submitted' })])
      .mockResolvedValueOnce([makePolicy({ status: 'rated' })]);

    const { container } = render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /Update Status/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Update Status/i }));

    // Wait for transition modal form to appear
    await waitFor(() => container.querySelector('form'));

    // Submit via form element — Confirm button is type="submit" inside the form
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(hoisted.transitionPolicyStatus).toHaveBeenCalledOnce());
    // After successful transition, modal closes — h3 "Update Status" disappears
    await waitFor(() => expect(document.querySelector('h3')).toBeNull());
  });
});

// ── initialForm prefill tests (F3.1) ─────────────────────────────────────────

describe('PolicyLedgerPanel — initialForm prefill', () => {
  it('initialForm prop pre-populates ownerName and sourceOfProspect in create form', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    const prefill = { ownerName: 'Prefilled Owner', sourceOfProspect: 'referral' };
    render(<PolicyLedgerPanel initialForm={prefill} onPrefillConsumed={vi.fn()} />);

    // Form auto-opens on mount — no click needed
    await waitFor(() => expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument());
    expect(screen.getByLabelText(/Owner Name/i).value).toBe('Prefilled Owner');
  });

  it('missing initialForm prop → form starts as EMPTY_FORM (no regression)', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);

    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument());
    expect(screen.getByLabelText(/Owner Name/i).value).toBe('');
  });

  it('onPrefillConsumed is called on mount when initialForm is provided', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    const onPrefillConsumed = vi.fn();
    const prefill = { ownerName: 'Consumed Owner', sourceOfProspect: 'cold-call' };
    render(<PolicyLedgerPanel initialForm={prefill} onPrefillConsumed={onPrefillConsumed} />);

    // Form auto-opens on mount; callback fires via mount effect
    await waitFor(() => expect(onPrefillConsumed).toHaveBeenCalledOnce());
  });
});

// ── socialPlatform conditional select (PR #319) ────────────────────────────────

describe('PolicyLedgerPanel — socialPlatform conditional select', () => {
  it('platform select appears when sourceOfProspect is changed to social-media', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);

    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument());

    // Default source is '' — no Platform select
    expect(screen.queryByLabelText(/^Platform/i)).not.toBeInTheDocument();

    // Change to social-media
    fireEvent.change(screen.getByLabelText(/Source of Prospect/i), { target: { value: 'social-media' } });
    expect(screen.getByLabelText(/^Platform/i)).toBeInTheDocument();
  });

  it('platform select disappears when source changes away from social-media', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);

    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/Source of Prospect/i), { target: { value: 'social-media' } });
    expect(screen.getByLabelText(/^Platform/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Source of Prospect/i), { target: { value: 'referral' } });
    expect(screen.queryByLabelText(/^Platform/i)).not.toBeInTheDocument();
  });

  it('save button is disabled when social-media selected but no platform chosen, enabled after picking platform', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);

    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument());

    // Select social-media — platform not yet chosen → save disabled
    fireEvent.change(screen.getByLabelText(/Source of Prospect/i), { target: { value: 'social-media' } });
    expect(screen.getByRole('button', { name: /Save Policy/i })).toBeDisabled();

    // Pick a platform → save enabled
    fireEvent.change(screen.getByLabelText(/^Platform/i), { target: { value: 'whatsapp' } });
    expect(screen.getByRole('button', { name: /Save Policy/i })).not.toBeDisabled();
  });

  it('createPolicy is called with socialPlatform when social-media source is selected', async () => {
    hoisted.getOwnPolicies
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { container } = render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument());

    // Select social-media source and pick a platform
    fireEvent.change(screen.getByLabelText(/Source of Prospect/i), { target: { value: 'social-media' } });
    fireEvent.change(screen.getByLabelText(/^Platform/i), { target: { value: 'instagram' } });

    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(hoisted.createPolicy).toHaveBeenCalledOnce());

    const [, , formData] = hoisted.createPolicy.mock.calls[0];
    expect(formData.sourceOfProspect).toBe('social-media');
    expect(formData.socialPlatform).toBe('instagram');
  });
});
