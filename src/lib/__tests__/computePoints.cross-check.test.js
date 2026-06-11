import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// ESM twin under test
import { computePoints as esmComputePoints } from '../computePoints.js';

// CJS twin under test — loaded via createRequire so vitest interops the CJS module
const require = createRequire(import.meta.url);
const { computePoints: cjsComputePoints } = require('../../../functions/lib/computePoints');

// Shared fixtures — each must produce identical output from both implementations.
const FIXTURES = [
  // [0] v1 flat — regression guard → 82
  // dials(7)*1 + ffi(2)*5 + ci(1)*10 + apps(2)*25 + api(floor(5000/1000))*1 = 82
  {
    referralCalls: 3, followUpCalls: 2, coldCalls: 1, seminarTradeshowCalls: 1,
    ffiConducted: 2, ciConducted: 1,
    applicationsSold: 2, apiSold: 5000,
  },
  // [1] v2 nested — today's v2 fix → 75
  // ffi(2)*5 + ci(1)*10 + apps(2)*25 + api(floor(5000/1000))*1 = 75
  { version: 2, newBusiness: { apps: 2, api: 5000 }, ffiConducted: 2, ciConducted: 1 },
  // [2] empty doc → 0 (no crash)
  {},
  // [3] string-numeric coercion — same output as numeric equivalents
  { applicationsSold: '3', apiSold: '2000' },
  // [4] v2 — ghost flat fields must be ignored when version === 2
  { version: 2, newBusiness: { apps: 2, api: 5000 }, applicationsSold: 999, apiSold: 999000 },
];

describe('ESM ≡ CJS — computePoints cross-check', () => {
  FIXTURES.forEach((fixture, i) => {
    it(`fixture[${i}]: ESM output equals CJS output`, () => {
      expect(esmComputePoints(fixture)).toBe(cjsComputePoints(fixture));
    });
  });
});

// ── Known expected values ─────────────────────────────────────────────────────

describe('computePoints — known expected values (ESM)', () => {
  it('v1 flat regression → 82', () => {
    expect(esmComputePoints(FIXTURES[0])).toBe(82);
  });

  it('v2 nested fixture → 75', () => {
    expect(esmComputePoints(FIXTURES[1])).toBe(75);
  });

  it('empty doc → 0 (no crash)', () => {
    expect(esmComputePoints(FIXTURES[2])).toBe(0);
  });

  it('v2 ghost flat fields are ignored — same output as equivalent clean v2', () => {
    // fixture[4] has applicationsSold:999 + apiSold:999000 but version===2, so those
    // flat fields must be ignored and newBusiness.apps/api used instead.
    // Compare against the same newBusiness shape without the ghost fields.
    const cleanV2 = { version: 2, newBusiness: { apps: 2, api: 5000 } };
    expect(esmComputePoints(FIXTURES[4])).toBe(esmComputePoints(cleanV2));
  });
});
