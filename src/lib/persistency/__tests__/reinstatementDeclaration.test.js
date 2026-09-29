/**
 * FR-6 "Mark reinstated" (Option A) — the declaration helpers and the readers
 * that show a declaration BESIDE the evidenced figure (never inside it).
 * docs/audits/fr-6-mark-reinstated-recon.md § 3 Option A; Kyron ruling R-b.
 */
import { describe, it, expect } from 'vitest';
import {
  hasLiveDeclaration,
  declarationDate,
  declarationAgeDays,
  declarationUnconfirmed,
  declarationView,
  canDeclareReinstatement,
  declarationDateLabel,
  REINSTATEMENT_UNCONFIRMED_DAYS,
  REINSTATEMENT_DECLARATION_FIELDS,
} from '../reinstatementDeclaration';
import { deriveFromLedger } from '../deriveFromLedger';
import { buildPersistencyOutlook } from '../persistencyOutlook';
import { reinstatementPlan, selectionSummary } from '../../fr/moneyModel';

// A Firestore-Timestamp-like value for a TT-local moment.
const ts = (iso) => ({ toDate: () => new Date(iso) });
// Declared 20 Sep 2026, 21:30 TT (01:30 UTC on the 21st — the TT day must win).
const DECLARED = { reinstatementDeclaredAt: ts('2026-09-21T01:30:00Z'), reinstatementDeclaredBy: 'a1', reinstatementNote: 'Receipt 4471' };

const TODAY = '2026-09-20';
function pol(n, status, api, dateIssued, extra = {}) {
  return { id: `doc-${n}`, agentId: 'a1', policyNumber: n, status, proposedAPI: api, dateIssued, productLine: 'life', isWritingAgent: true, ...extra };
}
// Same shape as moneyModel.test.js's ledger: gross 118,000, lapses 12,000 → 89.83 %.
const LEDGER = [
  pol('S1', 'settled', 100000, '2025-06-01'),
  pol('L1', 'lapsed', 5000, '2025-01-10', { ownerName: '[Client A]' }),
  pol('L2', 'lapsed', 3000, '2024-11-05'),
  pol('L4', 'lapsed', 4000, '2025-03-01'),
  pol('L3', 'lapsed', 9000, '2024-08-01'), // outside the 24-month window
  pol('L5', 'lapsed', 6000, '2025-02-01', { totalPremiumPaid: 12000 }), // cleared by 24 months' premium
];
const declare = (ledger, numbers) => ledger.map((p) => (numbers.includes(p.policyNumber) ? { ...p, ...DECLARED } : p));
const OPTS = { monthKey: '2026-09', exportDate: null };

