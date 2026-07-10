import { describe, it, expect } from 'vitest';
import {
  FUNNEL_REPORT_OPTS, DEFAULT_FUNNEL_FILTERS,
  unitLabel, deriveUnitOptions, funnelFiltersCount,
  matchesFunnelFilters, applyFunnelFilters, buildFilterChips,
} from '../funnelFilters';

// Roster rows shaped exactly like MasterSheet's `allRows` entries (the fields
// the predicates read: unitId, unitName, status, logged).
const ROWS = [
  { id: 'a1', unitId: 'unit-x', unitName: null, status: 'submitted', logged: true },
  { id: 'um', unitId: 'unit-x', unitName: null, status: 'submitted', logged: true },
  { id: 'bm', unitId: '__branch_direct__', unitName: null, status: 'submitted', logged: true },
  { id: 'a2', unitId: 'unit-x', unitName: null, status: 'draft', logged: false },
];

describe('funnelFilters — options + labels', () => {
  it('report options are ONLY the two row states (no "Missing" — non-filers are not rows)', () => {
    expect(FUNNEL_REPORT_OPTS.map(([k]) => k)).toEqual(['submitted', 'draft']);
    expect(FUNNEL_REPORT_OPTS.some(([k]) => k === 'missing')).toBe(false);
  });

  it('unitLabel: real name wins; branch-direct sentinel is friendly; else stable fallback', () => {
    expect(unitLabel('unit-x', 'South · 01')).toBe('South · 01');
    expect(unitLabel('__branch_direct__')).toBe('Branch direct');
    expect(unitLabel('abcdef1234')).toBe('Unit 1234');
  });

  it('deriveUnitOptions returns distinct present units, label-sorted, no "all"', () => {
    const opts = deriveUnitOptions(ROWS);
    expect(opts.map((o) => o.id).sort()).toEqual(['__branch_direct__', 'unit-x']);
    expect(opts.some((o) => o.id === 'all')).toBe(false);
    // sorted by label: "Branch direct" < "Unit t-x"
    expect(opts[0].label).toBe('Branch direct');
  });

  it('deriveUnitOptions ignores rows without a unitId', () => {
    expect(deriveUnitOptions([{ id: 'x', unitId: null }])).toEqual([]);
  });
});

describe('funnelFilters — count', () => {
  it('default is 0', () => {
    expect(funnelFiltersCount(DEFAULT_FUNNEL_FILTERS)).toBe(0);
  });
  it('unit(1) + each report + noLog(1) are additive', () => {
    expect(funnelFiltersCount({ unit: 'unit-x', reports: ['submitted', 'draft'], noLog: true })).toBe(4);
    expect(funnelFiltersCount({ unit: 'all', reports: ['draft'], noLog: false })).toBe(1);
  });
});

describe('funnelFilters — predicate + apply', () => {
  it('default filters match everything', () => {
    expect(applyFunnelFilters(ROWS, DEFAULT_FUNNEL_FILTERS)).toHaveLength(4);
  });

  it('unit filter keeps only that unit (branch-direct → BM alone)', () => {
    const out = applyFunnelFilters(ROWS, { ...DEFAULT_FUNNEL_FILTERS, unit: '__branch_direct__' });
    expect(out.map((r) => r.id)).toEqual(['bm']);
  });

  it('report filter is an OR within the family', () => {
    expect(applyFunnelFilters(ROWS, { ...DEFAULT_FUNNEL_FILTERS, reports: ['draft'] }).map((r) => r.id)).toEqual(['a2']);
    expect(applyFunnelFilters(ROWS, { ...DEFAULT_FUNNEL_FILTERS, reports: ['submitted'] }).map((r) => r.id))
      .toEqual(['a1', 'um', 'bm']);
    expect(applyFunnelFilters(ROWS, { ...DEFAULT_FUNNEL_FILTERS, reports: ['submitted', 'draft'] })).toHaveLength(4);
  });

  it('no-log keeps only rows whose submission has no daily log (logged === false)', () => {
    expect(applyFunnelFilters(ROWS, { ...DEFAULT_FUNNEL_FILTERS, noLog: true }).map((r) => r.id)).toEqual(['a2']);
  });

  it('matchesFunnelFilters is the single-row predicate behind applyFunnelFilters', () => {
    const bm = ROWS.find((r) => r.id === 'bm');
    expect(matchesFunnelFilters(bm, { ...DEFAULT_FUNNEL_FILTERS, unit: '__branch_direct__' })).toBe(true);
    expect(matchesFunnelFilters(bm, { ...DEFAULT_FUNNEL_FILTERS, unit: 'unit-x' })).toBe(false);
    expect(matchesFunnelFilters(bm, { ...DEFAULT_FUNNEL_FILTERS, noLog: true })).toBe(false);
  });

  it('conditions compose as AND across families (submitted ∩ branch-direct → BM)', () => {
    const out = applyFunnelFilters(ROWS, { ...DEFAULT_FUNNEL_FILTERS, unit: '__branch_direct__', reports: ['submitted'] });
    expect(out.map((r) => r.id)).toEqual(['bm']);
  });

  it('composition can be empty (draft ∩ branch-direct → none)', () => {
    expect(applyFunnelFilters(ROWS, { ...DEFAULT_FUNNEL_FILTERS, unit: '__branch_direct__', reports: ['draft'] })).toEqual([]);
  });
});

describe('funnelFilters — chip descriptors', () => {
  it('no chips when nothing active', () => {
    expect(buildFilterChips(DEFAULT_FUNNEL_FILTERS, [])).toEqual([]);
  });

  it('one chip per active family, each with a clearing patch', () => {
    const unitOptions = deriveUnitOptions(ROWS);
    const chips = buildFilterChips({ unit: '__branch_direct__', reports: ['submitted', 'draft'], noLog: true }, unitOptions);
    expect(chips.map((c) => c.key)).toEqual(['unit', 'report', 'nolog']);
    expect(chips.find((c) => c.key === 'unit').text).toBe('UNIT · BRANCH DIRECT');
    expect(chips.find((c) => c.key === 'report').text).toBe('REPORT · SUBMITTED / DRAFT');
    expect(chips.find((c) => c.key === 'nolog').text).toBe('NO DAILY LOG');
    // patches clear exactly their own condition
    expect(chips.find((c) => c.key === 'unit').patch).toEqual({ unit: 'all' });
    expect(chips.find((c) => c.key === 'report').patch).toEqual({ reports: [] });
    expect(chips.find((c) => c.key === 'nolog').patch).toEqual({ noLog: false });
  });

  it('unit chip falls back to the raw id label when the option is unknown', () => {
    const chips = buildFilterChips({ ...DEFAULT_FUNNEL_FILTERS, unit: 'gone' }, []);
    expect(chips[0].text).toBe('UNIT · GONE');
  });
});
