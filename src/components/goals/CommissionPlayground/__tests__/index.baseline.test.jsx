// @vitest-environment jsdom
//
// Item 5(b) — minimal CommissionPlayground RTL baseline (night queue).
// The audit found a one-test floor (index.tapTargets.test.jsx). This adds the
// zero-src-change part of the baseline: the collapsed accordion shell.
//
// ── PARKED (brief Item 5(b): "ZERO src changes — if untestable without src
//    edits, PARK that part and keep (a)") ──────────────────────────────────────
// The expand-dependent baseline (tablist reveal, tab switch, setGoals write path,
// localStorage income-goal persistence) CANNOT be tested without a src edit:
// mounting the tabs throws `ReferenceError: React is not defined` at
// GoalDecompositionTab.jsx:184 — the tab files (GoalDecompositionTab.jsx,
// ModalTargetingTab.jsx) import only named hooks, not the default `React`, so
// Vitest's transform fails on their JSX (the banked CLAUDE.md #153 lesson: "All
// new JSX components must explicitly import React for Vitest compatibility").
// Unblocking it is a one-line `import React from 'react'` in each tab file —
// banked as a follow-up so the full RTL baseline (tab switch, setGoals, storage)
// can land alongside that trivial src fix, outside this test-only item's scope.
//
// The real Commission safety net lands in this item's (a): the commissionMath
// characterization suite (modeBreakdown + cashFlowForecast + commissionThisMonth
// + boundaries). The decomposition chain is already pinned in
// src/utils/__tests__/goalDecomposition.test.js.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ userProfile: { commissionRate: 35 } }),
}));
vi.mock('../../../../services/goalsService', () => ({ setGoals: vi.fn(() => Promise.resolve()) }));

import CommissionPlayground from '../index';

describe('CommissionPlayground — RTL baseline (Item 5b, collapsed shell only)', () => {
  it('renders the accordion header collapsed (no tablist until expanded)', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    expect(screen.getByText('Commission Playground')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('default copy reverse-engineers the agent income goal', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" />);
    expect(screen.getByText(/reverse-engineer the activity needed/i)).toBeInTheDocument();
  });

  it('isManagerSelf swaps the subtitle to the personal-goal copy', () => {
    render(<CommissionPlayground submissions={[]} agentId="a" tenantId="t" isManagerSelf />);
    expect(screen.getByText(/hit your personal income goal/i)).toBeInTheDocument();
  });
});
