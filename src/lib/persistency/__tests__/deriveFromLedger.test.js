import { describe, it, expect } from 'vitest';

import {
  deriveFromLedger,
  wasPlaced,
  lapseStillCounts,
  isStaleAnnuity,
  PERSISTENCY_LEDGER_WINDOW_MONTHS,
  ANNUITY_PAID_TO_GRACE_DAYS,
  ANNUITY_MISSED_PREMIUM_RULES,
  DEFAULT_ANNUITY_MISSED_PREMIUM_RULE,
  LEDGER_MANUAL_INPUTS,
} from '../deriveFromLedger';
import { deriveAll } from '../calculations';

/**
 * SYNTHETIC ledger docs. The real 15 Sep export holds client names and never
 * enters this repo; the real-file five-row paste-back lives in the PR description.
 */

const EXPORT_DATE = '2026-09-15';
const OPTS = { monthKey: '2026-09', exportDate: EXPORT_DATE };

/** A placed, in-window, writing-agent policy. Override only what a test needs. */
function doc(overrides = {}) {
  return {
    policyNumber: 'TST0000001',
    status: 'settled',
    oipaStatus: 'Active',
    oipaSubStatus: 'Premium Paying',
    policyClass: 'whole_life',
    proposedAPI: 1000,
    totalPremiumPaid: null,
    dateIssued: '2026-01-15',
    paidToDate: '2026-10-01',
    isWritingAgent: true,
    ...overrides,
  };
}

describe('deriveFromLedger — the 24-month window', () => {
  it('has one constant, and it counts the report month itself', () => {
    expect(PERSISTENCY_LEDGER_WINDOW_MONTHS).toBe(24);
    const r = deriveFromLedger([], OPTS);
    expect(r.window).toEqual({ startMonth: '2024-10', endMonth: '2026-09', windowMonths: 24 });
  });

  it('answers the open CRO question by widening the window, not by editing the default', () => {
    // Brief open question 2: is Sep 2024 inside the Sep 2026 window? 25 months says yes.
    const r = deriveFromLedger([], { ...OPTS, windowMonths: 25 });
    expect(r.window.startMonth).toBe('2024-09');
  });

  it('walks the window back correctly across a year boundary', () => {
    const r = deriveFromLedger([], { ...OPTS, monthKey: '2026-12' });
    expect(r.window.startMonth).toBe('2025-01');
  });

  it('includes both edge months and excludes the months either side', () => {
    const docs = [
      doc({ policyNumber: 'BEFORE0001', dateIssued: '2024-09-30' }),
      doc({ policyNumber: 'FIRST00001', dateIssued: '2024-10-01' }),
      doc({ policyNumber: 'LAST000001', dateIssued: '2026-09-30' }),
      doc({ policyNumber: 'AFTER00001', dateIssued: '2026-10-01' }),
    ];
    const r = deriveFromLedger(docs, OPTS);

    expect(r.evidence.businessPlaced).toEqual(['FIRST00001', 'LAST000001']);
    expect(r.evidence.excluded.outsideWindow.sort()).toEqual(['AFTER00001', 'BEFORE0001']);
  });

  it('excludes a doc with no issue date instead of treating it as in-window', () => {
    const r = deriveFromLedger([doc({ policyNumber: 'NODATE0001', dateIssued: null })], OPTS);
    expect(r.evidence.excluded.noIssueDate).toEqual(['NODATE0001']);
    expect(r.inputs.businessPlaced).toBe(0);
  });
});

describe('deriveFromLedger — only the writing agent (derivation rule 1)', () => {
  it('keeps orphans and inherited policies out of the denominator', () => {
    const docs = [
      doc({ policyNumber: 'MINE000001', isWritingAgent: true, proposedAPI: 1000 }),
      doc({ policyNumber: 'ORPHAN0001', isWritingAgent: false, proposedAPI: 9999 }),
    ];
    const r = deriveFromLedger(docs, OPTS);

    expect(r.inputs.businessPlaced).toBe(1000);
    expect(r.evidence.excluded.notWritingAgent).toEqual(['ORPHAN0001']);
    expect(r.counted).toBe(1);
  });

  it('treats a missing isWritingAgent as NOT the writing agent', () => {
    const r = deriveFromLedger([doc({ policyNumber: 'UNKNOWN001', isWritingAgent: undefined })], OPTS);
    expect(r.evidence.excluded.notWritingAgent).toEqual(['UNKNOWN001']);
  });
});

