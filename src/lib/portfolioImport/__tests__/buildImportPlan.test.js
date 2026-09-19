import { describe, it, expect } from 'vitest';

import {
  buildImportPlan,
  IMPORT_OWNED_FIELDS,
  IMPORT_ADDED_FIELDS_NOTE,
  PROVENANCE_ONLY_FIELDS,
} from '../buildImportPlan';

/** SYNTHETIC docs. No real client data in this repo. */

const OPTS = {
  tenantId: 'tenant_x',
  agentId: 'uid-agent',
  agentNumber: '011B94',
  exportDate: '2026-09-15',
  importedAt: '2026-09-16',
  unitId: 'unit-1',
  branchId: 'branch-1',
  createdBy: 'ops@example.com',
};

/** A parser-shaped doc. */
function parsed(overrides = {}) {
  return {
    policyNumber: 'TST0000001',
    ownerName: 'Alpha Owner',
    insuredName: 'ALPHA OWNER',
    planId: 'RAE996',
    planName: 'Rest Assured I',
    policyClass: 'whole_life',
    sourceSystem: 'INGENIUM',
    proposedAPI: 1200,
    proposedPremium: 100,
    proposedFrequency: 'M',
    proposedCoverage: 50000,
    dateIssued: '2026-01-15',
    inforceDate: '2026-01-15',
    paidToDate: '2026-10-01',
    totalPremiumPaid: 200,
    writingAgentNumber: '011B94',
    writingAgentName: 'AGENT NAME',
    servicingAgentNumber: '011B94',
    oipaStatus: 'Active',
    oipaSubStatus: 'Premium Paying',
    oipaStatusDate: null,
    status: 'settled',
    isWritingAgent: true,
    isSelfOrFamily: false,
    newBusinessType: 'nb_ordinary',
    sourceOfProspect: null,
    exportDate: '2026-09-15',
    importedAt: '2026-09-16',
    ...overrides,
  };
}

describe('buildImportPlan — required options', () => {
  it('refuses to plan without the scoping keys', () => {
    expect(() => buildImportPlan([], { ...OPTS, tenantId: null })).toThrow(/tenantId is required/);
    expect(() => buildImportPlan([], { ...OPTS, agentId: null })).toThrow(/agentId is required/);
    expect(() => buildImportPlan([], { ...OPTS, exportDate: null })).toThrow(/exportDate is required/);
    expect(() => buildImportPlan([], { ...OPTS, importedAt: null })).toThrow(/importedAt is required/);
  });
});

describe('buildImportPlan — a first import is all creates', () => {
  it('creates one doc per parsed policy when the ledger is empty', () => {
    const plan = buildImportPlan([parsed({ policyNumber: 'A1' }), parsed({ policyNumber: 'A2' })], OPTS);

    expect(plan.report.creates).toBe(2);
    expect(plan.report.updates).toBe(0);
    expect(plan.report.skips).toBe(0);
    expect(plan.report.accountedFor).toBe(true);
    expect(plan.creates.map((c) => c.policyNumber)).toEqual(['A1', 'A2']);
  });

  it('writes the ruled write-path fields on every create', () => {
    const { doc } = buildImportPlan([parsed()], OPTS).creates[0];

    // Ruling 5b — never the agent pick list; provenance via importSource.
    expect(doc.sourceOfProspect).toBeNull();
    expect(doc.importSource).toBe('oipa_import');
    expect(doc.importedAt).toBe('2026-09-16');
    expect(doc.exportDate).toBe('2026-09-15');
    // Ruling 5c.
    expect(doc.productLine).toBe('life');
    // Ruling 5d — never back-filled from dateIssued.
    expect(doc.dateWritten).toBeNull();
    expect(doc.dateWrittenUnknown).toBe(true);
    expect(doc.dateWritten).not.toBe(doc.dateIssued);
  });

  it('writes the scoping fields the read path needs', () => {
    const { doc } = buildImportPlan([parsed()], OPTS).creates[0];

    expect(doc.tenantId).toBe('tenant_x');
    expect(doc.agentId).toBe('uid-agent');
    expect(doc.unitId).toBe('unit-1');
    expect(doc.branchId).toBe('branch-1');
    expect(doc.createdBy).toBe('ops@example.com');
    // Every policies read query is orderBy('createdAt'); a doc without it is
    // silently excluded from all of them.
    expect(doc).toHaveProperty('createdAt');
  });

  it('carries productLine life even for a critical_illness policy (ruling 5c)', () => {
    const { doc } = buildImportPlan([parsed({ policyClass: 'critical_illness', planId: 'CIB702' })], OPTS).creates[0];
    expect(doc.policyClass).toBe('critical_illness');
    expect(doc.productLine).toBe('life');
  });

  it('attaches the provenance history doc the brief requires', () => {
    const { history } = buildImportPlan([parsed()], OPTS).creates[0];
    expect(history).toEqual({ source: 'oipa_import', exportDate: '2026-09-15', action: 'create' });
  });
});

