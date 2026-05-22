// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Auth mock (mutable — isUpline gate tests override role) ───────────────────

const DEFAULT_MOCK_AUTH = {
  user:        { uid: 'sm1' },
  role:        'sales_manager',
  userProfile: { branchId: null },
  tenantId:    'test-tenant',
};
let mockAuth = { ...DEFAULT_MOCK_AUTH };

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ ...mockAuth }),
}));

// ── Component mocks ───────────────────────────────────────────────────────────

vi.mock('../ManagerOverrideModal', () => ({
  default: () => <div data-testid="override-modal" />,
}));

import ManagerWarDetail from '../ManagerWarDetail';

beforeEach(() => {
  mockAuth = { ...DEFAULT_MOCK_AUTH };
});

const BASE_WAR = {
  managerId:            'bm1',
  managerName:          'Branch Mgr 1',
  managerRole:          'branch_manager',
  managerRoleRank:      2,
  branchId:             'branch-a',
  weekStart:            '2026-05-18',
  status:               'submitted',
  oneOnOnesConducted:   3,
  namesSourced:         5,
  interviewsConducted:  2,
  recruitsInFirstWeeks: 1,
  trainingSessions:     1,
  trainingTopic:        '',
  unitMeetingHeld:      true,
  attendanceCount:      12,
  dashboardReviewDone:  true,
  jfwCount:             2,
};

function renderDetail(overrides = {}, onBack = vi.fn(), resolvedStds = undefined) {
  return render(
    <ManagerWarDetail
      warData={{ ...BASE_WAR, ...overrides }}
      onBack={onBack}
      resolvedStds={resolvedStds}
    />
  );
}

