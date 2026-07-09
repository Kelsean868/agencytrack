// Value-level tests for buildManagerReportModel — the pure normaliser behind
// the Branch/Unit PDFs. It only shapes rows the view already derived; no math.
import { describe, it, expect } from 'vitest';
import { buildManagerReportModel } from '../managerReportModel';

describe('buildManagerReportModel — branch scope', () => {
  const input = {
    scope: 'branch',
    orgLabel: 'South Branch',
    managerName: 'Trevor',
    period: 'ytd',
    periodLabel: 'Year to date',
    totals: { totalApi: 100000, totalApps: 20, agentCount: 5, unitCount: 2, avgApiPerAgent: 20000 },
    units: [
      { id: 'u1', name: 'S·01', value: 30000, secondaryValue: 3 },
      { id: 'u2', name: 'S·02', value: 10000, secondaryValue: 2 },
    ],
    roster: [
      { rank: 1, agentName: 'Alice', unitName: 'S·01', totals: { totalApi: 50000, totalApps: 10 } },
      { rank: 2, agentName: 'Bob', totals: { totalApi: 30000, totalApps: 6 } },
      { rank: 3, agentName: 'Cara', totals: { totalApi: 20000, totalApps: 4 } },
    ],
    compliance: { submitted: 4, total: 5, percent: 80 },
  };

  it('passes totals through unchanged', () => {
    const m = buildManagerReportModel(input);
    expect(m.totals.totalApi).toBe(100000);
    expect(m.totals.agentCount).toBe(5);
    expect(m.totals.unitCount).toBe(2);
    expect(m.totals.avgApiPerAgent).toBe(20000);
  });

  it('normalises RankedLeaderboard-style unit entries (value → avgApiPerAgent)', () => {
    const m = buildManagerReportModel(input);
    expect(m.units).toHaveLength(2);
    expect(m.units[0]).toMatchObject({ name: 'S·01', avgApiPerAgent: 30000, agentCount: 3 });
    expect(m.unitTotalApiMax).toBe(30000);
  });

  it('normalises roster (agentName → name, totals.totalApi → totalApi) and keeps rank order', () => {
    const m = buildManagerReportModel(input);
    expect(m.roster[0]).toMatchObject({ rank: 1, name: 'Alice', unit: 'S·01', totalApi: 50000, totalApps: 10 });
    expect(m.roster[1]).toMatchObject({ name: 'Bob', totalApi: 30000 });
    expect(m.maxApi).toBe(50000);
  });

  it('top performers = first three roster rows', () => {
    const m = buildManagerReportModel(input);
    expect(m.topPerformers.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Cara']);
  });

  it('normalises compliance', () => {
    const m = buildManagerReportModel(input);
    expect(m.compliance).toEqual({ submitted: 4, total: 5, percent: 80 });
  });
});

describe('buildManagerReportModel — roster cap + unit scope', () => {
  it('caps the visible roster at 12 and reports the hidden count', () => {
    const roster = Array.from({ length: 15 }, (_, i) => ({
      rank: i + 1, name: `Agent ${i + 1}`, totalApi: 15000 - i * 100, totalApps: 3,
    }));
    const m = buildManagerReportModel({ scope: 'branch', roster });
    expect(m.visibleRoster).toHaveLength(12);
    expect(m.hiddenCount).toBe(3);
    expect(m.roster).toHaveLength(15);
  });

  it('unit scope carries rank/count and no units array requirement', () => {
    const m = buildManagerReportModel({
      scope: 'unit', orgLabel: "Marsha's Unit", periodLabel: 'This week',
      totals: { totalApi: 40000, totalApps: 8, agentCount: 3, avgApiPerAgent: 13333 },
      roster: [{ rank: 1, name: 'X', totalApi: 40000, totalApps: 8 }],
      unitRank: 2, unitCount: 3,
    });
    expect(m.scope).toBe('unit');
    expect(m.unitRank).toBe(2);
    expect(m.unitCount).toBe(3);
    expect(m.totals.unitCount).toBeNull();
  });

  it('empty input never throws and yields safe defaults', () => {
    const m = buildManagerReportModel();
    expect(m.roster).toEqual([]);
    expect(m.maxApi).toBe(1);
    expect(m.compliance).toBeNull();
    expect(m.topPerformers).toEqual([]);
  });
});
