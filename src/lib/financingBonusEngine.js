// Track K3 — financing bonus engine (pure module).
//
// Pure computation: zero Firebase imports, zero import.meta.env, zero side
// effects, fully deterministic. Mirrors src/utils/awardsEngine.js — the ruleset
// is passed in (defaulted), the engine NEVER fetches data. Callers (K4 take-home,
// K8 dashboard) normalise ledger/settlement/persistency data and pass it in.
//
// Contract authority: docs/track-k-financing-new-agent-design.md §3/§4, with
// docs/design/track-k-locked-decisions.md A.2/A.3/A.5 SUPERSEDING the spec's
// working interpretations where they differ — most importantly:
//   • quarterly bonus base = Net New Settled API for Persistency  (A.2, not spec §4's Production)
//   • annual-adjustment base = Net New Settled API for Production  (A.2 / contract 1.8)
//   • credit map: replacement & spia BOTH 0%                       (A.3)
//   • persistency = app-validated figure, passed in                (A.5, never clause 1.6)

import { DEFAULT_FINANCING_RULESET_2026 } from '../config/financingRuleset/2026';

// parseFloat-or-zero (project rule: never trust string/undefined numerics).
const p = (v) => parseFloat(v) || 0;

// ──────────────────────────────────────────────────────
// creditWeight — the financing-specific per-policy credit filter (addendum A.3).
// policy: { newBusinessType, isSelfOrFamily?, isStaff? }
// Returns the credit fraction (1.0 / 0.10 / 0) applied to that policy's API.
//   • isSelfOrFamily === true            → selfOrFamilyWeight (0), regardless of type
//   • staffPolicyTreatment === 'exclude'
//       AND policy.isStaff === true       → 0  (DECLARED BUT INERT — no ledger field
//                                              sets isStaff today, so this never fires
//                                              until a staff flag exists; Decision 3)
//   • otherwise                           → creditMap[newBusinessType] ?? 0 (unknown → 0)
// ──────────────────────────────────────────────────────
export function creditWeight(policy, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const pol = policy ?? {};
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026; // explicit null bypasses the default param
  if (pol.isSelfOrFamily === true) return rs.selfOrFamilyWeight ?? 0;
  if (rs.staffPolicyTreatment === 'exclude' && pol.isStaff === true) return 0;
  const w = rs.creditMap?.[pol.newBusinessType];
  return typeof w === 'number' ? w : 0;
}

// ──────────────────────────────────────────────────────
// computeApiChain — the contract's API definitions for one period's policy lines.
// policies: Array<{ newBusinessType, settledAPI, isSelfOrFamily?, isStaff? }> on the
//   period's operative basis (submitted-final for Q1, settled-confirmed for Q2+).
// opts: { notTakenAPI, lapsedSurrenderedUnder2yrAPI, reinstatedUnder2yrAPI }
// Returns { gross, netPersistency, netProduction, lsdIncPppCredit }.
//   gross           (1.2) = Σ settledAPI × creditWeight − not-takens
//   lsdIncPppCredit       = the credited 10% portion from lumpsum + inc_ppp lines
//   netPersistency  (1.4) = gross − lapsed/surrendered(<2yr) + reinstatements(<2yr)
//   netProduction   (1.5) = netPersistency − lsdIncPppCredit
// ──────────────────────────────────────────────────────
export function computeApiChain(policies, opts = {}, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const lines = Array.isArray(policies) ? policies : [];
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026; // explicit null bypasses the default param
  const o = opts ?? {};
  let gross = 0;
  let lsdIncPppCredit = 0;

  for (const pol of lines) {
    const credited = p(pol?.settledAPI) * creditWeight(pol, rs);
    gross += credited;
    if (pol?.newBusinessType === 'lumpsum' || pol?.newBusinessType === 'inc_ppp') {
      lsdIncPppCredit += credited;
    }
  }

  gross -= p(o.notTakenAPI);

  const netPersistency =
    gross - p(o.lapsedSurrenderedUnder2yrAPI) + p(o.reinstatedUnder2yrAPI);
  const netProduction = netPersistency - lsdIncPppCredit;

  return { gross, netPersistency, netProduction, lsdIncPppCredit };
}

// ──────────────────────────────────────────────────────
// computeQuarterGate — quarterly qualification (Decision 4).
// args: { gross, persistency (fraction 0–1), quarter (1–4), yearInAgreement (1|2) }
// Q1 exception (contract 3.3 / addendum CD#3): $37,500 gate on the SUBMITTED basis
// the caller supplies, NO persistency test. Q2+: gross gate AND persistency gate
// (95% year 1 / 90% year 2).
// ──────────────────────────────────────────────────────
export function computeQuarterGate(args = {}, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const a = args ?? {};
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026; // explicit null bypasses the default param
  // parseInt so string '1'/'2' don't silently break the Q1 exception or the year gate.
  const q = parseInt(a.quarter, 10) || 0;
  const yia = parseInt(a.yearInAgreement, 10) || 1; // unknown → year 1 (the stricter 95% gate)
  const isQ1Exception = q === 1;
  const grossGateMet = p(a.gross) >= rs.quarterlyGrossMin;
  const persGate = yia === 2 ? rs.persistencyY2 : rs.persistencyY1;
  const persistencyGateMet = isQ1Exception ? true : p(a.persistency) >= persGate;
  return {
    grossGateMet,
    persistencyGateMet,
    qualified: grossGateMet && persistencyGateMet,
    isQ1Exception,
  };
}

