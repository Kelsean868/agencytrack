// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    tenantId:    'test-tenant',
    role:        'branch_manager',
    userProfile: { branchId: 'branch-a' },
  }),
}));

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockGetWarsForUpline           = vi.fn();
const mockGetResolvedStandards        = vi.fn();
const mockGetResolvedStandardsForMany = vi.fn();

vi.mock('../../../services/managerWarService', () => ({
  getWarsForUpline: (...args) => mockGetWarsForUpline(...args),
}));

vi.mock('../../../services/managerStandardOverrideService', () => ({
  getResolvedStandards:        (...args) => mockGetResolvedStandards(...args),
  getResolvedStandardsForMany: (...args) => mockGetResolvedStandardsForMany(...args),
}));

// ── Validators mock ───────────────────────────────────────────────────────────

vi.mock('../../../utils/validators', () => ({
  getRecentSundays: () => ['2026-05-18', '2026-05-11', '2026-05-04'],
}));

// ── ManagerWarDetail mock (prevent deep render) ───────────────────────────────

vi.mock('../ManagerWarDetail', () => ({
  default: ({ warData, onBack }) => (
    <div data-testid="war-detail">
      <span>{warData.managerName}</span>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

import TeamWarsTab from '../TeamWarsTab';

const WAR_BM = {
  id: 'bm1_2026-05-18',
  managerId: 'bm1',
  managerName: 'Branch Mgr 1',
  managerRole: 'branch_manager',
  branchId: 'branch-a',
  weekStart: '2026-05-18',
  jfwCount: 2,
  oneOnOnesConducted: 3,
  status: 'submitted',
};

const WAR_UM = {
  id: 'um1_2026-05-18',
  managerId: 'um1',
  managerName: 'Unit Mgr 1',
  managerRole: 'unit_manager',
  branchId: 'branch-a',
  weekStart: '2026-05-18',
  jfwCount: 1,
  oneOnOnesConducted: 5,
  status: 'submitted',
};

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWarsForUpline.mockResolvedValue([]);
  mockGetResolvedStandards.mockResolvedValue({});
  mockGetResolvedStandardsForMany.mockResolvedValue(new Map());
});

describe('TeamWarsTab — initial render', () => {
  it('shows loading state then renders the list header', async () => {
    mockGetWarsForUpline.mockResolvedValue([]);
    render(<TeamWarsTab />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await flush();
    expect(screen.getByText('Team Activity Reports')).toBeInTheDocument();
  });

  it('shows empty state when no WARs found', async () => {
    mockGetWarsForUpline.mockResolvedValue([]);
    render(<TeamWarsTab />);
    await flush();
    expect(screen.getByText(/no reports filed/i)).toBeInTheDocument();
  });

  it('renders a row for each WAR returned', async () => {
    mockGetWarsForUpline.mockResolvedValue([WAR_BM, WAR_UM]);
    render(<TeamWarsTab />);
    await flush();
    expect(screen.getByText('Branch Mgr 1')).toBeInTheDocument();
    expect(screen.getByText('Unit Mgr 1')).toBeInTheDocument();
  });

  it('shows JFW count and 1-on-1s in the row summary', async () => {
    mockGetWarsForUpline.mockResolvedValue([WAR_BM]);
    render(<TeamWarsTab />);
    await flush();
    expect(screen.getByText(/jfw: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/1-on-1s: 3/i)).toBeInTheDocument();
  });

  it('shows error state when service rejects', async () => {
    mockGetWarsForUpline.mockRejectedValue(new Error('network'));
    render(<TeamWarsTab />);
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent(/unable to load/i);
  });
});

describe('TeamWarsTab — week selector', () => {
  it('calls getWarsForUpline with the default week on mount', async () => {
    render(<TeamWarsTab />);
    await flush();
    expect(mockGetWarsForUpline).toHaveBeenCalledWith(
      expect.objectContaining({ weekStart: '2026-05-18', role: 'branch_manager', branchId: 'branch-a' })
    );
  });

  it('refetches when the week selector changes', async () => {
    render(<TeamWarsTab />);
    await flush();
    mockGetWarsForUpline.mockResolvedValue([]);

    fireEvent.change(screen.getByRole('combobox', { name: /select week/i }), {
      target: { value: '2026-05-11' },
    });
    await flush();

    expect(mockGetWarsForUpline).toHaveBeenCalledTimes(2);
    expect(mockGetWarsForUpline).toHaveBeenLastCalledWith(
      expect.objectContaining({ weekStart: '2026-05-11' })
    );
  });
});

describe('TeamWarsTab — drill-down', () => {
  it('shows ManagerWarDetail when a row is clicked', async () => {
    mockGetWarsForUpline.mockResolvedValue([WAR_BM]);
    render(<TeamWarsTab />);
    await flush();

    fireEvent.click(screen.getByText('Branch Mgr 1').closest('button'));
    await flush(); // let getResolvedStandards resolve
    expect(screen.getByTestId('war-detail')).toBeInTheDocument();
    expect(screen.queryByText('Team Activity Reports')).not.toBeInTheDocument();
  });

  it('returns to the list when Back is clicked in the detail view', async () => {
    mockGetWarsForUpline.mockResolvedValue([WAR_BM]);
    render(<TeamWarsTab />);
    await flush();

    fireEvent.click(screen.getByText('Branch Mgr 1').closest('button'));
    await flush(); // let getResolvedStandards resolve
    expect(screen.getByTestId('war-detail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    await flush();
    expect(screen.getByText('Team Activity Reports')).toBeInTheDocument();
  });
});

// ── I3a Tier-1 accountability flag — per-row "N under" badge ──────────────────

describe('TeamWarsTab — I3a per-row under badge', () => {
  it('renders no badge when row has no missed activities', async () => {
    const compliantWar = {
      ...WAR_BM,
      managerId: 'bm-met',
      managerName: 'Compliant BM',
      namesSourced: 10, oneOnOnesConducted: 5,
    };
    mockGetWarsForUpline.mockResolvedValue([compliantWar]);
    mockGetResolvedStandardsForMany.mockResolvedValue(
      new Map([['bm-met', { namesSourced: 5, oneOnOnesConducted: 5 }]]),
    );
    render(<TeamWarsTab />);
    await flush();
    await flush(); // let bulk resolve settle
    expect(screen.queryByTestId('team-war-under-badge-bm-met')).not.toBeInTheDocument();
  });

  it('renders "N under" badge when a row has missed activities', async () => {
    const underWar = {
      ...WAR_UM,
      managerId: 'um-under',
      managerName: 'Under UM',
      namesSourced: 1, interviewsConducted: 0, oneOnOnesConducted: 0,
      unitMeetingHeld: false, dashboardReviewDone: true,
      jfwCount: 0,
    };
    mockGetWarsForUpline.mockResolvedValue([underWar]);
    mockGetResolvedStandardsForMany.mockResolvedValue(
      new Map([['um-under', {
        namesSourced: 5,
        interviewsConducted: 3,
        unitMeetingHeld: true,
      }]]),
    );
    render(<TeamWarsTab />);
    await flush();
    await flush();
    const badge = screen.getByTestId('team-war-under-badge-um-under');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/3 under/i);
  });

  it('renders badges only on rows with misses (mixed list)', async () => {
    const compliantWar = { ...WAR_BM, managerId: 'bm-ok', managerName: 'OK BM', namesSourced: 10 };
    const underWar    = { ...WAR_UM, managerId: 'um-bad', managerName: 'Bad UM', namesSourced: 0 };
    mockGetWarsForUpline.mockResolvedValue([compliantWar, underWar]);
    mockGetResolvedStandardsForMany.mockResolvedValue(
      new Map([
        ['bm-ok',  { namesSourced: 5 }],
        ['um-bad', { namesSourced: 5 }],
      ]),
    );
    render(<TeamWarsTab />);
    await flush();
    await flush();
    expect(screen.queryByTestId('team-war-under-badge-bm-ok')).not.toBeInTheDocument();
    expect(screen.getByTestId('team-war-under-badge-um-bad')).toBeInTheDocument();
  });

  it('does not crash when bulk resolution rejects (no badges, list still renders)', async () => {
    mockGetWarsForUpline.mockResolvedValue([WAR_BM]);
    mockGetResolvedStandardsForMany.mockRejectedValue(new Error('network'));
    render(<TeamWarsTab />);
    await flush();
    await flush();
    expect(screen.getByText('Branch Mgr 1')).toBeInTheDocument();
    expect(screen.queryByTestId(/^team-war-under-badge-/)).not.toBeInTheDocument();
  });

  it('passes the WAR list managers to getResolvedStandardsForMany once on load', async () => {
    mockGetWarsForUpline.mockResolvedValue([WAR_BM, WAR_UM]);
    render(<TeamWarsTab />);
    await flush();
    await flush();
    expect(mockGetResolvedStandardsForMany).toHaveBeenCalledWith({
      tenantId: 'test-tenant',
      managers: [
        { managerId: 'bm1', managerRole: 'branch_manager' },
        { managerId: 'um1', managerRole: 'unit_manager' },
      ],
    });
  });
});
