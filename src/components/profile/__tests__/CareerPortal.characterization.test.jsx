// @vitest-environment jsdom
//
// R2-10 commit 1 — CHARACTERIZATION of today's CareerPortal before the FR port
// (brief docs/briefs/fr-career-leaderboard-kickoff.md § 3, decision 1 and 7).
// Pins: the current level at each boundary (1…7, persistency null, years
// null, 89.994 / 89.996 vs 90), the estimate strings, 8 quarters of API, the
// YTD stats the level drawer shows, and the commitment save / nudge calls.
// These must pass UNCHANGED after the extraction; an assertion edit is a
// brief § 5 stop.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  aggregatePersistency: vi.fn(),
  getGoals: vi.fn(),
  setGoals: vi.fn(),
  getCompanyMinimums: vi.fn(),
  getMoneyNeeds: vi.fn(),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { name: 'Test Agent', contractStartDate: null }, tenantId: 't1' }),
}));
vi.mock('../../../services/goalsService', () => ({
  getGoals: (...a) => hoisted.getGoals(...a),
  setGoals: (...a) => hoisted.setGoals(...a),
  getCompanyMinimums: (...a) => hoisted.getCompanyMinimums(...a),
}));
vi.mock('../../../services/moneyNeedsService', () => ({ getMoneyNeeds: (...a) => hoisted.getMoneyNeeds(...a) }));
vi.mock('../../../lib/persistency/calculations', () => ({ aggregatePersistency: (...a) => hoisted.aggregatePersistency(...a) }));
vi.mock('../../gamification/BadgeGrid', () => ({ default: () => <div data-testid="badge-grid" /> }));

import CareerPortal from '../CareerPortal';

const Y = new Date().getFullYear();
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * `n` submitted weeks in `year`. By default the whole `api` / `apps` sit in the
 * first week (whole numbers, so no float drift decides a boundary); `spread`
 * divides them evenly across the weeks instead (for the trajectory).
 */
function weeks(year, n, api, apps, spread = false) {
  return Array.from({ length: n }, (_, i) => ({
    status: 'submitted',
    weekStarting: `${year}-${String(1 + Math.floor(i / 4) % 12).padStart(2, '0')}-${String(1 + (i % 4) * 7).padStart(2, '0')}`,
    apiSold: spread ? api / n : (i === 0 ? api : 0),
    applicationsSold: spread ? apps / n : (i === 0 ? apps : 0),
  }));
}
/** A fixture whose 2-yr average API is `avg` and YTD apps `apps`. */
function fixture({ avg, apps, pers, years, ytdWeeks = 20, spread = false }) {
  const submissions = [...weeks(Y - 1, 20, avg, 0, spread), ...weeks(Y, ytdWeeks, avg, apps, spread)];
  const persistencyData = pers == null ? [] : [{ year: Y, month: 1 }];
  hoisted.aggregatePersistency.mockReturnValue({ aggregatedPersistency: pers == null ? null : pers / 100 });
  // F-2: years of service come from contractStartDate (YYYY-MM-DD); startDate is no longer read.
  const user = years == null ? {} : { contractStartDate: new Date(Date.now() - years * YEAR_MS).toISOString().slice(0, 10) };
  return { submissions, persistencyData, user };
}
function levelShown() {
  return screen.getByText(/of 7 levels$/).textContent;
}

beforeEach(() => {
  hoisted.getGoals.mockReset().mockResolvedValue({ personalAnnualAPI: 300000, personalAnnualApps: 45, personalAnnualPersistency: 90, targetAnnualAPI: 350000 });
  hoisted.setGoals.mockReset().mockResolvedValue(undefined);
  hoisted.getCompanyMinimums.mockReset().mockResolvedValue({ annualAPI: 200000, annualApps: 40, persistency: 90 });
  hoisted.getMoneyNeeds.mockReset().mockResolvedValue({ firstYearCommissionsRequired: 400000 });
});
afterEach(cleanup);

describe('CareerPortal characterization — current level', () => {
  it.each([
    ['L1 (nothing met)', { avg: 0, apps: 0, pers: null, years: null }],
    ['L2', { avg: 250000, apps: 42, pers: 90, years: 2.1 }],
    ['L3', { avg: 350000, apps: 48, pers: 90, years: 3.1 }],
    ['L4', { avg: 450000, apps: 48, pers: 90, years: 4.1 }],
    ['L5', { avg: 600000, apps: 52, pers: 90, years: 5.1 }],
    ['L6', { avg: 800000, apps: 52, pers: 90, years: 6.1 }],
    ['L7', { avg: 800000, apps: 52, pers: 90, years: 10.1 }],
    ['persistency null', { avg: 800000, apps: 52, pers: null, years: 10.1 }],
    ['years null', { avg: 800000, apps: 52, pers: 95, years: null }],
    ['persistency 89.994 vs 90', { avg: 250000, apps: 42, pers: 89.994, years: 2.1 }],
    ['persistency 89.996 vs 90', { avg: 250000, apps: 42, pers: 89.996, years: 2.1 }],
  ])('%s', (_name, f) => {
    render(<CareerPortal {...fixture(f)} />);
    expect(levelShown()).toMatchSnapshot();
  });
});

