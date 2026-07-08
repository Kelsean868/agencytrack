// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Auth mock ─────────────────────────────────────────────────────────────────

const mockUser        = { uid: 'um1' };
const mockUserProfile = {
  name: 'Unit Manager 1', email: 'um@test.com',
  branchId: 'branch-a', unitId: 'um1',
};
const mockRole     = 'unit_manager';
const mockTenantId = 'test-tenant';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        mockUser,
    userProfile: mockUserProfile,
    role:        mockRole,
    tenantId:    mockTenantId,
  }),
}));

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockSaveWarDraft         = vi.fn().mockResolvedValue(undefined);
const mockSubmitWar            = vi.fn().mockResolvedValue(undefined);
const mockGetWar               = vi.fn().mockResolvedValue(null);
const mockGetOwnJfwCount       = vi.fn().mockResolvedValue(0);
const mockGetResolvedStandards = vi.fn().mockResolvedValue({});

vi.mock('../../../services/managerWarService', () => ({
  saveWarDraft:   (...args) => mockSaveWarDraft(...args),
  submitWar:      (...args) => mockSubmitWar(...args),
  getWar:         (...args) => mockGetWar(...args),
  getOwnJfwCount: (...args) => mockGetOwnJfwCount(...args),
}));

vi.mock('../../../services/managerStandardOverrideService', () => ({
  getResolvedStandards: (...args) => mockGetResolvedStandards(...args),
}));

// ── Validators mock (stable Sunday list) ─────────────────────────────────────

vi.mock('../../../utils/validators', () => ({
  getRecentSundays:   () => ['2026-05-17', '2026-05-10', '2026-05-03'],
  validateSundayDate: (s) => ['2026-05-17', '2026-05-10', '2026-05-03'].includes(s),
}));

import ManagerWarTab from '../ManagerWarTab';

// ── Timer helpers (WizardFormSaveStatus pattern) ──────────────────────────────
//
// waitFor's setInterval-based retries are mocked by vi.useFakeTimers, so
// direct assertions after flushMount() are used instead of waitFor().

/** Flush the initial getWar promise chain (then + finally = 2 microtask ticks). */
const flushMount = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

/** Flush the saveWarDraft promise chain after advancing the debounce. */
const flushSave = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

/** Flush the submitWar promise chain. */
const flushSubmit = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

function renderTab() {
  return render(<ManagerWarTab />);
}

// ── Timer setup (mirror WizardFormSaveStatus global pattern) ─────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWar.mockResolvedValue(null);
  mockGetOwnJfwCount.mockResolvedValue(0);
  mockGetResolvedStandards.mockResolvedValue({});
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('ManagerWarTab — initial render', () => {
  it('shows loading state then renders the form', async () => {
    renderTab();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await flushMount();
    expect(screen.getByText('My Weekly Activity Report')).toBeInTheDocument();
  });

  it('renders all 6 manual activity fields', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByLabelText('One-on-One Pipeline Reviews')).toBeInTheDocument();
    expect(screen.getByLabelText('Names Sourced')).toBeInTheDocument();
    expect(screen.getByLabelText('Initial Interviews Conducted')).toBeInTheDocument();
    expect(screen.getByLabelText('New Recruits in First Weeks')).toBeInTheDocument();
    expect(screen.getByLabelText('Training Sessions Delivered')).toBeInTheDocument();
    expect(screen.getByLabelText(/Training Topic/)).toBeInTheDocument();
  });

  it('renders toggle fields for unitMeetingHeld and dashboardReviewDone', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByRole('checkbox', { name: /unit.*meeting held/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /dashboard review done/i })).toBeInTheDocument();
  });

  it('never renders personal production panel regardless of userProfile.isProducingManager (regression guard)', async () => {
    // Default profile: no isProducingManager flag.
    renderTab();
    await flushMount();
    expect(screen.queryByText(/personal production/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/personal api/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/personal applications/i)).not.toBeInTheDocument();
  });

  it('renders the Submit Report button for a new (non-submitted) report', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByRole('button', { name: /submit report/i })).toBeInTheDocument();
  });

  it('renders the JFW row with count from getOwnJfwCount', async () => {
    mockGetOwnJfwCount.mockResolvedValue(3);
    renderTab();
    await flushMount();
    expect(screen.getByText(/joint field work/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/joint field work count: 3/i)).toBeInTheDocument();
  });
});

