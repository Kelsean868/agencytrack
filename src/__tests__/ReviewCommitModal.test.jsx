import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ReviewCommitModal from '../components/dashboard/GamePlanV2/ReviewCommitModal';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    tenantId: 't1',
    user: { uid: 'u1', displayName: 'Agent A' },
  }),
}));

const commitPlanMock = vi.fn();
const setGoalsMock = vi.fn();

vi.mock('../services/commitPlanService', () => ({
  commitPlan: (...args) => commitPlanMock(...args),
  // Error classes — modal uses .name discriminant, so plain constructors suffice
  BelowApiFloorError: class extends Error {
    constructor(floor, planTotal) {
      super('Below API floor');
      this.name = 'BelowApiFloorError';
      this.floor = floor;
      this.planTotal = planTotal;
    }
  },
  BelowAppsFloorError: class extends Error {
    constructor(floor, actual, avgPolicyAPI) {
      super('Below apps floor');
      this.name = 'BelowAppsFloorError';
      this.floor = floor;
      this.actual = actual;
      this.avgPolicyAPI = avgPolicyAPI;
    }
  },
  AvgPolicyMissingError: class extends Error {
    constructor() {
      super('Missing avg');
      this.name = 'AvgPolicyMissingError';
    }
  },
}));

vi.mock('../services/goalsService', () => ({
  setGoals: (...args) => setGoalsMock(...args),
}));

// Helpers to build typed errors for mockRejectedValue
const mkApiFloorErr = (floor, planTotal) =>
  Object.assign(new Error('Below API floor'), { name: 'BelowApiFloorError', floor, planTotal });
const mkAppsFloorErr = (floor, actual, avgPolicyAPI) =>
  Object.assign(new Error('Below apps floor'), { name: 'BelowAppsFloorError', floor, actual, avgPolicyAPI });
const mkAvgMissingErr = () =>
  Object.assign(new Error('Missing avg'), { name: 'AvgPolicyMissingError' });

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DRAFT_YEAR_PLAN = {
  status: 'draft',
  lines: {
    life:     { targetAPI: 150000, enabled: true },
    ah:       { targetAPI: 50000,  enabled: true },
    property: { enabled: false },
    motor:    { enabled: false },
  },
};

const DRAFT_MONTHLY_PLAN = {
  anchorAPI: 200000,
  targets: Array(12).fill(200000 / 12),
  status: 'draft',
};

const BASE_PROPS = {
  onClose:            vi.fn(),
  year:               2026,
  yearPlan:           DRAFT_YEAR_PLAN,
  monthlyPlan:        DRAFT_MONTHLY_PLAN,
  yearPlanFilled:     true,
  monthlyPlanFilled:  true,
  yearPlanTotalAPI:   200000,
  avgPolicyAPI:       10000,
  committedAnnualAPI: null,
  onAfterCommit:      vi.fn(),
  onOpenYearPlan:     vi.fn(),
  onOpenMonthlyPlan:  vi.fn(),
};

function setup(props = {}) {
  const user = userEvent.setup();
  render(<ReviewCommitModal {...BASE_PROPS} {...props} />);
  return { user };
}

