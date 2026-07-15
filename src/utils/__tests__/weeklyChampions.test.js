import { describe, it, expect } from 'vitest';
import { computeWeeklyChampions, rankWeeklyChampions } from '../weeklyChampions';

const WEEK = '2026-07-12';

const mkSub = (over = {}) => ({
  agentId: 'a1', agentName: 'Aaliyah Ali',
  weekStarting: WEEK, status: 'submitted',
  totalProductionCredit: 1000, applicationsSold: 1, ffiConducted: 1, ciConducted: 0,
  ...over,
});

describe('computeWeeklyChampions — unchanged after refactor', () => {
  it('returns nulls for an empty week', () => {
    const out = computeWeeklyChampions([], WEEK);
    expect(out).toEqual({ topAPI: null, topApps: null, topActivity: null, weekStarting: WEEK });
  });

  it('picks the single winner per category', () => {
    const subs = [
      mkSub({ agentId: 'a1', agentName: 'Aaliyah Ali', totalProductionCredit: 5000, applicationsSold: 2 }),
      mkSub({ agentId: 'a2', agentName: 'Zubin Baksh',  totalProductionCredit: 9000, applicationsSold: 5 }),
    ];
    const out = computeWeeklyChampions(subs, WEEK);
    expect(out.topAPI.agentId).toBe('a2');
    expect(out.topAPI.value).toBe(9000);
    expect(out.topApps.agentId).toBe('a2');
  });

  it('ignores drafts and other weeks', () => {
    const subs = [
      mkSub({ status: 'draft' }),
      mkSub({ weekStarting: '2026-07-05' }),
    ];
    expect(computeWeeklyChampions(subs, WEEK)).toEqual({
      topAPI: null, topApps: null, topActivity: null, weekStarting: WEEK,
    });
  });
});

describe('rankWeeklyChampions', () => {
  it('returns an empty array for an empty week (honest empty state)', () => {
    expect(rankWeeklyChampions([], WEEK)).toEqual([]);
  });

  it('ranks by API desc, assigns 1-based rank, caps at topN', () => {
    const subs = [
      mkSub({ agentId: 'a1', agentName: 'Aaliyah Ali', totalProductionCredit: 5000, applicationsSold: 2 }),
      mkSub({ agentId: 'a2', agentName: 'Zubin Baksh',  totalProductionCredit: 9000, applicationsSold: 5 }),
      mkSub({ agentId: 'a3', agentName: 'Mira Singh',   totalProductionCredit: 7000, applicationsSold: 3 }),
      mkSub({ agentId: 'a4', agentName: 'Devon Charles', totalProductionCredit: 1000, applicationsSold: 1 }),
    ];
    const out = rankWeeklyChampions(subs, WEEK, { topN: 3 });
    expect(out).toHaveLength(3);
    expect(out.map((c) => c.agentId)).toEqual(['a2', 'a3', 'a1']);
    expect(out[0]).toEqual({ rank: 1, agentId: 'a2', agentName: 'Zubin Baksh', api: 9000, apps: 5 });
    expect(out[2].rank).toBe(3);
  });

  it('breaks ties by agentName ascending', () => {
    const subs = [
      mkSub({ agentId: 'b', agentName: 'Zed', totalProductionCredit: 5000 }),
      mkSub({ agentId: 'a', agentName: 'Ann', totalProductionCredit: 5000 }),
    ];
    const out = rankWeeklyChampions(subs, WEEK);
    expect(out.map((c) => c.agentName)).toEqual(['Ann', 'Zed']);
  });

  it('drops agents with api <= 0', () => {
    const subs = [mkSub({ totalProductionCredit: 0 })];
    expect(rankWeeklyChampions(subs, WEEK)).toEqual([]);
  });

  it('ignores drafts and other weeks (same filter as computeWeeklyChampions)', () => {
    const subs = [
      mkSub({ status: 'draft', totalProductionCredit: 9999 }),
      mkSub({ weekStarting: '2026-07-05', totalProductionCredit: 9999 }),
    ];
    expect(rankWeeklyChampions(subs, WEEK)).toEqual([]);
  });
});