describe('wasPlaced — what enters Gross Settled (derivation rule 3)', () => {
  it('counts settled, lapsed and NTU-after-issue', () => {
    expect(wasPlaced(doc({ status: 'settled' }))).toBe(true);
    expect(wasPlaced(doc({ status: 'lapsed', oipaSubStatus: 'Lapsed' }))).toBe(true);
    expect(wasPlaced(doc({ status: 'settled', terminalReason: 'surrendered' }))).toBe(true);
    expect(wasPlaced(doc({ status: 'ntu', oipaSubStatus: 'Not Taken' }))).toBe(true);
    expect(wasPlaced(doc({ status: 'ntu', oipaSubStatus: 'Cancelled' }))).toBe(true);
  });

  it('excludes the never-placed NTUs', () => {
    expect(wasPlaced(doc({ status: 'ntu', oipaSubStatus: 'Withdrawn' }))).toBe(false);
    expect(wasPlaced(doc({ status: 'ntu', oipaSubStatus: 'Insufficient Premium' }))).toBe(false);
  });

  it('excludes denied', () => {
    expect(wasPlaced(doc({ status: 'denied', oipaSubStatus: 'NL' }))).toBe(false);
  });

  it('excludes a replaced doc whatever its status, so one sale is never counted twice', () => {
    expect(wasPlaced(doc({ status: 'ntu', replacedBy: 'DAN2602403' }))).toBe(false);
    expect(wasPlaced(doc({ status: 'settled', replacedBy: 'DAN2602403' }))).toBe(false);
    expect(wasPlaced(doc({ status: 'lapsed', replacedBy: 'DAN2602403' }))).toBe(false);
  });

  it('excludes anything still in the pipeline', () => {
    expect(wasPlaced(doc({ status: 'submitted' }))).toBe(false);
    expect(wasPlaced(doc({ status: 'written' }))).toBe(false);
    expect(wasPlaced(doc({ status: 'rated' }))).toBe(false);
    expect(wasPlaced(doc({ status: 'postponed' }))).toBe(false);
  });

  it('records each exclusion under its own reason', () => {
    const docs = [
      doc({ policyNumber: 'DENIED0001', status: 'denied' }),
      doc({ policyNumber: 'REPLACD001', status: 'ntu', replacedBy: 'OTHER00001' }),
      doc({ policyNumber: 'WITHDRW001', status: 'ntu', oipaSubStatus: 'Withdrawn' }),
      doc({ policyNumber: 'PIPELIN001', status: 'submitted' }),
    ];
    const r = deriveFromLedger(docs, OPTS);

    expect(r.evidence.excluded.denied).toEqual(['DENIED0001']);
    expect(r.evidence.excluded.replaced).toEqual(['REPLACD001']);
    expect(r.evidence.excluded.neverPlaced).toEqual(['WITHDRW001']);
    expect(r.evidence.excluded.stillInPipeline).toEqual(['PIPELIN001']);
    expect(r.inputs.businessPlaced).toBe(0);
  });
});

describe('deriveFromLedger — Not Takens (derivation rule 4)', () => {
  it('keys off the OIPA sub status, not the mapped ntu status', () => {
    const docs = [
      doc({ policyNumber: 'NOTTAKN001', status: 'ntu', oipaSubStatus: 'Not Taken', proposedAPI: 500 }),
      doc({ policyNumber: 'CANCELD001', status: 'ntu', oipaSubStatus: 'Cancelled', proposedAPI: 700 }),
    ];
    const r = deriveFromLedger(docs, OPTS);

    // Both were placed, so both are in the denominator...
    expect(r.inputs.businessPlaced).toBe(1200);
    // ...but only the Not Taken one is a Not Taken.
    expect(r.inputs.notTakens).toBe(500);
    expect(r.evidence.notTakens).toEqual(['NOTTAKN001']);
  });
});

