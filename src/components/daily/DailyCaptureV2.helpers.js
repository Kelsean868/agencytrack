/**
 * Pure helpers for DailyCaptureV2 — kept out of the component file so
 * Fast Refresh (react-refresh/only-export-components) stays happy and so
 * the count-strip math is testable in isolation.
 *
 * Binds to verified source keys: qualifiedApproaches, ffiConducted,
 * ciConducted, newBusiness.apps. (Aggregator file untouched — this is a
 * parallel display sum that mirrors aggregator's sumInt over the same keys.)
 */

const intOrZero = (v) => parseInt(v, 10) || 0;

function sumIntsAcross(entries, key) {
  return entries.reduce((acc, e) => acc + intOrZero(e?.[key]), 0);
}

function sumPathIntsAcross(entries, key, sub) {
  return entries.reduce((acc, e) => acc + intOrZero(e?.[key]?.[sub]), 0);
}

/**
 * Derive the four week-to-date count-strip chips from a list of daily docs.
 * @param {Array<object>} weekDocs - this agent's dailyActivity docs for the week
 * @returns {{appr:number, ffi:number, ci:number, apps:number}}
 */
export function deriveCountStripChips(weekDocs) {
  const entries = Array.isArray(weekDocs) ? weekDocs : [];
  return {
    appr: sumIntsAcross(entries, 'qualifiedApproaches'),
    ffi:  sumIntsAcross(entries, 'ffiConducted'),
    ci:   sumIntsAcross(entries, 'ciConducted'),
    apps: sumPathIntsAcross(entries, 'newBusiness', 'apps'),
  };
}
