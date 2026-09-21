// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock auth ────────────────────────────────────────────────────────────────
vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ tenantId: 'tatillife_south' })),
}));

// ── Mock policies service ────────────────────────────────────────────────────
vi.mock('../../../services/policiesService', () => ({
  getOwnPolicies: vi.fn(() => Promise.resolve([])),
  settlementShapeFromPolicies: vi.fn((policies) => {
    // Minimal stub: return one row per unique periodKey in settled policies
    const map = {};
    for (const p of policies) {
      if (p.status !== 'settled') continue;
      const key = p.periodKey ?? '2026-05';
      map[key] = { periodKey: key, settledAPI: p.settledAPI ?? 0, settledApps: 1, persistency: 0 };
    }
    return Object.values(map);
  }),
}));

// ── Mock awardsEngine ────────────────────────────────────────────────────────
vi.mock('../../../utils/awardsEngine', () => ({
  computeAgentAwards: vi.fn(() => ({})),
  computeRatioTrends: vi.fn(() => ({
    ciToSaleRatio:  { trailing4w: 0, trailing12w: 0, trend: 'flat' },
    dialsToCIRatio: { trailing4w: 0, trailing12w: 0, trend: 'flat' },
    avgPolicySize:  { trailing4w: 0, trailing12w: 0, trend: 'flat' },
    ffiToDialRatio: { trailing4w: 0, trailing12w: 0, trend: 'flat' },
  })),
  computeAtRiskStatus: vi.fn(() => 'on_track'),
  computeAwardPace: vi.fn(() => null),
  getPeriodCtx: vi.fn(() => ({ weeksElapsed: 1, periodWeeks: 4 })),
  nextTierDistance: vi.fn(() => null),
  isPersistencyOnlyBlock: vi.fn(() => false),
}));

// ── Mock formatters ──────────────────────────────────────────────────────────
vi.mock('../../../utils/formatters', () => ({
  formatCurrency: vi.fn((v) => `$${v}`),
}));

// ── Mock the 3.4 feature-flag hook (default OFF) ─────────────────────────────
const mockUseFeatureFlag = vi.fn(() => false);
vi.mock('../../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (...a) => mockUseFeatureFlag(...a),
}));

import AgentAwardsPanel from '../AgentAwardsPanel';
import { getOwnPolicies, settlementShapeFromPolicies } from '../../../services/policiesService';
import { computeAgentAwards } from '../../../utils/awardsEngine';

// ── Default props ────────────────────────────────────────────────────────────
const BASE_PROFILE = { uid: 'J0j4uBqzTPcfm1IlGCPyDzo27RP2', displayName: 'Test Agent', usesPolicyLedger: false };
const SETTLEMENTS = [
  { periodKey: '2026-05', settledAPI: 10000, settledApps: 2, persistency: 85 },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Default computeAgentAwards to return an empty awards object
  computeAgentAwards.mockReturnValue({});
  getOwnPolicies.mockResolvedValue([]);
  mockUseFeatureFlag.mockReturnValue(false);
});

describe('AgentAwardsPanel — 3.4 awards provenance flag', () => {
  const SUBS = [{ weekStarting: '2026-05-04', agentId: BASE_PROFILE.uid }];

  it('flag OFF — no ledger-source chip (byte-identical panel)', () => {
    mockUseFeatureFlag.mockReturnValue(false);
    render(<AgentAwardsPanel submissions={SUBS} confirmedSettlements={SETTLEMENTS} agentProfile={BASE_PROFILE} />);
    expect(screen.queryByTestId('agent-awards-source-chip')).not.toBeInTheDocument();
  });

  it('flag ON — renders the honest ledger-source chip (settlements source)', () => {
    mockUseFeatureFlag.mockImplementation((k) => k === 'awardsProvenance');
    render(<AgentAwardsPanel submissions={SUBS} confirmedSettlements={SETTLEMENTS} agentProfile={BASE_PROFILE} />);
    const chip = screen.getByTestId('agent-awards-source-chip');
    expect(chip.textContent).toMatch(/FROM CONFIRMED SETTLEMENTS/);
  });
});

