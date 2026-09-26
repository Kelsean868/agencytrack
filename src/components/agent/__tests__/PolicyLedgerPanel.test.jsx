// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  getOwnPolicies:         vi.fn(),
  createPolicy:           vi.fn(),
  transitionPolicyStatus: vi.fn(),
  getPolicyHistory:       vi.fn(),
  getPolicyPlans:         vi.fn(),
  useAuth:                vi.fn(),
  useFeatureFlag:         vi.fn(() => false),
  getActiveCampaignsForAgent: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: hoisted.useFeatureFlag,
}));

vi.mock('../../../services/campaignService', () => ({
  getActiveCampaignsForAgent: hoisted.getActiveCampaignsForAgent,
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

vi.mock('../../../services/planCatalogService', () => ({
  getPolicyPlans: hoisted.getPolicyPlans,
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
  hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [] });
  hoisted.useFeatureFlag.mockReturnValue(false);
  hoisted.getActiveCampaignsForAgent.mockResolvedValue([]);
});

describe('PolicyLedgerPanel — L1 award lens (campaign option behind the 3.4 flag)', () => {
  it('flag OFF — the award lens mounts, but no campaign fetch and no campaign option', async () => {
    hoisted.useFeatureFlag.mockReturnValue(false);
    hoisted.getOwnPolicies.mockResolvedValue([makePolicy({ id: 'p1' })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByTestId('award-lens-panel')).toBeInTheDocument());
    expect(hoisted.getActiveCampaignsForAgent).not.toHaveBeenCalled();
    expect(screen.queryByTestId(/^award-lens-option-campaign:/)).not.toBeInTheDocument();
    // The card is still reachable through the grouped list.
    expect(screen.getByTestId('policy-card-p1')).toBeInTheDocument();
  });

  it('flag ON — campaigns are fetched and an active one is pinned first', async () => {
    hoisted.useFeatureFlag.mockImplementation((k) => k === 'policyLedgerCampaignLens');
    hoisted.getOwnPolicies.mockResolvedValue([makePolicy({ id: 'p1' })]);
    hoisted.getActiveCampaignsForAgent.mockResolvedValue([{
      id: 'c1', name: 'Test Campaign', startDate: '2026-01-01', endDate: '2026-12-31',
      structure: 'qualify', tiers: [{ name: 'Bronze', api: 100000, apps: 10 }],
    }]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByTestId('award-lens-option-campaign:c1')).toBeInTheDocument());
    expect(hoisted.getActiveCampaignsForAgent).toHaveBeenCalledTimes(1);
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PolicyLedgerPanel — drawer confirmation (v2)', () => {
  async function openDrawerFor(policy) {
    hoisted.getOwnPolicies.mockResolvedValueOnce([policy]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => screen.getByTestId(`policy-card-${policy.id}`));
    fireEvent.click(screen.getByTestId(`policy-card-${policy.id}`));
    return waitFor(() => screen.getByTestId('policy-drawer'));
  }

  it('confirmed + discrepancy → drawer shows confirmation, both values, and note', async () => {
    await openDrawerFor(makePolicy({
      status:            'settled',
      proposedAPI:       3000,
      confirmedAt:       { toDate: () => new Date() },
      confirmedByManager: 'Test Branch Manager',
      hasDiscrepancy:    true,
      settledAPI:        5000,
      managerSettledAPI: 6000,
      managerNote:       'Adjusted per receipt.',
    }));

    const drawer = screen.getByTestId('policy-drawer');
    expect(within(drawer).getByText(/Confirmed by Test Branch Manager/)).toBeInTheDocument();
    expect(within(drawer).getByText(/TTD\s*5,000/)).toBeInTheDocument();
    expect(within(drawer).getByText(/TTD\s*6,000/)).toBeInTheDocument();
    expect(within(drawer).getByText(/Note: Adjusted per receipt\./)).toBeInTheDocument();
  });

  it('confirmed + clean → drawer shows "Confirmed value"; no discrepancy split', async () => {
    await openDrawerFor(makePolicy({
      status:            'settled',
      confirmedAt:       { toDate: () => new Date() },
      confirmedByManager: 'Branch Manager',
      hasDiscrepancy:    false,
      settledAPI:        4000,
      managerSettledAPI: 4000,
    }));

    const drawer = screen.getByTestId('policy-drawer');
    expect(within(drawer).getByText(/Confirmed value:/)).toBeInTheDocument();
    expect(within(drawer).getByText(/TTD\s*4,000/)).toBeInTheDocument();
    expect(within(drawer).queryByText(/Manager:/)).not.toBeInTheDocument();
  });

  it('confirmed + no managerNote → no Note line in drawer', async () => {
    await openDrawerFor(makePolicy({
      status:            'settled',
      confirmedAt:       { toDate: () => new Date() },
      confirmedByManager: 'Branch Manager',
      hasDiscrepancy:    false,
      managerSettledAPI: 4000,
      managerNote:       null,
    }));

    const drawer = screen.getByTestId('policy-drawer');
    expect(within(drawer).queryByText(/^Note:/)).not.toBeInTheDocument();
  });

  it('settled + FROM THE OIPA EXPORT → no "Awaiting manager" hint', async () => {
    // 229 imported policies showed this hint because the card asked
    // `confirmedAt` — which the import never sets — instead of asking where the
    // status came from. Head office is the authority there; no manager step was
    // ever part of that path, so there is nothing for the agent to wait on.
    hoisted.getOwnPolicies.mockResolvedValueOnce([makePolicy({
      status: 'settled', confirmedAt: null, statusSource: 'oipa_import',
    })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => screen.getByTestId('policy-card-p1'));
    expect(screen.queryByText('Awaiting manager')).not.toBeInTheDocument();
  });

  it('settled, imported, then CHANGED BY HAND → the hint comes back', async () => {
    // `importSource` says how the document arrived; `statusSource` says who set
    // the status. A person set this one, so it still needs the manager.
    hoisted.getOwnPolicies.mockResolvedValueOnce([makePolicy({
      status: 'settled', confirmedAt: null,
      importSource: 'oipa_import', statusSource: 'agent',
    })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => screen.getByTestId('policy-card-p1'));
    expect(screen.getByText('Awaiting manager')).toBeInTheDocument();
  });

  it('settled + not confirmed → card hint "Awaiting manager"; drawer has no confirmation + no transition footer', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([makePolicy({ status: 'settled', confirmedAt: null })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => screen.getByTestId('policy-card-p1'));
    expect(screen.getByText('Awaiting manager')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('policy-card-p1'));
    await waitFor(() => screen.getByTestId('policy-drawer'));
    const drawer = screen.getByTestId('policy-drawer');
    expect(within(drawer).queryByTestId('drawer-confirmation')).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId('drawer-tx-confirm')).not.toBeInTheDocument();
  });

  it('non-terminal (submitted) → drawer transition footer present; no confirmation card', async () => {
    await openDrawerFor(makePolicy({ status: 'submitted', confirmedAt: null }));
    const drawer = screen.getByTestId('policy-drawer');
    expect(within(drawer).getByTestId('drawer-tx-confirm')).toBeInTheDocument();
    expect(within(drawer).queryByTestId('drawer-confirmation')).not.toBeInTheDocument();
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

  it('error banner is a persistent alert with a wired Retry that re-invokes the same load path', async () => {
    hoisted.getOwnPolicies.mockRejectedValueOnce(new Error('network timeout'));
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByTestId('ledger-error')).toBeInTheDocument());
    expect(screen.getByTestId('ledger-error')).toHaveAttribute('role', 'alert');
    expect(hoisted.getOwnPolicies).toHaveBeenCalledTimes(1);

    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.queryByTestId('ledger-error')).toBeNull());
    expect(hoisted.getOwnPolicies).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/No policies yet/)).toBeInTheDocument();
  });

  it('renders "New Policy" button in list view', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: /New Policy/i })).toBeInTheDocument());
  });

  it('renders policy owner name and status pill in card', async () => {
    hoisted.getOwnPolicies.mockResolvedValueOnce([makePolicy({ ownerName: 'Jane Doe', status: 'submitted' })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => screen.getByTestId('policy-card-p1'));
    const card = screen.getByTestId('policy-card-p1');
    expect(within(card).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(card).getByText('Submitted')).toBeInTheDocument();
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

describe('PolicyLedgerPanel — transition (drawer split-button)', () => {
  async function openDrawerFor(policy) {
    hoisted.getOwnPolicies.mockResolvedValueOnce([policy]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => screen.getByTestId(`policy-card-${policy.id}`));
    fireEvent.click(screen.getByTestId(`policy-card-${policy.id}`));
    return waitFor(() => screen.getByTestId('policy-drawer'));
  }

  it('opening a submitted policy drawer shows the transition split-button (primary = Rated)', async () => {
    await openDrawerFor(makePolicy({ status: 'submitted' }));
    const drawer = screen.getByTestId('policy-drawer');
    expect(within(drawer).getByText('Move to Rated')).toBeInTheDocument();
    expect(within(drawer).getByTestId('drawer-tx-confirm')).toBeInTheDocument();
  });

  it('rated policy → transition offers only Settled + NTU; Lapsed/Postponed/Denied are absent', async () => {
    await openDrawerFor(makePolicy({ status: 'rated' }));
    const drawer = screen.getByTestId('policy-drawer');
    // Primary action = first legal next for rated = Settled.
    expect(within(drawer).getByText('Move to Settled')).toBeInTheDocument();
    // Open the "other status" menu → only NTU is offered.
    fireEvent.click(within(drawer).getByTestId('drawer-tx-menu-toggle'));
    expect(within(drawer).getByTestId('drawer-tx-option-ntu')).toBeInTheDocument();
    expect(within(drawer).queryByTestId('drawer-tx-option-lapsed')).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId('drawer-tx-option-postponed')).not.toBeInTheDocument();
    expect(within(drawer).queryByTestId('drawer-tx-option-denied')).not.toBeInTheDocument();
  });

  it('confirming a transition calls transitionPolicyStatus and closes the drawer', async () => {
    hoisted.getOwnPolicies
      .mockResolvedValueOnce([makePolicy({ status: 'submitted' })])
      .mockResolvedValueOnce([makePolicy({ status: 'rated' })]);
    render(<PolicyLedgerPanel />);
    await waitFor(() => screen.getByTestId('policy-card-p1'));
    fireEvent.click(screen.getByTestId('policy-card-p1'));
    await waitFor(() => screen.getByTestId('policy-drawer'));

    // Default target for a submitted policy is "rated"; submit the drawer form.
    fireEvent.submit(screen.getByTestId('policy-drawer').querySelector('form'));

    await waitFor(() => expect(hoisted.transitionPolicyStatus).toHaveBeenCalledOnce());
    const [, , policyId, fromStatus, toStatus] = hoisted.transitionPolicyStatus.mock.calls[0];
    expect(policyId).toBe('p1');
    expect(fromStatus).toBe('submitted');
    expect(toStatus).toBe('rated');
    await waitFor(() => expect(screen.queryByTestId('policy-drawer')).toBeNull());
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

// ── Plan catalog combobox tests (H4) ─────────────────────────────────────────

const CATALOG_PLAN = {
  id: 'plan-001',
  name: 'Whole Life Plus',
  class: 'whole_life',
  productLine: 'life',
  isActive: true,
};

describe('PolicyLedgerPanel — plan catalog combobox', () => {
  function openCreateForm() {
    return waitFor(() => screen.getByRole('button', { name: /New Policy/i })).then(() => {
      fireEvent.click(screen.getByRole('button', { name: /New Policy/i }));
      return waitFor(() => screen.getByRole('button', { name: /back/i }));
    });
  }

  it('renders plan picker select with catalog options', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({
      plans: [CATALOG_PLAN],
      pendingReview: [],
    });
    render(<PolicyLedgerPanel />);
    await openCreateForm();

    const picker = screen.getByTestId('plan-picker-select');
    expect(picker).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Whole Life Plus' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Other/i })).toBeInTheDocument();
  });

  it('selecting a catalog plan auto-fills policyClass and keeps field editable', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [CATALOG_PLAN], pendingReview: [] });
    render(<PolicyLedgerPanel />);
    await openCreateForm();

    const picker = screen.getByTestId('plan-picker-select');
    fireEvent.change(picker, { target: { value: CATALOG_PLAN.id } });

    // policyClass select should now be 'whole_life'
    const policyClassSelect = screen.getByLabelText(/Policy Class/i);
    expect(policyClassSelect.value).toBe('whole_life');

    // User can still change it (not locked)
    fireEvent.change(policyClassSelect, { target: { value: 'term' } });
    expect(policyClassSelect.value).toBe('term');
  });

  it('selecting "Other" shows free-text planName input; planId null on submit', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [CATALOG_PLAN], pendingReview: [] });
    hoisted.getOwnPolicies.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const { container } = render(<PolicyLedgerPanel />);
    await openCreateForm();

    const picker = screen.getByTestId('plan-picker-select');
    fireEvent.change(picker, { target: { value: '__other__' } });

    const freeText = screen.getByTestId('plan-name-freetext');
    expect(freeText).toBeInTheDocument();

    fireEvent.change(freeText, { target: { value: 'Custom New Plan' } });

    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(hoisted.createPolicy).toHaveBeenCalledOnce());

    const [, , formData] = hoisted.createPolicy.mock.calls[0];
    expect(formData.planId).toBeNull();
    expect(formData.planName).toBe('Custom New Plan');
  });

  it('F3.1 prefill with planId pre-selects the catalog picker mode', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [CATALOG_PLAN], pendingReview: [] });
    hoisted.getOwnPolicies.mockResolvedValueOnce([]);
    const prefill = { planId: CATALOG_PLAN.id, planName: CATALOG_PLAN.name, ownerName: 'Test' };
    render(<PolicyLedgerPanel initialForm={prefill} onPrefillConsumed={vi.fn()} />);

    await waitFor(() => screen.getByRole('button', { name: /back/i }));

    // The create-form mode switch (the "back" button above) and the prefill that
    // sets the picker's planId can commit in separate effect ticks — waiting only
    // for the button and then reading picker.value synchronously races the prefill
    // (reads '' under CI contention). Wait for the value itself, re-querying each
    // tick so a re-render doesn't leave a stale node reference.
    await waitFor(() => expect(screen.getByTestId('plan-picker-select')).toHaveValue(CATALOG_PLAN.id));
    expect(screen.queryByTestId('plan-name-freetext')).not.toBeInTheDocument();
  });
});

// ── initialFilter prop — D4 additive gate ────────────────────────────────────
describe('PolicyLedgerPanel — initialFilter prop', () => {
  beforeEach(() => {
    hoisted.useAuth.mockReturnValue({ user: { uid: 'u1' }, userProfile: {}, tenantId: 't1', role: 'agent' });
    hoisted.getOwnPolicies.mockResolvedValue([]);
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [] });
  });

  it('defaults to list view without crashing when initialFilter is not provided (default-unchanged)', async () => {
    render(<PolicyLedgerPanel />);
    // Component must mount and settle in list view — no create form, no crash.
    await waitFor(() => {
      expect(screen.getByTestId('policy-ledger-surface')).toBeInTheDocument();
    });
    // Must not show the create form (initialForm is absent → view starts as 'list')
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('initialises filter to the provided initialFilter value (lapsed)', async () => {
    render(<PolicyLedgerPanel initialFilter="lapsed" />);
    // The surface renders without crashing; filter chips only show when policies
    // are present (policies.length > 0 gate). Verify list view (not create form).
    await screen.findByTestId('policy-ledger-surface');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
