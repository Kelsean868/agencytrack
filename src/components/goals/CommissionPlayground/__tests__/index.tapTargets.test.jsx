// @vitest-environment jsdom
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

describe('CommissionPlayground — accordion toggle tap target (FU#2 P1-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ userProfile: { name: 'Test Agent' } });
  });

  it('accordion toggle button has min-h-[44px] class', () => {
    render(<CommissionPlayground submissions={[]} agentId="a1" tenantId="t1" />);
    // The accordion toggle is the first (and only visible) button when closed
    const toggleBtn = screen.getAllByRole('button')[0];
    expect(toggleBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
