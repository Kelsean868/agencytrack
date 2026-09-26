import { describe, it, expect } from 'vitest';
import {
  awardLensForPolicy, deriveAwardLens, awardWindowsForPolicy, notOnHeadOfficeList,
  awardRowsFromLedger, FAMILY_LENS_REASON,
} from '../ledgerProduction';
import { derivePolicyLens } from '../policyCampaignLens';
import { awardLensPeriods } from '../../utils/awardsEngine';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';
import { TODAY, EXPORT_DATE, CHRISTMAS, POLICIES } from './fixtures/awardLensFixtures';

// ─── L1 · the award lens engine (docs/briefs/ledger-lens-build.md § L1) ──────
//
// One rules engine: every row here comes from ledgerProduction's settled test,
// productionCredit, the family rule and the L0 pending rule — or, for a
// campaign, from policyContribution. These fixtures pin each award type.

const periods = awardLensPeriods({ today: TODAY, campaigns: [CHRISTMAS] });
const byKey = (key) => [...periods.current, ...periods.past].find((a) => a.key === key);
const ids = (rows) => rows.map((r) => r.policy.id).sort();

describe('awardLensPeriods — the selector, from the ruleset and the period maths', () => {
  it('orders current: ★ campaign first, then this month, this quarter, annual, MDRT', () => {
    expect(periods.current.map((a) => a.key)).toEqual([
      'campaign:xmas26', 'month:2026-09', 'quarter:2026-Q3', 'annual:2026', 'mdrt:2026',
    ]);
    expect(periods.current.map((a) => a.label)).toEqual([
      '★ Christmas', 'Sep 2026', 'Q3 2026', '2026 awards', 'MDRT 2026',
    ]);
  });

  it('past holds only closed months/quarters of this year and last, newest first', () => {
    expect(periods.past.every((a) => a.closed)).toBe(true);
    expect(periods.past.slice(0, 3).map((a) => a.key)).toEqual(['month:2026-08', 'month:2026-07', 'month:2026-06']);
    expect(periods.past.some((a) => a.key === 'quarter:2026-Q2')).toBe(true);
    expect(periods.past.some((a) => a.key === 'quarter:2026-Q3')).toBe(false); // still open
    expect(periods.past.some((a) => a.key === 'month:2025-01')).toBe(true);
    expect(periods.past.some((a) => a.key === 'quarter:2025-Q4')).toBe(true);
    expect(periods.past.some((a) => a.key.startsWith('month:2024'))).toBe(false);
  });

  it('MDRT target comes from the ruleset, not a constant', () => {
    expect(byKey('mdrt:2026').target).toBe(DEFAULT_RULESET_2026.mdrtAward.apiThreshold);
    const custom = awardLensPeriods({ today: TODAY, ruleset: { ...DEFAULT_RULESET_2026, mdrtAward: { apiThreshold: 688_800 } } });
    expect(custom.current.find((a) => a.kind === 'mdrt').target).toBe(688_800);
  });

  it('flags the Rule 10 suppressor on months/quarters the campaign covers, not on others', () => {
    expect(byKey('month:2026-09').suppressor?.id).toBe('xmas26');
    expect(byKey('quarter:2026-Q3').suppressor?.id).toBe('xmas26');
    expect(byKey('quarter:2026-Q2').suppressor).toBeNull();
  });

  it('drops Advisor of the Month for a BDO/DSO advisor, as computeAgentAwards does', () => {
    const bdo = awardLensPeriods({ today: TODAY, agentProfile: { isBdoDso: true } });
    expect(bdo.current.some((a) => a.kind === 'month')).toBe(false);
    expect(bdo.past.some((a) => a.kind === 'month')).toBe(false);
  });

  it('rejects a malformed today (never guesses a date)', () => {
    expect(() => awardLensPeriods({ today: '26-09-2026' })).toThrow(/YYYY-MM-DD/);
  });
});

