import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProjectedBonus } from '../financingProjectedBonus';

// ── Service mocks ─────────────────────────────────────────────────────────────
vi.mock('../../services/financingService', () => ({
  getFinancingTerms: vi.fn(),
}));
vi.mock('../../services/policiesService', () => ({
  getOwnPolicies: vi.fn(),
}));
vi.mock('../../services/persistencyService', () => ({
  getPersistencyForAgent: vi.fn(),
}));
vi.mock('../../utils/dateInputs', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getTodayTT: vi.fn() };
});

import { getFinancingTerms } from '../../services/financingService';
import { getOwnPolicies } from '../../services/policiesService';
import { getPersistencyForAgent } from '../../services/persistencyService';
import { getTodayTT } from '../../utils/dateInputs';

// Build a mock Firestore Timestamp from a YYYY-MM-DD string (TT midnight = 04:00 UTC).
const makeTs = (dateStr) => ({
  toDate: () => new Date(`${dateStr}T04:00:00Z`),
});

const BASE_TERMS = {
  effectiveDate: '2026-01-15',
  financingStatus: 'on_financing',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default today: 2026-02-10 (month 2026_02 — still Q1 of year 1)
  getTodayTT.mockReturnValue('2026-02-10');
  getPersistencyForAgent.mockResolvedValue(null);
  getOwnPolicies.mockResolvedValue([]);
});

// ── Null when no financing terms ──────────────────────────────────────────────

describe('getProjectedBonus — no terms', () => {
  it('returns null when getFinancingTerms returns null', async () => {
    getFinancingTerms.mockResolvedValue(null);
    expect(await getProjectedBonus('t1', 'a1')).toBeNull();
  });

  it('returns null when terms has no effectiveDate', async () => {
    getFinancingTerms.mockResolvedValue({ financingStatus: 'on_financing' });
    expect(await getProjectedBonus('t1', 'a1')).toBeNull();
  });
});

// ── Agreement-position derivation ────────────────────────────────────────────

describe('getProjectedBonus — yearInAgreement + quarter derivation', () => {
  it('effective 2026-01, today 2026-02 → year 1 Q1', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01' });
    getTodayTT.mockReturnValue('2026-02-01');
    const out = await getProjectedBonus('t1', 'a1');
    expect(out.yearInAgreement).toBe(1);
    expect(out.quarter).toBe(1);
  });

  it('effective 2026-01, today 2026-05 → year 1 Q2', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01' });
    getTodayTT.mockReturnValue('2026-05-01');
    const out = await getProjectedBonus('t1', 'a1');
    expect(out.yearInAgreement).toBe(1);
    expect(out.quarter).toBe(2);
  });

  it('effective 2026-01, today 2027-01 → year 2 Q1', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01' });
    getTodayTT.mockReturnValue('2027-01-01');
    const out = await getProjectedBonus('t1', 'a1');
    expect(out.yearInAgreement).toBe(2);
    expect(out.quarter).toBe(1);
  });

  it('yearInAgreement capped at 2', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2024-01-01' });
    getTodayTT.mockReturnValue('2028-01-01'); // 4 years in
    const out = await getProjectedBonus('t1', 'a1');
    expect(out.yearInAgreement).toBe(2);
  });
});

// ── Q1 submitted-basis: proposedAPI used for all non-lapsed policies ──────────

describe('getProjectedBonus — Q1 submitted-basis', () => {
  it('uses proposedAPI as the amount for submitted policies in Q1', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01' });
    getTodayTT.mockReturnValue('2026-02-01');
    getOwnPolicies.mockResolvedValue([
      {
        status: 'submitted',
        newBusinessType: 'nb_ordinary',
        proposedAPI: '50000',
        settledAPI: null,
        isSelfOrFamily: false,
        dateSubmitted: makeTs('2026-01-20'),
      },
    ]);
    getPersistencyForAgent.mockResolvedValue({ persistency: 0.96 });

    const out = await getProjectedBonus('t1', 'a1');
    // Q1 exception: no persistency gate. gross = 50000, qualifies on gross gate alone (≥ 37500).
    expect(out.result.gates.isQ1Exception).toBe(true);
    expect(out.result.gates.qualified).toBe(true);
    expect(out.result.gross).toBeCloseTo(50000);
    // Bonus = (consistencyRate + productionRateY1) × net_persistency
    // net_persistency = gross (no lapses) = 50000
    // consistency = 0.15 × 50000 = 7500; production = 0.15 × 50000 = 7500; total = 15000
    expect(out.result.consistencyBonus + out.result.productionBonus).toBeCloseTo(15000);
    expect(out.takeHome.gross).toBeCloseTo(15000);
    expect(out.takeHome.isOwing).toBe(true);
  });
});

