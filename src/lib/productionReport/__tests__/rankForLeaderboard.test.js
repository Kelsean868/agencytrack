import { describe, it, expect } from 'vitest';
import { buildRankedAgents, deriveInitials } from '../rankForLeaderboard.js';

// ── Reference date ───────────────────────────────────────────────────────────
// Same reference as computations.test.js for consistency.
// Friday 2026-05-15 10:00 UTC = Friday 06:00 TT (UTC-4).
// Period boundaries from this reference:
//   WK:  Sunday 2026-05-10 → Saturday 2026-05-16
//   MTD: 2026-05-01 → 2026-05-15
//   QTD: 2026-04-01 → 2026-05-15  (Q2 = Apr/May/Jun)
//   YTD: 2026-01-01 → 2026-05-15
const REF = new Date('2026-05-15T10:00:00Z');

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkSub(agentId, weekStarting, api, apps = 1) {
  return {
    agentId,
    weekStarting,
    status: 'submitted',
    version: 2,
    newBusiness:   { api, apps },
    pppIncreases:  { apiIncrease: 0, apps: 0 },
    lumpsums:      { apiCredit: 0, commission: 0 },
    totalProductionCredit: api,
  };
}

function mkAgent(id, name, unitId = null, provisioning = false) {
  return { id, name, role: 'agent', unitId, provisioning };
}

function mkUnitManager(id, unitName = null) {
  return { id, role: 'unit_manager', name: `Manager ${id}`, unitName };
}

// ── deriveInitials ────────────────────────────────────────────────────────────

describe('deriveInitials', () => {
  it('takes first letter of each word, uppercase, max 2', () => {
    expect(deriveInitials('Carla Joseph')).toBe('CJ');
    expect(deriveInitials('Anand Kumar Persad')).toBe('AK');
    expect(deriveInitials('Marsha')).toBe('M');
  });

  it('returns ? for empty or null', () => {
    expect(deriveInitials('')).toBe('?');
    expect(deriveInitials(null)).toBe('?');
    expect(deriveInitials(undefined)).toBe('?');
  });
});

// ── buildRankedAgents — empty / null safety ──────────────────────────────────

describe('buildRankedAgents — empty data', () => {
  it('returns agent at rank 1 with periodApi=0 when submissions is empty', () => {
    const agents = [mkAgent('a1', 'Agent One')];
    const result = buildRankedAgents([], agents, 'week', REF);
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('a1');
    expect(result[0].periodApi).toBe(0);
    expect(result[0].rank).toBe(1);
  });

  it('returns [] when allUsers is empty', () => {
    const subs = [mkSub('a1', '2026-05-10', 10000)];
    const result = buildRankedAgents(subs, [], 'week', REF);
    expect(result).toEqual([]);
  });

  it('returns [] for null inputs (never crashes)', () => {
    expect(buildRankedAgents(null, null, 'week', REF)).toEqual([]);
    expect(buildRankedAgents(undefined, undefined, 'ytd', REF)).toEqual([]);
  });
});

// ── buildRankedAgents — branch scope filtering ───────────────────────────────

describe('buildRankedAgents — branch scope filtering', () => {
  it('excludes users whose role is not agent', () => {
    const users = [
      mkAgent('a1', 'Agent One'),
      mkUnitManager('m1'),
      { id: 'ta1', role: 'tenant_admin', name: 'Admin', provisioning: false },
    ];
    const subs = [
      mkSub('a1', '2026-05-10', 5000),
      mkSub('m1', '2026-05-10', 8000),
      mkSub('ta1', '2026-05-10', 9000),
    ];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('a1');
  });

  it('excludes agents with provisioning: true', () => {
    const users = [
      mkAgent('a1', 'Real Agent'),
      mkAgent('a2', 'Stub Agent', null, true),
    ];
    const subs = [
      mkSub('a1', '2026-05-10', 5000),
      mkSub('a2', '2026-05-10', 9000),
    ];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('a1');
  });

  it('only attributes submissions to their owner via agentId', () => {
    const users = [mkAgent('a1', 'Alpha'), mkAgent('a2', 'Beta')];
    const subs = [
      mkSub('a1', '2026-05-10', 10000),
      mkSub('a2', '2026-05-10',  5000),
    ];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result[0].agentId).toBe('a1');
    expect(result[0].periodApi).toBe(10000);
    expect(result[1].agentId).toBe('a2');
    expect(result[1].periodApi).toBe(5000);
  });
});