describe('AgentAwardsPanel — usesPolicyLedger flag', () => {
  describe('usesPolicyLedger = false (settlements path)', () => {
    it('does NOT call getOwnPolicies when flag is false', () => {
      render(
        <AgentAwardsPanel
          submissions={[]}
          confirmedSettlements={SETTLEMENTS}
          agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: false }}
        />
      );
      expect(getOwnPolicies).not.toHaveBeenCalled();
    });

    it('passes confirmedSettlements directly to computeAgentAwards', () => {
      render(
        <AgentAwardsPanel
          submissions={[]}
          confirmedSettlements={SETTLEMENTS}
          agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: false }}
        />
      );
      // computeAgentAwards receives activeConfirmedData = confirmedSettlements
      // The 6th argument is C4's Rule 10 `activeCampaigns`. It defaults to []
      // so every caller that does not pass campaigns is unaffected, and this
      // assertion pins that default rather than dropping the arity check.
      expect(computeAgentAwards).toHaveBeenCalledWith(
        SETTLEMENTS,
        [],
        expect.objectContaining({ uid: BASE_PROFILE.uid }),
        expect.any(Date),
        undefined,
        []
      );
    });

    it('uses empty array when confirmedSettlements is undefined', () => {
      render(
        <AgentAwardsPanel
          submissions={[]}
          confirmedSettlements={undefined}
          agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: false }}
        />
      );
      expect(computeAgentAwards).toHaveBeenCalledWith(
        [],
        [],
        expect.any(Object),
        expect.any(Date),
        undefined,
        []
      );
    });
  });

  describe('usesPolicyLedger = true (policy ledger path)', () => {
    it('calls getOwnPolicies with tenantId and agentUid when flag is true', async () => {
      render(
        <AgentAwardsPanel
          submissions={[]}
          confirmedSettlements={[]}
          agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: true }}
        />
      );
      await waitFor(() => expect(getOwnPolicies).toHaveBeenCalledTimes(1));
      expect(getOwnPolicies).toHaveBeenCalledWith('tatillife_south', BASE_PROFILE.uid);
    });

    it('calls settlementShapeFromPolicies with the fetched policies', async () => {
      const policies = [
        { status: 'settled', periodKey: '2026-05', settledAPI: 8000 },
      ];
      getOwnPolicies.mockResolvedValue(policies);

      render(
        <AgentAwardsPanel
          submissions={[]}
          confirmedSettlements={[]}
          agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: true }}
        />
      );
      await waitFor(() => expect(settlementShapeFromPolicies).toHaveBeenCalledWith(policies));
    });

    it('merges persistency from confirmedSettlements into the ledger shape', async () => {
      const policies = [
        { status: 'settled', periodKey: '2026-05', settledAPI: 8000 },
      ];
      const settlementsWithPersistency = [
        { periodKey: '2026-05', settledAPI: 9000, settledApps: 3, persistency: 90 },
      ];
      getOwnPolicies.mockResolvedValue(policies);

      render(
        <AgentAwardsPanel
          submissions={[]}
          confirmedSettlements={settlementsWithPersistency}
          agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: true }}
        />
      );

      await waitFor(() => {
        // computeAgentAwards should receive a merged row with persistency from confirmedSettlements
        const callArgs = computeAgentAwards.mock.calls.find((call) => {
          const [data] = call;
          return Array.isArray(data) && data.some((r) => r.periodKey === '2026-05' && r.persistency === 90);
        });
        expect(callArgs).toBeDefined();
      });
    });

    it('does not call settlementShapeFromPolicies on the false (settlements) path', () => {
      render(
        <AgentAwardsPanel
          submissions={[]}
          confirmedSettlements={SETTLEMENTS}
          agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: false }}
        />
      );
      expect(settlementShapeFromPolicies).not.toHaveBeenCalled();
    });
  });
});

