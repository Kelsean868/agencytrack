import { describe, it, expect } from 'vitest';
import {
  isActivelyFinanced,
  assembleRosterRow,
  computeRosterAggregates,
  ACTIVE_FINANCING_STATUSES,
} from '../unitFinancingRoster';

// A confirmed ledger month (settled-confirmed basis) with the given fields.
const confirmed = (month, { actualAPI, validatingAPI, managerFinancing, adjustmentPct, runningBalance } = {}) => ({
  month,
  basisSource: 'settled-confirmed',
  actualAPI,
  validatingAPI,
  managerFinancing,
  adjustmentPct,
  runningBalance,
});

const provisional = (month, fields = {}) => ({ ...confirmed(month, fields), basisSource: 'submitted-provisional' });

describe('isActivelyFinanced', () => {
  it('includes on_financing / reconciling / post_financing_repayment', () => {
    // Hardcode the supported statuses (not derived from the exported constant) so
    // this test catches contract drift if the set is changed incorrectly.
    ['on_financing', 'reconciling', 'post_financing_repayment'].forEach((s) => {
      expect(isActivelyFinanced({ financingStatus: s })).toBe(true);
    });
    // And pin the exported membership set to exactly those three.
    expect([...ACTIVE_FINANCING_STATUSES].sort()).toEqual(
      ['on_financing', 'post_financing_repayment', 'reconciling'],
    );
  });

  it('excludes not_on_financing, cleared, missing terms', () => {
    expect(isActivelyFinanced({ financingStatus: 'not_on_financing' })).toBe(false);
    expect(isActivelyFinanced({ financingStatus: 'cleared' })).toBe(false);
    expect(isActivelyFinanced(null)).toBe(false);
    expect(isActivelyFinanced(undefined)).toBe(false);
  });
});

