/**
 * deriveAnnualApps — single-source apps derivation for all Year Plan / commit
 * surfaces. Every ÷ avgPolicyAPI calculation routes through here.
 *
 * @param {number} annualAPI    — full-year API target (TTD)
 * @param {number} avgPolicyAPI — agent's average annual API per policy (default 12 000)
 * @returns {number}            — raw (un-rounded) apps count; callers round as needed
 */
export function deriveAnnualApps(annualAPI, avgPolicyAPI = 12000) {
  const api = parseFloat(annualAPI) || 0;
  const avg = parseFloat(avgPolicyAPI);
  if (!avg || avg <= 0) return 0;
  return api / avg;
}