describe('CareerPortal characterization — the next-milestone estimate', () => {
  it.each([
    // Next level is L2 (TTD 250,000) in every case; pace = YTD API ÷ 20 weeks.
    ['qualifies (YTD 260,000)', { avg: 100000, apps: 0, pers: null, years: null }, (s) => s.map((w, i) => (w.weekStarting.startsWith(String(Y)) && i === 20 ? { ...w, apiSold: 260000 } : w))],
    ['weeks (YTD 220,000, 30,000 to go at 11,000 a week)', { avg: 220000, apps: 0, pers: null, years: null }, null],
    ['months (YTD 40,000)', { avg: 40000, apps: 0, pers: null, years: null }, null],
    ['no weeks this year', { avg: 0, apps: 0, pers: null, years: null, ytdWeeks: 0 }, null],
  ])('%s', (_name, f, tweak) => {
    const fx = fixture(f);
    render(<CareerPortal {...fx} submissions={tweak ? tweak(fx.submissions) : fx.submissions} />);
    const card = screen.getByText('Next milestone').parentElement;
    expect(card.textContent).toMatchSnapshot();
  });
});

describe('CareerPortal characterization — trajectory and YTD stats', () => {
  it('8 quarters of API (TTD thousands)', () => {
    const f = fixture({ avg: 320000, apps: 30, pers: 88.5, years: 3.5, ytdWeeks: 36, spread: true });
    render(<CareerPortal {...f} />);
    const bars = [...document.querySelectorAll('[title$="K TTD"]')].map((el) => el.getAttribute('title'));
    expect(bars).toMatchSnapshot();
  });

  it('the level drawer prints the YTD stats against each criterion', () => {
    const f = fixture({ avg: 320000, apps: 30, pers: 88.5, years: 3.5, ytdWeeks: 36, spread: true });
    render(<CareerPortal {...f} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View Level 5 — Senior Advisor criteria' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatchSnapshot();
  });
});

describe('CareerPortal characterization — annual commitment (GoalsSection)', () => {
  it('shows the scorecards, then saves the edited draft with the same service calls', async () => {
    render(<CareerPortal {...fixture({ avg: 0, apps: 0, pers: null, years: null })} />);
    await waitFor(() => expect(hoisted.getGoals).toHaveBeenCalledTimes(1));
    expect(hoisted.getGoals.mock.calls[0]).toEqual(['t1', 'u1']);
    expect(hoisted.getCompanyMinimums.mock.calls[0]).toEqual(['t1']);
    expect(hoisted.getMoneyNeeds.mock.calls[0]).toEqual(['t1', 'u1', Y]);
    fireEvent.click(await screen.findByRole('button', { name: /Edit My Goals/ }));
    fireEvent.change(screen.getByLabelText('Annual API (TTD)'), { target: { value: '450000' } });
    fireEvent.change(screen.getByLabelText('Annual Applications'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(hoisted.setGoals).toHaveBeenCalledTimes(1));
    expect(hoisted.setGoals.mock.calls[0]).toMatchSnapshot();
    await waitFor(() => expect(hoisted.getGoals).toHaveBeenCalledTimes(2));
  });

  it('a commitment below Money Needs asks first; "Yes, continue" saves, "Cancel" does not', async () => {
    render(<CareerPortal {...fixture({ avg: 0, apps: 0, pers: null, years: null })} />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit My Goals/ }));
    fireEvent.change(screen.getByLabelText('Annual API (TTD)'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    const nudge = await screen.findByText('Commitment below Money Needs');
    expect(nudge.parentElement.textContent).toMatchSnapshot();
    expect(hoisted.setGoals).not.toHaveBeenCalled();
    fireEvent.click(within(nudge.parentElement).getByRole('button', { name: 'Cancel' }));
    expect(hoisted.setGoals).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, continue' }));
    await waitFor(() => expect(hoisted.setGoals).toHaveBeenCalledTimes(1));
    expect(hoisted.setGoals.mock.calls[0][2]).toMatchSnapshot();
  });
});
