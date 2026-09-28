import { describe, it, expect } from 'vitest';
import {
  paceModel, persistencySeries, clearingSets, reinstatementPlan, whatIf,
  shiftMonthKey, monthLabel, wholeTTDUp, EXACT_SEARCH_MAX, selectionSummary, SOON_MONTHS, WINDOW_MONTHS,
} from '../moneyModel';
import { buildPersistencyOutlook } from '../../persistency/persistencyOutlook';

// The canvas's real lapse list (DESKTOP3-MONEY.md), need TTD 7,099.36.
const CANVAS_LAPSES = [1182.36, 2400.0, 11996.64, 4821.12, 3617.64, 2400.0, 1779.12].map((api, i) => ({ id: `L${i}`, api }));

describe('clearingSets', () => {
  it('canvas lapses, need 7,099.36: least money is 3 policies at 7,200.00; fewest is 1 policy at 11,996.64', () => {
    const { leastMoney, fewestPolicies } = clearingSets(CANVAS_LAPSES, 7099.36);
    expect(leastMoney.exact).toBe(true);
    expect(leastMoney.total).toBe(7200);
    expect(leastMoney.items.map((i) => i.api).sort((a, b) => a - b)).toEqual([1182.36, 2400, 3617.64]);
    expect(fewestPolicies.items.map((i) => i.api)).toEqual([11996.64]);
  });

  it('least money breaks a tie on total by fewer policies', () => {
    const { leastMoney } = clearingSets([{ api: 500 }, { api: 500 }, { api: 1000 }], 1000);
    expect(leastMoney.total).toBe(1000);
    expect(leastMoney.items).toHaveLength(1);
  });

  it('returns null when every lapse together still falls short', () => {
    expect(clearingSets([{ api: 10 }, { api: 20 }], 31)).toBeNull();
  });

  it('an already-met gate needs nothing', () => {
    expect(clearingSets(CANVAS_LAPSES, 0).leastMoney).toEqual({ items: [], total: 0, exact: true });
  });

  it('over the exhaustive limit: least money is greedy (not exact) and has no spare policy; fewest stays exact', () => {
    const many = Array.from({ length: EXACT_SEARCH_MAX + 4 }, (_, i) => ({ api: 100 + i * 37 }));
    const { leastMoney, fewestPolicies } = clearingSets(many, 1234.5);
    expect(leastMoney.exact).toBe(false);
    expect(leastMoney.total).toBeGreaterThanOrEqual(1234.5);
    for (const it of leastMoney.items) expect(leastMoney.total - it.api).toBeLessThan(1234.5);
    expect(fewestPolicies.exact).toBe(true);
    expect(fewestPolicies.total).toBeGreaterThanOrEqual(1234.5);
  });

  it('matches brute force on random inputs (both answers)', () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let run = 0; run < 40; run += 1) {
      const items = Array.from({ length: 1 + Math.floor(rnd() * 9) }, () => ({ api: Math.round(rnd() * 500000) / 100 }));
      const need = Math.round(rnd() * items.reduce((s, x) => s + x.api, 0) * 100) / 100;
      if (need <= 0) continue;
      const sets = clearingSets(items, need);
      let money = null; let few = null;
      for (let m = 1; m < (1 << items.length); m += 1) {
        let t = 0; let c = 0;
        items.forEach((it, i) => { if (m & (1 << i)) { t += it.api; c += 1; } });
        t = Math.round(t * 100) / 100;
        if (t < need) continue;
        if (!money || t < money.t || (t === money.t && c < money.c)) money = { t, c };
        if (!few || c < few.c || (c === few.c && t < few.t)) few = { t, c };
      }
      expect([sets.leastMoney.items.length, sets.leastMoney.total]).toEqual([money.c, money.t]);
      expect([sets.fewestPolicies.items.length, sets.fewestPolicies.total]).toEqual([few.c, few.t]);
    }
  });
});

