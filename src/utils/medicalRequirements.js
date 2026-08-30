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
 * ── AGE: NEXT BIRTHDAY ──────────────────────────────────────────────────────
 * **Tatil reckons age as AGE NEXT BIRTHDAY, for premiums and for these medical
 * requirements alike** (operator, 30 Aug 2026). Age next birthday is the age
 * the client will turn on their next birthday, so it is ALWAYS attained age
 * plus one — it is a constant offset, not a mid-year switch.
 *
 * That single year is not a rounding detail. It moves every band boundary, and
 * the one that costs money is 50/51: a client whose attained age is 50 is
 * underwritten at 51, where **there is no non-medical band at all**. Tell them
 * "non-medical up to 500,000" off their attained age and they arrive at a
 * paramedical they were not warned about.
 *
 * So `age` here is ALWAYS age next birthday. Callers that hold a date of birth
 * should pass `dateOfBirth` + `asOf` instead and let `ageNextBirthday()` derive
 * it — passing a hand-computed `age` is supported, but it is the caller's
 * promise that the number is ANB.
 *
 * `asOf` is required rather than defaulted, because this module is pure and has
 * no clock. Pass `getTodayTT()` from utils/dateInputs when you mean today —
 * Trinidad is UTC-4 with no DST, so a UTC "today" is the previous calendar day
 * for four hours every evening, which at a birthday boundary is a wrong band.
 */
import { MEDICAL_LIMITS_2026_04 } from '../config/medicalLimits/2026-04';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse YYYY-MM-DD into [y, m, d], or null if it is not a real calendar date. */
function parts(s) {
  const m = typeof s === 'string' && DATE_RE.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Round-trip through UTC to reject 2026-02-30 and friends, which Date would
  // otherwise roll forward into March without complaining.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return [y, mo, d];
}

/**
 * ageNextBirthday — the age Tatil underwrites and rates at.
 *
 * @param {string} dateOfBirth  YYYY-MM-DD
 * @param {string} asOf         YYYY-MM-DD — the date the case is reckoned at
 * @returns {number|null} age next birthday, or null on an unusable input
 *
 * Always attained age + 1. On the client's birthday itself they have just
 * turned N, so their next birthday is N+1 — the answer steps up on the
 * birthday, exactly as attained age does.
 *
 * 29 February: a client born on a leap day has no birthday in a common year,
 * and this treats 1 March as the day it steps. That is a choice, not a fact
 * from the document; it affects one day a year for one cohort.
 */
export function ageNextBirthday(dateOfBirth, asOf) {
  const dob = parts(dateOfBirth);
  const at = parts(asOf);
  if (!dob || !at) return null;
  const [by, bm, bd] = dob;
  const [ay, am, ad] = at;
  if (ay < by || (ay === by && (am < bm || (am === bm && ad < bd)))) return null; // not yet born
  let attained = ay - by;
  if (am < bm || (am === bm && ad < bd)) attained -= 1;
  return attained + 1;
}

/**
 * resolveAge — accept EITHER a pre-computed ANB or a date of birth, never both.
 *
 * Refusing the both-given case is deliberate: two sources of truth for the age
 * is how a caller ends up silently trusting the wrong one.
 */
function resolveAge({ age, dateOfBirth, asOf }) {
  if (dateOfBirth != null && age != null) {
    return { ok: false, reason: 'pass age (already age next birthday) OR dateOfBirth, not both' };
  }
  if (dateOfBirth != null) {
    if (asOf == null) {
      return { ok: false, reason: 'asOf (YYYY-MM-DD) is required with dateOfBirth — this module has no clock' };
    }
    const anb = ageNextBirthday(dateOfBirth, asOf);
    if (anb === null) {
      return { ok: false, reason: 'dateOfBirth / asOf must be real YYYY-MM-DD dates with asOf on or after dateOfBirth' };
    }
    return { ok: true, age: anb };
  }
  return { ok: true, age };
}

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
 * @param {number} [args.age]               age NEXT BIRTHDAY (see module header)
 * @param {string} [args.dateOfBirth]       YYYY-MM-DD — derives the age instead
 * @param {string} [args.asOf]              YYYY-MM-DD — required with dateOfBirth
 * @param {number} args.sumAssured          the cover applied for, TTD
 * @param {boolean} [args.hasDisabilityIncomeRider=false]
 * @param {object} [args.table]             defaults to the current table
 * @returns {{
 *   ok: boolean, reason?: string, exam?: string, requirements?: string[],
 *   determinedAtUnderwriting?: boolean, tierCeiling?: number|null, age?: number
 * }}
 *
 * `ok: false` is returned rather than a guess whenever the table cannot answer.
 * The resolved `age` is echoed back on success, so a caller that passed a date
 * of birth can show the client which age the answer was reckoned at.
 */
export function requirementsFor({
  age: ageIn,
  dateOfBirth,
  asOf,
  sumAssured,
  hasDisabilityIncomeRider = false,
  table = MEDICAL_LIMITS_2026_04,
}) {
  const resolved = resolveAge({ age: ageIn, dateOfBirth, asOf });
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const age = resolved.age;

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
      age,
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
    age,
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
  age: ageIn,
  dateOfBirth,
  asOf,
  issuedCoverage,
  hasDisabilityIncomeRider = false,
  table = MEDICAL_LIMITS_2026_04,
}) {
  const resolved = resolveAge({ age: ageIn, dateOfBirth, asOf });
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, ceiling: null, headroom: 0, free: false, clampedBy: null, nextStep: null };
  }
  const age = resolved.age;

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
    age,
    ceiling: Number.isFinite(ceiling) ? ceiling : null,
    headroom,
    free: headroom > 0,
    clampedBy,
    nextStep,
    band: band ? { minAge: band.minAge, maxAge: band.maxAge } : null,
  };
}