describe('ManagerWarDetail — rendering', () => {
  it('shows manager name and role', () => {
    renderDetail();
    expect(screen.getByText('Branch Mgr 1')).toBeInTheDocument();
    expect(screen.getByText(/branch manager/i)).toBeInTheDocument();
  });

  it('shows weekStart and status', () => {
    renderDetail();
    expect(screen.getByText(/2026-05-18/)).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('shows "Draft" for non-submitted status', () => {
    renderDetail({ status: 'draft' });
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders all numeric activity fields', () => {
    renderDetail();
    expect(screen.getByText('One-on-One Pipeline Reviews')).toBeInTheDocument();
    expect(screen.getByText('Names Sourced')).toBeInTheDocument();
    expect(screen.getByText('Initial Interviews Conducted')).toBeInTheDocument();
    expect(screen.getByText('New Recruits in First Weeks')).toBeInTheDocument();
    expect(screen.getByText('Training Sessions Delivered')).toBeInTheDocument();
  });

  it('renders training topic when present', () => {
    renderDetail({ trainingTopic: 'Objection handling' });
    expect(screen.getByText('Training Topic')).toBeInTheDocument();
    expect(screen.getByText('Objection handling')).toBeInTheDocument();
  });

  it('does NOT render training topic when empty', () => {
    renderDetail({ trainingTopic: '' });
    expect(screen.queryByText('Training Topic')).not.toBeInTheDocument();
  });

  it('renders attendance count when unitMeetingHeld is true', () => {
    renderDetail({ unitMeetingHeld: true, attendanceCount: 12 });
    expect(screen.getByText('Attendance Count')).toBeInTheDocument();
  });

  it('does NOT render attendance count when unitMeetingHeld is false', () => {
    renderDetail({ unitMeetingHeld: false, attendanceCount: null });
    expect(screen.queryByText('Attendance Count')).not.toBeInTheDocument();
  });

  it('renders JFW count from warData.jfwCount (I1.3a stored value)', () => {
    renderDetail({ jfwCount: 4 });
    expect(screen.getByLabelText(/joint field work count: 4/i)).toBeInTheDocument();
  });

  it('renders JFW count as 0 when jfwCount is null', () => {
    renderDetail({ jfwCount: null });
    expect(screen.getByLabelText(/joint field work count: 0/i)).toBeInTheDocument();
  });

  it('shows personal production section when personalApi + personalApps are present', () => {
    renderDetail({ personalApi: 1500.5, personalApps: 2 });
    expect(screen.getByText(/personal production/i)).toBeInTheDocument();
    expect(screen.getByText('Personal API (TTD)')).toBeInTheDocument();
    expect(screen.getByText('Personal Applications')).toBeInTheDocument();
  });

  it('does NOT show personal production when fields are absent', () => {
    renderDetail({ personalApi: undefined, personalApps: undefined });
    expect(screen.queryByText(/personal production/i)).not.toBeInTheDocument();
  });
});

describe('ManagerWarDetail — navigation', () => {
  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    renderDetail({}, onBack);
    fireEvent.click(screen.getByRole('button', { name: /back to list/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ── Activity standards overlay ─────────────────────────────────────────────────

// resolvedStds is already a flat map (pre-resolved by getResolvedStandards).
const BM_STANDARDS = {
  jfwCount:             3,
  oneOnOnesConducted:   5,
  namesSourced:         10,
  interviewsConducted:  4,
  recruitsInFirstWeeks: 2,
  trainingSessions:     2,
  unitMeetingHeld:      true,
  dashboardReviewDone:  true,
};

describe('ManagerWarDetail — standards overlay', () => {
  it('shows actual-only (no target) when no resolvedStds prop', () => {
    renderDetail({ oneOnOnesConducted: 3 }, vi.fn(), undefined);
    expect(screen.queryByLabelText(/one-on-one.*of \d/i)).not.toBeInTheDocument();
  });

  it('shows actual / target for a numeric field when standard is set', () => {
    renderDetail({ oneOnOnesConducted: 3 }, vi.fn(), BM_STANDARDS);
    expect(screen.getByLabelText(/one-on-one pipeline reviews: 3 of 5/i)).toBeInTheDocument();
  });

  it('shows met styling for a numeric field when actual >= target', () => {
    renderDetail({ oneOnOnesConducted: 5 }, vi.fn(), BM_STANDARDS);
    expect(screen.getByLabelText(/one-on-one pipeline reviews: 5 of 5/i)).toBeInTheDocument();
  });

  it('shows actual / target on JFW when standard is set', () => {
    renderDetail({ jfwCount: 2 }, vi.fn(), BM_STANDARDS);
    expect(screen.getByLabelText(/joint field work count: 2 of 3/i)).toBeInTheDocument();
  });

  it('shows actual-only on JFW when no jfwCount standard', () => {
    renderDetail({ jfwCount: 2 }, vi.fn(), {});
    expect(screen.getByLabelText(/joint field work count: 2$/i)).toBeInTheDocument();
  });

  it('shows boolean badge(s) when boolean standards are expected', () => {
    renderDetail({ unitMeetingHeld: true, dashboardReviewDone: true }, vi.fn(), BM_STANDARDS);
    const metBadges = screen.getAllByLabelText(/standard met/i);
    expect(metBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "expected" badge when standard set but boolean is false', () => {
    renderDetail({ unitMeetingHeld: false, dashboardReviewDone: false }, vi.fn(), BM_STANDARDS);
    const notMetBadges = screen.getAllByLabelText(/standard not met/i);
    expect(notMetBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows no badge when no boolean standard', () => {
    renderDetail({ unitMeetingHeld: true }, vi.fn(), {});
    expect(screen.queryByLabelText(/standard (met|not met)/i)).not.toBeInTheDocument();
  });
});

// ── Custom standards button (isUpline gate) ────────────────────────────────────

describe('ManagerWarDetail — custom standards button (isUpline gate)', () => {
  it('shows Custom standards button when viewer outranks the subject', () => {
    // Default: SM (rank 3) viewing BM (rank 2) → 3 > 2 && rank >= 3 → isUpline
    renderDetail();
    expect(screen.getByRole('button', { name: /custom standards/i })).toBeInTheDocument();
  });

  it('hides Custom standards button when viewer does not outrank the subject', () => {
    // UM (rank 1) viewing BM (rank 2) → 1 > 2 = false → not upline
    mockAuth = { ...DEFAULT_MOCK_AUTH, user: { uid: 'um1' }, role: 'unit_manager',
                 userProfile: { branchId: 'branch-a' } };
    renderDetail(); // BASE_WAR: BM rank 2
    expect(screen.queryByRole('button', { name: /custom standards/i })).not.toBeInTheDocument();
  });

  it('opens ManagerOverrideModal when Custom standards button is clicked', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /custom standards/i }));
    expect(screen.getByTestId('override-modal')).toBeInTheDocument();
  });
});

// ── I3a Tier-1 accountability flag ────────────────────────────────────────────

describe('ManagerWarDetail — I3a accountability flag panel', () => {
  it('is hidden when no resolvedStds prop', () => {
    renderDetail({}, vi.fn(), undefined);
    expect(screen.queryByTestId('accountability-flag-panel')).not.toBeInTheDocument();
  });

  it('is hidden when all standards are met', () => {
    renderDetail(
      {
        oneOnOnesConducted: 5, namesSourced: 10, interviewsConducted: 4,
        recruitsInFirstWeeks: 2, trainingSessions: 2,
        unitMeetingHeld: true, dashboardReviewDone: true, jfwCount: 3,
      },
      vi.fn(),
      BM_STANDARDS,
    );
    expect(screen.queryByTestId('accountability-flag-panel')).not.toBeInTheDocument();
  });

  it('renders the panel listing under-target activities', () => {
    renderDetail(
      { namesSourced: 4, oneOnOnesConducted: 1 },
      vi.fn(),
      BM_STANDARDS,
    );
    const panel = screen.getByTestId('accountability-flag-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId('accountability-flag-row-namesSourced')).toBeInTheDocument();
    expect(screen.getByTestId('accountability-flag-row-oneOnOnesConducted')).toBeInTheDocument();
    expect(panel).toHaveTextContent(/standards under target/i);
  });

  it('flags a boolean expectation that is not met', () => {
    renderDetail(
      { unitMeetingHeld: false },
      vi.fn(),
      { unitMeetingHeld: true },
    );
    expect(screen.getByTestId('accountability-flag-row-unitMeetingHeld')).toBeInTheDocument();
  });

  it('flags JFW when stored jfwCount < target', () => {
    renderDetail({ jfwCount: 1 }, vi.fn(), { jfwCount: 3 });
    expect(screen.getByTestId('accountability-flag-row-jfwCount')).toBeInTheDocument();
  });
});