describe('paceModel', () => {
  const settledByMonth = [
    { month: '2026-02', api: 1000 }, { month: '2026-07', api: 20000 }, { month: '2026-09', api: 30000 },
    { month: '2025-12', api: 99999 }, // other year: ignored
  ];

  it('cumulative line ends on the settled total; pace is goal × month ÷ 12', () => {
    const m = paceModel({ settledByMonth, year: 2026, currentMonth: 9, goal: 120000, isMdrt: false });
    expect(m.series[0].values).toHaveLength(9);
    expect(m.settledToDate).toBe(51000);
    expect(m.series[1].values[11]).toBe(120000);
    expect(m.paceToDate).toBe(90000);
    expect(m.delta).toBe(-39000);
    expect(m.title).toBe('TTD 39,000 behind an even pace to your goal');
  });

  it('cumulative is monotonic (a settled month never lowers the line)', () => {
    const m = paceModel({ settledByMonth, year: 2026, currentMonth: 12, goal: 688800, isMdrt: true });
    const v = m.series[0].values;
    for (let i = 1; i < v.length; i += 1) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
  });

  it('no goal → null (never a fake pace)', () => {
    expect(paceModel({ settledByMonth, year: 2026, currentMonth: 9, goal: 0, isMdrt: true })).toBeNull();
  });
});

describe('persistencySeries', () => {
  const records = [
    { monthKey: '2026-06', persistency: 0.912 },
    { monthKey: '2026-07', persistency: 0.884 },
    { monthKey: '2026-08', persistency: 0, grossSettled: 0 }, // no reading, not 0 %
    { monthKey: '2026-05', persistency: 0.93 },
  ];

  it('sorted, percent to 1 dp, a zero-gross month skipped, estimate appended as projected', () => {
    const s = persistencySeries({ records, estimate: { monthKey: '2026-09', persistency: 0.8661 } });
    expect(s.data.map((d) => [d.key, d.value, d.projected])).toEqual([
      ['2026-05', 93, false], ['2026-06', 91.2, false], ['2026-07', 88.4, false], ['2026-09', 86.6, true],
    ]);
    expect(s.hasTwelveMonthModel).toBe(true); // May–Jul 2026 predate the 24-month model
  });

  it('an estimate not newer than the last saved month is not added', () => {
    const s = persistencySeries({ records, estimate: { monthKey: '2026-07', persistency: 0.5 } });
    expect(s.data.some((d) => d.projected)).toBe(false);
  });

  it('keeps only the newest `limit` bars', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ monthKey: shiftMonthKey('2025-01', i), persistency: 0.9 }));
    expect(persistencySeries({ records: many, limit: 12 }).data).toHaveLength(12);
  });
});

// A small hand-keyed ledger (no export): today 20-09-2026, window Oct 2024 – Sep 2026.
const TODAY = '2026-09-20';
function pol(n, status, api, dateIssued, extra = {}) {
  return { id: n, policyNumber: n, status, proposedAPI: api, dateIssued, productLine: 'life', ...extra };
}
const LEDGER = [
  pol('S1', 'settled', 100000, '2025-06-01'),
  pol('L1', 'lapsed', 5000, '2025-01-10', { ownerName: '[Client A]' }),
  pol('L2', 'lapsed', 3000, '2024-11-05'),
  pol('L4', 'lapsed', 4000, '2025-03-01'),
  pol('L3', 'lapsed', 9000, '2024-08-01'), // outside the 24-month window
  pol('L5', 'lapsed', 6000, '2025-02-01', { totalPremiumPaid: 12000 }), // cleared by 24 months' premium
];

