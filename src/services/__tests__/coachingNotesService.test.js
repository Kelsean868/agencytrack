import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockAddDoc:    vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockGetDocs:   vi.fn(),
  mockQuery:     vi.fn(),
  mockWhere:     vi.fn(),
  mockOrderBy:   vi.fn(),
  mockDoc:       vi.fn(),
  mockCollection: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection:      (...args) => hoisted.mockCollection(...args),
  doc:             (...args) => hoisted.mockDoc(...args),
  addDoc:          (...args) => hoisted.mockAddDoc(...args),
  updateDoc:       (...args) => hoisted.mockUpdateDoc(...args),
  getDocs:         (...args) => hoisted.mockGetDocs(...args),
  query:           (...args) => hoisted.mockQuery(...args),
  where:           (...args) => hoisted.mockWhere(...args),
  orderBy:         (...args) => hoisted.mockOrderBy(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  getRoleRank,
  addCoachingNote,
  getCoachingNotes,
  updateCoachingNote,
  COACHING_CATEGORIES,
} from '../coachingNotesService';

function makeSnap(...docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('getRoleRank', () => {
  it('returns correct rank for each manager role', () => {
    expect(getRoleRank('unit_manager')).toBe(1);
    expect(getRoleRank('branch_manager')).toBe(2);
    expect(getRoleRank('sales_manager')).toBe(3);
    expect(getRoleRank('tenant_admin')).toBe(4);
    expect(getRoleRank('platform_admin')).toBe(5);
  });

  it('returns 0 for agent and unknown roles', () => {
    expect(getRoleRank('agent')).toBe(0);
    expect(getRoleRank('unknown')).toBe(0);
    expect(getRoleRank('')).toBe(0);
  });
});

describe('COACHING_CATEGORIES', () => {
  it('contains exactly the 5 PRD-specified values', () => {
    const values = COACHING_CATEGORIES.map((c) => c.value);
    expect(values).toEqual(['observation', 'goal', 'concern', 'win', 'action_item']);
  });
});

describe('addCoachingNote', () => {
  it('calls addDoc with all required fields and correct authorRoleRank', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});

    await addCoachingNote({
      tenantId:   'tid',
      agentId:    'agent1',
      agentUnitId: 'um1',
      authorUid:  'bm1',
      authorName: 'Branch Manager',
      authorRole: 'branch_manager',
      category:   'goal',
      body:       '  target 500k  ',
    });

    expect(hoisted.mockAddDoc).toHaveBeenCalledOnce();
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.authorRoleRank).toBe(2);           // branch_manager = rank 2
    expect(data.body).toBe('target 500k');          // trimmed
    expect(data.agentId).toBe('agent1');
    expect(data.agentUnitId).toBe('um1');
    expect(data.tenantId).toBe('tid');
    expect(data.category).toBe('goal');
    expect('createdAt' in data).toBe(true);
    expect('updatedAt' in data).toBe(true);
  });

  it('truncates body to 2000 characters', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    const longBody = 'x'.repeat(3000);
    await addCoachingNote({
      tenantId: 'tid', agentId: 'a1', agentUnitId: 'u1',
      authorUid: 'u1', authorName: 'UM', authorRole: 'unit_manager',
      category: 'observation', body: longBody,
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.body.length).toBe(2000);
  });
});

describe('getCoachingNotes — unit_manager', () => {
  it('queries with agentUnitId + authorRoleRank <= 1 filters', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      { id: 'n1', agentId: 'a1', body: 'note 1', authorRoleRank: 1 },
    ));

    await getCoachingNotes({
      tenantId: 'tid', agentId: 'a1', callerRole: 'unit_manager', callerUid: 'um1',
    });

    const whereCalls = hoisted.mockWhere.mock.calls;
    expect(whereCalls).toContainEqual(['agentUnitId', '==', 'um1']);
    expect(whereCalls).toContainEqual(['authorRoleRank', '<=', 1]);
  });
});

describe('getCoachingNotes — branch_manager', () => {
  it('queries with authorRoleRank <= 2 only (no scope filter)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());

    await getCoachingNotes({
      tenantId: 'tid', agentId: 'a1', callerRole: 'branch_manager', callerUid: 'bm1',
    });

    const whereCalls = hoisted.mockWhere.mock.calls;
    expect(whereCalls).toContainEqual(['authorRoleRank', '<=', 2]);
    // must NOT include agentUnitId filter for BM
    const hasUnitFilter = whereCalls.some(([field]) => field === 'agentUnitId');
    expect(hasUnitFilter).toBe(false);
  });
});

describe('getCoachingNotes — result mapping', () => {
  it('maps snapshot docs to plain objects with id', async () => {
    hoisted.mockGetDocs.mockResolvedValue(
      makeSnap({ id: 'n1', agentId: 'a1', body: 'hello', authorRoleRank: 1 }),
    );

    const result = await getCoachingNotes({
      tenantId: 'tid', agentId: 'a1', callerRole: 'sales_manager', callerUid: 'sm1',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
    expect(result[0].body).toBe('hello');
  });
});

describe('updateCoachingNote', () => {
  it('calls updateDoc with body (trimmed), category, updatedAt', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue({});

    await updateCoachingNote({
      tenantId: 'tid', agentId: 'a1', noteId: 'n1',
      body: '  revised note  ', category: 'win',
    });

    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    const [, data] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(data.body).toBe('revised note');
    expect(data.category).toBe('win');
    expect('updatedAt' in data).toBe(true);
  });
});
