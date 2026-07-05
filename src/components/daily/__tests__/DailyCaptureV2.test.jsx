// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getDailyEntry: vi.fn(),
  saveDailyEntry: vi.fn(),
  getDailyEntriesForWeek: vi.fn(),
  getDraft: vi.fn(),
  aggregateCurrentWeekDaily: vi.fn(),
  getCompanyMinimums: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/dailyActivityService', () => ({
  getDailyEntry: hoisted.getDailyEntry,
  saveDailyEntry: hoisted.saveDailyEntry,
  getDailyEntriesForWeek: hoisted.getDailyEntriesForWeek,
}));
vi.mock('../../../services/submissionService', () => ({
  getDraft: hoisted.getDraft,
}));
vi.mock('../../../services/loggingModeService', () => ({
  aggregateCurrentWeekDaily: hoisted.aggregateCurrentWeekDaily,
}));
vi.mock('../../../services/goalsService', () => ({
  getCompanyMinimums: hoisted.getCompanyMinimums,
}));

import DailyCaptureV2 from '../DailyCaptureV2';
import {
  deriveCountStripChips,
  computeDayPoints,
  deriveWeekStripDays,
  computeStreak,
} from '../DailyCaptureV2.helpers';
import { computeTotalProductionCredit, computeLumpsumCredit } from '../../../lib/schema/weeklyReport.computations';

beforeEach(() => {
  vi.resetAllMocks();
  hoisted.useAuth.mockReturnValue({
    user: { uid: 'agent1' },
    userProfile: { name: 'Test Agent' },
    tenantId: 'tenant1',
  });
  hoisted.getDailyEntry.mockResolvedValue(null);
  hoisted.saveDailyEntry.mockResolvedValue(undefined);
  hoisted.getDailyEntriesForWeek.mockResolvedValue([]);
  hoisted.getDraft.mockResolvedValue(null);
  hoisted.aggregateCurrentWeekDaily.mockResolvedValue({ aggregated: true });
  hoisted.getCompanyMinimums.mockResolvedValue({ weeklyActivityFloors: {} });
});

// ─── deriveCountStripChips — pure ────────────────────────────────────────────

describe('deriveCountStripChips (pure)', () => {
  it('returns zeros for an empty list', () => {
    expect(deriveCountStripChips([])).toEqual({ appr: 0, ffi: 0, ci: 0, apps: 0 });
  });

  it('sums verified daily keys across multiple docs', () => {
    const docs = [
      {
        qualifiedApproaches: 3,
        ffiConducted: 1,
        ciConducted: 2,
        newBusiness: { apps: 1 },
      },
      {
        qualifiedApproaches: 4,
        ffiConducted: 2,
        ciConducted: 0,
        newBusiness: { apps: 1 },
      },
    ];
    expect(deriveCountStripChips(docs)).toEqual({ appr: 7, ffi: 3, ci: 2, apps: 2 });
  });

  it('does NOT read the brief-stale keys (ffisConducted / cisConducted / newCisBooked)', () => {
    // Belt-and-braces against regression to the pre-Phase-0 stale-cased keys.
    const docs = [
      {
        ffisConducted: 99,   // stale-cased — must NOT be summed
        cisConducted:  99,   // stale-cased — must NOT be summed
        newCisBooked:  99,   // stale-cased — must NOT be summed
        ffiConducted:  1,
        ciConducted:   1,
        newBusiness:   { apps: 1 },
      },
    ];
    const chips = deriveCountStripChips(docs);
    expect(chips.ffi).toBe(1);
    expect(chips.ci).toBe(1);
    expect(chips.apps).toBe(1);
  });

  it('coerces missing fields to 0', () => {
    const docs = [{ qualifiedApproaches: 5 }, {}];
    expect(deriveCountStripChips(docs)).toEqual({ appr: 5, ffi: 0, ci: 0, apps: 0 });
  });
});

// ─── DailyCaptureV2 ──────────────────────────────────────────────────────────

