import { describe, it, expect, vi, beforeEach } from 'vitest';

let docSeq = 0;
const hoisted = vi.hoisted(() => ({
  mockAddDoc:     vi.fn(),
  mockUpdateDoc:  vi.fn(),
  mockDeleteDoc:  vi.fn(),
  mockGetDocs:    vi.fn(),
  mockQuery:      vi.fn((...args) => ({ _query: args })),
  mockWhere:      vi.fn((field, op, value) => ({ _where: { field, op, value } })),
  mockOrderBy:    vi.fn((field, dir) => ({ _orderBy: { field, dir } })),
  mockCollection: vi.fn((...args) => ({ _collection: args })),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  mockBatchSet:    vi.fn(),
  mockBatchCommit: vi.fn(() => Promise.resolve()),
}));
// doc() mints a fresh id on every call (mirrors Firestore auto-id) so the series
// grouping id + per-instance refs are distinguishable.
const mockDoc = vi.fn((...args) => ({ id: `auto-${docSeq += 1}`, _doc: args }));
const mockWriteBatch = vi.fn(() => ({ set: hoisted.mockBatchSet, commit: hoisted.mockBatchCommit }));

vi.mock('firebase/firestore', () => ({
  collection:      (...a) => hoisted.mockCollection(...a),
  doc:             (...a) => mockDoc(...a),
  addDoc:          (...a) => hoisted.mockAddDoc(...a),
  updateDoc:       (...a) => hoisted.mockUpdateDoc(...a),
  deleteDoc:       (...a) => hoisted.mockDeleteDoc(...a),
  getDocs:         (...a) => hoisted.mockGetDocs(...a),
  query:           (...a) => hoisted.mockQuery(...a),
  where:           (...a) => hoisted.mockWhere(...a),
  orderBy:         (...a) => hoisted.mockOrderBy(...a),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
  writeBatch:      (...a) => mockWriteBatch(...a),
}));

import {
  createAppointment, createRecurringAppointments, updateAppointment, setAppointmentStatus,
  postponeWithRebook, deleteAppointment, undoPostpone,
  getAgentDay, getAgentWeek, getTeamWeek,
  TYPE_KEYS, STATUS_KEYS,
} from '../plannerService';

function makeSnap(...docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}
const whereCalls = () => hoisted.mockWhere.mock.calls.map(([field, op, value]) => ({ field, op, value }));

beforeEach(() => { vi.clearAllMocks(); });

const META = { agentId: 'agent-1', agentUnitId: 'um-9', agentBranchId: 'branch-7' };

describe('contract enums', () => {
  it('exposes the locked TYPE and STATUS sets', () => {
    expect(TYPE_KEYS).toEqual(['PC', 'SC', 'AI', 'FFI', 'CI', 'SALE', 'FREE']);
    expect(STATUS_KEYS).toEqual(['scheduled', 'confirmed', 'kept', 'done', 'postponed', 'cancelled']);
  });
});

describe('createAppointment', () => {
  it('writes every required contract key + denormalized agent scope', async () => {
    hoisted.mockAddDoc.mockResolvedValue({ id: 'new-1' });
    const id = await createAppointment('t1', {
      type: 'CI', date: '2026-06-22', startTime: '09:00', durationMin: 45,
      note: '  bring quote  ', prospectId: 'p1', apiAmount: '1200',
    }, META);
    expect(id).toBe('new-1');
    const payload = hoisted.mockAddDoc.mock.calls[0][1];
    for (const k of ['tenantId', 'agentId', 'agentUnitId', 'agentBranchId', 'date',
      'startTime', 'durationMin', 'type', 'status', 'note', 'createdAt', 'updatedAt']) {
      expect(payload).toHaveProperty(k);
    }
    expect(payload.tenantId).toBe('t1');
    expect(payload.agentId).toBe('agent-1');
    expect(payload.agentUnitId).toBe('um-9');
    expect(payload.agentBranchId).toBe('branch-7');
    expect(payload.durationMin).toBe(45);
    expect(payload.note).toBe('bring quote');         // trimmed
    expect(payload.apiAmount).toBe(1200);             // parseFloat
    expect(payload.prospectId).toBe('p1');
    expect(payload.status).toBe('scheduled');         // default
    expect(payload.createdAt).toEqual({ _type: 'serverTimestamp' });
  });

  it('clamps durationMin into 1–720 and defaults bad type/status', async () => {
    hoisted.mockAddDoc.mockResolvedValue({ id: 'n' });
    await createAppointment('t1', { type: 'BOGUS', status: 'x', durationMin: 9999, date: '2026-06-22', startTime: '10:00' }, META);
    const p = hoisted.mockAddDoc.mock.calls[0][1];
    expect(p.durationMin).toBe(720);
    expect(p.type).toBe('PC');
    expect(p.status).toBe('scheduled');
    expect(p.apiAmount).toBeUndefined();              // omitted when absent
  });

  it('only writes freeBlockLabel for FREE type', async () => {
    hoisted.mockAddDoc.mockResolvedValue({ id: 'n' });
    await createAppointment('t1', { type: 'FREE', freeBlockLabel: 'Training', date: '2026-06-22', startTime: '10:00' }, META);
    expect(hoisted.mockAddDoc.mock.calls[0][1].freeBlockLabel).toBe('Training');
    hoisted.mockAddDoc.mockClear();
    await createAppointment('t1', { type: 'CI', freeBlockLabel: 'Training', date: '2026-06-22', startTime: '10:00' }, META);
    expect(hoisted.mockAddDoc.mock.calls[0][1].freeBlockLabel).toBeUndefined();
  });
});

