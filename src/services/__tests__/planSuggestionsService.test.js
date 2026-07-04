import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockAddDoc:    vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockGetDocs:   vi.fn(),
  mockQuery:     vi.fn((ref) => ({ _ref: ref })),
  mockOrderBy:   vi.fn((...a) => ({ _orderBy: a })),
  mockDoc:       vi.fn((...a) => ({ _doc: a })),
  mockCollection: vi.fn((...a) => ({ _collection: a })),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => ({
  collection:      (...args) => hoisted.mockCollection(...args),
  doc:             (...args) => hoisted.mockDoc(...args),
  addDoc:          (...args) => hoisted.mockAddDoc(...args),
  updateDoc:       (...args) => hoisted.mockUpdateDoc(...args),
  getDocs:         (...args) => hoisted.mockGetDocs(...args),
  query:           (...args) => hoisted.mockQuery(...args),
  orderBy:         (...args) => hoisted.mockOrderBy(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  createPlanSuggestion,
  listPlanSuggestions,
  markSuggestionSeen,
} from '../planSuggestionsService';

function makeSnap(...docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('createPlanSuggestion', () => {
  const base = {
    tenantId: 'tid',
    agentId: 'agent-a',
    year: 2026,
    note: '  lift Life to 65%  ',
    raisedByUid: 'um-1',
    raisedByName: 'Unit Manager',
    raisedByRole: 'unit_manager',
  };

  it('writes exactly the locked ten fields, note trimmed, status open, seenAt null', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await createPlanSuggestion(base);

    expect(hoisted.mockAddDoc).toHaveBeenCalledOnce();
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(Object.keys(data).sort()).toEqual([
      'agentId', 'createdAt', 'note', 'raisedByName', 'raisedByRole',
      'raisedByUid', 'seenAt', 'status', 'tenantId', 'year',
    ]);
    expect(data.tenantId).toBe('tid');
    expect(data.agentId).toBe('agent-a');
    expect(data.year).toBe(2026);
    expect(data.note).toBe('lift Life to 65%'); // trimmed
    expect(data.raisedByUid).toBe('um-1');
    expect(data.raisedByName).toBe('Unit Manager');
    expect(data.raisedByRole).toBe('unit_manager');
    expect(data.status).toBe('open');
    expect(data.seenAt).toBeNull();
    expect('createdAt' in data).toBe(true);
  });

  it('coerces year to an integer (rules require year is int)', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await createPlanSuggestion({ ...base, year: '2027' });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.year).toBe(2027);
    expect(Number.isInteger(data.year)).toBe(true);
  });

  it('caps the note at 2000 characters', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await createPlanSuggestion({ ...base, note: 'x'.repeat(3000) });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.note.length).toBe(2000);
  });

  it('throws (no write) when year is not a valid integer — would fail rules `year is int`', async () => {
    await expect(createPlanSuggestion({ ...base, year: 'not-a-year' }))
      .rejects.toThrow(/valid integer/i);
    expect(hoisted.mockAddDoc).not.toHaveBeenCalled();
  });
});

describe('listPlanSuggestions', () => {
  it('orders newest-first (createdAt desc) and maps docs with id', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      { id: 's1', note: 'first', status: 'open' },
      { id: 's2', note: 'second', status: 'seen' },
    ));

    const res = await listPlanSuggestions({ tenantId: 'tid', agentId: 'agent-a' });

    expect(hoisted.mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(res.items).toHaveLength(2);
    expect(res.items[0]).toMatchObject({ id: 's1', note: 'first' });
  });

  it('maps a permission-denied read to a neutral { unavailable, items: [] }', async () => {
    hoisted.mockGetDocs.mockRejectedValue({ code: 'permission-denied' });
    const res = await listPlanSuggestions({ tenantId: 'tid', agentId: 'agent-a' });
    expect(res).toEqual({ unavailable: true, items: [] });
  });

  it('rethrows non-permission failures', async () => {
    hoisted.mockGetDocs.mockRejectedValue({ code: 'unavailable' });
    await expect(listPlanSuggestions({ tenantId: 'tid', agentId: 'agent-a' }))
      .rejects.toMatchObject({ code: 'unavailable' });
  });

  it('returns empty (no query) when tenantId/agentId missing', async () => {
    const res = await listPlanSuggestions({ tenantId: '', agentId: 'agent-a' });
    expect(res).toEqual({ items: [] });
    expect(hoisted.mockGetDocs).not.toHaveBeenCalled();
  });
});

describe('markSuggestionSeen', () => {
  it('updates status→seen with a server timestamp seenAt', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue({});
    const ok = await markSuggestionSeen({ tenantId: 'tid', agentId: 'agent-a', suggestionId: 's1' });
    expect(ok).toBe(true);
    const [, data] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(data.status).toBe('seen');
    expect('seenAt' in data).toBe(true);
    expect(Object.keys(data).sort()).toEqual(['seenAt', 'status']);
  });

  it('swallows permission-denied (best-effort ack) and returns false', async () => {
    hoisted.mockUpdateDoc.mockRejectedValue({ code: 'permission-denied' });
    const ok = await markSuggestionSeen({ tenantId: 'tid', agentId: 'agent-a', suggestionId: 's1' });
    expect(ok).toBe(false);
  });

  it('rethrows non-permission failures', async () => {
    hoisted.mockUpdateDoc.mockRejectedValue({ code: 'unavailable' });
    await expect(markSuggestionSeen({ tenantId: 'tid', agentId: 'agent-a', suggestionId: 's1' }))
      .rejects.toMatchObject({ code: 'unavailable' });
  });
});
