// POC (feat/gp-prefetch) — prefetchGamePlanYearDocs warms the 3 Game Plan
// year-docs into Firestore's local cache via listeners, so the gated Game Plan
// entrance lands on populated content even on field networks. These tests pin:
// the warmed paths MATCH what GamePlanScreen reads (moneyNeeds/yearPlan/monthlyPlan
// at tenants/{tid}/users/{uid}/{col}/{year}), exactly one listener per doc (no
// double-subscribe), a working teardown, arg guards, and failure-silence.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const onSnapshotMock = vi.fn(() => vi.fn());
const docMock = vi.fn((...args) => ({ __path: args.slice(1).join('/') }));

vi.mock('firebase/firestore', () => ({
  doc: (...args) => docMock(...args),
  onSnapshot: (...args) => onSnapshotMock(...args),
}));

import { prefetchGamePlanYearDocs, GAME_PLAN_YEAR_COLLECTIONS } from '../gamePlanPrefetch';

beforeEach(() => {
  vi.clearAllMocks();
  onSnapshotMock.mockImplementation(() => vi.fn());
});

describe('prefetchGamePlanYearDocs', () => {
  it('warms exactly the 3 year-doc paths GamePlanScreen reads', () => {
    prefetchGamePlanYearDocs('t1', 'u1', 2026);
    // one doc()/onSnapshot per collection — no duplicate subscriptions.
    expect(docMock).toHaveBeenCalledTimes(3);
    expect(onSnapshotMock).toHaveBeenCalledTimes(3);
    const paths = docMock.mock.calls.map((c) => c.slice(1).join('/'));
    expect(paths).toEqual([
      'tenants/t1/users/u1/moneyNeeds/2026',
      'tenants/t1/users/u1/yearPlan/2026',
      'tenants/t1/users/u1/monthlyPlan/2026',
    ]);
    // and the exported order matches the services' read order.
    expect(GAME_PLAN_YEAR_COLLECTIONS).toEqual(['moneyNeeds', 'yearPlan', 'monthlyPlan']);
  });

  it('coerces year to the integer-string doc id the services use', () => {
    prefetchGamePlanYearDocs('t1', 'u1', '2026');
    const paths = docMock.mock.calls.map((c) => c.slice(1).join('/'));
    expect(paths.every((p) => p.endsWith('/2026'))).toBe(true);
  });

  it('returns an unsubscribe that tears down every listener', () => {
    const unsubs = [vi.fn(), vi.fn(), vi.fn()];
    let i = 0;
    onSnapshotMock.mockImplementation(() => unsubs[i++]);
    const teardown = prefetchGamePlanYearDocs('t1', 'u1', 2026);
    teardown();
    unsubs.forEach((u) => expect(u).toHaveBeenCalledTimes(1));
  });

  it('is a no-op (no listeners) when tenantId, uid, or year is missing/invalid', () => {
    expect(prefetchGamePlanYearDocs(null, 'u1', 2026)).toBeTypeOf('function');
    prefetchGamePlanYearDocs('t1', null, 2026);
    prefetchGamePlanYearDocs('t1', 'u1', null);
    prefetchGamePlanYearDocs('t1', 'u1', 'not-a-year');
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });

  it('is failure-silent — a throwing onSnapshot never propagates, teardown stays safe', () => {
    onSnapshotMock.mockImplementation(() => { throw new Error('permission-denied'); });
    let teardown;
    expect(() => { teardown = prefetchGamePlanYearDocs('t1', 'u1', 2026); }).not.toThrow();
    expect(() => teardown()).not.toThrow();
  });
});
