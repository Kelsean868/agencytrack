import { describe, it, expect } from 'vitest';
import { settlementShapeFromPolicies } from '../policiesDerivation.js';

/**
 * Net-vs-Gross settled-production assertion — Run A Tier 1 §2 (dispatcher ruling D2).
 *
 * `settlementShapeFromPolicies` IS the Net path: it counts only `status === 'settled'`
 * and drops everything else, so a policy that was settled and then lapsed is excluded
 * ("lapsed policies were deducted and are excluded", per the module doc). Gross settled
 * is the same production BEFORE that deduction.
 *
 * The two sides run through the SAME production function on the SAME inputs; the ONLY
 * difference is the lapsed policy's status. That isolates the `status !== 'settled'`
 * skip as the sole cause of Net < Gross — the assertion pins direction AND cause, per
 * D2 ("net < gross BECAUSE vhfix-pol-a2-lapsed is excluded — not merely net != gross").
 *
 * Fixture values mirror the agent-2 policies written by
 * scripts/staging/seed-fixtures.mjs § A5 (Rule 17 provenance — verified against that
 * file 2026-07-24). settledAPI values are copied verbatim so this is a value-level,
 * CI-gated stand-in for the seeded staging fixtures (which the VH staging suite
 * additionally exercises live post-merge):
 *   vhfix-pol-a2-within    status 'settled',   settledAPI 4100, issued  12d ago
 *   vhfix-pol-a2-inflight  status 'submitted', no dateIssued / settledAPI (never counts)
 *   vhfix-pol-a2-lapsed    status 'lapsed',    settledAPI 4500, issued 100d ago (was
 *                          settled, then lapsed 15d ago)
 */

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const totalSettledAPI = (shape) => shape.reduce((sum, row) => sum + row.settledAPI, 0);

const A2_WITHIN   = { status: 'settled',   dateIssued: daysAgo(12),  settledAPI: 4100 };
const A2_INFLIGHT = { status: 'submitted' }; // no dateIssued / settledAPI — excluded from both
const A2_LAPSED   = { status: 'lapsed',    dateIssued: daysAgo(100), settledAPI: 4500 };
const LAPSED_SETTLED_API = 4500;

describe('policiesDerivation — Net vs Gross settled production (seeded a2 fixtures)', () => {
  it('Net excludes the lapsed policy, so Net < Gross by exactly the lapsed settledAPI', () => {
    const a2Policies = [A2_WITHIN, A2_INFLIGHT, A2_LAPSED];

    // NET — production path, as seeded. vhfix-pol-a2-lapsed (status 'lapsed') is dropped
    // at `status !== 'settled'`; the submitted in-flight policy has no dateIssued.
    const net = totalSettledAPI(settlementShapeFromPolicies(a2Policies));

    // GROSS — same function, same inputs, only the lapsed policy restored to its
    // pre-lapse 'settled' status. The delta is attributable to that one flip alone.
    const grossPolicies = a2Policies.map((p) =>
      p === A2_LAPSED ? { ...p, status: 'settled' } : p);
    const gross = totalSettledAPI(settlementShapeFromPolicies(grossPolicies));

    expect(net).toBe(4100);
    expect(gross).toBe(8600);
    expect(net).toBeLessThan(gross);              // direction: Net < Gross
    expect(gross - net).toBe(LAPSED_SETTLED_API); // cause: exactly the excluded lapsed API
  });

  it('is non-vacuous: with the lapsed fixture removed, Net === Gross', () => {
    // Drop the lapsed policy entirely — there is nothing left for the status skip to
    // exclude, so Net and Gross must coincide. This proves the divergence above is
    // caused by the lapse, not by any other fixture.
    const noLapse = [A2_WITHIN, A2_INFLIGHT];
    const net = totalSettledAPI(settlementShapeFromPolicies(noLapse));
    const gross = totalSettledAPI(settlementShapeFromPolicies(noLapse.map((p) => ({ ...p }))));

    expect(net).toBe(gross);
    expect(net).toBe(4100);
  });
});
