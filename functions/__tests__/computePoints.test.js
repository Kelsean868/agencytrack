'use strict';

const { computePoints } = require('../lib/computePoints');
const { resolveLevel }   = require('../lib/gamificationConfig');

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// REGRESSION_FIXTURE covers the 5 activity groups that scored before the
// full-scale expansion (dials + ffi + ci + apps + api).
// All five weights are UNCHANGED in the new scale — expected total stays 82.
//
//   dials (3+2+1+1=7) * 1  = 7
//   ffi   (2)         * 5  = 10
//   ci    (1)         * 10 = 10
//   apps  (2)         * 25 = 50
//   api   (5000/1k)   * 1  = 5
//   TOTAL = 82

const REGRESSION_FIXTURE = {
  referralCalls:         3,
  followUpCalls:         2,
  coldCalls:             1,
  seminarTradeshowCalls: 1,
  ffiConducted:          2,
  ciConducted:           1,
  applicationsSold:      2,
  apiSold:               5000,
};

// FULL_SCALE_FIXTURE exercises all 21 scored keys.
//
//   dials (7)          * 1  = 7
//   letters (25→cap20) * 1  = 20
//   referrals (3)      * 3  = 9
//   otherNewNames (8)  * 1  = 8    ← namesFrom(4+2+1+1)
//   seminars (1)       * 10 = 10
//   tradeshows (1)     * 5  = 5
//   f2f (3)            * 2  = 6
//   appointments (3)   * 3  = 9
//   ffi (2)            * 5  = 10
//   ci (1)             * 10 = 10
//   apps (2)           * 25 = 50
//   api (5000/1k)      * 1  = 5
//   serviceCalls (2)   * 1  = 2
//   deliveries (1)     * 3  = 3
//   premiumMtgs (1)    * 3  = 3
//   annualReviews (1)  * 5  = 5
//   orphanReviews (1)  * 5  = 5
//   orphansAdopted (1) * 8  = 8
//   reinstated (1)     * 10 = 10
//   reinstatedApi (0)      = 0
//   policyChanges (2)  * 1  = 2
//   TOTAL = 187

const FULL_SCALE_FIXTURE = {
  referralCalls:               3,
  followUpCalls:               2,
  coldCalls:                   1,
  seminarTradeshowCalls:       1,
  prospectingLettersSent:      25,
  referralsObtained:           3,
  namesFromColdCanvass:        4,
  namesFromOther:              2,
  namesFromSeminarsConducted:  1,
  namesFromTradeshowsAttended: 1,
  seminarsConducted:           1,
  tradeshowsAttended:          1,
  f2fAttempts:                 3,
  appointmentsSet:             3,
  ffiConducted:                2,
  ciConducted:                 1,
  applicationsSold:            2,
  apiSold:                     5000,
  serviceCalls:                2,
  policiesDelivered:           1,
  premiumCollectionMeetings:   1,
  annualReviews:               1,
  orphanReviews:               1,
  orphansAdopted:              1,
  reinstatementsSubmitted:     1,
  reinstatementAPI:            0,
  policyChanges:               2,
};

// ── Regression guard ──────────────────────────────────────────────────────────

describe('computePoints — regression guard (existing weights unchanged)', () => {
  test('all existing activities → 82 (proves extraction changed nothing)', () => {
    expect(computePoints(REGRESSION_FIXTURE)).toBe(82);
  });

  test('appsSold fallback: applicationsSold absent → reads appsSold', () => {
    const { applicationsSold: _dropped, ...rest } = REGRESSION_FIXTURE;
    expect(computePoints({ ...rest, appsSold: 2 })).toBe(82);
  });

  test('applicationsSold=0 is NOT overridden by appsSold (nullish fallback, not truthy)', () => {
    expect(computePoints({ applicationsSold: 0, appsSold: 99 })).toBe(0);
  });

  test('empty doc → 0 (no crash)', () => {
    expect(computePoints({})).toBe(0);
  });

  test('string-numeric fields parse correctly', () => {
    expect(computePoints({ applicationsSold: '3', apiSold: '2000' })).toBe(75 + 2);
  });

  test('fractional dials: summed before flooring (1.5+1.5 = 3, not 1+1 = 2)', () => {
    expect(computePoints({ referralCalls: 1.5, followUpCalls: 1.5 })).toBe(3);
  });
});

// ── Full-scale fixture ────────────────────────────────────────────────────────