describe('lapseStillCounts — the 24-month premium rule (derivation rule 5)', () => {
  it('counts a lapse that has not paid two years of premium', () => {
    expect(lapseStillCounts(doc({ proposedAPI: 1000, totalPremiumPaid: 1999 }))).toBe(true);
  });

  it('drops a lapse once totalPremiumPaid reaches 2 x API', () => {
    expect(lapseStillCounts(doc({ proposedAPI: 1000, totalPremiumPaid: 2000 }))).toBe(false);
    expect(lapseStillCounts(doc({ proposedAPI: 1000, totalPremiumPaid: 2500 }))).toBe(false);
  });

  it('KEEPS the lapse when totalPremiumPaid is missing', () => {
    // 98 of the 229 real docs have no value. Failing toward "forgiven" would
    // quietly clear a third of the book.
    expect(lapseStillCounts(doc({ proposedAPI: 1000, totalPremiumPaid: null }))).toBe(true);
    expect(lapseStillCounts(doc({ proposedAPI: 1000, totalPremiumPaid: undefined }))).toBe(true);
    expect(lapseStillCounts(doc({ proposedAPI: 1000, totalPremiumPaid: '' }))).toBe(true);
  });

  it('keeps the lapse when API is missing or zero, rather than dividing by nothing', () => {
    expect(lapseStillCounts(doc({ proposedAPI: null, totalPremiumPaid: 5000 }))).toBe(true);
    expect(lapseStillCounts(doc({ proposedAPI: 0, totalPremiumPaid: 5000 }))).toBe(true);
  });

  it('a deceased policy is NEVER a lapse', () => {
    expect(lapseStillCounts(doc({ terminalReason: 'deceased', totalPremiumPaid: 1 }))).toBe(false);
  });

  it('applies all of that through the derivation, with reasons recorded', () => {
    const docs = [
      doc({ policyNumber: 'LAPSE00001', status: 'lapsed', proposedAPI: 1000, totalPremiumPaid: null }),
      doc({ policyNumber: 'CLEARED001', status: 'lapsed', proposedAPI: 1000, totalPremiumPaid: 2000 }),
      doc({ policyNumber: 'DECEASD001', status: 'lapsed', proposedAPI: 1000, terminalReason: 'deceased' }),
    ];
    const r = deriveFromLedger(docs, OPTS);

    expect(r.inputs.businessPlaced).toBe(3000);
    expect(r.inputs.lapses).toBe(1000);
    expect(r.evidence.lapses).toEqual(['LAPSE00001']);
    expect(r.evidence.excluded.lapseClearedBy24mPremium).toEqual(['CLEARED001']);
    expect(r.evidence.excluded.deceasedNotLapsed).toEqual(['DECEASD001']);
  });
});

describe('isStaleAnnuity — the annuity addition (derivation rule 6)', () => {
  it('has one grace constant', () => {
    expect(ANNUITY_PAID_TO_GRACE_DAYS).toBe(60);
  });

  it('is stale past the grace window, and not at exactly the boundary', () => {
    const annuity = (paidToDate) => doc({ policyClass: 'annuity', status: 'settled', paidToDate });
    // 2026-07-17 is EXACTLY 60 days before the 2026-09-15 export date, so the
    // boundary day itself is not stale and 61 days is.
    expect(isStaleAnnuity(annuity('2026-07-16'), EXPORT_DATE)).toBe(true);  // 61 days
    expect(isStaleAnnuity(annuity('2026-07-17'), EXPORT_DATE)).toBe(false); // exactly 60
    expect(isStaleAnnuity(annuity('2026-09-01'), EXPORT_DATE)).toBe(false);
  });

  it('never applies to a non-annuity', () => {
    const stale = { policyClass: 'whole_life', status: 'settled', paidToDate: '2025-01-01' };
    expect(isStaleAnnuity(stale, EXPORT_DATE)).toBe(false);
    expect(isStaleAnnuity({ ...stale, policyClass: 'term' }, EXPORT_DATE)).toBe(false);
  });

  it('never applies to an annuity that is not settled', () => {
    expect(isStaleAnnuity(doc({ policyClass: 'annuity', status: 'lapsed', paidToDate: '2025-01-01' }), EXPORT_DATE)).toBe(false);
  });

  it('does NOT invent a lapse when paidToDate is missing', () => {
    expect(isStaleAnnuity(doc({ policyClass: 'annuity', status: 'settled', paidToDate: null }), EXPORT_DATE)).toBe(false);
  });
});

