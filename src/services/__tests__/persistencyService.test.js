import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock state — must use vi.hoisted because vi.mock factories run
// before any top-level `const` in the test file.
const hoisted = vi.hoisted(() => ({
  mockAuth: { currentUser: { uid: 'writer-uid' } },
  mockGetDoc:  vi.fn(),
  mockGetDocs: vi.fn(),
  mockSetDoc:  vi.fn(),
  // Far from every fixture monthKey in this file (all 2024-2026) so tests that
  // never touch getAvailableMonths are unaffected by this default.
  mockGetTodayTT: vi.fn(() => '2000-01-15'),
}));
const { mockAuth, mockGetDoc, mockGetDocs, mockSetDoc, mockGetTodayTT } = hoisted;

vi.mock('../../firebase', () => ({
  db: {},
  auth: hoisted.mockAuth,
}));

vi.mock('../../utils/dateInputs', () => ({
  getTodayTT: (...args) => hoisted.mockGetTodayTT(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc:  (db, path) => ({ __ref: path, id: path.split('/').pop() }),
  collection: (db, path) => ({ __collection: path }),
  query: (...args) => ({ __query: args }),
  where: (field, op, value) => ({ __where: [field, op, value] }),
  getDoc:  (...args) => hoisted.mockGetDoc(...args),
  getDocs: (...args) => hoisted.mockGetDocs(...args),
  setDoc:  (...args) => hoisted.mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
}));

vi.mock('../managerService', () => ({
  getTenantUsers: vi.fn(),
}));

import {
  isE3Doc,
  isModelCompleteDoc,
  monthKeyFromYearMonth,
  parseMonthKey,
  persistencyDocId,
  reportPeriodFromMonthKey,
  getPersistencyForAgent,
  getPersistencyForBranch,
  getPersistencyMapForYear,
  getPersistencyForAgentIds,
  getAvailableMonths,
  PERSISTENCY_QUERY_BATCH,
  getAgentHistory,
  savePersistency,
} from '../persistencyService';
import { getTenantUsers } from '../managerService';

const E3_INPUTS = {
  businessPlaced: 357468.84,
  notTakens: 0,
  incPPPs: 48000,
  lumpsums100: 8666.90,
  lapses: 133600.08,
  reinstatements: 27662.28,
};

const E3_FULL_DOC = {
  ...E3_INPUTS,
  agentId: 'agent-1',
  tenantId: 'tenant1',
  year: 2026,
  month: 2,
  monthKey: '2026-02',
  grossSettled: 406335.53,
  netSettled: 300397.73,
  persistency: 0.7393,
};

describe('isE3Doc', () => {
  it('returns true when all six business-input fields are present', () => {
    expect(isE3Doc(E3_FULL_DOC)).toBe(true);
  });

  it('returns false for null / non-object', () => {
    expect(isE3Doc(null)).toBe(false);
    expect(isE3Doc(undefined)).toBe(false);
    expect(isE3Doc('string')).toBe(false);
  });

  it('returns false when only legacy `persistency` field is present (pre-E3 doc)', () => {
    const legacy = {
      agentId: 'agent-1',
      year: 2026,
      month: 2,
      persistency: 92.5, // legacy 0–100 scale
      enteredBy: 'manager-uid',
    };
    expect(isE3Doc(legacy)).toBe(false);
  });

  it('returns false when one of the six required fields is missing', () => {
    for (const f of ['businessPlaced', 'notTakens', 'incPPPs', 'lumpsums100', 'lapses', 'reinstatements']) {
      const partial = { ...E3_INPUTS };
      delete partial[f];
      expect(isE3Doc(partial), `missing ${f} should fail`).toBe(false);
    }
  });

  it('returns true when extra optional fields (notes, value) coexist with the six', () => {
    expect(isE3Doc({ ...E3_INPUTS, notes: 'legacy note', value: 92.5 })).toBe(true);
  });

  it('treats null/undefined values for required fields as missing', () => {
    expect(isE3Doc({ ...E3_INPUTS, lapses: null })).toBe(false);
    expect(isE3Doc({ ...E3_INPUTS, incPPPs: undefined })).toBe(false);
  });

  it('treats numeric zero as present (0 is a valid input value)', () => {
    expect(isE3Doc({ ...E3_INPUTS, notTakens: 0 })).toBe(true);
  });
});

describe('monthKey helpers', () => {
  it('monthKeyFromYearMonth zero-pads single-digit months', () => {
    expect(monthKeyFromYearMonth(2026, 2)).toBe('2026-02');
    expect(monthKeyFromYearMonth(2026, 12)).toBe('2026-12');
  });

  it('parseMonthKey round-trips with monthKeyFromYearMonth', () => {
    const { year, month } = parseMonthKey('2026-02');
    expect(year).toBe(2026);
    expect(month).toBe(2);
  });

  it('persistencyDocId has YYYY_MM (underscore, not dash)', () => {
    expect(persistencyDocId('agent-1', '2026-02')).toBe('agent-1_2026_02');
  });

  it('reportPeriodFromMonthKey returns 12-month rolling window ending in month', () => {
    expect(reportPeriodFromMonthKey('2026-02'))
      .toEqual({ reportPeriodStart: '2025-03-01', reportPeriodEnd: '2026-02-28' });
  });

  // The window length is the model's, not a constant. August 2026 is the last
  // legacy month; September 2026 is the first on the Tatil 24-month model.
  it('reportPeriodFromMonthKey uses 12 months for the last legacy month', () => {
    expect(reportPeriodFromMonthKey('2026-08'))
      .toEqual({ reportPeriodStart: '2025-09-01', reportPeriodEnd: '2026-08-31' });
  });

  it('reportPeriodFromMonthKey widens to 24 months at the memo boundary', () => {
    expect(reportPeriodFromMonthKey('2026-09'))
      .toEqual({ reportPeriodStart: '2024-10-01', reportPeriodEnd: '2026-09-30' });
  });

  it('reportPeriodFromMonthKey keeps the same end date either side of the boundary', () => {
    // Only the START moves when the model changes; the period still ENDS in the
    // month asked for. A regression that shifted the end would misdate a report.
    expect(reportPeriodFromMonthKey('2026-08').reportPeriodEnd).toBe('2026-08-31');
    expect(reportPeriodFromMonthKey('2026-09').reportPeriodEnd).toBe('2026-09-30');
  });

  it('reportPeriodFromMonthKey throws on a malformed monthKey', () => {
    expect(() => reportPeriodFromMonthKey('2026/09')).toThrow(/monthKey must be "YYYY-MM"/);
  });

  it('reportPeriodFromMonthKey handles leap year (Feb 29)', () => {
    expect(reportPeriodFromMonthKey('2024-02'))
      .toEqual({ reportPeriodStart: '2023-03-01', reportPeriodEnd: '2024-02-29' });
  });

  it('reportPeriodFromMonthKey handles a legacy December (rolls into same year start)', () => {
    // 2025-12 is still on the 12-month model, so December remains the case
    // where the window starts in January of the SAME year.
    expect(reportPeriodFromMonthKey('2025-12'))
      .toEqual({ reportPeriodStart: '2025-01-01', reportPeriodEnd: '2025-12-31' });
  });

  it('reportPeriodFromMonthKey handles a 24-month December (starts Jan of the PRIOR year)', () => {
    // FIXTURE UPDATED, NOT A REGRESSION. This previously asserted the 12-month
    // answer '2026-01-01'. December 2026 is on the Tatil 24-month model, so the
    // window now opens two Januaries back — the brief pins this exact value.
    expect(reportPeriodFromMonthKey('2026-12'))
      .toEqual({ reportPeriodStart: '2025-01-01', reportPeriodEnd: '2026-12-31' });
  });
});

describe('getPersistencyForAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getPersistencyForAgent('tenant1', '2026-02', 'agent-1')).toBeNull();
  });

  it('returns the doc when it is E3-shaped', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => E3_FULL_DOC,
    });
    const result = await getPersistencyForAgent('tenant1', '2026-02', 'agent-1');
    expect(result.persistency).toBe(0.7393);
  });

  it('returns null when doc is pre-E3 (legacy single-percentage doc) — silent filter', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => ({
        agentId: 'agent-1',
        year: 2026,
        month: 2,
        persistency: 92.5, // legacy 0–100
      }),
    });
    expect(await getPersistencyForAgent('tenant1', '2026-02', 'agent-1')).toBeNull();
  });
});

