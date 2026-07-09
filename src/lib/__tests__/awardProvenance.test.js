import { describe, it, expect } from 'vitest';
import { deriveAwardProvenance } from '../awardProvenance';

const AWARD = (over) => ({
  id: 'mdrt', name: 'MDRT 2026',
  criteria: [{ label: 'Settled API', current: 487000, target: 500000, unit: 'TTD', met: false }],
  ...over,
});

describe('deriveAwardProvenance', () => {
  it('returns null when the award has no primary criterion', () => {
    expect(deriveAwardProvenance({ id: 'x', criteria: [] })).toBeNull();
    expect(deriveAwardProvenance({ id: 'x' })).toBeNull();
  });

  it('derives settled/target/pct from the primary criterion', () => {
    const p = deriveAwardProvenance(AWARD());
    expect(p.settled).toBe(487000);
    expect(p.target).toBe(500000);
    expect(p.unit).toBe('TTD');
    expect(p.pct).toBe(97);
  });

  it('states the ACTUAL source — settlements by default, ledger when usesPolicyLedger', () => {
    expect(deriveAwardProvenance(AWARD()).source).toBe('CONFIRMED SETTLEMENTS');
    expect(deriveAwardProvenance(AWARD()).sourceLive).toBe(false);
    const live = deriveAwardProvenance(AWARD(), { usesPolicyLedger: true });
    expect(live.source).toBe('POLICY LEDGER');
    expect(live.sourceLive).toBe(true);
  });

  it('exposes only the real base segment and flags campaign attribution pending', () => {
    const p = deriveAwardProvenance(AWARD());
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0]).toMatchObject({ kind: 'base', value: 487000 });
    expect(p.campaignPending).toBe(true);
    expect(p.pending).toBeNull();
  });
});
