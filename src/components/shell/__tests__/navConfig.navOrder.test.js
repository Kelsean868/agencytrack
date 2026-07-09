// applyNavOrder — within-section nav reorder (Fable Tier 1 · 1.4).
//
// Verifies: identity for empty order, within-section reorder by saved index,
// unordered ids appended at section end in default order, section-header carry
// (moved lead never spawns a phantom section), and the never-cross-sections
// invariant.

import { describe, it, expect } from 'vitest';
import { applyNavOrder } from '../navConfig';

// Two-section fixture (sectionLabel starts a section; blank inherits previous).
const ITEMS = [
  { id: 'a1', label: 'A1', sectionLabel: 'Alpha' },
  { id: 'a2', label: 'A2' },
  { id: 'a3', label: 'A3' },
  { id: 'b1', label: 'B1', sectionLabel: 'Beta' },
  { id: 'b2', label: 'B2' },
];

// Re-derive sections the way Sidebar.groupBySection does, to assert structure.
function group(items) {
  const sections = [];
  let cur = null;
  for (const it of items) {
    if (it.sectionLabel || cur == null) { cur = { label: it.sectionLabel ?? null, items: [] }; sections.push(cur); }
    cur.items.push(it);
  }
  return sections;
}

describe('applyNavOrder', () => {
  it('returns the same array reference when order is empty/absent', () => {
    expect(applyNavOrder(ITEMS, [])).toBe(ITEMS);
    expect(applyNavOrder(ITEMS, undefined)).toBe(ITEMS);
    expect(applyNavOrder(ITEMS, null)).toBe(ITEMS);
  });

  it('reorders within a section by the saved order', () => {
    const out = applyNavOrder(ITEMS, ['a3', 'a1', 'a2', 'b1', 'b2']);
    expect(out.map((i) => i.id)).toEqual(['a3', 'a1', 'a2', 'b1', 'b2']);
  });

  it('appends ids missing from the order after ordered ones, in default order', () => {
    // Only a2 is ranked in Alpha; a1, a3 keep default relative order after it.
    const out = applyNavOrder(ITEMS, ['a2']);
    const alpha = group(out)[0];
    expect(alpha.items.map((i) => i.id)).toEqual(['a2', 'a1', 'a3']);
  });

  it('never moves an item across sections even if the saved order interleaves', () => {
    // b2 ranked before all Alpha ids — must still stay in Beta.
    const out = applyNavOrder(ITEMS, ['b2', 'a3', 'a1']);
    const [alpha, beta] = group(out);
    expect(alpha.label).toBe('Alpha');
    expect(beta.label).toBe('Beta');
    expect(alpha.items.every((i) => i.id.startsWith('a'))).toBe(true);
    expect(beta.items.every((i) => i.id.startsWith('b'))).toBe(true);
    // within Alpha: a3, a1 ordered, a2 appended
    expect(alpha.items.map((i) => i.id)).toEqual(['a3', 'a1', 'a2']);
    // within Beta: b2 ordered first, b1 appended
    expect(beta.items.map((i) => i.id)).toEqual(['b2', 'b1']);
  });

  it('carries the section header to the new lead (exactly one header per section)', () => {
    const out = applyNavOrder(ITEMS, ['a3', 'a1', 'a2', 'b1', 'b2']);
    // a3 is now the Alpha lead → it must carry sectionLabel; the old lead a1 must not.
    const a3 = out.find((i) => i.id === 'a3');
    const a1 = out.find((i) => i.id === 'a1');
    expect(a3.sectionLabel).toBe('Alpha');
    expect(a1.sectionLabel).toBeUndefined();
    // groupBySection reconstructs exactly two sections with correct labels
    const secs = group(out);
    expect(secs.map((s) => s.label)).toEqual(['Alpha', 'Beta']);
  });

  it('does not mutate the input items', () => {
    const snapshot = JSON.parse(JSON.stringify(ITEMS));
    applyNavOrder(ITEMS, ['a3', 'a1', 'a2']);
    expect(ITEMS).toEqual(snapshot);
  });
});
