// @vitest-environment jsdom
/**
 * Deterministic cross-week load-window test (E1 fix).
 *
 * The board's Day/3-day spans are TODAY-anchored (today, +1, +2), so late in the
 * week they reach past Saturday — on a FRIDAY the 3-day board's third column is
 * next Sunday. The Sun–Sat week load alone left those columns silently empty.
 *
 * Why a separate file: `getTodayTT` is mocked to a FIXED FRIDAY here so the
 * cross-boundary case is exercised on every run. The sibling
 * `AgentPlannerPanel.test.jsx` uses the real current date, where today+2 only
 * crosses Sunday 2 days in 7 — its range test asserts the always-true invariant
 * (`rangeEnd >= today+2`) rather than the boundary case. Keeping this in its own
 * file also avoids perturbing that file's timing (it carries the documented
 * A5-bulk / A2-`e` load-sensitive tests).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// 2026-07-24 is a FRIDAY → week Sun 2026-07-19 … Sat 2026-07-25;
// today+2 = Sun 2026-07-26, one day PAST weekEnd.
const FIXED_FRIDAY = '2026-07-24';
const WEEK_START = '2026-07-19';
const WEEK_END = '2026-07-25';
const SPAN_END = '2026-07-26';

vi.mock('../../../utils/dateInputs', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getTodayTT: () => FIXED_FRIDAY };
});
vi.mock('../../../services/plannerService', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getAgentWeek: vi.fn(),
    getSeriesInstances: vi.fn(),
    createAppointment: vi.fn(),
    createRecurringAppointments: vi.fn(),
    updateAppointment: vi.fn(),
    setAppointmentStatus: vi.fn(),
    postponeWithRebook: vi.fn(),
    deleteAppointment: vi.fn(),
    undoPostpone: vi.fn(),
    bulkUpdateAppointments: vi.fn(),
    addAppointmentNote: vi.fn(),
  };
});
vi.mock('../../../services/prospectInfoService', () => ({ getProspectInfo: vi.fn() }));
vi.mock('../../../services/appointmentTemplateService', () => ({
  listTemplates: vi.fn(), saveTemplate: vi.fn(), deleteTemplate: vi.fn(), TEMPLATE_CAP: 20,
}));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}));

import AgentPlannerPanel from '../AgentPlannerPanel';
import { getAgentWeek } from '../../../services/plannerService';
import { getProspectInfo } from '../../../services/prospectInfoService';
import { listTemplates } from '../../../services/appointmentTemplateService';
import { getTodayTT } from '../../../utils/dateInputs';

const BASE_PROPS = {
  tenantId: 't1', agentId: 'agent-1', agentUnitId: 'um-9',
  agentBranchId: 'branch-7', callerRole: 'agent',
};

beforeEach(() => {
  vi.clearAllMocks();
  getAgentWeek.mockResolvedValue([]);
  getProspectInfo.mockResolvedValue([]);
  listTemplates.mockResolvedValue([]);
});

describe('AgentPlannerPanel — load window on a FRIDAY (cross-week boundary)', () => {
  it('the mocked date really is the fixed Friday (guards the premise)', () => {
    expect(getTodayTT()).toBe(FIXED_FRIDAY);
    expect(new Date(`${FIXED_FRIDAY}T12:00:00Z`).getUTCDay()).toBe(5); // 5 = Friday
    expect(SPAN_END > WEEK_END).toBe(true);                            // the boundary IS crossed
  });

  it('extends the query past Saturday to cover the board\'s today+2 column', async () => {
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(getAgentWeek).toHaveBeenCalled());
    const [tenantId, agentId, rangeStart, rangeEnd] = getAgentWeek.mock.calls[0];
    expect(tenantId).toBe('t1');
    expect(agentId).toBe('agent-1');
    expect(rangeStart).toBe(WEEK_START);   // Sunday of this week
    expect(rangeEnd).toBe(SPAN_END);       // Sunday NEXT week — past weekEnd (2026-07-25)
  });

  it('renders an appointment that lives on the +2 column (past this week\'s Saturday)', async () => {
    // Range-AWARE mock: it honours the requested [start, end] the way Firestore
    // does, so this test is a genuine end-to-end detector — narrow the load
    // window back to weekEnd and the fixture is filtered out, the column renders
    // "No appointments", and this fails. (A range-ignoring mock would pass either
    // way and only prove the render wiring.)
    getAgentWeek.mockImplementation((_t, _a, start, end) => Promise.resolve(
      [{ id: 'beyond', date: SPAN_END, startTime: '09:00', durationMin: 60, type: 'FFI', status: 'scheduled' }]
        .filter((x) => x.date >= start && x.date <= end),
    ));
    // Desktop board (matchMedia → lg+) so the today-anchored 3-day span renders.
    const realMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true, media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    try {
      const { getByTestId } = render(<AgentPlannerPanel {...BASE_PROPS} />);
      await waitFor(() => expect(getByTestId('planner-desktop-board')).toBeInTheDocument());
      // The +2 column exists AND holds the appointment (pre-fix it rendered empty).
      const col = getByTestId(`planner-day-col-${SPAN_END}`);
      expect(col).toBeInTheDocument();
      expect(getByTestId('appt-card-beyond')).toBeInTheDocument();
      expect(col.textContent).not.toContain('No appointments');
    } finally {
      window.matchMedia = realMatchMedia;
    }
  });
});
