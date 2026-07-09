// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

// reviewWar mock (item 2.1) — warDocId kept real-ish for the fallback path.
const mockReviewWar = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/managerWarService', () => ({
  reviewWar: (...args) => mockReviewWar(...args),
  warDocId: (managerId, weekStart) => `${managerId}_${weekStart}`,
}));

// useToast mock — component calls it at top level; no provider in the test tree.
const mockToastShow = vi.fn();
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: mockToastShow, dismiss: vi.fn() }),
}));

import ManagerWarDetail from '../ManagerWarDetail';

beforeEach(() => {
  mockAuth = { ...DEFAULT_MOCK_AUTH };
  mockReviewWar.mockReset().mockResolvedValue(undefined);
  mockToastShow.mockReset();
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

  it('never renders personal production section regardless of warData fields (regression guard)', () => {
    // Even if legacy WAR docs carry personalApi/personalApps, the section must not render.
    renderDetail({ personalApi: 1500.5, personalApps: 2 });
    expect(screen.queryByText(/personal production/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Personal API (TTD)')).not.toBeInTheDocument();
    expect(screen.queryByText('Personal Applications')).not.toBeInTheDocument();
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

// ── item 2.1 CompletionRing ───────────────────────────────────────────────────

describe('ManagerWarDetail — CompletionRing', () => {
  it('renders a ring with the met/total from configured targets only', () => {
    // BM_STANDARDS sets targets on 6 numeric + 2 boolean = 8 KPIs.
    // BASE_WAR: names 5<10, interviews 2<4, recruits 1<2, training 1<2, jfw 2<3 → 5 under
    // met: oneOnOnes 3<5 under too → actually 6 numeric under? compute: 1o1 3<5 under,
    // names 5<10 under, interviews 2<4 under, recruits 1<2 under, training 1<2 under,
    // jfw 2<3 under = 6 numeric under; booleans both met. met = 8-6 = 2 → 25%.
    renderDetail({}, vi.fn(), BM_STANDARDS);
    expect(screen.getByLabelText(/KPI completion: 25% — 2 of 8 targets met/i)).toBeInTheDocument();
  });

  it('renders a no-targets ring when no standards are configured', () => {
    renderDetail({}, vi.fn(), {});
    expect(screen.getByLabelText(/KPI completion: no targets set/i)).toBeInTheDocument();
  });
});

// ── item 2.1 reviewer workflow ────────────────────────────────────────────────

const UPLINE_SM = { ...DEFAULT_MOCK_AUTH, user: { uid: 'sm1' }, role: 'sales_manager',
                    userProfile: { branchId: null, name: 'Sasha Mgr' } };

describe('ManagerWarDetail — reviewer workflow gating', () => {
  it('renders review controls for an upline caller on a submitted WAR', () => {
    mockAuth = { ...UPLINE_SM };
    renderDetail({ status: 'submitted' });
    expect(screen.getByTestId('war-review-controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve war/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request changes/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/leader's note/i)).toBeInTheDocument();
  });

  it('does NOT render review controls when the WAR is a draft', () => {
    mockAuth = { ...UPLINE_SM };
    renderDetail({ status: 'draft' });
    expect(screen.queryByTestId('war-review-controls')).not.toBeInTheDocument();
  });

  it('does NOT render review controls when the caller is not upline', () => {
    // UM (rank 1) viewing BM (rank 2) → not upline
    mockAuth = { ...DEFAULT_MOCK_AUTH, user: { uid: 'um1' }, role: 'unit_manager',
                 userProfile: { branchId: 'branch-a' } };
    renderDetail({ status: 'submitted' });
    expect(screen.queryByTestId('war-review-controls')).not.toBeInTheDocument();
  });
});

describe('ManagerWarDetail — review actions', () => {
  it('Approve calls reviewWar with docId + approved status + reviewer identity + note', async () => {
    mockAuth = { ...UPLINE_SM };
    const onReviewed = vi.fn();
    render(
      <ManagerWarDetail warData={{ ...BASE_WAR, status: 'submitted' }} onBack={vi.fn()} onReviewed={onReviewed} />,
    );
    fireEvent.change(screen.getByLabelText(/leader's note/i), { target: { value: 'Nice work' } });
    fireEvent.click(screen.getByRole('button', { name: /approve war/i }));

    await waitFor(() => expect(mockReviewWar).toHaveBeenCalledTimes(1));
    expect(mockReviewWar).toHaveBeenCalledWith('test-tenant', 'bm1_2026-05-18', {
      status: 'approved', note: 'Nice work', reviewerUid: 'sm1', reviewerName: 'Sasha Mgr',
    });
    await waitFor(() => expect(onReviewed).toHaveBeenCalledWith('bm1_2026-05-18',
      expect.objectContaining({ reviewStatus: 'approved', reviewNote: 'Nice work' })));
    // Success affordance (toast) fired
    expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    // Review state now displayed in place (no reload)
    expect(screen.getByTestId('war-review-state')).toBeInTheDocument();
  });

  it('Request changes calls reviewWar with changes_requested', async () => {
    mockAuth = { ...UPLINE_SM };
    render(<ManagerWarDetail warData={{ ...BASE_WAR, status: 'submitted' }} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /request changes/i }));
    await waitFor(() => expect(mockReviewWar).toHaveBeenCalledWith(
      'test-tenant', 'bm1_2026-05-18',
      expect.objectContaining({ status: 'changes_requested' }),
    ));
  });

  it('renders an inline error card + Retry when reviewWar rejects (denial path)', async () => {
    mockAuth = { ...UPLINE_SM };
    mockReviewWar.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));
    render(<ManagerWarDetail warData={{ ...BASE_WAR, status: 'submitted' }} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /approve war/i }));

    const card = await screen.findByTestId('war-review-error');
    expect(card).toHaveAttribute('role', 'alert');
    expect(mockToastShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));

    // Retry re-invokes reviewWar with the same action
    mockReviewWar.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(mockReviewWar).toHaveBeenCalledTimes(2));
  });

  it('clamps the note to 2000 chars and shows a live count', async () => {
    mockAuth = { ...UPLINE_SM };
    render(<ManagerWarDetail warData={{ ...BASE_WAR, status: 'submitted' }} onBack={vi.fn()} />);
    const textarea = screen.getByLabelText(/leader's note/i);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(2500) } });
    expect(textarea.value).toHaveLength(2000);
    expect(screen.getByText('2000/2000')).toBeInTheDocument();
  });

  it('shows existing review state (who/status/note) on the drill', () => {
    mockAuth = { ...UPLINE_SM };
    renderDetail({
      status: 'submitted', reviewStatus: 'approved',
      reviewNote: 'Approved last week', reviewedByName: 'Prior Reviewer',
      reviewedAt: new Date('2026-05-20T12:00:00Z'),
    });
    const state = screen.getByTestId('war-review-state');
    expect(state).toHaveTextContent(/Approved/);
    expect(state).toHaveTextContent(/Prior Reviewer/);
    expect(state).toHaveTextContent(/Approved last week/);
  });
});
