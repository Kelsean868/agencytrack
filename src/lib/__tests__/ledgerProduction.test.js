import { describe, it, expect } from 'vitest';
import {
  deriveYearProduction,
  productionCredit,
  isMismatch,
  GENERAL_CREDIT_TABLE,
} from '../ledgerProduction';
import { creditFor, RULE_7_CREDIT_TABLE } from '../policyCampaignLens';

// H1 · docs/briefs/hero-ledger-truth.md. The heroes read the ledger (R1), four
// figures per year (R2), Tatil's production rules through one helper (R3), and
// the weekly self-report as a reconciliation note (R4).

const imported = (over) => ({
  importSource: 'oipa_import',
  newBusinessType: 'nb_ordinary',
  productLine: 'life',
  ...over,
});

// Kyron's live shape on 23 Sep 2026: 229 imported docs, none with a submit or
// written date. Six issued in 2026 — five settled, one NTU — and 223 older.
function kyronShape() {
  const older = Array.from({ length: 223 }, (_, i) => imported({
    status: ['settled', 'lapsed', 'ntu', 'denied'][i % 4],
    dateIssued: `20${String(10 + (i % 15)).padStart(2, '0')}-05-01`,
    proposedAPI: 5000,
  }));
  const in2026 = [
    imported({ status: 'ntu',     dateIssued: '2026-07-25', proposedAPI: 36000 }),
    imported({ status: 'settled', dateIssued: '2026-06-30', proposedAPI: 12000 }),
    imported({ status: 'settled', dateIssued: '2026-08-07', proposedAPI: 1200, isSelfOrFamily: true }),
    imported({ status: 'settled', dateIssued: '2026-08-04', proposedAPI: 36000 }),
    imported({ status: 'settled', dateIssued: '2026-07-31', proposedAPI: 1946.28 }),
    imported({ status: 'settled', dateIssued: '2026-08-04', proposedAPI: 36000 }),
  ];
  return [...older, ...in2026];
}

describe('deriveYearProduction — R2 figures', () => {
  it("Kyron's shape: 5 settled, 6 submitted, dated by issue", () => {
    const policies = kyronShape();
    expect(policies).toHaveLength(229);
    const out = deriveYearProduction(policies, { year: 2026 });
    expect(out.settled.count).toBe(5);
    expect(out.settled.api).toBe(87146.28);
    expect(out.settled.apps).toBe(5);
    expect(out.submitted.count).toBe(6);
    expect(out.submitted.api).toBe(123146.28);
    expect(out.submitted.datedByIssue).toBe(true);
  });

  it('counts imported business by its date, never by its origin (R5)', () => {
    const a = deriveYearProduction([imported({ status: 'settled', dateIssued: '2026-02-01', proposedAPI: 100 })], { year: 2026 });
    const b = deriveYearProduction([{ ...imported({ status: 'settled', dateIssued: '2026-02-01', proposedAPI: 100 }), importSource: undefined }], { year: 2026 });
    expect(a.settled).toEqual(b.settled);
    const old = deriveYearProduction([imported({ status: 'settled', dateIssued: '2019-02-01', proposedAPI: 100 })], { year: 2026 });
    expect(old.settled.count).toBe(0);
  });

  it('a hand-keyed policy counts in submitted by its submit date, not its issue date', () => {
    const p = { newBusinessType: 'nb_ordinary', status: 'settled', dateSubmitted: '2026-03-02', dateIssued: '2026-04-10', proposedAPI: 24000 };
    const out = deriveYearProduction([p], { year: 2026, weekStarting: '2026-03-01' });
    expect(out.submitted.count).toBe(1);
    expect(out.submitted.datedByIssue).toBe(false);
    // In the week of 1 Mar by its submit date; its issue date (10 Apr) is not that week.
    expect(out.submitted.weekApi).toBe(24000);
    const april = deriveYearProduction([p], { year: 2026, weekStarting: '2026-04-05' });
    expect(april.submitted.weekApi).toBe(0);
  });

  it('falls back to dateWritten before dateIssued', () => {
    const p = { newBusinessType: 'nb_ordinary', status: 'submitted', dateWritten: '2025-12-20', dateIssued: '2026-01-15', proposedAPI: 1000 };
    const out = deriveYearProduction([p], { year: 2026 });
    expect(out.submitted.count).toBe(0);
    expect(out.submitted.datedByIssue).toBe(false);
  });

  it('submitted Dec 2025 and issued Jan 2026: settled 2026 yes, submitted 2026 no', () => {
    const p = { newBusinessType: 'nb_ordinary', status: 'settled', dateSubmitted: '2025-12-18', dateIssued: '2026-01-09', proposedAPI: 18000 };
    const out = deriveYearProduction([p], { year: 2026 });
    expect(out.settled.count).toBe(1);
    expect(out.settled.api).toBe(18000);
    expect(out.submitted.count).toBe(0);
    expect(deriveYearProduction([p], { year: 2025 }).submitted.count).toBe(1);
  });

  it('a written (unsigned) policy has not gone in; lapsed, NTU and denied have', () => {
    const base = { newBusinessType: 'nb_ordinary', dateSubmitted: '2026-05-01', proposedAPI: 100 };
    const out = deriveYearProduction(
      ['written', 'lapsed', 'ntu', 'denied', 'rated'].map((status) => ({ ...base, status })),
      { year: 2026 },
    );
    expect(out.submitted.count).toBe(4);
    expect(out.settled.count).toBe(0);
  });

  it('a confirmed policy counts as settled; a non-Life policy counts nowhere', () => {
    const out = deriveYearProduction([
      { newBusinessType: 'nb_ordinary', status: 'settled', confirmedAt: '2026-06-01', dateIssued: '2026-05-01', proposedAPI: 10 },
      { newBusinessType: 'nb_ordinary', status: 'settled', productLine: 'health', dateIssued: '2026-05-01', proposedAPI: 99 },
    ], { year: 2026 });
    expect(out.settled.count).toBe(1);
    expect(out.submitted.count).toBe(1);
  });

  it('uses the most-confirmed API figure', () => {
    const out = deriveYearProduction([
      { newBusinessType: 'nb_ordinary', status: 'settled', dateIssued: '2026-05-01', proposedAPI: 10, settledAPI: 20, managerSettledAPI: 30 },
    ], { year: 2026 });
    expect(out.settled.api).toBe(30);
  });

  it('empty or missing input derives zeros, not a crash', () => {
    for (const input of [null, undefined, []]) {
      const out = deriveYearProduction(input, { year: 2026 });
      expect(out.settled).toEqual({ api: 0, apps: 0, count: 0, fromHeadOffice: 0, selfConfirmed: 0 });
      expect(out.submitted.count).toBe(0);
      expect(out.mismatch).toEqual({ ytd: 0, week: 0 });
    }
  });

  it('provenance: head office = statusSource oipa_import; every other settled is self-confirmed; the two sum to count', () => {
    const base = { productLine: 'life', status: 'settled', newBusinessType: 'nb_ordinary', proposedAPI: 1000, dateIssued: '2026-03-01' };
    const out = deriveYearProduction([
      { ...base, statusSource: 'oipa_import' },
      { ...base, statusSource: 'oipa_import' },
      { ...base, statusSource: 'agent' },
      { ...base }, // hand-keyed, no statusSource
      { ...base, statusSource: 'oipa_import', dateIssued: '2019-01-01' }, // not this year → not counted
      { ...base, statusSource: 'oipa_import', status: 'lapsed' }, // not settled → not counted
    ], { year: 2026 });
    expect(out.settled.count).toBe(4);
    expect(out.settled.fromHeadOffice).toBe(2);
    expect(out.settled.selfConfirmed).toBe(2);
    expect(out.settled.fromHeadOffice + out.settled.selfConfirmed).toBe(out.settled.count);
  });
});

