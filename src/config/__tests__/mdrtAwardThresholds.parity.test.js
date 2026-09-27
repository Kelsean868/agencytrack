// mdrtAwardThresholds.parity.test.js — proves the Awards tab, Home hero, and
// the Policy Ledger's award lens all measure MDRT against the SAME line
// (MDRT_THRESHOLDS_2026.mdrt = 688,800), including when a stored ruleset
// still carries the old mdrtAward.apiThreshold: 500,000 / apiInContention:
// 250,000 (PR #984 — closes FOLLOW_UPS "Awards-tab MDRT award line differs
// from the MDRT threshold").

import { describe, it, expect } from 'vitest';
import { MDRT_THRESHOLDS_2026, mdrtAwardThresholds } from '../mdrtThresholds/2026';
import { DEFAULT_RULESET_2026 } from '../awardsRuleset/2026';
import { computeAgentAwards, awardLensPeriods, mdrtLineFor } from '../../utils/awardsEngine';
import { heroGoal } from '../../components/dashboard/HomeV2/homeDerivations';

const STALE_RULESET = {
  ...DEFAULT_RULESET_2026,
  mdrtAward: { apiThreshold: 500000, apiInContention: 250000, prize: 'MDRT Membership + Recognition' },
};

describe('MDRT award threshold parity — Awards tab / Home / Ledger', () => {
  it('mdrtAwardThresholds() always resolves to the real MDRT line, regardless of the ruleset passed', () => {
    expect(mdrtAwardThresholds(DEFAULT_RULESET_2026).apiThreshold).toBe(MDRT_THRESHOLDS_2026.mdrt);
    expect(mdrtAwardThresholds(STALE_RULESET).apiThreshold).toBe(MDRT_THRESHOLDS_2026.mdrt);
    expect(mdrtAwardThresholds(STALE_RULESET).apiThreshold).not.toBe(500000);
  });

  it('Awards tab (computeAgentAwards) targets 688,800 even when the stored ruleset still says 500,000', () => {
    const GOLDEN_DATE = new Date('2026-06-15');
    const confirmed = [{ periodKey: '2026-06', settledAPI: 688800, settledApps: 60, persistency: 93 }];

    const fromDefault = computeAgentAwards(confirmed, [], {}, GOLDEN_DATE, DEFAULT_RULESET_2026);
    const fromStale = computeAgentAwards(confirmed, [], {}, GOLDEN_DATE, STALE_RULESET);

    expect(fromDefault.mdrt.criteria[0].target).toBe(MDRT_THRESHOLDS_2026.mdrt);
    expect(fromStale.mdrt.criteria[0].target).toBe(MDRT_THRESHOLDS_2026.mdrt);
    expect(fromDefault.mdrt.eligible).toBe(true);
    expect(fromStale.mdrt.eligible).toBe(true);
  });

  it('Home hero (heroGoal) MDRT fallback target equals the same line', () => {
    expect(heroGoal(0).goal).toBe(MDRT_THRESHOLDS_2026.mdrt);
    expect(heroGoal(null).isMdrt).toBe(true);
  });

  it('Ledger award lens (mdrtLineFor / awardLensPeriods) targets the same line', () => {
    expect(mdrtLineFor(2026)).toBe(MDRT_THRESHOLDS_2026.mdrt);

    // awardLensPeriods' MDRT descriptor reads mdrtLineFor(year) directly — it
    // never reads ruleset.mdrtAward at all, so it already agreed before this
    // PR. Asserted here anyway so the parity claim covers all three surfaces.
    const { current } = awardLensPeriods({ today: '2026-09-26', ruleset: STALE_RULESET });
    const mdrtEntry = current.find((entry) => entry.kind === 'mdrt');
    expect(mdrtEntry).toBeDefined();
    expect(mdrtEntry.target).toBe(MDRT_THRESHOLDS_2026.mdrt);
  });
});
