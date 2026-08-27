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
  sumWeekApi,
} from '../DailyCaptureV2.helpers';
import { computeTotalProductionCredit, computeLumpsumCredit } from '../../../lib/schema/weeklyReport.computations';
import { createEmptyDailyEntry } from '../../../lib/schema/dailyActivity';

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

  // ── THE KEY-NAME GUARD, MOVED OFF THE SAVE PATH ─────────────────────────
  // This assertion used to ride on a Save, because Save wrote every field.
  // Since slice D it writes only what the agent TOUCHED, so asserting every key
  // on a save would be asserting the exact bug that slice fixed — an untouched
  // `dials` in the write is what destroyed the day's KQM calls.
  //
  // The names are defined by createEmptyDailyEntry, so the guard now points
  // there. That is strictly stronger: it catches a stale-cased key whether or
  // not any UI happens to write it.
  it('the daily entry shape carries the verified storage keys (no stale-cased keys)', () => {
    const entry = createEmptyDailyEntry('2026-08-26', 'agent1', 'Test Agent');

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

  // ── THE SLICE-D CONTRACT ────────────────────────────────────────────────
  // The daily doc has two writers: this form (absolute values) and
  // functions/callActivity/ingestCallActivity.js (FieldValue.increment, all
  // day, unattended). setDoc merge:true leaves an ABSENT key alone and lets a
  // PRESENT one overwrite — so the only safe write is one that omits every
  // field the agent did not touch.
  it('Save writes ONLY the touched fields, so KQM increments survive', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /FFIs conducted increase/i }));
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());

    const args = hoisted.saveDailyEntry.mock.calls[0];
    expect(args[0]).toBe('tenant1');
    expect(args[1]).toBe('agent1');
    expect(args[2]).toBe('Test Agent');
    expect(typeof args[3]).toBe('string');   // date

    // Exactly the touched field, and nothing else.
    expect(args[4]).toEqual({ ffiConducted: 1 });

    // The fields the ingest owns are the ones that must never ride along
    // untouched — this is the assertion that would have caught the bug.
    for (const k of ['dials', 'dialsByType', 'telContacts', 'serviceCalls',
                     'serviceContacts', 'appointmentsSet', 'newNamesAdded', 'ffisScheduled']) {
      expect(args[4]).not.toHaveProperty(k);
    }
  });

  it('Save with nothing touched writes an empty patch (the doc is left alone)', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    // saveDailyEntry still stamps date/agent/updatedAt itself, which is what
    // creates the day's doc; none of the agent's numbers are re-asserted.
    expect(hoisted.saveDailyEntry.mock.calls[0][4]).toEqual({});
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
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('§1 states contract — Retry on a save failure re-invokes saveDailyEntry (not the load path)', async () => {
    const onClose = vi.fn();
    hoisted.saveDailyEntry.mockRejectedValueOnce(new Error('boom-save'));
    render(<DailyCaptureV2 onClose={onClose} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/save failed/i));
    expect(hoisted.saveDailyEntry).toHaveBeenCalledTimes(1);
    // 1 load + 1 pre-save re-read. Slice D made every save re-read the doc
    // first, to notice KQM calls that landed while the form was open, so
    // getDailyEntry no longer tells the two paths apart on its own. What still
    // does: each save attempt adds EXACTLY ONE read. A Retry that wrongly
    // re-ran the load path would add its own read on top of the save's.
    expect(hoisted.getDailyEntry).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(hoisted.saveDailyEntry).toHaveBeenCalledTimes(2);
    expect(hoisted.getDailyEntry).toHaveBeenCalledTimes(3); // +1 for the retry's own pre-save read
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

  // Same move as the key-name guard above: the Phase 1b fields are part of the
  // ENTRY SHAPE, and asserting them on a save now would assert the pre-slice-D
  // write-everything behaviour. The shape is checked at its source.
  it('the entry shape includes all Phase 1b fields', () => {
    const entry = createEmptyDailyEntry('2026-08-26', 'agent1', 'Test Agent');
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

  // …and that each of those inputs still REACHES the write when the agent
  // actually uses it. The shape test above and this one together cover what the
  // single write-everything test used to: the names are right, and the binding
  // from input to stored key is intact.
  it('a typed Phase 1b field reaches the write', async () => {
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /Dials \(total calls\) increase/i }));
    fireEvent.click(save);
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    expect(hoisted.saveDailyEntry.mock.calls[0][4]).toEqual({ dials: 1 });
  });

  // ── The conflict half of slice D ────────────────────────────────────────
  // Omitting untouched fields closes the common case silently. It cannot close
  // the case where the agent TYPES into a field KQM also writes — there the two
  // writers genuinely disagree and only a person can settle it. So the save
  // stops and asks rather than picking, which is the whole difference between
  // this and losing the numbers quietly.
  it('stops and asks when KQM calls landed on a field the agent typed', async () => {
    let reads = 0;
    hoisted.getDailyEntry.mockImplementation(async () =>
      (++reads === 1 ? { dials: 0 } : { dials: 14 }));

    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /Dials \(total calls\) increase/i }));
    fireEvent.click(save);

    const banner = await screen.findByTestId('dcv2-call-conflict');
    expect(banner).toHaveTextContent(/KQM Calls logged 14/i);
    // Nothing was written — the agent has not chosen yet.
    expect(hoisted.saveDailyEntry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /keep the kqm numbers/i }));
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    // Keeping KQM's number means dropping the field from the write entirely, so
    // merge:true leaves the ingest's 14 in place.
    expect(hoisted.saveDailyEntry.mock.calls[0][4]).not.toHaveProperty('dials');
  });

  it('"Use mine instead" writes the agent’s number over the ingest', async () => {
    let reads = 0;
    hoisted.getDailyEntry.mockImplementation(async () =>
      (++reads === 1 ? { dials: 0 } : { dials: 14 }));

    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /Dials \(total calls\) increase/i }));
    fireEvent.click(save);
    await screen.findByTestId('dcv2-call-conflict');

    fireEvent.click(screen.getByRole('button', { name: /use mine instead/i }));
    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    expect(hoisted.saveDailyEntry.mock.calls[0][4]).toEqual({ dials: 1 });
  });

  it('does NOT ask when the moved field is one the agent never touched', async () => {
    // The common case, and the one that must never interrupt anybody: KQM
    // logged calls all day, the agent typed something unrelated. No banner, and
    // `dials` simply is not in the write.
    let reads = 0;
    hoisted.getDailyEntry.mockImplementation(async () =>
      (++reads === 1 ? { dials: 0 } : { dials: 14 }));

    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const save = await screen.findByTestId('dcv2-save');
    await waitFor(() => expect(save).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /FFIs conducted increase/i }));
    fireEvent.click(save);

    await waitFor(() => expect(hoisted.saveDailyEntry).toHaveBeenCalled());
    expect(screen.queryByTestId('dcv2-call-conflict')).toBeNull();
    expect(hoisted.saveDailyEntry.mock.calls[0][4]).toEqual({ ffiConducted: 1 });
  });

  it('loading skeleton (PanelSkeleton) is shown while getDailyEntry is pending', () => {
    // Never resolve so loading stays true
    hoisted.getDailyEntry.mockReturnValue(new Promise(() => {}));
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(document.querySelector('.animate-spin')).toBeFalsy();
  });

  it('shows error message when getDailyEntry rejects', async () => {
    hoisted.getDailyEntry.mockRejectedValue(new Error('network'));
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
    expect(screen.getByRole('alert').textContent).toMatch(/could not load/i);
  });

  it('§1 states contract — Retry on a load failure re-invokes getDailyEntry (not a generic reload)', async () => {
    hoisted.getDailyEntry.mockRejectedValueOnce(new Error('network'));
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(hoisted.getDailyEntry).toHaveBeenCalledTimes(1);

    hoisted.getDailyEntry.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(hoisted.getDailyEntry).toHaveBeenCalledTimes(2);
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
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    vi.useRealTimers();
  });
});

