import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetDocs:    vi.fn(),
  mockQuery:      vi.fn((...args) => ({ _query: args })),
  mockWhere:      vi.fn((field, op, value) => ({ _where: { field, op, value } })),
  mockOrderBy:    vi.fn((field, dir) => ({ _orderBy: { field, dir } })),
  mockCollection: vi.fn((...args) => ({ _collection: args })),
  mockDoc:        vi.fn((...args) => ({ _doc: args })),
  mockAddDoc:     vi.fn(),
  mockUpdateDoc:  vi.fn(),
  mockDeleteDoc:  vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => ({
  collection:      (...a) => hoisted.mockCollection(...a),
  doc:             (...a) => hoisted.mockDoc(...a),
  addDoc:          (...a) => hoisted.mockAddDoc(...a),
  updateDoc:       (...a) => hoisted.mockUpdateDoc(...a),
  deleteDoc:       (...a) => hoisted.mockDeleteDoc(...a),
  getDocs:         (...a) => hoisted.mockGetDocs(...a),
  query:           (...a) => hoisted.mockQuery(...a),
  where:           (...a) => hoisted.mockWhere(...a),
  orderBy:         (...a) => hoisted.mockOrderBy(...a),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

vi.mock('../notificationService', () => ({ createNotification: vi.fn() }));

import { getCampaignSubmissions, campaignSubsScopeFor } from '../campaignService';

const makeSnap = (...docs) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) });
const whereCalls = () => hoisted.mockWhere.mock.calls.map(([field, op, value]) => ({ field, op, value }));

beforeEach(() => { vi.clearAllMocks(); });

// Regression: the campaign standings read must be rules-provable per caller
// role. An unscoped tenant-wide list is DENIED for agent/UM/BM by the
// submissions `list` rule (VH Run-2 Phase-C finding — standings rendered
// TTD 0 / "no data" for branch managers).
describe('getCampaignSubmissions scoping', () => {
  it('branch scope: adds branchId equality, drops server-side status, filters client-side', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      { id: 's1', status: 'submitted', totalProductionCredit: 100 },
      { id: 's2', status: 'draft', totalProductionCredit: 50 },
    ));
    const rows = await getCampaignSubmissions('t1', '2026-05-03', '2026-08-01', { branchId: 'branch-7' });
    const w = whereCalls();
    expect(w).toContainEqual({ field: 'branchId', op: '==', value: 'branch-7' });
    expect(w.find((c) => c.field === 'status')).toBeUndefined(); // rides branchId+weekStarting composite
    expect(rows.map((r) => r.id)).toEqual(['s1']); // draft filtered client-side
  });

  it('unit scope: unitId equality clause', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getCampaignSubmissions('t1', '2026-05-03', '2026-08-01', { unitId: 'um-9' });
    expect(whereCalls()).toContainEqual({ field: 'unitId', op: '==', value: 'um-9' });
  });

  it('agent scope: agentId equality clause + weekStarting desc orderBy (rides the existing agentId+weekStarting DESC composite)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getCampaignSubmissions('t1', '2026-05-03', '2026-08-01', { agentId: 'a-1' });
    expect(whereCalls()).toContainEqual({ field: 'agentId', op: '==', value: 'a-1' });
    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('weekStarting', 'desc');
  });

  it('unit/branch scopes do NOT add orderBy (their composites are ASC)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getCampaignSubmissions('t1', '2026-05-03', '2026-08-01', { branchId: 'b-1' });
    await getCampaignSubmissions('t1', '2026-05-03', '2026-08-01', { unitId: 'u-1' });
    expect(hoisted.mockOrderBy).not.toHaveBeenCalled();
  });

  it('unscoped (TA/SM/PA): keeps the server-side status==submitted clause', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap({ id: 's1', status: 'submitted' }));
    const rows = await getCampaignSubmissions('t1', '2026-05-03', '2026-08-01');
    expect(whereCalls()).toContainEqual({ field: 'status', op: '==', value: 'submitted' });
    expect(rows).toHaveLength(1);
  });

  it('always constrains the weekStarting window', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getCampaignSubmissions('t1', '2026-05-03', '2026-08-01', { branchId: 'b' });
    const w = whereCalls();
    expect(w).toContainEqual({ field: 'weekStarting', op: '>=', value: '2026-05-03' });
    expect(w).toContainEqual({ field: 'weekStarting', op: '<=', value: '2026-08-01' });
  });
});

describe('campaignSubsScopeFor', () => {
  it('mirrors the rules arms per role', () => {
    expect(campaignSubsScopeFor('branch_manager', 'bm-1', 'branch-7')).toEqual({ branchId: 'branch-7' });
    expect(campaignSubsScopeFor('unit_manager', 'um-9', 'branch-7')).toEqual({ unitId: 'um-9' });
    expect(campaignSubsScopeFor('agent', 'a-1', 'branch-7')).toEqual({ agentId: 'a-1' });
    expect(campaignSubsScopeFor('tenant_admin', 'ta-1', 'branch-7')).toEqual({});
    expect(campaignSubsScopeFor('sales_manager', 'sm-1', null)).toEqual({});
  });

  it('branch_manager without a branchId claim degrades to own-agentId scope', () => {
    expect(campaignSubsScopeFor('branch_manager', 'bm-1', undefined)).toEqual({ agentId: 'bm-1' });
  });
});
