import { extractFields } from './extractFields';

/**
 * Computes the trailing 2-year average annual API from submission docs.
 * Sums each report's API (through extractFields: v2 newBusiness.api, v1
 * apiSold / api / annualPremium — F-2) from the reference year and the prior year, then divides by 2.
 * Agents < 2 years in naturally produce a lower average (prior year sums to 0).
 *
 * @param {object[]} submissions - all agent submission docs
 * @param {number}   referenceYear - the current calendar year
 * @returns {number} trailing 2-year average API
 */
export function compute2YearAverageAPI(submissions, referenceYear) {
  const yearKeys = [String(referenceYear), String(referenceYear - 1)];
  let total = 0;
  for (const sub of (submissions ?? [])) {
    if (sub.status !== 'submitted') continue;
    if (!yearKeys.some((k) => (sub.weekStarting ?? '').startsWith(k))) continue;
    total += extractFields(sub).apiSold || 0;
  }
  return total / 2;
}
