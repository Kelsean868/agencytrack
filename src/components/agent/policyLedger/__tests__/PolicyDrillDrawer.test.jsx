// Dialog a11y contract (§4 dialog sweep) for the Policy Ledger drill-down
// drawer. Component previously had Escape-only handling — no trap, no
// initial focus, no focus-return.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  authValue: { tenantId: 't1', user: { uid: 'agent-1' } },
  getPolicyHistory: vi.fn(),
}));

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));

vi.mock('../../../../services/policiesService', () => ({
  getPolicyHistory: (...a) => hoisted.getPolicyHistory(...a),
}));

vi.mock('../../../../services/prospectInfoService', () => ({
  PROSPECTING_SOURCE_LABELS: { referral: 'Referral' },
}));

vi.mock('../../../../constants/policyLifecycle', () => ({
  LEGAL_AGENT_TRANSITIONS: {
    submitted: ['rated', 'postponed', 'ntu', 'denied', 'settled'],
    rated: ['settled', 'ntu'],
    settled: [],
  },
  POLICY_STATUS_LABELS: {
    submitted: 'Submitted',
    rated: 'Rated',
    postponed: 'Postponed',
    ntu: 'NTU',
    denied: 'Denied',
    settled: 'Settled',
  },
}));

import PolicyDrillDrawer from '../PolicyDrillDrawer';

function makePolicy(overrides = {}) {
  return {
    id: 'p1',
    ownerName: 'Test Owner',
    status: 'submitted',
    proposedAPI: 5000,
    productLine: 'life',
    sourceOfProspect: 'referral',
    cashWithApp: { collected: false, amount: '' },
    confirmedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getPolicyHistory.mockResolvedValue([]);
});

describe('PolicyDrillDrawer', () => {
  it('renders the policy owner name and status', async () => {
    render(
      <PolicyDrillDrawer
        policy={makePolicy()}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    expect(screen.getByText('Test Owner')).toBeInTheDocument();
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
  });

  it('renders only the plan name when insured matches owner', async () => {
    render(
      <PolicyDrillDrawer
        policy={makePolicy({ planName: 'Tatil Term 20' })}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    expect(screen.getByText('Tatil Term 20')).toBeInTheDocument();
    expect(screen.queryByText(/Insured ·/)).not.toBeInTheDocument();
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
  });

  it('prefixes the plan line with "Insured · <name>" when insured differs from owner', async () => {
    render(
      <PolicyDrillDrawer
        policy={makePolicy({ ownerName: 'Devon Holder', insuredName: 'Marisa Holder', planName: 'Tatil Term 20' })}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    expect(screen.getByText('Insured · Marisa Holder · Tatil Term 20')).toBeInTheDocument();
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
  });

  it('calls onClose when the header Close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <PolicyDrillDrawer
        policy={makePolicy()}
        onClose={onClose}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── Dialog a11y contract (§4 dialog sweep) ───────────────────────────────────

describe('PolicyDrillDrawer — dialog a11y', () => {
  it('exposes role=dialog + aria-modal=true + aria-label', () => {
    render(
      <PolicyDrillDrawer
        policy={makePolicy()}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Policy detail — Test Owner');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <PolicyDrillDrawer
        policy={makePolicy()}
        onClose={onClose}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', () => {
    render(
      <PolicyDrillDrawer
        policy={makePolicy()}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
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
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <PolicyDrillDrawer
        policy={makePolicy()}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
