import { describe, it, expect } from 'vitest';
import { deriveProductionDataSource } from '../computations';

describe('deriveProductionDataSource — honest DataSourceBadge signal', () => {
  it('returns "estimated" when no settlements are loaded (the production-view case)', () => {
    expect(deriveProductionDataSource({ settlements: [] })).toBe('estimated');
    expect(deriveProductionDataSource({})).toBe('estimated');
    expect(deriveProductionDataSource()).toBe('estimated');
    expect(deriveProductionDataSource({ settlements: null })).toBe('estimated');
  });

  it('returns "confirmed" when settlement rows back the view', () => {
    expect(deriveProductionDataSource({ settlements: [{ periodKey: '2026-05' }] })).toBe('confirmed');
  });
});
