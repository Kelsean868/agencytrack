import { describe, it, expect } from 'vitest';
import {
  toDisplayDate,
  toStoredDate,
  humanizeToken,
  buildFilterSections,
  emptyFilterState,
  hasActiveFilters,
  matchesFilters,
  filterRows,
  optionCounts,
  SORTS,
  sortRows,
  builtInViews,
  footerCounts,
} from '../ledgerFilters';

function row(overrides = {}) {
  return {
    policy: {
      id: overrides.id ?? 'p1',
      ownerName: 'Alice',
      policyClass: 'whole_life',
      proposedFrequency: 'M',
      status: 'settled',
      statusSource: 'agent',
      isSelfOrFamily: false,
      dateIssued: '2026-08-12',
      dateSubmitted: '2026-08-02',
      settledAPI: 24600,
      ...overrides.policy,
    },
    group: overrides.group ?? 'counting',
    credit: overrides.credit ?? { api: 24600, apps: 1 },
    reason: overrides.reason ?? 'Settled — counts',
    hoFlag: overrides.hoFlag ?? false,
  };
}

describe('date display/stored round trip', () => {
  it('converts YYYY-MM-DD to DD-MM-YYYY', () => {
    expect(toDisplayDate('2026-08-12')).toBe('12-08-2026');
  });
  it('converts DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(toStoredDate('12-08-2026')).toBe('2026-08-12');
  });
  it('returns empty/null for unparseable input', () => {
    expect(toDisplayDate(null)).toBe('');
    expect(toDisplayDate('not-a-date')).toBe('');
    expect(toStoredDate('2026-08-12')).toBeNull();
    expect(toStoredDate('31-13-2026')).toBeNull();
    expect(toStoredDate(undefined)).toBeNull();
  });
});

describe('humanizeToken', () => {
  it('title-cases underscore tokens', () => {
    expect(humanizeToken('whole_life')).toBe('Whole Life');
    expect(humanizeToken('critical_illness')).toBe('Critical Illness');
  });
  it('handles empty input', () => {
    expect(humanizeToken(null)).toBe('Unspecified');
    expect(humanizeToken('')).toBe('Unspecified');
  });
});

describe('buildFilterSections — dynamic Product/Frequency options', () => {
  it('derives Product/Frequency options only from values actually present', () => {
    const rows = [
      row({ id: 'a', policy: { policyClass: 'term', proposedFrequency: 'M' } }),
      row({ id: 'b', policy: { policyClass: 'whole_life', proposedFrequency: 'A' } }),
    ];
    const sections = buildFilterSections(rows);
    const product = sections.find((s) => s.key === 'product');
    const freq = sections.find((s) => s.key === 'frequency');
    expect(product.options.map((o) => o.value).sort()).toEqual(['term', 'whole_life']);
    expect(freq.options.map((o) => o.value).sort()).toEqual(['A', 'M']);
  });

  it('never surfaces a hidden section (needs attention / paid-to)', () => {
    const sections = buildFilterSections([]);
    expect(sections.map((s) => s.key)).not.toContain('needsAttention');
  });
});

