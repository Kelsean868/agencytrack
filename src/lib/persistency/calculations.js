// E3 — Pure persistency calculations.
//
// Formula, in the vocabulary of the Tatil Life memo "Introduction of the
// Updated 24-Month Persistency Model" (A. Rauseo, 29 Aug 2026), effective from
// September 2026 persistency onwards:
//
//   Net Gross Settled = Gross Settled − Not Takens − Decreases
//                       + Increases + (10% × Lumpsums)
//   Net Settled       = Net Gross Settled − Lapses + Reinstatements
//   Persistency       = Net Settled / Net Gross Settled
//
// STORED IDS ARE LEGACY NAMES, KEPT DELIBERATELY (P-D1) — renaming fields on
// money documents is a migration for a cosmetic gain. Read this mapping before
// trusting any name here, because two of them collide with the memo's terms:
//
//   stored id        the memo calls it     note
//   ─────────        ─────────────────     ────
//   businessPlaced   "Gross Settled"       an INPUT
//   notTakens        "Not Takens"
//   decreases        "Decreases"           the one term the memo ADDS
//   incPPPs          "Increases"
//   lumpsums100      "Lumpsums"            the 10% factor is applied here
//   lapses           "Lapses"
//   reinstatements   "Reinstatements"
//   grossSettled     "Net Gross Settled"   DERIVED — not the memo's "Gross Settled"
//   netSettled       "Net Settled"         DERIVED
//
// So "Gross Settled" names the INPUT businessPlaced in the memo and the DERIVED
// denominator in this file. The label maps in ./model.js are the layer that
// renders the memo's words; never render a stored id directly.
//
// EFFECTIVE DATING: `decreases` is required only on report months >= '2026-09'
// (P-D2) and is never back-filled. It defaults to 0 through num(), so every
// legacy call site and every pre-September document derives exactly the number
// it derived before this term existed — pinned by the Ricardo Duke regression
// test in __tests__/calculations.test.js. Which model a month is on is decided
// solely by persistencyModelFor(monthKey) in ./model.js.
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

// Returns the memo's "Net Gross Settled" — the persistency DENOMINATOR.
//
// `decreases` is the term the 29 Aug 2026 memo adds. It defaults to 0 through
// num(), so omitting it reproduces the pre-memo result bit for bit. Callers on
// 24-month-model months MUST pass it; savePersistency refuses such a save when
// it is missing rather than letting a silent 0 stand in for an unentered figure.
export function calculateGrossSettled({
  businessPlaced, notTakens, decreases, incPPPs, lumpsums100,
}) {
  return (num(businessPlaced) - num(notTakens) - num(decreases))
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

// Convenience: takes the raw inputs (six on the legacy model, seven with
// `decreases` on the 24-month model) and returns the full derived shape.
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
//   - newBusinessPlanned ADDS to gross settled: the agent wrote that business,
//     so it belongs in her denominator.
//   - newOrphansAdopted does NOT, by default. The denominator belongs to the
//     WRITING agent — she did not write an orphan she adopted, so an
//     under-24-month orphan policy never enters her gross. If she gets it
//     reinstated, that value lands in NET only, exactly like any other
//     reinstatement. Net can then exceed gross, which is what allows a
//     projection legitimately above 100% (see also the P4b guard in
//     PersistencyPlayground.jsx, which must never clamp that case).
//   - That behaviour is settable per tenant, because persistency counting
//     rules vary by carrier: companyMinimums.orphanAdoptionEntersDenominator.
//     Default (absent/false) = numerator-only, the rule above. Set true and an
//     adopted orphan counts like business the agent wrote (adds to gross),
//     which is the pre-P5 behaviour. calculations.js never reads config — the
//     resolved boolean arrives as the `orphansEnterDenominator` parameter.
//   - newReinstatementsPlanned adds to net settled only (not gross).
//   - newLapsesAnticipated reduces net settled (not gross).
//   - goodBusinessFallingOff REDUCES gross settled (rolling window — 24
//     months from Sept 2026, 12 before; see ./model.js). Arithmetic is the
//     same either way; only the span the caller reckons over changes.
//   - decreasesAnticipated REDUCES gross settled the same way. It is the
//     memo's `Decreases` term (P4, see calculateGrossSettled above) modelled
//     forward rather than read from a stored document — a decrease lowers
//     the denominator, and the numerator falls with it, so persistency
//     drops. Defaults to 0 through num(), so every existing call site that
//     omits it derives exactly what it derived before this parameter
//     existed.
export function projectPersistency({
  currentGrossSettled,
  currentLapses,
  currentReinstatements,
  goodBusinessFallingOff,
  newBusinessPlanned,
  newReinstatementsPlanned,
  newOrphansAdopted,
  newLapsesAnticipated,
  decreasesAnticipated,
  orphansEnterDenominator = false,
}) {
  // The adopted orphan goes to exactly one side of the fraction, never both.
  const orphansToGross = orphansEnterDenominator ? num(newOrphansAdopted) : 0;
  const orphansToNet   = orphansEnterDenominator ? 0 : num(newOrphansAdopted);

  const projectedGross = num(currentGrossSettled)
    + num(newBusinessPlanned)
    + orphansToGross
    - num(goodBusinessFallingOff)
    - num(decreasesAnticipated);

  const projectedLapses         = num(currentLapses)         + num(newLapsesAnticipated);
  const projectedReinstatements = num(currentReinstatements)
    + num(newReinstatementsPlanned)
    + orphansToNet;

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
// Which algebra `noNeeded` follows is decided by `orphansEnterDenominator`
// (companyMinimums.orphanAdoptionEntersDenominator, resolved by the caller —
// see projectPersistency above). By DEFAULT an adopted orphan lifts the
// numerator only, so `noNeeded` tracks the REINSTATEMENTS solution, not the
// new-business one. That difference is the whole point of this parameter: on
// the §2 worked example (baseline 100,000, lapses 15,000, target 90%) the
// truthful orphan figure is 5,000, where the new-business figure is 50,000 —
// ten times larger. Set true and `noNeeded` returns to tracking nbNeeded.
//
// Algebra (for new business, and for orphans only when they enter gross):
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
//   - target ≥ 1 → Infinity for nbNeeded, since persistency can equal 1 only
//     when net == gross, which no amount of gross-side business can force.
//     noNeeded is Infinity too ONLY when orphansEnterDenominator is true; on
//     the default it follows the finite nrNeeded, because a numerator-only
//     orphan reaches 100% exactly as a reinstatement does.
//   - baseline ≤ 0 → 0 for all (no business to support a percentage on).
//   - X or Y ≤ 0 → 0 (already at or above target via that lever).
//
// `decreasesAnticipated` (P4) shrinks the baseline the same way
// goodBusinessFallingOff does — it is the memo's `Decreases` term modelled
// forward, not the stored input. Defaults to 0, so omitting it reproduces
// the pre-P4 result.
export function calculateShortfall({
  targetPersistency,
  currentGrossSettled,
  currentLapses,
  currentReinstatements,
  goodBusinessFallingOff,
  decreasesAnticipated,
  orphansEnterDenominator = false,
}) {
  const baseline = num(currentGrossSettled)
    - num(goodBusinessFallingOff)
    - num(decreasesAnticipated);
  const lapses = num(currentLapses);
  const reins  = num(currentReinstatements);
  const t      = num(targetPersistency);

  if (baseline <= 0) {
    return { nbNeeded: 0, nrNeeded: 0, noNeeded: 0 };
  }

  // Gross-side path: new business always, orphans only when they enter gross.
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
    noNeeded: orphansEnterDenominator ? nbNeeded : nrNeeded,
  };
}
