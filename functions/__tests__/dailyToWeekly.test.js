'use strict';

const { aggregateDailyToWeekly } = require('../aggregators/dailyToWeekly');

describe('aggregateDailyToWeekly', () => {
  test('returns zero-filled report for empty entries array', () => {
    const result = aggregateDailyToWeekly([]);
    expect(result.qualifiedApproaches).toBe(0);
    expect(result.ffiConducted).toBe(0);
    expect(result.newBusiness.api).toBe(0);
    expect(result.aggregatedFromDaily).toBe(true);
    expect(result.version).toBe(2);
  });

  test('sums integer activity fields across multiple daily entries', () => {
    const entries = [
      { qualifiedApproaches: 3, ffiConducted: 1, ciConducted: 0 },
      { qualifiedApproaches: 2, ffiConducted: 2, ciConducted: 1 },
    ];
    const result = aggregateDailyToWeekly(entries);
    expect(result.qualifiedApproaches).toBe(5);
    expect(result.ffiConducted).toBe(3);
    expect(result.ciConducted).toBe(1);
  });

  test('sums nested newBusiness api correctly', () => {
    const entries = [
      { newBusiness: { apps: 2, api: 5000 } },
      { newBusiness: { apps: 1, api: 3000 } },
    ];
    const result = aggregateDailyToWeekly(entries);
    expect(result.newBusiness.apps).toBe(3);
    expect(result.newBusiness.api).toBe(8000);
  });

  test('computes lumpsum credit (10%) and commission (0.5%) from grossAmount', () => {
    const entries = [{ lumpsums: { grossAmount: 10000 } }];
    const result = aggregateDailyToWeekly(entries);
    expect(result.lumpsums.apiCredit).toBeCloseTo(1000);
    expect(result.lumpsums.commission).toBeCloseTo(50);
  });

  test('totalProductionCredit sums newBusiness api + ppp apiIncrease + lumpsums apiCredit', () => {
    const entries = [
      {
        newBusiness: { api: 5000 },
        pppIncreases: { apiIncrease: 1000 },
        lumpsums: { grossAmount: 10000 }, // apiCredit = 1000
      },
    ];
    const result = aggregateDailyToWeekly(entries);
    expect(result.totalProductionCredit).toBeCloseTo(7000);
  });

  test('handles null/undefined entries gracefully', () => {
    expect(() => aggregateDailyToWeekly(null)).not.toThrow();
    expect(() => aggregateDailyToWeekly(undefined)).not.toThrow();
    expect(aggregateDailyToWeekly(null).qualifiedApproaches).toBe(0);
  });

  test('totalCommission uses commissionRate / 100 applied to newBusiness.api + lumpsum commission', () => {
    const entries = [
      { newBusiness: { api: 10000 }, lumpsums: { grossAmount: 0 } },
    ];
    const result = aggregateDailyToWeekly(entries, 10); // 10% commission rate
    // nbApi * (10/100) + lumpsumCommission = 10000 * 0.1 + 0 = 1000
    expect(result.totalCommission).toBeCloseTo(1000);
  });

  // ── DCv2 Phase 5: emergent days-worked + weekend signals ────────────────────
  // MUST stay in sync with the ESM twin's cases (src/lib/schema/dailyActivity.test.js).
  // Week of Sun 2026-05-10 (opening Sunday) … Sat 2026-05-16.
  test('empty week → daysWorked 0, weekendWorked false, weekendApi 0', () => {
    const out = aggregateDailyToWeekly([], 35);
    expect(out.daysWorked).toBe(0);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });

  test('5 weekday-only days → daysWorked 5, weekendWorked false', () => {
    const days = ['2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15']
      .map((date) => ({ date, qualifiedApproaches: 1 }));
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(5);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });

  test('opening-Sunday-only week → weekendWorked true (TT-anchored)', () => {
    const out = aggregateDailyToWeekly([{ date: '2026-05-10', qualifiedApproaches: 2 }], 35);
    expect(out.daysWorked).toBe(1);
    expect(out.weekendWorked).toBe(true);
  });

  test('Saturday-only week → weekendWorked true', () => {
    const out = aggregateDailyToWeekly([{ date: '2026-05-16', qualifiedApproaches: 2 }], 35);
    expect(out.daysWorked).toBe(1);
    expect(out.weekendWorked).toBe(true);
  });

  test('full 7-day week → daysWorked 7, weekendWorked true', () => {
    const days = [
      '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13',
      '2026-05-14', '2026-05-15', '2026-05-16',
    ].map((date) => ({ date, qualifiedApproaches: 1 }));
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(7);
    expect(out.weekendWorked).toBe(true);
  });

  test('two docs on the same date count once (distinct-date dedupe guard)', () => {
    const days = [
      { date: '2026-05-12', qualifiedApproaches: 1 },
      { date: '2026-05-12', qualifiedApproaches: 1 },
    ];
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.daysWorked).toBe(1);
  });

  test('weekendApi sums NB.api + PPP.apiIncrease + LMPS credit from weekend entries only', () => {
    const days = [
      { date: '2026-05-16', newBusiness: { api: 5000 }, pppIncreases: { apiIncrease: 2000 }, lumpsums: { grossAmount: 10000 } },
      { date: '2026-05-15', newBusiness: { api: 3000 } },
    ];
    const out = aggregateDailyToWeekly(days, 35);
    expect(out.weekendApi).toBeCloseTo(8000, 6);
    expect(out.totalProductionCredit).toBeCloseTo(5000 + 3000 + 2000 + 1000, 6);
    expect(out.weekendWorked).toBe(true);
    expect(out.daysWorked).toBe(2);
  });

  test('entries without a date field contribute 0 distinct days and do not crash', () => {
    const out = aggregateDailyToWeekly([{ qualifiedApproaches: 5 }], 35);
    expect(out.daysWorked).toBe(0);
    expect(out.weekendWorked).toBe(false);
    expect(out.weekendApi).toBe(0);
  });
});