describe('computePoints — full-scale fixture (all 21 scored keys)', () => {
  test('FULL_SCALE_FIXTURE → 187', () => {
    expect(computePoints(FULL_SCALE_FIXTURE)).toBe(187);
  });
});

// ── f2fAttempts scoring ───────────────────────────────────────────────────────

describe('computePoints — f2fAttempts (weight=2)', () => {
  test('f2fAttempts=3 raises the regression total by exactly 6 (3 × weight 2)', () => {
    const base    = computePoints(REGRESSION_FIXTURE);
    const withF2f = computePoints({ ...REGRESSION_FIXTURE, f2fAttempts: 3 });
    expect(withF2f - base).toBe(6);
  });

  test('f2fAttempts=1 → regression total + 2 = 84', () => {
    expect(computePoints({ ...REGRESSION_FIXTURE, f2fAttempts: 1 })).toBe(84);
  });

  test('f2fAttempts=0 → regression total unchanged = 82', () => {
    expect(computePoints({ ...REGRESSION_FIXTURE, f2fAttempts: 0 })).toBe(82);
  });

  test('f2fAttempts alone (all others absent) → 10 pts (5 × 2)', () => {
    expect(computePoints({ f2fAttempts: 5 })).toBe(10);
  });

  test('f2fAttempts is floored independently of dials', () => {
    expect(computePoints({ f2fAttempts: 2.9 })).toBe(4);
  });
});

// ── prospectingLettersSent cap ────────────────────────────────────────────────

describe('computePoints — prospectingLettersSent cap at 20', () => {
  test('25 letters → 20 pts (cap applied)', () => {
    expect(computePoints({ prospectingLettersSent: 25 })).toBe(20);
  });

  test('20 letters → 20 pts (exactly at cap)', () => {
    expect(computePoints({ prospectingLettersSent: 20 })).toBe(20);
  });

  test('10 letters → 10 pts (below cap, no penalty)', () => {
    expect(computePoints({ prospectingLettersSent: 10 })).toBe(10);
  });

  test('100 letters → 20 pts (far above cap)', () => {
    expect(computePoints({ prospectingLettersSent: 100 })).toBe(20);
  });
});

// ── reinstatedApiPerThousand floor division ───────────────────────────────────

describe('computePoints — reinstatedApiPerThousand', () => {
  test('reinstatementAPI=3500 → floor(3500/1000)=3 pts', () => {
    expect(computePoints({ reinstatementAPI: 3500 })).toBe(3);
  });

  test('reinstatementAPI=999 → 0 pts (below 1000 threshold)', () => {
    expect(computePoints({ reinstatementAPI: 999 })).toBe(0);
  });

  test('reinstatementAPI=1000 → 1 pt', () => {
    expect(computePoints({ reinstatementAPI: 1000 })).toBe(1);
  });
});

// ── Service-work zero/absent fields (hasServiceWork toggle No) ────────────────

describe('computePoints — service-work zero/absent fields contribute 0 (no NaN)', () => {
  const SERVICE_WORK_FIELDS = [
    'serviceCalls', 'policiesDelivered', 'premiumCollectionMeetings',
    'annualReviews', 'orphanReviews', 'orphansAdopted',
    'reinstatementsSubmitted', 'reinstatementAPI', 'policyChanges',
  ];

  test('all service-work fields absent → 0', () => {
    expect(computePoints({})).toBe(0);
  });

  SERVICE_WORK_FIELDS.forEach((field) => {
    test(`${field}=0 → 0 (not NaN)`, () => {
      const result = computePoints({ [field]: 0 });
      expect(result).toBe(0);
      expect(Number.isNaN(result)).toBe(false);
    });
  });
});

// ── resolveLevel — new threshold boundaries ───────────────────────────────────

describe('resolveLevel — new thresholds (provisional, tune at pilot week 4–6)', () => {
  const cases = [
    { points: 499,  title: 'Rookie'    },
    { points: 500,  title: 'Associate' },
    { points: 1499, title: 'Associate' },
    { points: 1500, title: 'Pro'       },
    { points: 3499, title: 'Pro'       },
    { points: 3500, title: 'Elite'     },
    { points: 6999, title: 'Elite'     },
    { points: 7000, title: 'Legend'    },
  ];

  cases.forEach(({ points, title }) => {
    test(`${points} pts → ${title}`, () => {
      expect(resolveLevel(points).title).toBe(title);
    });
  });
});
