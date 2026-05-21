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
  addProspectInfo,
  updateProspectInfo,
  getProspectInfo,
  PROSPECTING_SOURCES,
  APPOINTMENT_TYPES,
  OBJECTIONS,
} from '../prospectInfoService';

function makeSnap(...docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PROSPECTING_SOURCES (provisional taxonomy)', () => {
  it('contains the 11 workshop-specified values', () => {
    const values = PROSPECTING_SOURCES.map((s) => s.value);
    expect(values).toEqual([
      'seminar', 'booth-event', 'referral', 'cold-call', 'social-media',
      'orphan', 'existing-client', 'family-friend', 'BOA', 'self', 'other',
    ]);
  });
});

describe('APPOINTMENT_TYPES', () => {
  it('contains exactly 2nd-interview and closing-interview', () => {
    const values = APPOINTMENT_TYPES.map((a) => a.value);
    expect(values).toEqual(['2nd-interview', 'closing-interview']);
  });
});

describe('OBJECTIONS', () => {
  it('contains the 4 brief-specified values', () => {
    const values = OBJECTIONS.map((o) => o.value);
    expect(values).toEqual(['no-money', 'no-need', 'no-hurry', 'no-confidence']);
  });
});

describe('addProspectInfo', () => {
  it('writes denormalized fields and applies parseFloat to clientAge', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});

    await addProspectInfo({
      tenantId: 'tid',
      agentId: 'agentA',
      agentUnitId: 'um1',
      clientName: '  Jane Smith  ',
      clientAge: '42.7',
      clientOccupation: 'Engineer',
      prospectingSource: 'referral',
      appointmentType: '2nd-interview',
      objections: ['no-money', 'no-hurry'],
      policyType: '  Whole Life  ',
      intendedAppointmentDate: '2026-06-01',
    });

    expect(hoisted.mockAddDoc).toHaveBeenCalledOnce();
    const [, data] = hoisted.mockAddDoc.mock.calls[0];

    expect(data.agentId).toBe('agentA');
    expect(data.agentUnitId).toBe('um1');
    expect(data.tenantId).toBe('tid');
    expect(data.createdBy).toBe('agentA');
    expect(data.clientName).toBe('Jane Smith');
    expect(data.clientAge).toBe(42.7);
    expect(data.clientOccupation).toBe('Engineer');
    expect(data.prospectingSource).toBe('referral');
    expect(data.appointmentType).toBe('2nd-interview');
    expect(data.objections).toEqual(['no-money', 'no-hurry']);
    expect(data.policyType).toBe('Whole Life');
    expect(data.intendedAppointmentDate).toBe('2026-06-01');
    expect('createdAt' in data).toBe(true);
    expect('updatedAt' in data).toBe(true);
  });

  it('strips non-enum objections (defense-in-depth client guard)', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addProspectInfo({
      tenantId: 'tid', agentId: 'a', agentUnitId: 'u',
      clientName: 'X', clientAge: '', clientOccupation: '',
      prospectingSource: 'referral', appointmentType: '2nd-interview',
      objections: ['no-money', 'bogus-value', 'no-need'],
      policyType: '', intendedAppointmentDate: '2026-06-01',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.objections).toEqual(['no-money', 'no-need']);
  });

  it('coerces missing/empty clientAge to 0', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addProspectInfo({
      tenantId: 'tid', agentId: 'a', agentUnitId: 'u',
      clientName: 'X', clientAge: '', clientOccupation: '',
      prospectingSource: 'referral', appointmentType: '2nd-interview',
      objections: [], policyType: '',
      intendedAppointmentDate: '2026-06-01',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.clientAge).toBe(0);
  });

  it('truncates clientName to 120 characters', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    const longName = 'x'.repeat(300);
    await addProspectInfo({
      tenantId: 'tid', agentId: 'a', agentUnitId: 'u',
      clientName: longName, clientAge: '', clientOccupation: '',
      prospectingSource: 'referral', appointmentType: '2nd-interview',
      objections: [], policyType: '',
      intendedAppointmentDate: '2026-06-01',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.clientName.length).toBe(120);
  });

  it('handles undefined agentUnitId by writing empty string (rule allows empty)', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addProspectInfo({
      tenantId: 'tid', agentId: 'a', agentUnitId: undefined,
      clientName: 'X', clientAge: '', clientOccupation: '',
      prospectingSource: 'referral', appointmentType: '2nd-interview',
      objections: [], policyType: '',
      intendedAppointmentDate: '2026-06-01',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.agentUnitId).toBe('');
  });
});