describe('deriveFromLedger — the annuityMissedPremiumRule switch', () => {
  const docs = () => [
    doc({ policyNumber: 'ANNSTALE01', policyClass: 'annuity', status: 'settled', paidToDate: '2026-01-01', proposedAPI: 3000 }),
    doc({ policyNumber: 'ANNFRESH01', policyClass: 'annuity', status: 'settled', paidToDate: '2026-09-10', proposedAPI: 2000 }),
    doc({ policyNumber: 'ANNLAPSE01', policyClass: 'annuity', status: 'lapsed', paidToDate: '2026-01-01', proposedAPI: 1000 }),
    doc({ policyNumber: 'LIFESTALE1', policyClass: 'whole_life', status: 'settled', paidToDate: '2025-01-01', proposedAPI: 5000 }),
  ];

  it('defaults to ignore', () => {
    expect(DEFAULT_ANNUITY_MISSED_PREMIUM_RULE).toBe('ignore');
    expect(ANNUITY_MISSED_PREMIUM_RULES).toEqual(['ignore', 'lapse']);
    expect(deriveFromLedger(docs(), OPTS).annuityMissedPremiumRule).toBe('ignore');
  });

  it('under ignore, only a genuinely lapsed annuity is a lapse', () => {
    const r = deriveFromLedger(docs(), { ...OPTS, annuityMissedPremiumRule: 'ignore' });
    expect(r.inputs.businessPlaced).toBe(11000);
    expect(r.inputs.lapses).toBe(1000);
    expect(r.evidence.lapses).toEqual(['ANNLAPSE01']);
  });

  it('under lapse, a stale settled annuity is added on top', () => {
    const r = deriveFromLedger(docs(), { ...OPTS, annuityMissedPremiumRule: 'lapse' });
    expect(r.inputs.businessPlaced).toBe(11000); // denominator unchanged by the switch
    expect(r.inputs.lapses).toBe(4000);          // 1000 lapsed + 3000 stale
    expect(r.evidence.lapses.sort()).toEqual(['ANNLAPSE01', 'ANNSTALE01']);
  });

  it('the switch never touches a non-annuity, however stale', () => {
    const ignore = deriveFromLedger(docs(), { ...OPTS, annuityMissedPremiumRule: 'ignore' });
    const lapse  = deriveFromLedger(docs(), { ...OPTS, annuityMissedPremiumRule: 'lapse' });
    expect(ignore.evidence.lapses).not.toContain('LIFESTALE1');
    expect(lapse.evidence.lapses).not.toContain('LIFESTALE1');
  });

  it('reports BOTH rule outcomes whichever rule is active, so the tab need not re-derive', () => {
    const ignore = deriveFromLedger(docs(), { ...OPTS, annuityMissedPremiumRule: 'ignore' });
    const lapse  = deriveFromLedger(docs(), { ...OPTS, annuityMissedPremiumRule: 'lapse' });

    expect(ignore.atRisk.lapsesUnderIgnore).toBe(1000);
    expect(ignore.atRisk.lapsesUnderLapse).toBe(4000);
    expect(lapse.atRisk.lapsesUnderIgnore).toBe(1000);
    expect(lapse.atRisk.lapsesUnderLapse).toBe(4000);

    // And the two agree on the percentage each rule would produce.
    expect(ignore.atRisk.persistencyUnderIgnore).toBeCloseTo(lapse.atRisk.persistencyUnderIgnore, 10);
    expect(ignore.atRisk.persistencyUnderLapse).toBeCloseTo(lapse.atRisk.persistencyUnderLapse, 10);
    expect(ignore.derived.persistency).toBeCloseTo(ignore.atRisk.persistencyUnderIgnore, 10);
    expect(lapse.derived.persistency).toBeCloseTo(lapse.atRisk.persistencyUnderLapse, 10);
  });

  it('lists the at-risk annuities with their API and paid-to date', () => {
    const r = deriveFromLedger(docs(), OPTS);
    expect(r.atRisk.annuities).toEqual([
      { policyNumber: 'ANNSTALE01', api: 3000, paidToDate: '2026-01-01' },
    ]);
    expect(r.atRisk.annuityApiTotal).toBe(3000);
  });

  it('rejects an unknown rule instead of silently falling back', () => {
    expect(() => deriveFromLedger([], { ...OPTS, annuityMissedPremiumRule: 'tatil24' }))
      .toThrow(/annuityMissedPremiumRule must be one of ignore \| lapse/);
  });
});