describe('productionCredit — R3', () => {
  it('increase at TTD 2,399 earns 0 apps and full API; at 2,400 it earns 1 app', () => {
    expect(productionCredit({ newBusinessType: 'inc_ppp', proposedAPI: 2399 })).toMatchObject({ apps: 0, api: 2399 });
    expect(productionCredit({ newBusinessType: 'inc_ppp', proposedAPI: 2400 })).toMatchObject({ apps: 1, api: 2400 });
  });

  it('a lump sum never counts as an app and earns 10% API under the general rule', () => {
    expect(productionCredit({ newBusinessType: 'lumpsum', proposedAPI: 50000 })).toMatchObject({ apps: 0, api: 5000 });
  });

  it('the campaign keeps its own Rule 7 lump-sum row (0%)', () => {
    const campaign = { credit: { table: RULE_7_CREDIT_TABLE, incPppAppThreshold: 2400 } };
    expect(creditFor({ newBusinessType: 'lumpsum', proposedAPI: 50000 }, campaign)).toMatchObject({ apps: 0, api: 0 });
    expect(RULE_7_CREDIT_TABLE.lumpsum.api).toBe('none');
  });

  it('every other row is the same object as the campaign table (no fork)', () => {
    for (const key of Object.keys(RULE_7_CREDIT_TABLE)) {
      if (key === 'lumpsum') continue;
      expect(GENERAL_CREDIT_TABLE[key]).toBe(RULE_7_CREDIT_TABLE[key]);
    }
    expect(Object.keys(GENERAL_CREDIT_TABLE).sort()).toEqual(Object.keys(RULE_7_CREDIT_TABLE).sort());
  });

  it('an unclassified type abstains (0/0) rather than guessing ordinary', () => {
    expect(productionCredit({ proposedAPI: 9000 })).toMatchObject({ apps: 0, api: 0 });
  });
});

describe('reconciliation — R4', () => {
  const sub = (weekStarting, api, status = 'submitted') => ({ weekStarting, status, totalProductionCredit: api, apiSubmitted: api });

  it('weekly TTD 30,000 against a ledger of TTD 0 gives mismatch.ytd = 30,000', () => {
    const out = deriveYearProduction([], { year: 2026, submissions: [sub('2026-03-01', 30000)] });
    expect(out.weekly.ytdApi).toBe(30000);
    expect(out.mismatch.ytd).toBe(30000);
    expect(isMismatch(out.mismatch.ytd)).toBe(true);
  });

  it('reads the weekly figure for the selected week and ignores drafts and other years', () => {
    const out = deriveYearProduction([], {
      year: 2026,
      weekStarting: '2026-09-20',
      submissions: [sub('2026-09-20', 4800), sub('2026-09-13', 1000), sub('2026-09-06', 700, 'draft'), sub('2025-12-28', 9999)],
    });
    expect(out.weekly).toEqual({ ytdApi: 5800, weekApi: 4800 });
    expect(out.mismatch.week).toBe(4800);
  });

  it('a gap of TTD 1 or less is a match', () => {
    expect(isMismatch(1)).toBe(false);
    expect(isMismatch(-1)).toBe(false);
    expect(isMismatch(1.01)).toBe(true);
  });
});
