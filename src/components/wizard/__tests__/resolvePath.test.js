// Q4 — resolvePath helper tests
//
// Pure function; no Firebase, no mount needed.

import { describe, it, expect } from 'vitest';
import { resolvePath, setByPath } from '../WizardForm.helpers';

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

describe('setByPath', () => {
  it('sets a flat key (returns a new object, leaves others intact)', () => {
    const before = { dials: 5, telContacts: 3 };
    const after = setByPath(before, 'dials', 10);
    expect(after).toEqual({ dials: 10, telContacts: 3 });
    expect(after).not.toBe(before);          // immutable
    expect(before.dials).toBe(5);            // source untouched
  });

  it('sets a dotted (nested) key on an existing branch', () => {
    const before = { newBusiness: { apps: 1, api: 5000 } };
    const after = setByPath(before, 'newBusiness.api', 7500);
    expect(after.newBusiness).toEqual({ apps: 1, api: 7500 });
    expect(after.newBusiness).not.toBe(before.newBusiness); // nested clone
    expect(before.newBusiness.api).toBe(5000);              // source untouched
  });

  it('creates the parent branch when missing rather than a literal dotted key', () => {
    const after = setByPath({}, 'socialPlatformBreakdown.facebook', 4);
    expect(after).toEqual({ socialPlatformBreakdown: { facebook: 4 } });
    expect(after['socialPlatformBreakdown.facebook']).toBeUndefined();
  });

  it('does not clobber sibling keys in the nested branch', () => {
    const before = { socialPlatformBreakdown: { facebook: 1, instagram: 2 } };
    const after = setByPath(before, 'socialPlatformBreakdown.facebook', 9);
    expect(after.socialPlatformBreakdown).toEqual({ facebook: 9, instagram: 2 });
  });
});