describe('deriveFromLedger — the pending death claim (derivation rule 9)', () => {
  it('surfaces it so it is not forgotten, and does not count it as a lapse', () => {
    const r = deriveFromLedger([
      doc({
        policyNumber: 'FNE2500031',
        status: 'settled',
        terminalReason: 'deceased',
        claimStatus: 'pending',
        proposedAPI: 6000,
      }),
    ], OPTS);

    expect(r.atRisk.pendingDeathClaims).toEqual([
      { policyNumber: 'FNE2500031', api: 6000, terminalReason: 'deceased' },
    ]);
    expect(r.inputs.lapses).toBe(0);
    expect(r.inputs.businessPlaced).toBe(6000);
  });
});

describe('deriveFromLedger — the four inputs the export cannot supply (rule 7)', () => {
  it('defaults them to 0 and says so, rather than presenting a derived-looking zero', () => {
    const r = deriveFromLedger([doc()], OPTS);

    for (const key of LEDGER_MANUAL_INPUTS) {
      expect(r.inputs[key]).toBe(0);
    }
    expect(r.manualPending.sort()).toEqual(['decreases', 'incPPPs', 'lumpsums100', 'reinstatements']);
    expect(r.manualNote).toMatch(/not in export/);
  });

  it('an existing manual entry WINS over the 0', () => {
    const r = deriveFromLedger([doc()], {
      ...OPTS,
      manual: { decreases: 500, incPPPs: 250, lumpsums100: 1000, reinstatements: 75 },
    });

    expect(r.inputs.decreases).toBe(500);
    expect(r.inputs.incPPPs).toBe(250);
    expect(r.inputs.lumpsums100).toBe(1000);
    expect(r.inputs.reinstatements).toBe(75);
    expect(r.manualPending).toEqual([]);
  });

  it('keeps a manual 0 that was deliberately entered out of manualPending', () => {
    const r = deriveFromLedger([doc()], { ...OPTS, manual: { decreases: 0 } });
    expect(r.inputs.decreases).toBe(0);
    expect(r.manualPending).not.toContain('decreases');
  });

  it('feeds the manual entries into the formula', () => {
    const base = deriveFromLedger([doc({ proposedAPI: 10000 })], OPTS);
    const withManual = deriveFromLedger([doc({ proposedAPI: 10000 })], {
      ...OPTS,
      manual: { reinstatements: 1000 },
    });
    expect(withManual.derived.netSettled).toBe(base.derived.netSettled + 1000);
  });
});

