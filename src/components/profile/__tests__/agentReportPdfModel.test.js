// Value-level tests for buildAgentReportModel — the pure derivation behind the
// refined Agent PDF. Proves the PDF reads its canonical numbers through the
// SAME deriveAgentReportModel path AgentReportView uses (no second math path).
import { describe, it, expect } from 'vitest';
import { buildAgentReportModel } from '../agentReportPdfModel';
import { deriveAgentReportModel } from '../agentReportModel';

const now = new Date('2026-06-15T12:00:00Z');

const submissions = [
  {
    status: 'submitted', weekStarting: '2026-06-07',
    newBusiness: { api: 20000, apps: 2 },
    pppIncreases: { apiIncrease: 5000, apps: 1 },
    lumpsums: { apiCredit: 1000 },
    applicationsSold: 3,
    telContacts: 40, appointmentsSet: 15, f2fContacts: 10,
    ffiConducted: 8, ciConducted: 6, qualifiedApproaches: 12,
    solutionPresentations: 7, totalTelAttempts: 60, f2fAttempts: 12,
    referralsObtained: 5,
  },
  {
    status: 'submitted', weekStarting: '2026-05-31',
    newBusiness: { api: 15000, apps: 1 },
    applicationsSold: 1,
    telContacts: 30, appointmentsSet: 10,
    ffiConducted: 5, ciConducted: 4, qualifiedApproaches: 8,
    totalTelAttempts: 50, f2fAttempts: 10,
  },
  // draft — MUST be ignored by every YTD number
  { status: 'draft', weekStarting: '2026-06-07', newBusiness: { api: 999999 } },
];

const goals = { annualAPI: 600000 };
const persistency = [{ year: 2026, month: 5, persistency: 0.88 }];
const agentProfile = { contractStartDate: '2020-01-01', agentNumber: '8821', monthsInIndustry: 14 };

function build(extra = {}) {
  return buildAgentReportModel({
    agentInfo: { displayName: 'Marsha Singh', role: 'Senior Associate' },
    submissions, goals, weekRange: 'year',
    confirmedSettlements: [], agentProfile, persistency, now,
    ...extra,
  });
}

describe('buildAgentReportModel — reuses deriveAgentReportModel', () => {
  it('embeds the shared model and hero/apps agree with deriveAgentReportModel', () => {
    const m = build();
    const shared = deriveAgentReportModel({
      submissions, settlements: [], goals, persistency, agentProfile, period: 'ytd', now,
    });
    expect(m.heroPrimaryAPI).toBe(shared.heroPrimaryAPI);
    expect(m.heroApps).toBe(shared.heroApps);
    expect(m.model.ytdAPI).toBe(shared.ytdAPI);
    expect(m.model.ratios).toEqual(shared.ratios);
    expect(m.model.trajectory).toEqual(shared.trajectory);
    expect(m.model.windows.ytd.totalApi).toBe(shared.windows.ytd.totalApi);
  });

  it('YTD API excludes drafts and sums the two submitted weeks (41,000)', () => {
    const m = build();
    // 20000+5000+1000 + 15000 = 41000
    expect(m.model.ytdAPI).toBe(41000);
    expect(m.heroEyebrow).toBe('YTD API · Submitted');
  });

  it('production breakdown YTD row sums NB + PPP + LMPS through the same fields', () => {
    const m = build();
    const ytdRow = m.bdRows.find((r) => r.label === 'This year');
    expect(ytdRow.nbApi).toBe(35000);   // 20000 + 15000
    expect(ytdRow.pppInc).toBe(5000);
    expect(ytdRow.lmpsCredit).toBe(1000);
    expect(ytdRow.total).toBe(41000);
  });

  it('goal donut % derives from heroPrimaryAPI / annual goal', () => {
    const m = build();
    // 41000 / 600000 = 6.83% → 7
    expect(m.goalPct).toBe(7);
    expect(m.ytdAPIGoal).toBe(600000);
  });

  it('carries cover meta (persistency, agent #, months, name)', () => {
    const m = build();
    expect(m.displayName).toBe('Marsha Singh');
    expect(m.persPct).toBe(88);
    expect(m.agentNumber).toBe('8821');
    expect(m.monthsInService).toBe(14);
  });

  it('career level derives from effective YTD (41k → L1 Salesperson)', () => {
    const m = build();
    expect(m.currentLevel.level).toBe(1);
    expect(m.nextLevel.level).toBe(2);
  });
});

describe('buildAgentReportModel — settlements flip the hero to Settled', () => {
  it('with confirmed settlements, hero reads settled API + settled apps', () => {
    const settlements = [
      { periodKey: '2026-05', settledAPI: 30000, settledApps: 4, confirmedByName: 'Mgr', confirmedAt: new Date('2026-06-01') },
    ];
    const m = build({ confirmedSettlements: settlements });
    expect(m.hasSettlements).toBe(true);
    expect(m.heroEyebrow).toBe('YTD API · Settled');
    expect(m.heroPrimaryAPI).toBe(30000);
    // effective YTD = settled 30k (May confirmed) + pending June submitted 26k
    expect(m.effectiveYTD_API).toBe(30000 + 26000);
    expect(m.settlementRows).toHaveLength(1);
  });
});

describe('buildAgentReportModel — empty input never throws', () => {
  it('handles no submissions', () => {
    const m = buildAgentReportModel({ agentInfo: { displayName: 'X' }, submissions: [], confirmedSettlements: [], now });
    expect(m.model.ytdAPI).toBe(0);
    expect(m.bdRows).toHaveLength(3);
    expect(m.goalPct).toBeNull();
    expect(m.currentLevel.level).toBe(1);
  });
});