describe('getPersistencyForBranch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters users by branchId + role==="agent"', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent',          branchId: 'branch-x' },
      { id: 'a2', role: 'agent',          branchId: 'branch-y' }, // wrong branch
      { id: 'm1', role: 'unit_manager',   branchId: 'branch-x' }, // wrong role
      { id: 'a3', role: 'agent',          branchId: 'branch-x' },
    ]);
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await getPersistencyForBranch('tenant1', '2026-02', 'branch-x');

    // Only a1 + a3 should be looked up (2 calls).
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  it('silently filters pre-E3 docs out of the returned list', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent', branchId: 'b1' },
      { id: 'a2', role: 'agent', branchId: 'b1' },
    ]);
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, id: 'a1_2026_02', data: () => E3_FULL_DOC })
      .mockResolvedValueOnce({ exists: () => true, id: 'a2_2026_02', data: () => ({ persistency: 92.5 }) });

    const result = await getPersistencyForBranch('tenant1', '2026-02', 'b1');
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('agent-1');
  });
});

describe('getAvailableMonths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTodayTT.mockReturnValue('2000-01-15'); // restore the unrelated-fixture default
  });

  // P1b brief §3 item 1 — the getAvailableMonths cases. The window was widened
  // from a fixed three months to year-to-date (floored at three) once it turned
  // out Tatil's reports lag by months, not weeks: June 2026 and July 2026 both
  // landed in September 2026, and a three-month window could not reach June.
  const YTD_THROUGH_OCT_2026 = [
    '2026-10', '2026-09', '2026-08', '2026-07', '2026-06',
    '2026-05', '2026-04', '2026-03', '2026-02', '2026-01',
  ];

  it('unions doc-derived months with the year-to-date TT window (TT today 2026-10-03)', async () => {
    mockGetTodayTT.mockReturnValue('2026-10-03');
    mockGetDocs.mockResolvedValueOnce({
      forEach(cb) {
        [
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-05' }) },
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-06' }) },
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-05' }) },     // duplicate
          { data: () => ({                  monthKey: '2025-12' }) },  // pre-E3 — filtered
        ].forEach(cb);
      },
    });
    const result = await getAvailableMonths('tenant1', 'tenant', 'tenant1');
    expect(result).toEqual(YTD_THROUGH_OCT_2026);
    expect(result).not.toContain('2025-12'); // pre-E3 doc stays filtered
  });

  it('returns just the year-to-date TT window when no E3 docs exist (no docs sentinel/fallback needed)', async () => {
    mockGetTodayTT.mockReturnValue('2026-10-03');
    mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
    const result = await getAvailableMonths('tenant1', 'tenant', 'tenant1');
    expect(result).toEqual(YTD_THROUGH_OCT_2026);
  });

  it('de-dupes a month present in both the doc set and the current TT window', async () => {
    mockGetTodayTT.mockReturnValue('2026-10-03');
    mockGetDocs.mockResolvedValueOnce({
      forEach(cb) {
        [
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-09' }) }, // also in the window
          { data: () => ({ ...E3_INPUTS, monthKey: '2026-01' }) }, // also in the window now
        ].forEach(cb);
      },
    });
    const result = await getAvailableMonths('tenant1', 'tenant', 'tenant1');
    expect(result).toEqual(YTD_THROUGH_OCT_2026);
    expect(result.filter((m) => m === '2026-09')).toHaveLength(1);
    expect(result.filter((m) => m === '2026-01')).toHaveLength(1);
  });

  it('reaches back to January of the current year (the real case: June’s report arrived in September)', async () => {
    // The change this window exists for. Head office published June 2026 and
    // July 2026 persistency in September 2026; both must be enterable.
    mockGetTodayTT.mockReturnValue('2026-09-20');
    mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
    const result = await getAvailableMonths('tenant1', 'agent', 'agent-1');
    expect(result).toEqual([
      '2026-09', '2026-08', '2026-07', '2026-06',
      '2026-05', '2026-04', '2026-03', '2026-02', '2026-01',
    ]);
    expect(result).toContain('2026-06');
    expect(result).toContain('2026-07');
  });

  it('never reaches into the prior year beyond the floor (December stays out in September)', async () => {
    // Year-to-date means THIS year. A September window must not offer last
    // December, or a manager can enter a month on the wrong persistency model.
    mockGetTodayTT.mockReturnValue('2026-09-20');
    mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
    const result = await getAvailableMonths('tenant1', 'agent', 'agent-1');
    expect(result.every((m) => m.startsWith('2026-'))).toBe(true);
  });

  it('derives the window from getTodayTT (TT calendar day), not new Date()', async () => {
    // Regression guard for the UTC trap the brief calls out: `new Date()` is
    // the previous day (UTC) for four hours every TT evening. getAvailableMonths
    // must consult getTodayTT(), never construct its own Date.
    mockGetTodayTT.mockReturnValue('2026-01-01');
    mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
    const result = await getAvailableMonths('tenant1', 'tenant', 'tenant1');
    // The floor binds here: a bare year-to-date window would offer January
    // alone and strand the November and December that settle a December gate.
    expect(result).toEqual(['2026-01', '2025-12', '2025-11']);
    expect(mockGetTodayTT).toHaveBeenCalled();
  });

  it('the floor still binds in February, where year-to-date is only two months', async () => {
    mockGetTodayTT.mockReturnValue('2026-02-14');
    mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
    const result = await getAvailableMonths('tenant1', 'tenant', 'tenant1');
    expect(result).toEqual(['2026-02', '2026-01', '2025-12']);
  });

  it('the floor stops binding from March onward', async () => {
    mockGetTodayTT.mockReturnValue('2026-03-31');
    mockGetDocs.mockResolvedValueOnce({ forEach: () => {} });
    const result = await getAvailableMonths('tenant1', 'tenant', 'tenant1');
    expect(result).toEqual(['2026-03', '2026-02', '2026-01']);
  });
});

