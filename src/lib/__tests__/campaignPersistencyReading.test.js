import { describe, it, expect } from 'vitest';
import { campaignPersistencyReading } from '../campaignPersistencyReading';
import { CHRISTMAS, POLICIES, TODAY } from './fixtures/awardLensFixtures';

const read = (over = {}) => campaignPersistencyReading({ campaign: CHRISTMAS, policies: POLICIES, records: [], today: TODAY, ...over });

describe('campaignPersistencyReading — the one persistency reading for Home + ledger campaign cards', () => {
  it('a gate reading on file → value, label, below-gate flag, December gate month', () => {
    const r = read({ records: [{ monthKey: '2026-09', grossSettled: 100_000, netSettled: 86_600 }] });
    expect(r.value).toBe(86.6);
    expect(r.label).toBe('86.60%');
    expect(r.below).toBe(true);
    expect(r.threshold).toBe(90);
    expect(r.gateMonthKey).toBe('2026-12');
  });

  it('at or above the gate → below is false', () => {
    const r = read({ records: [{ monthKey: '2026-09', grossSettled: 100_000, netSettled: 93_000 }] });
    expect(r.below).toBe(false);
  });

  it('nothing known → "—", never a confident 0', () => {
    const r = read({ policies: [] });
    expect(r.value).toBeNull();
    expect(r.label).toBe('—');
  });

  it('gate switched off, or not a tiered qualify campaign → null (no ring at all)', () => {
    expect(read({ campaign: { ...CHRISTMAS, persistencyGateEnabled: false } })).toBeNull();
    expect(read({ campaign: { ...CHRISTMAS, tiers: [] } })).toBeNull();
    expect(read({ campaign: null })).toBeNull();
  });
});