describe('assembleRosterRow', () => {
  const agent = { id: 'a1', name: 'R. Seepersad', unitId: 'um-uid' };
  const terms = {
    financingStatus: 'on_financing',
    effectiveDate: '2025-12-01',
    agreedMonthlyFinancing: 8000,
    currentMonthlyFinancing: 8000,
  };

  it('carries agent identity + agentUnitId for the CoachNote denorm', () => {
    const row = assembleRosterRow({ agent, terms, ledger: [], ceiling: 48000 });
    expect(row.agentId).toBe('a1');
    expect(row.agentName).toBe('R. Seepersad');
    expect(row.agentUnitId).toBe('um-uid');
    expect(row.status).toBe('on_financing');
  });

  it('falls back to email then id for the display name', () => {
    expect(assembleRosterRow({ agent: { id: 'x', email: 'e@x.io', unitId: 'u' }, terms, ledger: [] }).agentName).toBe('e@x.io');
    expect(assembleRosterRow({ agent: { id: 'x', unitId: 'u' }, terms, ledger: [] }).agentName).toBe('x');
  });

  it('counts consecutive confirmed misses; a provisional tail never advances the count', () => {
    const ledger = [
      confirmed('2026_01', { actualAPI: 10, validatingAPI: 20 }), // miss
      confirmed('2026_02', { actualAPI: 10, validatingAPI: 20 }), // miss
      provisional('2026_03', { actualAPI: 5, validatingAPI: 20 }), // provisional — NO-OP
    ];
    const row = assembleRosterRow({ agent, terms, ledger, ceiling: 48000 });
    expect(row.missCount).toBe(2);
    expect(row.missSeverity).toBe('amber');
    expect(row.terminationConditionMet).toBe(false);
  });

  it('flags the termination condition at 3 confirmed misses', () => {
    const ledger = [
      confirmed('2026_01', { actualAPI: 1, validatingAPI: 20 }),
      confirmed('2026_02', { actualAPI: 1, validatingAPI: 20 }),
      confirmed('2026_03', { actualAPI: 1, validatingAPI: 20 }),
    ];
    const row = assembleRosterRow({ agent, terms, ledger, ceiling: 48000 });
    expect(row.missCount).toBe(3);
    expect(row.missSeverity).toBe('critical');
    expect(row.terminationConditionMet).toBe(true);
  });

  it('takes the latest confirmed managerFinancing as the confirmed draw + its adjustmentPct', () => {
    const ledger = [
      confirmed('2026_01', { managerFinancing: 5000, adjustmentPct: 0, runningBalance: 5000 }),
      confirmed('2026_02', { managerFinancing: 4000, adjustmentPct: 0.5, runningBalance: 9000 }),
    ];
    const row = assembleRosterRow({ agent, terms, ledger, ceiling: 48000 });
    expect(row.confirmedDraw).toBe(4000);
    expect(row.confirmedDrawMonth).toBe('2026_02');
    expect(row.adjustmentPct).toBe(0.5);
  });

  it('raises the >10% flag only on a CONFIRMED cut past the threshold (provisional never flags)', () => {
    const flagged = assembleRosterRow({
      agent, terms, ceiling: 48000,
      ledger: [confirmed('2026_02', { managerFinancing: 4300, adjustmentPct: 0.14, runningBalance: 31200 })],
    });
    expect(flagged.hasAdjFlag).toBe(true);
    expect(flagged.adjFlagPct).toBeCloseTo(0.14);

    const withinTen = assembleRosterRow({
      agent, terms, ceiling: 48000,
      ledger: [confirmed('2026_02', { managerFinancing: 7520, adjustmentPct: 0.06, runningBalance: 14900 })],
    });
    expect(withinTen.hasAdjFlag).toBe(false);

    const provisionalCut = assembleRosterRow({
      agent, terms, ceiling: 48000,
      ledger: [provisional('2026_03', { managerFinancing: 4000, adjustmentPct: 0.5, runningBalance: 12000 })],
    });
    expect(provisionalCut.hasAdjFlag).toBe(false);
  });

  it('derives surplus (negative balance) and over-ceiling from the latest balance vs ceiling', () => {
    const surplus = assembleRosterRow({
      agent, terms, ceiling: 48000,
      ledger: [confirmed('2026_02', { runningBalance: -3100 })],
    });
    expect(surplus.runningBalance).toBe(-3100);
    expect(surplus.isSurplus).toBe(true);
    expect(surplus.overCeiling).toBe(false);

    const over = assembleRosterRow({
      agent, terms, ceiling: 48000,
      ledger: [confirmed('2026_02', { runningBalance: 50000 })],
    });
    expect(over.isSurplus).toBe(false);
    expect(over.overCeiling).toBe(true);
  });

  it('never leaks NaN into money figures for an empty/blank ledger', () => {
    const row = assembleRosterRow({ agent, terms, ledger: [], ceiling: 48000 });
    expect(row.confirmedDraw).toBeNull();
    expect(row.adjustmentPct).toBeNull();
    expect(row.runningBalance).toBeNull();
    expect(row.hasAdjFlag).toBe(false);
    expect(row.missCount).toBe(0);
  });
});

describe('computeRosterAggregates', () => {
  it('sums drawn/confirmed and counts at-risk / >=2-miss / >10%-adj across the resolved rows', () => {
    const rows = [
      { status: 'on_financing', runningBalance: 22400, confirmedDraw: 4000, missSeverity: 'amber',    missCount: 2, hasAdjFlag: false }, // at-risk + >=2
      { status: 'on_financing', runningBalance: 31200, confirmedDraw: 4300, missSeverity: 'none',     missCount: 0, hasAdjFlag: true },  // at-risk + adj
      { status: 'on_financing', runningBalance: -3100, confirmedDraw: 8000, missSeverity: 'none',     missCount: 0, hasAdjFlag: false }, // surplus, clean
      { status: 'on_financing', runningBalance: 14900, confirmedDraw: 2800, missSeverity: 'none',     missCount: 1, hasAdjFlag: false }, // 1 miss — not at-risk
    ];
    const agg = computeRosterAggregates(rows);
    expect(agg.onFinancing).toBe(4);
    expect(agg.totalDrawn).toBe(22400 + 31200 - 3100 + 14900);
    expect(agg.confirmedThisMonth).toBe(4000 + 4300 + 8000 + 2800);
    expect(agg.atRisk).toBe(2);
    expect(agg.twoPlusMisses).toBe(1);
    expect(agg.adjWithBm).toBe(1);
  });

  it('is zero-safe for an empty roster', () => {
    const agg = computeRosterAggregates([]);
    expect(agg).toEqual({ onFinancing: 0, totalDrawn: 0, confirmedThisMonth: 0, atRisk: 0, twoPlusMisses: 0, adjWithBm: 0 });
  });
});