describe('getAgentHistory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns oldest-first records, filtered to E3 only, capped at lastNMonths', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'a1_2025_11', data: () => ({ ...E3_INPUTS, monthKey: '2025-11' }) },
        { id: 'a1_2026_02', data: () => ({ ...E3_INPUTS, monthKey: '2026-02' }) },
        { id: 'a1_2026_01', data: () => ({ ...E3_INPUTS, monthKey: '2026-01' }) },
        { id: 'a1_2025_10', data: () => ({                  monthKey: '2025-10' }) }, // pre-E3
      ],
    });
    const out = await getAgentHistory('tenant1', 'a1', 12);
    expect(out.map((r) => r.monthKey)).toEqual(['2025-11', '2026-01', '2026-02']);
  });

  it('caps results at lastNMonths', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: Array.from({ length: 14 }, (_, i) => ({
        id: `a1_2025_${String(i + 1).padStart(2, '0')}`,
        data: () => ({ ...E3_INPUTS, monthKey: `2025-${String(i + 1).padStart(2, '0')}` }),
      })),
    });
    const out = await getAgentHistory('tenant1', 'a1', 6);
    expect(out).toHaveLength(6);
  });
});

describe('savePersistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'writer-uid' };
  });

  it('throws when no user is signed in', async () => {
    mockAuth.currentUser = null;
    await expect(
      savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'agent'),
    ).rejects.toThrow(/no signed-in user/);
  });

  it('throws on invalid role', async () => {
    await expect(
      savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'super_admin'),
    ).rejects.toThrow(/invalid role/);
  });

  it('throws on malformed monthKey', async () => {
    await expect(
      savePersistency('tenant1', '2026/02', 'agent-1', E3_INPUTS, 'agent'),
    ).rejects.toThrow(/invalid monthKey/);
  });

  it('throws on negative input', async () => {
    await expect(
      savePersistency('tenant1', '2026-02', 'agent-1', { ...E3_INPUTS, lapses: -100 }, 'agent'),
    ).rejects.toThrow(/lapses must be a non-negative number/);
  });

  it('applies derived calculations (gross/net/persistency/meetsAwardGate) on write', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'agent');

    expect(result.grossSettled).toBeCloseTo(406335.53, 2);
    expect(result.netSettled).toBeCloseTo(300397.73, 2);
    expect(result.persistency).toBeCloseTo(0.7393, 4);
    expect(result.meetsAwardGate).toBe(false); // 0.7393 < 0.90
    expect(result.year).toBe(2026);
    expect(result.month).toBe(2);
    expect(result.monthKey).toBe('2026-02');

    // Verify the actual setDoc payload included the derived fields.
    const writtenPayload = mockSetDoc.mock.calls[0][1];
    expect(writtenPayload.persistency).toBeCloseTo(0.7393, 4);
    expect(writtenPayload.tenantId).toBe('tenant1');
    expect(writtenPayload.enteredBy).toBe('writer-uid');
    expect(writtenPayload.enteredByRole).toBe('agent');
  });

  it('writes the Confirm-flow provenance (source, confirmedBy/At, ledgerWindowMonths) and nothing else extra', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'agent', {
      source: 'ho_confirmed',
      confirmedBy: 'agent-1',
      confirmedAt: '2026-09-23T12:00:00.000Z',
      ledgerWindowMonths: 24,
      somethingElse: 'dropped',
    });

    const writtenPayload = mockSetDoc.mock.calls[0][1];
    expect(writtenPayload.source).toBe('ho_confirmed');
    expect(writtenPayload.confirmedBy).toBe('agent-1');
    expect(writtenPayload.confirmedAt).toBe('2026-09-23T12:00:00.000Z');
    expect(writtenPayload.ledgerWindowMonths).toBe(24);
    expect(writtenPayload).not.toHaveProperty('somethingElse');
  });

  it('marks meetsAwardGate=true when persistency >= 0.90', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const highInputs = {
      businessPlaced: 1000000, notTakens: 0, incPPPs: 0, lumpsums100: 0,
      lapses: 50000, reinstatements: 10000,
    };
    const result = await savePersistency('tenant1', '2026-02', 'agent-1', highInputs, 'branch_manager');
    // (1000000 - 50000 + 10000) / 1000000 = 0.96
    expect(result.persistency).toBeCloseTo(0.96, 4);
    expect(result.meetsAwardGate).toBe(true);
  });

  it('preserves enteredAt/By/ByRole on overwrite, updates only lastEdit*', async () => {
    const priorTimestamp = { seconds: 1700000000, nanoseconds: 0 };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => ({
        ...E3_FULL_DOC,
        enteredAt: priorTimestamp,
        enteredBy: 'original-writer',
        enteredByRole: 'agent',
      }),
    });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'branch_manager');

    const written = mockSetDoc.mock.calls[0][1];
    expect(written.enteredAt).toEqual(priorTimestamp);
    expect(written.enteredBy).toBe('original-writer');
    expect(written.enteredByRole).toBe('agent');
    expect(written.lastEditedBy).toBe('writer-uid');
    expect(written.lastEditedByRole).toBe('branch_manager');
  });

  // P2d (BUG-05): firestore.rules requires an AGENT write to carry
  // enteredBy == the agent. An agent replacing figures a manager entered is
  // now who entered them, so the agent's save re-stamps.
  it('P2d: an AGENT overwriting a doc someone else entered re-stamps enteredBy/At/ByRole to the agent', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'writer-uid_2026_02',
      data: () => ({
        ...E3_FULL_DOC,
        enteredAt: { seconds: 1700000000, nanoseconds: 0 },
        enteredBy: 'bm-uid',
        enteredByRole: 'branch_manager',
      }),
    });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-02', 'writer-uid', E3_INPUTS, 'agent');

    const written = mockSetDoc.mock.calls[0][1];
    expect(written.enteredBy).toBe('writer-uid');
    expect(written.enteredByRole).toBe('agent');
    expect(written.enteredAt).not.toEqual({ seconds: 1700000000, nanoseconds: 0 });
  });

  it('P2d: an AGENT overwriting their OWN entry keeps the original enteredAt', async () => {
    const priorTimestamp = { seconds: 1700000000, nanoseconds: 0 };
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'writer-uid_2026_02',
      data: () => ({ ...E3_FULL_DOC, enteredAt: priorTimestamp, enteredBy: 'writer-uid', enteredByRole: 'agent' }),
    });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-02', 'writer-uid', E3_INPUTS, 'agent');

    const written = mockSetDoc.mock.calls[0][1];
    expect(written.enteredBy).toBe('writer-uid');
    expect(written.enteredAt).toEqual(priorTimestamp);
  });

  it('treats overwriting a pre-E3 doc as a fresh first-write (no audit pollution)', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'agent-1_2026_02',
      data: () => ({ persistency: 92.5, agentId: 'agent-1' }), // legacy doc
    });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-02', 'agent-1', E3_INPUTS, 'branch_manager');

    const written = mockSetDoc.mock.calls[0][1];
    expect(written.enteredBy).toBe('writer-uid');
    expect(written.enteredByRole).toBe('branch_manager');
    expect(written.lastEditedBy).toBe('writer-uid');
    expect(written.lastEditedByRole).toBe('branch_manager');
  });
});