describe('createRecurringAppointments', () => {
  it('batch-writes one doc per occurrence, each with series metadata', async () => {
    const res = await createRecurringAppointments('t1', {
      type: 'PC', date: '2026-07-14', startTime: '17:00', durationMin: 60, note: 'dial block',
    }, { repeatRule: 'weekly', endCondition: { type: 'count', count: 4 } }, META);

    expect(res.count).toBe(4);
    expect(res.dates).toEqual(['2026-07-14', '2026-07-21', '2026-07-28', '2026-08-04']);
    expect(hoisted.mockBatchSet).toHaveBeenCalledTimes(4);
    expect(hoisted.mockBatchCommit).toHaveBeenCalledTimes(1);

    const payloads = hoisted.mockBatchSet.mock.calls.map((c) => c[1]);
    // Every instance shares one seriesId and carries pos/total + the contract keys.
    const seriesIds = new Set(payloads.map((p) => p.seriesId));
    expect(seriesIds.size).toBe(1);
    expect([...seriesIds][0]).toBe(res.seriesId);
    payloads.forEach((p, i) => {
      expect(p.repeatRule).toBe('weekly');
      expect(p.seriesPos).toBe(i + 1);
      expect(p.seriesTotal).toBe(4);
      expect(p.date).toBe(res.dates[i]);
      expect(p.agentId).toBe('agent-1');
      expect(p.agentUnitId).toBe('um-9');
      expect(p.type).toBe('PC');
      expect(p).not.toHaveProperty('daysOfWeek'); // weekly omits daysOfWeek
    });
  });

  it('returns per-instance ids (Run 9 A1) in date order, one per occurrence', async () => {
    const res = await createRecurringAppointments('t1', {
      type: 'PC', date: '2026-07-14', startTime: '17:00', durationMin: 60, note: 'dial block',
    }, { repeatRule: 'weekly', endCondition: { type: 'count', count: 3 } }, META);
    expect(res.ids).toHaveLength(3);
    expect(new Set(res.ids).size).toBe(3); // all distinct
    expect(res.ids).not.toContain(res.seriesId); // seriesId is its own mint, not an instance id
  });

  it('stores daysOfWeek only for custom cadence', async () => {
    const res = await createRecurringAppointments('t1', {
      type: 'FREE', date: '2026-07-14', startTime: '12:00', durationMin: 60, freeBlockLabel: 'Prospecting time',
    }, { repeatRule: 'custom', daysOfWeek: ['TUE', 'THU'], endCondition: { type: 'count', count: 3 } }, META);
    expect(res.count).toBe(3);
    const payloads = hoisted.mockBatchSet.mock.calls.map((c) => c[1]);
    payloads.forEach((p) => expect(p.daysOfWeek).toEqual(['TUE', 'THU']));
  });

  it('throws when the recurrence yields no occurrences', async () => {
    await expect(createRecurringAppointments('t1', { date: '' },
      { repeatRule: 'weekly', endCondition: { type: 'count', count: 4 } }, META))
      .rejects.toThrow(/no occurrences/i);
  });
});

describe('updateAppointment', () => {
  it('never mutates the immutable agent-scope pins, always stamps updatedAt', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue();
    await updateAppointment('t1', 'a1', {
      startTime: '11:30', note: 'x', agentId: 'HACK', tenantId: 'HACK', agentUnitId: 'HACK', agentBranchId: 'HACK',
    });
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.startTime).toBe('11:30');
    expect(patch.updatedAt).toEqual({ _type: 'serverTimestamp' });
    expect(patch).not.toHaveProperty('agentId');
    expect(patch).not.toHaveProperty('tenantId');
    expect(patch).not.toHaveProperty('agentUnitId');
    expect(patch).not.toHaveProperty('agentBranchId');
  });
});

