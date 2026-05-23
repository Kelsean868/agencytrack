import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockAddDoc:          vi.fn(),
  mockUpdateDoc:       vi.fn(),
  mockGetDocs:         vi.fn(),
  mockGetDoc:          vi.fn(),
  mockQuery:           vi.fn(),
  mockWhere:           vi.fn(),
  mockOrderBy:         vi.fn(),
  mockDoc:             vi.fn(),
  mockCollection:      vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => ({
  collection:      (...args) => hoisted.mockCollection(...args),
  doc:             (...args) => hoisted.mockDoc(...args),
  addDoc:          (...args) => hoisted.mockAddDoc(...args),
  updateDoc:       (...args) => hoisted.mockUpdateDoc(...args),
  getDocs:         (...args) => hoisted.mockGetDocs(...args),
  getDoc:          (...args) => hoisted.mockGetDoc(...args),
  query:           (...args) => hoisted.mockQuery(...args),
  where:           (...args) => hoisted.mockWhere(...args),
  orderBy:         (...args) => hoisted.mockOrderBy(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  getRoleRank,
  addJointCall,
  getJointCalls,
  updateJointCall,
  MEETING_TYPES,
  NEEDS_COVERED,
} from '../jointCallsService';

function makeSnap(...docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: agent doc not found → resolveBmInfo short-circuits; no notification attempt.
  // Existing addJointCall tests stay green: mockAddDoc is called exactly once (joint-call save only).
  hoisted.mockGetDoc.mockResolvedValue({ exists: () => false });
});;

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

describe('MEETING_TYPES', () => {
  it('contains exactly the 3 roadmap-specified values', () => {
    const values = MEETING_TYPES.map((m) => m.value);
    expect(values).toEqual(['demonstration', 'observation', 'collaboration']);
  });
});

describe('NEEDS_COVERED (provisional taxonomy)', () => {
  it('contains the 9 provisional values', () => {
    const values = NEEDS_COVERED.map((n) => n.value);
    expect(values).toEqual([
      'income_protection', 'mortgage_or_debt', 'education_funding',
      'retirement_planning', 'final_expenses', 'wealth_accumulation',
      'critical_illness_or_health', 'business_protection', 'other',
    ]);
  });
});

describe('addJointCall', () => {
  it('calls addDoc with all required fields and correct authorRoleRank', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});

    await addJointCall({
      tenantId:   'tid',
      agentId:    'agent1',
      agentUnitId: 'um1',
      authorUid:  'bm1',
      authorName: 'Branch Manager',
      authorRole: 'branch_manager',
      appointmentDate: '2026-05-20',
      appointmentTime: '10:00',
      appointmentKept: true,
      nextMeetingDate: '',
      meetingType: 'observation',
      needCovered: 'income_protection',
      comments: '  agent did well  ',
      saleMade: true,
      coachingMinutes: '15',
      trainingIdentified: 'objection handling',
    });

    expect(hoisted.mockAddDoc).toHaveBeenCalledOnce();
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.authorRoleRank).toBe(2);
    expect(data.comments).toBe('agent did well');
    expect(data.coachingMinutes).toBe(15);
    expect(data.appointmentKept).toBe(true);
    expect(data.saleMade).toBe(true);
    expect(data.agentId).toBe('agent1');
    expect(data.agentUnitId).toBe('um1');
    expect(data.tenantId).toBe('tid');
    expect(data.meetingType).toBe('observation');
    expect(data.needCovered).toBe('income_protection');
    expect('createdAt' in data).toBe(true);
    expect('updatedAt' in data).toBe(true);
  });

  it('clears nextMeetingDate when appointment kept', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addJointCall({
      tenantId: 'tid', agentId: 'a1', agentUnitId: 'u1',
      authorUid: 'u1', authorName: 'UM', authorRole: 'unit_manager',
      appointmentDate: '2026-05-20', appointmentTime: '10:00',
      appointmentKept: true, nextMeetingDate: '2026-06-01',
      meetingType: 'observation', needCovered: 'other',
      comments: '', saleMade: false, coachingMinutes: 0, trainingIdentified: '',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.nextMeetingDate).toBe('');
  });

  it('preserves nextMeetingDate when appointment NOT kept', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addJointCall({
      tenantId: 'tid', agentId: 'a1', agentUnitId: 'u1',
      authorUid: 'u1', authorName: 'UM', authorRole: 'unit_manager',
      appointmentDate: '2026-05-20', appointmentTime: '10:00',
      appointmentKept: false, nextMeetingDate: '2026-06-01',
      meetingType: 'observation', needCovered: 'other',
      comments: '', saleMade: false, coachingMinutes: 0, trainingIdentified: '',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.nextMeetingDate).toBe('2026-06-01');
  });

  it('truncates comments to 2000 characters', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    const longComments = 'x'.repeat(3000);
    await addJointCall({
      tenantId: 'tid', agentId: 'a1', agentUnitId: 'u1',
      authorUid: 'u1', authorName: 'UM', authorRole: 'unit_manager',
      appointmentDate: '2026-05-20', appointmentTime: '10:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'other',
      comments: longComments, saleMade: false, coachingMinutes: 0, trainingIdentified: '',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.comments.length).toBe(2000);
  });

  it('coerces coachingMinutes via parseFloat', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addJointCall({
      tenantId: 'tid', agentId: 'a1', agentUnitId: 'u1',
      authorUid: 'u1', authorName: 'UM', authorRole: 'unit_manager',
      appointmentDate: '2026-05-20', appointmentTime: '10:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'other',
      comments: '', saleMade: false, coachingMinutes: '22.5', trainingIdentified: '',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.coachingMinutes).toBe(22.5);
  });

  it('stores prospectInfoId when provided', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addJointCall({
      tenantId: 'tid', agentId: 'a1', agentUnitId: 'u1',
      authorUid: 'u1', authorName: 'UM', authorRole: 'unit_manager',
      appointmentDate: '2026-05-20', appointmentTime: '10:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'other',
      comments: '', saleMade: false, coachingMinutes: 0, trainingIdentified: '',
      prospectInfoId: 'prep_abc123',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.prospectInfoId).toBe('prep_abc123');
  });

  it('stores empty string for prospectInfoId when omitted', async () => {
    hoisted.mockAddDoc.mockResolvedValue({});
    await addJointCall({
      tenantId: 'tid', agentId: 'a1', agentUnitId: 'u1',
      authorUid: 'u1', authorName: 'UM', authorRole: 'unit_manager',
      appointmentDate: '2026-05-20', appointmentTime: '10:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'other',
      comments: '', saleMade: false, coachingMinutes: 0, trainingIdentified: '',
    });
    const [, data] = hoisted.mockAddDoc.mock.calls[0];
    expect(data.prospectInfoId).toBe('');
  });
});

