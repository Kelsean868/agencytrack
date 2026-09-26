import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({ setDoc: vi.fn(), doc: vi.fn(() => ({ __ref: true })) }));

vi.mock('firebase/firestore', () => ({
  doc: (...a) => hoisted.doc(...a),
  getDoc: vi.fn(),
  setDoc: (...a) => hoisted.setDoc(...a),
  serverTimestamp: () => '__ts__',
}));

import { setLedgerSavedViews, LEDGER_SAVED_VIEW_CAP } from '../userPrefsService';

beforeEach(() => { vi.clearAllMocks(); });

const view = (id, overrides = {}) => ({
  id,
  label: `View ${id}`,
  savedAt: '2026-09-26T00:00:00.000Z',
  sortKey: 'issuedDesc',
  filters: {
    countsGroup: new Set(['counting']),
    status: new Set(),
    source: new Set(),
    who: new Set(),
    product: new Set(),
    frequency: new Set(),
    dateType: 'issue',
    dateFrom: null,
    dateTo: null,
    apiMin: null,
    apiMax: null,
  },
  ...overrides,
});

describe('setLedgerSavedViews (Policy Ledger L2)', () => {
  it('writes to the agent-private prefs doc users/{uid}/prefs/app', async () => {
    await setLedgerSavedViews('t1', 'u1', [view('v1')]);
    expect(hoisted.doc).toHaveBeenCalledWith(
      expect.anything(), 'tenants', 't1', 'users', 'u1', 'prefs', 'app',
    );
  });

  it('merge-writes ONLY ledgerSavedViews (+ updatedAt) so siblings survive', async () => {
    await setLedgerSavedViews('t1', 'u1', [view('v1')]);
    const [, payload, options] = hoisted.setDoc.mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(Object.keys(payload).sort()).toEqual(['ledgerSavedViews', 'updatedAt']);
  });

  it('serializes filter Sets to sorted string arrays, never Sets', async () => {
    await setLedgerSavedViews('t1', 'u1', [view('v1', {
      filters: { ...view('v1').filters, countsGroup: new Set(['not', 'counting']), status: new Set(['settled']) },
    })]);
    const [, payload] = hoisted.setDoc.mock.calls[0];
    const saved = payload.ledgerSavedViews[0];
    expect(saved.filters.countsGroup).toEqual(['counting', 'not']);
    expect(Array.isArray(saved.filters.countsGroup)).toBe(true);
    expect(saved.filters.status).toEqual(['settled']);
  });

  it('coerces apiMin/apiMax to numbers, never strings', async () => {
    await setLedgerSavedViews('t1', 'u1', [view('v1', {
      filters: { ...view('v1').filters, apiMin: '5000', apiMax: 20000 },
    })]);
    const saved = hoisted.setDoc.mock.calls[0][1].ledgerSavedViews[0];
    expect(saved.filters.apiMin).toBe(5000);
    expect(typeof saved.filters.apiMin).toBe('number');
    expect(saved.filters.apiMax).toBe(20000);
  });

  it('drops a non-YYYY-MM-DD date rather than writing garbage', async () => {
    await setLedgerSavedViews('t1', 'u1', [view('v1', {
      filters: { ...view('v1').filters, dateFrom: '01-07-2026' },
    })]);
    const saved = hoisted.setDoc.mock.calls[0][1].ledgerSavedViews[0];
    expect(saved.filters.dateFrom).toBeNull();
  });

  it('drops malformed entries (missing id/label) without throwing', async () => {
    await setLedgerSavedViews('t1', 'u1', [view('v1'), { label: 'no id' }, null]);
    const saved = hoisted.setDoc.mock.calls[0][1].ledgerSavedViews;
    expect(saved).toHaveLength(1);
  });

  it(`caps at ${LEDGER_SAVED_VIEW_CAP} views`, async () => {
    const many = Array.from({ length: LEDGER_SAVED_VIEW_CAP + 5 }, (_, i) => view(`v${i}`));
    await setLedgerSavedViews('t1', 'u1', many);
    const saved = hoisted.setDoc.mock.calls[0][1].ledgerSavedViews;
    expect(saved).toHaveLength(LEDGER_SAVED_VIEW_CAP);
  });

  it('rejects a missing tenant/uid without writing', async () => {
    await expect(setLedgerSavedViews('', 'u1', [])).rejects.toThrow(/tenantId and uid/);
    expect(hoisted.setDoc).not.toHaveBeenCalled();
  });

  it('tolerates a non-array input by writing an empty list', async () => {
    await setLedgerSavedViews('t1', 'u1', undefined);
    const saved = hoisted.setDoc.mock.calls[0][1].ledgerSavedViews;
    expect(saved).toEqual([]);
  });
});
