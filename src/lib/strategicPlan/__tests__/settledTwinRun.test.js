import { describe, it, expect } from 'vitest';
import { periodSettlement, periodSettlementByAgent } from '../settledTwinRun';
import { yearWindow, periodWindows } from '../periodModel';

// Policy fixtures. dateIssued as a JS Date (settledTwinRun coerces Date | Timestamp | string).
const settledInQ1 = { agentId: 'a', status: 'settled', settledAPI: 5000, dateIssued: new Date('2026-03-15T00:00:00Z') };
// Settled THEN lapsed within Q1 — lapse preserves settledAPI + dateIssued (rules:465-472).
const lapsedInQ1  = { agentId: 'a', status: 'lapsed',  settledAPI: 2000, dateIssued: new Date('2026-03-20T00:00:00Z'), dateLapsed: new Date('2026-03-25T00:00:00Z') };
const settledInQ4 = { agentId: 'a', status: 'settled', settledAPI: 9999, dateIssued: new Date('2026-11-01T00:00:00Z') };
const submittedNoDate = { agentId: 'a', status: 'submitted', proposedAPI: 1000, dateIssued: null };
const settledOtherAgent = { agentId: 'b', status: 'settled', settledAPI: 800, dateIssued: new Date('2026-03-10T00:00:00Z') };

const q1 = periodWindows({ year: 2026, granularity: 'quarter' })[0];

describe('settledTwinRun — Gross/Net twin-run (RULING 2)', () => {
  it('Net excludes lapsed; Gross includes lapsed (settled-then-lapsed policy)', () => {
    const { net, gross } = periodSettlement([settledInQ1, lapsedInQ1], q1);
    // SMOKE ASSERTION #1 (unit level): the lapsed policy is in Gross but NOT Net.
    expect(net.api).toBe(5000);   // only the still-settled policy
    expect(net.apps).toBe(1);
    expect(gross.api).toBe(7000); // 5000 settled + 2000 ever-settled (lapsed)
    expect(gross.apps).toBe(2);
  });

  it('filters by dateIssued to the plan period', () => {
    const { net, gross } = periodSettlement([settledInQ1, settledInQ4], q1);
    expect(net.api).toBe(5000);   // Q4 policy excluded from a Q1 window
    expect(gross.api).toBe(5000);
  });

  it('ignores policies with no dateIssued (never settled)', () => {
    const { net, gross } = periodSettlement([submittedNoDate], q1);
    expect(net.api).toBe(0);
    expect(gross.api).toBe(0);
  });

  it('full-year window captures all in-year settlements', () => {
    const fy = yearWindow(2026);
    const { net, gross } = periodSettlement([settledInQ1, lapsedInQ1, settledInQ4], fy);
    expect(net.api).toBe(5000 + 9999);
    expect(gross.api).toBe(5000 + 2000 + 9999);
  });

  it('groups per agent with the identical twin-run', () => {
    const byAgent = periodSettlementByAgent([settledInQ1, lapsedInQ1, settledOtherAgent], q1);
    expect(byAgent.a.net.api).toBe(5000);
    expect(byAgent.a.gross.api).toBe(7000);
    expect(byAgent.b.net.api).toBe(800);
    expect(byAgent.b.gross.api).toBe(800);
  });

  it('handles Firestore-Timestamp-shaped dateIssued (toDate())', () => {
    const ts = { toDate: () => new Date('2026-02-01T00:00:00Z') };
    const { net } = periodSettlement([{ agentId: 'a', status: 'settled', settledAPI: 100, dateIssued: ts }], q1);
    expect(net.api).toBe(100);
  });
});
