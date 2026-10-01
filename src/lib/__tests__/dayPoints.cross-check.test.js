import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM source under test — the Daily Capture pace badge's per-day score.
import { computeDayPoints } from '../../components/daily/DailyCaptureV2.helpers';

// CJS twin under test (functions/lib/dayPoints.js) — FR Leaderboard L-1, D6.
const require = createRequire(import.meta.url);
const { computeDayPoints: cjsComputeDayPoints } = require('../../../functions/lib/dayPoints');

const DAYS = [
  null,
  {},
  { dials: 12, ffiConducted: 1, ciConducted: 1, appointmentsSet: 2 },
  { dials: '7.5', newBusiness: { apps: 2, api: 5400 } },
  { dials: 3, dialsByType: { cold: 1, referral: 2 }, referralCalls: 99, coldCalls: 99 },
  { newNamesAdded: 4, namesFromOther: 99, serviceCalls: 3, serviceContacts: 9 },
  { prospectingLettersSent: 35, referralsObtained: 2, seminarsConducted: 1 },
  { version: 2, newBusiness: { apps: 1, api: 999 }, applicationsSold: 50 },
  { f2fAttempts: 4, policiesDelivered: 1, newBusiness: { apps: '1', api: '1999.99' } },
  { dials: -5, ffiConducted: -1 },
];

describe('ESM ≡ CJS — computeDayPoints twin (FR Leaderboard L-1, D6)', () => {
  DAYS.forEach((d, i) => {
    it(`day[${i}]: ESM output equals CJS output`, () => {
      expect(cjsComputeDayPoints(d)).toBe(computeDayPoints(d));
    });
  });

  it('fixtures are not all zero (the guard compares real scores)', () => {
    expect(DAYS.filter((d) => computeDayPoints(d) > 0).length).toBeGreaterThanOrEqual(6);
  });
});
