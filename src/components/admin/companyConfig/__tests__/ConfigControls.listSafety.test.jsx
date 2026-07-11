// ConfigControls.listSafety.test.jsx — Run 5.1 regression coverage.
//
// Bug: TextChips (org.levels, a `def: null` unbacked registry item) crashed
// with "Cannot read properties of null (reading 'map')" — `value = []` default
// parameters only substitute for `undefined`, never an explicit `null`.
// Every list-consuming control shares the same `value.map()` shape, so all of
// them are covered here, not just the one that happened to crash first.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  TextChips, MilestoneChips, BandsTable, StandardsTable, PointsTable, AwardsRulesetTable,
} from '../ConfigControls';

const noop = vi.fn();

describe('list-consuming controls render an empty state on null/undefined without throwing', () => {
  const cases = [
    ['TextChips', TextChips],
    ['MilestoneChips', MilestoneChips],
    ['BandsTable', BandsTable],
    ['StandardsTable', StandardsTable],
    ['PointsTable', PointsTable],
    ['AwardsRulesetTable', AwardsRulesetTable],
  ];

  for (const [name, Component] of cases) {
    it(`${name}: value=null does not throw`, () => {
      expect(() => render(<Component value={null} onChange={noop} disabled />)).not.toThrow();
    });

    it(`${name}: value=undefined does not throw`, () => {
      expect(() => render(<Component value={undefined} onChange={noop} disabled />)).not.toThrow();
    });

    it(`${name}: value=[] renders without throwing`, () => {
      expect(() => render(<Component value={[]} onChange={noop} disabled />)).not.toThrow();
    });
  }
});
