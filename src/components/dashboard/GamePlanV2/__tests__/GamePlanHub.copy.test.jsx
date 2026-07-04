// @vitest-environment jsdom
// Fork B1 honesty copy — the Game Plan hub header carries the manager-visibility
// disclosure line ("Your year and monthly plans are visible to your managers.").
// The header renders unconditionally (before the loading branch), so services and
// heavy children are stubbed inert — this test asserts copy presence only.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'agent1' }, tenantId: 'test-tenant' }),
}));
vi.mock('../../../../services/moneyNeedsService', () => ({
  getMoneyNeeds: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../../services/yearPlanService', () => ({
  getYearPlan: vi.fn().mockResolvedValue(null),
  LINE_KEYS: ['life', 'ah', 'general'],
}));
vi.mock('../../../../services/monthlyPlanService', () => ({
  getMonthlyPlan: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../../services/weeklyPlanService', () => ({
  getWeeklyPlan: vi.fn().mockResolvedValue(null),
  commitWeeklyPlan: vi.fn(),
  deleteWeeklyPlan: vi.fn(),
}));
vi.mock('../../../../services/dailyActivityService', () => ({
  getDailyEntriesForWeek: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../lib/monthlyPlanMath', () => ({
  bucketActualsByMonth: vi.fn(() => Array(12).fill(0)),
  ytdDelta: vi.fn(() => 0),
}));
vi.mock('../../../../utils/validators', () => ({
  getRecentSundays: vi.fn(() => ['2026-06-28']),
}));
// Heavy children — inert stubs; this test only asserts header copy.
vi.mock('../PlanAnchorStrip', () => ({ default: () => null }));
vi.mock('../StepRail', () => ({ default: () => null }));
vi.mock('../PlanCascade', () => ({ default: () => null }));
vi.mock('../SuggestedWeekCard', () => ({ default: () => null }));
vi.mock('../ReviewCommitModal', () => ({ default: () => null }));
vi.mock('../../../agent/MonthlyPlanModal', () => ({ default: () => null }));

import GamePlanScreen from '../index';

describe('GamePlanScreen — Fork B1 honesty copy', () => {
  it('hub header carries the year/monthly manager-visibility disclosure', async () => {
    render(<GamePlanScreen onOpenTab={vi.fn()} />);
    expect(
      await screen.findByText(/Your year and monthly plans are visible to your managers\./i)
    ).toBeInTheDocument();
  });
});