describe('getJointCalls — unit_manager', () => {
  it('queries with agentUnitId + authorRoleRank <= 1 filters', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap(
      { id: 'c1', agentId: 'a1', authorRoleRank: 1 },
    ));

    await getJointCalls({
      tenantId: 'tid', agentId: 'a1', callerRole: 'unit_manager', callerUid: 'um1',
    });

    const whereCalls = hoisted.mockWhere.mock.calls;
    expect(whereCalls).toContainEqual(['agentUnitId', '==', 'um1']);
    expect(whereCalls).toContainEqual(['authorRoleRank', '<=', 1]);
  });

  it('orderBy authorRoleRank ASC comes BEFORE createdAt DESC (FAILED_PRECONDITION guard)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getJointCalls({
      tenantId: 'tid', agentId: 'a1', callerRole: 'unit_manager', callerUid: 'um1',
    });
    const orderByCalls = hoisted.mockOrderBy.mock.calls;
    expect(orderByCalls[0]).toEqual(['authorRoleRank', 'asc']);
    expect(orderByCalls[1]).toEqual(['createdAt', 'desc']);
  });
});

describe('getJointCalls — branch_manager', () => {
  it('queries with authorRoleRank <= 2 only (no scope filter)', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());

    await getJointCalls({
      tenantId: 'tid', agentId: 'a1', callerRole: 'branch_manager', callerUid: 'bm1',
    });

    const whereCalls = hoisted.mockWhere.mock.calls;
    expect(whereCalls).toContainEqual(['authorRoleRank', '<=', 2]);
    const hasUnitFilter = whereCalls.some(([field]) => field === 'agentUnitId');
    expect(hasUnitFilter).toBe(false);
  });

  it('orderBy authorRoleRank ASC then createdAt DESC', async () => {
    hoisted.mockGetDocs.mockResolvedValue(makeSnap());
    await getJointCalls({
      tenantId: 'tid', agentId: 'a1', callerRole: 'branch_manager', callerUid: 'bm1',
    });
    const orderByCalls = hoisted.mockOrderBy.mock.calls;
    expect(orderByCalls[0]).toEqual(['authorRoleRank', 'asc']);
    expect(orderByCalls[1]).toEqual(['createdAt', 'desc']);
  });
});

