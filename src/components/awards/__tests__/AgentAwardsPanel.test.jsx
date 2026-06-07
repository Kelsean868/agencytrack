// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

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
  getPeriodCtx: vi.fn(() => ({ weeksElapsed: 1, periodWeeks: 4 })),
  nextTierDistance: vi.fn(() => null),
  isPersistencyOnlyBlock: vi.fn(() => false),
}));

// ── Mock formatters ──────────────────────────────────────────────────────────
vi.mock('../../../utils/formatters', () => ({
  formatCurrency: vi.fn((v) => `$${v}`),
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
      expect(computeAgentAwards).toHaveBeenCalledWith(
        SETTLEMENTS,
        [],
        expect.objectContaining({ uid: BASE_PROFILE.uid }),
        expect.any(Date),
        undefined
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
        undefined
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
