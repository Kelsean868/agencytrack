// @vitest-environment jsdom
/**
 * Game plan — CHARACTERIZATION suite (R2-8, commit 1).
 *
 * Pins what the Game plan hub computes and writes TODAY, before the FR visual
 * port, through the whole hub (real children, real derivations) with only the
 * services and the two modals stubbed:
 *   · every step state (not started · in progress · committed), with the
 *     figures each one prints (commission need, planned API, per-month target,
 *     YTD delta, line split, plan-built %)
 *   · every weekly-plan mode (no anchor · floor · derived · committed + pace)
 *   · every save action, by the exact service arguments it sends:
 *     commitWeeklyPlan, deleteWeeklyPlan, markSuggestionSeen, and the props the
 *     Monthly plan and Review & commit modals are opened with (their own save
 *     paths live inside those modals, which this slice does not touch)
 *   · every navigation action (Money Needs, Goals)
 *
 * These assertions must pass UNCHANGED after the port (brief §3: an assertion
 * edit is a STOP). The hub is rendered without a `look` prop — the Nexus look.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import {
  TENANT, UID, NOW, WEEK_START, WORKSHEET, YEAR_PLAN, MONTHLY_DRAFT, MONTHLY_COMMITTED,
  SUBMISSIONS, THIN_SUBMISSIONS, FLOORS, COMMITTED_WEEKLY_PLAN, SUGGESTIONS, hubProps,
} from './gamePlanCharFixtures';

vi.mock('../../../../hooks/useCountUp', () => ({ useCountUp: (value) => value }));
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'agent-1' }, tenantId: 'test-tenant' }),
}));
vi.mock('../../../../services/moneyNeedsService', () => ({ getMoneyNeeds: vi.fn() }));
vi.mock('../../../../services/yearPlanService', () => ({
  getYearPlan: vi.fn(),
  LINE_KEYS: ['life', 'ah', 'general'],
}));
vi.mock('../../../../services/monthlyPlanService', () => ({ getMonthlyPlan: vi.fn() }));
vi.mock('../../../../services/weeklyPlanService', () => ({
  getWeeklyPlan: vi.fn(),
  commitWeeklyPlan: vi.fn(),
  deleteWeeklyPlan: vi.fn(),
}));
vi.mock('../../../../services/dailyActivityService', () => ({
  getDailyEntriesForWeek: vi.fn(),
}));
vi.mock('../../../../services/planSuggestionsService', () => ({
  listPlanSuggestions: vi.fn(),
  markSuggestionSeen: vi.fn(),
}));
vi.mock('../../../../utils/validators', async (importOriginal) => ({
  ...(await importOriginal()),
  getRecentSundays: vi.fn(() => ['2026-09-20']),
}));

// The modals own their own save paths (untouched by this slice). Stubbed to
// capture the exact props the hub opens them with.
const modalProps = { monthly: null, review: null };
vi.mock('../../../agent/MonthlyPlanModal', () => ({
  default: (props) => {
    modalProps.monthly = props;
    return <div data-testid="stub-monthly-plan-modal" />;
  },
}));
vi.mock('../ReviewCommitModal', () => ({
  default: (props) => {
    modalProps.review = props;
    return <div data-testid="stub-review-commit-modal" />;
  },
}));

import GamePlanScreen from '../index';
import { getMoneyNeeds } from '../../../../services/moneyNeedsService';
import { getYearPlan } from '../../../../services/yearPlanService';
import { getMonthlyPlan } from '../../../../services/monthlyPlanService';
import { getWeeklyPlan, commitWeeklyPlan, deleteWeeklyPlan } from '../../../../services/weeklyPlanService';
import { getDailyEntriesForWeek } from '../../../../services/dailyActivityService';
import { listPlanSuggestions, markSuggestionSeen } from '../../../../services/planSuggestionsService';

function arrange({ worksheet = WORKSHEET, yearPlan = YEAR_PLAN, monthly = MONTHLY_DRAFT, weekly = null, suggestions = [] } = {}) {
  getMoneyNeeds.mockResolvedValue(worksheet);
  getYearPlan.mockResolvedValue(yearPlan);
  getMonthlyPlan.mockResolvedValue(monthly);
  getWeeklyPlan.mockResolvedValue(weekly);
  getDailyEntriesForWeek.mockResolvedValue([]);
  listPlanSuggestions.mockResolvedValue({ items: suggestions });
  markSuggestionSeen.mockResolvedValue(undefined);
  commitWeeklyPlan.mockResolvedValue(undefined);
  deleteWeeklyPlan.mockResolvedValue(undefined);
}

async function renderHub(props = {}) {
  const onOpenTab = vi.fn();
  const onPlanChanged = vi.fn();
  render(<GamePlanScreen onOpenTab={onOpenTab} onPlanChanged={onPlanChanged} {...props} />);
  await screen.findByTestId('game-plan-rail');
  return { onOpenTab, onPlanChanged };
}

beforeEach(() => {
  vi.clearAllMocks();
  modalProps.monthly = null;
  modalProps.review = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Game plan characterization — loads', () => {
  it('reads the three year docs, the weekly plan, the daily docs and the suggestions for this agent', async () => {
    arrange();
    await renderHub(hubProps());
    expect(getMoneyNeeds).toHaveBeenCalledWith(TENANT, UID, 2026);
    expect(getYearPlan).toHaveBeenCalledWith(TENANT, UID, 2026);
    expect(getMonthlyPlan).toHaveBeenCalledWith(TENANT, UID, 2026);
    await waitFor(() => expect(getWeeklyPlan).toHaveBeenCalledWith(TENANT, UID, WEEK_START));
    expect(getDailyEntriesForWeek).toHaveBeenCalledWith(TENANT, UID, WEEK_START);
    expect(listPlanSuggestions).toHaveBeenCalledWith({ tenantId: TENANT, agentId: UID });
  });
});

describe('Game plan characterization — not started', () => {
  it('prints the build-your-plan state, 0 of 3 steps, and the no-anchor week', async () => {
    arrange({ worksheet: null, yearPlan: null, monthly: null });
    const { onOpenTab } = await renderHub(hubProps({ committedAnnualAPI: null, submissions: [] }));

    const anchor = screen.getByTestId('game-plan-anchor');
    expect(anchor).toHaveTextContent('Build your 2026 plan');
    expect(anchor).toHaveTextContent('Start with Money Needs to see what you need to earn this year.');
    expect(anchor).toHaveTextContent('0%');
    expect(anchor).toHaveTextContent('0 of 3 steps');
    expect(anchor).toHaveTextContent('Set in your plan');

    const rail = screen.getByTestId('game-plan-rail');
    expect(rail).toHaveTextContent('Start');
    expect(rail).toHaveTextContent('What you need & how you write it');
    expect(rail).toHaveTextContent('Next');
    expect(rail).toHaveTextContent('Split into months');
    expect(rail).toHaveTextContent('Coming soon');
    // Step 3 is not reachable before the monthly plan exists.
    expect(within(rail).queryByRole('button', { name: /review & commit/i })).toBeNull();

    const cascade = screen.getByTestId('game-plan-cascade');
    expect(cascade).toHaveTextContent('Not started');
    expect(cascade).toHaveTextContent('Allocate to set');
    expect(cascade).toHaveTextContent('Set in your plan');
    expect(screen.getByTestId('commit-rung-ready')).toBeInTheDocument();

    const checklist = screen.getByTestId('plan-commit-checklist');
    expect(within(checklist).getByTestId('commit-check-moneyNeeds')).toHaveAttribute('data-done', 'false');
    expect(within(checklist).getByTestId('commit-check-yearPlan')).toHaveAttribute('data-done', 'false');
    expect(within(checklist).getByTestId('commit-check-monthly')).toHaveAttribute('data-done', 'false');
    expect(screen.getByTestId('plan-commit-cta')).toHaveTextContent('Review your plan');
    expect(screen.getByText('Finish the steps above to commit.')).toBeInTheDocument();

    expect(screen.getByTestId('suggested-week-no-anchor')).toHaveTextContent('Set a plan to see your week');
    fireEvent.click(screen.getByRole('button', { name: /build your game plan/i }));
    expect(onOpenTab).toHaveBeenCalledWith('goals');

    // Quiet by design: no suggestions → no card.
    await waitFor(() => expect(listPlanSuggestions).toHaveBeenCalled());
    expect(screen.queryByTestId('plan-suggestions-card')).toBeNull();
  });

  it('Money Needs step opens the Money Needs route', async () => {
    arrange({ worksheet: null, yearPlan: null, monthly: null });
    const { onOpenTab } = await renderHub(hubProps({ committedAnnualAPI: null }));
    fireEvent.click(within(screen.getByTestId('game-plan-rail')).getByRole('button', { name: /money needs/i }));
    expect(onOpenTab).toHaveBeenCalledWith('money-needs');
  });
});

describe('Game plan characterization — in progress (money needs + year plan + monthly draft)', () => {
  it('prints every derived figure', async () => {
    arrange();
    await renderHub(hubProps());

    const anchor = screen.getByTestId('game-plan-anchor');
    expect(anchor).toHaveTextContent('Earn TTD 200,000 in commission to cover your year');
    expect(anchor).toHaveTextContent(
      'TTD 225,280 gross need, TTD 25,280 from your renewal book — leaving TTD 200,000 to earn, a TTD 550,000 API commitment.',
    );
    expect(anchor).toHaveTextContent('67%');
    expect(anchor).toHaveTextContent('2 of 3 steps');
    expect(anchor).toHaveTextContent('After-Tax NeedTTD 191,460');
    expect(anchor).toHaveTextContent('Renewals CoverTTD 25,280');
    expect(anchor).toHaveTextContent('Commission NeedTTD 200,000');
    expect(anchor).toHaveTextContent('API CommitmentTTD 550,000');

    const rail = screen.getByTestId('game-plan-rail');
    expect(rail).toHaveTextContent('Allocated by line');
    expect(within(rail).getAllByText('Done')).toHaveLength(2);
    expect(rail).toHaveTextContent('Review & commit your plan');

    const cascade = screen.getByTestId('game-plan-cascade');
    expect(cascade).toHaveTextContent('Commission you must earn this yearTTD 200,000');
    expect(cascade).toHaveTextContent('Planned annual APITTD 550,000');
    expect(cascade).toHaveTextContent('Per-month target');
    expect(cascade).toHaveTextContent('TTD 45,833');
    // YTD: Σ actuals Jan–Sep (weeks bucketed by month) vs Σ targets Jan–Sep.
    expect(screen.getByTestId('monthly-ytd-badge')).toHaveTextContent('TTD 212,000 behind');
    expect(screen.getByTestId('cascade-alloc-legend-life')).toHaveTextContent('Life73%');
    expect(screen.getByTestId('cascade-alloc-legend-ah')).toHaveTextContent('A&H27%');
    expect(screen.queryByTestId('cascade-alloc-legend-general')).toBeNull();
    // Mini month strip: past/current = actual, future = target, as % of the max.
    const heights = Array.from({ length: 12 }, (_, i) => screen.getByTestId(`cascade-month-${i}`).style.height);
    expect(heights).toEqual([
      '6%', '6%', '6%', '6%', '6%', '6%', '44%', '100%', '49.333333333333336%', '80%', '80%',
      '73.33333333333333%',
    ]);

    const checklist = screen.getByTestId('plan-commit-checklist');
    ['moneyNeeds', 'yearPlan', 'monthly'].forEach((k) => {
      expect(within(checklist).getByTestId(`commit-check-${k}`)).toHaveAttribute('data-done', 'true');
    });
    expect(screen.getByTestId('plan-commit-cta')).toHaveTextContent('Review & commit your plan');
  });

  it('derives the suggested week from the 10-week history', async () => {
    arrange();
    await renderHub(hubProps());
    const derived = await screen.findByTestId('suggested-week-derived');
    expect(derived).toHaveTextContent('To stay on your TTD 550,000 plan, your week looks like:');
    const buttons = within(derived).getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Prospecting calls: 51 per week. Show how this is derived.');
    expect(buttons[1]).toHaveAccessibleName('CIs: 3 per week. Show how this is derived.');
    expect(buttons[2]).toHaveAccessibleName('Apps: 1 per week. Show how this is derived.');
    expect(derived).toHaveTextContent('20× per CI');
    expect(derived).toHaveTextContent('3× per app');
    expect(derived).toHaveTextContent('÷ TTD 15,000 avg policy');

    fireEvent.click(buttons[0]);
    const reveal = screen.getByTestId('suggested-week-reveal');
    expect(reveal).toHaveTextContent('TTD 550,000annual API');
    expect(reveal).toHaveTextContent('prospects / wk');
    expect(reveal).toHaveTextContent('auto-filled from your last 10 weeks of submitted reports');
  });

  it('opens the Monthly plan modal with the year plan, the history and the average policy', async () => {
    arrange();
    await renderHub(hubProps());
    fireEvent.click(within(screen.getByTestId('game-plan-rail')).getByRole('button', { name: /monthly plan/i }));
    expect(screen.getByTestId('stub-monthly-plan-modal')).toBeInTheDocument();
    expect(modalProps.monthly).toMatchObject({
      yearPlanAPI: 550000,
      submissions: SUBMISSIONS,
      year: 2026,
      avgPolicyAPI: 15000,
    });
    expect(typeof modalProps.monthly.onClose).toBe('function');
    expect(typeof modalProps.monthly.onAfterSave).toBe('function');
  });

  it('opens Review & commit with the plan state (from the rail and from the commit card)', async () => {
    arrange();
    await renderHub(hubProps());
    fireEvent.click(screen.getByTestId('plan-commit-cta'));
    expect(screen.getByTestId('stub-review-commit-modal')).toBeInTheDocument();
    expect(modalProps.review).toMatchObject({
      year: 2026,
      yearPlan: YEAR_PLAN,
      monthlyPlan: MONTHLY_DRAFT,
      yearPlanFilled: true,
      monthlyPlanFilled: true,
      yearPlanTotalAPI: 550000,
      avgPolicyAPI: 15000,
      committedAnnualAPI: 550000,
    });
  });

  it('Review & commit → Money Needs link closes the modal and routes to Money Needs', async () => {
    arrange();
    const { onOpenTab } = await renderHub(hubProps());
    fireEvent.click(within(screen.getByTestId('game-plan-rail')).getByRole('button', { name: /review & commit/i }));
    expect(modalProps.review).not.toBeNull();
    modalProps.review.onOpenMoneyNeeds();
    await waitFor(() => expect(screen.queryByTestId('stub-review-commit-modal')).toBeNull());
    expect(onOpenTab).toHaveBeenCalledWith('money-needs');
  });

  it('commits a weekly plan with the exact service arguments (derived pre-fill, one custom bump)', async () => {
    arrange();
    const { onPlanChanged } = await renderHub(hubProps());
    fireEvent.click(await screen.findByTestId('plan-this-week'));
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('51');
    expect(screen.getByTestId('plan-step-telContacts-value')).toHaveTextContent('40');
    expect(screen.getByTestId('plan-step-factFindsCompleted-value')).toHaveTextContent('10');
    expect(screen.getByTestId('plan-step-closingInterviewsKept-value')).toHaveTextContent('10');
    expect(screen.getByTestId('plan-step-applicationsSubmitted-value')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('plan-step-applicationsSubmitted-inc'));
    fireEvent.click(screen.getByTestId('weekly-plan-commit'));
    await waitFor(() => expect(commitWeeklyPlan).toHaveBeenCalledTimes(1));
    expect(commitWeeklyPlan).toHaveBeenCalledWith(
      TENANT,
      UID,
      WEEK_START,
      {
        targets: {
          callsMade: 51,
          telContacts: 40,
          factFindsCompleted: 10,
          closingInterviewsKept: 10,
          applicationsSubmitted: 2,
        },
        provenance: {
          callsMade: 'derived',
          telContacts: 'floor',
          factFindsCompleted: 'floor',
          closingInterviewsKept: 'floor',
          applicationsSubmitted: 'agent',
        },
        anchorAPIAtCommit: 550000,
      },
      FLOORS,
    );
    await waitFor(() => expect(onPlanChanged).toHaveBeenCalledTimes(1));
  });

  it('floor mode (fewer than 8 weeks) shows the company floor and commits floor provenance', async () => {
    arrange();
    await renderHub(hubProps({ submissions: THIN_SUBMISSIONS }));
    const floor = await screen.findByTestId('suggested-week-floor');
    expect(floor).toHaveTextContent('Based on the company floor until you have 8 weeks of history (you have 3)');
    ['40', '10', '1'].forEach((v) => expect(floor).toHaveTextContent(v));
    fireEvent.click(screen.getByTestId('plan-this-week'));
    fireEvent.click(screen.getByTestId('weekly-plan-commit'));
    await waitFor(() => expect(commitWeeklyPlan).toHaveBeenCalledTimes(1));
    expect(commitWeeklyPlan.mock.calls[0][3]).toEqual({
      targets: { ...FLOORS },
      provenance: {
        callsMade: 'floor',
        telContacts: 'floor',
        factFindsCompleted: 'floor',
        closingInterviewsKept: 'floor',
        applicationsSubmitted: 'floor',
      },
      anchorAPIAtCommit: 550000,
    });
  });
});

describe('Game plan characterization — committed', () => {
  it('prints the committed state on the rail, the cascade and the commit card', async () => {
    arrange({ monthly: MONTHLY_COMMITTED, weekly: COMMITTED_WEEKLY_PLAN });
    await renderHub(hubProps());

    const anchor = screen.getByTestId('game-plan-anchor');
    expect(anchor).toHaveTextContent('100%');
    expect(anchor).toHaveTextContent('3 of 3 steps');
    const rail = screen.getByTestId('game-plan-rail');
    expect(within(rail).getAllByText('Done')).toHaveLength(3);
    expect(rail).toHaveTextContent('Plan committed');
    expect(screen.getByTestId('commit-rung-committed')).toHaveTextContent('Committed · 1 Sept 2026 TT');
    expect(screen.getByTestId('plan-commit-card-committed')).toHaveTextContent('Committed');
    expect(screen.getByTestId('plan-commit-card')).toHaveTextContent('Your plan is committed');
    expect(screen.getByTestId('plan-commit-card-api')).toHaveTextContent('Personal commitment · TTD 550,000');
    expect(screen.getByTestId('plan-commit-cta')).toHaveTextContent('Review your plan');
  });

  it('shows the committed weekly plan as pace rows and clears it with the exact arguments', async () => {
    arrange({ monthly: MONTHLY_COMMITTED, weekly: COMMITTED_WEEKLY_PLAN });
    const { onPlanChanged } = await renderHub(hubProps());
    const committed = await screen.findByTestId('weekly-plan-committed');
    expect(committed).toHaveTextContent('Committed Sep 20');
    expect(screen.getByTestId('plan-committed-callsMade-value')).toHaveTextContent('80');
    expect(screen.getByTestId('plan-committed-closingInterviewsKept-value')).toHaveTextContent('12');
    expect(screen.getByTestId('plan-committed-applicationsSubmitted-value')).toHaveTextContent('3');
    expect(screen.getByTestId('weekly-plan-pace-readout')).toHaveTextContent('Day 3 of 6 → you should be at 50% of plan');

    fireEvent.click(screen.getByTestId('weekly-plan-clear'));
    await waitFor(() => expect(deleteWeeklyPlan).toHaveBeenCalledWith(TENANT, UID, WEEK_START));
    await waitFor(() => expect(onPlanChanged).toHaveBeenCalledTimes(1));
  });

  it('edits the committed weekly plan from its own values', async () => {
    arrange({ monthly: MONTHLY_COMMITTED, weekly: COMMITTED_WEEKLY_PLAN });
    await renderHub(hubProps());
    fireEvent.click(await screen.findByTestId('weekly-plan-edit-btn'));
    expect(screen.getByTestId('plan-step-callsMade-value')).toHaveTextContent('80');
    fireEvent.click(screen.getByTestId('weekly-plan-commit'));
    await waitFor(() => expect(commitWeeklyPlan).toHaveBeenCalledTimes(1));
    expect(commitWeeklyPlan).toHaveBeenCalledWith(
      TENANT, UID, WEEK_START,
      { targets: COMMITTED_WEEKLY_PLAN.targets, provenance: COMMITTED_WEEKLY_PLAN.provenance, anchorAPIAtCommit: 550000 },
      FLOORS,
    );
  });
});

describe('Game plan characterization — manager suggestions', () => {
  it('lists the suggestions, counts the unread, and acks only the open ones', async () => {
    arrange({ suggestions: SUGGESTIONS });
    await renderHub(hubProps());
    const card = await screen.findByTestId('plan-suggestions-card');
    expect(card).toHaveAttribute('data-clarity-mask', 'True');
    expect(screen.getByTestId('plan-suggestions-unread-count')).toHaveTextContent('1 new');
    const items = within(card).getAllByTestId('plan-suggestion-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute('data-unread', 'true');
    expect(items[0]).toHaveTextContent('Unit Manager A · Unit Manager · 18-09-2026');
    expect(items[1]).toHaveAttribute('data-unread', 'false');
    await waitFor(() => expect(markSuggestionSeen).toHaveBeenCalledTimes(1));
    expect(markSuggestionSeen).toHaveBeenCalledWith({ tenantId: TENANT, agentId: UID, suggestionId: 'sg-1' });
  });
});

describe('Game plan characterization — loading and error', () => {
  it('shows the retry block when the year docs fail, and retries the same reads', async () => {
    arrange();
    getMoneyNeeds.mockRejectedValueOnce(new Error('offline'));
    render(<GamePlanScreen onOpenTab={vi.fn()} {...hubProps()} />);
    expect(await screen.findByText('Could not load your plan. Check your connection and try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await screen.findByTestId('game-plan-rail');
    expect(getMoneyNeeds).toHaveBeenCalledTimes(2);
  });
});
