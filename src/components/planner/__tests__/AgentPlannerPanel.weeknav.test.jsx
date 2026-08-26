// @vitest-environment jsdom
/**
 * Week-navigation integration (planner week-nav track).
 *
 * Pinned to a FIXED FRIDAY (same discipline as AgentPlannerPanel.loadWindow)
 * so the #867 today+2 load-window extension is exercised on every run and its
 * current-week-ONLY scoping is provable: on a navigated week the query must be
 * exactly that week's Sun..Sat, with no today-anchored tail.
 *
 * jsdom has no matchMedia → `useIsDesktop` is false → the suites below drive the
 * MOBILE Week view by default.
 *
 * CORRECTED RATIONALE (external review F9). An earlier version of this comment
 * claimed that because mobile and desktop share one `anchorDate`, "proving the
 * anchor contract on either surface proves it for both". That overclaims. The
 * anchor STATE is shared, but the desktop path has its OWN handler
 * (`changeSpan`), its own snap-home trigger set, its own `columnStart` wiring,
 * and its own keyboard behaviour — none of which the mobile path exercises. Two
 * real defects (a silent week-jump from Arrow ←/→ on the board, and the Book
 * button prefilling today while another week is displayed) lived precisely in
 * that uncovered gap. The final describe block below closes it with the
 * matchMedia stub already used in the sibling AgentPlannerPanel.test.jsx.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    await waitFor(() => expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 26 – Aug 1'));
  });

  it('previous week re-queries that week (past weeks are viewable)', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-prev'));
    await waitFor(() => expect(lastRange()).toEqual({ start: PREV_WEEK.start, end: PREV_WEEK.end }));
    await waitFor(() => expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 12 – 18'));
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
    await waitFor(() => expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Aug 9 – 15'));
  });

  it('Today snaps back to the current week and restores the today+2 window', async () => {
    await openWeekView();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    fireEvent.click(screen.getByTestId('planner-week-today'));
    await waitFor(() => expect(lastRange()).toEqual({ start: THIS_WEEK.start, end: SPAN_END }));
    await waitFor(() => expect(screen.queryByTestId('planner-week-today')).toBeNull());
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
    await waitFor(() => expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 19 – 25'));
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
    await waitFor(() => expect(screen.queryByTestId('running-late-banner')).toBeNull());
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
    // aria-pressed tracks HIDING (F3): default = shown = hide OFF.
    expect(screen.getByTestId('planner-toggle-postponed-mobile')).toHaveAttribute('aria-pressed', 'false');
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

// ── DESKTOP BOARD (external review F9 — the previously-uncovered surface) ────
// The board path has its own handler (`changeSpan`), its own snap-home trigger
// set, and its own `columnStart` wiring. Stub matchMedia → desktop, exactly as
// the sibling AgentPlannerPanel.test.jsx does.
describe('AgentPlannerPanel — week navigation on the DESKTOP board', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true, media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
  });
  afterEach(() => { window.matchMedia = realMatchMedia; });

  async function openBoard() {
    render(<AgentPlannerPanel {...BASE_PROPS} />);
    await waitFor(() => expect(screen.getByTestId('planner-desktop-board')).toBeInTheDocument());
  }

  it('renders the SAME week nav on the board, bound to the same anchor', async () => {
    await openBoard();
    expect(screen.getByTestId('planner-week-nav')).toBeInTheDocument();
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 19 – 25');
    expect(screen.queryByTestId('planner-week-today')).toBeNull();
  });

  it('columnStart: 3-day columns are TODAY-anchored while home', async () => {
    await openBoard();
    // Default span is 3day; today is the fixed Friday.
    expect(screen.getByTestId(`planner-day-col-${FRIDAY}`)).toBeInTheDocument();
    expect(screen.getByTestId('planner-day-col-2026-07-25')).toBeInTheDocument();
    expect(screen.getByTestId('planner-day-col-2026-07-26')).toBeInTheDocument();
  });

  it('columnStart: 3-day columns anchor to the VIEWED week\'s Sunday once navigated', async () => {
    await openBoard();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    // Sun/Mon/Tue of the navigated week — NOT today+0/1/2.
    await waitFor(() => expect(screen.getByTestId('planner-day-col-2026-07-26')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('planner-day-col-2026-07-27')).toBeInTheDocument());
    expect(screen.getByTestId('planner-day-col-2026-07-28')).toBeInTheDocument();
    expect(screen.queryByTestId(`planner-day-col-${FRIDAY}`)).toBeNull();
  });

  it('changeSpan: opening Follow-ups snaps the anchor home', async () => {
    await openBoard();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    fireEvent.click(screen.getByTestId('planner-span-followups'));
    await waitFor(() => expect(lastRange()).toEqual({ start: THIS_WEEK.start, end: SPAN_END }));
  });

  it('changeSpan: switching between week-scoped spans does NOT snap home', async () => {
    await openBoard();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    fireEvent.click(screen.getByTestId('planner-span-week'));
    // Still on the navigated week — day/3-day/week are all week-scoped.
    await waitFor(() => expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 26 – Aug 1'));
    fireEvent.click(screen.getByTestId('planner-span-day'));
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 26 – Aug 1');
  });

  it('the week nav is hidden on Follow-ups (not a week-scoped view)', async () => {
    await openBoard();
    fireEvent.click(screen.getByTestId('planner-span-followups'));
    await waitFor(() => expect(screen.queryByTestId('planner-week-nav')).toBeNull());
  });

  // F2 REGRESSION GUARD: Arrow ←/→ drives the MOBILE view pills, which are not
  // rendered on the board. Before the fix it still ran `changeView`, firing the
  // snap-home invariant and yanking the board back to the current week with no
  // visible cause. It must stay inert here.
  it('F2: Arrow ←/→ does NOT move the week on the desktop board', async () => {
    await openBoard();
    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    const callsBefore = getAgentWeek.mock.calls.length;

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });

    // Anchor unmoved, and no reload was triggered.
    expect(screen.getByTestId('planner-week-label')).toHaveTextContent('Jul 26 – Aug 1');
    expect(getAgentWeek.mock.calls.length).toBe(callsBefore);
  });

  // F1 REGRESSION GUARD: the follow-ups badge is derived from the LOADED week,
  // so it must not be shown at all while navigated away.
  it('F1: the follow-ups badge is suppressed on a navigated week', async () => {
    getProspectInfo.mockResolvedValue([
      { id: 'p1', clientName: 'A', intendedAppointmentDate: '2026-07-20' },
      { id: 'p2', clientName: 'B', intendedAppointmentDate: '2026-07-21' },
    ]);
    await openBoard();
    // Home: the badge shows a real count.
    await waitFor(() => expect(screen.getByTestId('planner-span-followups')).toHaveTextContent('(2)'));

    fireEvent.click(screen.getByTestId('planner-week-next'));
    await waitFor(() => expect(lastRange().start).toBe(NEXT_WEEK.start));
    // Navigated: no count rendered rather than a wrong one.
    await waitFor(() => expect(screen.getByTestId('planner-span-followups')).not.toHaveTextContent('('));
  });
});
