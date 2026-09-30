// R2-1b commit 1 — CHARACTERIZATION of the persistency verdicts that decide
// money, BEFORE the 2-dp rule reaches them (docs/briefs/fr-round2-followups.md
// § 1, R2-1b; ruling 1). Pins today's outcome at 89.49 / 89.50 / 89.60 /
// 89.994 / 89.995 / 89.996 / 90 for:
//   • the campaign gate reading (period aggregate and final month) and the
//     binary gate band it resolves to (payout 1 = paid, 0 = DQ);
//   • the award engine's persistency criteria (Advisor of the Month, gate 90);
// The stored `meetsAwardGate` flag is pinned in
// src/services/__tests__/persistencyService.test.js (same values).
// Commit 2 changes exactly the expectations listed in the PR body's table.

import { describe, it, expect } from 'vitest';
import {
  persistencyPctForPeriod, persistencyPctAtFinalMonth, gateBandFor, normalizeGate,
} from '../campaignEngine';
import { computeAgentAwards } from '../awardsEngine';

const VALUES = [89.49, 89.5, 89.6, 89.994, 89.995, 89.996, 90];
const BINARY_90 = normalizeGate({ persistencyGate: { mode: 'binary', threshold: 90 } });

/** One month whose net / gross is exactly `pct` percent. */
function periodRecord(pct) {
  return { monthKey: '2026-11', grossSettled: 100000, netSettled: pct * 1000, lapses: 0, reinstatements: 0 };
}

describe('campaign gate reading (today)', () => {
  it('period aggregate → reading and binary-90 payout', () => {
    const rows = VALUES.map((v) => {
      const reading = persistencyPctForPeriod([periodRecord(v)], '2026-10-01', '2026-12-31');
      return `${v} → ${reading} → payout ${gateBandFor(reading, BINARY_90).payout}`;
    });
    expect(rows).toMatchInlineSnapshot(`
      [
        "89.49 → 89 → payout 0",
        "89.5 → 90 → payout 1",
        "89.6 → 90 → payout 1",
        "89.994 → 90 → payout 1",
        "89.995 → 90 → payout 1",
        "89.996 → 90 → payout 1",
        "90 → 90 → payout 1",
      ]
    `);
  });

  it('final month → reading and binary-90 payout', () => {
    const rows = VALUES.map((v) => {
      const reading = persistencyPctAtFinalMonth([{ monthKey: '2026-12', persistency: v / 100 }], '2026-12-31');
      return `${v} → ${reading} → payout ${gateBandFor(reading, BINARY_90).payout}`;
    });
    expect(rows).toMatchInlineSnapshot(`
      [
        "89.49 → 89 → payout 0",
        "89.5 → 90 → payout 1",
        "89.6 → 90 → payout 1",
        "89.994 → 90 → payout 1",
        "89.995 → 90 → payout 1",
        "89.996 → 90 → payout 1",
        "90 → 90 → payout 1",
      ]
    `);
  });
});

describe('award engine persistency criteria (today)', () => {
  it('Advisor of the Month (gate 90): the criterion and the eligibility', () => {
    const today = new Date(2026, 8, 15);
    const rows = VALUES.map((v) => {
      const confirmed = [{ periodKey: '2026-09', settledAPI: 80000, settledApps: 20, persistency: v }];
      const awards = computeAgentAwards(confirmed, [], { role: 'agent' }, today);
      const api = awards.advisor_month_api;
      const crit = api.criteria.find((c) => c.label === 'Persistency');
      return `${v} → current ${crit.current} met ${crit.met} · API award eligible ${api.eligible} · apps award eligible ${awards.advisor_month_apps.eligible}`;
    });
    expect(rows).toMatchInlineSnapshot(`
      [
        "89.49 → current 89.49 met false · API award eligible false · apps award eligible false",
        "89.5 → current 89.5 met false · API award eligible false · apps award eligible false",
        "89.6 → current 89.6 met false · API award eligible false · apps award eligible false",
        "89.994 → current 89.994 met false · API award eligible false · apps award eligible false",
        "89.995 → current 89.995 met false · API award eligible false · apps award eligible false",
        "89.996 → current 89.996 met false · API award eligible false · apps award eligible false",
        "90 → current 90 met true · API award eligible true · apps award eligible true",
      ]
    `);
  });
});
