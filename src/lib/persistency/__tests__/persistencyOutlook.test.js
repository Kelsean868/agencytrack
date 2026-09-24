import { describe, it, expect } from 'vitest';
import {
  buildPersistencyOutlook,
  toLedgerDoc,
  persistencyTone,
  formatOutlookPct,
  outlookGateFor,
  isTwentyFourMonthFigure,
  PERSISTENCY_OUTLOOK_STALE_DAYS,
  HO_CONFIRMED_SOURCE,
} from '../persistencyOutlook';

// ── Kyron-shaped fixture ─────────────────────────────────────────────────────
// Synthetic, no client data. Three issue-month buckets whose totals reproduce the
// read-only probe of Kyron's live book (export 15 Sep 2026, rule `ignore`, manual
// inputs 0) to the cent:
//   Sep 2024 bucket  → rolls off between the Aug and Sep report windows
//   Nov 2024 bucket  → rolls off between the Sep and Dec report windows
//   Jun 2025 bucket  → in every window
const EXPORT = '2026-09-15';
const imported = (policyNumber, dateIssued, status, api, extra = {}) => ({
  policyNumber, dateIssued, status, proposedAPI: api,
  isWritingAgent: true, importSource: 'oipa', exportDate: EXPORT, ...extra,
});
const KYRON_SHAPE = [
  imported('P-A1', '2024-09-10', 'settled', 82800.00),
  imported('P-A2', '2024-09-12', 'lapsed', 2682.00),
  imported('P-B1', '2024-11-10', 'settled', 21197.16),
  imported('P-B2', '2024-11-12', 'lapsed', 1182.36),
  imported('P-C1', '2025-06-10', 'settled', 161581.20),
  imported('P-C2', '2025-06-12', 'lapsed', 27014.52),
  // Excluded shapes that must not move any figure.
  imported('P-X1', '2025-03-01', 'settled', 50000, { isWritingAgent: false }),
  imported('P-X2', '2025-04-01', 'denied', 9000),
];
const GATE = { monthKey: '2026-12', threshold: 90 };
const TODAY = '2026-09-23';

const outlookFor = (policies, extra = {}) => buildPersistencyOutlook({
  policies, records: [], today: TODAY, gate: GATE, ...extra,
});

describe('persistencyOutlook — Kyron shape reproduces the probe table', () => {
  const o = outlookFor(KYRON_SHAPE);

  it('derived = August, head-office export only, 89.6%', () => {
    expect(o.derived.monthKey).toBe('2026-08');
    expect(o.derived.source).toBe('ho_export');
    expect(o.derived.inputs.businessPlaced).toBe(296457.24);
    expect(o.derived.inputs.lapses).toBe(30878.88);
    expect(formatOutlookPct(o.derived.persistency)).toBe('89.6%');
  });

  it('estimate today = September, 86.6%', () => {
    expect(o.estimateToday.monthKey).toBe('2026-09');
    expect(o.estimateToday.inputs.businessPlaced).toBe(210975.24);
    expect(o.estimateToday.inputs.lapses).toBe(28196.88);
    expect(formatOutlookPct(o.estimateToday.persistency)).toBe('86.6%');
  });

  it('December projection 85.7% with the gap to the cent', () => {
    expect(o.gateMonth.monthKey).toBe('2026-12');
    expect(o.gateMonth.inputs.businessPlaced).toBe(188595.72);
    expect(o.gateMonth.inputs.lapses).toBe(27014.52);
    expect(formatOutlookPct(o.gateMonth.persistency)).toBe('85.7%');
    expect(o.gateMonth.meetsThreshold).toBe(false);
    expect(o.gateMonth.gap.settledApiNeeded).toBe(81549.48);
    expect(o.gateMonth.gap.reinstateNeeded).toBe(8154.95);
  });

  it('August is not confirmable (12-month model at HO); September is', () => {
    expect(o.derived.confirmable).toBe(false);
    const oct = outlookFor(
      KYRON_SHAPE.map((d) => ({ ...d, exportDate: '2026-10-15' })),
      { today: '2026-10-20' },
    );
    expect(oct.derived.monthKey).toBe('2026-09');
    expect(oct.derived.confirmable).toBe(true);
  });

  it('the headline is the derived month when nothing is confirmed', () => {
    expect(o.confirmed).toBeNull();
    expect(o.headline).toMatchObject({ kind: 'derived', monthKey: '2026-08' });
  });

  it('no pending policies → no "if pending settle" line', () => {
    expect(o.ifPendingSettle).toBeNull();
  });

  it('names the SMALLEST tier whose remaining API closes the gap', () => {
    const tiers = [
      { name: 'Pioneer', api: 825000 },
      { name: 'Starter', api: 100000 },
      { name: 'Champion', api: 275000 },
    ];
    const withTarget = outlookFor(KYRON_SHAPE, { productionTarget: { tiers, current: 73946.28 } });
    // Starter leaves 26,053.72 to go — short of 81,549.48 — so Champion is named.
    expect(withTarget.gateMonth.gap.closedByTarget).toEqual({
      name: 'Champion', api: 275000, remaining: 201053.72,
    });
    const none = outlookFor(KYRON_SHAPE, {
      productionTarget: { tiers: [{ name: 'Bronze', api: 80000 }], current: 10000 },
    });
    expect(none.gateMonth.gap.closedByTarget).toBeNull();
  });
});

