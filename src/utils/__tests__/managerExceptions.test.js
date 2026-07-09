// Value-level tests for the exception-derivation engine. Uses the REAL canonical
// helpers (extractTotalProductionCredit + resolveAnnualAPIFloor) — no mocks — so
// the assertions pin the exact classification the overview will show.
import { describe, it, expect } from 'vitest';
import { deriveExceptions, yearFraction, FLOOR_PACE_DANGER, FLOOR_PACE_WARN } from '../managerExceptions';

// Fixed mid-year date → deterministic pace fraction (~0.4986 of the year).
const NOW = new Date(2026, 6, 2); // 2 Jul 2026 (local — engine uses UTC internally)
const LATEST = '2026-06-28';
const PRIOR = '2026-06-07';

// Missing contractStartDate → flat 200,000 annual floor (FLAT_ANNUAL_API_FALLBACK).
// expectedByNow ≈ 200,000 × 0.4986 ≈ 99,726.
const sub = (agentId, weekStarting, apiSold) => ({ agentId, weekStarting, apiSold });

const users = [
  { id: 'a_below', role: 'agent' },
  { id: 'a_offpace', role: 'agent' },
  { id: 'a_onpace', role: 'agent' },
  { id: 'a_late', role: 'agent' },
  { id: 'a_never', role: 'agent' },
  { id: 'um1', role: 'unit_manager' }, // a manager — must be ignored
];

const subs = [
  sub('a_below', LATEST, 30000), // 0.30 of pace → danger floor
  sub('a_offpace', LATEST, 80000), // 0.80 of pace → warning pace
  sub('a_onpace', LATEST, 120000), // 1.20 of pace + filed latest → not flagged
  sub('a_late', PRIOR, 120000), // pace ok but missed latest week → report late
  // a_never: no submissions
  sub('um1', LATEST, 5), // manager submission — ignored
];

const scopeIds = new Set(['a_below', 'a_offpace', 'a_onpace', 'a_late', 'a_never', 'um1']);

describe('yearFraction', () => {
  it('is 0..1 and mid-year is ~0.5', () => {
    expect(yearFraction(new Date(2026, 0, 1))).toBeCloseTo(0, 2);
    expect(yearFraction(new Date(2026, 6, 2))).toBeGreaterThan(0.45);
    expect(yearFraction(new Date(2026, 6, 2))).toBeLessThan(0.55);
    expect(yearFraction(new Date(2026, 11, 31))).toBeGreaterThan(0.99);
  });
});

describe('deriveExceptions — classification', () => {
  const result = deriveExceptions({ users, subs, companyMins: null, scopeIds, now: NOW });

  it('flags exactly the four agents that are behind pace or missing reports', () => {
    expect(result).toHaveLength(4);
    const ids = result.map((e) => e.agentId);
    expect(ids).toContain('a_below');
    expect(ids).toContain('a_offpace');
    expect(ids).toContain('a_late');
    expect(ids).toContain('a_never');
  });

  it('never flags the on-pace agent or a manager', () => {
    const ids = result.map((e) => e.agentId);
    expect(ids).not.toContain('a_onpace');
    expect(ids).not.toContain('um1');
  });

  it('classifies critically-behind as a danger floor exception', () => {
    const e = result.find((x) => x.agentId === 'a_below');
    expect(e.type).toBe('floor');
    expect(e.tone).toBe('danger');
    expect(e.kind).toBe('Below floor');
    expect(e.ytdApi).toBe(30000);
    expect(e.floor).toBe(200000);
  });

  it('classifies behind-but-not-critical as a warning pace exception', () => {
    const e = result.find((x) => x.agentId === 'a_offpace');
    expect(e.type).toBe('pace');
    expect(e.tone).toBe('warning');
    expect(e.kind).toBe('Off pace');
  });

  it('classifies an active filer who missed the latest week as report late', () => {
    const e = result.find((x) => x.agentId === 'a_late');
    expect(e.type).toBe('report');
    expect(e.kind).toBe('Report late');
    expect(e.tone).toBe('warning');
  });

  it('classifies an agent with no reports as a report gap', () => {
    const e = result.find((x) => x.agentId === 'a_never');
    expect(e.type).toBe('report');
    expect(e.kind).toBe('No reports');
  });

  it('sorts danger first, then by severity', () => {
    expect(result[0].agentId).toBe('a_below');
    expect(result[0].tone).toBe('danger');
    // remaining are all warnings, danger leads
    expect(result.slice(1).every((e) => e.tone === 'warning')).toBe(true);
  });

  it('builds a spark (recent API trajectory) for each flagged agent', () => {
    const e = result.find((x) => x.agentId === 'a_below');
    expect(Array.isArray(e.spark)).toBe(true);
    expect(e.spark).toEqual([30000]);
  });
});

describe('deriveExceptions — thresholds', () => {
  it('exposes the pace thresholds used', () => {
    expect(FLOOR_PACE_DANGER).toBe(0.5);
    expect(FLOOR_PACE_WARN).toBe(0.85);
  });

  it('respects scope — an out-of-scope agent is never flagged', () => {
    const scoped = new Set(['a_below']); // only a_below in scope
    const r = deriveExceptions({ users, subs, companyMins: null, scopeIds: scoped, now: NOW });
    expect(r).toHaveLength(1);
    expect(r[0].agentId).toBe('a_below');
  });

  it('returns an empty list when there are no agents', () => {
    expect(deriveExceptions({ users: [{ id: 'm', role: 'branch_manager' }], subs, now: NOW })).toEqual([]);
  });

  it('does not flag a healthy filer (on pace + filed latest week)', () => {
    const r = deriveExceptions({
      users: [{ id: 'a_onpace', role: 'agent' }],
      subs: [sub('a_onpace', LATEST, 120000)],
      now: NOW,
    });
    expect(r).toEqual([]);
  });

  it('uses the tenure floor from contractStartDate (higher floor → more behind)', () => {
    // >60 months of service → 500,000 annual floor; 30k YTD is deeply behind.
    const r = deriveExceptions({
      users: [{ id: 'veteran', role: 'agent', contractStartDate: '2018-01-01' }],
      subs: [sub('veteran', LATEST, 30000)],
      now: NOW,
    });
    expect(r[0].floor).toBe(500000);
    expect(r[0].type).toBe('floor');
  });
});
