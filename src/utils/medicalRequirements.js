/**
 * medicalRequirements.js — what underwriting will routinely ask for at a given
 * age and sum assured, and how much more cover the evidence already gathered
 * would support.
 *
 * PURE. No clock, no I/O, no Firestore. The table it reads is effective-dated
 * data in src/config/medicalLimits/2026-04.js.
 *
 * ── THE FEATURE THIS EXISTS FOR ────────────────────────────────────────────
 * A client who has already been through a medical has often paid for more
 * evidence than the cover they bought needs. A 55-year-old issued 750,000 did a
 * Medical, ECG, full blood profile and PSA — and that same evidence supports
 * 2,000,000. Offering the difference costs the client nothing further, and
 * today nobody sees it because the tier table lives on a PDF.
 *
 * ── THE TRAP THIS FUNCTION EXISTS TO AVOID ─────────────────────────────────
 * "Top of the tier minus what was issued" is WRONG, and wrong in the direction
 * that embarrasses an agent in front of a client. Three separate things clamp
 * it, and the naive version ignores all three:
 *
 *   1. The universal thresholds. Crossing 1,500,000 pulls in a financial
 *      statement and an inspection report whatever tier you are in; 3,000,000
 *      adds a urine screen for 16–60.
 *   2. The 5,000,000 ceiling, past which the document itself refuses to say
 *      ("requirements to be determined at the time of underwriting").
 *   3. A Disability Income Rider, which forces a Medical at every sum assured.
 *
 * So the headroom returned here is the amount that genuinely needs NOTHING new
 * from the client. Anything beyond it is reported separately, with what it
 * would cost them — never folded into the free number.
 *
 * ── AGE ─────────────────────────────────────────────────────────────────────
 * `age` is the UNDERWRITING age as Tatil reckons it. This module does not
 * compute it from a date of birth, deliberately: Tatil uses "age next birthday"
 * on at least some products, the revised-limits document does not say which it
 * means, and quietly picking one would shift every band boundary by a year for
 * clients born in the wrong month.
 */
import { MEDICAL_LIMITS_2026_04 } from '../config/medicalLimits/2026-04';

/** The table in force for a given date. One entry today; a revision adds another. */
const TABLES = [MEDICAL_LIMITS_2026_04];

/**
 * limitsInForceOn — the table that governed a case on `dateStr` (YYYY-MM-DD).
 *
 * Cases follow the rules in force when they were written and submitted, per the
 * 25-Mar-2026 memo, so a stored case must be read against ITS table, not
 * today's. Returns null before the earliest table rather than falling back to
 * the newest — an answer from the wrong table is worse than no answer.
 */
export function limitsInForceOn(dateStr) {
  const candidates = TABLES
    .filter((t) => typeof dateStr === 'string' && dateStr >= t.effective)
    .sort((a, b) => b.effective.localeCompare(a.effective));
  return candidates[0] ?? null;
}

const inBand = (band, age) =>
  age >= band.minAge && (band.maxAge === null || age <= band.maxAge);

/** The age band covering `age`, or null when the age is not a usable number. */
export function bandFor(age, table = MEDICAL_LIMITS_2026_04) {
  if (!Number.isFinite(age) || age < 0) return null;
  return table.bands.find((b) => inBand(b, age)) ?? null;
}

/** The tier a sum assured falls in. Tiers are ascending; the last has upTo null. */
function tierFor(band, sumAssured) {
  return band.tiers.find((t) => t.upTo === null || sumAssured <= t.upTo) ?? null;
}

/** Universal rules that bite at or above `sumAssured` for this age. */
function universalAt(table, age, sumAssured) {
  return table.universal
    .filter((u) => inBand(u, age) && sumAssured >= u.from)
    .map((u) => u.requirement);
}

/** The next universal threshold strictly above `sumAssured`, or Infinity. */
function nextUniversalAbove(table, age, sumAssured) {
  const thresholds = table.universal
    .filter((u) => inBand(u, age) && u.from > sumAssured)
    .map((u) => u.from);
  return thresholds.length ? Math.min(...thresholds) : Infinity;
}

/**
 * requirementsFor — what underwriting will routinely ask for.
 *
 * @param {object} args
 * @param {number} args.age                 underwriting age (see module header)
 * @param {number} args.sumAssured          the cover applied for, TTD
 * @param {boolean} [args.hasDisabilityIncomeRider=false]
 * @param {object} [args.table]             defaults to the current table
 * @returns {{
 *   ok: boolean, reason?: string, exam?: string, requirements?: string[],
 *   determinedAtUnderwriting?: boolean, tierCeiling?: number|null
 * }}
 *
 * `ok: false` is returned rather than a guess whenever the table cannot answer.
 */
