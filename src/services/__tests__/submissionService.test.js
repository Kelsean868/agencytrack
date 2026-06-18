import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockSetDoc: vi.fn(),
  mockDoc: vi.fn(),
  mockServerTimestamp: vi.fn(() => '__ts__'),
}));

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

import { saveDraft, submitReport, sanitize } from '../submissionService';
import { aggregateCurrentWeekDaily } from '../loggingModeService';
import { getDailyEntriesForWeek } from '../dailyActivityService';

beforeEach(() => {
  hoisted.mockSetDoc.mockReset();
  hoisted.mockDoc.mockReset();
  hoisted.mockDoc.mockReturnValue('__ref__');
  hoisted.mockSetDoc.mockResolvedValue(undefined);
});

describe('submissionService.saveDraft — branchId in write payload', () => {
  it('stamps branchId when provided', async () => {
    await saveDraft('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001', 'branch-a');

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ branchId: 'branch-a' });
  });

  it('defaults branchId to null when omitted (backward-compat caller)', async () => {
    await saveDraft('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001');

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ branchId: null });
  });
});

describe('submissionService.submitReport — branchId in write payload', () => {
  it('stamps branchId when provided', async () => {
    await submitReport('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001', 'branch-a');

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ branchId: 'branch-a' });
  });

  it('defaults branchId to null when omitted (backward-compat caller)', async () => {
    await submitReport('t1', 'uid-a', 'Agent A', '2026-01-05', {}, 0, 'um-uid-001');

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ branchId: null });
  });
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

describe('submissionService.sanitize — social & content fields (FU HIGH fix)', () => {
  // Regression fixture: every social-field key must survive sanitize() with the
  // correct numeric type. The original bug silently dropped all 5 fields from
  // every weekly submit (HIGH severity — banked from PR #416 path-A smoke).

  it('retains all 4 flat social fields with int coercion', () => {
    const out = sanitize({
      socialPostsTotal:      '11',
      socialEngagementTotal: '22.7',
      socialInboxEnquiries:  '33',
      namesFromSocial:       '44',
    });
    expect(out.socialPostsTotal).toBe(11);
    expect(out.socialEngagementTotal).toBe(22);   // parseInt drops the fraction
    expect(out.socialInboxEnquiries).toBe(33);
    expect(out.namesFromSocial).toBe(44);
    // Types must be number, not string — domain rule (CLAUDE.md): never store
    // numeric values as strings in Firestore.
    expect(typeof out.socialPostsTotal).toBe('number');
    expect(typeof out.socialEngagementTotal).toBe('number');
    expect(typeof out.socialInboxEnquiries).toBe('number');
    expect(typeof out.namesFromSocial).toBe('number');
  });

  it('retains socialPlatformBreakdown with all 4 platform keys int-coerced', () => {
    const out = sanitize({
      socialPlatformBreakdown: {
        facebook:  '5',
        instagram: '6',
        whatsapp:  '7',
        linkedin:  '8',
      },
    });
    expect(out.socialPlatformBreakdown).toEqual({
      facebook:  5,
      instagram: 6,
      whatsapp:  7,
      linkedin:  8,
    });
    Object.values(out.socialPlatformBreakdown).forEach((v) => {
      expect(typeof v).toBe('number');
    });
  });

  it('defaults missing social fields to 0 (numeric, not undefined/null)', () => {
    const out = sanitize({});
    expect(out.socialPostsTotal).toBe(0);
    expect(out.socialEngagementTotal).toBe(0);
    expect(out.socialInboxEnquiries).toBe(0);
    expect(out.namesFromSocial).toBe(0);
    expect(out.socialPlatformBreakdown).toEqual({
      facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0,
    });
  });

  it('defaults missing socialPlatformBreakdown to all-zero shape (not undefined)', () => {
    const out = sanitize({ socialPostsTotal: 5 });
    // The nested object must exist with all 4 keys even when input omits it
    // entirely — never undefined, never partial. Defends against downstream
    // ?? defaults / chart code that would NaN on undefined.
    expect(out.socialPlatformBreakdown).toBeDefined();
    expect(Object.keys(out.socialPlatformBreakdown).sort())
      .toEqual(['facebook', 'instagram', 'linkedin', 'whatsapp']);
  });

  it('does not regress existing fields — Step1 + Step4 sample survives intact', () => {
    const out = sanitize({
      prospectingLettersSent: '7',
      f2fAttempts: '3',
      newBusiness:  { apps: '2', api: '4500.50' },
      pppIncreases: { apps: '1', apiIncrease: '120' },
      lumpsums:     { grossAmount: '600' },
      // Social fields included to prove the additions sit alongside, not replace
      socialPostsTotal: '11',
    }, 0);
    expect(out.prospectingLettersSent).toBe(7);
    expect(out.f2fAttempts).toBe(3);
    expect(out.newBusiness).toEqual({ apps: 2, api: 4500.5 });
    expect(out.pppIncreases).toEqual({ apps: 1, apiIncrease: 120 });
    expect(out.lumpsums.grossAmount).toBe(600);
    expect(out.socialPostsTotal).toBe(11);
    expect(out.version).toBe(2);
  });

  it('saveDraft payload now includes the 5 social fields end-to-end', async () => {
    await saveDraft('t1', 'uid-a', 'Agent A', '2026-01-05', {
      socialPostsTotal:      9,
      socialEngagementTotal: 99,
      socialInboxEnquiries:  3,
      namesFromSocial:       4,
      socialPlatformBreakdown: { facebook: 5, instagram: 4, whatsapp: 0, linkedin: 0 },
    }, 0, null);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({
      socialPostsTotal:      9,
      socialEngagementTotal: 99,
      socialInboxEnquiries:  3,
      namesFromSocial:       4,
      socialPlatformBreakdown: { facebook: 5, instagram: 4, whatsapp: 0, linkedin: 0 },
    });
  });

  it('submitReport payload now includes the 5 social fields end-to-end', async () => {
    await submitReport('t1', 'uid-a', 'Agent A', '2026-01-05', {
      socialPostsTotal:      1,
      socialEngagementTotal: 2,
      socialInboxEnquiries:  3,
      namesFromSocial:       4,
      socialPlatformBreakdown: { facebook: 1, instagram: 2, whatsapp: 3, linkedin: 4 },
    }, 0, null);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({
      status: 'submitted',
      socialPostsTotal:      1,
      socialEngagementTotal: 2,
      socialInboxEnquiries:  3,
      namesFromSocial:       4,
      socialPlatformBreakdown: { facebook: 1, instagram: 2, whatsapp: 3, linkedin: 4 },
    });
  });
});

