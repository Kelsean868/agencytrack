import { describe, it, expect } from 'vitest';
import { deriveManagerQualification, higherAccommodation } from '../campaignEngine';

// ─── C4 · Table 2, manager accommodation ─────────────────────────────────────
//
// Page 7 of the signed document. A manager is paid CASH only as an ADVISOR
// (Table 1); Table 2 grants a ROOM and never money. A manager takes the HIGHER
// accommodation of the two tables, not the sum.

// The eight Table 2 rows, verbatim.
const MANAGER_QUALIFICATION = [
  { role: 'branch_manager', agentsQualifying: 5, personalApi: 0,       personalApps: 0,  accommodation: 'double' },
  { role: 'branch_manager', agentsQualifying: 3, personalApi: 0,       personalApps: 0,  accommodation: 'single' },
  { role: 'unit_manager',   agentsQualifying: 2, personalApi: 275_000, personalApps: 35, accommodation: 'double' },
  { role: 'unit_manager',   agentsQualifying: 2, personalApi: 0,       personalApps: 0,  accommodation: 'single' },
  { role: 'unit_manager',   agentsQualifying: 1, personalApi: 275_000, personalApps: 35, accommodation: 'single' },
  { role: 'team_leader',    agentsQualifying: 2, personalApi: 275_000, personalApps: 35, accommodation: 'double' },
  { role: 'team_leader',    agentsQualifying: 2, personalApi: 0,       personalApps: 0,  accommodation: 'single' },
  { role: 'team_leader',    agentsQualifying: 1, personalApi: 275_000, personalApps: 35, accommodation: 'single' },
];

const CAMPAIGN = { managerQualification: MANAGER_QUALIFICATION };

/** A qualified standings row — tier reached AND gate passed. */
const qualified = (agentId) => ({
  agentId, name: agentId, qualified: true, disqualified: false,
  apiTotal: 300_000, appsTotal: 36,
  tier: { level: 1, name: 'Champion', cash: 7_000, accommodation: 'shared' },
});

/** A row that reached a tier but failed the gate — NOT a qualifying agent. */
const gatedOut = (agentId) => ({
  ...qualified(agentId), qualified: false, disqualified: true,
});

const mgrRow = (over = {}) => ({
  agentId: 'mgr', name: 'The Manager', qualified: false, disqualified: false,
  apiTotal: 0, appsTotal: 0, tier: null, ...over,
});

function run({ role, qualifyingAgents, personal = null, unitMembers = null }) {
  const agents = Array.from({ length: qualifyingAgents }, (_, i) => qualified(`a${i}`));
  const standings = personal ? [...agents, personal] : agents;
  const managers = [{ id: 'mgr', name: 'The Manager', role, branchId: 'b1', unitId: 'u1' }];
  const usersByUnit = { u1: unitMembers ?? agents.map((a) => a.agentId) };
  return deriveManagerQualification(CAMPAIGN, standings, managers, usersByUnit)[0];
}

describe('C4 — Table 2 matrix (the C4 deliverable)', () => {
  // [label, role, qualifying agents, personal production, expected room]
  const AGENCY_MANAGER = [
    ['Agency Manager, 5 qualifying agents', 5, 'double'],
    ['Agency Manager, 4 qualifying agents', 4, 'single'],
    ['Agency Manager, 3 qualifying agents', 3, 'single'],
    ['Agency Manager, 2 qualifying agents', 2, null],
  ];

  it.each(AGENCY_MANAGER)('%s -> %s', (_label, agents, expected) => {
    const out = run({ role: 'branch_manager', qualifyingAgents: agents });
    expect(out.agentsQualifying).toBe(agents);
    expect(out.accommodation).toBe(expected);
  });

  // A Unit Manager's rows ask for personal production as well as a headcount.
  const UNIT_MANAGER = [
    ['Unit Manager, 2 agents + personal 275k/35', 2, { api: 275_000, apps: 35 }, 'double'],
    ['Unit Manager, 2 agents + personal 0/0',     2, { api: 0, apps: 0 },        'single'],
    ['Unit Manager, 1 agent  + personal 275k/35', 1, { api: 275_000, apps: 35 }, 'single'],
    ['Unit Manager, 1 agent  + personal 0/0',     1, { api: 0, apps: 0 },        null],
  ];

  it.each(UNIT_MANAGER)('%s -> %s', (_label, agents, personal, expected) => {
    const out = run({
      role: 'unit_manager',
      qualifyingAgents: agents,
      personal: mgrRow({ apiTotal: personal.api, appsTotal: personal.apps }),
    });
    expect(out.agentsQualifying).toBe(agents);
    expect(out.personalApi).toBe(personal.api);
    expect(out.personalApps).toBe(personal.apps);
    expect(out.accommodation).toBe(expected);
  });
});

