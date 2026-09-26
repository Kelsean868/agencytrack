// Premium method per locked API decision. Commission method (344,400) is the lower figure — do NOT use.
// Source: MDRT 2026 Conversion Factor table, Trinidad & Tobago premium column.
// Annual bump: update the numbers here only; all consumers reference this constant.
export const MDRT_THRESHOLDS_2026 = {
  mdrt: 688_800,        // MDRT base (T&T premium, 2026)
  cot:  2_066_400,      // 3 × MDRT base (COT canon)
  tot:  4_132_800,      // 6 × MDRT base (TOT canon)
};

// The Awards-tab MDRT award's "in contention" marker — 50% of the MDRT base,
// the same ratio the award used when its threshold was still the flat 500,000
// figure (250,000 = 50%). NOT the same number as the T&T "commission method"
// MDRT figure above (also 344,400) — that coincidence is unrelated; this is a
// contention-pace marker, not an alternate MDRT base. Orchestrator decision,
// PR #MX (2026-09-26), closing FOLLOW_UPS "Awards-tab MDRT award line".
export const MDRT_AWARD_API_IN_CONTENTION_2026 = Math.round(MDRT_THRESHOLDS_2026.mdrt * 0.5);

/**
 * The MDRT award's live thresholds — always the real MDRT line
 * (`MDRT_THRESHOLDS_2026.mdrt`), never a stored ruleset's `mdrtAward.apiThreshold`.
 * `ruleset` is read only for `mdrtAward.prize`, which stays tenant-editable.
 * @param {object} [ruleset] - DEFAULT_RULESET_2026 (or compatible), optional.
 */
export function mdrtAwardThresholds(ruleset) {
  return {
    apiThreshold: MDRT_THRESHOLDS_2026.mdrt,
    apiInContention: MDRT_AWARD_API_IN_CONTENTION_2026,
    prize: ruleset?.mdrtAward?.prize,
  };
}
