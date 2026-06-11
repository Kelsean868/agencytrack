import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { sanitize } from '../../services/submissionService.js';

// CJS computePoints loaded via createRequire — same pattern as gamificationConfig.cross-check.test.js.
const require = createRequire(import.meta.url);
const { computePoints } = require('../../../functions/lib/computePoints.js');

// Representative v2 wizard formData (wizard in-memory shape, pre-sanitize).
// sanitize() will write version:2, newBusiness.apps=3, newBusiness.api=12000.
// Flat applicationsSold / apiSold are NOT written by sanitize for v2.
//
// Expected score:
//   ciConducted  (2) * 10 = 20
//   ffiConducted (1) * 5  = 5
//   appointmentsSet (1) * 3 = 3
//   apps (newBusiness.apps=3) * 25 = 75
//   api  (newBusiness.api=12000) floor÷1k * 1 = 12
//   TOTAL = 115
const V2_FORM_DATA = {
  newBusiness:    { apps: 3, api: 12000 },
  pppIncreases:   { apps: 0, apiIncrease: 0 },
  lumpsums:       { grossAmount: 0 },
  livesSold:      3,
  ciConducted:    2,
  ffiConducted:   1,
  appointmentsSet: 1,
};

describe('computePoints — sanitize(v2 formData) → computePoints (write/read regression guard)', () => {
  it('sanitize writes version:2 and newBusiness.apps — confirming the write shape', () => {
    const out = sanitize(V2_FORM_DATA, 0);
    expect(out.version).toBe(2);
    expect(out.newBusiness.apps).toBe(3);
    expect(out.newBusiness.api).toBe(12000);
    // flat fields must NOT be written by sanitize for v2 submissions
    expect(out.applicationsSold).toBeUndefined();
    expect(out.apiSold).toBeUndefined();
  });

  it('computePoints(sanitize(v2 formData)) → 115 — apps × 25 and API ÷ 1000 score correctly', () => {
    const sanitized = sanitize(V2_FORM_DATA, 0);
    expect(computePoints(sanitized)).toBe(115);
  });

  it('ghost flat fields in formData do not leak through sanitize into the score', () => {
    // Ghost flat fields in pre-sanitize formData must not affect the scored output.
    const withGhosts = { ...V2_FORM_DATA, applicationsSold: 999, apiSold: 999000 };
    const sanitized = sanitize(withGhosts, 0);
    // sanitize does not write applicationsSold or apiSold for v2 — still version:2, newBusiness.apps=3
    expect(sanitized.version).toBe(2);
    expect(sanitized.newBusiness.apps).toBe(3);
    expect(computePoints(sanitized)).toBe(115);
  });
});