describe('DailyCaptureV2', () => {
  // Pin a fixed WEEKDAY so the weekday "Log Today" capture form renders
  // deterministically, independent of the real calendar day the suite runs on.
  // Root cause of the prior Sunday-only failures: on Sundays the component
  // CORRECTLY renders the Sunday review view (SundayConfirmView, see
  // DailyCaptureV2.jsx `isTodaySunday ? <SundayConfirmView/> : <form/>`), which
  // has no dcv2-save / "Log Today" heading / dcv2-day-credit — so these
  // weekday-form assertions could not find their elements and timed out. The
  // sibling date-sensitive tests already pin their own date; these did not.
  // Only Date is faked (setTimeout stays real) so waitFor / findBy still work.
  // Tests that need a specific date re-pin in their own body.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-17T12:00:00Z') }); // Wednesday
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders dialog with v2 testid and Log Today title', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    expect(await screen.findByTestId('daily-capture-v2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /log today/i })).toBeInTheDocument();
  });

  it('shows the count strip with all four chip labels', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('dcv2-count-strip');
    expect(screen.getByTestId('dcv2-chip-appr')).toBeInTheDocument();
    expect(screen.getByTestId('dcv2-chip-ffi')).toBeInTheDocument();
    expect(screen.getByTestId('dcv2-chip-ci')).toBeInTheDocument();
    expect(screen.getByTestId('dcv2-chip-apps')).toBeInTheDocument();
  });

  it('count-strip chips reflect deriveCountStripChips after week read resolves', async () => {
    hoisted.getDailyEntriesForWeek.mockResolvedValue([
      { qualifiedApproaches: 6, ffiConducted: 2, ciConducted: 1, newBusiness: { apps: 1 } },
      { qualifiedApproaches: 1, ffiConducted: 1, ciConducted: 1, newBusiness: { apps: 1 } },
    ]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('dcv2-chip-appr')).toHaveTextContent('7');
      expect(screen.getByTestId('dcv2-chip-ffi')).toHaveTextContent('3');
      expect(screen.getByTestId('dcv2-chip-ci')).toHaveTextContent('2');
      expect(screen.getByTestId('dcv2-chip-apps')).toHaveTextContent('2');
    });
  });

  it('Save writes the entry shape with verified storage keys (no stale-cased keys)', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());

    const args = hoisted.saveDailyEntry.mock.calls[0];
    expect(args[0]).toBe('tenant1');
    expect(args[1]).toBe('agent1');
    expect(args[2]).toBe('Test Agent');
    expect(typeof args[3]).toBe('string');   // date
    const entry = args[4];

    // Verified source keys must be present in the entry shape:
    for (const k of [
      'qualifiedApproaches', 'appointmentsSet', 'ffisScheduled', 'ffiConducted',
      'solutionPresentations', 'newCIBooked', 'oldCIBooked', 'ciConducted',
      'newNamesAdded', 'oldNamesWorked', 'serviceContacts',
      'hoursWorked', 'wins', 'blockers', 'notes',
    ]) {
      expect(entry).toHaveProperty(k);
    }
    expect(entry.newBusiness).toEqual(expect.objectContaining({ apps: 0, api: 0 }));
    expect(entry.pppIncreases).toEqual(expect.objectContaining({ apps: 0, apiIncrease: 0 }));
    expect(entry.lumpsums).toEqual(expect.objectContaining({ grossAmount: 0 }));

    // Stale-cased keys from the pre-Phase-0 brief MUST NOT be present:
    expect(entry).not.toHaveProperty('ffisConducted');
    expect(entry).not.toHaveProperty('cisConducted');
    expect(entry).not.toHaveProperty('newCisBooked');
    expect(entry).not.toHaveProperty('oldCisBooked');
  });

  it('stepper "+" increments the bound storage key and Save writes it', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('dcv2-save');
    // Press "+" on the "FFIs conducted" stepper → should set ffiConducted = 1.
    const inc = screen.getByRole('button', { name: /FFIs conducted increase/i });
    fireEvent.click(inc);
    fireEvent.click(inc);
    fireEvent.click(screen.getByTestId('dcv2-save'));
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    const entry = hoisted.saveDailyEntry.mock.calls[0][4];
    expect(entry.ffiConducted).toBe(2);
  });

  it('Save calls onClose after the post-save timeout', async () => {
    const onClose = vi.fn();
    render(<DailyCaptureV2 onClose={onClose} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('refreshes the count strip after a successful Save', async () => {
    hoisted.getDailyEntriesForWeek
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { qualifiedApproaches: 2, ffiConducted: 0, ciConducted: 0, newBusiness: { apps: 0 } },
      ]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('dcv2-chip-appr')).toHaveTextContent('0'));

    fireEvent.click(screen.getByTestId('dcv2-save'));
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('dcv2-chip-appr')).toHaveTextContent('2'));
  });

  it('per-day credit (header slot) matches computeTotalProductionCredit', async () => {
    // Seed an existing daily entry so the surface mounts pre-populated.
    const grossLump = 5000;
    hoisted.getDailyEntry.mockResolvedValue({
      newBusiness:  { apps: 2, api: 10000 },
      pppIncreases: { apps: 1, apiIncrease: 3000 },
      lumpsums:     { grossAmount: grossLump },
    });
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const expectedCredit = computeTotalProductionCredit({
      newBusiness:  { apps: 2, api: 10000 },
      pppIncreases: { apps: 1, apiIncrease: 3000 },
      lumpsums:     { grossAmount: grossLump, apiCredit: computeLumpsumCredit(grossLump) },
    });
    expect(expectedCredit).toBe(10000 + 3000 + 500);

    const slot = await screen.findByTestId('dcv2-day-credit');
    // formatCurrency wraps with TTD prefix — assert the numeric body appears.
    expect(slot.textContent).toMatch(/13[,.]500/);
  });

  // TZ-001 — failing test: daily components must use the TT timezone date
  // (America/Port_of_Spain, UTC-4), not the browser's local date.
  // Between 20:00–23:59 TT (00:00–03:59 UTC next day), getTodayLocalDate()
  // returns the UTC date (tomorrow in TT), misfiling the Firestore doc key.
  it('TZ-001: getDailyEntry called with TT-timezone date, not UTC date', async () => {
    // 2025-06-02T00:30:00Z = 2025-06-01T20:30:00 TT — UTC is June 2, TT is June 1.
    // Only fake Date — leave setTimeout/Promise timers real so waitFor works.
    vi.setSystemTime(new Date('2025-06-02T00:30:00Z')); // timers already faked by beforeEach
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => expect(hoisted.getDailyEntry).toHaveBeenCalled());
    // Third argument is the date string used as the Firestore doc key.
    const dateArg = hoisted.getDailyEntry.mock.calls[0][2];
    expect(dateArg).toBe('2025-06-01'); // TT date — not '2025-06-02' (UTC)
    vi.useRealTimers();
  });

  it('shows the week strip with 7 day buttons (Sun–Sat) when today is not Sunday', async () => {
    // Pin to a known Tuesday in TT (not Sunday → strip renders)
    vi.setSystemTime(new Date('2025-06-03T12:00:00Z')); // timers already faked by beforeEach
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('daily-capture-v2');
    const strip = await screen.findByTestId('dcv2-week-strip');
    // Should contain 7 day buttons (Sun=01 through Sat=07)
    const dayButtons = strip.querySelectorAll('button');
    expect(dayButtons).toHaveLength(7);
    // BUG-103: the grid must hold all 7 on one row. jsdom has no layout engine
    // (can't measure wrap), so guard the grid template directly — grid-cols-7,
    // never grid-cols-6 (which wrapped the 7th pill). This is day-independent
    // (the pixel-level single-row smoke can only run on a non-Sunday, when the
    // strip renders at all).
    expect(strip.className).toContain('grid-cols-7');
    expect(strip.className).not.toContain('grid-cols-6');
    vi.useRealTimers();
  });

  it('tapping a past strip day loads that date via getDailyEntry', async () => {
    // Pin to Wednesday 2025-06-04 TT — Monday 2025-06-02 is in the past
    vi.setSystemTime(new Date('2025-06-04T12:00:00Z')); // timers already faked by beforeEach
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('dcv2-week-strip');

    // getDailyEntry initially called with today (2025-06-04)
    await waitFor(() =>
      expect(hoisted.getDailyEntry).toHaveBeenCalledWith('tenant1', 'agent1', '2025-06-04')
    );

    // Tap Monday (2025-06-02 — past, back-fillable)
    const mondayBtn = await screen.findByTestId('dcv2-strip-day-2025-06-02');
    fireEvent.click(mondayBtn);

    // Should trigger a new getDailyEntry call for the Monday date
    await waitFor(() =>
      expect(hoisted.getDailyEntry).toHaveBeenCalledWith('tenant1', 'agent1', '2025-06-02')
    );
    vi.useRealTimers();
  });

  it('Save writes back-fill to the selected strip date, not today', async () => {
    // Pin to Wednesday 2025-06-04 TT
    vi.setSystemTime(new Date('2025-06-04T12:00:00Z')); // timers already faked by beforeEach
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('dcv2-week-strip');

    // Tap Monday for back-fill
    const mondayBtn = await screen.findByTestId('dcv2-strip-day-2025-06-02');
    fireEvent.click(mondayBtn);
    await waitFor(() =>
      expect(hoisted.getDailyEntry).toHaveBeenCalledWith('tenant1', 'agent1', '2025-06-02')
    );

    // Save — should write to Monday, not today
    const save = screen.getByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    const dateArg = hoisted.saveDailyEntry.mock.calls[0][3];
    expect(dateArg).toBe('2025-06-02');
    vi.useRealTimers();
  });

  it('Save includes all Phase 1b fields (livesSold, policiesDelivered, officeHours, fieldHours, dials, telContacts, f2fAttempts)', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    const entry = hoisted.saveDailyEntry.mock.calls[0][4];
    // Phase 1b fields must be present in the saved shape
    for (const k of [
      'dials', 'telContacts', 'f2fAttempts',
      'prospectingLettersSent', 'seminarsConducted',
      'socialPostsTotal', 'socialEngagementTotal', 'socialInboxEnquiries', 'namesFromSocial',
      'livesSold', 'policiesDelivered',
      'officeHours', 'fieldHours',
    ]) {
      expect(entry).toHaveProperty(k);
    }
    expect(entry.socialPlatformBreakdown).toEqual(
      expect.objectContaining({ facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 })
    );
  });

  it('loading spinner is shown while getDailyEntry is pending', () => {
    // Never resolve so loading stays true
    hoisted.getDailyEntry.mockReturnValue(new Promise(() => {}));
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error message when getDailyEntry rejects', async () => {
    hoisted.getDailyEntry.mockRejectedValue(new Error('network'));
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
    expect(screen.getByRole('alert').textContent).toMatch(/could not load/i);
  });

  it('points pill shows non-zero when data has production (ffiConducted increment)', async () => {
    // Give seed entry with ffiConducted=5 so computeDayPoints returns > 0
    hoisted.getDailyEntry.mockResolvedValue({ ffiConducted: 5 });
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.queryByTestId('dcv2-points-pill')).toBeInTheDocument()
    );
    const pill = screen.getByTestId('dcv2-points-pill');
    expect(pill.textContent).toMatch(/\d+/);
  });
});

