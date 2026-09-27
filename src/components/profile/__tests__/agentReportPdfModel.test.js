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

  // ── Persistency scale (dispatcher ruling 2026-07-27) ──
  // E3 stores a DECIMAL. The conversion is an unconditional `* 100`; it used to
  // be `v <= 1 ? v * 100 : v`, which mis-rendered the one input that breaks the
  // guess. calculations.js explicitly permits persistency > 1 (reinstatements
  // outpacing lapses) and has a test pinning that, so this is a reachable state,
  // not a hypothetical.
  describe('persistency percent conversion', () => {
    const recs = (dec) => [{ year: 2026, month: 5, persistency: dec }];

    // The PDF path (agentReportPdfModel.latestPersistencyPercent).
    const at = (dec) => buildAgentReportModel({
      submissions, settlements: [], goals, agentProfile, period: 'ytd', now,
      confirmedSettlements: [], persistency: recs(dec),
    }).persPct;

    // The CANONICAL in-app path (agentReportModel.latestPersistencyPercent),
    // which AgentReportView renders. The two modules are documented mirrors and
    // both were changed here, so both are asserted at the same boundaries —
    // testing only one is exactly how the mirrors would silently diverge.
    const atCanonical = (dec) => deriveAgentReportModel({
      submissions, settlements: [], goals, agentProfile, period: 'ytd', now,
      persistency: recs(dec),
    }).persistencyPct;

    it('converts a normal decimal — both paths', () => {
      expect(at(0.88)).toBe(88);
      expect(atCanonical(0.88)).toBe(88);
      expect(at(0.7393)).toBeCloseTo(73.93, 6); // Ricardo Duke, Tatil Feb 2026
      expect(atCanonical(0.7393)).toBeCloseTo(73.93, 6);
    });

    // THE REGRESSION. Under `v <= 1 ? v * 100 : v` this returned 1.05 → "1%",
    // understating a top performer by 100x in a head-office PDF.
    it('a persistency ABOVE 1 converts to >100%, not ~1% — both paths', () => {
      expect(at(1.05)).toBeCloseTo(105, 6);
      expect(atCanonical(1.05)).toBeCloseTo(105, 6);
      expect(at(1.2)).toBeCloseTo(120, 6);
      expect(atCanonical(1.2)).toBeCloseTo(120, 6);
    });

    // Boundary: 1.0 is exactly 100%, and was the only value the old guess got
    // right by accident.
    it('exactly 1.0 is 100% — both paths', () => {
      expect(at(1)).toBe(100);
      expect(atCanonical(1)).toBe(100);
    });

    it('null-safe on unusable input — both paths', () => {
      expect(at(undefined)).toBeNull();
      expect(atCanonical(undefined)).toBeNull();
      expect(at('n/a')).toBeNull();
      expect(atCanonical('n/a')).toBeNull();
    });

    // MIRROR LOCK — the stated contract of these two modules is that they agree.
    // Pin it directly so a one-sided edit fails here rather than in production.
    it('the PDF and canonical paths agree at every boundary', () => {
      for (const dec of [0.0, 0.5, 0.7393, 0.8, 0.9, 1, 1.05, 1.2]) {
        expect(at(dec)).toBe(atCanonical(dec));
      }
    });
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

// Company minimum on the PDF (Kyron ruling 27 Sep 2026): the tenure-resolved
// floor from resolveAnnualAPIFloor, not a hard-coded 250,000.
describe('buildAgentReportModel — company minimum', () => {
  const TENURE_CASES = [
    // [months, contractStartDate (vs now = 2026-06-15), floor, band]
    [6,  '2025-12-15', 150000, '< 1 yr'],
    [18, '2024-12-15', 200000, '1–2 yrs'],
    [30, '2023-12-15', 250000, '2–3 yrs'],
    [42, '2022-12-15', 300000, '3–4 yrs'],
    [54, '2021-12-15', 400000, '4–5 yrs'],
    [70, '2020-08-15', 500000, '5+ yrs'],
  ];

  it.each(TENURE_CASES)('%i months (start %s) → TTD %i floor, band %s', (_months, start, floor, band) => {
    const m = build({ agentProfile: { contractStartDate: start }, companyMinimums: { annualApps: 40 } });
    expect(m.companyFloor).toBe(floor);
    expect(m.companyFloorBand).toBe(band);
    expect(m.companyFloorLabel).toBe(
      `Company minimum (${band}): TTD ${floor.toLocaleString('en-TT')} · 40 apps`,
    );
  });

  it('matches the Goals wording exactly for a 2–3 yr agent', () => {
    const m = build({ agentProfile: { contractStartDate: '2023-12-15' }, companyMinimums: { annualApps: 40 } });
    expect(m.companyFloorLabel).toBe('Company minimum (2–3 yrs): TTD 250,000 · 40 apps');
  });

  it('missing contractStartDate uses the flat fallback and the unqualified label', () => {
    const m = build({ agentProfile: {}, companyMinimums: { annualApps: 40 } });
    expect(m.companyFloor).toBe(200000);
    expect(m.companyFloorBand).toBeNull();
    expect(m.companyFloorLabel).toBe('Company Floor: TTD 200,000 · 40 apps');
  });

  it('the apps figure comes from config annualApps', () => {
    const m = build({ agentProfile: { contractStartDate: '2020-08-15' }, companyMinimums: { annualApps: 45 } });
    expect(m.companyFloorApps).toBe(45);
    expect(m.companyFloorLabel).toMatch(/· 45 apps$/);
  });

  it('defaults to 40 apps when config is not loaded', () => {
    const m = build({ agentProfile: { contractStartDate: '2020-08-15' } });
    expect(m.companyFloorApps).toBe(40);
    expect(m.companyFloor).toBe(500000);
  });

  it('reads the tenure bands from config, not a second table', () => {
    const m = build({
      agentProfile: { contractStartDate: '2023-12-15' },
      companyMinimums: { annualApps: 40, tenureApiFloors: { band25_to_36: 260000 } },
    });
    expect(m.companyFloor).toBe(260000);
  });

  it('places the floor marker at the resolved floor', () => {
    const young = build({ agentProfile: { contractStartDate: '2025-12-15' } });
    const senior = build({ agentProfile: { contractStartDate: '2020-08-15' } });
    expect(senior.floorFrac / young.floorFrac).toBeCloseTo(500000 / 150000, 10);
  });
});