// ──────────────────────────────────────────────────────
// resolveRateTier — annual bonus-rate tier from annual Gross (Decision 6).
// Bands evaluated in ruleset order; maxGross INCLUSIVE (exactly $200K → 25% band).
// Returns the matching tier object, or null below the lowest floor (no adjustment).
// ──────────────────────────────────────────────────────
export function resolveRateTier(annualGross, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const g = p(annualGross);
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026; // explicit null bypasses the default param
  for (const tier of rs.rateTiers ?? []) {
    if (g >= tier.minGross && (tier.maxGross === null || g <= tier.maxGross)) return tier;
  }
  return null;
}

// ──────────────────────────────────────────────────────
// computeFinancingBonus — the orchestrator.
//
// @param {object} input
//   input.yearInAgreement {1|2}   selects persistency gate + production rate
//   input.quarter {1|2|3|4}       quarter===1 triggers the Q1 gate exception
//   input.policies []             the quarter's policy lines on its operative basis
//   input.notTakenAPI?            not-takens subtracted from Gross (1.2)
//   input.lapsedSurrenderedUnder2yrAPI?   subtract for Net-for-Persistency (1.4)
//   input.reinstatedUnder2yrAPI?          add for Net-for-Persistency (1.4)
//   input.persistency?            app-validated persistency, FRACTION 0–1 (A.5)
//   input.annual?                 annual roll-up; OMIT to skip the annual adjustment
//     input.annual.grossAPI            annual Gross (drives the rate tier)
//     input.annual.netProductionAPI    annual Net-for-Production (adjustment base, 1.8)
//     input.annual.netPoliciesSettled  net policies settled (the 80-lives test)
//     input.annual.priorBonusesPaidYTD consistency+production already paid this year
//
// @returns flat result: { gross, netPersistency, netProduction, lsdIncPppCredit,
//   gates, consistencyBonus, productionBonus, rateTier, livesQualified,
//   totalBonusRate, annualQualifyingAmount, annualGateMet, annualAdjustment }
// ──────────────────────────────────────────────────────
export function computeFinancingBonus(input = {}, ruleset = DEFAULT_FINANCING_RULESET_2026) {
  const inp = input ?? {};
  const rs = ruleset ?? DEFAULT_FINANCING_RULESET_2026; // explicit null bypasses the default param
  const yia = parseInt(inp.yearInAgreement, 10) || 1;   // string '2' must select the year-2 rates

  const { gross, netPersistency, netProduction, lsdIncPppCredit } = computeApiChain(
    inp.policies,
    {
      notTakenAPI: inp.notTakenAPI,
      lapsedSurrenderedUnder2yrAPI: inp.lapsedSurrenderedUnder2yrAPI,
      reinstatedUnder2yrAPI: inp.reinstatedUnder2yrAPI,
    },
    rs,
  );

  const gates = computeQuarterGate(
    {
      gross,
      persistency: inp.persistency,
      quarter: inp.quarter,
      yearInAgreement: yia,
    },
    rs,
  );

  // Quarterly bonuses — base is Net-for-Persistency (A.2). Paid only when qualified.
  const productionRate = yia === 2 ? rs.productionRateY2 : rs.productionRateY1;
  const consistencyBonus = gates.qualified ? rs.consistencyRate * netPersistency : 0;
  const productionBonus = gates.qualified ? productionRate * netPersistency : 0;

  // Annual Bonus Adjustment — base is Net-for-Production (A.2 / 1.8); top-up only.
  let rateTier = null;
  let livesQualified = false;
  let totalBonusRate = 0;
  let annualQualifyingAmount = 0;
  let annualGateMet = false;
  let annualAdjustment = 0;

  if (inp.annual) {
    const annualGross = p(inp.annual.grossAPI);
    rateTier = resolveRateTier(annualGross, rs);
    annualGateMet = annualGross >= rs.minAnnualGross;
    livesQualified = p(inp.annual.netPoliciesSettled) >= rs.livesPolicyMin;
    if (rateTier) {
      totalBonusRate = rateTier.apiRate + (livesQualified ? rateTier.livesRate : 0);
      annualQualifyingAmount = p(inp.annual.netProductionAPI) * totalBonusRate;
      if (annualGateMet) {
        annualAdjustment = Math.max(
          0,
          annualQualifyingAmount - p(inp.annual.priorBonusesPaidYTD),
        );
      }
    }
  }

  return {
    gross,
    netPersistency,
    netProduction,
    lsdIncPppCredit,
    gates,
    consistencyBonus,
    productionBonus,
    rateTier,
    livesQualified,
    totalBonusRate,
    annualQualifyingAmount,
    annualGateMet,
    annualAdjustment,
  };
}