// ── buildRankedAgents — period filtering ────────────────────────────────────

describe('buildRankedAgents — period filtering', () => {
  const agents = [mkAgent('a1', 'Only Agent')];

  it('WK: includes submission in current WAR week (2026-05-10)', () => {
    const subs = [mkSub('a1', '2026-05-10', 7000)]; // Sun within WK window
    const result = buildRankedAgents(subs, agents, 'week', REF);
    expect(result[0].periodApi).toBe(7000);
  });

  it('WK: excludes submission from previous week (2026-05-03)', () => {
    const subs = [mkSub('a1', '2026-05-03', 7000)];
    const result = buildRankedAgents(subs, agents, 'week', REF);
    expect(result[0].periodApi).toBe(0);
  });

  it('MTD: includes submission from 2026-05-01', () => {
    const subs = [mkSub('a1', '2026-05-03', 4000)]; // First Sun of May
    const result = buildRankedAgents(subs, agents, 'mtd', REF);
    expect(result[0].periodApi).toBe(4000);
  });

  it('MTD: excludes submission from 2026-04-26 (previous month)', () => {
    const subs = [mkSub('a1', '2026-04-26', 4000)];
    const result = buildRankedAgents(subs, agents, 'mtd', REF);
    expect(result[0].periodApi).toBe(0);
  });

  it('QTD: includes submission from 2026-04-05 (Q2 Apr)', () => {
    const subs = [mkSub('a1', '2026-04-05', 6000)];
    const result = buildRankedAgents(subs, agents, 'quarter', REF);
    expect(result[0].periodApi).toBe(6000);
  });

  it('QTD: excludes submission from 2026-03-29 (Q1, before Q2)', () => {
    const subs = [mkSub('a1', '2026-03-29', 6000)];
    const result = buildRankedAgents(subs, agents, 'quarter', REF);
    expect(result[0].periodApi).toBe(0);
  });

  it('YTD: includes submission from 2026-01-04 (first Sun of year)', () => {
    const subs = [mkSub('a1', '2026-01-04', 3000)];
    const result = buildRankedAgents(subs, agents, 'ytd', REF);
    expect(result[0].periodApi).toBe(3000);
  });

  it('YTD: excludes submission from 2025-12-28 (prior year)', () => {
    const subs = [mkSub('a1', '2025-12-28', 3000)];
    const result = buildRankedAgents(subs, agents, 'ytd', REF);
    expect(result[0].periodApi).toBe(0);
  });

  it('sums multiple submissions in period for same agent', () => {
    const subs = [
      mkSub('a1', '2026-05-03', 4000),
      mkSub('a1', '2026-05-10', 6000),
    ];
    const result = buildRankedAgents(subs, agents, 'mtd', REF);
    expect(result[0].periodApi).toBe(10000);
  });
});

// ── buildRankedAgents — ranking + tie-breaking ───────────────────────────────

