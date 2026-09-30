// @vitest-environment jsdom
//
// R2-10 — FR Career: rings and the cleared state at the exact threshold,
// biggest-gap selection, the weekly apps rate across a year boundary, the
// commitment save / nudge making the same service calls as the Nexus portal,
// level selection (desktop inspector, phone inline) and keyboard reach.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  aggregatePersistency: vi.fn(),
  getGoals: vi.fn(),
  setGoals: vi.fn(),
  getCompanyMinimums: vi.fn(),
  getMoneyNeeds: vi.fn(),
  entry: vi.fn(),
}));
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { name: 'Test Agent', contractStartDate: null }, tenantId: 't1' }),
}));
vi.mock('../../../../services/goalsService', () => ({
  getGoals: (...a) => hoisted.getGoals(...a),
  setGoals: (...a) => hoisted.setGoals(...a),
  getCompanyMinimums: (...a) => hoisted.getCompanyMinimums(...a),
}));
vi.mock('../../../../services/moneyNeedsService', () => ({ getMoneyNeeds: (...a) => hoisted.getMoneyNeeds(...a) }));
vi.mock('../../../../lib/persistency/calculations', () => ({ aggregatePersistency: (...a) => hoisted.aggregatePersistency(...a) }));
vi.mock('../../compete/useMyLeaderboardEntry', () => ({ default: (...a) => hoisted.entry(...a) }));
vi.mock('../../../gamification/BadgeGrid', () => ({ default: () => null }));

import FrCareer from '../FrCareer';
import CareerPortal from '../../../profile/CareerPortal';
import { levelRings, biggestGap, weeksLeftInYear } from '../../../../lib/fr/careerViewModel';
import { computeQuarterlyAPI, quarterlyAPISeries } from '../../../../lib/career/careerModel';
import { roundPersistencyPct } from '../../../../lib/persistency/persistencyRounding';
import { trophyRoom } from '../../../../lib/fr/competeModel';

const Y = new Date().getFullYear();
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const stats = (o) => ({ ytdAPI: 0, ytdApps: 0, avgPersistency: null, yearsOfService: null, trailing2YrAPI: 0, weeklyPace: 0, ...o });

