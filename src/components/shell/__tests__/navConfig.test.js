// Nav redesign PR-1 — navConfig resolver unit tests.
//
// Pure module (no Firebase / no component mount). Locks the no-regression
// mapping for producing managers and the agent group/SOON/Daily-Log behavior.

import { describe, it, expect } from 'vitest';
import { getNavConfig, getPinnedSeed, tabTitleFromItems } from '../navConfig';

const ids = (items) => items.map((i) => i.id);

describe('getNavConfig — agent', () => {
  it('groups in order Today / Planning / Tools / Recognition', () => {
    const items = getNavConfig('agent', { showDailyCapture: true });
    expect(items.map((i) => i.sectionLabel).filter(Boolean)).toEqual([
      'Today', 'Planning', 'Tools', 'Recognition',
    ]);
  });

  it('includes Daily Log only when daily capture is enabled', () => {
    expect(ids(getNavConfig('agent', { showDailyCapture: true }))).toContain('daily-log');
    expect(ids(getNavConfig('agent', { showDailyCapture: false }))).not.toContain('daily-log');
  });

  it('Game Plan carries no New badge; Money Needs is a child', () => {
    const items = getNavConfig('agent', { showDailyCapture: true });
    expect(items.find((i) => i.id === 'game-plan').badgeNew).toBeUndefined();
    expect(items.find((i) => i.id === 'money-needs').child).toBe(true);
  });

  it('Planner is un-gated (ships item 3.2); Prospect Prep stays disabled (SOON)', () => {
    const items = getNavConfig('agent', { showDailyCapture: true });
    expect(items.find((i) => i.id === 'planner').disabled).toBeFalsy();
    expect(items.find((i) => i.id === 'prospect-info').disabled).toBe(true);
  });

  it('Leaderboard points at the production-leaderboard tab', () => {
    const items = getNavConfig('agent', { showDailyCapture: true });
    expect(items.find((i) => i.id === 'leaderboard').tabId).toBe('production-leaderboard');
  });
});

describe('getNavConfig — producingManager (no-regression mapping)', () => {
  // Items the shared NAV_ITEMS gated to branch_manager+ (unit_manager excluded).
  // 'financing' (Track K · K1) joins this set — BM-and-up per contract 5.3.
  const BM_ONLY = ['team-wars', 'agent-of-month', 'kiosk', 'financing'];
  // Destinations the dispatcher ruling requires to survive the re-grouping.
  const MUST_KEEP = ['my-war', 'settlements', 'team-perf', 'team', 'mp-money-needs'];

  it('unit_manager does NOT see branch-only items', () => {
    const umIds = ids(getNavConfig('producingManager', { role: 'unit_manager' }));
    BM_ONLY.forEach((id) => expect(umIds).not.toContain(id));
  });

  it('branch_manager sees branch-only items', () => {
    const bmIds = ids(getNavConfig('producingManager', { role: 'branch_manager' }));
    BM_ONLY.forEach((id) => expect(bmIds).toContain(id));
  });

  it('no-regression destinations are present for unit_manager', () => {
    const umIds = ids(getNavConfig('producingManager', { role: 'unit_manager' }));
    MUST_KEEP.forEach((id) => expect(umIds).toContain(id));
  });

  it('agent-of-month survives for branch_manager (no-regression)', () => {
    const bmIds = ids(getNavConfig('producingManager', { role: 'branch_manager' }));
    expect(bmIds).toContain('agent-of-month');
  });

  it('all 7 My Production mp-* items are present for both UM and BM', () => {
    const mp = ['mp-report', 'mp-commission', 'mp-policies', 'mp-history', 'mp-game-plan', 'mp-money-needs', 'mp-goals'];
    const umIds = ids(getNavConfig('producingManager', { role: 'unit_manager' }));
    const bmIds = ids(getNavConfig('producingManager', { role: 'branch_manager' }));
    mp.forEach((id) => {
      expect(umIds).toContain(id);
      expect(bmIds).toContain(id);
    });
  });

  it('every item points at a tabId (no fabricated action-only destinations)', () => {
    const items = getNavConfig('producingManager', { role: 'branch_manager' });
    items.forEach((i) => expect(i.tabId, `${i.id} has a tabId`).toBeTruthy());
  });

  it('scope chips render on the enumerated items', () => {
    const items = getNavConfig('producingManager', { role: 'branch_manager' });
    const scopeOf = (id) => items.find((i) => i.id === id)?.scope;
    expect(scopeOf('mp-goals')).toBe('MINE');
    expect(scopeOf('goals')).toBe('TEAM');
    expect(scopeOf('persistency')).toBe('TEAM');
    expect(scopeOf('production-report')).toBe('TEAM');
    expect(scopeOf('awards')).toBe('TEAM');
    expect(scopeOf('leaderboard')).toBe('BOTH');
  });

  it('Planner is un-gated (ships item 3.2 — Team Planner)', () => {
    const items = getNavConfig('producingManager', { role: 'unit_manager' });
    expect(items.find((i) => i.id === 'planner').disabled).toBeFalsy();
  });
});