describe('setAppointmentStatus', () => {
  it('rejects an invalid status', async () => {
    await expect(setAppointmentStatus('t1', 'a1', 'nope')).rejects.toThrow(/Invalid appointment status/);
  });
  it('flips status + updatedAt (and optional apiAmount)', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue();
    await setAppointmentStatus('t1', 'a1', 'kept', { apiAmount: '500' });
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.status).toBe('kept');
    expect(patch.apiAmount).toBe(500);
    expect(patch.updatedAt).toEqual({ _type: 'serverTimestamp' });
  });
});

describe('postponeWithRebook', () => {
  it('creates the new appt then links the original as postponed', async () => {
    hoisted.mockAddDoc.mockResolvedValue({ id: 'new-99' });
    hoisted.mockUpdateDoc.mockResolvedValue();
    const newId = await postponeWithRebook('t1', 'orig-1', {
      type: 'CI', date: '2026-06-24', startTime: '14:00',
    }, META);
    expect(newId).toBe('new-99');
    expect(hoisted.mockAddDoc).toHaveBeenCalledTimes(1);   // the new appt
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledTimes(1); // the original
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.status).toBe('postponed');
    expect(patch.rescheduledToId).toBe('new-99');
  });
});

describe('deleteAppointment', () => {
  it('deletes the doc at the given tenant/appt path', async () => {
    hoisted.mockDeleteDoc.mockResolvedValue();
    await deleteAppointment('t1', 'a1');
    expect(hoisted.mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('undoPostpone', () => {
  it('deletes the new appt then flips the original back to scheduled with rescheduledToId cleared', async () => {
    hoisted.mockDeleteDoc.mockResolvedValue();
    hoisted.mockUpdateDoc.mockResolvedValue();
    await undoPostpone('t1', 'orig-1', 'new-99');
    expect(hoisted.mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(hoisted.mockUpdateDoc).toHaveBeenCalledTimes(1);
    const patch = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(patch.status).toBe('scheduled');
    expect(patch.rescheduledToId).toBeNull();
    expect(patch.updatedAt).toEqual({ _type: 'serverTimestamp' });
  });
});

describe('getAgentDay', () => {
  it('queries (agentId, date) equality and sorts by startTime', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      { id: 'b', startTime: '14:00' }, { id: 'a', startTime: '09:00' },
    ));
    const out = await getAgentDay('t1', 'agent-1', '2026-06-22');
    const w = whereCalls();
    expect(w).toContainEqual({ field: 'agentId', op: '==', value: 'agent-1' });
    expect(w).toContainEqual({ field: 'date', op: '==', value: '2026-06-22' });
    expect(out.map((d) => d.id)).toEqual(['a', 'b']);      // time-sorted
  });
});

describe('getAgentWeek', () => {
  it('queries (agentId, date-range) with orderBy date', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap({ id: 'a' }));
    await getAgentWeek('t1', 'agent-1', '2026-06-21', '2026-06-27');
    const w = whereCalls();
    expect(w).toContainEqual({ field: 'agentId', op: '==', value: 'agent-1' });
    expect(w).toContainEqual({ field: 'date', op: '>=', value: '2026-06-21' });
    expect(w).toContainEqual({ field: 'date', op: '<=', value: '2026-06-27' });
    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('date', 'asc');
  });
});

describe('getTeamWeek role-split (exact where clauses)', () => {
  const RANGE = { tenantId: 't1', weekStart: '2026-06-21', weekEnd: '2026-06-27' };

  it('UM scopes to agentUnitId == caller uid (never branch)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap({ id: 'a' }));
    await getTeamWeek({ ...RANGE, role: 'unit_manager', uid: 'um-9', branchId: 'branch-7' });
    const w = whereCalls();
    expect(w).toContainEqual({ field: 'agentUnitId', op: '==', value: 'um-9' });
    expect(w.some((c) => c.field === 'agentBranchId')).toBe(false);
  });

  it('BM scopes to agentBranchId == own branch', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap({ id: 'a' }));
    await getTeamWeek({ ...RANGE, role: 'branch_manager', uid: 'bm-2', branchId: 'branch-7' });
    const w = whereCalls();
    expect(w).toContainEqual({ field: 'agentBranchId', op: '==', value: 'branch-7' });
    expect(w.some((c) => c.field === 'agentUnitId')).toBe(false);
  });

  it('SM+/TA is unfiltered (date range only — no agent-scope where)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap({ id: 'a' }));
    await getTeamWeek({ ...RANGE, role: 'sales_manager', uid: 'sm-1', branchId: null });
    const w = whereCalls();
    expect(w.some((c) => c.field === 'agentUnitId')).toBe(false);
    expect(w.some((c) => c.field === 'agentBranchId')).toBe(false);
    expect(w).toContainEqual({ field: 'date', op: '>=', value: '2026-06-21' });
  });
});