describe('C4 — Table 2 scoping and the two money rules', () => {
  it('never counts the manager as one of their own qualifying agents (R2)', () => {
    // The manager themselves is qualified. With 4 other qualifying agents that
    // is 5 rows in standings, but only 4 count — so Single, not Double.
    const out = run({
      role: 'branch_manager',
      qualifyingAgents: 4,
      personal: { ...qualified('mgr'), agentId: 'mgr' },
    });
    expect(out.agentsQualifying).toBe(4);
    expect(out.accommodation).toBe('single');
  });

  it('counts only agents who cleared the GATE, not merely the tier', () => {
    const standings = [qualified('a0'), qualified('a1'), gatedOut('a2'), gatedOut('a3'), gatedOut('a4')];
    const managers = [{ id: 'mgr', name: 'M', role: 'branch_manager', branchId: 'b1' }];
    const out = deriveManagerQualification(CAMPAIGN, standings, managers, {})[0];
    expect(out.agentsQualifying).toBe(2); // not 5
    expect(out.accommodation).toBeNull(); // 2 < the 3 an Agency Manager needs
  });

  it('scopes a Unit Manager to their own unit', () => {
    const standings = [qualified('in1'), qualified('in2'), qualified('out1'), qualified('out2')];
    const managers = [{ id: 'mgr', name: 'M', role: 'unit_manager', unitId: 'u1' }];
    const out = deriveManagerQualification(CAMPAIGN, standings, managers, { u1: ['in1', 'in2'] })[0];
    expect(out.agentsQualifying).toBe(2); // not 4
  });

  it('CASH is only ever the advisor cash — Table 2 grants a room, not money', () => {
    const out = run({
      role: 'branch_manager',
      qualifyingAgents: 5,
      personal: mgrRow({ tier: { level: 1, name: 'Champion', cash: 7_000, accommodation: 'shared' } }),
    });
    expect(out.accommodation).toBe('double'); // from Table 2
    expect(out.cash).toBe(7_000);             // from Table 1, unchanged by the room
  });

  it('takes the HIGHER of the two tables, never the sum', () => {
    // Table 1 gives Double (Pioneer); Table 2 would give Single at 3 agents.
    const out = run({
      role: 'branch_manager',
      qualifyingAgents: 3,
      personal: mgrRow({ tier: { level: 5, name: 'Pioneer', cash: 70_000, accommodation: 'double' } }),
    });
    expect(out.asManager.accommodation).toBe('single');
    expect(out.asAdvisor.accommodation).toBe('double');
    expect(out.accommodation).toBe('double');
  });

  it('a manager with no production is not disqualified — they clear the 0/0 rows', () => {
    const out = run({ role: 'unit_manager', qualifyingAgents: 2, personal: mgrRow() });
    expect(out.personalApi).toBe(0);
    expect(out.accommodation).toBe('single');
  });

  it('a gate-disqualified manager loses BOTH the cash and the room (Rule 5)', () => {
    const out = run({
      role: 'branch_manager',
      qualifyingAgents: 5,
      personal: mgrRow({
        disqualified: true,
        tier: { level: 1, name: 'Champion', cash: 7_000, accommodation: 'shared' },
      }),
    });
    expect(out.disqualified).toBe(true);
    expect(out.cash).toBe(0);
    expect(out.accommodation).toBeNull();
  });

  it('skips team_leader with a stated reason rather than guessing a room', () => {
    const managers = [{ id: 'mgr', name: 'TL', role: 'team_leader', branchId: 'b1' }];
    const out = deriveManagerQualification(CAMPAIGN, [qualified('a0'), qualified('a1')], managers, {})[0];
    expect(out.notModelled).toBe(true);
    expect(out.notModelledReason).toBe('Direct Sales Team Leader is not modelled');
    expect(out.asManager).toBeNull();
    expect(out.accommodation).toBeNull();
  });

  it('abstains cleanly when the campaign declares no manager rows', () => {
    const managers = [{ id: 'mgr', name: 'M', role: 'branch_manager' }];
    const out = deriveManagerQualification({}, [qualified('a0')], managers, {})[0];
    expect(out.asManager).toBeNull();
    expect(out.accommodation).toBeNull();
    expect(out.cash).toBe(0);
  });
});

describe('C4 — higherAccommodation', () => {
  it('ranks double > single > shared', () => {
    expect(higherAccommodation('single', 'double')).toBe('double');
    expect(higherAccommodation('double', 'single')).toBe('double');
    expect(higherAccommodation('shared', 'single')).toBe('single');
  });

  it('returns null only when neither side grants a room', () => {
    expect(higherAccommodation(null, null)).toBeNull();
    expect(higherAccommodation(undefined, null)).toBeNull();
    expect(higherAccommodation('shared', null)).toBe('shared');
    expect(higherAccommodation(null, 'double')).toBe('double');
  });
});
