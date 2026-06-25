/**
 * Tests for the PR-U2 `.allocation` residue cleanup predicate
 * (functions/scripts/delete-stranded-allocation.cjs). Requiring the script loads
 * the module but does NOT initialize firebase-admin (main() is guarded by
 * require.main === module, and the admin require lives inside main()), so these
 * run admin-free under Jest.
 *
 * Contract: a moneyNeeds/{year}.allocation field is safe to delete ONLY when the
 * field is present AND the agent already has a yearPlan/{year} doc (canonical
 * loop data). Absent yearPlan → never delete (leave the worksheet untouched).
 */
const { shouldDeleteAllocation } = require('../scripts/delete-stranded-allocation.cjs');

describe('shouldDeleteAllocation — residue delete predicate', () => {
  it('deletes when .allocation present AND yearPlan exists', () => {
    expect(shouldDeleteAllocation({ hasAllocation: true, yearPlanExists: true })).toBe(true);
  });

  it('does NOT delete when yearPlan is absent (canonical loop data missing)', () => {
    expect(shouldDeleteAllocation({ hasAllocation: true, yearPlanExists: false })).toBe(false);
  });

  it('does NOT delete when there is no .allocation field', () => {
    expect(shouldDeleteAllocation({ hasAllocation: false, yearPlanExists: true })).toBe(false);
    expect(shouldDeleteAllocation({ hasAllocation: false, yearPlanExists: false })).toBe(false);
  });

  it('coerces falsy/truthy inputs to a strict boolean', () => {
    expect(shouldDeleteAllocation({ hasAllocation: undefined, yearPlanExists: true })).toBe(false);
    expect(shouldDeleteAllocation({ hasAllocation: {}, yearPlanExists: 1 })).toBe(true);
  });
});
