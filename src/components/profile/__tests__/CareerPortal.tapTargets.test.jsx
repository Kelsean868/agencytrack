// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getGoals: vi.fn(),
  setGoals: vi.fn(),
  getCompanyMinimums: vi.fn(),
  aggregatePersistency: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/goalsService', () => ({
  getGoals: hoisted.getGoals,
  setGoals: hoisted.setGoals,
  getCompanyMinimums: hoisted.getCompanyMinimums,
}));
vi.mock('../../../lib/persistency/calculations', () => ({
  aggregatePersistency: hoisted.aggregatePersistency,
}));
vi.mock('../../gamification/BadgeGrid', () => ({ default: () => null }));
vi.mock('../../goals/CommissionPlayground', () => ({ default: () => null }));
vi.mock('../../goals/GapAnalysisPanel', () => ({ default: () => null }));

import CareerPortal from '../CareerPortal';

const STUB_USER = { uid: 'u1', tenantId: 't1' };
const STUB_PROFILE = { name: 'Test Agent', unitId: 'unit1', tenantId: 't1', role: 'agent' };

describe('CareerPortal — editing-mode button tap targets (FU#2 P1-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ user: STUB_USER, userProfile: STUB_PROFILE, role: 'agent' });
    hoisted.getGoals.mockResolvedValue([]);
    hoisted.getCompanyMinimums.mockResolvedValue({});
    hoisted.aggregatePersistency.mockReturnValue(0);
  });

  it('"Edit My Goals" button has h-11 class (44px height)', () => {
    render(<CareerPortal submissions={[]} />);
    const btn = screen.getByRole('button', { name: /Edit My Goals/i });
    expect(btn.className).toMatch(/\bh-11\b/);
  });

  it('Cancel button has h-11 class after entering edit mode', () => {
    render(<CareerPortal submissions={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit My Goals/i }));
    // Cancel is an icon-only button with border-border class; Save has bg-primary
    const allButtons = screen.getAllByRole('button');
    const cancelBtn = allButtons.find((b) => b.className.includes('border-border'));
    expect(cancelBtn).toBeTruthy();
    expect(cancelBtn.className).toMatch(/\bh-11\b/);
  });

  it('Save button has h-11 class after entering edit mode', () => {
    render(<CareerPortal submissions={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit My Goals/i }));
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    expect(saveBtn.className).toMatch(/\bh-11\b/);
  });
});
