// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── Hoisted mock fns (avoid TDZ issues with vi.mock hoisting) ─────────────────

const hoisted = vi.hoisted(() => ({
  mockUser:        { uid: 'um1' },
  mockUserProfile: { name: 'Unit Manager 1', email: 'um@test.com', branchId: 'branch-a', unitId: 'um1' },
  mockRole:        'unit_manager',
  mockTenantId:    'test-tenant',
  mockSaveRollupDraft:    vi.fn().mockResolvedValue(undefined),
  mockSubmitRollup:       vi.fn().mockResolvedValue(undefined),
  mockGetRollup:          vi.fn().mockResolvedValue(null),
  mockGetRollupsForUpline: vi.fn().mockResolvedValue([]),
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user:        hoisted.mockUser,
    userProfile: hoisted.mockUserProfile,
    role:        hoisted.mockRole,
    tenantId:    hoisted.mockTenantId,
  }),
}));

// ── Service mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../services/managerMonthlyRollupService', () => ({
  saveRollupDraft:     (...args) => hoisted.mockSaveRollupDraft(...args),
  submitRollup:        (...args) => hoisted.mockSubmitRollup(...args),
  getRollup:           (...args) => hoisted.mockGetRollup(...args),
  getRollupsForUpline: (...args) => hoisted.mockGetRollupsForUpline(...args),
}));

vi.mock('../../../services/managerWarService', () => ({
  getWarRoleRank: () => 1,
}));

// ── monthKeyHelpers mock — stable list ────────────────────────────────────────

vi.mock('../../../utils/monthKeyHelpers', () => ({
  recentMonthKeys: () => ['2026-05', '2026-04', '2026-03'],
  currentMonthKey: () => '2026-05',
  formatMonthKey:  (k) => {
    const m = k.match(/^(\d{4})-(\d{2})$/);
    return m ? `${m[2]}-${m[1]}` : k;
  },
  parseMonthKey: (d) => {
    const m = d.match(/^(\d{2})-(\d{4})$/);
    return m ? `${m[2]}-${m[1]}` : d;
  },
}));

// ── formatters mock ───────────────────────────────────────────────────────────

vi.mock('../../../utils/formatters', () => ({
  getRoleLabel: (role) => ({
    unit_manager:   'Unit Manager',
    branch_manager: 'Branch Manager',
    sales_manager:  'Sales Manager',
  }[role] ?? role),
}));

import MonthlyRecruitingTab from '../MonthlyRecruitingTab';

/** Flush pending effects + async state updates (mirrors ManagerWarTab.test.jsx pattern). */
const flushMount = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });


function renderTab() {
  return render(<MonthlyRecruitingTab />);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Restore UM defaults after each test (tests that need BM override hoisted values)
  hoisted.mockUser        = { uid: 'um1' };
  hoisted.mockUserProfile = { name: 'Unit Manager 1', email: 'um@test.com', branchId: 'branch-a', unitId: 'um1' };
  hoisted.mockRole        = 'unit_manager';
  hoisted.mockTenantId    = 'test-tenant';
  hoisted.mockGetRollup.mockResolvedValue(null);
  hoisted.mockGetRollupsForUpline.mockResolvedValue([]);
  hoisted.mockSaveRollupDraft.mockResolvedValue(undefined);
  hoisted.mockSubmitRollup.mockResolvedValue(undefined);
});

// ── Rendering (unit_manager role) ─────────────────────────────────────────────

describe('rendering — unit_manager', () => {
  it('shows own-form heading', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByRole('heading', { name: /my monthly recruiting/i })).toBeInTheDocument();
  });

  it('shows month picker with MM-YYYY display labels', async () => {
    renderTab();
    await flushMount();
    const picker = screen.getByRole('combobox', { name: /select month/i });
    expect(picker).toBeInTheDocument();
    expect(picker.querySelector('option[value="2026-05"]').textContent).toBe('05-2026');
  });

  it('shows candidatesAssessed and agentsContracted fields', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByLabelText(/candidates assessed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/agents contracted/i)).toBeInTheDocument();
  });

  it('shows Save Draft and Submit buttons', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeInTheDocument();
  });

  it('does NOT show team view for unit_manager', async () => {
    renderTab();
    await flushMount();
    expect(screen.queryByRole('heading', { name: /team monthly recruiting/i })).not.toBeInTheDocument();
  });

  it('shows provisional help text on candidatesAssessed', async () => {
    renderTab();
    await flushMount();
    expect(screen.getByText(/definition provisional/i)).toBeInTheDocument();
  });
});

// ── Loading existing rollup ───────────────────────────────────────────────────

describe('loading existing rollup', () => {
  it('populates form fields from existing doc', async () => {
    hoisted.mockGetRollup.mockResolvedValue({
      candidatesAssessed: 3, agentsContracted: 1,
      notes: 'Pipeline notes', status: 'draft',
    });
    renderTab();
    await flushMount();
    expect(screen.getByLabelText(/candidates assessed/i).value).toBe('3');
    expect(screen.getByLabelText(/agents contracted/i).value).toBe('1');
  });

  it('shows Submitted state and hides action buttons when status is submitted', async () => {
    hoisted.mockGetRollup.mockResolvedValue({
      candidatesAssessed: 2, agentsContracted: 0, notes: '', status: 'submitted',
    });
    renderTab();
    await flushMount();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });
});

// ── Save Draft ────────────────────────────────────────────────────────────────

