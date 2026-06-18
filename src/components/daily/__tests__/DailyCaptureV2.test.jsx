// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getDailyEntry: vi.fn(),
  saveDailyEntry: vi.fn(),
  getDailyEntriesForWeek: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../services/dailyActivityService', () => ({
  getDailyEntry: hoisted.getDailyEntry,
  saveDailyEntry: hoisted.saveDailyEntry,
  getDailyEntriesForWeek: hoisted.getDailyEntriesForWeek,
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
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2025-06-02T00:30:00Z') });
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => expect(hoisted.getDailyEntry).toHaveBeenCalled());
    // Third argument is the date string used as the Firestore doc key.
    const dateArg = hoisted.getDailyEntry.mock.calls[0][2];
    expect(dateArg).toBe('2025-06-01'); // TT date — not '2025-06-02' (UTC)
    vi.useRealTimers();
  });

  it('shows the week strip with 6 day buttons (Mon–Sat) when today is not Sunday', async () => {
    // Pin to a known Tuesday in TT (not Sunday → strip renders)
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2025-06-03T12:00:00Z') });
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await screen.findByTestId('daily-capture-v2');
    const strip = await screen.findByTestId('dcv2-week-strip');
    // Should contain 6 day buttons (Mon=02 through Sat=07)
    const dayButtons = strip.querySelectorAll('button');
    expect(dayButtons).toHaveLength(6);
    vi.useRealTimers();
  });

  it('tapping a past strip day loads that date via getDailyEntry', async () => {
    // Pin to Wednesday 2025-06-04 TT — Monday 2025-06-02 is in the past
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2025-06-04T12:00:00Z') });
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
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2025-06-04T12:00:00Z') });
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

  it('returns exactly 6 days (Mon–Sat)', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK_STARTING);
    expect(days).toHaveLength(6);
  });

  it('first day is Monday and last is Saturday', () => {
    const days = deriveWeekStripDays([], TODAY, WEEK_STARTING);
    expect(days[0].date).toBe('2025-06-02'); // Monday
    expect(days[5].date).toBe('2025-06-07'); // Saturday
    expect(days[5].isOff).toBe(true);
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
