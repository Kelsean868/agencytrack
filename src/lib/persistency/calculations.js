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
