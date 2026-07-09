// Nav redesign PR-4 — getWorkspaceGroups resolver unit tests.
//
// Pure module (no Firebase / no component mount). The INVARIANT test is the
// load-bearing assertion: the workspace (My Work ∪ My Team) routable-destination
// set must equal the pinned-layout producingManager destination set, per role.

import { describe, it, expect } from 'vitest';
import { getNavConfig, getWorkspaceGroups } from '../navConfig';

const ids = (items) => items.map((i) => i.id);
// "Destinations" = routable items (carry a tabId). Action items (Daily Log,
// Meetings) have no tabId and are additive reachability, not pinned destinations.
const destIds = (items) => items.filter((i) => i.tabId).map((i) => i.id);
const sectionLabels = (items) => items.map((i) => i.sectionLabel).filter(Boolean);

describe('getWorkspaceGroups — THE INVARIANT (workspace destinations == pinned destinations)', () => {
  ['unit_manager', 'branch_manager'].forEach((role) => {
    it(`workspace ∪ team routable destinations == pinned set for ${role}`, () => {
      const pinned = new Set(destIds(getNavConfig('producingManager', { role })));
      const work = destIds(getWorkspaceGroups('producingManager', { role, workspace: 'work' }));
      const team = destIds(getWorkspaceGroups('producingManager', { role, workspace: 'team' }));
      const union = new Set([...work, ...team]);
      // Both directions: every pinned destination is reachable in workspace/both,
      // and no extra routable destination is introduced (leaderboard once via Set).
      expect(union).toEqual(pinned);
    });
  });
});

describe('getWorkspaceGroups — partition (Decision B + ruling #7)', () => {
  const work = getWorkspaceGroups('producingManager', { role: 'branch_manager', workspace: 'work' });
  const team = getWorkspaceGroups('producingManager', { role: 'branch_manager', workspace: 'team' });

  it('My Work preserves My Production + Planning sub-headers, then Recognition', () => {
    expect(sectionLabels(work)).toEqual(['My Production', 'Planning', 'Recognition']);
  });

  it('My Team is a single flat section, then Recognition', () => {
    expect(sectionLabels(team)).toEqual(['My Team', 'Recognition']);
  });

  it('Daily Log action leads My Production (top of My Work)', () => {
    expect(work[0]).toMatchObject({ id: 'mp-daily-log', action: 'log-today', sectionLabel: 'My Production' });
  });

  it('Meetings action leads My Team', () => {
    expect(team[0]).toMatchObject({ id: 'mp-meetings', action: 'start-meeting', sectionLabel: 'My Team' });
  });

  it('My Work folds in my-war + mp-money-needs (addendum omitted)', () => {
    expect(ids(work)).toEqual(expect.arrayContaining(['my-war', 'mp-money-needs']));
  });

  it('My Team folds in team, team-perf, settlements, agent-of-month', () => {
    expect(ids(team)).toEqual(expect.arrayContaining(['team', 'team-perf', 'settlements', 'agent-of-month']));
  });

  it('leaderboard renders in BOTH workspaces (persistent Recognition — Decision A)', () => {
    expect(ids(work)).toContain('leaderboard');
    expect(ids(team)).toContain('leaderboard');
    // Single instance per workspace — never duplicated within one render.
    expect(ids(work).filter((id) => id === 'leaderboard')).toHaveLength(1);
    expect(ids(team).filter((id) => id === 'leaderboard')).toHaveLength(1);
  });

  it('planner is un-gated in My Work (ships item 3.2)', () => {
    expect(work.find((i) => i.id === 'planner').disabled).toBeFalsy();
  });

  it('confirmed-dropped addendum labels never appear', () => {
    const all = [...ids(work), ...ids(team)];
    ['mp-dashboard', 'mp-persistency', 'mp-production-report', 'mp-awards', 'career', 'prospect-info']
      .forEach((dropped) => expect(all).not.toContain(dropped));
  });
});

describe('getWorkspaceGroups — role gating', () => {
  it('unit_manager My Team excludes branch-only items (team-wars, agent-of-month, kiosk, financing)', () => {
    const umTeam = ids(getWorkspaceGroups('producingManager', { role: 'unit_manager', workspace: 'team' }));
    ['team-wars', 'agent-of-month', 'kiosk', 'financing'].forEach((bmOnly) => expect(umTeam).not.toContain(bmOnly));
  });

  it('branch_manager My Team includes branch-only items', () => {
    const bmTeam = ids(getWorkspaceGroups('producingManager', { role: 'branch_manager', workspace: 'team' }));
    ['team-wars', 'agent-of-month', 'kiosk', 'financing'].forEach((bmOnly) => expect(bmTeam).toContain(bmOnly));
  });
});

describe('getWorkspaceGroups — guards', () => {
  it('returns [] for a non-producingManager config (agents have no workspaces)', () => {
    expect(getWorkspaceGroups('agent', { workspace: 'work' })).toEqual([]);
    expect(getWorkspaceGroups('manager', { workspace: 'team' })).toEqual([]);
  });

  it('defaults to the work workspace when none is given', () => {
    const def = getWorkspaceGroups('producingManager', { role: 'branch_manager' });
    expect(sectionLabels(def)).toEqual(['My Production', 'Planning', 'Recognition']);
  });
});
