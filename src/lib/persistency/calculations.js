// E3 — Pure persistency calculations.
//
// Formula (validated against Tatil's Feb 2026 monthly persistency report,
// Ricardo Duke row in the Mikel Granderson branch):
//
//   Gross Settled = (Business Placed − Not Takens) + Inc PPPs + (Lumpsums × 0.10)
//   Net Settled   = Gross Settled − Lapses + Reinstatements
//   Persistency   = Net Settled / Gross Settled
//
// All monetary amounts are TTD. Persistency is a decimal in [0, 1+] — never
// a percentage. Multiply by 100 for display.

// ── Canonical persistency thresholds — SINGLE SOURCE ──
//
// These are TWO DISTINCT business thresholds, not one value in two places.
// Do not collapse them: the floor drives an at-risk warning band, the gate
// drives award eligibility. Changing either changes agent-facing outcomes.
//
// Provenance (verified 2026-07-26, Rule 17 — stated precisely because these
// numbers are money-adjacent and the two have DIFFERENT authority):
//   • PERS_GATE (0.90) is a locked business decision — Tatil's 2026 incentive
//     awards are gated at 90% (docs/briefs/e3-persistency-playground-kickoff.md
//     § Decisions locked, "Award gate threshold: 90%").
//   • PERS_FLOOR (0.80) is NOT Tatil-ratified. It originates as a display
//     banding convention in the same brief ("green ≥90%, amber 80-89%,
//     red <80%") and has since been used as an at-risk threshold. Treat it as
//     an in-app convention, not a carrier-supplied standard.
//
// UNIT: decimal, per this module's contract above. Consumers that render or
// compare on a 0–100 scale MUST use the _PCT companions below rather than
// hand-rolling `* 100` or hardcoding 80 / 90 — a raw literal is how a decimal
// silently ends up compared against a percentage.
export const PERS_FLOOR = 0.80; // below-floor threshold (danger band)
export const PERS_GATE  = 0.90; // award-eligible threshold (success band)

// Percent-scale companions. Derived, never independently literal, so the two
// scales cannot drift apart.
export const PERS_FLOOR_PCT = PERS_FLOOR * 100; // 80
export const PERS_GATE_PCT  = PERS_GATE  * 100; // 90

const LUMPSUMS_FACTOR = 0.10;

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function calculateGrossSettled({ businessPlaced, notTakens, incPPPs, lumpsums100 }) {
  return (num(businessPlaced) - num(notTakens))
    + num(incPPPs)
    + (num(lumpsums100) * LUMPSUMS_FACTOR);
}

export function calculateNetSettled({ grossSettled, lapses, reinstatements }) {
  return num(grossSettled) - num(lapses) + num(reinstatements);
}

export function calculatePersistency({ netSettled, grossSettled }) {
  const gross = num(grossSettled);
  if (gross === 0) return 0;
  return num(netSettled) / gross;
}

// Convenience: takes the six raw inputs and returns the full derived shape.
export function deriveAll(inputs) {
  const grossSettled = calculateGrossSettled(inputs);
  const netSettled = calculateNetSettled({
    grossSettled,
    lapses: inputs.lapses,
    reinstatements: inputs.reinstatements,
  });
  const persistency = calculatePersistency({ netSettled, grossSettled });
  return { grossSettled, netSettled, persistency };
}

// Aggregates a list of agent persistency records by SUMMING the underlying
// numerator and denominator before dividing.
//
// CRITICAL: NEVER average individual persistency percentages — that produces
// a different (wrong) number when agents have different gross-settled values.
// See the explicit anti-test in calculations.test.js.
export function aggregatePersistency(records) {
  const init = {
    sumGrossSettled: 0,
    sumNetSettled: 0,
    sumLapses: 0,
    sumReinstatements: 0,
  };
  if (!Array.isArray(records) || records.length === 0) {
    return { ...init, aggregatedPersistency: 0 };
  }
  const totals = records.reduce((acc, r) => ({
    sumGrossSettled:   acc.sumGrossSettled   + num(r.grossSettled),
    sumNetSettled:     acc.sumNetSettled     + num(r.netSettled),
    sumLapses:         acc.sumLapses         + num(r.lapses),
    sumReinstatements: acc.sumReinstatements + num(r.reinstatements),
  }), init);

  const aggregatedPersistency = totals.sumGrossSettled === 0
    ? 0
    : totals.sumNetSettled / totals.sumGrossSettled;

  return { ...totals, aggregatedPersistency };
}