// ── Existing draft loads ──────────────────────────────────────────────────────

describe('ManagerWarTab — loading an existing draft', () => {
  it('populates form fields from an existing draft WAR', async () => {
    mockGetWar.mockResolvedValue({
      id: 'um1_2026-05-17', managerId: 'um1', tenantId: 'test-tenant',
      weekStart: '2026-05-17', managerRole: 'unit_manager', managerRoleRank: 1,
      branchId: 'branch-a', unitId: 'um1', jfwCount: 0, status: 'draft',
      oneOnOnesConducted: 4, namesSourced: 7, interviewsConducted: 3,
      recruitsInFirstWeeks: 2, trainingSessions: 1, trainingTopic: 'Closing',
      unitMeetingHeld: false, attendanceCount: null, dashboardReviewDone: true,
    });
    renderTab();
    await flushMount();
    expect(screen.getByLabelText('One-on-One Pipeline Reviews')).toHaveValue(4);
    expect(screen.getByLabelText('Names Sourced')).toHaveValue(7);
  });

  it('shows "Draft — auto-saved" subtitle for an existing draft', async () => {
    mockGetWar.mockResolvedValue({
      id: 'um1_2026-05-17', managerId: 'um1', tenantId: 'test-tenant',
      weekStart: '2026-05-17', managerRole: 'unit_manager', managerRoleRank: 1,
      branchId: 'branch-a', unitId: 'um1', jfwCount: 0, status: 'draft',
      oneOnOnesConducted: 0, namesSourced: 0, interviewsConducted: 0,
      recruitsInFirstWeeks: 0, trainingSessions: 0, trainingTopic: '',
      unitMeetingHeld: false, dashboardReviewDone: false,
    });
    renderTab();
    await flushMount();
    expect(screen.getByText(/draft.*auto-saved/i)).toBeInTheDocument();
  });
});

// ── §1 states contract — getWar failure must never silently fall through to
// DEFAULT_FORM (which would mask an existing draft as a blank new report).