describe('reinstatementDeclaration helpers', () => {
  it('the three Arm G fields, in one frozen list', () => {
    expect(REINSTATEMENT_DECLARATION_FIELDS).toEqual(['reinstatementDeclaredAt', 'reinstatementDeclaredBy', 'reinstatementNote']);
    expect(Object.isFrozen(REINSTATEMENT_DECLARATION_FIELDS)).toBe(true);
  });

  it('a declaration is live only while the policy is lapsed', () => {
    expect(hasLiveDeclaration({ status: 'lapsed', ...DECLARED })).toBe(true);
    // Head office moved it to settled on the next export: evidenced, the declaration is moot.
    expect(hasLiveDeclaration({ status: 'settled', ...DECLARED })).toBe(false);
    expect(hasLiveDeclaration({ status: 'lapsed' })).toBe(false);
    expect(hasLiveDeclaration({ status: 'lapsed', reinstatementDeclaredAt: null, reinstatementDeclaredBy: null })).toBe(false);
    expect(hasLiveDeclaration(null)).toBe(false);
  });

  it('dates the declaration on the TT calendar day, not the UTC day', () => {
    expect(declarationDate({ status: 'lapsed', ...DECLARED })).toBe('2026-09-20');
    expect(declarationDate({ reinstatementDeclaredAt: { seconds: Date.UTC(2026, 9, 12, 16) / 1000 } })).toBe('2026-10-12');
    expect(declarationDate({ reinstatementDeclaredAt: 'garbage' })).toBeNull();
    expect(declarationDateLabel('2026-10-12')).toBe('12 Oct 2026');
    expect(declarationDateLabel(null)).toBe('—');
  });

  it(`"not confirmed by head office" only after more than ${REINSTATEMENT_UNCONFIRMED_DAYS} days, still lapsed`, () => {
    const p = { status: 'lapsed', ...DECLARED }; // declared 2026-09-20
    expect(declarationAgeDays(p, '2026-11-19')).toBe(60);
    expect(declarationUnconfirmed(p, '2026-11-19')).toBe(false); // day 60: not yet
    expect(declarationUnconfirmed(p, '2026-11-20')).toBe(true); // day 61
    expect(declarationUnconfirmed({ ...p, status: 'settled' }, '2027-01-01')).toBe(false); // evidenced
    expect(declarationUnconfirmed(p, 'not-a-date')).toBe(false);
  });

  it('declarationView carries the date, the note and the expiry; null without a live declaration', () => {
    expect(declarationView({ status: 'lapsed', ...DECLARED }, TODAY)).toEqual({ on: '2026-09-20', by: 'a1', note: 'Receipt 4471', unconfirmed: false });
    expect(declarationView({ status: 'lapsed', ...DECLARED, reinstatementNote: '' }, TODAY).note).toBeNull();
    expect(declarationView({ status: 'lapsed' }, TODAY)).toBeNull();
  });

  it('canDeclareReinstatement mirrors Arm G: owner, agent or producing manager, lapsed', () => {
    const lapsed = { agentId: 'a1', status: 'lapsed' };
    expect(canDeclareReinstatement(lapsed, { uid: 'a1', role: 'agent' })).toBe(true);
    expect(canDeclareReinstatement({ ...lapsed, agentId: 'um1' }, { uid: 'um1', role: 'unit_manager' })).toBe(true);
    expect(canDeclareReinstatement({ ...lapsed, agentId: 'bm1' }, { uid: 'bm1', role: 'branch_manager' })).toBe(true);
    expect(canDeclareReinstatement(lapsed, { uid: 'a2', role: 'agent' })).toBe(false); // not own
    expect(canDeclareReinstatement({ ...lapsed, status: 'settled' }, { uid: 'a1', role: 'agent' })).toBe(false);
    expect(canDeclareReinstatement({ ...lapsed, agentId: 'ta1' }, { uid: 'ta1', role: 'tenant_admin' })).toBe(false);
    expect(canDeclareReinstatement({ ...lapsed, agentId: 'sm1' }, { uid: 'sm1', role: 'sales_manager' })).toBe(false);
    expect(canDeclareReinstatement(lapsed, {})).toBe(false);
  });
});

