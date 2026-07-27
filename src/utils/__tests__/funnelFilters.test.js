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

// ── STATUS condition ────────────────────────────────────────────────────────
// Rows carry a pre-derived `statusBand` (utils/funnelStatus.buildStatusMap).
// These rows deliberately include one with NO band — the unavailable case.
const BAND_ROWS = [
  { id: 'ok',    unitId: 'unit-x', status: 'submitted', logged: true,  statusBand: 'ontrack' },
  { id: 'slow',  unitId: 'unit-x', status: 'submitted', logged: true,  statusBand: 'pace' },
  { id: 'low',   unitId: 'unit-y', status: 'submitted', logged: true,  statusBand: 'floor' },
  { id: 'quiet', unitId: 'unit-y', status: 'draft',     logged: false, statusBand: 'quiet' },
  { id: 'none',  unitId: 'unit-y', status: 'submitted', logged: true,  statusBand: null },
];

describe('funnelFilters — STATUS condition', () => {
  it('the default carries an empty statuses list (neutral)', () => {
    expect(DEFAULT_FUNNEL_FILTERS.statuses).toEqual([]);
  });

  it('an empty statuses list matches every row (including unbanded)', () => {
    expect(applyFunnelFilters(BAND_ROWS, DEFAULT_FUNNEL_FILTERS)).toHaveLength(5);
  });

  it('filters to exactly the selected band', () => {
    const out = applyFunnelFilters(BAND_ROWS, { ...DEFAULT_FUNNEL_FILTERS, statuses: ['floor'] });
    expect(out.map((r) => r.id)).toEqual(['low']);
  });

  it('multiple bands are additive (OR within the family)', () => {
    const out = applyFunnelFilters(BAND_ROWS, { ...DEFAULT_FUNNEL_FILTERS, statuses: ['floor', 'pace'] });
    expect(out.map((r) => r.id)).toEqual(['slow', 'low']);
  });

  // NEGATIVE CONTROL — an unbanded row must never satisfy an active STATUS
  // condition, for ANY band, including 'ontrack'.
  it('a row with no statusBand is excluded by every band selection', () => {
    for (const band of ['ontrack', 'pace', 'quiet', 'report', 'persistency', 'floor']) {
      const out = applyFunnelFilters(BAND_ROWS, { ...DEFAULT_FUNNEL_FILTERS, statuses: [band] });
      expect(out.some((r) => r.id === 'none')).toBe(false);
    }
  });

  // NEGATIVE CONTROL — selecting a band nothing holds empties the table rather
  // than silently falling back to "show everything".
  it('a band no row holds yields an empty result', () => {
    expect(applyFunnelFilters(BAND_ROWS, { ...DEFAULT_FUNNEL_FILTERS, statuses: ['persistency'] })).toEqual([]);
  });

  it('STATUS composes as AND with the other families', () => {
    const out = applyFunnelFilters(BAND_ROWS, {
      ...DEFAULT_FUNNEL_FILTERS, statuses: ['quiet', 'floor'], unit: 'unit-y', reports: ['draft'],
    });
    expect(out.map((r) => r.id)).toEqual(['quiet']);
  });

  it('matchesFunnelFilters is the single-row form of the same rule', () => {
    const f = { ...DEFAULT_FUNNEL_FILTERS, statuses: ['pace'] };
    expect(matchesFunnelFilters(BAND_ROWS[1], f)).toBe(true);
    expect(matchesFunnelFilters(BAND_ROWS[0], f)).toBe(false);
    expect(matchesFunnelFilters(BAND_ROWS[4], f)).toBe(false);
  });

  it('each selected band adds one to the active-condition count', () => {
    expect(funnelFiltersCount(DEFAULT_FUNNEL_FILTERS)).toBe(0);
    expect(funnelFiltersCount({ ...DEFAULT_FUNNEL_FILTERS, statuses: ['floor'] })).toBe(1);
    expect(funnelFiltersCount({ ...DEFAULT_FUNNEL_FILTERS, statuses: ['floor', 'pace'] })).toBe(2);
    expect(funnelFiltersCount({
      ...DEFAULT_FUNNEL_FILTERS, statuses: ['floor'], unit: 'unit-x', reports: ['draft'], noLog: true,
    })).toBe(4);
  });

  it('emits one dismissible STATUS chip that clears only its own condition', () => {
    const chips = buildFilterChips({ ...DEFAULT_FUNNEL_FILTERS, statuses: ['floor', 'quiet'] }, []);
    expect(chips.map((c) => c.key)).toEqual(['status']);
    expect(chips[0].text).toBe('STATUS · BELOW FLOOR / GONE QUIET');
    expect(chips[0].patch).toEqual({ statuses: [] });
  });

  it('the STATUS chip falls back to the raw key when the band is unknown', () => {
    const chips = buildFilterChips({ ...DEFAULT_FUNNEL_FILTERS, statuses: ['mystery'] }, []);
    expect(chips[0].text).toBe('STATUS · MYSTERY');
  });
});
