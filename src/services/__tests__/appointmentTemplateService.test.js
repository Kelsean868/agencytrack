import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockAddDoc:     vi.fn(),
  mockDeleteDoc:  vi.fn(),
  mockGetDocs:    vi.fn(),
  mockQuery:      vi.fn((...args) => ({ _query: args })),
  mockWhere:      vi.fn((field, op, value) => ({ _where: { field, op, value } })),
  mockCollection: vi.fn((...args) => ({ _collection: args })),
  mockDoc:        vi.fn((...args) => ({ _doc: args })),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => ({
  collection:      (...a) => hoisted.mockCollection(...a),
  doc:             (...a) => hoisted.mockDoc(...a),
  addDoc:          (...a) => hoisted.mockAddDoc(...a),
  deleteDoc:       (...a) => hoisted.mockDeleteDoc(...a),
  getDocs:         (...a) => hoisted.mockGetDocs(...a),
  query:           (...a) => hoisted.mockQuery(...a),
  where:           (...a) => hoisted.mockWhere(...a),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  listTemplates, saveTemplate, deleteTemplate, TEMPLATE_CAP,
} from '../appointmentTemplateService';

function makeSnap(...docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}
const whereCalls = () => hoisted.mockWhere.mock.calls.map(([field, op, value]) => ({ field, op, value }));

beforeEach(() => { vi.clearAllMocks(); });

const META = { agentId: 'agent-1' };

describe('listTemplates', () => {
  it('queries agentId equality only (no orderBy → no composite) and sorts by name client-side', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      { id: 'b', name: 'Zulu block' }, { id: 'a', name: 'Alpha block' },
    ));
    const out = await listTemplates('t1', 'agent-1');
    const w = whereCalls();
    expect(w).toContainEqual({ field: 'agentId', op: '==', value: 'agent-1' });
    expect(out.map((d) => d.id)).toEqual(['a', 'b']); // name-sorted
  });
});

describe('saveTemplate', () => {
  it('pins tenantId/agentId, trims name, writes the contract shape', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap()); // 0 existing → under cap
    hoisted.mockAddDoc.mockResolvedValue({ id: 'tpl-new' });
    const id = await saveTemplate('t1', {
      name: '  Morning FFI  ', type: 'FFI', startTime: '09:30', durationMin: 60, note: '  x  ',
    }, META);
    expect(id).toBe('tpl-new');
    const payload = hoisted.mockAddDoc.mock.calls[0][1];
    expect(payload.tenantId).toBe('t1');
    expect(payload.agentId).toBe('agent-1');
    expect(payload.name).toBe('Morning FFI'); // trimmed
    expect(payload.type).toBe('FFI');
    expect(payload.durationMin).toBe(60);
    expect(payload.note).toBe('x');
    expect(payload.createdAt).toEqual({ _type: 'serverTimestamp' });
    expect(payload).not.toHaveProperty('date');       // no date on a template
    expect(payload).not.toHaveProperty('prospectId'); // no prospect on a template
  });

  it('only writes freeBlockLabel / apiAmount when meaningful', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    hoisted.mockAddDoc.mockResolvedValue({ id: 'n' });
    await saveTemplate('t1', {
      name: 'Sale', type: 'SALE', startTime: '10:00', durationMin: 30, apiAmount: '1200', freeBlockLabel: 'Training',
    }, META);
    const p = hoisted.mockAddDoc.mock.calls[0][1];
    expect(p.apiAmount).toBe(1200);
    expect(p.freeBlockLabel).toBe('Training');

    hoisted.mockAddDoc.mockClear();
    await saveTemplate('t1', { name: 'Call', type: 'PC', startTime: '11:00', durationMin: 15 }, META);
    const p2 = hoisted.mockAddDoc.mock.calls[0][1];
    expect(p2).not.toHaveProperty('apiAmount');
    expect(p2).not.toHaveProperty('freeBlockLabel');
  });

  it('rejects an empty name without writing', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await expect(saveTemplate('t1', { name: '   ', type: 'PC', startTime: '09:00', durationMin: 30 }, META))
      .rejects.toThrow(/name/i);
    expect(hoisted.mockAddDoc).not.toHaveBeenCalled();
  });

  it('refuses to save beyond the cap (friendly error, no write)', async () => {
    const full = Array.from({ length: TEMPLATE_CAP }, (_, i) => ({ id: `t${i}`, name: `n${i}` }));
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(...full));
    await expect(saveTemplate('t1', { name: 'One too many', type: 'PC', startTime: '09:00', durationMin: 30 }, META))
      .rejects.toThrow(new RegExp(`${TEMPLATE_CAP}`));
    expect(hoisted.mockAddDoc).not.toHaveBeenCalled();
  });
});

describe('deleteTemplate', () => {
  it('deletes the doc at the tenant/template path', async () => {
    hoisted.mockDeleteDoc.mockResolvedValue();
    await deleteTemplate('t1', 'tpl-1');
    expect(hoisted.mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});