describe('deriveAwardLens — campaign window (settlement window, Rule 7 credit)', () => {
  const lens = deriveAwardLens(POLICIES, byKey('campaign:xmas26'));

  it('groups counting / pending / not by the campaign engine', () => {
    expect(ids(lens.groups.counting)).toEqual(['A', 'B', 'C']);
    expect(ids(lens.groups.pending)).toEqual(['D']);
    expect(ids(lens.groups.not)).toEqual(['F', 'G', 'H', 'I', 'M']);
  });

  it('totals equal derivePolicyLens — the figure Home and the Campaign screen show', () => {
    const campaign = derivePolicyLens(POLICIES, CHRISTMAS, {});
    expect(lens.settled.api).toBeCloseTo(campaign.api.current, 2);
    expect(lens.settled.apps).toBe(campaign.apps.current);
    expect(lens.pending.api).toBe(campaign.pending.api);
    expect(lens.settled.api).toBe(73_946);
    expect(lens.pending).toEqual({ api: 36_000, apps: 1, count: 1 });
  });

  it('gives the family reason and names an NTU for what it is', () => {
    const reason = (id) => lens.rows.find((r) => r.policy.id === id).reason;
    expect(reason('G')).toBe(FAMILY_LENS_REASON);
    expect(reason('F')).toBe('NTU — replaced by ···2403');
    expect(reason('H')).toBe('Issued before the campaign');
  });

  it('targets the next tier by default and the chosen tier when given', () => {
    expect(lens.target.tier.name).toBe('Champion');
    expect(lens.target.api).toBe(275_000);
    const vip = deriveAwardLens(POLICIES, byKey('campaign:xmas26'), { targetTierName: 'VIP' });
    expect(vip.target.tier.name).toBe('VIP');
    expect(vip.target.api).toBe(375_000);
    expect(vip.settled).toEqual(lens.settled); // the choice moves the target, never the credit
  });

  it('an unknown saved tier falls back to the level in reach, never to a guess', () => {
    const stale = deriveAwardLens(POLICIES, byKey('campaign:xmas26'), { targetTierName: 'Renamed' });
    expect(stale.target.tier.name).toBe('Champion');
  });
});

describe('deriveAwardLens — month (R5 issue date, family excluded)', () => {
  const lens = deriveAwardLens(POLICIES, byKey('month:2026-09'));

  it('counts only what was issued in September', () => {
    expect(ids(lens.groups.counting)).toEqual(['B', 'C']);
    expect(lens.settled).toEqual({ api: 49_346, apps: 2, count: 2 });
  });

  it('places a submitted policy as pending, by the L0 rule', () => {
    expect(ids(lens.groups.pending)).toEqual(['D']);
    expect(lens.pending.api).toBe(36_000);
  });

  it('says why an out-of-period policy is not counting', () => {
    expect(lens.rows.find((r) => r.policy.id === 'A').reason).toBe('Issued before September 2026');
    expect(lens.rows.find((r) => r.policy.id === 'M').reason).toMatch(/^Non-Life/);
  });
});

describe('deriveAwardLens — quarter', () => {
  it('Q3 counts Jul–Sep issues, excludes family and NTU', () => {
    const lens = deriveAwardLens(POLICIES, byKey('quarter:2026-Q3'));
    expect(ids(lens.groups.counting)).toEqual(['A', 'B', 'C']);
    expect(lens.settled.api).toBe(73_946);
    expect(ids(lens.groups.pending)).toEqual(['D']);
  });
});

describe('deriveAwardLens — annual awards and MDRT with a family policy', () => {
  const annual = deriveAwardLens(POLICIES, byKey('annual:2026'));
  const mdrt = deriveAwardLens(POLICIES, byKey('mdrt:2026'));

  it('annual excludes the family policy; MDRT includes it', () => {
    expect(ids(annual.groups.counting)).toEqual(['A', 'B', 'C', 'I']);
    expect(ids(mdrt.groups.counting)).toEqual(['A', 'B', 'C', 'G', 'I']);
    expect(mdrt.settled.api - annual.settled.api).toBe(13_200);
  });

  it('matches awardRowsFromLedger — the rows the Awards tab reads', () => {
    const rows = awardRowsFromLedger(POLICIES).filter((r) => r.periodKey.startsWith('2026-'));
    const settledAPI = rows.reduce((s, r) => s + r.settledAPI, 0);
    const selfFamilyAPI = rows.reduce((s, r) => s + r.selfFamilyAPI, 0);
    expect(annual.settled.api).toBeCloseTo(settledAPI, 2);
    expect(mdrt.settled.api).toBeCloseTo(settledAPI + selfFamilyAPI, 2);
  });

  it('MDRT carries the ruleset target; annual has none (ranked)', () => {
    expect(mdrt.target.api).toBe(DEFAULT_RULESET_2026.mdrtAward.apiThreshold);
    expect(annual.target.api).toBeNull();
  });
});