// Computes reality-bar stats from a set of resolved persistency records.
// Records with non-finite persistency (partial fan-out / no-data rows) are
// excluded from all counts — they do not contribute to the aggregate or the
// floor/gate tallies.
export function computeBarStats(records) {
  const resolved = (records ?? []).filter((r) => r && Number.isFinite(r.persistency));
  return {
    resolvedCount: resolved.length,
    belowFloor:    resolved.filter((r) => r.persistency < PERS_FLOOR).length,
    awardEligible: resolved.filter((r) => r.persistency >= PERS_GATE).length,
    sumLapses:     resolved.reduce((s, r) => s + (Number.isFinite(r.lapses) ? r.lapses : 0), 0),
  };
}

// Projects a future persistency given current state plus a set of forward-
// looking levers. Used by the Playground to show what-if scenarios live.
//
// Mechanics:
//   - newBusinessPlanned and newOrphansAdopted both ADD to gross settled
//     (they are mathematically identical for the persistency calculation).
//   - newReinstatementsPlanned adds to net settled only (not gross).
//   - newLapsesAnticipated reduces net settled (not gross).
//   - goodBusinessFallingOff REDUCES gross settled (rolling 12-month window).
export function projectPersistency({
  currentGrossSettled,
  currentLapses,
  currentReinstatements,
  goodBusinessFallingOff,
  newBusinessPlanned,
  newReinstatementsPlanned,
  newOrphansAdopted,
  newLapsesAnticipated,
}) {
  const projectedGross = num(currentGrossSettled)
    + num(newBusinessPlanned)
    + num(newOrphansAdopted)
    - num(goodBusinessFallingOff);

  const projectedLapses         = num(currentLapses)         + num(newLapsesAnticipated);
  const projectedReinstatements = num(currentReinstatements) + num(newReinstatementsPlanned);

  const projectedNet = projectedGross - projectedLapses + projectedReinstatements;
  const projectedPersistency = projectedGross === 0 ? 0 : projectedNet / projectedGross;

  return {
    projectedGrossSettled:   projectedGross,
    projectedNetSettled:     projectedNet,
    projectedLapses,
    projectedReinstatements,
    projectedPersistency,
  };
}

// Algebraically solves for each lever in isolation: how much new business,
// reinstatements, or orphan adoption (each on its own) is required to hit
// the target persistency? Used by the Playground's three "shortfall" cards.
//
// Algebra (for new business / orphans, both add to gross only):
//   Let baseline = currentGrossSettled - goodBusinessFallingOff.
//   target = (baseline + X − currentLapses + currentReinstatements) / (baseline + X)
//   target * (baseline + X) = (baseline + X) − currentLapses + currentReinstatements
//   (baseline + X) * (1 − target) = currentLapses − currentReinstatements
//   X = (currentLapses − currentReinstatements) / (1 − target) − baseline
//
// For reinstatements (adds to net only, not gross):
//   target = (baseline − currentLapses + currentReinstatements + Y) / baseline
//   Y = baseline * target − baseline + currentLapses − currentReinstatements
//
// Sentinels:
//   - target ≥ 1 → Infinity (impossible via NB/orphans alone, since persistency
//     can equal 1 only when net == gross, which forces NR specifically).
//   - baseline ≤ 0 → 0 for all (no business to support a percentage on).
//   - X or Y ≤ 0 → 0 (already at or above target via that lever).
export function calculateShortfall({
  targetPersistency,
  currentGrossSettled,
  currentLapses,
  currentReinstatements,
  goodBusinessFallingOff,
}) {
  const baseline = num(currentGrossSettled) - num(goodBusinessFallingOff);
  const lapses = num(currentLapses);
  const reins  = num(currentReinstatements);
  const t      = num(targetPersistency);

  if (baseline <= 0) {
    return { nbNeeded: 0, nrNeeded: 0, noNeeded: 0 };
  }

  // NB / Orphans path
  let nbNeeded;
  if (t >= 1) {
    nbNeeded = Infinity;
  } else {
    const requiredGross = (lapses - reins) / (1 - t);
    nbNeeded = Math.max(0, requiredGross - baseline);
  }

  // Reinstatements path
  const nrNeeded = Math.max(0, (baseline * t) - baseline + lapses - reins);

  return {
    nbNeeded,
    nrNeeded,
    noNeeded: nbNeeded, // mathematically identical to NB
  };
}