describe('buildImportPlan — idempotency (brief hard rule)', () => {
  it('re-importing the SAME export produces zero creates and zero updates', () => {
    const p = parsed({ policyNumber: 'IDEM0001' });
    const existing = [{ id: 'doc1', ...p }];

    const plan = buildImportPlan([p], { ...OPTS, existingDocs: existing });

    expect(plan.report.creates).toBe(0);
    expect(plan.report.updates).toBe(0);
    expect(plan.report.skips).toBe(1);
    expect(plan.skips[0]).toEqual({ policyNumber: 'IDEM0001', id: 'doc1', reason: 'unchanged' });
  });

  it('never creates a second doc for a policy number already in the ledger', () => {
    const p = parsed({ policyNumber: 'IDEM0002', proposedAPI: 5000 });
    const existing = [{ id: 'doc1', ...parsed({ policyNumber: 'IDEM0002', proposedAPI: 1200 }) }];

    const plan = buildImportPlan([p], { ...OPTS, existingDocs: existing });

    expect(plan.report.creates).toBe(0);
    expect(plan.report.updates).toBe(1);
    expect(plan.updates[0].id).toBe('doc1');
  });

  it('a later importedAt alone is NOT a change', () => {
    // Otherwise re-running the same export on a later day reports 229 updates
    // that carry no new business fact, and the dry run stops meaning anything.
    const p = parsed({ policyNumber: 'IDEM0003' });
    const existing = [{ id: 'doc1', ...p, importedAt: '2026-09-16' }];

    const plan = buildImportPlan([p], { ...OPTS, importedAt: '2026-11-01', existingDocs: existing });

    expect(plan.report.updates).toBe(0);
    expect(plan.report.skips).toBe(1);
  });

  it('reports a duplicate policy number already present in the ledger', () => {
    const p = parsed({ policyNumber: 'DUP0001' });
    const existing = [{ id: 'a', ...p }, { id: 'b', ...p }];

    const plan = buildImportPlan([p], { ...OPTS, existingDocs: existing });

    expect(plan.report.duplicateExisting).toEqual(['DUP0001']);
  });
});

