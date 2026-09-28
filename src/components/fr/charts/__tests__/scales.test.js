import { describe, it, expect } from 'vitest';
import { linearScale, niceMax, pct, pathFromPoints, pathLength, tipAlign, keyIndexes } from '../scales';

describe('scales', () => {
  it('linearScale maps domain to range, inverted ranges too', () => {
    const s = linearScale([0, 100], [0, 200]);
    expect(s(50)).toBe(100);
    const inv = linearScale([70, 100], [180, 0]);
    expect(inv(90)).toBe(60);
    expect(linearScale([5, 5], [3, 9])(5)).toBe(3);
  });

  it('niceMax rounds up to 1/2/2.5/5 × 10^n', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(688800)).toBe(1000000);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(210)).toBe(250);
    expect(niceMax(0.3)).toBe(0.5);
    expect(niceMax(-4)).toBe(1);
    expect(niceMax(NaN)).toBe(1);
  });

  it('pct clamps to 0..100 and guards a zero max', () => {
    expect(pct(3, 8)).toBe(37.5);
    expect(pct(12, 8)).toBe(100);
    expect(pct(-2, 8)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });

  it('pathFromPoints builds an M/L string at 2 dp', () => {
    expect(pathFromPoints([])).toBe('');
    expect(pathFromPoints([{ x: 0, y: 10 }, { x: 1.23456, y: 2.005 }, { x: 3, y: 4 }])).toBe('M0 10 L1.23 2.01 L3 4');
  });

  it('pathLength sums segment lengths', () => {
    expect(pathLength([{ x: 0, y: 0 }])).toBe(0);
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
  });
});

describe('tipAlign / keyIndexes (phone-safe labels)', () => {
  it('anchors edge tooltips inward', () => {
    expect(tipAlign(0, 12)).toBe('left-0');
    expect(tipAlign(11, 12)).toBe('right-0');
    expect(tipAlign(6, 12)).toContain('-translate-x-1/2');
  });
  it('keeps first, last, min and max', () => {
    expect([...keyIndexes([5, 9, 1, 4, 3])].sort()).toEqual([0, 1, 2, 4]);
    expect(keyIndexes([]).size).toBe(0);
  });
});