describe('getPersistencyMapForYear', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns map keyed by agentId with E3 records only, scoped by branchId', async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent',          branchId: 'b1' },
      { id: 'a2', role: 'agent',          branchId: 'b2' }, // wrong branch
      { id: 'm1', role: 'unit_manager',   branchId: 'b1' }, // not an agent
      { id: 'a3', role: 'agent',          branchId: 'b1' },
    ]);
    // EFF-005: a1 + a3 (both branch b1 agents) are fetched in a single
    // `agentId in [...]` batch, so getDocs is called once and returns all
    // matching docs across the batch. a3 has none.
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ ...E3_INPUTS, agentId: 'a1', year: 2026, monthKey: '2026-01' }) },
        { data: () => ({ ...E3_INPUTS, agentId: 'a1', year: 2026, monthKey: '2026-02' }) },
        { data: () => ({                  agentId: 'a1', year: 2026 }) }, // pre-E3 — filtered
      ],
    });

    const map = await getPersistencyMapForYear('tenant1', 2026, { branchId: 'b1' });

    // a1 + a3 fetched in one batch; only a1 had records.
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(Object.keys(map)).toEqual(['a1']);
    expect(map.a1).toHaveLength(2);
    // Assert the actual records survived (not just the count) — the two E3 docs
    // in month order, with the pre-E3 doc filtered out.
    expect(map.a1.map((r) => r.monthKey)).toEqual(['2026-01', '2026-02']);
  });

  it('silently skips a batch whose query is rejected by rules', async () => {
    // EFF-005: 10 branch-b1 agents span two batches (9 + 1, SEC-07 batch size).
    // The first batch's query is rejected (rules); the second resolves. Each
    // batch is caught independently, so the rejected batch is skipped silently
    // while the other still returns — the batch-granularity analog of the prior
    // per-agent skip.
    const batch1Agents = Array.from({ length: 9 }, (_, i) => ({
      id: `x${i}`, role: 'agent', branchId: 'b1',
    }));
    getTenantUsers.mockResolvedValueOnce([
      ...batch1Agents,
      { id: 'a2', role: 'agent', branchId: 'b1' },
    ]);
    mockGetDocs
      .mockRejectedValueOnce(new Error('PERMISSION_DENIED')) // batch 1 (x0..x8)
      .mockResolvedValueOnce({                                // batch 2 (a2)
        docs: [
          { data: () => ({ ...E3_INPUTS, agentId: 'a2', year: 2026, monthKey: '2026-01' }) },
        ],
      });

    const map = await getPersistencyMapForYear('tenant1', 2026, { branchId: 'b1' });
    expect(map.x0).toBeUndefined();
    expect(Object.keys(map)).toEqual(['a2']);
    expect(map.a2).toHaveLength(1);
    // Verify the surviving batch's actual record, not just key presence.
    expect(map.a2[0].monthKey).toBe('2026-01');
  });
});

