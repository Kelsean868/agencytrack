import { describe, it, expect } from 'vitest';
import { compositionSegments } from '../moneyNeedsComposition';

const META = [
  { key: 'fixedExpenses',       label: 'Fixed Expenses',         dot: 'bg-primary'   },
  { key: 'livingExpenses',      label: 'Living Expenses',        dot: 'bg-ink-muted' },
  { key: 'businessExpenses',    label: 'Business Expenses',      dot: 'bg-gold'      },
  { key: 'savingsAccumulation', label: 'Savings & Accumulation', dot: 'bg-success'   },
  { key: 'miscellaneous',       label: 'Miscellaneous',          dot: 'bg-ink-faint' },
];

describe('moneyNeedsComposition — compositionSegments', () => {
  const groups = {
    fixedExpenses:       { groupAnnualTotal: 40000 },
    livingExpenses:      { groupAnnualTotal: 30000 },
    businessExpenses:    { groupAnnualTotal: 20000 },
    savingsAccumulation: { groupAnnualTotal: 10000 },
    miscellaneous:       { groupAnnualTotal: 0 },
  };

  it('sums groupAnnualTotal into the total', () => {
    const { total } = compositionSegments(groups, META);
    expect(total).toBe(100000);
  });

  it('percentages of funded groups sum to 100 (within epsilon)', () => {
    const { segments } = compositionSegments(groups, META);
    expect(segments.reduce((s, g) => s + g.pct, 0)).toBeCloseTo(100, 6);
    expect(segments.find((s) => s.key === 'fixedExpenses').pct).toBeCloseTo(40, 6);
  });

  it('drops zero-value groups from the segments', () => {
    const { segments } = compositionSegments(groups, META);
    expect(segments.map((s) => s.key)).not.toContain('miscellaneous');
    expect(segments).toHaveLength(4);
  });

  it('carries the group dot tone through for reuse', () => {
    const { segments } = compositionSegments(groups, META);
    expect(segments.find((s) => s.key === 'businessExpenses').dot).toBe('bg-gold');
  });

  it('returns empty + zero total when nothing is filled', () => {
    const { segments, total } = compositionSegments({}, META);
    expect(segments).toEqual([]);
    expect(total).toBe(0);
  });
});