// ─── computeDayPoints — pure ─────────────────────────────────────────────────

describe('computeDayPoints (pure)', () => {
  it('returns 0 for null or empty entry', () => {
    expect(computeDayPoints(null)).toBe(0);
    expect(computeDayPoints({})).toBe(0);
  });

  it('maps daily.dials to the dials accumulator in computePoints', () => {
    // ffiConducted=2 (known weight) + dials=3 should both contribute points
    const pts = computeDayPoints({ ffiConducted: 2, dials: 3 });
    const ptsNoDialsNoFFI = computeDayPoints({});
    expect(pts).toBeGreaterThan(ptsNoDialsNoFFI);
  });

  it('maps daily.newBusiness.apps to applicationsSold (v1 path)', () => {
    const withApps = computeDayPoints({ newBusiness: { apps: 1, api: 0 } });
    const noApps   = computeDayPoints({ newBusiness: { apps: 0, api: 0 } });
    expect(withApps).toBeGreaterThan(noApps);
  });

  it('maps daily.newBusiness.api to apiSold (per-thousand weight)', () => {
    const with2k = computeDayPoints({ newBusiness: { apps: 0, api: 2000 } });
    const with0  = computeDayPoints({ newBusiness: { apps: 0, api: 0 } });
    expect(with2k).toBeGreaterThan(with0);
  });
});

