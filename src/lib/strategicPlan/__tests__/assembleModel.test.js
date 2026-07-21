import { describe, it, expect } from 'vitest';
import {
  assembleAgentTrackerRows, assembleProductionSummary, assemblePeriodMetrics,
  assembleOrgStructure, assembleRecruitment,
} from '../assembleModel';
import { periodSettlementByAgent } from '../settledTwinRun';
import { yearWindow } from '../periodModel';

const YEAR = 2026;
const NOW = new Date('2026-07-02T12:00:00Z'); // ~half the year elapsed

// Roster: one agent + one producing Trainee/Unit Manager (RULING 3 — the UM must
// appear as a tracker row).
const agentA = { id: 'ag1', role: 'agent', name: 'Ann', unitId: 'um1', contractStartDate: '2024-01-01' };
const traineeMgr = { id: 'um1', role: 'unit_manager', name: 'Trainee Tom', careerLevel: 'Trainee Manager', unitId: 'um1', contractStartDate: '2022-01-01' };
const roster = [agentA, traineeMgr];

const submissions = [
  { agentId: 'ag1', status: 'submitted', weekStarting: '2026-02-01', apiSold: 4000, applicationsSold: 3, telContacts: 10, ffiConducted: 4, ciConducted: 2, coldCalls: 5 },
  { agentId: 'um1', status: 'submitted', weekStarting: '2026-02-08', apiSold: 1000, applicationsSold: 1, telContacts: 3, ffiConducted: 1, ciConducted: 1, coldCalls: 2 },
];

const policies = [
  { agentId: 'ag1', status: 'settled', settledAPI: 6000, dateIssued: new Date('2026-03-01T00:00:00Z') },
  { agentId: 'ag1', status: 'lapsed',  settledAPI: 1000, dateIssued: new Date('2026-03-05T00:00:00Z') },
  { agentId: 'um1', status: 'settled', settledAPI: 2000, dateIssued: new Date('2026-04-01T00:00:00Z') },
];

const persistencyByAgent = {
  ag1: [{ monthKey: '2026-05', persistency: 0.95, grossSettled: 10000, netSettled: 9500, lapses: 500, reinstatements: 0 }],
  um1: [{ monthKey: '2026-05', persistency: 0.80, grossSettled: 5000, netSettled: 4000, lapses: 1000, reinstatements: 0 }],
};

const goalsByAgent = {
  ag1: { personalAnnualAPI: 120000, personalAnnualApps: 24 },
  // um1 intentionally has no goal doc → quota columns show null
};

describe('assembleAgentTrackerRows (p5)', () => {
  const fy = yearWindow(YEAR);
  const settledByAgent = periodSettlementByAgent(policies, fy);
  const rows = assembleAgentTrackerRows({
    roster, ytdSubmissions: submissions, settledByAgent, persistencyByAgent, goalsByAgent, year: YEAR,
  });

  it('includes the producing Trainee/Unit Manager as a row (SMOKE #2)', () => {
    const um = rows.find((r) => r.id === 'um1');
    expect(um).toBeTruthy();
    expect(um.title).toBe('Trainee Manager');
    expect(um.isUnitHead).toBe(true);
    expect(um.apiSubmitted).toBe(1000);
    expect(um.apiNetSettled).toBe(2000);
  });

  it('net excludes lapsed; gross includes it (per-agent)', () => {
    const a = rows.find((r) => r.id === 'ag1');
    expect(a.apiNetSettled).toBe(6000);
    expect(a.apiGrossSettled).toBe(7000);
  });

  it('% objective achieved = net settled ÷ quota; null when no quota', () => {
    const a = rows.find((r) => r.id === 'ag1');
    expect(a.apiPctObj).toBeCloseTo((6000 / 120000) * 100, 5);
    const um = rows.find((r) => r.id === 'um1');
    expect(um.apiPctObj).toBeNull(); // no goal doc
  });

  it('persistency % is the latest month ×100', () => {
    expect(rows.find((r) => r.id === 'ag1').persistencyPct).toBe(95);
  });
});

describe('assembleProductionSummary (p9)', () => {
  const branchGoals = { api: 1200000, apps: 240 };
  const model = assembleProductionSummary({
    ytdSubmissions: submissions, policies, branchGoals, persistencyByAgent, year: YEAR, now: NOW,
  });

  it('annual net settled sums branch (lapsed excluded), gross includes lapsed', () => {
    expect(model.annual.apiNetSettled).toBe(8000);  // 6000 + 2000
    expect(model.annual.apiGrossSettled).toBe(9000); // + 1000 lapsed
  });

  it('monthly quota is prorated ÷ 12', () => {
    expect(model.monthly.apiQuota).toBe(100000);
  });

  it('run-rate projection extrapolates by elapsed fraction (> actual mid-year)', () => {
    expect(model.annual.projectedApi).toBeGreaterThan(model.annual.apiNetSettled);
  });

  it('branch persistency uses aggregatePersistency (summed, not averaged)', () => {
    // sumNet/sumGross = (9500+4000)/(10000+5000) = 13500/15000 = 0.90 → 90%,
    // NOT the arithmetic mean of 95% and 80% (= 87.5%).
    expect(model.persistency.currentPct).toBeCloseTo(90, 5);
    expect(model.persistency.eoyPct).toBeNull();
  });
});

