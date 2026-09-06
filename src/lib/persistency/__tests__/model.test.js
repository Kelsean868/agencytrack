import { describe, it, expect } from 'vitest';
import {
  PERSISTENCY_MODEL_24M_EFFECTIVE_FROM,
  LEGACY_12M_INPUTS,
  TATIL_24M_INPUTS,
  LEGACY_12M_LABELS,
  TATIL_24M_LABELS,
  LABELS,
  persistencyModelFor,
  isTwentyFourMonthModel,
} from '../model';

describe('PERSISTENCY_MODEL_24M_EFFECTIVE_FROM', () => {
  // The memo dates the change to September 2026 persistency. This constant is
  // the whole switch; if it moves, every month either side of it re-classifies.
  it('is the memo month, September 2026', () => {
    expect(PERSISTENCY_MODEL_24M_EFFECTIVE_FROM).toBe('2026-09');
  });
});

describe('persistencyModelFor — the boundary', () => {
  it('returns the legacy 12-month model for the month before the memo', () => {
    const m = persistencyModelFor('2026-08');
    expect(m.id).toBe('legacy12');
    expect(m.windowMonths).toBe(12);
  });

  it('returns the Tatil 24-month model for the effective month itself', () => {
    const m = persistencyModelFor('2026-09');
    expect(m.id).toBe('tatil24');
    expect(m.windowMonths).toBe(24);
  });

  it('is inclusive at the boundary — September flips, August does not', () => {
    expect(isTwentyFourMonthModel('2026-08')).toBe(false);
    expect(isTwentyFourMonthModel('2026-09')).toBe(true);
  });

  it('classifies every month of 2026 on the right side of September', () => {
    for (let mo = 1; mo <= 12; mo += 1) {
      const key = `2026-${String(mo).padStart(2, '0')}`;
      expect(isTwentyFourMonthModel(key), key).toBe(mo >= 9);
    }
  });

  it('treats all later years as 24-month and all earlier years as legacy', () => {
    expect(persistencyModelFor('2027-01').id).toBe('tatil24');
    expect(persistencyModelFor('2099-12').id).toBe('tatil24');
    expect(persistencyModelFor('2025-12').id).toBe('legacy12');
    expect(persistencyModelFor('2024-01').id).toBe('legacy12');
  });

  it('compares zero-padded months correctly across the 9/10 rollover', () => {
    // The classic lexicographic trap: an UNPADDED '2026-9' would sort ABOVE
    // '2026-12'. Zero-padding is what makes `>=` safe here, so pin that the
    // padded keys either side of the rollover land on the right model.
    expect(isTwentyFourMonthModel('2026-10')).toBe(true);
    expect(isTwentyFourMonthModel('2026-12')).toBe(true);
    expect(isTwentyFourMonthModel('2026-01')).toBe(false);
  });
});

describe('persistencyModelFor — malformed input', () => {
  // Deliberately loud. A silent legacy fallback would report a month on the
  // wrong model and render a plausible wrong number on an award-gating surface.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['unpadded month', '2026-9'],
    ['slash separator', '2026/09'],
    ['full date', '2026-09-01'],
    ['year only', '2026'],
    ['a number', 202609],
    ['an object', { monthKey: '2026-09' }],
  ])('throws on %s', (_label, value) => {
    expect(() => persistencyModelFor(value)).toThrow(/monthKey must be "YYYY-MM"/);
  });

  it('isTwentyFourMonthModel inherits the same throw contract', () => {
    expect(() => isTwentyFourMonthModel('nope')).toThrow(/monthKey must be "YYYY-MM"/);
  });
});