describe('matchesFilters / filterRows', () => {
  const rows = [
    row({ id: 'counting', group: 'counting', policy: { status: 'settled', statusSource: 'oipa_import' } }),
    row({ id: 'pending', group: 'pending', policy: { status: 'submitted', statusSource: 'agent', settledAPI: 0 }, credit: { api: 0, apps: 0 } }),
    row({ id: 'not', group: 'not', policy: { status: 'ntu', statusSource: 'agent', settledAPI: 0 }, credit: { api: 0, apps: 0 } }),
  ];
  const sections = buildFilterSections(rows);

  it('with no active filters, everything matches', () => {
    expect(filterRows(rows, emptyFilterState(), sections)).toHaveLength(3);
  });

  it('countsGroup filters by the lens-assigned group, not a re-derivation', () => {
    const state = { ...emptyFilterState(), countsGroup: new Set(['counting']) };
    const result = filterRows(rows, state, sections);
    expect(result.map((r) => r.policy.id)).toEqual(['counting']);
  });

  it('source: head office vs self-confirmed uses statusSource, not a guess', () => {
    const state = { ...emptyFilterState(), source: new Set(['ho']) };
    expect(filterRows(rows, state, sections).map((r) => r.policy.id)).toEqual(['counting']);
  });

  it('source: "not on head-office list" reads row.hoFlag, never re-derives it', () => {
    const flagged = [...rows, row({ id: 'flagged', hoFlag: true })];
    const s = buildFilterSections(flagged);
    const state = { ...emptyFilterState(), source: new Set(['notOnHo']) };
    expect(filterRows(flagged, state, s).map((r) => r.policy.id)).toEqual(['flagged']);
  });

  it('who: clients vs family/self', () => {
    const withFamily = [...rows, row({ id: 'family', policy: { isSelfOrFamily: true } })];
    const s = buildFilterSections(withFamily);
    const state = { ...emptyFilterState(), who: new Set(['family']) };
    expect(filterRows(withFamily, state, s).map((r) => r.policy.id)).toEqual(['family']);
  });

  it('status filter is exact and multi-select (OR within the section)', () => {
    const state = { ...emptyFilterState(), status: new Set(['settled', 'ntu']) };
    expect(filterRows(rows, state, sections).map((r) => r.policy.id).sort()).toEqual(['counting', 'not']);
  });

  it('date range filters on issue date by default, inclusive bounds', () => {
    const state = { ...emptyFilterState(), dateFrom: '2026-08-12', dateTo: '2026-08-12' };
    expect(filterRows(rows, state, sections)).toHaveLength(3); // all share dateIssued
    const state2 = { ...emptyFilterState(), dateFrom: '2026-08-13' };
    expect(filterRows(rows, state2, sections)).toHaveLength(0);
  });

  it('date range filters on submit date when dateType is "submit"', () => {
    const mixed = [
      row({ id: 'x', policy: { dateSubmitted: '2026-01-01', dateIssued: '2026-08-12' } }),
    ];
    const s = buildFilterSections(mixed);
    const state = { ...emptyFilterState(), dateType: 'submit', dateFrom: '2026-01-01', dateTo: '2026-01-01' };
    expect(filterRows(mixed, state, s)).toHaveLength(1);
    const state2 = { ...emptyFilterState(), dateType: 'submit', dateFrom: '2026-02-01' };
    expect(filterRows(mixed, state2, s)).toHaveLength(0);
  });

  it('a policy with no date in the filtered dimension never matches a bound', () => {
    const missing = [row({ id: 'nodate', policy: { dateIssued: null } })];
    const s = buildFilterSections(missing);
    const state = { ...emptyFilterState(), dateFrom: '2000-01-01' };
    expect(filterRows(missing, state, s)).toHaveLength(0);
  });

  it('API min/max is inclusive and reads policyValue (settledAPI fallback chain)', () => {
    const state = { ...emptyFilterState(), apiMin: 24600, apiMax: 24600 };
    expect(filterRows(rows, state, sections).map((r) => r.policy.id)).toEqual(['counting']);
  });

  it('combines sections with AND, options within a section with OR', () => {
    const state = { ...emptyFilterState(), countsGroup: new Set(['counting', 'not']), status: new Set(['ntu']) };
    expect(filterRows(rows, state, sections).map((r) => r.policy.id)).toEqual(['not']);
  });

  it('empty-filter match returns every row unchanged and matches the empty-filters state', () => {
    const rowsMatchAll = rows.every((r) => matchesFilters(r, emptyFilterState(), sections));
    expect(rowsMatchAll).toBe(true);
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty state', () => {
    expect(hasActiveFilters(emptyFilterState())).toBe(false);
  });
  it('is true once any tag section is populated', () => {
    expect(hasActiveFilters({ ...emptyFilterState(), status: new Set(['settled']) })).toBe(true);
  });
  it('is true once a date bound or API bound is set', () => {
    expect(hasActiveFilters({ ...emptyFilterState(), apiMin: 1 })).toBe(true);
    expect(hasActiveFilters({ ...emptyFilterState(), dateFrom: '2026-01-01' })).toBe(true);
  });
});

describe('optionCounts', () => {
  it('counts reflect every OTHER active section but not the section itself', () => {
    const rows2 = [
      row({ id: 'a', group: 'counting', policy: { status: 'settled' } }),
      row({ id: 'b', group: 'pending', policy: { status: 'submitted' } }),
      row({ id: 'c', group: 'not', policy: { status: 'settled' } }),
    ];
    const sections = buildFilterSections(rows2);
    const state = { ...emptyFilterState(), status: new Set(['settled']) };
    const counts = optionCounts(rows2, state, sections, 'countsGroup');
    // status=settled narrows to a,c -> counting:1, not:1, pending:0
    expect(counts).toEqual({ counting: 1, pending: 0, not: 1 });
  });
});

