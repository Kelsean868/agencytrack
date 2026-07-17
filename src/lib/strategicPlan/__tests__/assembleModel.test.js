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

describe('assemblePeriodMetrics (p18)', () => {
  const branchGoals = { api: 1200000, apps: 240 };

  it('quarter granularity → 4 rows; half → 2 rows', () => {
    const q = assemblePeriodMetrics({ ytdSubmissions: submissions, policies, branchGoals, roster, period: { year: YEAR, granularity: 'quarter' } });
    expect(q.rows).toHaveLength(4);
    const h = assemblePeriodMetrics({ ytdSubmissions: submissions, policies, branchGoals, roster, period: { year: YEAR, granularity: 'half' } });
    expect(h.rows).toHaveLength(2);
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
  it('groups units with head + advisors and rolls up unit net API', () => {
    const org = assembleOrgStructure({ branchUsers: roster, ytdSubmissions: submissions, policies, year: YEAR });
    expect(org.unitCount).toBe(1);
    const unit = org.units[0];
    expect(unit.headName).toBe('Trainee Tom');
    expect(unit.advisorCount).toBe(1);
    expect(unit.ytdNetApi).toBe(8000); // head um1 (2000) + agent ag1 (6000)
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
