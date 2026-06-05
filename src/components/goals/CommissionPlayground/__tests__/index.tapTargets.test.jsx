// @vitest-environment jsdom
//
// FU#2 P1-3 — CommissionPlayground tap-target characterization (consciously evolved, D4).
//
// Original: tested the accordion toggle button's min-h-[44px] class.
// D4 (commission-v2-s1): the accordion is removed — CommissionPlayground is
// always-expanded. The accordion toggle no longer exists. This test evolves
// to verify the always-present tab list renders its two interactive tab buttons
// (the new primary interaction surface), replacing the prior accordion-toggle check.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../tabs/GoalDecompositionTab', () => ({ default: () => null }));
vi.mock('../tabs/ModalTargetingTab', () => ({ default: () => null }));

import CommissionPlayground from '../index';

describe('CommissionPlayground — always-expanded tab interaction (FU#2 P1-3, D4 evolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ userProfile: { name: 'Test Agent' } });
  });

  it('tab list is present at mount (no accordion, always-expanded)', () => {
    render(<CommissionPlayground submissions={[]} agentId="a1" tenantId="t1" />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
  });
});