// ─── deriveWeekStripDays — pure ──────────────────────────────────────────────

describe('deriveWeekStripDays (pure)', () => {
  // Week: Sun 2025-06-01 through Sat 2025-06-07. Today = Wed 2025-06-04.
  const TODAY        = '2025-06-04';
  const WEEK_STARTING = '2025-06-01';

  it('returns exactly 7 days (Sun–Sat)', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK_STARTING);
    expect(days).toHaveLength(7);
  });

  it('first day is Sunday (weekStarting) and last is Saturday', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK_STARTING);
    expect(days[0].date).toBe('2025-06-01'); // Sunday (weekStarting)
    expect(days[0].isOff).toBe(true);
    expect(days[1].date).toBe('2025-06-02'); // Monday
    expect(days[6].date).toBe('2025-06-07'); // Saturday
    expect(days[6].isOff).toBe(true);
  });

  it('marks today correctly', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK_STARTING);
    const todayDay = days.find((d) => d.date === TODAY);
    expect(todayDay.isToday).toBe(true);
    expect(todayDay.isPast).toBe(false);
    expect(todayDay.isFuture).toBe(false);
  });

  it('marks past logged day as isLogged', () => {
    const weekDocs = [{ date: '2025-06-02' }]; // Monday has a doc
    const days = deriveWeekStripDays(weekDocs, TODAY, WEEK_STARTING);
    const mon = days.find((d) => d.date === '2025-06-02');
    expect(mon.isLogged).toBe(true);
    expect(mon.isPast).toBe(true);
  });

  it('marks future days as isFuture', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK_STARTING);
    const thu = days.find((d) => d.date === '2025-06-05');
    expect(thu.isFuture).toBe(true);
    expect(thu.isLogged).toBe(false);
  });
});

