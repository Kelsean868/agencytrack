import { describe, it, expect } from 'vitest';
import { awardRowsFromLedger, deriveYearProduction } from '../ledgerProduction';
import { computeAgentAwards } from '../../utils/awardsEngine';

// H2 · docs/briefs/hero-ledger-truth.md. Awards count current-year imported
// business by its issue date (R5, amends ruling 5e). The real awards engine is
// used here, not a mock: the question is what an award actually reads.

const imported = (over) => ({
  importSource: 'oipa_import',
  newBusinessType: 'nb_ordinary',
  productLine: 'life',
  settledAPI: null, // every imported doc today
  ...over,
});

const PROFILE = { uid: 'agent-1', monthsInIndustry: 60, monthsAtTatil: 60 };

function award(rows, id, isoDate) {
  return computeAgentAwards(rows, [], PROFILE, new Date(isoDate))[id];
}

describe('awardRowsFromLedger — R5 date test', () => {
  it('an imported policy issued 2026-08-15 counts toward an August award', () => {
    const rows = awardRowsFromLedger([
      imported({ status: 'settled', dateIssued: '2026-08-15', proposedAPI: 36000 }),
    ]);
    expect(rows).toEqual([{ periodKey: '2026-08', settledAPI: 36000, settledApps: 1, selfFamilyAPI: 0, persistency: 0 }]);

    const api = award(rows, 'advisor_month_api', '2026-08-20T12:00:00');
    expect(api.criteria[0].current).toBe(36000);
    expect(api.dataSource).toBe('confirmed');
    const apps = award(rows, 'advisor_month_apps', '2026-08-20T12:00:00');
    expect(apps.criteria[0].current).toBe(1);
  });

  it('the same policy also counts toward Q3, and not toward September', () => {
    const rows = awardRowsFromLedger([
      imported({ status: 'settled', dateIssued: '2026-08-15', proposedAPI: 36000 }),
    ]);
    expect(award(rows, 'advisor_month_api', '2026-09-23T12:00:00').criteria[0].current).toBe(0);
    const q3 = computeAgentAwards(rows, [], PROFILE, new Date('2026-09-23T12:00:00'));
    const quarterly = Object.values(q3).find((a) => a.category === 'quarterly' && a.criteria[0].unit === 'TTD');
    expect(quarterly.criteria[0].current).toBe(36000);
  });

  it('an imported policy issued in 2019 counts toward nothing in 2026', () => {
    const rows = awardRowsFromLedger([
      imported({ status: 'settled', dateIssued: '2019-08-15', proposedAPI: 36000 }),
    ]);
    expect(rows.map((r) => r.periodKey)).toEqual(['2019-08']);
    const awards = computeAgentAwards(rows, [], PROFILE, new Date('2026-08-20T12:00:00'));
    for (const a of Object.values(awards)) {
      if (a.criteria[0]?.unit === 'TTD' || a.criteria[0]?.unit === 'apps') {
        expect(a.criteria[0].current, a.id).toBe(0);
      }
    }
  });

  it('never reads importSource — an organic and an imported twin produce the same row', () => {
    const base = { status: 'settled', dateIssued: '2026-08-04', proposedAPI: 5000, newBusinessType: 'nb_ordinary', productLine: 'life' };
    expect(awardRowsFromLedger([base])).toEqual(awardRowsFromLedger([imported(base)]));
  });

  it('only settled or confirmed policies count; lapsed, NTU and pending do not', () => {
    const rows = awardRowsFromLedger([
      imported({ status: 'lapsed', dateIssued: '2026-08-04', proposedAPI: 5000 }),
      imported({ status: 'ntu', dateIssued: '2026-08-04', proposedAPI: 5000 }),
      imported({ status: 'submitted', dateIssued: '2026-08-04', proposedAPI: 5000 }),
      imported({ status: 'confirmed', dateIssued: '2026-08-04', proposedAPI: 2500 }),
    ]);
    expect(rows).toEqual([{ periodKey: '2026-08', settledAPI: 2500, settledApps: 1, selfFamilyAPI: 0, persistency: 0 }]);
  });

  it('uses the R3 credit helper: an increase under TTD 2,400 earns API but no app', () => {
    const rows = awardRowsFromLedger([
      imported({ status: 'settled', dateIssued: '2026-08-04', proposedAPI: 2399, newBusinessType: 'inc_ppp' }),
    ]);
    expect(rows[0]).toMatchObject({ settledAPI: 2399, settledApps: 0 });
  });

  describe("self/family rule (Kyron, 23 Sep 2026) on Kyron's live shape", () => {
    const policies = [
      imported({ status: 'settled', dateIssued: '2026-06-30', proposedAPI: 12000 }),
      imported({ status: 'settled', dateIssued: '2026-07-31', proposedAPI: 1946.28 }),
      imported({ status: 'settled', dateIssued: '2026-08-04', proposedAPI: 36000 }),
      imported({ status: 'settled', dateIssued: '2026-08-04', proposedAPI: 36000 }),
      imported({ status: 'settled', dateIssued: '2026-08-07', proposedAPI: 1200, isSelfOrFamily: true }),
      imported({ status: 'ntu', dateIssued: '2026-07-25', proposedAPI: 36000 }),
      imported({ status: 'settled', dateIssued: '2019-05-01', proposedAPI: 5000 }),
    ];
    const NOW = '2026-09-23T12:00:00';

    it('the self/family policy is kept out of API and apps, and held in selfFamilyAPI', () => {
      const aug = awardRowsFromLedger(policies).find((r) => r.periodKey === '2026-08');
      expect(aug).toEqual({ periodKey: '2026-08', settledAPI: 72000, settledApps: 2, selfFamilyAPI: 1200, persistency: 0 });
    });

    it('Q3 awards read TTD 73,946.28 and 3 apps', () => {
      const rows = awardRowsFromLedger(policies);
      expect(award(rows, 'quarterly_api', NOW).criteria[0].current).toBeCloseTo(73946.28, 2);
      expect(award(rows, 'quarterly_apps', NOW).criteria[0].current).toBe(3);
    });

    it('every other annual award excludes it; MDRT counts it and matches the home hero', () => {
      const rows = awardRowsFromLedger(policies);
      const heroSettled = deriveYearProduction(policies, { year: 2026 }).settled.api;
      expect(heroSettled).toBe(87146.28);
      expect(award(rows, 'mdrt', NOW).criteria[0].current).toBeCloseTo(heroSettled, 2);
      expect(award(rows, 'agent_of_year', NOW).criteria[0].current).toBeCloseTo(85946.28, 2);
      expect(award(rows, 'agent_of_year', NOW).criteria[1].current).toBe(4);
      expect(award(rows, 'centurion', NOW).criteria[0].current).toBe(4);
    });

    it('a month holding ONLY a self/family policy reads 0 for the monthly award', () => {
      const rows = awardRowsFromLedger([
        imported({ status: 'settled', dateIssued: '2026-09-02', proposedAPI: 5000, isSelfOrFamily: true }),
      ]);
      expect(award(rows, 'advisor_month_api', NOW).criteria[0].current).toBe(0);
      expect(award(rows, 'advisor_month_apps', NOW).criteria[0].current).toBe(0);
      expect(award(rows, 'mdrt', NOW).criteria[0].current).toBe(5000);
    });
  });

  it('settlement rows (no selfFamilyAPI field) leave MDRT equal to annual API', () => {
    const rows = [{ periodKey: '2026-05', settledAPI: 10000, settledApps: 2, persistency: 90 }];
    expect(award(rows, 'mdrt', '2026-09-23T12:00:00').criteria[0].current).toBe(10000);
  });

  it('skips docs with no usable dateIssued and tolerates a non-array input', () => {
    expect(awardRowsFromLedger([imported({ status: 'settled', proposedAPI: 5000 })])).toEqual([]);
    expect(awardRowsFromLedger(null)).toEqual([]);
  });
});