// -----------------------------------------------------------------------------
// SEC-07 (audit 2026-09-24) — every list query carries a filter the scoped
// `allow list` rule can prove, and no batch exceeds the rules engine's get()
// budget. The rule does one get() per agent id plus one for the caller, and
// production caps a query at 10 get() calls, so a batch holds at most 9 ids.
// -----------------------------------------------------------------------------

function inBatches() {
  return mockGetDocs.mock.calls.map(([q]) =>
    q.__query.find((c) => c.__where?.[1] === 'in').__where[2]);
}

describe('SEC-07 — persistency list queries are scoped and batched', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTodayTT.mockReturnValue('2026-09-25');
  });

  it('the batch size fits the 10-get() rules budget', () => {
    expect(PERSISTENCY_QUERY_BATCH).toBe(9);
  });

  it('getPersistencyMapForYear splits 19 agents into batches of at most 9', async () => {
    getTenantUsers.mockResolvedValueOnce(
      Array.from({ length: 19 }, (_, i) => ({ id: `a${i}`, role: 'agent', branchId: 'b1' })),
    );
    mockGetDocs.mockResolvedValue({ docs: [] });
    await getPersistencyMapForYear('tenant1', 2026, { branchId: 'b1' });
    expect(inBatches().map((b) => b.length)).toEqual([9, 9, 1]);
  });

  it('getPersistencyForAgentIds splits 10 ids into 9 + 1', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await getPersistencyForAgentIds('tenant1', 2026, Array.from({ length: 10 }, (_, i) => `a${i}`));
    expect(inBatches().map((b) => b.length)).toEqual([9, 1]);
  });

  it("getAvailableMonths 'branch' scope queries only that branch's users, never the whole collection", async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent',        branchId: 'b1', unitId: 'u1' },
      { id: 'm1', role: 'unit_manager', branchId: 'b1', unitId: 'u1' }, // producing UM — own months count
      { id: 'a2', role: 'agent',        branchId: 'b2', unitId: 'u2' }, // other branch
    ]);
    mockGetDocs.mockResolvedValue({
      forEach(cb) { [{ data: () => ({ ...E3_INPUTS, monthKey: '2025-11' }) }].forEach(cb); },
    });
    const months = await getAvailableMonths('tenant1', 'branch', 'b1');
    expect(inBatches()).toEqual([['a1', 'm1']]);
    expect(months).toContain('2025-11');
  });

  it("getAvailableMonths 'unit' scope queries only that unit's users", async () => {
    getTenantUsers.mockResolvedValueOnce([
      { id: 'a1', role: 'agent', branchId: 'b1', unitId: 'u1' },
      { id: 'a3', role: 'agent', branchId: 'b1', unitId: 'u9' },
    ]);
    mockGetDocs.mockResolvedValue({ forEach: () => {} });
    await getAvailableMonths('tenant1', 'unit', 'u1');
    expect(inBatches()).toEqual([['a1']]);
  });

  it("getAvailableMonths 'branch' scope with no users runs no query and still offers the entry window", async () => {
    getTenantUsers.mockResolvedValueOnce([]);
    const months = await getAvailableMonths('tenant1', 'branch', 'empty-branch');
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(months[0]).toBe('2026-09');
  });
});