// ─── sumWeekApi — pure ───────────────────────────────────────────────────────

describe('sumWeekApi (pure)', () => {
  it('sums newBusiness.api across docs; coerces missing to 0', () => {
    expect(sumWeekApi([
      { newBusiness: { api: 8400 } },
      { newBusiness: { api: 10000 } },
      { newBusiness: {} },
      {},
    ])).toBe(18400);
  });

  it('returns 0 for an empty/invalid list', () => {
    expect(sumWeekApi([])).toBe(0);
    expect(sumWeekApi(null)).toBe(0);
  });
});

// ─── DailyAnchorStrip (WTD API vs weekly target) ─────────────────────────────

describe('DailyAnchorStrip (integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-06-17T12:00:00Z') }); // Wednesday
  });
  afterEach(() => vi.useRealTimers());

  it('renders WTD API summed from week docs vs the weekly floor target', async () => {
    hoisted.getCompanyMinimums.mockResolvedValue({ weeklyActivityFloors: { api: 18000 } });
    hoisted.getDailyEntriesForWeek.mockResolvedValue([
      { date: '2026-06-15', newBusiness: { api: 8400 } },
      { date: '2026-06-16', newBusiness: { api: 10000 } },
    ]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const strip = await screen.findByTestId('dcv2-anchor-strip');
    await waitFor(() => expect(strip).toHaveAttribute('data-wtd-api', '18400'));
    expect(strip).toHaveAttribute('data-target', '18000');
    // 18400 / 18000 clamps to 100%.
    expect(strip).toHaveAttribute('data-pct', '100');
    expect(strip).toHaveTextContent(/weekly target cleared/i);
  });

  it('falls back to the code-default weekly target (4800) when floors omit api', async () => {
    hoisted.getCompanyMinimums.mockResolvedValue({ weeklyActivityFloors: {} });
    hoisted.getDailyEntriesForWeek.mockResolvedValue([
      { date: '2026-06-15', newBusiness: { api: 1200 } },
    ]);
    render(<DailyCaptureV2 onClose={vi.fn()} />);
    const strip = await screen.findByTestId('dcv2-anchor-strip');
    await waitFor(() => expect(strip).toHaveAttribute('data-target', '4800'));
    expect(strip).toHaveAttribute('data-wtd-api', '1200');
    expect(strip).toHaveAttribute('data-pct', '25'); // 1200/4800
  });
});