describe('getJointCalls — result mapping', () => {
  it('maps snapshot docs to plain objects with id', async () => {
    hoisted.mockGetDocs.mockResolvedValue(
      makeSnap({ id: 'c1', agentId: 'a1', comments: 'hi', authorRoleRank: 1 }),
    );

    const result = await getJointCalls({
      tenantId: 'tid', agentId: 'a1', callerRole: 'sales_manager', callerUid: 'sm1',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
    expect(result[0].comments).toBe('hi');
  });
});

describe('updateJointCall', () => {
  it('calls updateDoc with editable fields (comments trimmed) and updatedAt', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue({});

    await updateJointCall({
      tenantId: 'tid', agentId: 'a1', callId: 'c1',
      appointmentDate: '2026-05-21', appointmentTime: '11:00',
      appointmentKept: false, nextMeetingDate: '2026-06-01',
      meetingType: 'collaboration', needCovered: 'final_expenses',
      comments: '  revised  ', saleMade: true,
      coachingMinutes: '30', trainingIdentified: 'follow-up',
    });

    expect(hoisted.mockUpdateDoc).toHaveBeenCalledOnce();
    const [, data] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(data.comments).toBe('revised');
    expect(data.meetingType).toBe('collaboration');
    expect(data.needCovered).toBe('final_expenses');
    expect(data.appointmentKept).toBe(false);
    expect(data.nextMeetingDate).toBe('2026-06-01');
    expect(data.coachingMinutes).toBe(30);
    expect('updatedAt' in data).toBe(true);
  });

  it('includes prospectInfoId in the update payload', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue({});
    await updateJointCall({
      tenantId: 'tid', agentId: 'a1', callId: 'c1',
      appointmentDate: '2026-05-21', appointmentTime: '11:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'other',
      comments: '', saleMade: false, coachingMinutes: 0, trainingIdentified: '',
      prospectInfoId: 'prep_xyz',
    });
    const [, data] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(data.prospectInfoId).toBe('prep_xyz');
  });

  it('writes empty string for prospectInfoId when cleared', async () => {
    hoisted.mockUpdateDoc.mockResolvedValue({});
    await updateJointCall({
      tenantId: 'tid', agentId: 'a1', callId: 'c1',
      appointmentDate: '2026-05-21', appointmentTime: '11:00',
      appointmentKept: true, nextMeetingDate: '',
      meetingType: 'observation', needCovered: 'other',
      comments: '', saleMade: false, coachingMinutes: 0, trainingIdentified: '',
      prospectInfoId: '',
    });
    const [, data] = hoisted.mockUpdateDoc.mock.calls[0];
    expect(data.prospectInfoId).toBe('');
  });
});

describe('addJointCall — BM notification (best-effort)', () => {
  const BASE = {
    tenantId: 'tid', agentId: 'agent1', agentUnitId: 'um1',
    authorUid: 'author-uid', authorName: 'UM Test', authorRole: 'unit_manager',
    appointmentDate: '2026-05-21', appointmentTime: '10:00',
    appointmentKept: true, nextMeetingDate: '',
    meetingType: 'observation', needCovered: 'other',
    comments: '', saleMade: false, coachingMinutes: 0, trainingIdentified: '',
  };

  it('(a) writes notification with correct shape when BM resolved', async () => {
    hoisted.mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ branchId: 'branch1', name: 'Test Agent' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ managerId: 'bm-uid' }) });
    hoisted.mockAddDoc.mockResolvedValue({});

    await addJointCall(BASE);

    expect(hoisted.mockAddDoc).toHaveBeenCalledTimes(2);
    const [, notifData] = hoisted.mockAddDoc.mock.calls[1];
    expect(notifData.userId).toBe('bm-uid');
    expect(notifData.type).toBe('manager_alert');
    expect(notifData.title).toBe('Joint call logged for Test Agent');
    expect(notifData.body).toBe('UM Test logged a joint-call observation for Test Agent.');
    expect(notifData.link).toBeNull();
    expect(notifData.read).toBe(false);
    expect(notifData.tenantId).toBe('tid');
    expect('createdAt' in notifData).toBe(true);
  });

  it('(b) skips notification when author is the BM (self-notification guard)', async () => {
    hoisted.mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ branchId: 'branch1', name: 'Test Agent' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ managerId: 'author-uid' }) });
    hoisted.mockAddDoc.mockResolvedValue({});

    await addJointCall(BASE); // authorUid === bmUid → skip

    expect(hoisted.mockAddDoc).toHaveBeenCalledTimes(1); // joint-call save only
  });

  it('(c) skips notification when no BM (agent has no branchId)', async () => {
    hoisted.mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Test Agent' }) }); // no branchId
    hoisted.mockAddDoc.mockResolvedValue({});

    await addJointCall(BASE);

    expect(hoisted.mockAddDoc).toHaveBeenCalledTimes(1); // joint-call save only
  });

  it('(d) notification failure is swallowed — joint-call save still resolves', async () => {
    hoisted.mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ branchId: 'branch1', name: 'Test Agent' }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ managerId: 'bm-uid' }) });
    hoisted.mockAddDoc
      .mockResolvedValueOnce({})                              // joint-call save succeeds
      .mockRejectedValueOnce(new Error('Notification write failed')); // notification fails

    await expect(addJointCall(BASE)).resolves.not.toThrow();
    expect(hoisted.mockAddDoc).toHaveBeenCalledTimes(2);
  });
});