// -----------------------------------------------------------------------------
// Tatil 24-month model (memo of 29 Aug 2026)
// -----------------------------------------------------------------------------

const M24_INPUTS = { ...E3_INPUTS, decreases: 12000 };

describe('isModelCompleteDoc', () => {
  it('accepts a legacy-month doc with the six E3 fields and no decreases', () => {
    expect(isModelCompleteDoc({ ...E3_FULL_DOC, monthKey: '2026-08' })).toBe(true);
  });

  it('rejects a 24-month-model doc that is missing decreases', () => {
    // The whole point: a September doc without the term would derive its
    // denominator as if decreases were zero, which is an unentered figure
    // masquerading as a real one.
    expect(isModelCompleteDoc({ ...E3_FULL_DOC, monthKey: '2026-09' })).toBe(false);
  });

  it('accepts a 24-month-model doc carrying decreases', () => {
    expect(isModelCompleteDoc({ ...E3_FULL_DOC, monthKey: '2026-09', decreases: 0 })).toBe(true);
    expect(isModelCompleteDoc({ ...E3_FULL_DOC, monthKey: '2026-09', decreases: 500 })).toBe(true);
  });

  it('rejects a negative or non-numeric decreases on a 24-month-model doc', () => {
    const base = { ...E3_FULL_DOC, monthKey: '2026-09' };
    expect(isModelCompleteDoc({ ...base, decreases: -1 })).toBe(false);
    expect(isModelCompleteDoc({ ...base, decreases: '500' })).toBe(false);
    expect(isModelCompleteDoc({ ...base, decreases: null })).toBe(false);
    expect(isModelCompleteDoc({ ...base, decreases: NaN })).toBe(false);
  });

  it('still rejects anything that is not E3-shaped at all', () => {
    expect(isModelCompleteDoc(null)).toBe(false);
    expect(isModelCompleteDoc({ persistency: 92.5 })).toBe(false);
    expect(isModelCompleteDoc({ ...E3_INPUTS, lapses: null, monthKey: '2026-08' })).toBe(false);
  });

  it('never throws on a doc with a missing or malformed monthKey, and keeps it visible', () => {
    // These filter untrusted Firestore documents. Throwing would take out a
    // whole list render; hiding them would drop records that are visible today.
    // Such a doc cannot be a 24-month doc, because savePersistency always
    // stores a validated key, so legacy treatment is the correct answer.
    const noKey = { ...E3_INPUTS };
    expect(() => isModelCompleteDoc(noKey)).not.toThrow();
    expect(isModelCompleteDoc(noKey)).toBe(true);
    expect(isModelCompleteDoc({ ...E3_INPUTS, monthKey: '2026/09' })).toBe(true);
    expect(isModelCompleteDoc({ ...E3_INPUTS, monthKey: 42 })).toBe(true);
  });
});