describe('reinstatementPlan', () => {
  it('lists exactly the lapses the outlook counted, with the gap and the smallest set', () => {
    const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
    const outlook = buildPersistencyOutlook({ policies: LEDGER, today: TODAY });
    expect(plan.monthKey).toBe('2026-09');
    expect(plan.lapsesTotal).toBe(outlook.estimateToday.inputs.lapses);
    expect(plan.lapses.map((l) => l.policyNumber).sort()).toEqual(['L1', 'L2', 'L4']);
    expect(plan.unitemised).toBe(0);
    // gross 118,000 (S1 + all placed in window incl. L5) − lapses 12,000 → 89.8 %
    expect(plan.meets).toBe(false);
    expect(plan.threshold).toBe(90);
    expect(plan.need).toBeGreaterThan(0);
    expect(plan.suggestion.total).toBeGreaterThanOrEqual(plan.need);
    expect(plan.suggestion.afterPct).toBeGreaterThanOrEqual(90);
    // Soonest to age out first; L2 (issued Nov 2024) counts through Oct 2026.
    expect(plan.lapses[0].policyNumber).toBe('L2');
    expect(plan.lapses[0].countsThrough).toBe('2026-10');
    expect(plan.lapses[0].monthsLeft).toBe(1);
    expect(plan.lapses.find((l) => l.policyNumber === 'L1').clientName).toBe('[Client A]');
  });

  it('both presets, always: Fewest calls never needs more policies than Least money, and Least money never costs more', () => {
    const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
    const { fewestCalls, leastMoney } = plan.presets;
    expect(fewestCalls.items.length).toBeLessThanOrEqual(leastMoney.items.length);
    expect(leastMoney.total).toBeLessThanOrEqual(fewestCalls.total);
    expect(fewestCalls.total).toBeGreaterThanOrEqual(plan.need);
    expect(leastMoney.total).toBeGreaterThanOrEqual(plan.need);
    expect(plan.suggestion).toBe(leastMoney);
  });

  it(`flags a lapse that stops counting within ${SOON_MONTHS} months of the planned month, in the row and in any preset holding it`, () => {
    const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
    const by = Object.fromEntries(plan.lapses.map((l) => [l.policyNumber, l]));
    expect(by.L2.agesOutSoon).toBe(true);   // counts through Oct 2026: 1 month after Sep
    expect(by.L1.agesOutSoon).toBe(false);  // Dec 2026: 3 months after
    expect(by.L4.agesOutSoon).toBe(false);  // Feb 2027
    for (const preset of Object.values(plan.presets)) {
      expect(preset.agingOut.map((l) => l.policyNumber))
        .toEqual(preset.items.filter((l) => l.agesOutSoon).map((l) => l.policyNumber));
    }
  });

  it('agesOutSoon boundary: exactly SOON_MONTHS after the planned month is flagged, SOON_MONTHS + 1 is not', () => {
    // No gate → fig.monthKey is the current month derived from TODAY ('2026-09-20').
    const plannedMonth = TODAY.slice(0, 7);
    const countsThroughAt = shiftMonthKey(plannedMonth, SOON_MONTHS);
    const countsThroughOver = shiftMonthKey(plannedMonth, SOON_MONTHS + 1);
    // countsThrough = shiftMonthKey(issuedMonth, WINDOW_MONTHS - 1), so work the date back.
    const issuedAt = shiftMonthKey(countsThroughAt, -(WINDOW_MONTHS - 1));
    const issuedOver = shiftMonthKey(countsThroughOver, -(WINDOW_MONTHS - 1));
    const boundaryLedger = [
      ...LEDGER,
      pol('B1', 'lapsed', 1000, `${issuedAt}-01`),
      pol('B2', 'lapsed', 1000, `${issuedOver}-01`),
    ];
    const plan = reinstatementPlan({ policies: boundaryLedger, todayTT: TODAY });
    const by = Object.fromEntries(plan.lapses.map((l) => [l.policyNumber, l]));
    expect(by.B1).toBeTruthy();
    expect(by.B2).toBeTruthy();
    expect(by.B1.countsThrough).toBe(countsThroughAt);
    expect(by.B2.countsThrough).toBe(countsThroughOver);
    expect(by.B1.agesOutSoon).toBe(true);
    expect(by.B2.agesOutSoon).toBe(false);
  });

  it('a gate month further out: aging is measured from the gate month, not today', () => {
    const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY, gate: { monthKey: '2026-11', threshold: 90 } });
    expect(plan.isGateMonth).toBe(true);
    expect(plan.monthKey).toBe('2026-11');
    // L2 (counts through Oct 2026) is outside November's window, so it is not a lever at all.
    expect(plan.lapses.map((l) => l.policyNumber)).not.toContain('L2');
    expect(plan.lapses.find((l) => l.policyNumber === 'L1').agesOutSoon).toBe(true); // Dec 2026 = gate + 1
  });

  it('never offers an aged-out or premium-cleared lapse as a lever', () => {
    const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
    const nums = plan.lapses.map((l) => l.policyNumber);
    expect(nums).not.toContain('L3');
    expect(nums).not.toContain('L5');
  });

  it('gate met → no suggestion and need 0', () => {
    const plan = reinstatementPlan({ policies: LEDGER.filter((p) => p.policyNumber !== 'L4' && p.policyNumber !== 'L1'), todayTT: TODAY });
    expect(plan.meets).toBe(true);
    expect(plan.need).toBe(0);
    expect(plan.suggestion).toBeNull();
  });

  it('no policies → null (nothing to plan against)', () => {
    expect(reinstatementPlan({ policies: [], todayTT: TODAY })).toBeNull();
  });

  it('monotonic: adding a settled policy never lowers persistency or raises the need', () => {
    const base = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
    const more = reinstatementPlan({ policies: [...LEDGER, pol('S2', 'settled', 20000, '2026-01-15')], todayTT: TODAY });
    expect(more.currentPct).toBeGreaterThanOrEqual(base.currentPct);
    expect(more.need).toBeLessThanOrEqual(base.need);
  });
});