describe('ManagerWarTab — §1 states contract (load error / retry)', () => {
  it('renders a blocking error card with Retry when getWar fails (never falls through to a blank form)', async () => {
    mockGetWar.mockRejectedValue(new Error('boom-getwar'));
    renderTab();
    await flushMount();

    const card = screen.getByTestId('manager-war-error');
    expect(card).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The form itself must not render alongside the blocking error.
    expect(screen.queryByLabelText('One-on-One Pipeline Reviews')).not.toBeInTheDocument();
  });

  it('Retry re-invokes getWar and recovers into the form', async () => {
    mockGetWar.mockRejectedValueOnce(new Error('boom-getwar')).mockResolvedValueOnce(null);
    renderTab();
    await flushMount();
    expect(screen.getByTestId('manager-war-error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flushMount();

    expect(mockGetWar).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('manager-war-error')).not.toBeInTheDocument();
    expect(screen.getByLabelText('One-on-One Pipeline Reviews')).toBeInTheDocument();
  });
});

// ── Submitted WAR is read-only ────────────────────────────────────────────────

describe('ManagerWarTab — submitted WAR is read-only', () => {
  beforeEach(() => {
    mockGetWar.mockResolvedValue({
      id: 'um1_2026-05-17', managerId: 'um1', tenantId: 'test-tenant',
      weekStart: '2026-05-17', managerRole: 'unit_manager', managerRoleRank: 1,
      branchId: 'branch-a', unitId: 'um1', jfwCount: 0, status: 'submitted',
      oneOnOnesConducted: 2, namesSourced: 3, interviewsConducted: 1,
      recruitsInFirstWeeks: 0, trainingSessions: 1, trainingTopic: '',
      unitMeetingHeld: true, attendanceCount: 10, dashboardReviewDone: true,
    });
  });

  it('shows "Submitted" subtitle', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('disables all number inputs', async () => {
    renderTab();
    await flushMount();
    const inputs = screen.getAllByRole('spinbutton');
    inputs.forEach((input) => expect(input).toBeDisabled());
  });

  it('does not show the Submit Report button', async () => {
    renderTab();
    await flushMount();
    expect(screen.queryByRole('button', { name: /submit report/i })).not.toBeInTheDocument();
  });
});

// ── Auto-save ─────────────────────────────────────────────────────────────────

describe('ManagerWarTab — auto-save', () => {
  it('calls saveWarDraft after 1500ms debounce when form changes', async () => {
    renderTab();
    await flushMount();

    const namesInput = screen.getByLabelText('Names Sourced');
    fireEvent.change(namesInput, { target: { value: '5' } });

    act(() => { vi.advanceTimersByTime(1500); });
    await flushSave();

    expect(mockSaveWarDraft).toHaveBeenCalledOnce();
  });

  it('does not auto-save for a submitted report', async () => {
    mockGetWar.mockResolvedValue({
      id: 'um1_2026-05-17', managerId: 'um1', tenantId: 'test-tenant',
      weekStart: '2026-05-17', managerRole: 'unit_manager', managerRoleRank: 1,
      branchId: 'branch-a', unitId: 'um1', jfwCount: 0, status: 'submitted',
      oneOnOnesConducted: 0, namesSourced: 0, interviewsConducted: 0,
      recruitsInFirstWeeks: 0, trainingSessions: 0, trainingTopic: '',
      unitMeetingHeld: false, dashboardReviewDone: false,
    });
    renderTab();
    await flushMount();

    act(() => { vi.advanceTimersByTime(2000); });
    await flushSave();

    expect(mockSaveWarDraft).not.toHaveBeenCalled();
  });
});

// ── Explicit submit ───────────────────────────────────────────────────────────

describe('ManagerWarTab — explicit submit', () => {
  it('calls submitWar and shows success message on click', async () => {
    renderTab();
    await flushMount();

    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    await flushSubmit();

    expect(mockSubmitWar).toHaveBeenCalledOnce();
    expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
  });

  it('shows error message when submitWar rejects', async () => {
    mockSubmitWar.mockRejectedValue(new Error('network error'));
    renderTab();
    await flushMount();

    fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    await flushSubmit();

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// ── Toggle fields ─────────────────────────────────────────────────────────────

describe('ManagerWarTab — toggle fields', () => {
  it('attendance count field appears when unitMeetingHeld is toggled on', async () => {
    renderTab();
    await flushMount();

    expect(screen.queryByLabelText('Attendance Count')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /unit.*meeting held/i }));
    expect(screen.getByLabelText('Attendance Count')).toBeInTheDocument();
  });
});

// ── JFW row ───────────────────────────────────────────────────────────────────

describe('ManagerWarTab — JFW count row', () => {
  it('shows count 0 cleanly', async () => {
    mockGetOwnJfwCount.mockResolvedValue(0);
    renderTab();
    await flushMount();
    expect(screen.getByLabelText(/joint field work count: 0/i)).toBeInTheDocument();
  });

  it('shows count > 0', async () => {
    mockGetOwnJfwCount.mockResolvedValue(5);
    renderTab();
    await flushMount();
    expect(screen.getByLabelText(/joint field work count: 5/i)).toBeInTheDocument();
  });

  it('shows error state when getOwnJfwCount rejects', async () => {
    mockGetOwnJfwCount.mockRejectedValue(new Error('FAILED_PRECONDITION'));
    renderTab();
    await flushMount();
    expect(screen.getByRole('alert')).toHaveTextContent(/error loading/i);
  });

  it('passes the selected weekStart to getOwnJfwCount', async () => {
    mockGetOwnJfwCount.mockResolvedValue(0);
    renderTab();
    await flushMount();
    // Default is sundays[0] = '2026-05-17'
    expect(mockGetOwnJfwCount).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart: '2026-05-17' }),
    );
  });

  it('clicking Retry on the JFW error re-invokes getOwnJfwCount and recovers', async () => {
    mockGetOwnJfwCount.mockRejectedValueOnce(new Error('FAILED_PRECONDITION'));
    renderTab();
    await flushMount();
    expect(screen.getByRole('alert')).toHaveTextContent(/error loading/i);

    mockGetOwnJfwCount.mockResolvedValueOnce(3);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flushMount();

    expect(mockGetOwnJfwCount).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText(/joint field work count: 3/i)).toBeInTheDocument();
  });

  it('recomputes count when the week selector changes', async () => {
    mockGetOwnJfwCount.mockResolvedValue(2);
    renderTab();
    await flushMount();
    expect(mockGetOwnJfwCount).toHaveBeenCalledTimes(1);

    mockGetOwnJfwCount.mockResolvedValue(4);
    fireEvent.change(screen.getByRole('combobox', { name: /select week/i }), {
      target: { value: '2026-05-10' },
    });
    await flushMount();
    expect(mockGetOwnJfwCount).toHaveBeenCalledTimes(2);
    expect(mockGetOwnJfwCount).toHaveBeenLastCalledWith(
      expect.objectContaining({ weekStart: '2026-05-10' }),
    );
    expect(screen.getByLabelText(/joint field work count: 4/i)).toBeInTheDocument();
  });
});