describe('assembleAgentTrackerRows — pace objective (CD mockup)', () => {
  const fy = yearWindow(YEAR);
  const settledByAgent = periodSettlementByAgent(policies, fy);
  it('objYtd prorates the annual quota by elapsed; pace % = net ÷ objYtd', () => {
    const rows = assembleAgentTrackerRows({
      roster, ytdSubmissions: submissions, settledByAgent, persistencyByAgent, goalsByAgent, year: YEAR, elapsed: 0.5,
    });
    const a = rows.find((r) => r.id === 'ag1');
    expect(a.objYtd).toBe(120000 * 0.5);           // 60000
    expect(a.apiPacePct).toBeCloseTo((6000 / 60000) * 100, 5); // 10%
    expect(a.apiPctObj).toBeCloseTo((6000 / 120000) * 100, 5); // raw annual 5%
  });
});

describe('assemblePeriodMetrics (p18)', () => {
  const branchGoals = { api: 1200000, apps: 240 };

  it('quarter granularity → 4 rows; half → 2 rows; FY summary present', () => {
    const q = assemblePeriodMetrics({ ytdSubmissions: submissions, policies, branchGoals, roster, period: { year: YEAR, granularity: 'quarter' } });
    expect(q.rows).toHaveLength(4);
    expect(q.fy.isFy).toBe(true);
    const h = assemblePeriodMetrics({ ytdSubmissions: submissions, policies, branchGoals, roster, period: { year: YEAR, granularity: 'half' } });
    expect(h.rows).toHaveLength(2);
  });

  it('manpower goal reads optional branchGoals.manpower; null when absent', () => {
    const withGoal = assemblePeriodMetrics({ ytdSubmissions: submissions, policies, branchGoals: { ...branchGoals, manpower: 16 }, roster, period: { year: YEAR, granularity: 'quarter' } });
    expect(withGoal.manpowerGoal).toBe(16);
    expect(withGoal.manpowerActual).toBe(roster.length);
    const noGoal = assemblePeriodMetrics({ ytdSubmissions: submissions, policies, branchGoals, roster, period: { year: YEAR, granularity: 'quarter' } });
    expect(noGoal.manpowerGoal).toBeNull();
  });

  it('goal prorates to the window; actual = net settled; variance = actual − goal', () => {
    const q = assemblePeriodMetrics({ ytdSubmissions: submissions, policies, branchGoals, roster, period: { year: YEAR, granularity: 'quarter' } });
    const q1 = q.rows[0];
    expect(q1.apiGoal).toBe(300000);   // 1.2M × 3/12
    expect(q1.apiActual).toBe(6000);   // ag1 settled in March (Q1); um1 settled in April (Q2)
    expect(q1.apiVariance).toBe(6000 - 300000);
  });
});

describe('assembleOrgStructure (p8/14-17)', () => {
  const fy = yearWindow(YEAR);
  const settledByAgent = periodSettlementByAgent(policies, fy);
  const branchUsers = [
    ...roster,
    { id: 'bm1', role: 'branch_manager', name: 'Boss BM' },
    { id: 'cro1', role: 'cro', name: 'Back Office' },
  ];
  it('groups units, rolls up unit net API, and attaches per-advisor net', () => {
    const org = assembleOrgStructure({ branchUsers, ytdSubmissions: submissions, policies, year: YEAR, settledByAgent });
    expect(org.unitCount).toBe(1);
    const unit = org.units[0];
    expect(unit.headName).toBe('Trainee Tom');
    expect(unit.advisorCount).toBe(1);
    expect(unit.ytdNetApi).toBe(8000);          // head um1 (2000) + agent ag1 (6000)
    expect(unit.advisors[0].netApi).toBe(6000); // ag1 per-advisor net
  });
  it('surfaces the branch author and admin staff', () => {
    const org = assembleOrgStructure({ branchUsers, ytdSubmissions: submissions, policies, year: YEAR, settledByAgent });
    expect(org.author.name).toBe('Boss BM');
    expect(org.admins.map((a) => a.name)).toContain('Back Office');
  });
});

describe('assembleRecruitment (p6-7)', () => {
  const candidates = [
    { id: 'c1', name: 'Cand A', stage: 'sourced', status: 'active', source: 'referral', ownerName: 'Ann' },
    { id: 'c2', name: 'Cand B', stage: 'licensed', status: 'active' },
    { id: 'c3', name: 'Cand C', stage: 'interview', status: 'archived' },
  ];
  it('counts by stage, hires = licensed, excludes archived', () => {
    const rec = assembleRecruitment({ candidates });
    expect(rec.total).toBe(2);
    expect(rec.hired).toBe(1);
    expect(rec.byStage.find((s) => s.key === 'sourced').count).toBe(1);
    expect(rec.byStage.find((s) => s.key === 'licensed').count).toBe(1);
  });
  it('empty flag when no active candidates', () => {
    expect(assembleRecruitment({ candidates: [] }).empty).toBe(true);
  });
});