describe('Save Draft', () => {
  it('calls saveRollupDraft with correct tenant/manager/month args', async () => {
    renderTab();
    await flushMount();
    fireEvent.change(screen.getByLabelText(/candidates assessed/i), { target: { value: '2' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(hoisted.mockSaveRollupDraft).toHaveBeenCalledOnce();
    const [tenantId, managerId, managerName, monthKey] = hoisted.mockSaveRollupDraft.mock.calls[0];
    expect(tenantId).toBe('test-tenant');
    expect(managerId).toBe('um1');
    expect(managerName).toBe('Unit Manager 1');
    expect(monthKey).toBe('2026-05');
  });

  it('shows Saved ✓ feedback after successful save', async () => {
    renderTab();
    await flushMount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/saved ✓/i)).toBeInTheDocument();
  });

  it('shows save error on failure', async () => {
    hoisted.mockSaveRollupDraft.mockRejectedValue(new Error('network error'));
    renderTab();
    await flushMount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/save failed/i)).toBeInTheDocument();
  });
});

// ── Submit ────────────────────────────────────────────────────────────────────

describe('Submit', () => {
  it('calls submitRollup and shows success status', async () => {
    renderTab();
    await flushMount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(hoisted.mockSubmitRollup).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent(/submitted/i);
  });

  it('shows submit error on failure', async () => {
    hoisted.mockSubmitRollup.mockRejectedValue(new Error('permission denied'));
    renderTab();
    await flushMount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/submit failed/i);
  });
});

// ── Team view (branch_manager role) ──────────────────────────────────────────
// Branch manager tests override hoisted.mockRole + mockUserProfile before render.

describe('team view — branch_manager', () => {
  beforeEach(() => {
    hoisted.mockUser        = { uid: 'bm1' };
    hoisted.mockUserProfile = { name: 'BM One', email: 'bm@test.com', branchId: 'branch-a', unitId: null };
    hoisted.mockRole        = 'branch_manager';
  });

  it('shows both own-form and team-view headings for branch_manager', async () => {
    renderTab();
    await flushMount();
    const headings = screen.getAllByRole('heading', { level: 2 });
    const texts = headings.map((h) => h.textContent);
    expect(texts.some((t) => /my monthly recruiting/i.test(t))).toBe(true);
    expect(texts.some((t) => /team monthly recruiting/i.test(t))).toBe(true);
  });

  it('shows empty state when no team rollups', async () => {
    hoisted.mockGetRollupsForUpline.mockResolvedValue([]);
    renderTab();
    await flushMount();
    expect(screen.getByText(/no recruiting entries filed/i)).toBeInTheDocument();
  });

  it('renders team rollup rows', async () => {
    hoisted.mockGetRollupsForUpline.mockResolvedValue([
      {
        id: 'um1_2026-05', managerId: 'um1', managerName: 'Alice UM',
        managerRole: 'unit_manager', candidatesAssessed: 3, agentsContracted: 1,
        status: 'submitted',
      },
    ]);
    renderTab();
    await flushMount();
    expect(screen.getByText('Alice UM')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

// ── Month display convention ──────────────────────────────────────────────────

describe('month display convention', () => {
  it('picker option values are YYYY-MM (store format)', async () => {
    renderTab();
    await flushMount();
    const picker = screen.getByRole('combobox', { name: /select month/i });
    for (const opt of Array.from(picker.querySelectorAll('option'))) {
      expect(opt.value).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('picker option labels are MM-YYYY (display format)', async () => {
    renderTab();
    await flushMount();
    const picker = screen.getByRole('combobox', { name: /select month/i });
    for (const opt of Array.from(picker.querySelectorAll('option'))) {
      expect(opt.textContent).toMatch(/^\d{2}-\d{4}$/);
    }
  });
});

// ── §1 states contract — own-rollup load previously fell through silently to
// DEFAULT_FORM on failure (`.catch(console.error)`); team-rollup error banner
// existed but had no Retry.

describe('§1 states contract — own rollup load error / retry', () => {
  it('renders a blocking error card with Retry when getRollup fails (never falls through to a blank form)', async () => {
    hoisted.mockGetRollup.mockRejectedValue(new Error('boom-getrollup'));
    renderTab();
    await flushMount();

    const card = screen.getByTestId('recruiting-own-error');
    expect(card).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/candidates assessed/i)).not.toBeInTheDocument();
  });

  it('Retry re-invokes getRollup and recovers into the form', async () => {
    hoisted.mockGetRollup.mockRejectedValueOnce(new Error('boom-getrollup')).mockResolvedValueOnce(null);
    renderTab();
    await flushMount();
    expect(screen.getByTestId('recruiting-own-error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flushMount();

    expect(hoisted.mockGetRollup).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('recruiting-own-error')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/candidates assessed/i)).toBeInTheDocument();
  });
});

describe('§1 states contract — team rollup error / retry', () => {
  beforeEach(() => {
    hoisted.mockRole        = 'branch_manager';
    hoisted.mockUserProfile = { name: 'Branch Manager 1', email: 'bm@test.com', branchId: 'branch-a', unitId: null };
  });

  it('the team error banner has a wired Retry that re-invokes getRollupsForUpline', async () => {
    hoisted.mockGetRollupsForUpline.mockRejectedValueOnce(new Error('boom-team'));
    renderTab();
    await flushMount();

    expect(screen.getByText(/unable to load team data/i)).toBeInTheDocument();
    expect(hoisted.mockGetRollupsForUpline).toHaveBeenCalledTimes(1);

    hoisted.mockGetRollupsForUpline.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await flushMount();

    expect(hoisted.mockGetRollupsForUpline).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/unable to load team data/i)).not.toBeInTheDocument();
  });
});
