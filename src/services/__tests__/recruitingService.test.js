import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockAddDoc:          vi.fn().mockResolvedValue({ id: 'new-candidate-1' }),
  mockUpdateDoc:       vi.fn().mockResolvedValue(undefined),
  mockDoc:             vi.fn((...args) => ({ __ref: args.join('/') })),
  mockCollection:      vi.fn((...args) => ({ __coll: args.join('/') })),
  mockGetDocs:         vi.fn().mockResolvedValue({ docs: [] }),
  mockQuery:           vi.fn((...args) => ({ __query: args })),
  mockWhere:           vi.fn((field, op, val) => ({ __where: [field, op, val] })),
  mockServerTimestamp: vi.fn(() => ({ __ts: 'server' })),
}));

vi.mock('firebase/firestore', () => ({
  addDoc:          (...args) => hoisted.mockAddDoc(...args),
  updateDoc:       (...args) => hoisted.mockUpdateDoc(...args),
  doc:             (...args) => hoisted.mockDoc(...args),
  collection:      (...args) => hoisted.mockCollection(...args),
  getDocs:         (...args) => hoisted.mockGetDocs(...args),
  query:           (...args) => hoisted.mockQuery(...args),
  where:           (...args) => hoisted.mockWhere(...args),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

import {
  RECRUITING_STAGES, STAGE_KEYS, STALLED_THRESHOLD_DAYS, stageIndex,
  isStalled, daysInStage, daysSince, toMillis,
  createCandidate, updateCandidate, moveCandidateStage, logTouch,
  reassignCandidate, archiveCandidate, getCandidatesForBoard,
} from '../recruitingService';

const TENANT = 'test-tenant';
const DAY = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.mockAddDoc.mockResolvedValue({ id: 'new-candidate-1' });
  hoisted.mockUpdateDoc.mockResolvedValue(undefined);
  hoisted.mockGetDocs.mockResolvedValue({ docs: [] });
});

// ── Constants + derivation ────────────────────────────────────────────────────

describe('stage constants', () => {
  it('has the 8 locked stages in order', () => {
    expect(STAGE_KEYS).toEqual([
      'sourced', 'contacted', 'seminar', 'interview', 'assessment', 'offer', 'licensing', 'licensed',
    ]);
    expect(RECRUITING_STAGES).toHaveLength(8);
    expect(stageIndex('licensed')).toBe(7);
    expect(stageIndex('nope')).toBe(-1);
  });

  it('exports the 14-day stalled threshold', () => {
    expect(STALLED_THRESHOLD_DAYS).toBe(14);
  });
});

describe('timestamp helpers', () => {
  it('toMillis reads Firestore Timestamp | Date | epoch-ms', () => {
    const now = Date.now();
    expect(toMillis(now)).toBe(now);
    expect(toMillis(new Date(now))).toBe(now);
    expect(toMillis({ toMillis: () => 42 })).toBe(42);
    expect(toMillis({ toDate: () => new Date(1000) })).toBe(1000);
    expect(toMillis({ seconds: 5 })).toBe(5000);
    expect(toMillis(null)).toBeNull();
  });

  it('daysSince floors and clamps at 0', () => {
    const now = 100 * DAY;
    expect(daysSince(now - 3 * DAY, now)).toBe(3);
    expect(daysSince(now + 5 * DAY, now)).toBe(0);
    expect(daysSince(null, now)).toBeNull();
  });
});

describe('isStalled derivation — boundary at 14 days', () => {
  const now = 100 * DAY;
  const at = (days) => ({ status: 'active', stage: 'contacted', stageChangedAt: now - days * DAY });

  it('is NOT stalled at exactly 14 days (strict >)', () => {
    expect(isStalled(at(14), now)).toBe(false);
    expect(daysInStage(at(14), now)).toBe(14);
  });
  it('IS stalled at 15 days', () => {
    expect(isStalled(at(15), now)).toBe(true);
  });
  it('never stalls a licensed candidate', () => {
    expect(isStalled({ status: 'active', stage: 'licensed', stageChangedAt: now - 90 * DAY }, now)).toBe(false);
  });
  it('never stalls an archived candidate', () => {
    expect(isStalled({ status: 'archived', stage: 'contacted', stageChangedAt: now - 90 * DAY }, now)).toBe(false);
  });
});

// ── Writes ────────────────────────────────────────────────────────────────────

describe('createCandidate', () => {
  it('pins ownerUid to the caller, defaults stage/status, trims strings', async () => {
    const id = await createCandidate(
      TENANT,
      { name: '  Jane Doe  ', source: ' Referral ', referrerName: ' Bob ', note: '  hi  ', stage: 'bogus' },
      { branchId: 'branch-a', ownerUid: 'um1', ownerName: ' Unit Mgr ' },
    );
    expect(id).toBe('new-candidate-1');
    const payload = hoisted.mockAddDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      tenantId: TENANT,
      branchId: 'branch-a',
      ownerUid: 'um1',
      ownerName: 'Unit Mgr',
      name: 'Jane Doe',
      source: 'Referral',
      referrerName: 'Bob',
      note: 'hi',
      stage: 'sourced',       // invalid input falls back to 'sourced'
      status: 'active',
    });
    expect(payload.stageChangedAt).toEqual({ __ts: 'server' });
    expect(payload.createdAt).toEqual({ __ts: 'server' });
    expect(payload.updatedAt).toEqual({ __ts: 'server' });
    expect('phone' in payload).toBe(false); // omitted when empty
  });

  it('includes phone only when provided', async () => {
    await createCandidate(TENANT, { name: 'X', phone: ' 555 ' }, { branchId: 'b', ownerUid: 'u', ownerName: 'n' });
    expect(hoisted.mockAddDoc.mock.calls[0][1].phone).toBe('555');
  });

  it('honours a valid explicit stage', async () => {
    await createCandidate(TENANT, { name: 'X', stage: 'interview' }, { branchId: 'b', ownerUid: 'u', ownerName: 'n' });
    expect(hoisted.mockAddDoc.mock.calls[0][1].stage).toBe('interview');
  });
});

