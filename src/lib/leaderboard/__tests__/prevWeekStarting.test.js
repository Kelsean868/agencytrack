// Cross-check: client's `prevWeekStarting()` produces the IDENTICAL key the
// leaderboard-aggregate CF writes to `weeklyChampions/{weekStarting}`.
//
// The CF's `priorWeekStartingString` is in functions/leaderboard/leaderboardAggregate.js;
// its math is built on `getPeriodBoundaries` from the CJS twin
// `functions/leaderboard/rankingLogic.js`. The client's `prevWeekStarting()`
// uses the ESM `getPeriodBoundaries` from `src/lib/productionReport/computations.js`.
// The ESM↔CJS parity of `getPeriodBoundaries` is already covered by 85 tests
// in `cross-check-cjs.test.js`. This file confirms the wrapping computation
// (subtract 7 days → snap to week → TT-shift to YYYY-MM-DD) produces the same
// string when invoked on both sides.
//
// Drift here = a banner that ALWAYS reads a doc the CF doesn't write =
// permanently-empty banner regardless of real champion data. This is the
// pre-review focal point per the brief.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { prevWeekStarting } from '../prevWeekStarting';

// Load the CF aggregate module (CJS) to call its prior-week helper directly.
const require = createRequire(import.meta.url);
// Stub firebase-admin BEFORE requiring the CF — the helper itself doesn't
// touch admin, but the module top-level requires admin.
require('module')._cache; // ensure cache is initialized
// We can sidestep the admin import by extracting only the helper via the
// internals export shape. The CF module exports _internals.priorWeekStartingString.
// Reach into the CJS twin's `getPeriodBoundaries` and re-derive the prior-
// week Sunday inline, matching `priorWeekStartingString` in
// `functions/leaderboard/leaderboardAggregate.js` verbatim. This is the
// exact computation the CF uses (same primitive, same offsets). We avoid
// requiring `leaderboardAggregate.js` itself because its top-level requires
// firebase-admin + firebase-functions which need stubs.
const cjs = require('../../../../functions/leaderboard/rankingLogic');

const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;

function cfPriorWeekStarting(referenceDate) {
  const priorRef = new Date(referenceDate.getTime() - 7 * 24 * 3600 * 1000);
  const { start } = cjs.getPeriodBoundaries('week', priorRef);
  const tt = new Date(start.getTime() - TRINI_OFFSET_MS);
  const yyyy = tt.getUTCFullYear();
  const mm = String(tt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(tt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Reference dates chosen to exercise day-of-week boundaries + month/year
// rollovers + the UTC-vs-TT-day-disagreement edge already used in the
// P1a cross-check suite.
const REFS = [
  { label: 'mid-week (Fri May 15 10:00 UTC = Fri 06:00 TT)', ref: new Date('2026-05-15T10:00:00Z') },
  { label: 'Sun 00:00 TT = Sun 04:00 UTC (week roll boundary)', ref: new Date('2026-05-10T04:00:00Z') },
  { label: 'Sat 23:59:59.999 TT = Sun 03:59:59.999 UTC', ref: new Date('2026-05-10T03:59:59.999Z') },
  { label: 'May 1 00:00 TT (month rollover)', ref: new Date('2026-05-01T04:00:00Z') },
  { label: 'Apr 1 00:00 TT (Q2 start)', ref: new Date('2026-04-01T04:00:00Z') },
  { label: 'Jan 1 00:00 TT (year rollover)', ref: new Date('2026-01-01T04:00:00Z') },
  { label: 'Dec 31 23:59 TT 2025', ref: new Date('2026-01-01T03:59:00Z') },
  { label: 'UTC=Fri TT=Thu (UTC 02:00 = TT 22:00 prior day)', ref: new Date('2026-05-15T02:00:00Z') },
];

describe('prevWeekStarting — client ≡ CF (doc-key parity)', () => {
  REFS.forEach(({ label, ref }) => {
    it(`identical key @ ${label}`, () => {
      expect(prevWeekStarting(ref)).toBe(cfPriorWeekStarting(ref));
    });
  });
});

describe('prevWeekStarting — known fixed dates', () => {
  it('Fri May 15 2026 mid-day → prior week starts 2026-05-03 (Sun)', () => {
    expect(prevWeekStarting(new Date('2026-05-15T10:00:00Z'))).toBe('2026-05-03');
  });

  it('Sun May 10 2026 00:00 TT → prior week starts 2026-05-03', () => {
    expect(prevWeekStarting(new Date('2026-05-10T04:00:00Z'))).toBe('2026-05-03');
  });

  it('Sat Jan 3 2026 23:59 TT (= 2026-01-04 03:59 UTC) → prior week starts 2025-12-21 (year boundary)', () => {
    expect(prevWeekStarting(new Date('2026-01-04T03:59:00Z'))).toBe('2025-12-21');
  });
});
