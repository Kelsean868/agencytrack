import { describe, it, expect } from 'vitest';
import { buildSectionMap, groupBySectionLabel } from '../navSections';

describe('navSections — buildSectionMap', () => {
  it('resolves each item to its own or nearest-preceding section label', () => {
    const items = [
      { id: 'a', sectionLabel: 'Planning' },
      { id: 'b' },                            // inherits Planning
      { id: 'c', sectionLabel: 'Tools' },
      { id: 'd' },                            // inherits Tools
      { id: 'e', sectionLabel: 'Recognition' },
    ];
    const map = buildSectionMap(items);
    expect(map.get('a')).toBe('Planning');
    expect(map.get('b')).toBe('Planning');
    expect(map.get('c')).toBe('Tools');
    expect(map.get('d')).toBe('Tools');
    expect(map.get('e')).toBe('Recognition');
  });

  it('leading items with no preceding label resolve to null', () => {
    const map = buildSectionMap([{ id: 'x' }, { id: 'y', sectionLabel: 'Company' }]);
    expect(map.get('x')).toBeNull();
    expect(map.get('y')).toBe('Company');
  });

  it('skips items without an id and tolerates empty / null input', () => {
    const map = buildSectionMap([{ sectionLabel: 'Planning' }, { id: 'a' }]);
    expect(map.get('a')).toBe('Planning');
    expect(buildSectionMap()).toEqual(new Map());
    expect(buildSectionMap(null)).toEqual(new Map());
  });
});

describe('navSections — groupBySectionLabel', () => {
  it('groups consecutive items sharing a label', () => {
    const items = [
      { id: 'a', sectionLabel: 'Planning' },
      { id: 'b', sectionLabel: 'Planning' },
      { id: 'c', sectionLabel: 'Tools' },
      { id: 'd', sectionLabel: 'Account' },
    ];
    const groups = groupBySectionLabel(items);
    expect(groups.map((g) => g.label)).toEqual(['Planning', 'Tools', 'Account']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['c']);
    expect(groups[2].items.map((i) => i.id)).toEqual(['d']);
  });

  it('a label that repeats after a break starts a new group (consecutive-only)', () => {
    const items = [
      { id: 'a', sectionLabel: 'Planning' },
      { id: 'b', sectionLabel: 'Tools' },
      { id: 'c', sectionLabel: 'Planning' },
    ];
    expect(groupBySectionLabel(items).map((g) => g.label)).toEqual(['Planning', 'Tools', 'Planning']);
  });

  it('treats missing labels as a single unlabelled group', () => {
    const groups = groupBySectionLabel([{ id: 'a' }, { id: 'b' }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('returns an empty array for null input (no crash)', () => {
    expect(groupBySectionLabel(null)).toEqual([]);
    expect(groupBySectionLabel()).toEqual([]);
  });
});