describe('model inputs', () => {
  it('legacy carries the six E3 inputs and no decreases', () => {
    expect(LEGACY_12M_INPUTS).toEqual([
      'businessPlaced', 'notTakens', 'incPPPs', 'lumpsums100', 'lapses', 'reinstatements',
    ]);
    expect(LEGACY_12M_INPUTS).not.toContain('decreases');
  });

  it('the 24-month model adds exactly one term — decreases', () => {
    expect(TATIL_24M_INPUTS).toContain('decreases');
    expect(TATIL_24M_INPUTS).toHaveLength(LEGACY_12M_INPUTS.length + 1);
    const added = TATIL_24M_INPUTS.filter((f) => !LEGACY_12M_INPUTS.includes(f));
    expect(added).toEqual(['decreases']);
  });

  it('keeps every legacy input — the memo adds a term, it removes none', () => {
    for (const f of LEGACY_12M_INPUTS) {
      expect(TATIL_24M_INPUTS, f).toContain(f);
    }
  });

  it('exposes inputs on the returned model', () => {
    expect(persistencyModelFor('2026-08').inputs).toEqual(LEGACY_12M_INPUTS);
    expect(persistencyModelFor('2026-09').inputs).toEqual(TATIL_24M_INPUTS);
  });
});

describe('labels', () => {
  // The two name collisions in the memo are the whole reason this map exists.
  it("renames the DERIVED denominator to the memo's Net Gross Settled", () => {
    expect(TATIL_24M_LABELS.grossSettled).toBe('Net Gross Settled');
    expect(LEGACY_12M_LABELS.grossSettled).toBe('Gross Settled');
  });

  it("gives the INPUT businessPlaced the memo's Gross Settled", () => {
    expect(TATIL_24M_LABELS.businessPlaced).toBe('Gross Settled');
  });

  it('never lets one map use "Gross Settled" for both numbers at once', () => {
    // If both the input and the derived figure rendered as "Gross Settled" in
    // the same month, a manager could not tell the denominator from its base.
    // This is the invariant that prevents it.
    expect(TATIL_24M_LABELS.businessPlaced).not.toBe(TATIL_24M_LABELS.grossSettled);
    expect(LEGACY_12M_LABELS.businessPlaced).not.toBe(LEGACY_12M_LABELS.grossSettled);
  });

  it("renames incPPPs to the memo's Increases", () => {
    expect(TATIL_24M_LABELS.incPPPs).toBe('Increases');
    expect(LEGACY_12M_LABELS.incPPPs).toBe('Inc PPPs');
  });

  it('labels every input the model asks for — no blank field label', () => {
    for (const f of TATIL_24M_INPUTS) {
      expect(TATIL_24M_LABELS[f], f).toBeTruthy();
    }
    for (const f of LEGACY_12M_INPUTS) {
      expect(LEGACY_12M_LABELS[f], f).toBeTruthy();
    }
  });

  it('leaves no "12-month" claim anywhere in the 24-month vocabulary', () => {
    for (const v of Object.values(TATIL_24M_LABELS)) {
      expect(v).not.toMatch(/12[- ]?month/i);
    }
  });

  it('defaults LABELS to the memo vocabulary for non-month-aware surfaces', () => {
    expect(LABELS).toBe(TATIL_24M_LABELS);
  });

  it('exposes labels on the returned model', () => {
    expect(persistencyModelFor('2026-09').labels).toBe(TATIL_24M_LABELS);
    expect(persistencyModelFor('2026-08').labels).toBe(LEGACY_12M_LABELS);
  });
});

describe('provenance', () => {
  it('names the memo as the 24-month model source', () => {
    const m = persistencyModelFor('2026-09');
    expect(m.source).toMatch(/24-Month Persistency Model/);
    expect(m.source).toMatch(/29 Aug 2026/);
    expect(m.effectiveFrom).toBe(PERSISTENCY_MODEL_24M_EFFECTIVE_FROM);
  });

  it('leaves the legacy model with no effective-from — it is the prior state', () => {
    expect(persistencyModelFor('2026-08').effectiveFrom).toBeNull();
  });
});

describe('immutability', () => {
  // The model object is shared by every caller. A consumer mutating labels or
  // inputs would silently change another surface rendering.
  it('freezes the returned model, its inputs and its labels', () => {
    const m = persistencyModelFor('2026-09');
    expect(Object.isFrozen(m)).toBe(true);
    expect(Object.isFrozen(m.inputs)).toBe(true);
    expect(Object.isFrozen(m.labels)).toBe(true);
  });

  it('returns the same frozen instance for two months on the same model', () => {
    expect(persistencyModelFor('2026-09')).toBe(persistencyModelFor('2026-10'));
    expect(persistencyModelFor('2026-08')).toBe(persistencyModelFor('2026-07'));
  });
});