describe('savePersistency on the 24-month model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'writer-uid' };
  });

  it('refuses a September save with no decreases rather than writing 0', async () => {
    await expect(
      savePersistency('tenant1', '2026-09', 'agent-1', E3_INPUTS, 'agent'),
    ).rejects.toThrow(/decreases is required on the tatil24 model \(month 2026-09\)/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('refuses an empty-string decreases the same way', async () => {
    await expect(
      savePersistency('tenant1', '2026-09', 'agent-1', { ...E3_INPUTS, decreases: '' }, 'agent'),
    ).rejects.toThrow(/decreases is required/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('refuses a negative decreases', async () => {
    await expect(
      savePersistency('tenant1', '2026-09', 'agent-1', { ...E3_INPUTS, decreases: -1 }, 'agent'),
    ).rejects.toThrow(/decreases must be a non-negative number/);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('writes decreases and subtracts it from the derived denominator', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await savePersistency('tenant1', '2026-09', 'agent-1', M24_INPUTS, 'agent');

    const written = mockSetDoc.mock.calls[0][1];
    expect(written.decreases).toBe(12000);
    // Same six inputs as the Ricardo fixture, minus the new 12000 term.
    expect(result.grossSettled).toBeCloseTo(406335.53 - 12000, 2);
    expect(result.netSettled).toBeCloseTo(300397.73 - 12000, 2);
  });

  it('stamps modelId provenance on a 24-month write', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-09', 'agent-1', M24_INPUTS, 'agent');

    expect(mockSetDoc.mock.calls[0][1].modelId).toBe('tatil24');
  });

  it('stores the 24-month report period on a 24-month write', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await savePersistency('tenant1', '2026-09', 'agent-1', M24_INPUTS, 'agent');

    expect(result.reportPeriodStart).toBe('2024-10-01');
    expect(result.reportPeriodEnd).toBe('2026-09-30');
  });

  it('leaves a legacy-month write untouched: no decreases key, no modelId', async () => {
    // P-D2: decreases is never back-filled, so an August document must be
    // byte-for-byte what it would have been before this change existed.
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    await savePersistency('tenant1', '2026-08', 'agent-1', E3_INPUTS, 'agent');

    const written = mockSetDoc.mock.calls[0][1];
    expect('decreases' in written).toBe(false);
    expect('modelId' in written).toBe(false);
    expect(written.grossSettled).toBeCloseTo(406335.53, 2);
  });

  it('ignores a stray decreases passed on a legacy month', async () => {
    // The model decides the input set, not the caller. A legacy month must not
    // start subtracting a term the report it was transcribed from never had.
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const result = await savePersistency('tenant1', '2026-08', 'agent-1', M24_INPUTS, 'agent');

    expect('decreases' in mockSetDoc.mock.calls[0][1]).toBe(false);
    expect(result.grossSettled).toBeCloseTo(406335.53, 2);
  });
});

// P1b brief §3 item 2 (P-D10) — the two savePersistency negative-denominator cases, verbatim.
describe('savePersistency — negative-denominator guard (P-D10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'writer-uid' };
  });

  it('refuses a save when the derived Net Gross Settled is negative', async () => {
    const inputs = {
      businessPlaced: 1000, notTakens: 0, decreases: 1500,
      incPPPs: 0, lumpsums100: 0, lapses: 0, reinstatements: 0,
    };
    // grossSettled = 1000 - 0 - 1500 + 0 + 0 = -500
    await expect(
      savePersistency('tenant1', '2026-09', 'agent-1', inputs, 'agent'),
    ).rejects.toThrow('Net Gross Settled is negative — check Decreases against Gross Settled.');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('accepts a zero derived Net Gross Settled and stores persistency: 0', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const inputs = {
      businessPlaced: 1000, notTakens: 0, decreases: 1000,
      incPPPs: 0, lumpsums100: 0, lapses: 0, reinstatements: 0,
    };
    // grossSettled = 1000 - 0 - 1000 + 0 + 0 = 0 — today's calculatePersistency
    // behaviour (0 stays 0) is unchanged; only a NEGATIVE gross is refused.
    const result = await savePersistency('tenant1', '2026-09', 'agent-1', inputs, 'agent');

    expect(result.grossSettled).toBe(0);
    expect(result.persistency).toBe(0);
    expect(mockSetDoc.mock.calls[0][1].persistency).toBe(0);
  });
});

describe('getAvailableMonths — model-incomplete months stay reachable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks() clears call history but NOT a prior mockReturnValue —
    // restore the safe unrelated-fixture default explicitly so the preceding
    // describe block's TT-window overrides can never leak into this one.
    mockGetTodayTT.mockReturnValue('2000-01-15');
  });

  it('still lists a September month whose doc predates the decreases term', async () => {
    // The stranding trap: a 2026-09 doc written on the six-field code has no
    // `decreases`, so isModelCompleteDoc hides the RECORD. If the month selector
    // used the same filter, the month would vanish — and with no "add a month"
    // affordance in the UI, it could never be selected again to be corrected.
    // TT "today" is pinned inside September so the P1b window (year-to-date,
    // Sep back to Jan) is exactly what's asserted below — the window is
    // unconditional, so this list is the doc months UNION the window, not the
    // doc months alone. What this test actually guards is that 2026-09 survives
    // despite its doc lacking `decreases`; the surrounding months are the window.
    mockGetTodayTT.mockReturnValue('2026-09-06');
    mockGetDocs.mockResolvedValueOnce({
      forEach: (fn) => {
        [
          { ...E3_INPUTS, monthKey: '2026-08' },
          { ...E3_INPUTS, monthKey: '2026-09' }, // no decreases
        ].forEach((data) => fn({ data: () => data }));
      },
    });

    const months = await getAvailableMonths('tenant1', 'agent', 'agent-1');

    expect(months).toContain('2026-09');
    expect(months).toEqual([
      '2026-09', '2026-08', '2026-07', '2026-06',
      '2026-05', '2026-04', '2026-03', '2026-02', '2026-01',
    ]); // newest first
  });

  it('still hides that month’s record from the reads that show figures', async () => {
    // The other half of the pair: reachable in the selector, absent as a record.
    expect(isModelCompleteDoc({ ...E3_FULL_DOC, monthKey: '2026-09' })).toBe(false);
  });
});

