import { describe, it, expect, vi } from 'vitest';
import { awardInputs, agentAwardsView } from '../agentAwardModel';
import { DEFAULT_RULESET_2026 } from '../../../config/awardsRuleset/2026';

const NOW = new Date('2026-09-15T16:00:00Z');
const SETTLEMENTS = [
  { periodKey: '2026-07', settledAPI: 60000, settledApps: 4, persistency: 92 },
  { periodKey: '2026-08', settledAPI: 45000, settledApps: 3, persistency: 0 },
];
const pol = (n, dateIssued, api) => ({ id: n, status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', dateIssued, proposedAPI: api });

describe('awardInputs (H2 item 2 source choice)', () => {
  it('not flagged, ledger still loading (null) or empty: confirmed settlements', () => {
    expect(awardInputs({ ledgerPolicies: null, confirmedSettlements: SETTLEMENTS, usesPolicyLedger: false }))
      .toEqual({ readsLedger: false, rows: SETTLEMENTS });
    expect(awardInputs({ ledgerPolicies: [], confirmedSettlements: SETTLEMENTS, usesPolicyLedger: false }))
      .toEqual({ readsLedger: false, rows: SETTLEMENTS });
    expect(awardInputs({ ledgerPolicies: [], confirmedSettlements: undefined, usesPolicyLedger: false }).rows).toEqual([]);
  });

  it('not flagged, has ledger policies: ledger rows by issue month, persistency merged by periodKey', () => {
    const { readsLedger, rows } = awardInputs({
      ledgerPolicies: [pol('A', '2026-07-08', 36000), pol('B', '2026-08-11', 27500), pol('C', '2026-09-02', 52000)],
      confirmedSettlements: SETTLEMENTS,
      usesPolicyLedger: false,
    });
    expect(readsLedger).toBe(true);
    expect(rows.map((r) => [r.periodKey, r.settledAPI, r.persistency])).toEqual([
      ['2026-07', 36000, 92], // merged
      ['2026-08', 27500, 0],  // a 0 persistency is not merged (as before)
      ['2026-09', 52000, 0],  // no settlement row for the month
    ]);
  });

  it('flagged with an empty ledger: the ledger (empty) is still the source', () => {
    expect(awardInputs({ ledgerPolicies: [], confirmedSettlements: SETTLEMENTS, usesPolicyLedger: true }))
      .toEqual({ readsLedger: true, rows: [] });
    expect(awardInputs({ ledgerPolicies: null, confirmedSettlements: SETTLEMENTS, usesPolicyLedger: true }))
      .toEqual({ readsLedger: true, rows: [] });
  });
});

describe('agentAwardsView', () => {
  it('returns every engine award with pace status, persistency block, club gap and pace; plus ratio trends', () => {
    const { awards, ratioTrends, error } = agentAwardsView({
      rows: SETTLEMENTS, submissions: [], agentProfile: { monthsInIndustry: 60, monthsAtTatil: 60 },
      now: NOW, ruleset: DEFAULT_RULESET_2026, activeCampaigns: [],
    });
    expect(error).toBeNull();
    expect(ratioTrends).toBeTruthy();
    for (const id of ['advisor_month_api', 'quarterly_api', 'persistency_silver', 'centurion', 'agent_of_year', 'mdrt']) {
      expect(awards[id]).toBeTruthy();
      expect(awards[id]).toHaveProperty('paceStatus');
      expect(awards[id]).toHaveProperty('persistencyBlock');
      expect(awards[id]).toHaveProperty('pace');
    }
    const club = Object.values(awards).find((a) => a.category === 'club' && !a.eligible);
    expect(club.tierGap).not.toBeUndefined();
    expect(awards.advisor_month_api.tierGap).toBeNull();
  });

  it('an engine failure returns the error view and logs it (no throw)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = agentAwardsView({ rows: [], submissions: [], agentProfile: {}, now: NOW, ruleset: null, activeCampaigns: [] });
    expect(out).toEqual({ awards: {}, ratioTrends: null, error: 'Failed to compute awards.' });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