function stubWidth(matches) {
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
function props(extra = {}) {
  hoisted.aggregatePersistency.mockReturnValue({ aggregatedPersistency: 0.9 });
  return {
    submissions: [
      { status: 'submitted', weekStarting: `${Y - 1}-03-01`, apiSold: 300000, applicationsSold: 0 },
      { status: 'submitted', weekStarting: `${Y}-02-01`, apiSold: 300000, applicationsSold: 20 },
    ],
    user: { startDate: new Date(Date.now() - 2.5 * YEAR_MS).toISOString() },
    persistencyData: [{ year: Y, month: 1 }],
    onOpenTrophies: vi.fn(),
    onPlan: vi.fn(),
    ...extra,
  };
}

beforeEach(() => {
  stubWidth(true);
  hoisted.getGoals.mockReset().mockResolvedValue({ personalAnnualAPI: 150000, personalAnnualApps: 45, personalAnnualPersistency: 90, targetAnnualAPI: 350000 });
  hoisted.setGoals.mockReset().mockResolvedValue(undefined);
  hoisted.getCompanyMinimums.mockReset().mockResolvedValue({ annualAPI: 200000, annualApps: 40, persistency: 90 });
  hoisted.getMoneyNeeds.mockReset().mockResolvedValue({ firstYearCommissionsRequired: 400000 });
  hoisted.entry.mockReset().mockReturnValue({ loading: false, error: null, entry: { badges: ['first_submission'], points: 100, weeklyStreak: 1 }, retry: vi.fn() });
});
afterEach(cleanup);

describe('careerViewModel — rings, cleared state and the biggest gap', () => {
  it('a ring clears at exactly the threshold; persistency judges the 2-dp value (89.994 no, 89.996 yes)', () => {
    const base = { trailing2YrAPI: 250000, ytdApps: 42, yearsOfService: 2 };
    const at = (p) => levelRings(2, stats({ ...base, avgPersistency: roundPersistencyPct(p) }));
    expect(at(89.996).map((r) => [r.key, r.pct, r.cleared])).toEqual([['api', 100, true], ['apps', 100, true], ['persistency', 100, true], ['years', 100, true]]);
    const low = at(89.994).find((r) => r.key === 'persistency');
    expect([low.pct, low.cleared, low.value]).toEqual([100, false, '89.99%']);
    const under = levelRings(2, stats({ ...base, trailing2YrAPI: 249999, avgPersistency: 90 })).find((r) => r.key === 'api');
    expect([under.pct, under.cleared]).toEqual([100, false]);
    expect(levelRings(7, stats({ yearsOfService: 4 })).map((r) => r.key)).toEqual(['years']);
  });

  it('biggest gap = the lowest % complete, years excluded; ties go to the earlier criterion; all cleared → null', () => {
    // API 50 %, apps 25 %, persistency 90 % → apps
    expect(biggestGap(3, stats({ trailing2YrAPI: 175000, ytdApps: 12, avgPersistency: 81, yearsOfService: 0 }), new Date(Y, 8, 30)).key).toBe('apps');
    // API 50 % = apps 50 % → API (earlier in level order)
    expect(biggestGap(3, stats({ trailing2YrAPI: 175000, ytdApps: 24, avgPersistency: 90, yearsOfService: 0 })).key).toBe('api');
    // only years unmet → null (it cannot be sped up)
    expect(biggestGap(3, stats({ trailing2YrAPI: 350000, ytdApps: 48, avgPersistency: 90, yearsOfService: 1 }))).toBeNull();
    expect(biggestGap(3, stats({ trailing2YrAPI: 175000, ytdApps: 48, avgPersistency: 90 })).text).toBe('TTD 175,000 to go.');
    expect(biggestGap(3, stats({ trailing2YrAPI: 350000, ytdApps: 48, avgPersistency: 87.5 })).text).toBe('2.50 points to go.');
  });

  it('the weekly apps rate: 36 to go on 30 Sep is about 3 a week; on 31 Dec it is all 36 in the last week', () => {
    expect(biggestGap(3, stats({ trailing2YrAPI: 350000, ytdApps: 12, avgPersistency: 90 }), new Date(Y, 8, 30)).text).toBe('36 to go — about 3 a week to 31-12.');
    expect(weeksLeftInYear(new Date(Y, 11, 31))).toBe(1);
    expect(biggestGap(3, stats({ trailing2YrAPI: 350000, ytdApps: 12, avgPersistency: 90 }), new Date(Y, 11, 31)).text).toBe('36 to go — about 36 a week to 31-12.');
    expect(weeksLeftInYear(new Date(Y + 1, 0, 1))).toBe(52);
  });

  it('the trajectory series is computeQuarterlyAPI with keys', () => {
    const subs = Array.from({ length: 30 }, (_, i) => ({ status: 'submitted', weekStarting: `${Y - 2 + Math.floor(i / 12)}-${String(1 + (i % 12)).padStart(2, '0')}-05`, apiSold: 1000 * (i + 1) }));
    expect(quarterlyAPISeries(subs).map((q) => q.value)).toEqual(computeQuarterlyAPI(subs));
    expect(quarterlyAPISeries([]).every((q) => q.key === null && q.value === 0)).toBe(true);
  });
});

describe('FrCareer — screen', () => {
  it('desktop: the next level is selected by default; picking a coin updates the inspector; every coin is a keyboard button', () => {
    render(<FrCareer {...props()} />);
    // 2-yr avg TTD 300,000, 20 apps (< 42) → Level 1; the next level (2) is selected.
    expect(screen.getByTestId('fr-career-header').textContent).toContain('Level 1 · Salesperson');
    const inspector = screen.getByTestId('fr-career-inspector');
    expect(within(inspector).getByTestId('fr-career-panel-2')).toBeInTheDocument();
    for (let l = 1; l <= 7; l += 1) {
      const coin = screen.getByTestId(`fr-career-coin-${l}`);
      expect(coin.tagName).toBe('BUTTON');
      expect(coin.getAttribute('tabindex')).not.toBe('-1');
    }
    expect(screen.getByTestId('fr-career-coin-2')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('fr-career-coin-6'));
    expect(within(inspector).getByTestId('fr-career-panel-6').textContent).toContain('"Elite Advisor" title');
    expect(screen.getByTestId('fr-career-coin-6')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('fr-career-coin-2')).toHaveAttribute('aria-pressed', 'false');
  });

  it('phone: a coin expands its level inline (aria-expanded) and there is no inspector', () => {
    stubWidth(false);
    render(<FrCareer {...props()} />);
    expect(screen.queryByTestId('fr-career-inspector')).toBeNull();
    const coin5 = screen.getByTestId('fr-career-coin-5');
    expect(coin5).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(coin5);
    expect(coin5).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(coin5.getAttribute('aria-controls')).textContent).toContain('Level 5 · Senior Advisor');
  });

  it('next level rings, the estimate verbatim, the plan button and the trophies donut', () => {
    const p = props();
    render(<FrCareer {...p} />);
    // Level 2: API (300K ≥ 250K), persistency and years cleared; apps 20 of 42 not.
    expect(screen.getByTestId('fr-career-cleared').textContent).toBe('3 of 4 cleared');
    expect(screen.getByTestId('fr-career-ring-apps')).toHaveAttribute('data-cleared', 'false');
    // The estimate is estimateWeeksToNextLevel verbatim (YTD API vs the level's API).
    expect(screen.getByTestId('fr-career-estimate').textContent).toBe('You qualify!');
    expect(screen.getByTestId('fr-career-gap').textContent).toContain('22 to go');
    fireEvent.click(screen.getByRole('button', { name: 'Plan it in the Game plan' }));
    expect(p.onPlan).toHaveBeenCalledTimes(1);
    const room = trophyRoom({ badges: ['first_submission'], points: 100, weeklyStreak: 1 });
    expect(screen.getByTestId('fr-career-trophies').textContent).toContain(`${room.earnedCount}/${room.total}`);
    fireEvent.click(screen.getByRole('button', { name: 'Open the Trophy room' }));
    expect(p.onOpenTrophies).toHaveBeenCalledTimes(1);
  });

  it('commitment: a figure below the floor says so; the save and nudge make the same calls as the Nexus portal', async () => {
    hoisted.getGoals.mockResolvedValue({ personalAnnualAPI: 150000, personalAnnualApps: 45, personalAnnualPersistency: 90 });
    render(<CareerPortal {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit My Goals/ }));
    fireEvent.change(screen.getByLabelText('Annual API (TTD)'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, continue' }));
    await waitFor(() => expect(hoisted.setGoals).toHaveBeenCalledTimes(1));
    const nexusCall = hoisted.setGoals.mock.calls[0];
    cleanup();
    hoisted.setGoals.mockClear();
    render(<FrCareer {...props()} />);
    await waitFor(() => expect(screen.getByTestId('fr-career-commit-api')).toBeInTheDocument());
    expect(screen.getByTestId('fr-career-commit-api').textContent).toContain('Your commitment is below the company floor.');
    fireEvent.click(screen.getByRole('button', { name: /Edit my goals/ }));
    fireEvent.change(screen.getByLabelText('Annual API (TTD)'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByTestId('fr-career-nudge')).toBeInTheDocument();
    expect(hoisted.setGoals).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, continue' }));
    await waitFor(() => expect(hoisted.setGoals).toHaveBeenCalledTimes(1));
    expect(hoisted.setGoals.mock.calls[0]).toEqual(nexusCall);
  });

  it('commitment read failed → Retry reads again', async () => {
    hoisted.getGoals.mockRejectedValueOnce(new Error('offline'));
    render(<FrCareer {...props()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(hoisted.getGoals).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('fr-career-commit-api')).toBeInTheDocument();
  });
});