// R2-1b commit 1 — CHARACTERIZATION of the stored `meetsAwardGate` flag at the
// seven brief values, before the 2-dp rule reaches it. Gross 100,000; lapses
// set so net / gross is exactly the value in percent.
describe('savePersistency — meetsAwardGate at the gate (R2-1b characterization)', () => {
  it('pins the stored flag at 89.49 / 89.50 / 89.60 / 89.994 / 89.995 / 89.996 / 90', async () => {
    const rows = [];
    for (const v of [89.49, 89.5, 89.6, 89.994, 89.995, 89.996, 90]) {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockSetDoc.mockResolvedValueOnce(undefined);
      const inputs = { businessPlaced: 100000, notTakens: 0, incPPPs: 0, lumpsums100: 0, lapses: 100000 - v * 1000, reinstatements: 0 };
      const result = await savePersistency('tenant1', '2026-02', 'agent-1', inputs, 'agent');
      rows.push(`${v} → stored ${result.meetsAwardGate}`);
    }
    expect(rows).toMatchInlineSnapshot(`
      [
        "89.49 → stored false",
        "89.5 → stored false",
        "89.6 → stored false",
        "89.994 → stored false",
        "89.995 → stored true",
        "89.996 → stored true",
        "90 → stored true",
      ]
    `);
  });
});
