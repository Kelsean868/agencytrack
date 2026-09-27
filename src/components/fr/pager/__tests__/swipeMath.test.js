/**
 * swipeMath — examples + properties for the FR swipe-pages engine
 * (docs/design-system/screens-fr/specs/SWIPE3.md rule 4).
 * Property runs are bounded (numRuns 200, fixed seed) to keep CI cheap and stable.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  rubberBand,
  projectOffset,
  resolveTargetIndex,
  isHorizontalIntent,
  translateFor,
  dragOffsetFor,
} from '../swipeMath';

const RUNS = { numRuns: 200, seed: 42 };
const dxArb = fc.integer({ min: -5000, max: 5000 });
const widthArb = fc.integer({ min: 200, max: 1200 });

describe('rubberBand', () => {
  it('matches the spec formula', () => {
    expect(rubberBand(100, 390)).toBeCloseTo((100 * 390 * 0.55) / (390 + 55), 10);
    expect(rubberBand(0, 390)).toBe(0);
  });

  it('is odd: rubberBand(-dx) === -rubberBand(dx)', () => {
    fc.assert(fc.property(dxArb, widthArb, (dx, w) => rubberBand(-dx, w) + rubberBand(dx, w) === 0), RUNS);
  });

  it('shrinks the drag and stays under one width', () => {
    fc.assert(fc.property(dxArb.filter((d) => d !== 0), widthArb, (dx, w) => {
      const r = Math.abs(rubberBand(dx, w));
      return r < Math.abs(dx) && r < w;
    }), RUNS);
  });

  it('is monotonic in dx', () => {
    fc.assert(fc.property(dxArb, dxArb, widthArb, (a, b, w) => {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      return rubberBand(lo, w) <= rubberBand(hi, w);
    }), RUNS);
  });
});

describe('projectOffset', () => {
  it('adds 99x the velocity in px/ms', () => {
    expect(projectOffset(-60, -1500)).toBeCloseTo(-60 - 1.5 * 99, 6);
    expect(projectOffset(40, 0)).toBe(40);
  });
});

describe('resolveTargetIndex', () => {
  it('never moves more than one page and never leaves 0..count-1', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 0, max: 5 }),
      fc.integer({ min: -20000, max: 20000 }),
      fc.integer({ min: -50000, max: 50000 }),
      widthArb,
      (count, rawIndex, dragPx, v, width) => {
        const index = rawIndex % count;
        const t = resolveTargetIndex({ index, count, dragPx, velocityPxPerSec: v, width });
        return Math.abs(t - index) <= 1 && t >= 0 && t <= count - 1;
      },
    ), RUNS);
  });

  it('a slow 60px drag at width 390 stays', () => {
    expect(resolveTargetIndex({ index: 1, count: 3, dragPx: -60, velocityPxPerSec: -50, width: 390 })).toBe(1);
    expect(resolveTargetIndex({ index: 1, count: 3, dragPx: 60, velocityPxPerSec: 50, width: 390 })).toBe(1);
  });

  it('a 220px drag moves one page', () => {
    expect(resolveTargetIndex({ index: 1, count: 3, dragPx: -220, velocityPxPerSec: 0, width: 390 })).toBe(2);
    expect(resolveTargetIndex({ index: 1, count: 3, dragPx: 220, velocityPxPerSec: 0, width: 390 })).toBe(0);
  });

  it('a 60px flick (1500 px/s) in the same direction moves one page', () => {
    expect(resolveTargetIndex({ index: 0, count: 3, dragPx: -60, velocityPxPerSec: -1500, width: 390 })).toBe(1);
    expect(resolveTargetIndex({ index: 2, count: 3, dragPx: 60, velocityPxPerSec: 1500, width: 390 })).toBe(1);
  });

  it('clamps at the ends', () => {
    expect(resolveTargetIndex({ index: 0, count: 3, dragPx: 300, velocityPxPerSec: 3000, width: 390 })).toBe(0);
    expect(resolveTargetIndex({ index: 2, count: 3, dragPx: -300, velocityPxPerSec: -3000, width: 390 })).toBe(2);
  });
});

describe('isHorizontalIntent', () => {
  it('needs |dx| > 10 and |dx| > |dy|', () => {
    expect(isHorizontalIntent(11, 0)).toBe(true);
    expect(isHorizontalIntent(-30, 20)).toBe(true);
    expect(isHorizontalIntent(10, 0)).toBe(false);
    expect(isHorizontalIntent(20, 20)).toBe(false);
    expect(isHorizontalIntent(5, 200)).toBe(false);
  });
});

describe('translateFor', () => {
  it('is -index*width at rest', () => {
    expect(translateFor(2, 390, 0, 4)).toBe(-780);
  });

  it('drags 1:1 between pages', () => {
    expect(translateFor(1, 390, -100, 3)).toBe(-490);
    expect(translateFor(1, 390, 100, 3)).toBe(-290);
  });

  it('rubber-bands past the first and last page', () => {
    expect(translateFor(0, 390, 100, 3)).toBeCloseTo(rubberBand(100, 390), 10);
    expect(translateFor(2, 390, -100, 3)).toBeCloseTo(-780 + rubberBand(-100, 390), 10);
    // Pulling inward from an end is still 1:1.
    expect(dragOffsetFor(0, 390, -100, 3)).toBe(-100);
  });
});