describe('selectionSummary', () => {
  const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });

  it('nothing ticked: total 0, the whole gap remains, persistency unchanged', () => {
    const s = selectionSummary(plan, []);
    expect(s).toMatchObject({ count: 0, total: 0, remaining: plan.need, clears: false, afterPct: plan.currentPct });
  });

  it('any mix: running total, what is left of the gap, projected %', () => {
    const s = selectionSummary(plan, ['L2', 'nope']);
    expect(s.count).toBe(1);
    expect(s.total).toBe(3000);
    expect(s.clears).toBe(s.total >= plan.need);
    expect(s.remaining).toBe(Math.max(0, Math.round((plan.need - 3000) * 100) / 100));
    expect(s.agingOut.map((l) => l.policyNumber)).toEqual(['L2']);
  });

  it('a preset ticked reproduces the preset figures', () => {
    const p = plan.presets.leastMoney;
    const s = selectionSummary(plan, p.items.map((l) => l.policyNumber));
    expect(s.total).toBe(p.total);
    expect(s.afterPct).toBe(p.afterPct);
    expect(s.clears).toBe(true);
  });

  it('monotonic: ticking one more policy never lowers the total or the projected %', () => {
    const nums = plan.lapses.map((l) => l.policyNumber);
    for (let k = 1; k <= nums.length; k += 1) {
      const a = selectionSummary(plan, nums.slice(0, k - 1));
      const b = selectionSummary(plan, nums.slice(0, k));
      expect(b.total).toBeGreaterThanOrEqual(a.total);
      expect(b.afterPct).toBeGreaterThanOrEqual(a.afterPct);
    }
  });
});

describe('whatIf', () => {
  const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });

  it('extra apps add to settled and to persistency; reinstating adds the set total', () => {
    const base = whatIf({ settled: 87146, goal: 688800, extraApps: 0, avgApi: 10000, plan, reinstate: false });
    expect(base.projectedSettled).toBe(87146);
    expect(base.persistencyPct).toBe(plan.currentPct);
    const w = whatIf({ settled: 87146, goal: 688800, extraApps: 3, avgApi: 10000, plan, reinstate: true });
    expect(w.projectedSettled).toBe(117146);
    expect(w.pctOfGoal).toBe(17);
    expect(w.reinstated).toBe(plan.suggestion.total);
    expect(w.persistencyPct).toBeGreaterThan(base.persistencyPct);
  });

  it('unknown settled stays unknown', () => {
    expect(whatIf({ settled: null, goal: 688800, extraApps: 2, avgApi: 10000 }).projectedSettled).toBeNull();
  });
});

describe('formatting helpers', () => {
  it('month keys and rounding-up', () => {
    expect(shiftMonthKey('2024-11', 23)).toBe('2026-10');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-09')).toBe('Sep 2026');
    expect(wholeTTDUp(7099.36)).toBe('7,100');
    expect(wholeTTDUp(7100)).toBe('7,100');
  });
});