describe('updateCandidate', () => {
  it('never writes ownerUid/tenantId/branchId even if passed', async () => {
    await updateCandidate(TENANT, 'c1', { name: '  New Name ', ownerUid: 'evil', tenantId: 'x', branchId: 'y', note: 'n' });
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.name).toBe('New Name');
    expect(payload.note).toBe('n');
    expect('ownerUid' in payload).toBe(false);
    expect('tenantId' in payload).toBe(false);
    expect('branchId' in payload).toBe(false);
    expect(payload.updatedAt).toEqual({ __ts: 'server' });
  });

  it('only writes a valid stage', async () => {
    await updateCandidate(TENANT, 'c1', { stage: 'offer' });
    expect(hoisted.mockUpdateDoc.mock.calls[0][1].stage).toBe('offer');
    hoisted.mockUpdateDoc.mockClear();
    await updateCandidate(TENANT, 'c1', { stage: 'bogus' });
    expect('stage' in hoisted.mockUpdateDoc.mock.calls[0][1]).toBe(false);
  });
});

describe('moveCandidateStage', () => {
  it('bumps stage + stageChangedAt + lastTouchAt + updatedAt (no licensedAt for non-hire)', async () => {
    await moveCandidateStage(TENANT, 'c1', 'seminar');
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.stage).toBe('seminar');
    expect(payload.stageChangedAt).toEqual({ __ts: 'server' });
    expect(payload.lastTouchAt).toEqual({ __ts: 'server' });
    expect(payload.updatedAt).toEqual({ __ts: 'server' });
    expect('licensedAt' in payload).toBe(false);
  });

  it('stamps licensedAt when moving to licensed', async () => {
    await moveCandidateStage(TENANT, 'c1', 'licensed');
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.stage).toBe('licensed');
    expect(payload.licensedAt).toEqual({ __ts: 'server' });
  });

  it('throws on an invalid stage (no write)', async () => {
    await expect(moveCandidateStage(TENANT, 'c1', 'nope')).rejects.toThrow(/invalid recruiting stage/i);
    expect(hoisted.mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('logTouch', () => {
  it('bumps lastTouchAt + updatedAt only', async () => {
    await logTouch(TENANT, 'c1');
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(['lastTouchAt', 'updatedAt']);
  });
});

describe('reassignCandidate', () => {
  it('writes ownerUid + trimmed ownerName + updatedAt', async () => {
    await reassignCandidate(TENANT, 'c1', { ownerUid: 'bm2', ownerName: '  Branch Mgr ' });
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.ownerUid).toBe('bm2');
    expect(payload.ownerName).toBe('Branch Mgr');
    expect(payload.updatedAt).toEqual({ __ts: 'server' });
  });
});

describe('archiveCandidate', () => {
  it('sets status archived + updatedAt (no hard delete)', async () => {
    await archiveCandidate(TENANT, 'c1');
    const payload = hoisted.mockUpdateDoc.mock.calls[0][1];
    expect(payload.status).toBe('archived');
    expect(payload.updatedAt).toEqual({ __ts: 'server' });
  });
});

// ── Role-split board query ────────────────────────────────────────────────────

describe('getCandidatesForBoard — role split', () => {
  it('UM lists own candidates: where(ownerUid == uid)', async () => {
    await getCandidatesForBoard({ tenantId: TENANT, role: 'unit_manager', branchId: 'branch-a', ownerUid: 'um1' });
    expect(hoisted.mockWhere).toHaveBeenCalledWith('ownerUid', '==', 'um1');
    expect(hoisted.mockWhere).toHaveBeenCalledTimes(1);
  });

  it('BM lists own branch: where(branchId == branch)', async () => {
    await getCandidatesForBoard({ tenantId: TENANT, role: 'branch_manager', branchId: 'branch-a', ownerUid: 'bm1' });
    expect(hoisted.mockWhere).toHaveBeenCalledWith('branchId', '==', 'branch-a');
    expect(hoisted.mockWhere).toHaveBeenCalledTimes(1);
  });

  it('SM+ / TA query the collection unfiltered (no where clause)', async () => {
    await getCandidatesForBoard({ tenantId: TENANT, role: 'sales_manager', branchId: 'branch-a', ownerUid: 'sm1' });
    expect(hoisted.mockWhere).not.toHaveBeenCalled();
    await getCandidatesForBoard({ tenantId: TENANT, role: 'tenant_admin', branchId: null, ownerUid: 'ta1' });
    expect(hoisted.mockWhere).not.toHaveBeenCalled();
  });

  it('maps docs to id + data', async () => {
    hoisted.mockGetDocs.mockResolvedValue({
      docs: [{ id: 'c1', data: () => ({ name: 'A', stage: 'sourced' }) }],
    });
    const rows = await getCandidatesForBoard({ tenantId: TENANT, role: 'unit_manager', branchId: 'b', ownerUid: 'u' });
    expect(rows).toEqual([{ id: 'c1', name: 'A', stage: 'sourced' }]);
  });
});