describe('AgentAwardsPanel — §1 states contract (error / retry)', () => {
  it('renders a persistent inline error card with Retry when the awards computation throws', () => {
    computeAgentAwards.mockImplementation(() => { throw new Error('boom-compute'); });

    render(
      <AgentAwardsPanel
        submissions={SETTLEMENTS}
        confirmedSettlements={SETTLEMENTS}
        agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: false }}
      />
    );

    const card = document.querySelector('[data-testid="agent-awards-error"]');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('role', 'alert');
    expect(card.querySelector('button')).toHaveTextContent(/retry/i);
  });

  it('Retry re-invokes the policy ledger fetch (the panel\'s owned network call)', async () => {
    computeAgentAwards.mockImplementation(() => { throw new Error('boom-compute'); });
    getOwnPolicies.mockRejectedValueOnce(new Error('boom-ledger')).mockResolvedValueOnce([]);

    render(
      <AgentAwardsPanel
        submissions={SETTLEMENTS}
        confirmedSettlements={SETTLEMENTS}
        agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: true }}
      />
    );

    await waitFor(() => expect(getOwnPolicies).toHaveBeenCalledTimes(1));
    // The call-count check above can pass on waitFor's very first (synchronous)
    // poll, since getOwnPolicies is invoked inside the mount effect before this
    // line runs — it does NOT guarantee the promise's .catch → setLedgerError →
    // re-render chain has committed yet. A bare document.querySelector right
    // after is a real race (fails intermittently under CI's slower scheduling);
    // findByTestId polls until the error card actually renders.
    const card = await screen.findByTestId('agent-awards-error');
    expect(card).toBeInTheDocument();

    card.querySelector('button').click();

    await waitFor(() => expect(getOwnPolicies).toHaveBeenCalledTimes(2));
  });

  it('a failed policy-ledger read alone (computation still succeeds) shows a partial-failure banner, not a blocking error', async () => {
    computeAgentAwards.mockReturnValue({});
    getOwnPolicies.mockRejectedValue(new Error('boom-ledger'));

    render(
      <AgentAwardsPanel
        submissions={SETTLEMENTS}
        confirmedSettlements={SETTLEMENTS}
        agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: true }}
      />
    );

    // Two renders sit on this test's critical path: the initial ledgerLoading
    // gate, then the effect-driven re-render once getOwnPolicies rejects and
    // setLedgerError/setLedgerPolicies commit. Under CI's documented full-suite
    // parallel resource contention (see the asyncUtilTimeout comment in
    // src/test-setup.js) that chain has been observed to occasionally exceed
    // the shared 5000ms budget even though it resolves in well under 50ms
    // locally — this test gets its own wider timeout rather than raising the
    // global default for every other test in the suite.
    await waitFor(() => expect(getOwnPolicies).toHaveBeenCalledTimes(1));

    const banner = await screen.findByTestId('agent-awards-ledger-partial');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('role', 'alert');
    // Not the blocking full-failure card.
    expect(document.querySelector('[data-testid="agent-awards-error"]')).not.toBeInTheDocument();
  }, 10000);
});

describe('AgentAwardsPanel — §1 top-level empty (no submissions)', () => {
  it('renders an honest descriptive empty with no CTA when there are no submissions at all', () => {
    render(
      <AgentAwardsPanel
        submissions={[]}
        confirmedSettlements={[]}
        agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: false }}
      />
    );

    const empty = screen.getByTestId('agent-awards-top-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent(/start submitting weekly reports/i);
    // No fabricated CTA — this state has no real navigation target from this panel.
    expect(empty.querySelector('button')).toBeNull();
  });
});

describe('AgentAwardsPanel — §1 loading skeleton (policy-ledger fetch)', () => {
  it('renders PanelSkeleton instead of the (artificially empty) award groups while the policy ledger is loading', async () => {
    let resolveLedger;
    getOwnPolicies.mockReturnValue(new Promise((resolve) => { resolveLedger = resolve; }));

    render(
      <AgentAwardsPanel
        submissions={[{ id: 'sub-1', weekStarting: '2026-05-04', agentId: BASE_PROFILE.uid }]}
        confirmedSettlements={SETTLEMENTS}
        agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: true }}
      />
    );

    const loading = screen.getByTestId('agent-awards-loading');
    expect(loading).toBeInTheDocument();
    expect(loading.querySelectorAll('[role="status"]').length).toBeGreaterThan(0);
    // The category-tab/award-group chrome (only rendered once past the loading
    // gate) must not be showing yet.
    expect(screen.queryByText(/awards tracked/i)).not.toBeInTheDocument();

    resolveLedger([]);
    await waitFor(() => expect(screen.queryByTestId('agent-awards-loading')).not.toBeInTheDocument());
    expect(await screen.findByText(/awards tracked/i)).toBeInTheDocument();
  });
});

describe('AgentAwardsPanel — 0.1b actionable empty (category filter)', () => {
  it('switching to a category with no awards shows a "View all categories" CTA that resets the filter', async () => {
    computeAgentAwards.mockReturnValue({});

    render(
      <AgentAwardsPanel
        submissions={[{ id: 'sub-1' }]}
        confirmedSettlements={SETTLEMENTS}
        agentProfile={{ ...BASE_PROFILE, usesPolicyLedger: false }}
      />
    );

    // "All" is empty too (mocked computeAgentAwards returns no awards) but has no reset CTA.
    expect(await screen.findByTestId('agent-awards-empty-category')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view all categories/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^monthly$/i }));

    expect(await screen.findByTestId('agent-awards-empty-category')).toHaveTextContent(/monthly/i);
    const resetButton = screen.getByRole('button', { name: /view all categories/i });
    fireEvent.click(resetButton);

    // Back on "All" — reset CTA disappears again.
    await waitFor(() => expect(screen.queryByRole('button', { name: /view all categories/i })).toBeNull());
  });
});