describe('getNavConfig — manager (defined, unassigned)', () => {
  it('resolves to a non-empty group set', () => {
    const items = getNavConfig('manager');
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.sectionLabel).filter(Boolean)).toEqual([
      'Team', 'Grow', 'Oversight', 'Recognition',
    ]);
  });

  it('Meetings and Career Portal are disabled (no manager route today)', () => {
    const items = getNavConfig('manager');
    expect(items.find((i) => i.id === 'meetings').disabled).toBe(true);
    expect(items.find((i) => i.id === 'career').disabled).toBe(true);
  });
});

describe('getNavConfig — unknown key', () => {
  it('returns an empty array', () => {
    expect(getNavConfig('nope')).toEqual([]);
  });
});

describe('getPinnedSeed — ★ Pinned-zone seeds (PR-2)', () => {
  it('agent seed binds to real navConfig ids', () => {
    expect(getPinnedSeed('agent')).toEqual(['daily-log', 'wizard', 'policy-ledger', 'goals', 'planner']);
  });

  it('producingManager seed binds to real navConfig ids', () => {
    expect(getPinnedSeed('producingManager')).toEqual(['mp-report', 'mastersheet', 'monthly-recruiting', 'mp-goals', 'planner']);
  });

  it('every seed id resolves to an item in the role config (no orphans)', () => {
    for (const key of ['agent', 'producingManager']) {
      const validIds = new Set(getNavConfig(key, { showDailyCapture: true }).map((i) => i.id));
      for (const id of getPinnedSeed(key)) expect(validIds.has(id)).toBe(true);
    }
  });

  it('producingManager seed does NOT include a Log Today / manager log id (dropped)', () => {
    const seed = getPinnedSeed('producingManager');
    expect(seed).not.toContain('log-today');
    expect(seed).not.toContain('daily-log');
  });

  it('manager and unknown configs seed empty', () => {
    expect(getPinnedSeed('manager')).toEqual([]);
    expect(getPinnedSeed('nope')).toEqual([]);
  });
});

describe('tabTitleFromItems — dynamic topbar heading (UX-101 / A11Y-001)', () => {
  const agent = getNavConfig('agent', { showDailyCapture: true });

  it('resolves the active tab label from the nav list', () => {
    expect(tabTitleFromItems(agent, 'awards')).toBe('Awards');
    expect(tabTitleFromItems(agent, 'game-plan')).toBe('Game Plan');
    expect(tabTitleFromItems(agent, 'money-needs')).toBe('Money Needs');
    expect(tabTitleFromItems(agent, 'dashboard')).toBe('Dashboard');
  });

  it('maps the Leaderboard item by its tabId (production-leaderboard, not "leaderboard")', () => {
    expect(tabTitleFromItems(agent, 'production-leaderboard')).toBe('Leaderboard');
  });

  it('falls back for an activeTab with no matching nav descriptor', () => {
    expect(tabTitleFromItems(agent, 'profile')).toBe('Dashboard');
    expect(tabTitleFromItems(agent, 'profile', 'Profile')).toBe('Profile');
  });

  it('is defensive against a non-array items argument', () => {
    expect(tabTitleFromItems(undefined, 'awards')).toBe('Dashboard');
    expect(tabTitleFromItems(null, 'awards', 'Home')).toBe('Home');
  });
});
