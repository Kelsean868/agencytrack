/**
 * persistencyGateVerdicts — ruling R-a (Kyron, 28–29-09-2026) at every PURE
 * verdict site migrated in R2-1: a persistency percent is rounded to 2
 * decimals, half up, and the verdict is judged on that same rounded value.
 *
 * One table per site at the four boundary values the brief names:
 *   89.994 → 89.99% (below) · 89.995 → 90.00% (at) · 89.996 → 90.00% (at) · 90 → 90.00% (at)
 * Floor sites (80%) use the same four values shifted down by ten points.
 *
 * Fixtures are synthetic (placeholder policy numbers, no client data).
 */
import { describe, it, expect } from 'vitest';
import { buildPersistencyOutlook, persistencyTone, formatOutlookPct } from '../persistencyOutlook';
import { computeBarStats } from '../calculations';
import { reinstatementPlan } from '../../fr/moneyModel';
import { campaignPersistencyReading } from '../../campaignPersistencyReading';
import { classifyFlag } from '../../../components/manager/MeetingMode.helpers';
import { deriveAgentReportModel } from '../../../components/profile/agentReportModel';
import { CHRISTMAS } from '../../__tests__/fixtures/awardLensFixtures';
import { assembleAgentTrackerRows } from '../../strategicPlan/assembleModel';

// [percent, printed, at-or-above the 90% gate]
const GATE_TABLE = [
  [89.994, '89.99%', false],
  [89.995, '90.00%', true],
  [89.996, '90.00%', true],
  [90, '90.00%', true],
];
// Same boundary, at the 80% floor: [percent, printed, below the floor]
const FLOOR_TABLE = [
  [79.994, '79.99%', true],
  [79.995, '80.00%', false],
  [79.996, '80.00%', false],
  [80, '80.00%', false],
];

// A two-policy book whose 24-month persistency is exactly `pct` %: one settled
// and one lapsed policy, both issued Jun 2025 (inside every window below), with
// placed = 100,000 and lapses = 100,000 × (1 − pct / 100).
const EXPORT = '2026-09-15';
const TODAY = '2026-09-23';
const GATE = { monthKey: '2026-12', threshold: 90 };
function bookAt(pct) {
  const lapsed = Math.round(100000 * (100 - pct)) / 100; // 89.994 → 10006 exactly
  const doc = (policyNumber, status, api) => ({
    policyNumber, dateIssued: '2025-06-10', status, proposedAPI: api,
    isWritingAgent: true, importSource: 'oipa', exportDate: EXPORT,
  });
  return [doc('T-S1', 'settled', 100000 - lapsed), doc('T-L1', 'lapsed', lapsed)];
}

describe('fixture sanity — the book really sits at each boundary value', () => {
  it.each(GATE_TABLE)('%f', (pct, printed) => {
    const o = buildPersistencyOutlook({ policies: bookAt(pct), records: [], today: TODAY, gate: GATE });
    expect(o.gateMonth).not.toBeNull();
    expect(o.gateMonth.persistency * 100).toBeCloseTo(pct, 9);
    expect(formatOutlookPct(o.gateMonth.persistency)).toBe(printed);
  });
});

describe('persistencyOutlook gateMonth.meetsThreshold — judged on the printed 2-dp value', () => {
  it.each(GATE_TABLE)('%f → %s → meets %s', (pct, printed, meets) => {
    const { gateMonth } = buildPersistencyOutlook({ policies: bookAt(pct), records: [], today: TODAY, gate: GATE });
    expect(formatOutlookPct(gateMonth.persistency)).toBe(printed);
    expect(gateMonth.meetsThreshold).toBe(meets);
  });
});

describe('persistencyTone — the Persistency screen tone', () => {
  it.each(GATE_TABLE)('%f → %s → success %s', (pct, _printed, meets) => {
    expect(persistencyTone(pct / 100, { threshold: 90 })).toBe(meets ? 'success' : 'warning');
  });
});

describe('reinstatementPlan (FR Money / Work win-back) — currentPct and meets agree', () => {
  it.each(GATE_TABLE)('%f → %s → meets %s', (pct, printed, meets) => {
    const plan = reinstatementPlan({ policies: bookAt(pct), records: [], todayTT: TODAY, gate: GATE });
    expect(`${plan.currentPct.toFixed(2)}%`).toBe(printed);
    expect(plan.meets).toBe(meets);
    if (meets) expect(plan.need).toBe(0);
  });
});

describe('campaignPersistencyReading (preview path) — label and below-gate flag agree', () => {
  it.each(GATE_TABLE)('%f → %s → below %s', (pct, printed, meets) => {
    const r = campaignPersistencyReading({ campaign: CHRISTMAS, policies: bookAt(pct), records: [], today: TODAY });
    expect(r.label).toBe(printed);
    expect(r.below).toBe(!meets);
  });
});

describe('computeBarStats (manager reality bar) — award-eligible and below-floor tallies', () => {
  it.each(GATE_TABLE)('gate %f → counted award-eligible %s', (pct, _printed, meets) => {
    expect(computeBarStats([{ persistency: pct / 100 }]).awardEligible).toBe(meets ? 1 : 0);
  });
  it.each(FLOOR_TABLE)('floor %f → counted below floor %s', (pct, _printed, below) => {
    expect(computeBarStats([{ persistency: pct / 100 }]).belowFloor).toBe(below ? 1 : 0);
  });
});

describe('classifyFlag (Meeting Mode) — the persistency flag and its printed reason agree', () => {
  const okTiles = [];
  it.each(FLOOR_TABLE)('%f → %s → flagged %s', (pct, printed, below) => {
    const flag = classifyFlag({ submitted: true, tiles: okTiles, persistency: pct });
    expect(flag.key).toBe(below ? 'persistency' : null);
    if (below) expect(flag.reason).toContain(printed);
  });
});

describe('agent report model — the value the report prints and colours (PDF ≥ 90 / < 80)', () => {
  const at = (pct) => deriveAgentReportModel({
    submissions: [], settlements: [], goals: {}, agentProfile: {}, period: 'ytd',
    now: new Date('2026-06-15T12:00:00Z'),
    persistency: [{ year: 2026, month: 5, persistency: pct / 100 }],
  }).persistencyPct;
  it.each(GATE_TABLE)('%f → %s → at the gate %s', (pct, printed, meets) => {
    expect(`${at(pct).toFixed(2)}%`).toBe(printed);
    expect(at(pct) >= 90).toBe(meets);
  });
});

// Strategic Plan tracker: the model hands the table a 2-dp value; the table
// prints it and tones it warning below the plan's own 85% line.
describe('strategic plan tracker row — persistencyPct is the printed 2-dp value', () => {
  const at = (pct) => assembleAgentTrackerRows({
    roster: [{ id: 'u1', role: 'agent', name: 'Test Agent' }], ytdSubmissions: [], settledByAgent: {},
    persistencyByAgent: { u1: [{ monthKey: '2026-05', persistency: pct / 100 }] }, goalsByAgent: {}, year: 2026,
  })[0].persistencyPct;
  it.each([
    [84.994, 84.99, true],
    [84.995, 85, false],
    [84.996, 85, false],
    [85, 85, false],
  ])('%f → %f → warning %s', (pct, shown, warn) => {
    expect(at(pct)).toBe(shown);
    expect(at(pct) < 85).toBe(warn);
  });
});
