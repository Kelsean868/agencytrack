import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  deriveYearProduction,
  awardRowsFromLedger,
  settledCreditList,
  GENERAL_CREDIT_TABLE,
} from '../ledgerProduction';
import { settledProvenance, provenanceLine, isFromHeadOffice } from '../settledProvenance';

// P2d · audit 2026-09-24 BUG-04 — one YTD production loop.
//
// The home hero (`deriveYearProduction`) and the Awards tab
// (`awardRowsFromLedger`) now read the SAME per-policy credit list
// (`settledCreditList`). The one documented difference is presentation, not a
// rule: self/family business counts in the hero and sits in its own column of
// the award rows (`selfFamilyAPI` / `selfFamilyApps`, Kyron 23 Sep 2026). So for
// any ledger and any year:
//
//   hero.settled.api  == Σ award rows in that year (settledAPI  + selfFamilyAPI)
//   hero.settled.apps == Σ award rows in that year (settledApps + selfFamilyApps)
//
// Mutation-verified (docs/agents/test-and-lint-notes.md): dropping the
// self/family column from the sum, or giving either function its own settled
// test again, turns this property red.

const YEARS = [2024, 2025, 2026, 2027];
const STATUSES = ['written', 'submitted', 'rated', 'postponed', 'settled', 'ntu', 'denied', 'lapsed'];
const SOURCES = ['oipa_import', 'agent', 'manager', undefined];
const NB_TYPES = Object.keys(GENERAL_CREDIT_TABLE);

const dateArb = fc.oneof(
  fc.constant(null),
  fc.tuple(fc.constantFrom(...YEARS), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }))
    .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`),
  // Firestore Timestamp shape, stored at TT midnight (04:00Z) as the app writes it
  fc.tuple(fc.constantFrom(...YEARS), fc.integer({ min: 0, max: 11 }), fc.integer({ min: 1, max: 28 }))
    .map(([y, m, d]) => ({ toDate: () => new Date(Date.UTC(y, m, d, 4)) })),
);

const policyArb = fc.record({
  id: fc.uuid(),
  status: fc.constantFrom(...STATUSES),
  statusSource: fc.constantFrom(...SOURCES),
  productLine: fc.constantFrom('life', 'ah', undefined),
  newBusinessType: fc.constantFrom(...NB_TYPES),
  proposedAPI: fc.integer({ min: 0, max: 120000 }),
  settledAPI: fc.option(fc.integer({ min: 1, max: 120000 }), { nil: null }),
  replacedPolicyAPI: fc.option(fc.integer({ min: 0, max: 60000 }), { nil: undefined }),
  isSelfOrFamily: fc.boolean(),
  confirmedAt: fc.option(fc.constant('2026-09-01T12:00:00Z'), { nil: undefined }),
  dateIssued: dateArb,
});

function awardsYearTotals(policies, year) {
  const rows = awardRowsFromLedger(policies).filter((r) => r.periodKey.startsWith(`${year}-`));
  return rows.reduce((acc, r) => ({
    api: acc.api + r.settledAPI + r.selfFamilyAPI,
    apps: acc.apps + r.settledApps + r.selfFamilyApps,
  }), { api: 0, apps: 0 });
}

describe('P2d BUG-04 — hero YTD settled == awards YTD settled (self + family included)', () => {
  it('property: for any ledger and year the two surfaces agree on API and apps', () => {
    fc.assert(
      fc.property(fc.array(policyArb, { maxLength: 40 }), fc.constantFrom(...YEARS), (policies, year) => {
        const hero = deriveYearProduction(policies, { year }).settled;
        const awards = awardsYearTotals(policies, year);
        expect(hero.api).toBeCloseTo(awards.api, 2);
        expect(hero.apps).toBe(awards.apps);
      }),
      { numRuns: 400 },
    );
  });

  it('property: the provenance split always sums to the settled count', () => {
    fc.assert(
      fc.property(fc.array(policyArb, { maxLength: 40 }), fc.constantFrom(...YEARS), (policies, year) => {
        const s = deriveYearProduction(policies, { year }).settled;
        expect(s.fromHeadOffice + s.selfConfirmed).toBe(s.count);
      }),
      { numRuns: 200 },
    );
  });

  it('a concrete ledger: self/family moves column, never disappears', () => {
    const policies = [
      { status: 'settled', statusSource: 'oipa_import', dateIssued: '2026-08-04', proposedAPI: 36000, newBusinessType: 'nb_ordinary' },
      { status: 'settled', statusSource: 'agent',       dateIssued: '2026-08-07', proposedAPI: 1200,  newBusinessType: 'nb_ordinary', isSelfOrFamily: true },
      { status: 'settled', statusSource: 'agent',       dateIssued: '2025-12-31', proposedAPI: 9000,  newBusinessType: 'nb_ordinary' },
      { status: 'submitted', statusSource: 'agent',     dateIssued: '2026-08-10', proposedAPI: 7000,  newBusinessType: 'nb_ordinary' },
    ];
    const hero = deriveYearProduction(policies, { year: 2026 }).settled;
    expect(hero).toMatchObject({ api: 37200, apps: 2, count: 2, fromHeadOffice: 1, selfConfirmed: 1 });
    const aug = awardRowsFromLedger(policies).find((r) => r.periodKey === '2026-08');
    expect(aug).toMatchObject({ settledAPI: 36000, settledApps: 1, selfFamilyAPI: 1200, selfFamilyApps: 1 });
  });
});

describe('P2d — settledCreditList (the one per-policy credit list)', () => {
  it('keeps only Life, settled-or-confirmed, dated policies', () => {
    const list = settledCreditList([
      { id: 'a', status: 'settled', dateIssued: '2026-03-01', proposedAPI: 1000, newBusinessType: 'nb_ordinary' },
      { id: 'b', status: 'settled', productLine: 'ah', dateIssued: '2026-03-01', proposedAPI: 1000 },
      { id: 'c', status: 'submitted', dateIssued: '2026-03-01', proposedAPI: 1000 },
      { id: 'd', status: 'settled', dateIssued: null, proposedAPI: 1000 },
      { id: 'e', status: 'lapsed', confirmedAt: 'x', dateIssued: '2026-04-02', proposedAPI: 500, newBusinessType: 'nb_ordinary' },
      null,
    ]);
    expect(list.map((e) => e.policy.id)).toEqual(['a', 'e']);
    expect(list[0]).toMatchObject({ issued: '2026-03-01', periodKey: '2026-03', credit: { api: 1000, apps: 1 } });
  });
});

describe('P2d — settledProvenance / provenanceLine (one helper for every surface)', () => {
  it('counts head office vs everyone else', () => {
    const counts = settledProvenance([
      { statusSource: 'oipa_import' },
      { statusSource: 'oipa_import' },
      { statusSource: 'agent' },
      { statusSource: 'manager' },
      {},
      null,
    ]);
    expect(counts).toEqual({ count: 5, fromHeadOffice: 2, selfConfirmed: 3 });
    expect(provenanceLine(counts)).toBe('2 from head office · 3 self-confirmed');
  });

  it('says nothing when nothing is settled', () => {
    expect(provenanceLine(settledProvenance([]))).toBeNull();
    expect(provenanceLine(null)).toBeNull();
  });

  it('isFromHeadOffice reads statusSource, not importSource', () => {
    expect(isFromHeadOffice({ importSource: 'oipa_import', statusSource: 'agent' })).toBe(false);
    expect(isFromHeadOffice({ statusSource: 'oipa_import' })).toBe(true);
  });
});