describe('deriveFromLedger — it feeds deriveAll and does not reimplement it', () => {
  it('returns exactly what deriveAll returns for the same inputs', () => {
    const docs = [
      doc({ policyNumber: 'A000000001', proposedAPI: 5000 }),
      doc({ policyNumber: 'B000000001', status: 'lapsed', proposedAPI: 2000, totalPremiumPaid: null }),
    ];
    const r = deriveFromLedger(docs, OPTS);
    expect(r.derived).toEqual(deriveAll(r.inputs));
  });

  it('counts the policies behind the denominator', () => {
    const docs = [
      doc({ policyNumber: 'A000000001' }),
      doc({ policyNumber: 'B000000001' }),
      doc({ policyNumber: 'C000000001', isWritingAgent: false }),
    ];
    const r = deriveFromLedger(docs, OPTS);
    expect(r.counted).toBe(2);
    expect(r.counted).toBe(r.evidence.businessPlaced.length);
  });

  it('is 0% rather than NaN on an empty ledger', () => {
    const r = deriveFromLedger([], OPTS);
    expect(r.inputs.businessPlaced).toBe(0);
    expect(r.derived.persistency).toBe(0);
    expect(r.counted).toBe(0);
  });

  it('rounds money to 2dp so repeated addition cannot drift the reported total', () => {
    const docs = Array.from({ length: 3 }, (_, i) => doc({ policyNumber: `R00000000${i}`, proposedAPI: 0.1 }));
    const r = deriveFromLedger(docs, OPTS);
    expect(r.inputs.businessPlaced).toBe(0.3);
  });
});

describe('deriveFromLedger — monotonicity (v3 non-negotiable 3)', () => {
  it('adding a placed policy never decreases the denominator or the counted set', () => {
    const base = [doc({ policyNumber: 'A000000001', proposedAPI: 1000 })];
    let prevPlaced = 0;
    let prevCounted = 0;

    for (let i = 0; i < 5; i++) {
      const docs = [...base, ...Array.from({ length: i }, (_, j) => doc({ policyNumber: `X0000000${j}`, proposedAPI: 100 }))];
      const r = deriveFromLedger(docs, OPTS);
      expect(r.inputs.businessPlaced).toBeGreaterThanOrEqual(prevPlaced);
      expect(r.counted).toBeGreaterThanOrEqual(prevCounted);
      prevPlaced = r.inputs.businessPlaced;
      prevCounted = r.counted;
    }
  });

  it('adding a lapse never decreases the lapse total', () => {
    const lapse = (n) => doc({ policyNumber: n, status: 'lapsed', proposedAPI: 500, totalPremiumPaid: null });
    const one = deriveFromLedger([lapse('L000000001')], OPTS);
    const two = deriveFromLedger([lapse('L000000001'), lapse('L000000002')], OPTS);
    expect(two.inputs.lapses).toBeGreaterThanOrEqual(one.inputs.lapses);
  });
});

describe('deriveFromLedger — input validation', () => {
  it('throws on a malformed monthKey rather than guessing a window', () => {
    expect(() => deriveFromLedger([], { ...OPTS, monthKey: '2026-9' })).toThrow(/monthKey must be "YYYY-MM"/);
    expect(() => deriveFromLedger([], { ...OPTS, monthKey: '2026_09' })).toThrow(/monthKey must be "YYYY-MM"/);
    expect(() => deriveFromLedger([], { ...OPTS, monthKey: null })).toThrow(/monthKey must be "YYYY-MM"/);
  });

  it('throws on a non-positive or fractional windowMonths', () => {
    expect(() => deriveFromLedger([], { ...OPTS, windowMonths: 0 })).toThrow(/positive integer/);
    expect(() => deriveFromLedger([], { ...OPTS, windowMonths: -24 })).toThrow(/positive integer/);
    expect(() => deriveFromLedger([], { ...OPTS, windowMonths: 24.5 })).toThrow(/positive integer/);
  });

  it('handles a non-array docs argument without throwing', () => {
    expect(deriveFromLedger(null, OPTS).counted).toBe(0);
    expect(deriveFromLedger(undefined, OPTS).counted).toBe(0);
  });
});
