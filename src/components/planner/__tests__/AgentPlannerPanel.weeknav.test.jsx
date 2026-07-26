// @vitest-environment jsdom
/**
 * Week-navigation integration (planner week-nav track).
 *
 * Pinned to a FIXED FRIDAY (same discipline as AgentPlannerPanel.loadWindow)
 * so the #867 today+2 load-window extension is exercised on every run and its
 * current-week-ONLY scoping is provable: on a navigated week the query must be
 * exactly that week's Sun..Sat, with no today-anchored tail.
 *
 * jsdom has no matchMedia → `useIsDesktop` is false → these drive the MOBILE
 * Week view. That is deliberate: mobile and desktop share ONE anchorDate, so
 * proving the anchor contract on either surface proves it for both, and the
 * mobile path needs no matchMedia shim.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// 2026-07-24 is a FRIDAY → this week = Sun 2026-07-19 … Sat 2026-07-25.
const FRIDAY = '2026-07-24';
const THIS_WEEK = { start: '2026-07-19', end: '2026-07-25' };
const NEXT_WEEK = { start: '2026-07-26', end: '2026-08-01' };
const PREV_WEEK = { start: '2026-07-12', end: '2026-07-18' };
const SPAN_END = '2026-07-26'; // today+2, one day past this week's Saturday

vi.mock('../../../utils/dateInputs', async (importActual) => {
  const actual = await importActual();
  return { ...actual, getTodayTT: () => FRIDAY };
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

const BASE_PROPS = {
  tenantId: 't1', agentId: 'agent-1', agentUnitId: 'um-9',
  agentBranchId: 'branch-7', callerRole: 'agent',
};

/** The (start, end) of the most recent getAgentWeek call. */
const lastRange = () => {
  const call = getAgentWeek.mock.calls[getAgentWeek.mock.calls.length - 1];
  return { start: call[2], end: call[3] };
};

async function openWeekView() {
  render(<AgentPlannerPanel {...BASE_PROPS} />);
  await waitFor(() => expect(getAgentWeek).toHaveBeenCalled());
  fireEvent.click(screen.getByTestId('planner-view-week'));
  await screen.findByTestId('planner-week-nav');
}

beforeEach(() => {
  vi.clearAllMocks();
  getAgentWeek.mockResolvedValue([]);
  getProspectInfo.mockResolvedValue([]);
  listTemplates.mockResolvedValue([]);
});

describe('AgentPlannerPanel — week navigation', () => {
  it('starts on the current week and keeps #867 today+2 semantics', async () => {
    await openWeekView();
    expect(lastRange()).toEqual({ start: THIS_WEEK.start, end: SPAN_END });
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 19 – 25');
    // No snap-back offered while already home.
    expect(screen.queryByTestId('planner-week-today')).toBeNull();
  });

  it('next week re-queries that week EXACTLY — no today-anchored tail', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange()).toEqual({ start: NEXT_WEEK.start, end: NEXT_WEEK.end }));
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 26 – Aug 1');
  });

  it('previous week re-queries that week (past weeks are viewable)', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-prev'));
    await waitFor(() => expect(lastRange()).toEqual({ start: PREV_WEEK.start, end: PREV_WEEK.end }));
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 12 – 18');
  });

  it('navigation is unlimited — three weeks forward keeps stepping', async () => {
    await openWeekView();
    // Step-and-settle (re-querying the button each time): three clicks batched
    // into one tick collapse to a single re-render, which proves nothing about
    // stepping. A user clicks, sees the week, clicks again — model that.
    for (const expected of [NEXT_WEEK.start, '2026-08-02', '2026-08-09']) {
      fireEvent.click(screen.getByTestId('planner-week-next'));
      await waitFor(() => expect(lastRange().start).toBe(expected));
    }
    expect(lastRange()).toEqual({ start: '2026-08-09', end: '2026-08-15' });
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Aug 9 – 15');
  });

  it('Today snaps back to the current week and restores the today+2 window', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    fireEvent.click(screen.getByTestId('planner-week-today'));
    await waitFor(() => expect(lastRange()).toEqual({ start: THIS_WEEK.start, end: SPAN_END }));
    expect(screen.queryByTestId('planner-week-today')).toBeNull();
  });
});

