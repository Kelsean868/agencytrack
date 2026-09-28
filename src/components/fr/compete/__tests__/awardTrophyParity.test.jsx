// @vitest-environment jsdom
/**
 * FR-5b parity (brief § 6.2): the same fixture through the Awards tab
 * (AgentAwardsPanel, real engine) and through the Trophy room model
 * (awardInputs → agentAwardsView → awardTrophies). Each shared award must
 * agree on `eligible` and on its first criterion's current figure.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatCurrency } from '../../../../utils/formatters';
import { DEFAULT_RULESET_2026 } from '../../../../config/awardsRuleset/2026';
import { awardInputs, agentAwardsView } from '../../../../lib/awards/agentAwardModel';
import { awardTrophies } from '../../../../lib/fr/competeModel';

vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => ({ tenantId: 't1' }) }));
vi.mock('../../../../hooks/useFeatureFlag', () => ({ useFeatureFlag: () => false }));
const hoisted = vi.hoisted(() => ({ ledger: [] }));
vi.mock('../../../../services/policiesService', () => ({ getOwnPolicies: vi.fn(() => Promise.resolve(hoisted.ledger)) }));

import AgentAwardsPanel from '../../../awards/AgentAwardsPanel';

const NOW = new Date('2026-09-15T16:00:00Z');
const pol = (n, dateIssued, api) => ({ id: n, status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', dateIssued, proposedAPI: api });
const SUBS = ['2026-05-03', '2026-06-07', '2026-07-05', '2026-08-02', '2026-09-06'].map((weekStarting, i) => ({
  status: 'submitted', weekStarting, version: 2, apiSold: 5000 + i * 1000, applicationsSold: 2, ciConducted: 2, referralCalls: 20,
}));
const SETTLE = ['2026-07', '2026-08', '2026-09'].map((periodKey) => ({ periodKey, persistency: 92 }));

const CASES = [
  { name: 'ledger + persistency, tenured', ledger: [pol('A', '2026-07-08', 60000), pol('B', '2026-08-11', 45000), pol('C', '2026-09-02', 30000)], profile: { uid: 'agent-1', monthsInIndustry: 60, monthsAtTatil: 60 } },
  { name: 'settlements only, rookie', ledger: [], settlements: [{ periodKey: '2026-09', settledAPI: 52000, settledApps: 3, persistency: 93 }], profile: { uid: 'agent-1', monthsInIndustry: 6, monthsAtTatil: 6 } },
];

describe('Awards tab ↔ Trophy room parity', () => {
  it.each(CASES)('$name: every award trophy agrees with its Awards-tab card (eligible + first criterion current)', async (c) => {
    hoisted.ledger = c.ledger;
    const settlements = c.settlements ?? SETTLE;
    render(<AgentAwardsPanel submissions={SUBS} confirmedSettlements={settlements} agentProfile={c.profile} currentDate={NOW} ruleset={DEFAULT_RULESET_2026} activeCampaigns={[]} />);
    await screen.findByText(/awards tracked/);

    const { rows } = awardInputs({ ledgerPolicies: c.ledger, confirmedSettlements: settlements, usesPolicyLedger: false });
    const trophies = awardTrophies(agentAwardsView({ rows, submissions: SUBS, agentProfile: c.profile, now: NOW, ruleset: DEFAULT_RULESET_2026, activeCampaigns: [] }), NOW);
    expect(trophies.length).toBeGreaterThanOrEqual(8);

    for (const t of trophies) {
      const card = screen.getByTestId(`award-card-${t.key}`);
      expect(card.getAttribute('data-state') === 'qualified', `${t.key} eligible`).toBe(t.earned);
      const fmt = (v) => (t.unit === 'TTD' ? formatCurrency(v) : String(Math.round(v)));
      expect(card.textContent, `${t.key} first criterion`).toContain(`${fmt(t.current)} of ${fmt(t.target)}`);
    }
  });
});
