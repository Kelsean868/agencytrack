// Track K — New-Agent Financing & Bonus default ruleset (2026).
//
// Sibling to config/awardsRuleset/2026.js, kept decoupled (financing rules are a
// separate layer from the incentive awards — design spec §1). All TTD/percent
// values below are the contract figures (TATIL "New Salesperson's Bonus and
// Financing Agreement", rev. 2017) CONFIRMED CURRENT FOR 2026 by the product
// owner (locked-decisions addendum A.1). They are seeded here as configurable
// ruleset values — the engine NEVER hardcodes them.
//
// Authority: docs/design/track-k-locked-decisions.md (A.1/A.2/A.3/A.5) supersedes
// the design spec's §3/§4 working interpretations where they differ.

export const DEFAULT_FINANCING_RULESET_2026 = {
  // ── Quarterly qualification gate ──
  // Gross New Settled API ≥ this per quarter (contract 3.x; A.1 confirms 2026).
  quarterlyGrossMin: 37500,

  // Persistency gates as FRACTIONS (0–1). The engine compares the app-validated
  // persistency figure (passed in, A.5 — never clause 1.6) on this same scale,
  // so callers must normalise a 0–100 figure to 0–1 before passing it in.
  persistencyY1: 0.95, // year 1 of agreement
  persistencyY2: 0.90, // year 2 of agreement

  // ── Quarterly bonus rates ──
  // Base = Net New Settled API for Persistency (addendum A.2, authoritative —
  // supersedes spec §4's Net-for-Production working interp).
  consistencyRate: 0.15,   // consistency bonus = consistencyRate × Net-for-Persistency / qtr
  productionRateY1: 0.15,  // production bonus (year 1) × Net-for-Persistency / qtr
  productionRateY2: 0.20,  // production bonus (year 2) × Net-for-Persistency / qtr

  // ── Financing-specific credit filter (per newBusinessType; addendum A.3) ──
  // NOT the awards engine's creditableAPI (spec §2.8). nb_ordinary full credit;
  // inc_ppp / lumpsum credited at 10% (the contract's "+10% LSD / +10% inc-PPP");
  // platinum_edge / replacement / spia excluded (A.3: replacement & spia BOTH 0%).
  // Unknown types fall through to 0 in the engine (safe default).
  creditMap: {
    nb_ordinary: 1.0,
    inc_ppp: 0.10,
    lumpsum: 0.10,
    platinum_edge: 0,
    replacement: 0,
    spia: 0,
  },
  // isSelfOrFamily === true → excluded regardless of newBusinessType (awards parity).
  selfOrFamilyWeight: 0,

  // ── Staff policy treatment (addendum A.4 — OPEN; product-owner default 'count') ──
  // 'count'   = staff policies counted per their own newBusinessType. The functional
  //             default: the ledger carries NO staff flag, so staff are indistinguishable
  //             and naturally counted (A.4 "if counted → no staff flag needed, K3 simplifies").
  // 'exclude' = DECLARED BUT INERT. It can only act on a policy line carrying isStaff===true,
  //             and no ledger field sets that today, so it is a no-op until a staff flag exists
  //             (banked FU). Flipping this is config, not code (Decision 3).
  staffPolicyTreatment: 'count',

  // ── Take-home calc (K4) ──
  // Tax deducted from gross bonus before the 50% financing split (locked §2.1 / A.1).
  // Both are configurable ruleset placeholders — financingTakeHome.js reads them;
  // the calc NEVER hardcodes them. Update here when the contract is renegotiated.
  taxRate: 0.25,              // 25% income tax (2017-vintage; configurable)
  financingPortionRate: 0.50, // 50% of net bonus → financing repayment while owing

  // ── Annual bonus-rate tiers (annual Gross New Settled API; A.1 confirms 2026) ──
  // totalRate = apiRate + (livesQualified ? livesRate : 0). Lives portion requires
  // livesPolicyMin net policies settled. Bands evaluated in order; maxGross is
  // INCLUSIVE — so exactly $200,000 falls in the 25% band ("$150K–$200K → 25%"),
  // and only strictly-above-$200K reaches the 30% band (contract §4).
  rateTiers: [
    { minGross: 150000, maxGross: 200000, apiRate: 0.20, livesRate: 0.05 }, // → 25% total
    { minGross: 200000, maxGross: null,   apiRate: 0.25, livesRate: 0.05 }, // → 30% total
  ],
  livesPolicyMin: 80, // net policies settled for the 5% lives portion

  // Annual Bonus Adjustment qualifying floor (= lowest rate-tier floor). The
  // adjustment is paid only if annual Gross settled ≥ this AND it tops up above
  // consistency+production already paid (Decision 5).
  minAnnualGross: 150000,
};