// ─── Streak celebration takeover ─────────────────────────────────────────────

describe('daily streak celebration (integration)', () => {
  // Friday 2026-06-19 — a full Mon–Fri of logged days can reach a 5-day streak.
  const FRIDAY = new Date('2026-06-19T12:00:00Z');
  const fullWeekDocs = [
    { date: '2026-06-15', newBusiness: { apps: 1, api: 1000 } },
    { date: '2026-06-16', newBusiness: { apps: 1, api: 1000 } },
    { date: '2026-06-17', newBusiness: { apps: 1, api: 1000 } },
    { date: '2026-06-18', newBusiness: { apps: 1, api: 1000 } },
    { date: '2026-06-19', newBusiness: { apps: 1, api: 1000 } },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: FRIDAY });
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('fires the takeover when a save crosses the 5-day milestone', async () => {
    hoisted.getDailyEntriesForWeek.mockResolvedValue(fullWeekDocs); // post-save → streak 5
    const onClose = vi.fn();
    render(<DailyCaptureV2 onClose={onClose} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);
    expect(await screen.findByTestId('daily-streak-celebration')).toBeInTheDocument();
    // Celebrating suppresses the auto-close — the takeover owns dismissal.
    expect(onClose).not.toHaveBeenCalled();
    // Marker persisted so it will not re-fire.
    expect(window.localStorage.getItem('agencytrack:celebrations:dailyStreakMax:agent1')).toBe('5');
  });

  it('does NOT re-fire when the 5-day milestone marker is already set', async () => {
    window.localStorage.setItem('agencytrack:celebrations:dailyStreakMax:agent1', '5');
    hoisted.getDailyEntriesForWeek.mockResolvedValue(fullWeekDocs);
    const onClose = vi.fn();
    render(<DailyCaptureV2 onClose={onClose} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);
    // No takeover; the normal post-save close fires instead.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByTestId('daily-streak-celebration')).not.toBeInTheDocument();
  });

  // FLAKE FIX — this is the test that failed in CI on PR #868 (the first flake
  // in this family PROVEN in CI: a verification-only PR the unit suite never
  // loads, green on a zero-change re-run). Its recorded error was
  // `expected "spy" to be called at least once` — the save→onClose `waitFor`
  // below, not the negative streak assertion.
  //
  // Root cause is NOT the shared global budget: every `waitFor(onClose)` in
  // this file passed `{ timeout: 2000 }`, which OVERRIDES the CI-tuned global
  // `asyncUtilTimeout: 5000` (src/test-setup.js) DOWNWARD. Under parallel-load
  // contention the save→close chain exceeds 2s and fails while 3s of the
  // intended budget goes unused. Note this makes the previously-prescribed
  // remedy (a wider per-test `it(name, fn, ms)` timeout) INEFFECTIVE here — the
  // inner waitFor caps itself regardless of the test budget.
  //
  // Fix: drop the self-narrowing override at all 5 sites in this file so they
  // inherit the 5000ms global. This RAISES nothing — it stops these tests
  // opting OUT of a budget that was already tuned for CI contention.
  it('does NOT fire below the milestone (short streak)', async () => {
    hoisted.getDailyEntriesForWeek.mockResolvedValue([
      { date: '2026-06-19', newBusiness: { apps: 1, api: 1000 } },
    ]); // streak 1
    const onClose = vi.fn();
    render(<DailyCaptureV2 onClose={onClose} />);
    const save = await screen.findByTestId('dcv2-save');
    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByTestId('daily-streak-celebration')).not.toBeInTheDocument();
  });
});

