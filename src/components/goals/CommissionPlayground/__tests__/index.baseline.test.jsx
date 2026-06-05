// @vitest-environment jsdom
//
// Item 5(b) — CommissionPlayground RTL baseline (commission-v2-s1 evolution).
//
// Original (night queue): tested the collapsed accordion shell.
// D4 (commission-v2-s1): the accordion is REMOVED — CommissionPlayground is
// now always-expanded, rendering the tab list at mount. These tests are a
// conscious evolution of the prior baseline: the accordion-toggle behavior
// goes away; the title, subtitle copy, and tab list render unconditionally.
//
// The expand-dependent tab-content tests (GoalDecompositionTab, ModalTargetingTab,
// setGoals write path, localStorage income-goal persistence) remain parked for S2
// — those tab files still need the one-line `import React from 'react'` fix
// (banked CLAUDE.md lesson from #153) before they can be mounted in Vitest.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ userProfile: { commissionRate: 35 } }),
}));
vi.mock('../../../../services/goalsService', () => ({ setGoals: vi.fn(() => Promise.resolve()) }));
vi.mock('../tabs/GoalDecompositionTab', () => ({ default: () => null }));
vi.mock('../tabs/ModalTargetingTab', () => ({ default: () => null }));

import CommissionPlayground from '../index';

describe('CommissionPlayground — RTL baseline (commission-v2-s1, always expanded)', () => {
  it('renders the header title', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    expect(screen.getByText('Commission Playground')).toBeInTheDocument();
  });

  it('renders the tab list unconditionally at mount (no accordion)', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('default subtitle is the income-goal reverse-engineer copy', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    expect(screen.getByText(/reverse-engineer the activity needed/i)).toBeInTheDocument();
  });

  it('isManagerSelf swaps the subtitle to the personal-goal copy', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" isManagerSelf />);
    expect(screen.getByText(/hit your personal income goal/i)).toBeInTheDocument();
  });

  it('renders Goal Decomposition and Modal Targeting tabs', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    expect(screen.getByRole('tab', { name: /goal decomposition/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /modal targeting/i })).toBeInTheDocument();
  });

  it('Goal Decomposition tab is selected by default', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    expect(screen.getByRole('tab', { name: /goal decomposition/i })).toHaveAttribute('aria-selected', 'true');
  });
});
