// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  getPolicyPlans:    vi.fn(),
  addPlan:           vi.fn(),
  updatePlan:        vi.fn(),
  deactivatePlan:    vi.fn(),
  promotePendingPlan: vi.fn(),
  dismissPendingPlan: vi.fn(),
}));

vi.mock('../../../services/planCatalogService', () => ({
  getPolicyPlans:    hoisted.getPolicyPlans,
  addPlan:           hoisted.addPlan,
  updatePlan:        hoisted.updatePlan,
  deactivatePlan:    hoisted.deactivatePlan,
  promotePendingPlan: hoisted.promotePendingPlan,
  dismissPendingPlan: hoisted.dismissPendingPlan,
}));

import PlanCatalogModal from '../PlanCatalogModal';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT = 'tenant1';

const ACTIVE_PLAN = {
  id: 'plan-001',
  name: 'Whole Life Plus',
  class: 'whole_life',
  productLine: 'life',
  isActive: true,
};

const RETIRED_PLAN = {
  id: 'plan-002',
  name: 'Old Term',
  class: 'term',
  productLine: 'life',
  isActive: false,
};

const PENDING_ENTRY = {
  name: 'Mystery Plan',
  loggedByAgents: 3,
  firstLoggedAt: null,
  contributedPolicyIds: ['p1', 'p2', 'p3'],
};

function renderModal(overrides = {}) {
  const onClose = vi.fn();
  const props = { tenantId: TENANT, onClose, ...overrides };
  render(<PlanCatalogModal {...props} />);
  return { onClose };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [] });
  hoisted.addPlan.mockResolvedValue();
  hoisted.updatePlan.mockResolvedValue();
  hoisted.deactivatePlan.mockResolvedValue();
  hoisted.promotePendingPlan.mockResolvedValue();
  hoisted.dismissPendingPlan.mockResolvedValue();
});

// ── Active Plans tab ──────────────────────────────────────────────────────────

describe('Active Plans tab', () => {
  it('shows empty state when no plans', async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByTestId('no-active-plans')).toBeInTheDocument()
    );
  });

  it('renders active plan rows with name and class', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({
      plans: [ACTIVE_PLAN],
      pendingReview: [],
    });
    renderModal();
    await waitFor(() =>
      expect(screen.getByText('Whole Life Plus')).toBeInTheDocument()
    );
    expect(screen.getAllByText(/Whole Life/).length).toBeGreaterThan(0);
  });

  it('shows retired plans with (Retired) tag', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({
      plans: [ACTIVE_PLAN, RETIRED_PLAN],
      pendingReview: [],
    });
    renderModal();
    await waitFor(() =>
      expect(screen.getByTestId(`retired-plan-${RETIRED_PLAN.id}`)).toBeInTheDocument()
    );
    expect(screen.getByText('(Retired)')).toBeInTheDocument();
  });

  it('Add Plan button opens add form', async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByTestId('no-active-plans')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('add-plan-btn'));
    expect(screen.getByTestId('plan-form')).toBeInTheDocument();
    expect(screen.getByText('New Plan')).toBeInTheDocument();
  });

  it('submitting add form calls addPlan and reloads', async () => {
    hoisted.getPolicyPlans
      .mockResolvedValueOnce({ plans: [], pendingReview: [] })
      .mockResolvedValueOnce({ plans: [ACTIVE_PLAN], pendingReview: [] });

    renderModal();
    await waitFor(() => expect(screen.getByTestId('no-active-plans')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('add-plan-btn'));
    fireEvent.change(screen.getByLabelText(/Plan Name/i), { target: { value: 'Whole Life Plus' } });
    fireEvent.click(screen.getByTestId('plan-form-submit'));

    await waitFor(() =>
      expect(hoisted.addPlan).toHaveBeenCalledWith(TENANT, {
        name: 'Whole Life Plus',
        class: 'whole_life',
        productLine: 'life',
      })
    );
    await waitFor(() =>
      expect(screen.getByText('Whole Life Plus')).toBeInTheDocument()
    );
  });

  it('Edit click opens edit form pre-filled', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [ACTIVE_PLAN], pendingReview: [] });
    renderModal();

    await waitFor(() =>
      expect(screen.getByTestId(`edit-plan-${ACTIVE_PLAN.id}`)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId(`edit-plan-${ACTIVE_PLAN.id}`));
    expect(screen.getByTestId('plan-form')).toBeInTheDocument();
    expect(screen.getByText('Edit Plan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Whole Life Plus')).toBeInTheDocument();
  });

  it('submitting edit form calls updatePlan', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [ACTIVE_PLAN], pendingReview: [] });
    renderModal();

    await waitFor(() =>
      expect(screen.getByTestId(`edit-plan-${ACTIVE_PLAN.id}`)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId(`edit-plan-${ACTIVE_PLAN.id}`));
    fireEvent.change(screen.getByDisplayValue('Whole Life Plus'), { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByTestId('plan-form-submit'));

    await waitFor(() =>
      expect(hoisted.updatePlan).toHaveBeenCalledWith(
        TENANT, ACTIVE_PLAN.id,
        expect.objectContaining({ name: 'Updated Name' })
      )
    );
  });

  it('Deactivate button calls deactivatePlan', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [ACTIVE_PLAN], pendingReview: [] });
    renderModal();

    await waitFor(() =>
      expect(screen.getByTestId(`deactivate-plan-${ACTIVE_PLAN.id}`)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId(`deactivate-plan-${ACTIVE_PLAN.id}`));

    await waitFor(() =>
      expect(hoisted.deactivatePlan).toHaveBeenCalledWith(TENANT, ACTIVE_PLAN.id)
    );
  });
});