describe('buildRankedAgents — ranking', () => {
  it('ranks agents descending by periodApi', () => {
    const users = [mkAgent('a1', 'Alpha'), mkAgent('a2', 'Beta'), mkAgent('a3', 'Gamma')];
    const subs = [
      mkSub('a1', '2026-05-10', 10000),
      mkSub('a2', '2026-05-10', 30000),
      mkSub('a3', '2026-05-10', 20000),
    ];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result.map((r) => r.agentId)).toEqual(['a2', 'a3', 'a1']);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('tie in API: higher apps wins', () => {
    const users = [mkAgent('a1', 'Alpha'), mkAgent('a2', 'Beta')];
    const subs = [
      mkSub('a1', '2026-05-10', 10000, 3), // same API, fewer apps
      mkSub('a2', '2026-05-10', 10000, 5), // same API, more apps → wins
    ];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result[0].agentId).toBe('a2');
    expect(result[1].agentId).toBe('a1');
  });

  it('tie in API + apps: alphabetical name asc', () => {
    const users = [mkAgent('a1', 'Zara'), mkAgent('a2', 'Alice')];
    const subs = [
      mkSub('a1', '2026-05-10', 10000, 3),
      mkSub('a2', '2026-05-10', 10000, 3),
    ];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result[0].name).toBe('Alice'); // Alice < Zara alphabetically
  });

  it('agents with zero production in period are ranked last', () => {
    const users = [mkAgent('a1', 'Alpha'), mkAgent('a2', 'Beta')];
    const subs = [mkSub('a1', '2026-05-10', 15000)];
    // a2 has no submission → 0 API → rank 2
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result[0].agentId).toBe('a1');
    expect(result[0].rank).toBe(1);
    expect(result[1].agentId).toBe('a2');
    expect(result[1].rank).toBe(2);
    expect(result[1].periodApi).toBe(0);
  });
});

// ── buildRankedAgents — rankWithinUnit ────────────────────────────────────────

describe('buildRankedAgents — rankWithinUnit', () => {
  it('assigns independent ranks per unit', () => {
    const users = [
      mkAgent('a1', 'Unit01A', 'unit01'),
      mkAgent('a2', 'Unit01B', 'unit01'),
      mkAgent('a3', 'Unit02A', 'unit02'),
    ];
    const subs = [
      mkSub('a1', '2026-05-10', 20000),
      mkSub('a2', '2026-05-10', 10000),
      mkSub('a3', '2026-05-10', 15000),
    ];
    const result = buildRankedAgents(subs, users, 'week', REF);
    const byId = Object.fromEntries(result.map((r) => [r.agentId, r]));
    // Overall: a1 (20k) #1, a3 (15k) #2, a2 (10k) #3
    expect(byId['a1'].rank).toBe(1);
    expect(byId['a3'].rank).toBe(2);
    expect(byId['a2'].rank).toBe(3);
    // Within unit01: a1 #1, a2 #2. Within unit02: a3 #1.
    expect(byId['a1'].rankWithinUnit).toBe(1);
    expect(byId['a2'].rankWithinUnit).toBe(2);
    expect(byId['a3'].rankWithinUnit).toBe(1);
  });
});

// ── buildRankedAgents — return shape + unit name resolution ──────────────────

describe('buildRankedAgents — return shape', () => {
  it('resolves unitName from unit manager doc', () => {
    const users = [
      mkAgent('a1', 'Agent One', 'mgr01'),
      mkUnitManager('mgr01', 'South 01'),
    ];
    const subs = [mkSub('a1', '2026-05-10', 5000)];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result[0].unitName).toBe('South 01');
    expect(result[0].unitId).toBe('mgr01');
  });

  it('sets unitName null when agent has no unitId', () => {
    const users = [mkAgent('a1', 'Unassigned Agent', null)];
    const subs = [mkSub('a1', '2026-05-10', 5000)];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result[0].unitId).toBeNull();
    expect(result[0].unitName).toBeNull();
  });

  it('includes initials derived from name', () => {
    const users = [mkAgent('a1', 'Priya Naidu')];
    const subs = [mkSub('a1', '2026-05-10', 5000)];
    const result = buildRankedAgents(subs, users, 'week', REF);
    expect(result[0].initials).toBe('PN');
  });

  it('exposes all required consumer fields', () => {
    const users = [mkAgent('a1', 'Test Agent', 'mgr01'), mkUnitManager('mgr01', 'S·01')];
    const subs = [mkSub('a1', '2026-05-10', 8000, 4)];
    const [entry] = buildRankedAgents(subs, users, 'week', REF);
    expect(entry).toMatchObject({
      agentId:       'a1',
      name:          'Test Agent',
      initials:      'TA',
      unitId:        'mgr01',
      unitName:      'S·01',
      periodApi:     8000,
      apps:          4,
      rank:          1,
      rankWithinUnit: 1,
    });
  });
});