// ── M3 points-fix: coldCalls === dials parity (CJS twin) ─────────────────────
// MUST stay in sync with the ESM twin's M3 cases (src/lib/schema/dailyActivity.test.js).
// computePoints is ESM-only; point-value assertions live in the ESM test.
describe('aggregateDailyToWeekly CJS twin — M3 coldCalls parity', () => {
  test('coldCalls equals the summed dials total', () => {
    const out = aggregateDailyToWeekly([{ dials: 10 }, { dials: 15 }], 0);
    expect(out.dials).toBe(25);
    expect(out.coldCalls).toBe(25);
  });

  test('coldCalls equals dials when dials is 0 (safe zero)', () => {
    const out = aggregateDailyToWeekly([], 0);
    expect(out.coldCalls).toBe(0);
    expect(out.dials).toBe(0);
  });

  test('referralCalls / followUpCalls / seminarTradeshowCalls explicitly 0 — merge-safe', () => {
    const out = aggregateDailyToWeekly([{ dials: 5 }], 0);
    // Explicit zeros overwrite stale agent-entered values via { merge: true }
    expect(out.referralCalls).toBe(0);
    expect(out.followUpCalls).toBe(0);
    expect(out.seminarTradeshowCalls).toBe(0);
  });

  test('explicit zeros prevent double-count when prior doc had agent-entered call breakdown', () => {
    // Mirrors ESM twin test. computePoints is ESM-only; assert the shape is
    // merge-safe so the ESM point-value assertion is the authoritative proof.
    const out = aggregateDailyToWeekly([{ dials: 8 }], 0);
    expect(out.referralCalls).toBe(0);
    expect(out.followUpCalls).toBe(0);
    expect(out.seminarTradeshowCalls).toBe(0);
    expect(out.coldCalls).toBe(8);
  });
});

// ── Daily v2 — call-type split, serviceCalls, referralsObtained (CJS twin) ────
// Behaviour parity with src/lib/schema/dailyActivity.aggregator.js. The twins
// are NOT byte-identical (idiom differs); these assertions pin the behaviour.

