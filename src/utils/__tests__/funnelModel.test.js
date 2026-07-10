import { describe, it, expect } from 'vitest';
import {
  FUNNEL_GROUPS, FUNNEL_COLS, FUNNEL_TOGGLABLE_IDS,
  computeFunnelRow, funnelView, computeInterviewsKept, computeFunnelTotals,
} from '../funnelModel';
import { computeTotalNewNames } from '../extractFields';

// A representative extractFields()-shaped fields object. Distinct, non-colliding
// values per field so a sum can only match if the RIGHT fields were added.
const F = {
  // ① Prospecting
  prospectingLettersSent: 10,
  seminarsConducted: 2,
  coldCalls: 40,
  referralCalls: 15,
  // ② Contact Attempts (FLAGGED-A)
  followUpCalls: 7,
  seminarTradeshowCalls: 3,
  f2fAttempts: 25,
  // ③ Contacts Made
  telContacts: 45,
  f2fContacts: 12,
  // ④ QA
  qualifiedApproaches: 20,
  // ⑤ FFIs
  ffisScheduled: 12,
  ffiConducted: 9,
  // ⑥ CIs
  newCIBooked: 6,
  oldCIBooked: 4,
  ciConducted: 8,
  // ⑦ Results
  applicationsSold: 3,
  livesSold: 5,
  // ⑧ Referrals — the 5 canonical New-Names channels
  referralsObtained: 8,
  namesFromColdCanvass: 5,
  namesFromSeminarsConducted: 1,
  namesFromTradeshowsAttended: 0,
  namesFromOther: 2,
  // excluded from ALL funnel sums
  serviceCalls: 99,
};
// API comes from the raw submission via extractTotalProductionCredit.
const SUB = { totalProductionCredit: 12500 };

describe('funnelModel — computeFunnelRow stage sums', () => {
  const v = computeFunnelRow(F, SUB);

  it('① Prospecting Total = the 4 locked fields (letters + seminars + coldCanv + refCalls)', () => {
    expect(v.letters).toBe(10);
    expect(v.seminars).toBe(2);
    expect(v.canvass).toBe(40);   // coldCalls
    expect(v.refCalls).toBe(15);
    expect(v.pTot).toBe(10 + 2 + 40 + 15); // 67
    expect(v.pTot).toBe(v.letters + v.seminars + v.canvass + v.refCalls);
  });

  it('FLAGGED-A: followUpCalls counts in Contact Attempts (Tel), NOT in Prospecting', () => {
    // Tel attempts = followUpCalls + seminarTradeshowCalls.
    expect(v.telAtt).toBe(7 + 3); // 10
    expect(v.caTot).toBe(v.telAtt + v.f2fAtt);
    expect(v.caTot).toBe(10 + 25); // 35
    // Prospecting must NOT include follow-ups — removing followUpCalls from the
    // input leaves the Prospecting total unchanged.
    const noFollowUps = computeFunnelRow({ ...F, followUpCalls: 0 }, SUB);
    expect(noFollowUps.pTot).toBe(v.pTot);          // Prospecting unaffected
    expect(noFollowUps.telAtt).toBe(v.telAtt - 7);  // Contact Attempts drops
  });

  it('③ Contacts Made Total = telContacts + f2fContacts', () => {
    expect(v.telCon).toBe(45);
    expect(v.f2fCon).toBe(12);
    expect(v.cmTot).toBe(45 + 12); // 57
  });

  it('④ Qualified Approaches is the standalone KPI value', () => {
    expect(v.qa).toBe(20);
  });

  it('⑤ FFIs — Sched + Conducted(KPI)', () => {
    expect(v.ffiSch).toBe(12);
    expect(v.ffiCond).toBe(9);
  });

  it('⑥ CIs — New/Old Booked + Conducted(KPI)', () => {
    expect(v.ciNew).toBe(6);
    expect(v.ciOld).toBe(4);
    expect(v.ciCond).toBe(8);
  });

  it('⑦ Results — Apps + Lives + API(terminal, from extractTotalProductionCredit)', () => {
    expect(v.apps).toBe(3);
    expect(v.lives).toBe(5);
    expect(v.api).toBe(12500);
  });

  it('FLAGGED-B: Referrals group Total === computeTotalNewNames, decomposed without double-count', () => {
    const canonical = computeTotalNewNames(F);
    expect(v.refTot).toBe(canonical);                       // group Total == canonical
    expect(v.refs).toBe(8);                                 // referralsObtained
    expect(v.newNames).toBe(canonical - 8);                 // the 4 OTHER channels
    expect(v.refs + v.newNames).toBe(v.refTot);             // sub-columns sum to Total exactly
    // canonical = 5 + 8 + 1 + 0 + 2 = 16
    expect(v.refTot).toBe(16);
    expect(v.newNames).toBe(8);
  });

  it('serviceCalls appears in NO funnel sum (servicing ≠ new-business activity)', () => {
    // No funnel COLUMN maps to serviceCalls.
    expect(FUNNEL_COLS.some((c) => c.key === 'serviceCalls')).toBe(false);
    // It is carried on the row (data path preserved for detail surfaces)…
    expect(v.serviceCalls).toBe(99);
    // …but changing it moves NO funnel KPI / total.
    const bumped = computeFunnelRow({ ...F, serviceCalls: 9999 }, SUB);
    for (const c of FUNNEL_COLS) {
      expect(bumped[c.key]).toBe(v[c.key]);
    }
  });
});

