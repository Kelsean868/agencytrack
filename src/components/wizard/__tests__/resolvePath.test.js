// Q4 — resolvePath helper tests
//
// Pure function; no Firebase, no mount needed.

import { describe, it, expect } from 'vitest';
import { resolvePath } from '../WizardForm.helpers';

describe('resolvePath', () => {
  it("'weekly' always returns 'full'", () => {
    expect(resolvePath('weekly', null)).toBe('full');
    expect(resolvePath('weekly', { aggregatedFromDaily: true, daysWorked: 5 })).toBe('full');
  });

  it("'daily' + aggregatedFromDaily returns 'fast'", () => {
    expect(resolvePath('daily', { aggregatedFromDaily: true, daysWorked: 3 })).toBe('fast');
  });

  it("'hybrid' + aggregatedFromDaily returns 'fast'", () => {
    expect(resolvePath('hybrid', { aggregatedFromDaily: true, daysWorked: 1 })).toBe('fast');
  });

  it("'daily' + daysWorked >= 1 (no aggregatedFromDaily flag) returns 'fast'", () => {
    expect(resolvePath('daily', { daysWorked: 2 })).toBe('fast');
  });

  it("'daily' + null draft (empty-draft fallback) returns 'full'", () => {
    expect(resolvePath('daily', null)).toBe('full');
  });

  it("'daily' + draft with daysWorked 0 returns 'full'", () => {
    expect(resolvePath('daily', { aggregatedFromDaily: false, daysWorked: 0 })).toBe('full');
  });

  it("'hybrid' + null draft returns 'full'", () => {
    expect(resolvePath('hybrid', null)).toBe('full');
  });

  it('unknown loggingMode falls through to full', () => {
    expect(resolvePath(undefined, { aggregatedFromDaily: true })).toBe('full');
    expect(resolvePath('', { aggregatedFromDaily: true })).toBe('full');
  });
});