// ─── computeStreak — pure ────────────────────────────────────────────────────

describe('computeStreak (pure)', () => {
  const WEDNESDAY = '2025-06-04'; // Wednesday

  it('returns 0 when no docs exist', () => {
    expect(computeStreak([], WEDNESDAY)).toBe(0);
  });

  it('counts today if already logged', () => {
    const docs = [{ date: WEDNESDAY }];
    expect(computeStreak(docs, WEDNESDAY)).toBeGreaterThanOrEqual(1);
  });

  it('counts consecutive past days', () => {
    const docs = [
      { date: '2025-06-02' }, // Monday
      { date: '2025-06-03' }, // Tuesday
      { date: '2025-06-04' }, // Wednesday (today)
    ];
    expect(computeStreak(docs, WEDNESDAY)).toBe(3);
  });

  it('breaks streak on a missing day', () => {
    const docs = [
      { date: '2025-06-02' }, // Monday — gap here: Tue missing
      { date: '2025-06-04' }, // Wednesday (today)
    ];
    // Streak from today backward: today logged, Tue missing → streak = 1
    expect(computeStreak(docs, WEDNESDAY)).toBe(1);
  });
});

// ─── SundayConfirmView — component path ──────────────────────────────────────

describe('SundayConfirmView (component path)', () => {
  // 2026-06-21T12:00:00Z = Sunday 08:00 TT — isTodaySunday flips to true.

  it('renders the COMPLETED (prior) week summary when today is Sunday', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-21T12:00:00Z') });
    hoisted.getDailyEntriesForWeek.mockResolvedValue([
      { date: '2026-06-15', dials: 5, ffiConducted: 1 },
      { date: '2026-06-16', dials: 3, ffiConducted: 0 },
    ]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/your week from daily logs/i)).toBeInTheDocument();
    });
    // Sunday 2026-06-21 targets the COMPLETED week starting 2026-06-14, NOT the
    // empty week starting 2026-06-21 (Phase 2.2 week-targeting fix).
    expect(hoisted.getDailyEntriesForWeek).toHaveBeenCalledWith('tenant1', 'agent1', '2026-06-14');
    // "Days logged" row: 2 docs → "2/5"
    expect(screen.getByText('2/5')).toBeInTheDocument();
    // Normal daily entry Save button is NOT rendered on Sunday
    expect(screen.queryByTestId('dcv2-save')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('CTA "Review & submit" deep-links to the COMPLETED week with its real aggregation hint', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-21T12:00:00Z') });
    // Two daily docs for the completed week → daysWorked 2, aggregatedFromDaily true.
    hoisted.getDailyEntriesForWeek.mockResolvedValue([
      { date: '2026-06-15', dials: 5, ffiConducted: 1 },
      { date: '2026-06-16', dials: 3, ffiConducted: 0 },
    ]);
    const onReviewSubmit = vi.fn();
    render(<DailyCaptureV2 onClose={vi.fn()} onReviewSubmit={onReviewSubmit} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /review & submit/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /review & submit/i }));
    // Sunday 2026-06-21 → completed week 2026-06-14 (prior Sunday), not today's.
    // The hint reflects the reviewed week's real daily aggregation (Phase 1.2):
    // resolvePath gates on this, NOT on the dashboard's current-week draft.
    expect(onReviewSubmit).toHaveBeenCalledTimes(1);
    expect(onReviewSubmit).toHaveBeenCalledWith('2026-06-14', {
      aggregatedFromDaily: true,
      daysWorked: 2,
    });
    vi.useRealTimers();
  });

  it('weekday targets the CURRENT logging week (no −7)', async () => {
    // Wednesday 2026-06-24 → getSundayOf = 2026-06-21 (current week), unchanged.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-24T12:00:00Z') });
    hoisted.getDailyEntriesForWeek.mockResolvedValue([]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() =>
      expect(hoisted.getDailyEntriesForWeek).toHaveBeenCalledWith('tenant1', 'agent1', '2026-06-21')
    );
    // Mon–Sat shows the daily form, not the Sunday summary.
    expect(screen.queryByText(/your week from daily logs/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('reflects the already-submitted week: disabled "Submitted", no deep-link', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-21T12:00:00Z') });
    hoisted.getDailyEntriesForWeek.mockResolvedValue([]);
    hoisted.getDraft.mockResolvedValue({ status: 'submitted' });
    const onReviewSubmit = vi.fn();
    render(<DailyCaptureV2 onClose={vi.fn()} onReviewSubmit={onReviewSubmit} />);
    const submittedBtn = await screen.findByRole('button', { name: /submitted/i });
    expect(submittedBtn).toBeDisabled();
    expect(screen.queryByRole('button', { name: /review & submit/i })).not.toBeInTheDocument();
    fireEvent.click(submittedBtn);
    expect(onReviewSubmit).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ─── Aggregate-on-save (weekly-draft currency) ──────────────────────────────

describe('aggregate-on-save (Phase 2.2)', () => {
  // Wednesday 2026-06-17 — weekday: the daily entry form (with Save) is shown.
  it('recomputes the weekly draft after a successful daily save', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-17T12:00:00Z') });
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hoisted.aggregateCurrentWeekDaily).toHaveBeenCalledTimes(1));
    // Daily doc persists FIRST, then the draft recompute runs.
    expect(hoisted.saveDailyEntry.mock.invocationCallOrder[0])
      .toBeLessThan(hoisted.aggregateCurrentWeekDaily.mock.invocationCallOrder[0]);
    vi.useRealTimers();
  });

  it('isolates aggregation failure — the daily log still succeeds (no error surfaced)', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-17T12:00:00Z') });
    hoisted.aggregateCurrentWeekDaily.mockRejectedValue(new Error('agg boom'));
    const onClose = vi.fn();
    render(<DailyCaptureV2 onClose={onClose} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hoisted.aggregateCurrentWeekDaily).toHaveBeenCalledTimes(1));
    // The thrown aggregation must NOT surface a save error (Decision #4).
    expect(screen.queryByText(/save failed/i)).not.toBeInTheDocument();
    // And the post-save close still fires (save treated as successful).
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 2000 });
    vi.useRealTimers();
  });
});