// ── Activity standards overlay ─────────────────────────────────────────────────

describe('ManagerWarTab — standards overlay', () => {
  it('shows actual-only (no target) when no standards are resolved', async () => {
    mockGetResolvedStandards.mockResolvedValue({});
    mockGetOwnJfwCount.mockResolvedValue(3);
    renderTab();
    await flushMount();
    // JFW pill: aria-label has just the count, no "of N"
    expect(screen.getByLabelText(/joint field work count: 3$/i)).toBeInTheDocument();
  });

  it('shows actual / target on the JFW pill when a standard is resolved', async () => {
    mockGetResolvedStandards.mockResolvedValue({ jfwCount: 4 });
    mockGetOwnJfwCount.mockResolvedValue(2);
    renderTab();
    await flushMount();
    expect(screen.getByLabelText(/joint field work count: 2 of 4/i)).toBeInTheDocument();
  });

  it('shows actual-only on numeric field when that field has no standard', async () => {
    mockGetResolvedStandards.mockResolvedValue({ jfwCount: 4 }); // only jfwCount, not oneOnOnesConducted
    renderTab();
    await flushMount();
    expect(screen.getByLabelText('One-on-One Pipeline Reviews')).toBeInTheDocument();
    expect(screen.queryByLabelText(/target: \d/i)).not.toBeInTheDocument();
  });

  it('shows the target label on a numeric field when that field has a standard', async () => {
    mockGetResolvedStandards.mockResolvedValue({ oneOnOnesConducted: 5 });
    renderTab();
    await flushMount();
    expect(screen.getByLabelText(/target: 5/i)).toBeInTheDocument();
  });

  it('shows the boolean badge when unitMeetingHeld standard is expected', async () => {
    mockGetResolvedStandards.mockResolvedValue({ unitMeetingHeld: true });
    renderTab();
    await flushMount();
    const badge = screen.getByLabelText(/standard (met|not met)/i);
    expect(badge).toBeInTheDocument();
  });

  it('does not show badge when no boolean standard is resolved', async () => {
    mockGetResolvedStandards.mockResolvedValue({});
    renderTab();
    await flushMount();
    expect(screen.queryByLabelText(/standard (met|not met)/i)).not.toBeInTheDocument();
  });
});

// ── I3a Tier-1 accountability flag ────────────────────────────────────────────