describe('AgentPlannerPanel — snap-home invariant', () => {
  it('leaving the Week view for Today snaps the anchor home', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));

    // Today is a today-scoped surface: it must never render against a week
    // whose data does not contain today.
    fireEvent.click(screen.getByTestId('planner-view-today'));
    await waitFor(() => expect(lastRange()).toEqual({ start: THIS_WEEK.start, end: SPAN_END }));
  });

  it('leaving the Week view for Follow-ups snaps the anchor home', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-prev'));
    await waitFor(() => expect(lastRange().start).toBe(PREV_WEEK.start));

    // deriveFollowups builds its "already booked" set from the LOADED week, so
    // a navigated week would mark genuinely-booked prospects as unbooked.
    fireEvent.click(screen.getByTestId('planner-view-followups'));
    await waitFor(() => expect(lastRange()).toEqual({ start: THIS_WEEK.start, end: SPAN_END }));
  });

  it('returning to Week after a snap-home starts from the current week again', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    fireEvent.click(screen.getByTestId('planner-view-today'));
    await waitFor(() => expect(lastRange().start).toBe(THIS_WEEK.start));
    fireEvent.click(screen.getByTestId('planner-view-week'));
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 19 – 25');
  });
});

describe('AgentPlannerPanel — week-scoped derivations follow the anchor', () => {
  it('week counters count the VIEWED week, not the current one', async () => {
    // Two CIs live in the NEXT week only.
    getAgentWeek.mockImplementation(async (_t, _a, start) => (
      start === NEXT_WEEK.start
        ? [
          { id: 'n1', date: '2026-07-27', startTime: '09:00', durationMin: 60, type: 'CI', status: 'scheduled' },
          { id: 'n2', date: '2026-07-28', startTime: '10:00', durationMin: 60, type: 'CI', status: 'scheduled' },
        ]
        : []
    ));
    await openWeekView();
    const counters = screen.getByTestId('planner-week-counters');
    expect(counters).toHaveTextContent('0/');

    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    await waitFor(() => expect(screen.getByTestId('planner-week-counters')).toHaveTextContent('2/'));
  });

  it('the running-late banner is suppressed off the current week', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    expect(screen.queryByTestId('running-late-banner')).toBeNull();
  });
});

describe('AgentPlannerPanel — postponed tombstones (mobile Week view)', () => {
  const weekWithTombstones = [
    { id: 'live', date: '2026-07-22', startTime: '09:00', durationMin: 60, type: 'FFI', status: 'scheduled' },
    { id: 'tomb', date: '2026-07-22', startTime: '10:00', durationMin: 60, type: 'CI', status: 'postponed' },
  ];

  it('defaults to showing postponed, per the retained-churn design authority', async () => {
    getAgentWeek.mockResolvedValue(weekWithTombstones);
    await openWeekView();
    expect(screen.getByTestId('planner-toggle-postponed-mobile')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('appt-card-tomb')).toBeInTheDocument();
  });

  it('toggling hides tombstones and reports the count — no re-query, no write', async () => {
    getAgentWeek.mockResolvedValue(weekWithTombstones);
    await openWeekView();
    const callsBefore = getAgentWeek.mock.calls.length;

    fireEvent.click(screen.getByTestId('planner-toggle-postponed-mobile'));
    await waitFor(() => expect(screen.queryByTestId('appt-card-tomb')).toBeNull());
    expect(screen.getByTestId('appt-card-live')).toBeInTheDocument();
    expect(screen.getByTestId('planner-day-hidden-2026-07-22')).toHaveTextContent('+1 postponed hidden');
    // Presentation only: the data layer was never touched.
    expect(getAgentWeek.mock.calls.length).toBe(callsBefore);
  });
});