// ── Q2+ settled-basis: only settled policies, settledAPI ─────────────────────

describe('getProjectedBonus — Q2+ settled-basis', () => {
  it('includes only settled policies in Q2; uses settledAPI', async () => {
    // Q2: months 4-6 from effective (2026-01 → Q2 start: 2026-04)
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01' });
    getTodayTT.mockReturnValue('2026-05-01');
    getOwnPolicies.mockResolvedValue([
      // settled in Q2 — should be included
      {
        status: 'settled',
        newBusinessType: 'nb_ordinary',
        proposedAPI: '30000',
        settledAPI: '28000',
        isSelfOrFamily: false,
        dateSubmitted: makeTs('2026-04-10'),
      },
      // submitted (not settled) in Q2 — excluded in Q2
      {
        status: 'submitted',
        newBusinessType: 'nb_ordinary',
        proposedAPI: '20000',
        settledAPI: null,
        isSelfOrFamily: false,
        dateSubmitted: makeTs('2026-04-15'),
      },
    ]);
    getPersistencyForAgent.mockResolvedValue({ persistency: 0.92 });

    const out = await getProjectedBonus('t1', 'a1');
    expect(out.quarter).toBe(2);
    // Only the settled policy's settledAPI = 28000 is included
    expect(out.result.gross).toBeCloseTo(28000);
  });

  it('policies outside the quarter date range are excluded', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01' });
    getTodayTT.mockReturnValue('2026-05-01');
    getOwnPolicies.mockResolvedValue([
      // Q1 policy (2026-02) — outside Q2 range, excluded
      {
        status: 'settled',
        newBusinessType: 'nb_ordinary',
        proposedAPI: '40000',
        settledAPI: '38000',
        isSelfOrFamily: false,
        dateSubmitted: makeTs('2026-02-01'),
      },
    ]);
    getPersistencyForAgent.mockResolvedValue({ persistency: 0.92 });

    const out = await getProjectedBonus('t1', 'a1');
    expect(out.result.gross).toBe(0); // no policies in range
  });
});

// ── Take-home wiring ──────────────────────────────────────────────────────────

describe('getProjectedBonus — take-home wiring', () => {
  it('passes financingStatus + grossBonus to computeTakeHome; result is isOwing=true for on_financing', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01', financingStatus: 'on_financing' });
    getTodayTT.mockReturnValue('2026-02-01');
    getOwnPolicies.mockResolvedValue([
      {
        status: 'submitted',
        newBusinessType: 'nb_ordinary',
        proposedAPI: '50000',
        settledAPI: null,
        isSelfOrFamily: false,
        dateSubmitted: makeTs('2026-01-10'),
      },
    ]);
    getPersistencyForAgent.mockResolvedValue({ persistency: 0.96 });

    const out = await getProjectedBonus('t1', 'a1');
    expect(out.takeHome.isOwing).toBe(true);
    expect(out.takeHome.takeHome).toBeCloseTo(out.takeHome.net * 0.50);
  });

  it('not_on_financing → isOwing=false, no financing deduction', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01', financingStatus: 'not_on_financing' });
    getTodayTT.mockReturnValue('2026-02-01');
    getOwnPolicies.mockResolvedValue([]);
    const out = await getProjectedBonus('t1', 'a1');
    expect(out.takeHome.isOwing).toBe(false);
    expect(out.takeHome.financingPortion).toBe(0);
  });
});

// ── Persistency absent → gate fails gracefully ──────────────────────────────

describe('getProjectedBonus — missing persistency', () => {
  it('no persistency doc → engine receives no persistency → Q2 gate fails (qualified=false)', async () => {
    getFinancingTerms.mockResolvedValue({ ...BASE_TERMS, effectiveDate: '2026-01-01' });
    getTodayTT.mockReturnValue('2026-05-01'); // Q2
    getOwnPolicies.mockResolvedValue([
      {
        status: 'settled', newBusinessType: 'nb_ordinary',
        proposedAPI: '50000', settledAPI: '50000', isSelfOrFamily: false,
        dateSubmitted: makeTs('2026-04-10'),
      },
    ]);
    getPersistencyForAgent.mockResolvedValue(null);

    const out = await getProjectedBonus('t1', 'a1');
    // Q2 requires persistency gate; without persistency, gate fails
    expect(out.result.gates.persistencyGateMet).toBe(false);
    expect(out.result.gates.qualified).toBe(false);
    expect(out.result.consistencyBonus).toBe(0);
  });
});
