import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockSetDoc: vi.fn(),
  mockDoc: vi.fn(),
  mockServerTimestamp: vi.fn(() => '__ts__'),
}));

vi.mock('../../firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (...args) => hoisted.mockDoc(...args),
  setDoc: (...args) => hoisted.mockSetDoc(...args),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  serverTimestamp: () => hoisted.mockServerTimestamp(),
}));

// loggingModeService dependencies — hoisted so imports resolve cleanly
vi.mock('../dailyActivityService', () => ({
  getDailyEntriesForWeek: vi.fn().mockResolvedValue([]),
  saveDailyEntry: vi.fn(),
}));
vi.mock('../../lib/schema/dailyActivity.aggregator', () => ({
  aggregateDailyToWeekly: vi.fn().mockReturnValue({ totalProductionCredit: 0 }),
}));
vi.mock('../../utils/dateHelpers', () => ({
  getMostRecentSunday: vi.fn().mockReturnValue('2026-01-05'),
}));

import { saveDraft, submitReport } from '../submissionService';
import { aggregateCurrentWeekDaily } from '../loggingModeService';
import { getDailyEntriesForWeek } from '../dailyActivityService';

beforeEach(() => {
  hoisted.mockSetDoc.mockReset();
  hoisted.mockDoc.mockReset();
  hoisted.mockDoc.mockReturnValue('__ref__');
  hoisted.mockSetDoc.mockResolvedValue(undefined);
});

describe('submissionService.saveDraft — unitId in write payload', () => {
  it('includes unitId in the setDoc payload', async () => {
    await saveDraft('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001');

    expect(hoisted.mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: 'um-uid-001' });
  });

  it('accepts null unitId (agents without a unit)', async () => {
    await saveDraft('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, null);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null });
  });

  it('defaults unitId to null when omitted (backward-compat caller)', async () => {
    await saveDraft('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null });
  });

  it('preserves agentId, status, and weekStarting alongside unitId', async () => {
    await saveDraft('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001');

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({
      agentId: 'uid-a',
      unitId: 'um-uid-001',
      weekStarting: '2026-01-05',
      status: 'draft',
    });
  });
});

describe('submissionService.submitReport — unitId in write payload', () => {
  it('includes unitId in the setDoc payload', async () => {
    await submitReport('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001');

    expect(hoisted.mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: 'um-uid-001' });
  });

  it('accepts null unitId', async () => {
    await submitReport('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, null);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null });
  });

  it('defaults unitId to null when omitted', async () => {
    await submitReport('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null });
  });

  it('preserves agentId, status submitted, and weekStarting alongside unitId', async () => {
    await submitReport('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001');

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({
      agentId: 'uid-a',
      unitId: 'um-uid-001',
      weekStarting: '2026-01-05',
      status: 'submitted',
    });
  });
});

describe('loggingModeService.aggregateCurrentWeekDaily — unitId in write payload', () => {
  it('includes unitId in the setDoc payload when daily entries exist', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([
      { qualifiedApproaches: 1 },
    ]);
    // getDoc returns a non-submitted existing doc
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ status: 'draft' }) });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, 'um-uid-001');

    expect(hoisted.mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: 'um-uid-001' });
  });

  it('accepts null unitId', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([{ qualifiedApproaches: 1 }]);
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValueOnce({ exists: () => false });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, null);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null });
  });

  it('defaults unitId to null when omitted', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([{ qualifiedApproaches: 1 }]);
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValueOnce({ exists: () => false });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null });
  });

  it('no-op (no setDoc) when there are no daily entries', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([]);

    const result = await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, 'um-uid-001');

    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
    expect(result.aggregated).toBe(false);
  });
});