describe('buildImportPlan — an update touches ONLY import-owned fields', () => {
  it('moves a status that changed since the last export', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'MOVE0001', status: 'settled', oipaSubStatus: 'Premium Paying' }) };
    const after = parsed({ policyNumber: 'MOVE0001', status: 'lapsed', oipaSubStatus: 'Lapsed', oipaStatus: 'Terminated' });

    const plan = buildImportPlan([after], { ...OPTS, existingDocs: [before] });

    expect(plan.updates[0].changed.status).toBe('lapsed');
    expect(plan.updates[0].changedKeys).toContain('oipaSubStatus');
  });

  it('does NOT overwrite a CRO delivery stamp, a manager confirmation or agent notes', () => {
    const humanWork = {
      policyDeliveryDate: 'STAMP', deliveredBy: 'cro-uid', deliveredAt: 'WHEN',
      managerSettledAPI: 9999, managerNote: 'confirmed by me', notes: 'agent note',
      confirmedBy: 'mgr-uid',
    };
    const before = { id: 'doc1', ...parsed({ policyNumber: 'KEEP0001', status: 'settled' }), ...humanWork };
    const after = parsed({ policyNumber: 'KEEP0001', status: 'lapsed', oipaSubStatus: 'Lapsed' });

    const plan = buildImportPlan([after], { ...OPTS, existingDocs: [before] });
    const changedKeys = plan.updates[0].changedKeys;

    for (const key of Object.keys(humanWork)) {
      expect(changedKeys).not.toContain(key);
    }
    expect(changedKeys).toContain('status');
  });

  it('only ever names keys that are import-owned', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'OWN0001', proposedAPI: 1 }) };
    const after = parsed({ policyNumber: 'OWN0001', proposedAPI: 2, status: 'lapsed' });

    const plan = buildImportPlan([after], { ...OPTS, existingDocs: [before] });

    for (const key of plan.updates[0].changedKeys) {
      expect(IMPORT_OWNED_FIELDS).toContain(key);
    }
  });

  it('records the changed field list on the history doc', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'HIST0001', proposedAPI: 1 }) };
    const after = parsed({ policyNumber: 'HIST0001', proposedAPI: 2 });

    const plan = buildImportPlan([after], { ...OPTS, existingDocs: [before] });

    expect(plan.updates[0].history).toMatchObject({
      source: 'oipa_import',
      exportDate: '2026-09-15',
      action: 'update',
    });
    expect(plan.updates[0].history.fields).toContain('proposedAPI');
  });
});

describe('buildImportPlan — comparison edge cases', () => {
  it('treats null and undefined as the same absence, so nothing shows as changed', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'BLANK001', oipaStatusDate: undefined, totalPremiumPaid: undefined }) };
    const after = parsed({ policyNumber: 'BLANK001', oipaStatusDate: null, totalPremiumPaid: null });

    const plan = buildImportPlan([after], { ...OPTS, existingDocs: [before] });

    expect(plan.report.skips).toBe(1);
    expect(plan.report.updates).toBe(0);
  });

  it('does NOT treat a float wobble under half a cent as a change', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'MONEY001', proposedAPI: 11996.64 }) };
    const after = parsed({ policyNumber: 'MONEY001', proposedAPI: 11996.641 });

    expect(buildImportPlan([after], { ...OPTS, existingDocs: [before] }).report.skips).toBe(1);
  });

  it('DOES treat a one-cent move as a change', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'MONEY002', proposedAPI: 11996.64 }) };
    const after = parsed({ policyNumber: 'MONEY002', proposedAPI: 11996.65 });

    expect(buildImportPlan([after], { ...OPTS, existingDocs: [before] }).report.updates).toBe(1);
  });

  it('notices a value appearing where there was none', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'FILL0001', totalPremiumPaid: null }) };
    const after = parsed({ policyNumber: 'FILL0001', totalPremiumPaid: 1500 });

    const plan = buildImportPlan([after], { ...OPTS, existingDocs: [before] });
    expect(plan.updates[0].changed.totalPremiumPaid).toBe(1500);
  });
});

describe('buildImportPlan — ledger docs the export no longer mentions', () => {
  it('leaves them alone and never proposes a delete', () => {
    // An export is a snapshot of one book. Absence is not evidence of deletion —
    // an upstream filter change would otherwise wipe the ledger.
    const existing = [
      { id: 'doc1', ...parsed({ policyNumber: 'GONE0001' }) },
      { id: 'doc2', ...parsed({ policyNumber: 'STILL001' }) },
    ];
    const plan = buildImportPlan([parsed({ policyNumber: 'STILL001' })], { ...OPTS, existingDocs: existing });

    expect(plan.report.orphanedInLedger).toEqual(['GONE0001']);
    expect(plan).not.toHaveProperty('deletes');
    expect(plan.report.creates).toBe(0);
    expect(plan.report.skips).toBe(1);
  });
});

