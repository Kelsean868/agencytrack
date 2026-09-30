// @vitest-environment jsdom
/**
 * FR Game plan (R2-8) — the FR look shows the SAME figures and makes the SAME
 * calls as the Nexus hub pinned by GamePlanHub.characterization.test.jsx, from
 * the same fixtures; the step gating matches StepRail for every flag set.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import {
  TENANT, UID, NOW, WEEK_START, WORKSHEET, YEAR_PLAN, MONTHLY_DRAFT, MONTHLY_COMMITTED,
  SUBMISSIONS, FLOORS, COMMITTED_WEEKLY_PLAN, SUGGESTIONS, hubProps,
} from '../../../dashboard/GamePlanV2/__tests__/gamePlanCharFixtures';

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
vi.mock('../../../../services/dailyActivityService', () => ({ getDailyEntriesForWeek: vi.fn() }));
vi.mock('../../../../services/planSuggestionsService', () => ({
  listPlanSuggestions: vi.fn(),
  markSuggestionSeen: vi.fn(),
}));
vi.mock('../../../../utils/validators', async (importOriginal) => ({
  ...(await importOriginal()),
  getRecentSundays: vi.fn(() => ['2026-09-20']),
}));
const modalProps = { monthly: null, review: null };
vi.mock('../../../agent/MonthlyPlanModal', () => ({
  default: (props) => {
    modalProps.monthly = props;
    return <div data-testid="stub-monthly-plan-modal" />;
  },
}));
vi.mock('../../../dashboard/GamePlanV2/ReviewCommitModal', () => ({
  default: (props) => {
    modalProps.review = props;
    return <div data-testid="stub-review-commit-modal" />;
  },
}));

import GamePlanScreen from '../../../dashboard/GamePlanV2/index';
import StepRail from '../../../dashboard/GamePlanV2/StepRail';
import { gamePlanModel } from '../gamePlanModel';
import { getMoneyNeeds } from '../../../../services/moneyNeedsService';
import { getYearPlan } from '../../../../services/yearPlanService';
import { getMonthlyPlan } from '../../../../services/monthlyPlanService';
import { getWeeklyPlan, commitWeeklyPlan, deleteWeeklyPlan } from '../../../../services/weeklyPlanService';
import { getDailyEntriesForWeek } from '../../../../services/dailyActivityService';
import { listPlanSuggestions, markSuggestionSeen } from '../../../../services/planSuggestionsService';

function installMatchMedia(wide) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query) => ({
      matches: wide && query === '(min-width: 768px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

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

async function renderFr(props = {}) {
  const onOpenTab = vi.fn();
  const onPlanChanged = vi.fn();
  render(<GamePlanScreen look="fr" onOpenTab={onOpenTab} onPlanChanged={onPlanChanged} {...props} />);
  await screen.findByTestId('fr-game-plan');
  return { onOpenTab, onPlanChanged };
}

beforeEach(() => {
  vi.clearAllMocks();
  modalProps.monthly = null;
  modalProps.review = null;
  installMatchMedia(true);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FR Game plan — replaces the Nexus content only under the FR look', () => {
  it('renders the FR layout and none of the Nexus hub blocks', async () => {
    arrange();
    await renderFr(hubProps());
    expect(screen.getByTestId('fr-game-plan-wide')).toBeInTheDocument();
    ['game-plan-anchor', 'game-plan-rail', 'game-plan-cascade', 'plan-commit-card'].forEach((id) => {
      expect(screen.queryByTestId(id)).toBeNull();
    });
    // The existing weekly planner is mounted once, on an FR card (no Nexus glass hero).
    const week = await screen.findByTestId('suggested-week-card');
    expect(week).not.toHaveClass('glass');
    expect(week).toHaveClass('bg-card');
  });

  it('without a look prop the hub stays Nexus (ManagerDashboard path)', async () => {
    arrange();
    render(<GamePlanScreen onOpenTab={vi.fn()} {...hubProps()} />);
    await screen.findByTestId('game-plan-rail');
    expect(screen.queryByTestId('fr-game-plan')).toBeNull();
    expect(screen.getByTestId('suggested-week-card')).toHaveClass('glass', 'hero', 'teal');
  });
});

describe('FR Game plan — same figures as the Nexus hub (in progress fixture)', () => {
  it('prints the characterized figures', async () => {
    arrange();
    await renderFr(hubProps());
    expect(screen.getByTestId('fr-gp-badge')).toHaveTextContent('2/3 steps built · 67%');
    const s1 = screen.getByTestId('fr-gp-step-money-needs');
    expect(s1).toHaveTextContent('TTD 200,000 commission to earn');
    expect(s1).toHaveTextContent('TTD 550,000 API allocated by line');
    expect(s1).toHaveTextContent('Done');
    const s2 = screen.getByTestId('fr-gp-step-monthly');
    expect(s2).toHaveTextContent('TTD 45,833.33 a month');
    expect(s2).toHaveTextContent('TTD 212,000 behind');
    const s3 = screen.getByTestId('fr-gp-step-review');
    expect(s3).toHaveTextContent('Ready');
    expect(s3).toHaveTextContent('Review & commit your plan');

    const commitment = screen.getByTestId('fr-gp-commitment');
    expect(commitment).toHaveTextContent('TTD 550,000');
    expect(commitment).toHaveTextContent('2 of 3 steps built · 67%');
    expect(screen.getByTestId('fr-gp-commit-tag')).toHaveTextContent('Draft · not committed yet');
    const chain = screen.getByTestId('fr-gp-chain');
    expect(chain).toHaveTextContent('After-tax needTTD 191,460');
    expect(chain).toHaveTextContent('Gross needTTD 225,280');
    expect(chain).toHaveTextContent('Renewals coverTTD 25,280');
    expect(chain).toHaveTextContent('Commission needTTD 200,000');

    const monthly = screen.getByTestId('fr-gp-monthly');
    expect(monthly).toHaveTextContent('TTD 212,000 behind your monthly plan so far');
    expect(monthly).toHaveTextContent('TTD 550,000 a year, TTD 45,833.33 a month on average');
    expect(screen.getByTestId('fr-gp-line-life')).toHaveTextContent('LifeTTD 400,000 · 73%');
    expect(screen.getByTestId('fr-gp-line-ah')).toHaveTextContent('A&HTTD 150,000 · 27%');
    expect(screen.queryByTestId('fr-gp-line-general')).toBeNull();
    // Table toggle: plan per month + what weekly reports show so far (Sep = current).
    fireEvent.click(within(monthly).getByRole('button', { name: 'Table' }));
    const rows = within(monthly).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('JanTTD 30,000TTD 0');
    expect(rows[8]).toHaveTextContent('AugTTD 50,000TTD 75,000');
    expect(rows[9]).toHaveTextContent('SepTTD 55,000TTD 37,000');
    expect(rows[10]).toHaveTextContent('OctTTD 60,000—');

    const checklist = screen.getByTestId('fr-gp-checklist');
    ['moneyNeeds', 'yearPlan', 'monthly'].forEach((k) => {
      expect(within(checklist).getByTestId(`fr-gp-check-${k}`)).toHaveAttribute('data-done', 'true');
    });
    expect(screen.getByTestId('fr-gp-commit-cta')).toHaveTextContent('Review & commit your plan');

    const derived = await screen.findByTestId('suggested-week-derived');
    expect(derived).toHaveTextContent('To stay on your TTD 550,000 plan, your week looks like:');
    expect(within(derived).getAllByRole('button')[0]).toHaveAccessibleName('Prospecting calls: 51 per week. Show how this is derived.');
  });
});

describe('FR Game plan — same actions, same arguments', () => {
  it('Money needs step routes to Money Needs', async () => {
    arrange();
    const { onOpenTab } = await renderFr(hubProps());
    fireEvent.click(screen.getByTestId('fr-gp-step-money-needs'));
    expect(onOpenTab).toHaveBeenCalledWith('money-needs');
  });

  it('Monthly plan (step card and edit button) opens the existing modal with the same props', async () => {
    arrange();
    await renderFr(hubProps());
    fireEvent.click(screen.getByTestId('fr-gp-step-monthly'));
    expect(screen.getByTestId('stub-monthly-plan-modal')).toBeInTheDocument();
    expect(modalProps.monthly).toMatchObject({ yearPlanAPI: 550000, submissions: SUBMISSIONS, year: 2026, avgPolicyAPI: 15000 });
    modalProps.monthly.onClose();
    await waitFor(() => expect(screen.queryByTestId('stub-monthly-plan-modal')).toBeNull());
    fireEvent.click(screen.getByTestId('fr-gp-edit-months'));
    expect(screen.getByTestId('stub-monthly-plan-modal')).toBeInTheDocument();
  });

  it('Review and commit (panel CTA and step card) opens the existing modal with the same props', async () => {
    arrange();
    const { onOpenTab } = await renderFr(hubProps());
    fireEvent.click(screen.getByTestId('fr-gp-commit-cta'));
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
    modalProps.review.onOpenMoneyNeeds();
    await waitFor(() => expect(screen.queryByTestId('stub-review-commit-modal')).toBeNull());
    expect(onOpenTab).toHaveBeenCalledWith('money-needs');
    fireEvent.click(screen.getByTestId('fr-gp-step-review'));
    expect(screen.getByTestId('stub-review-commit-modal')).toBeInTheDocument();
  });

  it('commits a weekly plan with the characterized arguments', async () => {
    arrange();
    const { onPlanChanged } = await renderFr(hubProps());
    fireEvent.click(await screen.findByTestId('plan-this-week'));
    fireEvent.click(screen.getByTestId('plan-step-applicationsSubmitted-inc'));
    fireEvent.click(screen.getByTestId('weekly-plan-commit'));
    await waitFor(() => expect(commitWeeklyPlan).toHaveBeenCalledTimes(1));
    expect(commitWeeklyPlan).toHaveBeenCalledWith(
      TENANT, UID, WEEK_START,
      {
        targets: { callsMade: 51, telContacts: 40, factFindsCompleted: 10, closingInterviewsKept: 10, applicationsSubmitted: 2 },
        provenance: { callsMade: 'derived', telContacts: 'floor', factFindsCompleted: 'floor', closingInterviewsKept: 'floor', applicationsSubmitted: 'agent' },
        anchorAPIAtCommit: 550000,
      },
      FLOORS,
    );
    await waitFor(() => expect(onPlanChanged).toHaveBeenCalledTimes(1));
  });

  it('committed: shows the committed state and clears the weekly plan with the same arguments', async () => {
    arrange({ monthly: MONTHLY_COMMITTED, weekly: COMMITTED_WEEKLY_PLAN });
    await renderFr(hubProps());
    expect(screen.getByTestId('fr-gp-badge')).toHaveTextContent('3/3 steps built · 100%');
    expect(screen.getByTestId('fr-gp-commit-tag')).toHaveTextContent('Committed 1 Sept 2026');
    expect(screen.getByTestId('fr-gp-step-review')).toHaveTextContent('Committed · 1 Sept 2026 TT');
    expect(screen.getByTestId('fr-gp-commit')).toHaveTextContent('Your plan is committed');
    expect(screen.getByTestId('fr-gp-commit-api')).toHaveTextContent('Personal commitment · TTD 550,000');
    expect(screen.getByTestId('fr-gp-commit-cta')).toHaveTextContent('Review your plan');
    fireEvent.click(await screen.findByTestId('weekly-plan-clear'));
    await waitFor(() => expect(deleteWeeklyPlan).toHaveBeenCalledWith(TENANT, UID, WEEK_START));
  });

  it('manager suggestions: same card, same ack', async () => {
    arrange({ suggestions: SUGGESTIONS });
    await renderFr(hubProps());
    expect(await screen.findByTestId('plan-suggestions-card')).toHaveTextContent('1 new');
    await waitFor(() => expect(markSuggestionSeen).toHaveBeenCalledWith({ tenantId: TENANT, agentId: UID, suggestionId: 'sg-1' }));
    expect(markSuggestionSeen).toHaveBeenCalledTimes(1);
  });
});

describe('FR Game plan — not started, and the phone layout', () => {
  it('not started: honest words, Step 3 locked, no fake zeros', async () => {
    arrange({ worksheet: null, yearPlan: null, monthly: null });
    const { onOpenTab } = await renderFr(hubProps({ committedAnnualAPI: null, submissions: [] }));
    expect(screen.getByTestId('fr-gp-badge')).toHaveTextContent('0/3 steps built · 0%');
    expect(screen.getByTestId('fr-gp-step-money-needs')).toHaveTextContent('Not started');
    const s3 = screen.getByTestId('fr-gp-step-review');
    expect(s3).toHaveAttribute('aria-disabled', 'true');
    expect(s3).toHaveTextContent('Finish your monthly plan first');
    expect(screen.getByTestId('fr-gp-commitment')).toHaveTextContent('Not set yet');
    expect(screen.queryByTestId('fr-gp-chain')).toBeNull();
    expect(screen.getByTestId('fr-gp-months-empty')).toBeInTheDocument();
    expect(screen.getByTestId('fr-gp-by-line')).toHaveTextContent('Not allocated yet');
    expect(screen.getByTestId('fr-gp-commit-cta')).toHaveTextContent('Review your plan');
    expect(screen.getByText('Finish the steps above to commit.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /build your game plan/i }));
    expect(onOpenTab).toHaveBeenCalledWith('goals');
  });

  it('phone: four named swipe pages, each slot mounted once', async () => {
    installMatchMedia(false);
    arrange();
    await renderFr(hubProps());
    expect(screen.getByTestId('fr-game-plan-phone')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab', { hidden: true });
    expect(tabs.map((t) => t.textContent)).toEqual(['Steps', 'Monthly plan', 'This week', 'Commit']);
    expect(screen.getAllByTestId('suggested-week-card')).toHaveLength(1);
    expect(screen.getAllByTestId('fr-gp-commit')).toHaveLength(1);
  });
});

// Step gating parity: the FR step kickers equal StepRail's for every flag set
// the hub can produce (committed is loop-gated upstream, as in the hub).
describe('gamePlanModel — step gating matches StepRail', () => {
  const seen = new Set();
  const combos = [];
  [false, true].forEach((loop) => [false, true].forEach((mn) => [false, true].forEach((yp) =>
    [false, true].forEach((mp) => [false, true].forEach((c) => {
      const combo = { loop, mn, yp, mp: loop && mp, c: loop && mp && c };
      const key = JSON.stringify(combo);
      if (seen.has(key)) return;
      seen.add(key);
      combos.push(combo);
    })))));

  it.each(combos)('loop=$loop moneyNeeds=$mn yearPlan=$yp monthly=$mp committed=$c', ({ loop, mn, yp, mp, c }) => {
    const { container, unmount } = render(
      <StepRail
        moneyNeedsFilled={mn}
        onOpenMoneyNeeds={() => {}}
        yearPlanFilled={yp}
        onOpenMonthlyPlan={loop ? () => {} : undefined}
        monthlyPlanFilled={mp}
        onOpenReviewCommit={loop ? () => {} : undefined}
        committed={c}
      />,
    );
    const railKickers = Array.from(container.querySelectorAll('.font-mono')).map((n) => n.textContent);
    const railClickable = ['money needs', 'monthly plan', 'review & commit'].map(
      (name) => within(container).queryByRole('button', { name: new RegExp(name, 'i') }) !== null,
    );
    unmount();
    const model = gamePlanModel({
      year: 2026, moneyNeedsFilled: mn, loopEnabled: loop, yearPlanFilled: yp, yearPlanTotalAPI: yp ? 1 : 0,
      monthlyPlanFilled: mp, monthlyPlanTotal: 0, monthlyTargets: [], monthlyActuals: [], currentMonthIndex: 0,
      monthlyYtdDelta: 0, committed: c, committedAt: null, committedAnnualAPI: null, lineKeys: [],
      stepsBuilt: 0, totalSteps: 3, planBuiltPct: 0,
    });
    const coming = (k) => (k === 'Coming' ? 'Coming' : k);
    expect(model.steps.map((s) => coming(s.kicker))).toEqual(railKickers);
    expect(model.steps.map((s) => s.active)).toEqual(railClickable);
  });
});