// Navigate from PlanReview → CommitConsequence → CommitConfirm
async function advanceToConfirm(user) {
  await user.click(screen.getByTestId('review-continue-btn'));
  await user.click(screen.getByTestId('consequence-continue-btn'));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReviewCommitModal', () => {
  beforeEach(() => {
    commitPlanMock.mockReset();
    setGoalsMock.mockReset();
    vi.mocked(BASE_PROPS.onClose).mockReset();
    vi.mocked(BASE_PROPS.onAfterCommit).mockReset();
  });

  it('renders PlanReview with annual API and year-plan lines', () => {
    setup();
    expect(screen.getByTestId('review-api')).toHaveTextContent('200');
    expect(screen.getByText('Life')).toBeInTheDocument();
    expect(screen.getByText('A&H')).toBeInTheDocument();
    // Continue button present when both plans filled
    expect(screen.getByTestId('review-continue-btn')).toBeInTheDocument();
  });

  it('shows Year Plan incomplete warning and hides Continue when yearPlanFilled=false', () => {
    setup({ yearPlanFilled: false, yearPlanTotalAPI: 0 });
    expect(screen.getByText(/Year Plan not drafted/i)).toBeInTheDocument();
    expect(screen.queryByTestId('review-continue-btn')).not.toBeInTheDocument();
  });

  it('shows Monthly Plan incomplete warning and hides Continue when monthlyPlanFilled=false', () => {
    setup({ monthlyPlanFilled: false });
    expect(screen.getByText(/Monthly Plan not drafted/i)).toBeInTheDocument();
    expect(screen.queryByTestId('review-continue-btn')).not.toBeInTheDocument();
  });

  it('navigates review → consequence → confirm', async () => {
    const { user } = setup();
    expect(screen.getByText('Review your plan')).toBeInTheDocument();

    await user.click(screen.getByTestId('review-continue-btn'));
    expect(screen.getByText('What committing means')).toBeInTheDocument();
    expect(screen.getByLabelText('5-layer goal hierarchy')).toBeInTheDocument();

    await user.click(screen.getByTestId('consequence-continue-btn'));
    expect(screen.getByText('Confirm commitment')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-api')).toBeInTheDocument();
    expect(screen.getByTestId('commit-btn')).toBeInTheDocument();
  });

  it('happy path: commits successfully and shows CommittedDone', async () => {
    commitPlanMock.mockResolvedValue(undefined);
    const { user } = setup();
    await advanceToConfirm(user);

    await user.click(screen.getByTestId('commit-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('committed-done')).toBeInTheDocument()
    );

    expect(commitPlanMock).toHaveBeenCalledWith(
      't1', 'u1', 2026,
      expect.objectContaining({ annualAPI: 200000 })
    );
    expect(screen.getByTestId('done-api')).toHaveTextContent('200');
    expect(screen.getByText(/4 \/ 4/)).toBeInTheDocument();
    expect(BASE_PROPS.onAfterCommit).toHaveBeenCalledTimes(1);
  });

  it('shows BelowApiFloorError with floor and link back to Year Plan', async () => {
    commitPlanMock.mockRejectedValue(mkApiFloorErr(250000, 200000));
    const { user } = setup();
    await advanceToConfirm(user);

    await user.click(screen.getByTestId('commit-btn'));
    await waitFor(() =>
      expect(screen.getByText(/below your API floor/i)).toBeInTheDocument()
    );

    expect(screen.getByText(/250/)).toBeInTheDocument(); // floor value
    expect(screen.getByRole('button', { name: /go to year plan/i })).toBeInTheDocument();
    expect(BASE_PROPS.onAfterCommit).not.toHaveBeenCalled();
  });

  it('shows BelowAppsFloorError with actual and floor counts', async () => {
    commitPlanMock.mockRejectedValue(mkAppsFloorErr(42, 20, 10000));
    const { user } = setup();
    await advanceToConfirm(user);

    await user.click(screen.getByTestId('commit-btn'));
    await waitFor(() =>
      expect(screen.getByText(/below the apps floor/i)).toBeInTheDocument()
    );

    expect(screen.getByText(/20\.0 apps/i)).toBeInTheDocument();
    expect(screen.getByText(/minimum of 42/i)).toBeInTheDocument();
  });

  it('shows inline avg capture on AvgPolicyMissingError, saves, and re-runs commit', async () => {
    commitPlanMock
      .mockRejectedValueOnce(mkAvgMissingErr())
      .mockResolvedValueOnce(undefined);
    setGoalsMock.mockResolvedValue(undefined);

    const { user } = setup({ avgPolicyAPI: null });
    await advanceToConfirm(user);

    await user.click(screen.getByTestId('commit-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('avg-capture')).toBeInTheDocument()
    );

    // Inline field is visible; commit button hidden while avg-missing
    expect(screen.queryByTestId('commit-btn')).not.toBeInTheDocument();

    await user.type(screen.getByTestId('avg-policy-input'), '8000');
    await user.click(screen.getByTestId('save-avg-btn'));

    await waitFor(() =>
      expect(setGoalsMock).toHaveBeenCalledWith(
        't1', 'u1',
        { playgroundAvgPolicyAPI: 8000 },
        'u1', 'Agent A'
      )
    );
    await waitFor(() =>
      expect(commitPlanMock).toHaveBeenCalledTimes(2)
    );
    await waitFor(() =>
      expect(screen.getByTestId('committed-done')).toBeInTheDocument()
    );
  });

  it('re-commit: opens in done state when yearPlan already committed, re-open routes to confirm', async () => {
    commitPlanMock.mockResolvedValue(undefined);
    const committedYearPlan = {
      ...DRAFT_YEAR_PLAN,
      status: 'committed',
      committedAt: { toDate: () => new Date('2026-06-10') },
    };
    const { user } = setup({
      yearPlan: committedYearPlan,
      committedAnnualAPI: 200000,
    });

    // Starts in done state
    expect(screen.getByTestId('committed-done')).toBeInTheDocument();
    expect(screen.getByTestId('done-api')).toHaveTextContent('200');

    // Re-open → CommitConfirm (skips review + consequence)
    await user.click(screen.getByTestId('reopen-btn'));
    expect(screen.getByText('Confirm commitment')).toBeInTheDocument();
    expect(screen.getByTestId('commit-btn')).toBeInTheDocument();

    // Commit again → back to done
    await user.click(screen.getByTestId('commit-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('committed-done')).toBeInTheDocument()
    );
    expect(commitPlanMock).toHaveBeenCalledTimes(1);
  });

  it('shows generic failed state on unexpected error', async () => {
    commitPlanMock.mockRejectedValue(new Error('Network error'));
    const { user } = setup();
    await advanceToConfirm(user);

    await user.click(screen.getByTestId('commit-btn'));
    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/transaction rolled back/i)).toBeInTheDocument();
  });

  it('closes on X button click', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(BASE_PROPS.onClose).toHaveBeenCalledTimes(1);
  });
});