describe('deriveFromLedger — declared reinstatements sit BESIDE the evidenced figure', () => {
  it('a declaration never changes an evidenced input or the evidenced persistency', () => {
    const plain = deriveFromLedger(LEDGER, OPTS);
    const withDecl = deriveFromLedger(declare(LEDGER, ['L1', 'L2', 'L4', 'L3', 'L5']), OPTS);
    expect(withDecl.inputs).toEqual(plain.inputs);
    expect(withDecl.derived).toEqual(plain.derived);
    expect(withDecl.evidence).toEqual(plain.evidence);
    expect(withDecl.counted).toBe(plain.counted);
    expect(withDecl.atRisk).toEqual(plain.atRisk);
  });

  it('declared = the counted lapses carrying a live declaration, at the lapse’s own API', () => {
    const r = deriveFromLedger(declare(LEDGER, ['L1', 'L4']), OPTS);
    expect(r.declared.policies).toEqual(['L1', 'L4']);
    expect(r.declared.reinstatements).toBe(9000);
    // (118,000 − 12,000 + 9,000) / 118,000
    expect(r.declared.persistency).toBeCloseTo(115000 / 118000, 12);
    expect(r.derived.persistency).toBeCloseTo(106000 / 118000, 12);
  });

  it('ignores a declaration on a lapse that does not count (outside the window / cleared) and on a non-lapsed policy', () => {
    const r = deriveFromLedger(declare(LEDGER, ['L3', 'L5', 'S1']), OPTS);
    expect(r.declared.policies).toEqual([]);
    expect(r.declared.reinstatements).toBe(0);
    expect(r.declared.persistency).toBe(r.derived.persistency);
  });

  it('adds to a saved manual reinstatements input, never replacing it', () => {
    const r = deriveFromLedger(declare(LEDGER, ['L1']), { ...OPTS, manual: { reinstatements: 1000 } });
    expect(r.inputs.reinstatements).toBe(1000);
    expect(r.declared.persistency).toBeCloseTo((118000 - 12000 + 1000 + 5000) / 118000, 12);
  });

  // v3 non-negotiable 3: monotonicity is a test. Declaring one more lapse never
  // lowers "with declared", and never moves the evidenced figure.
  it('monotone: declaring one more never lowers the declared figure (random ledgers)', () => {
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const months = ['2024-12', '2025-01', '2025-04', '2025-08', '2026-02', '2026-06'];
    for (let run = 0; run < 60; run += 1) {
      const n = 2 + Math.floor(rnd() * 8);
      const ledger = Array.from({ length: n }, (_, i) => pol(
        `P${i}`,
        rnd() < 0.5 ? 'lapsed' : 'settled',
        Math.round(rnd() * 2000000) / 100 + 1,
        `${months[Math.floor(rnd() * months.length)]}-15`,
      ));
      const order = ledger.map((p) => p.policyNumber).sort(() => rnd() - 0.5);
      const base = deriveFromLedger(ledger, OPTS);
      let prev = base.declared.persistency;
      for (let k = 1; k <= order.length; k += 1) {
        const r = deriveFromLedger(declare(ledger, order.slice(0, k)), OPTS);
        expect(r.declared.persistency).toBeGreaterThanOrEqual(prev - 1e-12);
        expect(r.declared.persistency).toBeGreaterThanOrEqual(r.derived.persistency - 1e-12);
        expect(r.derived.persistency).toBe(base.derived.persistency);
        prev = r.declared.persistency;
      }
    }
  });
});

describe('outlook + FR-3 planner carry the declaration beside the evidenced figure', () => {
  it('the outlook figure carries `declared`; its evidenced persistency is unchanged', () => {
    const plain = buildPersistencyOutlook({ policies: LEDGER, today: TODAY });
    const withDecl = buildPersistencyOutlook({ policies: declare(LEDGER, ['L1']), today: TODAY });
    expect(withDecl.estimateToday.persistency).toBe(plain.estimateToday.persistency);
    expect(withDecl.estimateToday.declared.policies).toEqual(['L1']);
    expect(withDecl.estimateToday.declared.persistency).toBeGreaterThan(plain.estimateToday.persistency);
  });

  it('the planner shows two figures; the gap, presets and selection stay evidenced-only', () => {
    const plain = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
    const plan = reinstatementPlan({ policies: declare(LEDGER, ['L1', 'L4']), todayTT: TODAY });
    expect(plan.declared).toEqual({
      count: 2,
      total: 9000,
      evidencedPct: plain.estimate.persistency * 100,
      pct: (115000 / 118000) * 100,
    });
    // Evidenced figures: identical with or without the declarations.
    for (const k of ['currentPct', 'meets', 'need', 'grossSettled', 'netSettled', 'lapsesTotal', 'unitemised', 'presets', 'suggestion', 'outOfReach', 'inputs']) {
      expect(plan[k]).toEqual(plain[k]);
    }
    expect(selectionSummary(plan, ['L2'])).toEqual(selectionSummary(plain, ['L2']));
    // Rows carry the doc id and the declaration for the controls.
    const l1 = plan.lapses.find((l) => l.policyNumber === 'L1');
    expect(l1).toMatchObject({ id: 'doc-L1', agentId: 'a1', status: 'lapsed' });
    expect(l1.declaration).toEqual({ on: '2026-09-20', by: 'a1', note: 'Receipt 4471', unconfirmed: false });
    expect(plan.lapses.find((l) => l.policyNumber === 'L2').declaration).toBeNull();
  });

  it('no declaration → declared count 0 and the same percent as evidenced', () => {
    const plan = reinstatementPlan({ policies: LEDGER, todayTT: TODAY });
    expect(plan.declared.count).toBe(0);
    expect(plan.declared.pct).toBe(plan.declared.evidencedPct);
  });
});
