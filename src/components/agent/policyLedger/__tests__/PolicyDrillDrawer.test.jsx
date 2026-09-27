// Dialog a11y contract (§4 dialog sweep) for the Policy Ledger drill-down
// drawer. Component previously had Escape-only handling — no trap, no
// initial focus, no focus-return.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

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
import { awardWindowsForPolicy } from '../../../../lib/ledgerProduction';
import { awardLensPeriods } from '../../../../utils/awardsEngine';
import { TODAY, CHRISTMAS, POLICIES } from '../../../../lib/__tests__/fixtures/awardLensFixtures';

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

// ── L3 — "Counts toward" chips (docs/briefs/ledger-lens-build.md § L3) ──────
//
// Same `awardWindowsForPolicy` rows and fixtures as the PolicyCard chip tests
// (src/components/agent/policyLedger/__tests__/PolicyCard.test.jsx) — the
// requirement is that the drawer shows the SAME list as the card it was
// opened from, not a second derivation.
const l3Periods = awardLensPeriods({ today: TODAY, campaigns: [CHRISTMAS] });
const l3ById = (id) => POLICIES.find((p) => p.id === id);
const l3WindowsFor = (id) => awardWindowsForPolicy(l3ById(id), l3Periods.current);

describe('PolicyDrillDrawer — "Counts toward" chips (L3)', () => {
  it('shows the same gold chip list a settled policy\'s card would show', async () => {
    render(
      <PolicyDrillDrawer
        policy={l3ById('B')}
        awardWindows={l3WindowsFor('B')}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    const chips = screen.getByTestId('award-window-chips');
    expect(within(chips).getByText('Counts toward')).toBeInTheDocument();
    expect(within(chips).getByTestId('award-window-chip-mdrt:2026')).toHaveTextContent('MDRT 2026');
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
  });

  it('shows grey "Will count toward" chips for a submitted (not settled) policy', async () => {
    render(
      <PolicyDrillDrawer
        policy={l3ById('D')}
        awardWindows={l3WindowsFor('D')}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    const chips = screen.getByTestId('award-window-chips');
    expect(within(chips).getByText('Will count toward')).toBeInTheDocument();
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
  });

  it('renders no chip row when awardWindows is omitted (back-compat)', async () => {
    render(
      <PolicyDrillDrawer
        policy={makePolicy()}
        onClose={() => {}}
        onTransition={() => {}}
        transitioning={false}
        transitionError={null}
      />
    );
    expect(screen.queryByTestId('award-window-chips')).not.toBeInTheDocument();
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
  });
});

// ── P2d (BUG-01 option B) — the agent self-confirms their own settled policy ──
describe('PolicyDrillDrawer — self-confirm (P2d)', () => {
  // A self-declared settlement: the agent set the status (statusSource 'agent').
  const settled = (over = {}) => makePolicy({
    status: 'settled', statusSource: 'agent', settledAPI: null, proposedAPI: 5000, ...over,
  });

  it('own self-declared settled, not manager-confirmed: offers "Confirm details", prefilled, and submits the four fields', async () => {
    const onSelfConfirm = vi.fn();
    render(<PolicyDrillDrawer policy={settled({ initialPremium: 400 })} onClose={() => {}} onTransition={() => {}} onSelfConfirm={onSelfConfirm} />);
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
    const box = screen.getByTestId('drawer-self-confirm');
    fireEvent.change(box.querySelector('input[name="issuedCoverage"]'), { target: { value: '250000' } });
    fireEvent.change(box.querySelector('input[name="earnedCommission"]'), { target: { value: '1250' } });
    fireEvent.click(screen.getByTestId('drawer-self-confirm-submit'));
    expect(onSelfConfirm).toHaveBeenCalledWith({
      settledAPI: '5000', issuedCoverage: '250000', initialPremium: '400', earnedCommission: '1250',
    });
  });

  // Kyron's ruling, 27 Sep 2026 (option A): head-office figures are locked.
  it('RULING: a head-office settled policy shows its figures read-only, "Set by head office", and no Confirm', async () => {
    const onSelfConfirm = vi.fn();
    render(<PolicyDrillDrawer
      policy={settled({ statusSource: 'oipa_import', settledAPI: null, proposedAPI: 36000, issuedCoverage: 500000 })}
      onClose={() => {}} onTransition={() => {}} onSelfConfirm={onSelfConfirm} />);
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
    expect(screen.queryByTestId('drawer-self-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drawer-self-confirm-submit')).not.toBeInTheDocument();
    const box = screen.getByTestId('drawer-ho-figures');
    expect(box).toHaveTextContent(/Set by head office/);
    expect(box.querySelectorAll('input')).toHaveLength(0);
    expect(box).toHaveTextContent(/36,000/);   // settled API falls back to what production counts
    expect(box).toHaveTextContent(/500,000/);
    expect(onSelfConfirm).not.toHaveBeenCalled();
  });

  it('a manager-confirmed policy offers no self-confirm (the manager figure is final)', async () => {
    render(<PolicyDrillDrawer policy={settled({ confirmedByUid: 'bm-1', confirmedAt: new Date(), confirmedByManager: 'BM' })} onClose={() => {}} onTransition={() => {}} onSelfConfirm={vi.fn()} />);
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
    expect(screen.queryByTestId('drawer-self-confirm')).not.toBeInTheDocument();
  });

  it('a policy that is not settled offers no self-confirm', async () => {
    render(<PolicyDrillDrawer policy={makePolicy()} onClose={() => {}} onTransition={() => {}} onSelfConfirm={vi.fn()} />);
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
    expect(screen.queryByTestId('drawer-self-confirm')).not.toBeInTheDocument();
  });

  it('a self-confirmed policy says so, and never as the gold manager card', async () => {
    render(<PolicyDrillDrawer policy={settled({ selfConfirmedAt: new Date('2026-09-20T12:00:00Z') })} onClose={() => {}} onTransition={() => {}} onSelfConfirm={vi.fn()} />);
    await waitFor(() => expect(hoisted.getPolicyHistory).toHaveBeenCalled());
    expect(screen.getByTestId('drawer-self-confirmed')).toHaveTextContent(/Self-confirmed/);
    expect(screen.queryByTestId('drawer-confirmation')).not.toBeInTheDocument();
  });
});
