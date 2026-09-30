import { describe, it, expect } from 'vitest';

import * as srcPlan from '../buildImportPlan';
import * as mirrorPlan from '../../../../functions/portfolioImport/esm/buildImportPlan.js';
import { REINSTATEMENT_DECLARATION_FIELDS, hasLiveDeclaration } from '../../persistency/reinstatementDeclaration';

/**
 * R2-6b — a NEW lapse clears a stale reinstatement declaration in the same
 * import write. Run against BOTH copies of the plan builder: the app's
 * (ops script) and the functions mirror (the in-app import callable).
 * SYNTHETIC docs only.
 */

const OPTS = {
  tenantId: 'tenant_x', agentId: 'uid-agent', agentNumber: '011B94',
  exportDate: '2026-09-15', importedAt: '2026-09-16', unitId: 'unit-1', branchId: 'branch-1', createdBy: 'ops@example.com',
};
const DECLARED = {
  reinstatementDeclaredAt: '2026-06-01T10:00:00Z', reinstatementDeclaredBy: 'uid-agent', reinstatementNote: 'Client paid arrears in May',
};

function parsed(status, exportDate) {
  return {
    policyNumber: 'TST0000001', ownerName: 'Alpha Owner', planId: 'RAE996', proposedAPI: 1200,
    dateIssued: '2026-01-15', paidToDate: '2026-10-01', servicingAgentNumber: '011B94', writingAgentNumber: '011B94',
    oipaStatus: status === 'lapsed' ? 'Lapsed' : 'Active', status,
    statusSource: 'oipa_import', statusAsOf: exportDate,
  };
}
/** Apply a plan's update to the stored doc the way both writers do (a field merge). */
function applyUpdate(doc, plan) {
  const u = plan.updates.find((x) => x.id === doc.id);
  return u ? { ...doc, ...u.changed } : doc;
}

describe.each([['src (ops script)', srcPlan], ['functions mirror (import callable)', mirrorPlan]])('%s', (_name, mod) => {
  const run = (doc, status, exportDate) => {
    const plan = mod.buildImportPlan([parsed(status, exportDate)], { ...OPTS, exportDate, existingDocs: [doc] });
    expect(plan.creates).toHaveLength(0);
    return { plan, doc: applyUpdate(doc, plan) };
  };
  const base = { id: 'doc-1', policyNumber: 'TST0000001', agentId: 'uid-agent', importSource: 'oipa_import', status: 'lapsed', statusSource: 'oipa_import', ...DECLARED };

  it('the cleared field list is exactly the declaration fields', () => {
    expect([...mod.DECLARATION_FIELDS_CLEARED_ON_NEW_LAPSE]).toEqual([...REINSTATEMENT_DECLARATION_FIELDS]);
  });

  it('lapsed → reinstated keeps the declaration; → lapsed again clears it in the same write', () => {
    const step1 = run(base, 'settled', '2026-07-15');
    expect(step1.plan.updates).toHaveLength(1);
    for (const k of REINSTATEMENT_DECLARATION_FIELDS) expect(step1.plan.updates[0].changed).not.toHaveProperty(k);
    expect(step1.doc).toMatchObject(DECLARED);

    const step2 = run(step1.doc, 'lapsed', '2026-09-15');
    const changed = step2.plan.updates[0].changed;
    for (const k of REINSTATEMENT_DECLARATION_FIELDS) expect(changed[k]).toBeNull();
    expect(hasLiveDeclaration(step2.doc)).toBe(false);
    // Only the status, its provenance and the three declaration fields move.
    const allowed = new Set(['status', 'oipaStatus', 'statusAsOf', 'exportDate', 'importedAt', ...REINSTATEMENT_DECLARATION_FIELDS]);
    expect(Object.keys(changed).filter((k) => !allowed.has(k))).toEqual([]);
    expect(step2.plan.updates[0].history.fields).toEqual(expect.arrayContaining([...REINSTATEMENT_DECLARATION_FIELDS]));
  });

  it('lapsed → lapsed keeps the declaration (it is about this lapse)', () => {
    const { plan, doc } = run(base, 'lapsed', '2026-09-15');
    for (const u of plan.updates) for (const k of REINSTATEMENT_DECLARATION_FIELDS) expect(u.changed).not.toHaveProperty(k);
    expect(doc).toMatchObject(DECLARED);
    expect(hasLiveDeclaration(doc)).toBe(true);
  });

  it('a new lapse with no declaration on file writes no declaration fields', () => {
    const { plan } = run({ ...base, status: 'settled', reinstatementDeclaredAt: undefined, reinstatementDeclaredBy: undefined, reinstatementNote: undefined }, 'lapsed', '2026-09-15');
    for (const k of REINSTATEMENT_DECLARATION_FIELDS) expect(plan.updates[0].changed).not.toHaveProperty(k);
  });
});