describe('loggingModeService.aggregateCurrentWeekDaily — unitId + branchId in write payload', () => {
  it('includes unitId and branchId in the setDoc payload when daily entries exist', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([
      { qualifiedApproaches: 1 },
    ]);
    // getDoc returns a non-submitted existing doc
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ status: 'draft' }) });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, 'um-uid-001', 'branch-a');

    expect(hoisted.mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: 'um-uid-001', branchId: 'branch-a' });
  });

  it('writes with { merge: true } and no ratings/targets keys — manual draft fields survive a recompute', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([{ qualifiedApproaches: 2 }]);
    const { getDoc } = await import('firebase/firestore');
    // Existing draft already carries manual ratings + next-week targets.
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'draft', selfRating: 4, nextWeekTargets: { api: 50000 } }),
    });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, null, null);

    expect(hoisted.mockSetDoc).toHaveBeenCalledTimes(1);
    const [, payload, options] = hoisted.mockSetDoc.mock.calls[0];
    // merge:true is what preserves un-written fields in Firestore.
    expect(options).toEqual({ merge: true });
    // The recompute payload must NOT carry ratings/targets keys — if it did,
    // merge:true would overwrite (clobber) the agent's manual entries.
    expect(payload).not.toHaveProperty('selfRating');
    expect(payload).not.toHaveProperty('nextWeekTargets');
    // It only restamps activity rollup + status/identity bookkeeping.
    expect(payload).toMatchObject({ status: 'draft', totalProductionCredit: 0 });
  });

  it('accepts null unitId', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([{ qualifiedApproaches: 1 }]);
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValueOnce({ exists: () => false });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, null, 'branch-a');

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null, branchId: 'branch-a' });
  });

  it('defaults unitId and branchId to null when omitted', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([{ qualifiedApproaches: 1 }]);
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValueOnce({ exists: () => false });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload).toMatchObject({ unitId: null, branchId: null });
  });

  it('no-op (no setDoc) when there are no daily entries', async () => {
    getDailyEntriesForWeek.mockResolvedValueOnce([]);

    const result = await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, 'um-uid-001', 'branch-a');

    expect(hoisted.mockSetDoc).not.toHaveBeenCalled();
    expect(result.aggregated).toBe(false);
  });
});

describe('aggregateCurrentWeekDaily — TT-anchored week key (TZ-invariance regression guard)', () => {
  // Force a non-TT system zone so a system-local `new Date()` basis would resolve
  // a DIFFERENT week than TT at the boundary instant below. getTodayTT() uses an
  // explicit `Intl … America/Port_of_Spain` and is unaffected by process.env.TZ.
  // Node re-reads process.env.TZ on subsequent Date operations.
  const ORIG_TZ = globalThis.process.env.TZ;
  beforeAll(() => { globalThis.process.env.TZ = 'UTC'; });
  afterAll(() => { globalThis.process.env.TZ = ORIG_TZ; });
  afterEach(() => { vi.useRealTimers(); });

  it('keys the draft on the TT week, not a system-local Date basis', async () => {
    // 2026-06-14T02:00:00Z = Sat 2026-06-13 22:00 in Trinidad (UTC-4), but
    // Sun 2026-06-14 in UTC. TT-anchored → getTodayTT()='2026-06-13' →
    // getSundayOf → week starting Sun '2026-06-07'. A system-local (UTC) basis
    // → '2026-06-14'. This breaks if the aggregator key ever reverts off
    // getSundayOf(getTodayTT()) to getMostRecentSunday()/local new Date().
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T02:00:00Z'));

    getDailyEntriesForWeek.mockResolvedValueOnce([{ qualifiedApproaches: 1 }]);
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValueOnce({ exists: () => false });

    await aggregateCurrentWeekDaily('t1', 'uid-a', 'Agent A', 0, null, null);

    const [, payload] = hoisted.mockSetDoc.mock.calls[0];
    expect(payload.weekStarting).toBe('2026-06-07');       // TT week
    expect(payload.weekStarting).not.toBe('2026-06-14');   // system-local (UTC) week — the bug
  });
});