describe('ManagerWarTab — I3a accountability flag panel', () => {
  it('is hidden when no standards are resolved', async () => {
    mockGetResolvedStandards.mockResolvedValue({});
    renderTab();
    await flushMount();
    expect(screen.queryByTestId('accountability-flag-panel')).not.toBeInTheDocument();
  });

  it('is hidden when all standards are met', async () => {
    mockGetResolvedStandards.mockResolvedValue({
      namesSourced: 3, unitMeetingHeld: true,
    });
    mockGetWar.mockResolvedValue({
      id: 'um1_2026-05-17', managerId: 'um1', tenantId: 'test-tenant',
      weekStart: '2026-05-17', managerRole: 'unit_manager', managerRoleRank: 1,
      branchId: 'branch-a', unitId: 'um1', jfwCount: 0, status: 'draft',
      oneOnOnesConducted: 0, namesSourced: 5, interviewsConducted: 0,
      recruitsInFirstWeeks: 0, trainingSessions: 0, trainingTopic: '',
      unitMeetingHeld: true, dashboardReviewDone: false,
    });
    renderTab();
    await flushMount();
    expect(screen.queryByTestId('accountability-flag-panel')).not.toBeInTheDocument();
  });

  it('renders the panel listing the under-target numeric activity', async () => {
    mockGetResolvedStandards.mockResolvedValue({ namesSourced: 5 });
    mockGetWar.mockResolvedValue({
      id: 'um1_2026-05-17', managerId: 'um1', tenantId: 'test-tenant',
      weekStart: '2026-05-17', managerRole: 'unit_manager', managerRoleRank: 1,
      branchId: 'branch-a', unitId: 'um1', jfwCount: 0, status: 'draft',
      oneOnOnesConducted: 0, namesSourced: 2, interviewsConducted: 0,
      recruitsInFirstWeeks: 0, trainingSessions: 0, trainingTopic: '',
      unitMeetingHeld: false, dashboardReviewDone: false,
    });
    renderTab();
    await flushMount();
    const panel = screen.getByTestId('accountability-flag-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId('accountability-flag-row-namesSourced')).toBeInTheDocument();
    expect(panel).toHaveTextContent(/1 standard under target/i);
    expect(panel).toHaveTextContent(/2 \/ 5/);
  });

  it('flags a boolean expectation that is not met', async () => {
    mockGetResolvedStandards.mockResolvedValue({ unitMeetingHeld: true });
    mockGetWar.mockResolvedValue({
      id: 'um1_2026-05-17', managerId: 'um1', tenantId: 'test-tenant',
      weekStart: '2026-05-17', managerRole: 'unit_manager', managerRoleRank: 1,
      branchId: 'branch-a', unitId: 'um1', jfwCount: 0, status: 'draft',
      oneOnOnesConducted: 0, namesSourced: 0, interviewsConducted: 0,
      recruitsInFirstWeeks: 0, trainingSessions: 0, trainingTopic: '',
      unitMeetingHeld: false, dashboardReviewDone: false,
    });
    renderTab();
    await flushMount();
    expect(screen.getByTestId('accountability-flag-row-unitMeetingHeld')).toBeInTheDocument();
  });

  it('factors JFW count into the missed calculation when target is set', async () => {
    // jfwCount comes from getOwnJfwCount, NOT from the WAR form
    mockGetResolvedStandards.mockResolvedValue({ jfwCount: 3 });
    mockGetOwnJfwCount.mockResolvedValue(1);
    renderTab();
    await flushMount();
    expect(screen.getByTestId('accountability-flag-row-jfwCount')).toBeInTheDocument();
  });

  it('pluralizes header correctly for multiple missed standards', async () => {
    mockGetResolvedStandards.mockResolvedValue({
      namesSourced: 5, interviewsConducted: 3,
    });
    renderTab();
    await flushMount();
    expect(screen.getByTestId('accountability-flag-panel')).toHaveTextContent(/2 standards under target/i);
  });
});
