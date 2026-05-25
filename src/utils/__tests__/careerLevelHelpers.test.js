import { describe, it, expect } from 'vitest';
import { compute2YearAverageAPI } from '../careerLevelHelpers';

function sub(weekStarting, apiSold, status = 'submitted') {
  return { weekStarting, apiSold, status };
}

describe('compute2YearAverageAPI', () => {
  it('returns 0 for empty submissions', () => {
    expect(compute2YearAverageAPI([], 2026)).toBe(0);
    expect(compute2YearAverageAPI(null, 2026)).toBe(0);
  });

  it('sums reference year and prior year, divides by 2', () => {
    const subs = [
      sub('2026-01-01', 200000), // current year
      sub('2025-06-01', 150000), // prior year
    ];
    expect(compute2YearAverageAPI(subs, 2026)).toBe(175000);
  });

  it('current year only (agent < 2 years): average uses half of single-year total', () => {
    const subs = [sub('2026-01-01', 240000)];
    expect(compute2YearAverageAPI(subs, 2026)).toBe(120000);
  });

  it('both years present: correctly accumulates multiple submissions per year', () => {
    const subs = [
      sub('2026-01-05', 100000),
      sub('2026-06-10', 120000),
      sub('2025-03-01',  80000),
      sub('2025-11-01',  60000),
    ];
    // 2026 total: 220000, 2025 total: 140000, avg: 360000/2 = 180000
    expect(compute2YearAverageAPI(subs, 2026)).toBe(180000);
  });

  it('excludes submissions older than 2 years back', () => {
    const subs = [
      sub('2024-12-31', 300000), // 2 years ago — NOT included
      sub('2025-01-01', 200000), // prior year — included
      sub('2026-01-01', 200000), // current — included
    ];
    // only 2025 + 2026 = 400000, avg = 200000
    expect(compute2YearAverageAPI(subs, 2026)).toBe(200000);
  });

  it('ignores non-submitted submissions', () => {
    const subs = [
      sub('2026-01-01', 200000, 'submitted'),
      sub('2026-02-01', 100000, 'draft'),
      sub('2025-01-01',  50000, 'pending'),
    ];
    expect(compute2YearAverageAPI(subs, 2026)).toBe(100000); // only the submitted one: 200000/2
  });

  it('handles zero apiSold gracefully', () => {
    const subs = [
      sub('2026-01-01', 0),
      sub('2025-01-01', null),
      sub('2025-06-01', undefined),
    ];
    expect(compute2YearAverageAPI(subs, 2026)).toBe(0);
  });

  it('handles string apiSold values (parseFloat)', () => {
    const subs = [
      sub('2026-01-01', '300000'),
      sub('2025-01-01', '100000'),
    ];
    expect(compute2YearAverageAPI(subs, 2026)).toBe(200000);
  });
});