describe('funnelModel — team totals & Interviews Kept', () => {
  it('computeFunnelTotals sums each column across rows', () => {
    const rows = [computeFunnelRow(F, SUB), computeFunnelRow(F, SUB)];
    const tot = computeFunnelTotals(rows);
    expect(tot.pTot).toBe(67 * 2);
    expect(tot.caTot).toBe(35 * 2);
    expect(tot.refTot).toBe(16 * 2);
    expect(tot.api).toBe(12500 * 2);
  });

  it('Interviews Kept = FFI Conducted + CI Conducted across rows', () => {
    const rows = [computeFunnelRow(F, SUB), computeFunnelRow(F, SUB)];
    expect(computeInterviewsKept(rows)).toBe((9 + 8) * 2); // 34
  });
});

describe('funnelModel — funnelView collapse/expand', () => {
  it('collapsed default (empty Set) shows only KPI column(s) per group', () => {
    const view = funnelView(new Set());
    for (const g of view.groups) {
      // QA is always open (single standalone KPI); others collapse to KPI only.
      if (g.id === 'qa') {
        expect(g.open).toBe(true);
        expect(g.vcols).toHaveLength(1);
      } else {
        expect(g.open).toBe(false);
        expect(g.vcols.every((c) => c.kpi)).toBe(true);
        const kpiCount = g.cols.filter((c) => c.kpi).length;
        expect(g.vcols).toHaveLength(kpiCount);
      }
    }
  });

  it('expanding a stage reveals all its sub-columns in place', () => {
    const view = funnelView(new Set(['p']));
    const p = view.groups.find((g) => g.id === 'p');
    expect(p.open).toBe(true);
    expect(p.vcols.map((c) => c.key)).toEqual(['letters', 'seminars', 'canvass', 'refCalls', 'pTot']);
    // A non-expanded neighbour stays collapsed to its KPI.
    const ca = view.groups.find((g) => g.id === 'ca');
    expect(ca.vcols.map((c) => c.key)).toEqual(['caTot']);
  });

  it('QA has no toggle (not in FUNNEL_TOGGLABLE_IDS); every other stage does', () => {
    expect(FUNNEL_TOGGLABLE_IDS).not.toContain('qa');
    expect(FUNNEL_TOGGLABLE_IDS).toHaveLength(FUNNEL_GROUPS.length - 1);
  });

  it('every group closes with its KPI (parts → outcome)', () => {
    for (const g of FUNNEL_GROUPS) {
      const last = g.cols[g.cols.length - 1];
      expect(last.kpi).toBe(true);
    }
  });
});