describe('persistencyOutlook — hand-keyed and pending business (R2)', () => {
  const timestamp = (iso) => ({ toDate: () => new Date(`${iso}T12:00:00Z`) });
  const handKeyed = (status, api, dateIssued) => ({
    policyNumber: null, status, proposedAPI: api, agentId: 'u1',
    dateIssued: dateIssued ? timestamp(dateIssued) : null,
  });

  it('a hand-keyed SETTLED policy issued this month raises estimateToday', () => {
    const base = outlookFor(KYRON_SHAPE);
    const more = outlookFor([...KYRON_SHAPE, handKeyed('settled', 20000, '2026-09-18')]);
    expect(more.estimateToday.inputs.businessPlaced).toBe(230975.24);
    expect(more.estimateToday.persistency).toBeGreaterThan(base.estimateToday.persistency);
    // The derived month is head-office data only: unchanged.
    expect(more.derived.persistency).toBe(base.derived.persistency);
  });

  it('a hand-keyed SUBMITTED policy does not move estimateToday, but raises ifPendingSettle', () => {
    const base = outlookFor(KYRON_SHAPE);
    const more = outlookFor([...KYRON_SHAPE, handKeyed('submitted', 20000, null)]);
    expect(more.estimateToday.persistency).toBe(base.estimateToday.persistency);
    expect(more.ifPendingSettle.persistency).toBeGreaterThan(more.estimateToday.persistency);
    expect(more.ifPendingSettle.inputs.businessPlaced).toBe(230975.24);
    expect(more.ifPendingSettle.pendingCount).toBe(1);
    expect(more.ifPendingSettle.pendingApi).toBe(20000);
  });

  it('toLedgerDoc converts Timestamps and marks a hand-keyed doc as the writing agent, without mutating', () => {
    const doc = handKeyed('settled', 100, '2026-09-18');
    const out = toLedgerDoc(doc);
    expect(out.dateIssued).toBe('2026-09-18');
    expect(out.isWritingAgent).toBe(true);
    expect(doc.isWritingAgent).toBeUndefined();
    expect(toLedgerDoc({ importSource: 'oipa', isWritingAgent: false }).isWritingAgent).toBe(false);
  });
});

describe('persistencyOutlook — manual inputs (R3)', () => {
  it('a saved record\'s manual inputs win; the missing ones are named', () => {
    const records = [{
      monthKey: '2026-09', decreases: 0, incPPPs: 1000, lumpsums100: 0, reinstatements: 500,
    }];
    const o = outlookFor(KYRON_SHAPE, { records });
    expect(o.estimateToday.inputs.incPPPs).toBe(1000);
    expect(o.estimateToday.inputs.reinstatements).toBe(500);
    expect(o.assumptions.fromRecord).toEqual(['decreases', 'incPPPs', 'lumpsums100', 'reinstatements']);
    expect(o.assumptions.assumedZero).toEqual([]);
  });

  it('with no record, all four 24-month inputs are named as assumed 0', () => {
    const o = outlookFor(KYRON_SHAPE);
    expect(o.assumptions.assumedZero).toEqual(['decreases', 'incPPPs', 'lumpsums100', 'reinstatements']);
    // August is on the legacy model, which has no `decreases`.
    expect(o.derived.assumptions.assumedZero).toEqual(['incPPPs', 'lumpsums100', 'reinstatements']);
  });

  it('a partial record: present values win, absent ones are named', () => {
    const o = outlookFor(KYRON_SHAPE, { records: [{ monthKey: '2026-09', incPPPs: 250 }] });
    expect(o.assumptions.fromRecord).toEqual(['incPPPs']);
    expect(o.assumptions.assumedZero).toEqual(['decreases', 'lumpsums100', 'reinstatements']);
  });
});