describe('aggregateDailyToWeekly CJS twin — daily v2 call split', () => {
  test('pre-v2 docs aggregate exactly as before (coldCalls = sum of dials)', () => {
    const out = aggregateDailyToWeekly([{ dials: 10 }, { dials: 15 }], 0);
    expect(out.dials).toBe(25);
    expect(out.coldCalls).toBe(25);
    expect(out.referralCalls).toBe(0);
    expect(out.followUpCalls).toBe(0);
    expect(out.seminarTradeshowCalls).toBe(0);
  });

  test('an all-zero dialsByType falls back to cold', () => {
    const out = aggregateDailyToWeekly(
      [{ dials: 9, dialsByType: { cold: 0, referral: 0, followUp: 0, seminarTradeshow: 0 } }],
      0
    );
    expect(out.coldCalls).toBe(9);
    expect(out.referralCalls).toBe(0);
  });

  test('maps a v2 breakdown onto the four weekly call fields', () => {
    const out = aggregateDailyToWeekly(
      [{ dials: 10, dialsByType: { cold: 4, referral: 3, followUp: 2, seminarTradeshow: 1 } }],
      0
    );
    expect(out.dials).toBe(10);
    expect(out.coldCalls).toBe(4);
    expect(out.referralCalls).toBe(3);
    expect(out.followUpCalls).toBe(2);
    expect(out.seminarTradeshowCalls).toBe(1);
  });

  test('preserves the total in a mixed week (per-entry fallback)', () => {
    const out = aggregateDailyToWeekly(
      [
        { dials: 6 },
        { dials: 10, dialsByType: { cold: 4, referral: 3, followUp: 2, seminarTradeshow: 1 } },
      ],
      0
    );
    expect(out.dials).toBe(16);
    expect(
      out.coldCalls + out.referralCalls + out.followUpCalls + out.seminarTradeshowCalls
    ).toBe(16);
    expect(out.coldCalls).toBe(10);
  });

  test('sums serviceCalls and referralsObtained; serviceCalls is NOT serviceContacts', () => {
    const out = aggregateDailyToWeekly(
      [
        { serviceCalls: 3, serviceContacts: 1, referralsObtained: 2 },
        { serviceCalls: 4, serviceContacts: 2, referralsObtained: 1 },
      ],
      0
    );
    expect(out.serviceCalls).toBe(7);
    expect(out.serviceContacts).toBe(3);
    expect(out.referralsObtained).toBe(3);
  });

  test('serviceCalls is absent when only serviceContacts is present', () => {
    const out = aggregateDailyToWeekly([{ serviceContacts: 9 }], 0);
    expect(out.serviceContacts).toBe(9);
    // Absent, not 0 — the omit-when-zero guard.
    expect(out).not.toHaveProperty('serviceCalls');
  });
});

// -- the omit-when-zero guard (CJS twin) --------------------------------------
//
// serviceCalls and referralsObtained are the ONLY two keys this aggregator
// conditionally omits. Neither has a daily writer yet (the KQM Calls ingest
// endpoint is unbuilt), so emitting a derived 0 into a { merge: true } write
// would erase an agent-entered weekly value and put nothing in its place.
// referralsObtained is worth 3pt, so the loss is visible on the score.

describe('aggregateDailyToWeekly - omit-when-zero guard', () => {
  test('omits both keys when no entry carries them', () => {
    const out = aggregateDailyToWeekly([{ dials: 5 }], 0);
    expect(out).not.toHaveProperty('serviceCalls');
    expect(out).not.toHaveProperty('referralsObtained');
  });

  test('omits both keys when every entry carries an explicit 0', () => {
    const out = aggregateDailyToWeekly([{ dials: 5, serviceCalls: 0, referralsObtained: 0 }], 0);
    expect(out).not.toHaveProperty('serviceCalls');
    expect(out).not.toHaveProperty('referralsObtained');
  });

  test('emits the summed value once any entry carries a non-zero', () => {
    const out = aggregateDailyToWeekly(
      [
        { serviceCalls: 2, referralsObtained: 1 },
        { serviceCalls: 1, referralsObtained: 0 },
      ],
      0
    );
    expect(out.serviceCalls).toBe(3);
    expect(out.referralsObtained).toBe(1);
  });

  test('a merge of the zero-case leaves agent-entered values intact', () => {
    const priorDraft = { serviceCalls: 4, referralsObtained: 2, coldCalls: 99 };
    const merged = Object.assign({}, priorDraft, aggregateDailyToWeekly([{ dials: 8 }], 0));
    expect(merged.serviceCalls).toBe(4);
    expect(merged.referralsObtained).toBe(2);
    // The four call fields still overwrite - deliberately always written.
    expect(merged.coldCalls).toBe(8);
  });

  test('a merge of the non-zero case overwrites the agent-entered value', () => {
    const priorDraft = { serviceCalls: 4, referralsObtained: 2 };
    const merged = Object.assign(
      {},
      priorDraft,
      aggregateDailyToWeekly([{ serviceCalls: 1, referralsObtained: 7 }], 0)
    );
    expect(merged.serviceCalls).toBe(1);
    expect(merged.referralsObtained).toBe(7);
  });
});
