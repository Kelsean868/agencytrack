// Premium method per locked API decision. Commission method (344,400) is the lower figure — do NOT use.
// Source: MDRT 2026 Conversion Factor table, Trinidad & Tobago premium column.
// Annual bump: update the numbers here only; all consumers reference this constant.
export const MDRT_THRESHOLDS_2026 = {
  mdrt: 688_800,        // MDRT base (T&T premium, 2026)
  cot:  2_066_400,      // 3 × MDRT base (COT canon)
  tot:  4_132_800,      // 6 × MDRT base (TOT canon)
};