describe('sort comparators', () => {
  it('newest issued first — descending, missing dates sort last regardless of direction', () => {
    const rows3 = [
      row({ id: 'old', policy: { dateIssued: '2026-01-01' } }),
      row({ id: 'new', policy: { dateIssued: '2026-09-01' } }),
      row({ id: 'none', policy: { dateIssued: null } }),
    ];
    expect(sortRows(rows3, 'issuedDesc').map((r) => r.policy.id)).toEqual(['new', 'old', 'none']);
  });

  it('newest submitted first', () => {
    const rows3 = [
      row({ id: 'old', policy: { dateSubmitted: '2026-01-01', dateWritten: null } }),
      row({ id: 'new', policy: { dateSubmitted: '2026-09-01', dateWritten: null } }),
    ];
    expect(sortRows(rows3, 'submittedDesc').map((r) => r.policy.id)).toEqual(['new', 'old']);
  });

  it('API high to low and low to high', () => {
    const rows3 = [
      row({ id: 'lo', policy: { settledAPI: 1000 } }),
      row({ id: 'hi', policy: { settledAPI: 9000 } }),
    ];
    expect(sortRows(rows3, 'apiDesc').map((r) => r.policy.id)).toEqual(['hi', 'lo']);
    expect(sortRows(rows3, 'apiAsc').map((r) => r.policy.id)).toEqual(['lo', 'hi']);
  });

  it('client name A-Z, case-insensitive-ish via localeCompare', () => {
    const rows3 = [
      row({ id: 'z', policy: { ownerName: 'Zoe' } }),
      row({ id: 'a', policy: { ownerName: 'Aaron' } }),
    ];
    expect(sortRows(rows3, 'nameAsc').map((r) => r.policy.id)).toEqual(['a', 'z']);
  });

  it('ties keep a stable relative order (no comparator returns garbage on equal values)', () => {
    const rows3 = [
      row({ id: 'first', policy: { settledAPI: 500 } }),
      row({ id: 'second', policy: { settledAPI: 500 } }),
    ];
    expect(sortRows(rows3, 'apiDesc').map((r) => r.policy.id)).toEqual(['first', 'second']);
  });

  it('an unknown sort key falls back to the default rather than throwing', () => {
    expect(() => sortRows([row()], 'not-a-real-key')).not.toThrow();
  });

  it('exposes exactly the brief-listed sorts, no undeliverable "next premium due"', () => {
    expect(SORTS.map((s) => s.key)).toEqual(['issuedDesc', 'submittedDesc', 'apiDesc', 'apiAsc', 'nameAsc']);
  });
});

describe('built-in saved views', () => {
  it('always includes "All policies"', () => {
    const views = builtInViews({});
    expect(views.map((v) => v.id)).toContain('__all__');
  });
  it('includes the ★ campaign view only when a campaign exists', () => {
    expect(builtInViews({}).map((v) => v.id)).not.toContain('__campaign__');
    expect(builtInViews({ hasCampaign: true }).map((v) => v.id)).toContain('__campaign__');
  });
  it('never includes "Needs confirming" or "Lapse risk" (no backing signal)', () => {
    const ids = builtInViews({ hasCampaign: true }).map((v) => v.id);
    expect(ids).not.toContain('__needsConfirming__');
    expect(ids).not.toContain('__lapseRisk__');
  });
});

describe('footerCounts', () => {
  it('sums per-group counts and the counting API total', () => {
    const rows3 = [
      row({ id: 'a', group: 'counting', credit: { api: 100, apps: 1 } }),
      row({ id: 'b', group: 'counting', credit: { api: 200, apps: 1 } }),
      row({ id: 'c', group: 'pending', credit: { api: 0, apps: 0 } }),
      row({ id: 'd', group: 'not', credit: { api: 0, apps: 0 } }),
    ];
    expect(footerCounts(rows3)).toEqual({ total: 4, counting: 2, pending: 1, notCounting: 1, countingApi: 300 });
  });
  it('handles an empty filtered set', () => {
    expect(footerCounts([])).toEqual({ total: 0, counting: 0, pending: 0, notCounting: 0, countingApi: 0 });
  });
});