export function requirementsFor({
  age,
  sumAssured,
  hasDisabilityIncomeRider = false,
  table = MEDICAL_LIMITS_2026_04,
}) {
  if (!Number.isFinite(sumAssured) || sumAssured <= 0) {
    return { ok: false, reason: 'sumAssured must be a positive number' };
  }
  const band = bandFor(age, table);
  if (!band) return { ok: false, reason: 'no age band covers age ' + age };

  // The document stops specifying here. Say so; do not extrapolate the top tier
  // upward, because the top tier is not what underwriting will actually apply.
  if (sumAssured >= table.determinedAtUnderwritingFrom) {
    return {
      ok: true,
      determinedAtUnderwriting: true,
      exam: 'Medical',
      requirements: ['Requirements to be determined at the time of underwriting'],
      tierCeiling: null,
    };
  }

  const tier = tierFor(band, sumAssured);
  if (!tier) return { ok: false, reason: 'no tier covers ' + sumAssured };

  const requirements = [...tier.requirements, ...universalAt(table, age, sumAssured)];
  let { exam } = tier;

  // The DIR override. Applied LAST and unconditionally: it outranks the band,
  // the tier and the sum assured, and a case that was Non-Medical a moment ago
  // is now a Medical.
  if (hasDisabilityIncomeRider && table.disabilityIncomeRiderRequiresMedical) {
    exam = 'Medical';
    if (!requirements.includes('Medical')) {
      requirements.unshift('Medical');
    }
    requirements.push('Medical required because a Disability Income Rider is attached');
  }

  return {
    ok: true,
    determinedAtUnderwriting: false,
    exam,
    requirements,
    tierCeiling: tier.upTo,
  };
}

/**
 * headroomFor — how much MORE cover the evidence already gathered supports.
 *
 * @returns {{
 *   ok: boolean, reason?: string,
 *   ceiling: number|null,      // most cover obtainable with nothing new
 *   headroom: number,          // ceiling - issuedCoverage, never negative
 *   free: boolean,             // true when headroom > 0 and needs nothing new
 *   clampedBy: 'tier'|'universal'|'underwriting-ceiling'|null,
 *   nextStep: { at: number, adds: string[] } | null
 * }}
 *
 * `free` is the whole point of the function and is deliberately conservative:
 * it is true only when the client would have to do nothing at all.
 */
export function headroomFor({
  age,
  issuedCoverage,
  hasDisabilityIncomeRider = false,
  table = MEDICAL_LIMITS_2026_04,
}) {
  const base = requirementsFor({
    age, sumAssured: issuedCoverage, hasDisabilityIncomeRider, table,
  });
  if (!base.ok) {
    return { ok: false, reason: base.reason, ceiling: null, headroom: 0, free: false, clampedBy: null, nextStep: null };
  }
  if (base.determinedAtUnderwriting) {
    return {
      ok: true, ceiling: null, headroom: 0, free: false,
      clampedBy: 'underwriting-ceiling',
      reason: 'at or above ' + table.determinedAtUnderwritingFrom
        + ', requirements are set case by case — no headroom can be asserted',
      nextStep: null,
    };
  }

  const band = bandFor(age, table);
  const tierCeiling = base.tierCeiling ?? Infinity;
  const nextUniversal = nextUniversalAbove(table, age, issuedCoverage);
  const hardCeiling = table.determinedAtUnderwritingFrom;

  // The lowest of the three clamps wins. `- 1` on the universal and hard
  // ceilings because those rules bite AT the threshold, not above it.
  const candidates = [
    { at: tierCeiling, by: 'tier' },
    { at: nextUniversal === Infinity ? Infinity : nextUniversal - 1, by: 'universal' },
    { at: hardCeiling - 1, by: 'underwriting-ceiling' },
  ].sort((a, b) => a.at - b.at);

  const ceiling = candidates[0].at;
  const clampedBy = Number.isFinite(ceiling) ? candidates[0].by : null;
  const headroom = Math.max(0, ceiling - issuedCoverage);

  // What the client would have to do to go past the ceiling — so the offer can
  // say "and beyond that you'd need X" rather than pretending the wall is a
  // cliff. Computed one dollar above the ceiling.
  let nextStep = null;
  if (Number.isFinite(ceiling)) {
    const beyond = requirementsFor({
      age, sumAssured: ceiling + 1, hasDisabilityIncomeRider, table,
    });
    if (beyond.ok) {
      const already = new Set(base.requirements);
      const adds = beyond.requirements.filter((r) => !already.has(r));
      nextStep = { at: ceiling + 1, adds };
    }
  }

  return {
    ok: true,
    ceiling: Number.isFinite(ceiling) ? ceiling : null,
    headroom,
    free: headroom > 0,
    clampedBy,
    nextStep,
    band: band ? { minAge: band.minAge, maxAge: band.maxAge } : null,
  };
}