describe('buildImportPlan — the report', () => {
  it('accounts for every parsed doc', () => {
    const existing = [{ id: 'doc1', ...parsed({ policyNumber: 'B1' }) }];
    const plan = buildImportPlan([
      parsed({ policyNumber: 'B1' }),                       // skip
      parsed({ policyNumber: 'B2' }),                       // create
    ], { ...OPTS, existingDocs: existing });

    expect(plan.report.parsedDocs).toBe(2);
    expect(plan.report.creates + plan.report.updates + plan.report.skips).toBe(2);
    expect(plan.report.accountedFor).toBe(true);
  });

  it('names the owned and added field sets so the dry run can print them', () => {
    const plan = buildImportPlan([parsed()], OPTS);
    expect(plan.report.importOwnedFields).toEqual([...IMPORT_OWNED_FIELDS]);
    expect(plan.report.addedFields).toEqual(Object.keys(IMPORT_ADDED_FIELDS_NOTE));
  });

  it('handles an empty parse and a non-array without throwing', () => {
    expect(buildImportPlan([], OPTS).report.accountedFor).toBe(true);
    expect(buildImportPlan(null, OPTS).report.parsedDocs).toBe(0);
  });
});

describe('buildImportPlan — immutability', () => {
  it('does not mutate the parsed docs it was given', () => {
    const p = parsed();
    const snapshot = JSON.stringify(p);
    buildImportPlan([p], OPTS);
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it('does not mutate the existing docs it was given', () => {
    const before = { id: 'doc1', ...parsed({ policyNumber: 'IMM0001', proposedAPI: 1 }) };
    const snapshot = JSON.stringify(before);
    buildImportPlan([parsed({ policyNumber: 'IMM0001', proposedAPI: 2 })], { ...OPTS, existingDocs: [before] });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('PROVENANCE_ONLY_FIELDS — the unchanged rule (P4d ruling 3)', () => {
  it('is the one place the rule is written, and lists every provenance field', () => {
    expect([...PROVENANCE_ONLY_FIELDS].sort()).toEqual([
      'exportDate', 'importSource', 'importedAt', 'lastImportRunId',
      // P4e: statusAsOf IS the export date, so it moves on every policy whenever
      // a newer export lands — the same shape that made exportDate a
      // false-positive change before P4d.
      'statusAsOf', 'statusSetBy', 'statusSource',
    ].sort());
  });

  it('never lists firstImportRunId — it is written once and no update may move it', () => {
    expect(PROVENANCE_ONLY_FIELDS).not.toContain('firstImportRunId');
    expect(IMPORT_OWNED_FIELDS).not.toContain('firstImportRunId');
  });

  it('statusSourceDetail is OWNED but NOT provenance-only (P4e)', () => {
    // It is the raw OIPA pair, so `Active / Premium Paying` becoming
    // `Active / Grace` is real news about the policy even though both map to
    // `settled`. Classifying it as provenance-only would hide that.
    expect(IMPORT_OWNED_FIELDS).toContain('statusSourceDetail');
    expect(PROVENANCE_ONLY_FIELDS).not.toContain('statusSourceDetail');
  });

  it('a newer export does not count statusAsOf alone as a change', () => {
    const p = parsed({ policyNumber: 'PROVA01', exportDate: '2026-09-15', statusAsOf: '2026-09-15' });
    const plan = buildImportPlan(
      [parsed({ policyNumber: 'PROVA01', exportDate: '2026-09-30', statusAsOf: '2026-09-30' })],
      { ...OPTS, exportDate: '2026-09-30', importedAt: '2026-09-30', existingDocs: [{ id: 'd', ...p }] },
    );
    expect(plan.report.updates).toBe(0);
    expect(plan.report.skips).toBe(1);
  });

  it('a NEWER export that changed no policy fact produces zero updates', () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Before P4d the filter excluded
    // `importedAt` and `importSource` while its comment named `importedAt` and
    // `exportDate` — so `exportDate`, which moves on EVERY policy whenever a
    // newer export is imported, counted as a real change. Measured then:
    // `updates 3 | skips 0` with changedKeys ["exportDate","importedAt"].
    const numbers = ['PROV0001', 'PROV0002', 'PROV0003'];
    const existing = numbers.map((n) => ({
      id: `doc-${n}`, ...parsed({ policyNumber: n, exportDate: '2026-09-15' }),
    }));
    const next = numbers.map((n) => parsed({ policyNumber: n, exportDate: '2026-09-30' }));

    const plan = buildImportPlan(next, {
      ...OPTS, exportDate: '2026-09-30', importedAt: '2026-09-30', existingDocs: existing,
    });

    expect(plan.report.creates).toBe(0);
    expect(plan.report.updates).toBe(0);
    expect(plan.report.skips).toBe(3);
  });

  it('an unchanged policy is NOT WRITTEN — it produces no update op at all', () => {
    // "Unchanged" must mean no write, not "written with only provenance".
    // A write would move `updatedAt` and `lastImportRunId` on a policy nothing
    // happened to, and the run record would then claim it was touched.
    const p = parsed({ policyNumber: 'PROV0004', exportDate: '2026-09-15' });
    const plan = buildImportPlan(
      [parsed({ policyNumber: 'PROV0004', exportDate: '2026-09-30' })],
      { ...OPTS, exportDate: '2026-09-30', importedAt: '2026-09-30', existingDocs: [{ id: 'd', ...p }] },
    );
    expect(plan.updates).toEqual([]);
    expect(plan.skips).toEqual([{ policyNumber: 'PROV0004', id: 'd', reason: 'unchanged' }]);
  });

  it('a REAL change still carries the provenance along with it', () => {
    // Provenance alone is not a reason to write. Once there IS a reason, the
    // provenance must move too, or the policy would claim an older export.
    const before = parsed({ policyNumber: 'PROV0005', proposedAPI: 1200, exportDate: '2026-09-15' });
    const after = parsed({ policyNumber: 'PROV0005', proposedAPI: 1500, exportDate: '2026-09-30' });

    const plan = buildImportPlan([after], {
      ...OPTS, exportDate: '2026-09-30', importedAt: '2026-09-30',
      // `importSource` is stamped by the importer, so a ledger doc that predates
      // it gains the field here. That is a real addition, not provenance drift.
      existingDocs: [{ id: 'd', ...before, importSource: 'oipa_import' }],
    });

    expect(plan.report.updates).toBe(1);
    expect(plan.updates[0].changedKeys).toEqual(['exportDate', 'importedAt', 'proposedAPI']);
    expect(plan.updates[0].changed.exportDate).toBe('2026-09-30');
  });

  it('one changed policy among many leaves the rest unchanged', () => {
    const numbers = ['PROV0010', 'PROV0011', 'PROV0012'];
    const existing = numbers.map((n) => ({
      id: `doc-${n}`, ...parsed({ policyNumber: n, proposedAPI: 1200, exportDate: '2026-09-15' }),
    }));
    const next = numbers.map((n, i) => parsed({
      policyNumber: n, proposedAPI: i === 0 ? 1500 : 1200, exportDate: '2026-09-30',
    }));

    const plan = buildImportPlan(next, {
      ...OPTS, exportDate: '2026-09-30', importedAt: '2026-09-30', existingDocs: existing,
    });

    expect(plan.report.creates).toBe(0);
    expect(plan.report.updates).toBe(1);
    expect(plan.report.skips).toBe(2);
    expect(plan.updates[0].policyNumber).toBe('PROV0010');
  });

  it('documents the two run-id fields it adds', () => {
    expect(Object.keys(IMPORT_ADDED_FIELDS_NOTE)).toEqual(
      expect.arrayContaining(['firstImportRunId', 'lastImportRunId']),
    );
  });
});
