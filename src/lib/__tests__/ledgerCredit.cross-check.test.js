import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM sources under test
import { productionCredit, settledCreditList, GENERAL_CREDIT_TABLE } from '../ledgerProduction';
import { creditFor, toDateStr, RULE_7_CREDIT_TABLE, DEFAULT_INC_PPP_APP_THRESHOLD } from '../policyCampaignLens';
import { policyValue } from '../policyLedgerDerivation';

// CJS twin under test (functions/lib/ledgerCredit.js) — FR Leaderboard L-1, D6.
const require = createRequire(import.meta.url);
const cjs = require('../../../functions/lib/ledgerCredit');

// A Firestore-Timestamp look-alike: the client and the Admin SDK both expose toDate().
const ts = (iso) => ({ toDate: () => new Date(iso) });

const POLICIES = [
  { id: 'nb', status: 'settled', newBusinessType: 'nb_ordinary', settledAPI: 12000, dateIssued: '2026-08-15' },
  { id: 'nb-ts-tt-midnight', status: 'settled', newBusinessType: 'nb_ordinary', proposedAPI: 5000, dateIssued: ts('2026-09-27T04:00:00Z') },
  { id: 'nb-ts-early-utc', status: 'settled', newBusinessType: 'nb_ordinary', proposedAPI: 5000, dateIssued: ts('2026-10-01T02:30:00Z') },
  { id: 'ppp-2399', status: 'settled', newBusinessType: 'inc_ppp', settledAPI: 2399, dateIssued: '2026-07-01' },
  { id: 'ppp-2400', status: 'settled', newBusinessType: 'inc_ppp', settledAPI: 2400, dateIssued: '2026-07-01' },
  { id: 'ppp-string', status: 'settled', newBusinessType: 'inc_ppp', settledAPI: '2400.00', dateIssued: '2026-07-01' },
  { id: 'repl', status: 'settled', newBusinessType: 'replacement', settledAPI: 9000, replacedPolicyAPI: 4000, dateIssued: '2026-06-30' },
  { id: 'repl-down', status: 'settled', newBusinessType: 'replacement', settledAPI: 3000, replacedPolicyAPI: 4000, dateIssued: '2026-06-30' },
  { id: 'repl-missing', status: 'settled', newBusinessType: 'replacement', settledAPI: 9000, dateIssued: '2026-06-30' },
  { id: 'repl-blank', status: 'settled', newBusinessType: 'replacement', settledAPI: 9000, replacedPolicyAPI: '', dateIssued: '2026-06-30' },
  { id: 'repl-junk', status: 'settled', newBusinessType: 'replacement', settledAPI: 9000, replacedPolicyAPI: 'n/a', dateIssued: '2026-06-30' },
  { id: 'spia', status: 'settled', newBusinessType: 'spia', settledAPI: 50000, dateIssued: '2026-03-31' },
  { id: 'lump', status: 'settled', newBusinessType: 'lumpsum', settledAPI: 33333, dateIssued: '2026-04-01' },
  { id: 'plat', status: 'settled', newBusinessType: 'platinum_edge', settledAPI: 7000, dateIssued: '2026-01-01' },
  { id: 'unclassified', status: 'settled', settledAPI: 7000, dateIssued: '2026-01-01' },
  { id: 'unknown-type', status: 'settled', newBusinessType: 'mystery', settledAPI: 7000, dateIssued: '2026-01-01' },
  { id: 'mgr-wins', status: 'settled', newBusinessType: 'nb_ordinary', managerSettledAPI: 100, settledAPI: 200, proposedAPI: 300, dateIssued: '2026-02-02' },
  { id: 'nan-api', status: 'settled', newBusinessType: 'nb_ordinary', settledAPI: 'abc', dateIssued: '2026-02-02' },
  { id: 'confirmed-status', status: 'confirmed', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-02-02' },
  { id: 'confirmedAt-only', status: 'submitted', confirmedAt: ts('2026-02-03T12:00:00Z'), newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-02-02' },
  { id: 'not-settled', status: 'submitted', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-02-02' },
  { id: 'lapsed', status: 'lapsed', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-02-02' },
  { id: 'non-life', status: 'settled', productLine: 'motor', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-02-02' },
  { id: 'life-explicit', status: 'settled', productLine: 'life', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-02-02' },
  { id: 'no-date', status: 'settled', newBusinessType: 'nb_ordinary', settledAPI: 1000 },
  { id: 'bad-date', status: 'settled', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: 'soon' },
  { id: 'iso-datetime', status: 'settled', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: '2026-05-05T23:00:00Z' },
  { id: 'date-obj', status: 'settled', newBusinessType: 'nb_ordinary', settledAPI: 1000, dateIssued: new Date('2026-05-05T12:00:00Z') },
  { id: 'self-family', status: 'settled', isSelfOrFamily: true, newBusinessType: 'nb_ordinary', settledAPI: 6000, dateIssued: '2026-08-02' },
  null,
];

const DATES = ['2026-09-27', '2026-09-27T23:59:00Z', ts('2026-09-27T04:00:00Z'), ts('2026-09-27T03:59:00Z'),
  new Date('2026-01-01T00:00:00Z'), 1767225600000, 'x', '', null, undefined, { toDate: () => { throw new Error('bad'); } },
  { toDate: () => new Date('nope') }];

const strip = (rows) => rows.map((r) => ({ id: r.policy.id, issued: r.issued, periodKey: r.periodKey, credit: r.credit }));

describe('ESM ≡ CJS — ledger credit twin (FR Leaderboard L-1, D6)', () => {
  it('credit tables and threshold are identical', () => {
    expect(cjs.GENERAL_CREDIT_TABLE).toEqual(GENERAL_CREDIT_TABLE);
    expect(cjs.RULE_7_CREDIT_TABLE).toEqual(RULE_7_CREDIT_TABLE);
    expect(cjs.DEFAULT_INC_PPP_APP_THRESHOLD).toBe(DEFAULT_INC_PPP_APP_THRESHOLD);
  });

  POLICIES.forEach((p, i) => {
    it(`productionCredit / policyValue / creditFor(Rule 7) agree on fixture[${i}] ${p?.id ?? 'null'}`, () => {
      expect(cjs.productionCredit(p)).toEqual(productionCredit(p));
      expect(cjs.policyValue(p)).toBe(policyValue(p));
      const campaign = { credit: { incPppAppThreshold: 2400 } };
      expect(cjs.creditFor(p, campaign)).toEqual(creditFor(p, campaign));
      expect(cjs.creditFor(p, {})).toEqual(creditFor(p, {}));
    });
  });

  it('settledCreditList agrees on the whole fixture list (Life filter + settled test + date)', () => {
    const esm = strip(settledCreditList(POLICIES));
    expect(strip(cjs.settledCreditList(POLICIES))).toEqual(esm);
    // Guard the fixtures themselves: the list must exercise both arms.
    expect(esm.length).toBeGreaterThan(10);
    expect(esm.find((r) => r.id === 'non-life')).toBeUndefined();
    expect(esm.find((r) => r.id === 'confirmedAt-only')).toBeDefined();
  });

  it('settledCreditList tolerates non-arrays the same way', () => {
    for (const v of [null, undefined, {}, 'x']) {
      expect(strip(cjs.settledCreditList(v))).toEqual(strip(settledCreditList(v)));
    }
  });

  DATES.forEach((d, i) => {
    it(`toDateStr agrees on date[${i}]`, () => {
      expect(cjs.toDateStr(d)).toBe(toDateStr(d));
    });
  });
});
