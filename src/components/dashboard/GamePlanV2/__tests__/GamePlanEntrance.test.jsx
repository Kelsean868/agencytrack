// @vitest-environment jsdom
// POC — data-gated whole-screen entrance for Game Plan. The screen holds the
// `.screen-enter` fade until its primary data is ready (`loading` flips false)
// OR a 400ms cap elapses, then plays the fade ONCE on populated content. These
// tests pin the four behaviors: release-on-dataReady, release-on-cap,
// reduced-motion skips the fade, and the slow-path reassurance after 2s. A fifth
// test guards the legacy (default) path stays un-gated for other callers.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'agent1' }, tenantId: 'test-tenant' }),
}));
vi.mock('../../../../services/moneyNeedsService', () => ({
  getMoneyNeeds: vi.fn(),
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
// Heavy children — inert stubs. These tests only assert on the entrance wrapper,
// the header, the loading state, and the slow-path message.
vi.mock('../PlanAnchorStrip', () => ({ default: () => null }));
vi.mock('../StepRail', () => ({ default: () => null }));
vi.mock('../PlanCascade', () => ({ default: () => null }));
vi.mock('../PlanSuggestionsCard', () => ({ default: () => null }));
vi.mock('../SuggestedWeekCard', () => ({ default: () => null }));
vi.mock('../ReviewCommitModal', () => ({ default: () => null }));
vi.mock('../../../agent/MonthlyPlanModal', () => ({ default: () => null }));

import GamePlanScreen from '../index';
import { getMoneyNeeds } from '../../../../services/moneyNeedsService';

// jsdom has no matchMedia — install a controllable stub. `reduced` toggles what
// the (prefers-reduced-motion: reduce) query reports.
function installMatchMedia(reduced) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const neverResolves = () => new Promise(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  installMatchMedia(false); // motion OK by default
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GamePlanScreen — data-gated entrance (POC)', () => {
  it('releases the entrance on dataReady and plays the fade on populated content', async () => {
    getMoneyNeeds.mockResolvedValue({ totalAnnualAfterTax: 1000 });

    render(<GamePlanScreen gatedEntrance onOpenTab={vi.fn()} />);

    // Once the load resolves, the entrance wrapper mounts with the fade class and
    // the fully-rendered header inside it.
    const entrance = await screen.findByTestId('game-plan-entrance');
    expect(entrance).toHaveClass('screen-enter');
    expect(entrance).toHaveTextContent('Game Plan');
    // Content is populated (loading resolved) — no loading skeleton inside.
    expect(screen.queryByTestId('game-plan-loading')).not.toBeInTheDocument();
  });

  it('releases the entrance on the 400ms cap even while data is still loading', async () => {
    getMoneyNeeds.mockImplementation(neverResolves);
    vi.useFakeTimers();

    render(<GamePlanScreen gatedEntrance onOpenTab={vi.fn()} />);

    // Before the cap: quiet loading state only, no entrance wrapper.
    expect(screen.getByTestId('game-plan-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('game-plan-entrance')).not.toBeInTheDocument();

    // Advance past the cap → entrance releases with whatever's loaded (the
    // skeleton, since the fetch is still pending).
    await act(async () => { vi.advanceTimersByTime(400); });

    expect(screen.getByTestId('game-plan-entrance')).toBeInTheDocument();
    // Still loading → the skeleton lives inside the (now animating) wrapper.
    expect(screen.getByTestId('game-plan-loading')).toBeInTheDocument();
  });

  it('skips the fade class under prefers-reduced-motion (content just appears)', async () => {
    installMatchMedia(true); // reduced motion ON
    getMoneyNeeds.mockResolvedValue({ totalAnnualAfterTax: 1000 });

    render(<GamePlanScreen gatedEntrance onOpenTab={vi.fn()} />);

    const entrance = await screen.findByTestId('game-plan-entrance');
    // The content still reveals when ready — but with NO entrance animation.
    await waitFor(() => expect(entrance).not.toHaveClass('screen-enter'));
    expect(entrance).toHaveTextContent('Game Plan');
  });

  it('shows the slow-path reassurance once the wait exceeds ~2s', async () => {
    getMoneyNeeds.mockImplementation(neverResolves);
    vi.useFakeTimers();

    render(<GamePlanScreen gatedEntrance onOpenTab={vi.fn()} />);

    // Not shown before the slow threshold.
    expect(screen.queryByTestId('game-plan-slow-message')).not.toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(2000); });

    const msg = screen.getByTestId('game-plan-slow-message');
    expect(msg).toHaveTextContent(/taking longer than expected/i);
  });

  it('legacy (default) path is NOT gated — header renders immediately, no entrance wrapper', async () => {
    getMoneyNeeds.mockImplementation(neverResolves); // keep it loading forever

    render(<GamePlanScreen onOpenTab={vi.fn()} />); // gatedEntrance omitted

    // Header is present up-front (un-gated), and no entrance wrapper is used.
    expect(await screen.findByText('Game Plan')).toBeInTheDocument();
    expect(screen.queryByTestId('game-plan-entrance')).not.toBeInTheDocument();
    // The legacy loading skeleton still renders while data loads.
    expect(screen.getByTestId('game-plan-loading')).toBeInTheDocument();
  });
});
