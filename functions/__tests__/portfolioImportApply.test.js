'use strict';

/**
 * The write path, plus the reader that guards it.
 *
 * The batching test is the one that matters most: Firestore's hard limit is 500
 * writes per batch and one policy costs TWO (the doc plus its history doc). A
 * chunker sized on DOCUMENTS instead of writes passes every small test and then
 * fails at around 250 policies — which is 229 today and will be more next year.
 */

jest.mock('firebase-functions', () => require('../testHelpers/fakeFirestore').createFakeFunctions());
jest.mock('firebase-admin', () => ({
  firestore: Object.assign(() => { throw new Error('unused'); }, {
    FieldValue: { serverTimestamp: () => '<ts>' },
  }),
}));

const { createFakeDb } = require('../testHelpers/fakeFirestore');
const { applyPlan, opBelongsTo, MAX_WRITES } = require('../portfolioImport/applyPlan');
const { readWorkbook, cellValue, MAX_FILE_BYTES } = require('../portfolioImport/readWorkbook');

const CALLER = { uid: 'uid-kyron', tenantId: 'tatillife_south', agentNumber: '011B94' };
const SOURCE = 'oipa_import';
const RUN = 'run-abc123';

const create = (n) => ({
  policyNumber: n,
  doc: { policyNumber: n, agentId: CALLER.uid, servicingAgentNumber: CALLER.agentNumber, createdAt: '<serverTimestamp>' },
  history: { source: SOURCE, exportDate: '2026-09-15', action: 'create' },
});
const update = (n, changed = { status: 'lapsed' }) => ({
  policyNumber: n, id: `doc-${n}`, changed,
  history: { source: SOURCE, exportDate: '2026-09-15', action: 'update' },
});

describe('applyPlan', () => {
  it('creates a doc and a history subdoc per policy', async () => {
    const db = createFakeDb();
    const r = await applyPlan(db, { creates: [create('A1')], updates: [], report: {} }, CALLER, SOURCE, RUN);
    expect(r).toMatchObject({ created: 1, updated: 0, refused: [] });

    const paths = [...db._docs.keys()];
    const policy = paths.find((p) => /policies\/[^/]+$/.test(p));
    const history = paths.find((p) => p.includes('/history/'));
    expect(policy).toBeDefined();
    expect(history).toBeDefined();
    expect(db._docs.get(policy).createdAt).toBe('<ts>');   // the placeholder is replaced
    expect(db._docs.get(history)).toMatchObject({ source: SOURCE, by: CALLER.uid, at: '<ts>' });
  });

  it('updates only the changed fields and stamps updatedAt', async () => {
    const db = createFakeDb();
    db._seed(`tenants/${CALLER.tenantId}/policies/doc-B1`, {
      policyNumber: 'B1', status: 'settled', agentNotes: 'do not lose me',
    });
    await applyPlan(db, { creates: [], updates: [update('B1')], report: {} }, CALLER, SOURCE, RUN);
    const after = db._docs.get(`tenants/${CALLER.tenantId}/policies/doc-B1`);
    expect(after.status).toBe('lapsed');
    expect(after.updatedAt).toBe('<ts>');
    // The ledger accumulates human work the export knows nothing about.
    expect(after.agentNotes).toBe('do not lose me');
  });

  it('stays under the 500-write batch limit for 229 policies', async () => {
    const db = createFakeDb();
    const creates = Array.from({ length: 229 }, (_, i) => create(`P${i}`));
    const r = await applyPlan(db, { creates, updates: [], report: {} }, CALLER, SOURCE, RUN);
    expect(r.created).toBe(229);
    expect(db._commits.length).toBeGreaterThan(1);       // it actually chunked
    expect(Math.max(...db._commits)).toBeLessThanOrEqual(MAX_WRITES);
    expect(db._commits.reduce((a, b) => a + b, 0)).toBe(229 * 2);
  });

  it('refuses an op whose agent does not match the caller, and writes nothing for it', async () => {
    const db = createFakeDb();
    const bad = create('X1');
    bad.doc.agentId = 'someone-else';
    const r = await applyPlan(db, { creates: [create('A1'), bad], updates: [], report: {} }, CALLER, SOURCE, RUN);
    expect(r.created).toBe(1);
    expect(r.refused).toEqual(['X1']);
    expect(JSON.stringify([...db._docs.values()])).not.toContain('someone-else');
  });

  it('refuses an op whose servicing number does not match', async () => {
    const db = createFakeDb();
    const bad = create('X2');
    bad.doc.servicingAgentNumber = '099Z00';
    const r = await applyPlan(db, { creates: [bad], updates: [], report: {} }, CALLER, SOURCE, RUN);
    expect(r.refused).toEqual(['X2']);
  });

  it('opBelongsTo lets an update through when the servicing number did not change', () => {
    // An update carries only the fields that MOVED, so an absent servicing number
    // means "unchanged", not "mismatched".
    expect(opBelongsTo({ kind: 'update', changed: { status: 'lapsed' } }, CALLER)).toBe(true);
    expect(opBelongsTo({ kind: 'update', changed: { servicingAgentNumber: '099Z00' } }, CALLER)).toBe(false);
  });
});

describe('readWorkbook', () => {
  const zip = (extra = 0) => Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(extra),
  ]);
  const codeOf = async (buf) => {
    try { await readWorkbook(buf); return null; } catch (e) { return e.code; }
  };

  it('refuses an empty upload', async () => {
    expect(await codeOf(Buffer.alloc(0))).toBe('not-xlsx');
    expect(await codeOf(null)).toBe('not-xlsx');
  });

  it('refuses a file over 5 MB', async () => {
    expect(await codeOf(Buffer.concat([zip(), Buffer.alloc(MAX_FILE_BYTES)]))).toBe('too-large');
  });

  it('refuses bytes that are not a zip, whatever the name said', async () => {
    // The extension and the MIME type both come from the caller. The bytes do not.
    expect(await codeOf(Buffer.from('policyNumber,status\nA1,settled\n'))).toBe('not-xlsx');
    expect(await codeOf(Buffer.from('%PDF-1.7'))).toBe('not-xlsx');
  });

  it('refuses a zip that is not a readable workbook', async () => {
    expect(await codeOf(zip(64))).toBe('not-xlsx');
  });

  it('unwraps the cell shapes exceljs returns', async () => {
    // Each of these would otherwise reach the parser as "[object Object]".
    const d = new Date(2026, 7, 7);
    expect(cellValue({ value: { formula: 'A1*2', result: 2400 } })).toBe(2400);
    expect(cellValue({ value: { text: 'Kyron', hyperlink: 'mailto:x' } })).toBe('Kyron');
    expect(cellValue({ value: { richText: [{ text: 'LEVEL ' }, { text: 'TERM' }] } })).toBe('LEVEL TERM');
    expect(cellValue({ value: { error: '#N/A' } })).toBeNull();
    expect(cellValue({ value: d })).toBe(d);          // dates pass through untouched
    expect(cellValue({ value: null })).toBeNull();
    expect(cellValue(null)).toBeNull();
  });
});