describe('deriveAwardLens — closed period', () => {
  it('Aug 2026: final credit, and nothing still pending can count', () => {
    const lens = deriveAwardLens(POLICIES, byKey('month:2026-08'));
    expect(ids(lens.groups.counting)).toEqual(['A']);
    expect(lens.groups.pending).toEqual([]);
    const d = lens.rows.find((r) => r.policy.id === 'D');
    expect(d.group).toBe('not');
    expect(d.reason).toMatch(/Not settled in time/);
  });

  it('Q2 2026 counts the one Q2 issue', () => {
    const lens = deriveAwardLens(POLICIES, byKey('quarter:2026-Q2'));
    expect(ids(lens.groups.counting)).toEqual(['I']);
    expect(lens.settled.api).toBe(9_000);
  });
});

describe('awardLensForPolicy — NTU and other exits', () => {
  const month = byKey('month:2026-09');
  it('NTU never counts, with the replacing policy named', () => {
    const row = awardLensForPolicy(POLICIES.find((p) => p.id === 'F'), month);
    expect(row).toEqual({ group: 'not', credit: { api: 0, apps: 0 }, reason: 'NTU — replaced by ···2403' });
  });
  it('an NTU without a replacement says so plainly', () => {
    const row = awardLensForPolicy({ id: 'x', productLine: 'life', status: 'ntu', dateSubmitted: '2026-09-02' }, month);
    expect(row.reason).toBe('NTU — not taken up');
  });
  it('a written policy has not gone in yet', () => {
    const row = awardLensForPolicy({ id: 'w', productLine: 'life', status: 'written', dateWritten: '2026-09-02' }, month);
    expect(row).toMatchObject({ group: 'not', reason: 'Written — not submitted yet' });
  });
  it('an unclassified new-business type abstains with the engine reason', () => {
    const row = awardLensForPolicy({ id: 'u', productLine: 'life', status: 'settled', dateIssued: '2026-09-02', proposedAPI: 5000 }, month);
    expect(row).toMatchObject({ group: 'not', reason: 'Unclassified new-business type' });
  });
  it('throws without an award descriptor (no silent fallback)', () => {
    expect(() => awardLensForPolicy(POLICIES[0], null)).toThrow();
    expect(() => deriveAwardLens(POLICIES, null)).toThrow();
  });
});

describe('notOnHeadOfficeList — only what the data can prove', () => {
  it('flags a self-confirmed settled policy issued after the latest export', () => {
    expect(notOnHeadOfficeList(POLICIES.find((p) => p.id === 'C'), EXPORT_DATE)).toBe(true);
    const lens = deriveAwardLens(POLICIES, byKey('month:2026-09'));
    expect(lens.rows.filter((r) => r.hoFlag).map((r) => r.policy.id)).toEqual(['C']);
    expect(lens.exportDate).toBe(EXPORT_DATE);
  });
  it('does NOT flag a self-confirmed policy issued before the export (cannot tell)', () => {
    expect(notOnHeadOfficeList({ status: 'settled', statusSource: 'agent', dateIssued: '2026-09-10' }, EXPORT_DATE)).toBe(false);
  });
  it('never flags a head-office status, a pending policy, or a ledger with no import', () => {
    expect(notOnHeadOfficeList(POLICIES.find((p) => p.id === 'B'), EXPORT_DATE)).toBe(false);
    expect(notOnHeadOfficeList(POLICIES.find((p) => p.id === 'D'), EXPORT_DATE)).toBe(false);
    expect(notOnHeadOfficeList(POLICIES.find((p) => p.id === 'C'), null)).toBe(false);
  });
});

describe('awardWindowsForPolicy — L3 chips from the same engine', () => {
  const awards = periods.current;
  it('a family policy counts toward MDRT only', () => {
    expect(awardWindowsForPolicy(POLICIES.find((p) => p.id === 'G'), awards).map((w) => w.key)).toEqual(['mdrt:2026']);
  });
  it('a pending policy "will count" toward every open window it sits in', () => {
    const windows = awardWindowsForPolicy(POLICIES.find((p) => p.id === 'D'), awards);
    expect(windows.map((w) => w.key)).toEqual(['campaign:xmas26', 'month:2026-09', 'quarter:2026-Q3', 'annual:2026', 'mdrt:2026']);
    expect(windows.every((w) => w.group === 'pending')).toBe(true);
  });
});