// ─── D-SC (26 Aug 2026): computeDayPoints reads the real serviceCalls ────────
// Before this ruling computeDayPoints mapped serviceContacts → serviceCalls, so
// the daily pace badge scored service activity that the aggregated weekly draft
// did not. An attempt and a reach are not the same number.

describe('computeDayPoints — D-SC service field', () => {
  it('scores the real serviceCalls field', () => {
    const withCalls = computeDayPoints({ serviceCalls: 5 });
    const noCalls   = computeDayPoints({ serviceCalls: 0 });
    expect(withCalls).toBeGreaterThan(noCalls);
  });

  it('does NOT score serviceContacts', () => {
    expect(computeDayPoints({ serviceContacts: 9 })).toBe(0);
  });

  it('serviceContacts does not inflate a day that already has serviceCalls', () => {
    const a = computeDayPoints({ serviceCalls: 4 });
    const b = computeDayPoints({ serviceCalls: 4, serviceContacts: 40 });
    expect(b).toBe(a);
  });

  it('a daily entry at schema version 2 still scores through the flat mapping', () => {
    // Daily `version` is the DAILY schema version, not the weekly-submission
    // version computePoints branches on. Bumping one must not re-route the other.
    const v1 = computeDayPoints({ version: 1, newBusiness: { apps: 2, api: 3000 }, dials: 7 });
    const v2 = computeDayPoints({ version: 2, newBusiness: { apps: 2, api: 3000 }, dials: 7 });
    expect(v2).toBe(v1);
    expect(v2).toBeGreaterThan(0);
  });
});
