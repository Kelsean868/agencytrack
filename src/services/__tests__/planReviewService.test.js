// PR-B2 — planReviewService tests: denied → { unavailable } neutral mapping,
// absent → { empty }, shape normalization, floor fallback degradation.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getCompanyMinimums: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...segs) => ({ path: segs.slice(1).join('/') })),
  getDoc: (...a) => hoisted.getDoc(...a),
}));
vi.mock('../goalsService', () => ({
  getCompanyMinimums: (...a) => hoisted.getCompanyMinimums(...a),
}));

import { getAgentYearPlan, getAgentMonthlyPlan, getAgentAnnualFloor } from '../planReviewService';
import { FLAT_ANNUAL_API_FALLBACK, DEFAULT_TENURE_API_FLOORS } from '../../utils/tenureFloors';

const denied = () => { const e = new Error('denied'); e.code = 'permission-denied'; return Promise.reject(e); };
const snap = (data) => Promise.resolve({ exists: () => data != null, data: () => data, id: '2026' });

beforeEach(() => { vi.clearAllMocks(); });

describe('planReviewService — denied → neutral', () => {
  it('yearPlan permission-denied maps to { unavailable: true } (never an error)', async () => {
    hoisted.getDoc.mockImplementation(denied);
    await expect(getAgentYearPlan('t', 'agent-a', 2026)).resolves.toEqual({ unavailable: true });
  });

  it('monthlyPlan permission-denied maps to { unavailable: true }', async () => {
    hoisted.getDoc.mockImplementation(denied);
    await expect(getAgentMonthlyPlan('t', 'agent-a', 2026)).resolves.toEqual({ unavailable: true });
  });

  it('non-permission failures rethrow (real error state, not neutral)', async () => {
    hoisted.getDoc.mockRejectedValue(Object.assign(new Error('net'), { code: 'unavailable' }));
    await expect(getAgentYearPlan('t', 'agent-a', 2026)).rejects.toThrow('net');
  });
});

describe('planReviewService — absent → empty', () => {
  it('missing yearPlan doc maps to { empty: true }', async () => {
    hoisted.getDoc.mockReturnValue(snap(null));
    await expect(getAgentYearPlan('t', 'agent-a', 2026)).resolves.toEqual({ empty: true });
  });

  it('invalid year maps to { empty: true } without a read', async () => {
    await expect(getAgentMonthlyPlan('t', 'agent-a', 'nope')).resolves.toEqual({ empty: true });
    expect(hoisted.getDoc).not.toHaveBeenCalled();
  });
});

describe('planReviewService — shape normalization', () => {
  it('yearPlan lines are parseFloat-guarded and keyed to LINE_KEYS', async () => {
    hoisted.getDoc.mockReturnValue(snap({
      year: 2026, status: 'committed', updatedAt: null,
      lines: { life: { targetAPI: '180000', pct: 60, derivedCommission: 63000, enabled: true } },
    }));
    const r = await getAgentYearPlan('t', 'agent-a', 2026);
    expect(r.plan.status).toBe('committed');
    expect(r.plan.lines.life.targetAPI).toBe(180000);
    expect(r.plan.lines.ah).toEqual({ targetAPI: 0, pct: 0, derivedApps: 0, derivedCommission: 0, enabled: true });
    expect(r.plan.lines.general.targetAPI).toBe(0);
  });

  it('monthlyPlan targets normalize to numbers; anchorAPI guarded', async () => {
    hoisted.getDoc.mockReturnValue(snap({
      year: 2026, status: 'draft', split: 'custom', anchorAPI: '120000',
      targets: ['10000', 10000, ...Array(10).fill(10000)],
    }));
    const r = await getAgentMonthlyPlan('t', 'agent-a', 2026);
    expect(r.plan.anchorAPI).toBe(120000);
    expect(r.plan.targets).toHaveLength(12);
    expect(r.plan.targets[0]).toBe(10000);
    expect(r.plan.split).toBe('custom');
  });
});

describe('planReviewService — getAgentAnnualFloor degradation', () => {
  it('resolves the tenure band from the agent contractStartDate + config floors', async () => {
    hoisted.getDoc.mockReturnValue(snap({ contractStartDate: '2020-01-01' }));
    hoisted.getCompanyMinimums.mockResolvedValue({ tenureApiFloors: DEFAULT_TENURE_API_FLOORS });
    const floor = await getAgentAnnualFloor('t', 'agent-a');
    expect(floor).toBe(DEFAULT_TENURE_API_FLOORS.band_gt60); // >60 months since 2020
  });

  it('agent-doc read denied → flat fallback (check still renders)', async () => {
    hoisted.getDoc.mockImplementation(denied);
    hoisted.getCompanyMinimums.mockResolvedValue({ tenureApiFloors: DEFAULT_TENURE_API_FLOORS });
    await expect(getAgentAnnualFloor('t', 'agent-a')).resolves.toBe(FLAT_ANNUAL_API_FALLBACK);
  });

  it('companyMinimums read failing → defaults-merged bands still resolve', async () => {
    hoisted.getDoc.mockReturnValue(snap({ contractStartDate: '2020-01-01' }));
    hoisted.getCompanyMinimums.mockRejectedValue(new Error('cfg'));
    await expect(getAgentAnnualFloor('t', 'agent-a')).resolves.toBe(DEFAULT_TENURE_API_FLOORS.band_gt60);
  });
});
