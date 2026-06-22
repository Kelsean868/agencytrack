/**
 * Pure helpers for WizardForm.
 *
 * Kept separate from the component file so react-refresh/only-export-components
 * stays clean (no named + default mixed exports in a component file).
 */

/**
 * Resolve which wizard path ('full' | 'fast') the agent takes.
 *
 * 'fast': loggingMode is 'daily' or 'hybrid' AND the draft signals it was
 *          built by the daily aggregator (aggregatedFromDaily flag or at least
 *          1 day worked). In the current Q4 shell, 'fast' lands at the ratings
 *          step (10). The Confirm-first fast-path route arrives in the post-Q3
 *          wiring PR.
 * 'full': loggingMode is 'weekly', OR the draft is absent/empty.
 *
 * @param {'weekly'|'daily'|'hybrid'|string} loggingMode
 * @param {object|null|undefined} draft  - aggregated weekly draft or null
 * @returns {'full'|'fast'}
 */
export function resolvePath(loggingMode, draft) {
  if (loggingMode === 'weekly') return 'full';
  if (loggingMode === 'daily' || loggingMode === 'hybrid') {
    if (draft?.aggregatedFromDaily === true || (draft?.daysWorked ?? 0) >= 1) {
      return 'fast';
    }
  }
  return 'full';
}

/**
 * Immutably set a (possibly dotted) path on a plain-object tree.
 *
 * Supports the nested keys deriveSections emits (e.g. 'newBusiness.api',
 * 'socialPlatformBreakdown.facebook') so a Confirm-screen edit lands on the real
 * nested field rather than creating a literal "newBusiness.api" key. Flat keys
 * pass straight through. Used by WizardForm's handleConfirmEdit.
 *
 * @param {object} obj   - source object (not mutated)
 * @param {string} path  - flat key ('dials') or dotted path ('newBusiness.api')
 * @param {*}      value - value to set at the path
 * @returns {object} a shallow-cloned tree with the path set
 */
export function setByPath(obj, path, value) {
  const dot = path.indexOf('.');
  if (dot === -1) return { ...obj, [path]: value };
  const head = path.slice(0, dot);
  const rest = path.slice(dot + 1);
  const child = (obj[head] && typeof obj[head] === 'object') ? obj[head] : {};
  return { ...obj, [head]: setByPath(child, rest, value) };
}