describe('updateProspectInfo', () => {
  it('calls updateDoc with editable fields and updatedAt', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue({});

    await updateProspectInfo({
      tenantId: 'tid',
      agentId: 'agentA',
      prospectId: 'p1',
      clientName: 'Updated Name',
      clientAge: '50',
      clientOccupation: 'Doctor',
      prospectingSource: 'cold-call',
      appointmentType: 'closing-interview',
      objections: ['no-confidence'],
      policyType: 'Term',
      intendedAppointmentDate: '2026-07-15',
    });

    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    const [, data] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(data.clientName).toBe('Updated Name');
    expect(data.clientAge).toBe(50);
    expect(data.appointmentType).toBe('closing-interview');
    expect(data.objections).toEqual(['no-confidence']);
    expect('updatedAt' in data).toBe(true);
    // Should NOT include immutable fields
    expect('agentId' in data).toBe(false);
    expect('tenantId' in data).toBe(false);
    expect('createdBy' in data).toBe(false);
    expect('createdAt' in data).toBe(false);
  });
});

describe('getProspectInfo — agent', () => {
  it('agent role queries by intendedAppointmentDate desc only (no scope filter)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getProspectInfo({
      tenantId: 'tid', agentId: 'agentA', callerRole: 'agent', callerUid: 'agentA',
    });
    const whereCalls = hoisted.mockWhere.mock.calls;
    expect(whereCalls.length).toBe(0); // no where clauses for agent

    const orderByCalls = hoisted.mockOrderBy.mock.calls;
    expect(orderByCalls[0]).toEqual(['intendedAppointmentDate', 'desc']);
  });
});

describe('getProspectInfo — unit_manager', () => {
  it('UM queries with agentUnitId filter (rule requires it)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getProspectInfo({
      tenantId: 'tid', agentId: 'agentA', callerRole: 'unit_manager', callerUid: 'um1',
    });
    const whereCalls = hoisted.mockWhere.mock.calls;
    expect(whereCalls).toContainEqual(['agentUnitId', '==', 'um1']);

    const orderByCalls = hoisted.mockOrderBy.mock.calls;
    expect(orderByCalls[0]).toEqual(['intendedAppointmentDate', 'desc']);
  });
});

describe('getProspectInfo — branch_manager (and above)', () => {
  it('BM queries with no scope filter (tenant-scoped via path)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getProspectInfo({
      tenantId: 'tid', agentId: 'agentA', callerRole: 'branch_manager', callerUid: 'bm1',
    });
    const whereCalls = hoisted.mockWhere.mock.calls;
    const hasUnitFilter = whereCalls.some(([field]) => field === 'agentUnitId');
    expect(hasUnitFilter).toBe(false);

    const orderByCalls = hoisted.mockOrderBy.mock.calls;
    expect(orderByCalls[0]).toEqual(['intendedAppointmentDate', 'desc']);
  });
});

describe('getProspectInfo — result mapping', () => {
  it('maps snapshot docs to plain objects with id', async () => {
    hoisted.mockGetDocs.mockResolvedValue(
      makeSnap({ id: 'p1', clientName: 'Jane', appointmentType: '2nd-interview' }),
    );
    const result = await getProspectInfo({
      tenantId: 'tid', agentId: 'agentA', callerRole: 'agent', callerUid: 'agentA',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].clientName).toBe('Jane');
  });
});