// ── Pending Review tab ────────────────────────────────────────────────────────

describe('Pending Review tab', () => {
  function switchToPending() {
    fireEvent.click(screen.getByRole('button', { name: /Pending Review/i }));
  }

  it('shows empty state when no pending items', async () => {
    renderModal();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    switchToPending();
    expect(screen.getByTestId('no-pending')).toBeInTheDocument();
  });

  it('renders pending rows with name and loggedByAgents', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [PENDING_ENTRY] });
    renderModal();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    switchToPending();

    expect(screen.getByText('Mystery Plan')).toBeInTheDocument();
    expect(screen.getByText(/Logged by 3 agents/)).toBeInTheDocument();
  });

  it('pending badge shows count on tab', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [PENDING_ENTRY] });
    renderModal();
    await waitFor(() =>
      expect(screen.getByText('1')).toBeInTheDocument()
    );
  });

  it('Approve button opens promote form', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [PENDING_ENTRY] });
    renderModal();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    switchToPending();

    fireEvent.click(screen.getByTestId(`approve-btn-${PENDING_ENTRY.name}`));
    expect(screen.getByTestId(`promote-form-${PENDING_ENTRY.name}`)).toBeInTheDocument();
    expect(screen.getByText(/Approve:/)).toBeInTheDocument();
  });

  it('submitting promote form calls promotePendingPlan', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [PENDING_ENTRY] });
    renderModal();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    switchToPending();

    fireEvent.click(screen.getByTestId(`approve-btn-${PENDING_ENTRY.name}`));
    fireEvent.click(screen.getByTestId(`promote-submit-${PENDING_ENTRY.name}`));

    await waitFor(() =>
      expect(hoisted.promotePendingPlan).toHaveBeenCalledWith(
        TENANT,
        PENDING_ENTRY.name,
        expect.objectContaining({ policyClass: 'whole_life' })
      )
    );
  });

  it('Dismiss button calls dismissPendingPlan', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [], pendingReview: [PENDING_ENTRY] });
    renderModal();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    switchToPending();

    fireEvent.click(screen.getByTestId(`dismiss-btn-${PENDING_ENTRY.name}`));
    await waitFor(() =>
      expect(hoisted.dismissPendingPlan).toHaveBeenCalledWith(TENANT, PENDING_ENTRY.name)
    );
  });

  it('Close button calls onClose', async () => {
    const { onClose } = renderModal();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});

// ── Dialog a11y contract (§4 dialog sweep) ───────────────────────────────────

describe('PlanCatalogModal — dialog a11y', () => {
  it('exposes role=dialog + aria-modal=true + aria-labelledby', async () => {
    renderModal();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'plan-catalog-heading');
  });

  it('calls onClose when Escape is pressed', async () => {
    const { onClose } = renderModal();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', async () => {
    hoisted.getPolicyPlans.mockResolvedValue({ plans: [ACTIVE_PLAN], pendingReview: [] });
    renderModal();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(screen.getByTestId(`edit-plan-${ACTIVE_PLAN.id}`)).toBeInTheDocument()
    );
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

  it('restores focus to the invoking element when the modal unmounts', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = vi.fn();
    const { unmount } = render(<PlanCatalogModal tenantId={TENANT} onClose={onClose} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeInTheDocument());
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

describe('§1 states contract (error / retry)', () => {
  it('renders a persistent inline error card with a wired Retry when the load fails', async () => {
    hoisted.getPolicyPlans.mockRejectedValueOnce(new Error('boom-catalog'));
    renderModal();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom-catalog'));
    expect(hoisted.getPolicyPlans).toHaveBeenCalledTimes(1);

    hoisted.getPolicyPlans.mockResolvedValueOnce({ plans: [ACTIVE_PLAN], pendingReview: [] });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.queryByText('boom-catalog')).toBeNull());
    expect(hoisted.getPolicyPlans).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Whole Life Plus')).toBeInTheDocument();
  });
});