describe('persistencyOutlook — staleness (R4)', () => {
  it('export 45 days old is not stale; 46 days old is', () => {
    expect(PERSISTENCY_OUTLOOK_STALE_DAYS).toBe(45);
    const at45 = outlookFor(KYRON_SHAPE, { today: '2026-10-30' });
    const at46 = outlookFor(KYRON_SHAPE, { today: '2026-10-31' });
    expect(at45.daysSinceExport).toBe(45);
    expect(at45.stale).toBe(false);
    expect(at46.daysSinceExport).toBe(46);
    expect(at46.stale).toBe(true);
  });
});

describe('persistencyOutlook — confirmed records and the gate (R5)', () => {
  const confirmedAug = {
    monthKey: '2026-08', persistency: 0.901, source: HO_CONFIRMED_SOURCE,
    ledgerWindowMonths: 24, annuityMissedPremiumRule: 'ignore',
  };

  it('a confirmed month wins the headline over the derived month of the same date', () => {
    const o = outlookFor(KYRON_SHAPE, { records: [confirmedAug] });
    expect(o.confirmed).toMatchObject({ monthKey: '2026-08', source: 'ho_confirmed', persistency: 0.901 });
    expect(o.headline).toMatchObject({ kind: 'confirmed', monthKey: '2026-08', persistency: 0.901 });
  });

  it('a pre-September record without a 24-month window is not a 24-month figure', () => {
    expect(isTwentyFourMonthFigure({ monthKey: '2026-08', persistency: 0.95 })).toBe(false);
    expect(isTwentyFourMonthFigure(confirmedAug)).toBe(true);
    expect(isTwentyFourMonthFigure({ monthKey: '2026-09', persistency: 0.95 })).toBe(true);
    const o = outlookFor(KYRON_SHAPE, { records: [{ monthKey: '2026-08', persistency: 0.95 }] });
    expect(o.confirmed).toBeNull();
    expect(o.headline.kind).toBe('derived');
  });

  it('outlookGateFor reads the gate month and threshold from the campaign', () => {
    const campaign = {
      endDate: '2026-12-31',
      persistencyGate: { mode: 'binary', threshold: 90, basis: 'finalMonth' },
    };
    expect(outlookGateFor(campaign)).toEqual({ monthKey: '2026-12', threshold: 90, basis: 'finalMonth' });
    expect(outlookGateFor({ ...campaign, persistencyGateEnabled: false })).toBeNull();
    expect(outlookGateFor(null)).toBeNull();
  });

  it('a gate month already in the past is not projected', () => {
    const o = outlookFor(KYRON_SHAPE, { gate: { monthKey: '2026-08', threshold: 90 } });
    expect(o.gateMonth).toBeNull();
  });
});

describe('persistencyOutlook — annuity rule', () => {
  const annuity = imported('P-AN1', '2025-07-01', 'settled', 30000, {
    policyClass: 'annuity', paidToDate: '2026-05-01',
  });

  it('switching the rule changes every figure and the label', () => {
    const ignore = outlookFor([...KYRON_SHAPE, annuity], { annuityMissedPremiumRule: 'ignore' });
    const lapse = outlookFor([...KYRON_SHAPE, annuity], { annuityMissedPremiumRule: 'lapse' });
    for (const key of ['derived', 'estimateToday', 'gateMonth']) {
      expect(lapse[key].persistency).toBeLessThan(ignore[key].persistency);
      expect(ignore[key].annuityRuleLabel).toMatch(/ignored/);
      expect(lapse[key].annuityRuleLabel).toMatch(/counted as lapse/);
    }
    expect(lapse.assumptions.annuityMissedPremiumRule).toBe('lapse');
  });

  it('defaults to the newest saved record\'s rule', () => {
    const o = outlookFor(KYRON_SHAPE, { records: [{ monthKey: '2026-07', annuityMissedPremiumRule: 'lapse' }] });
    expect(o.annuityMissedPremiumRule).toBe('lapse');
  });
});

describe('persistencyOutlook — empty and error states', () => {
  it('no policies and no records → every figure null', () => {
    const o = outlookFor([]);
    expect(o.derived).toBeNull();
    expect(o.estimateToday).toBeNull();
    expect(o.gateMonth).toBeNull();
    expect(o.headline).toBeNull();
    expect(o.stale).toBe(false);
  });

  it('throws on a malformed today', () => {
    expect(() => buildPersistencyOutlook({ policies: [], today: '23/09/2026' })).toThrow(/today/);
  });
});

describe('persistencyTone', () => {
  it('below the threshold is warning; only a confirmed gate month may be danger', () => {
    expect(persistencyTone(0.896)).toBe('warning');
    expect(persistencyTone(0.896, { confirmedGateMonth: true })).toBe('danger');
    expect(persistencyTone(0.9)).toBe('success');
    expect(persistencyTone(null)).toBe('neutral');
  });
});
