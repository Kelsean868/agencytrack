// @vitest-environment jsdom
//
// FilingStreakCelebration — the home surface's weekly FILING-streak milestone
// takeover. Fires on load when computeSubmissionStreak.currentStreak crosses an
// un-celebrated rung ([5, 10, 25, 52]); persists a per-year marker so it never
// re-fires on reload. Mirrors the daily-streak integration test in
// DailyCaptureV2.test.jsx (fires at threshold / absent below / absent when the
// marker is already set).

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilingStreakCelebration from '../FilingStreakCelebration';

const YEAR = 2026;
const AGENT = 'agent1';
const FILING_KEY = `agencytrack:celebrations:filingStreakMax:${AGENT}:${YEAR}`;

// N consecutive submitted weekly reports (7-day-adjacent) starting 2026-01-04.
function submittedWeeks(n) {
  const start = new Date('2026-01-04T12:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start.getTime() + i * 7 * 86400000);
    return { weekStarting: d.toISOString().slice(0, 10), status: 'submitted' };
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('FilingStreakCelebration', () => {
  it('fires the milestone-5 takeover for a 9-week streak when uncelebrated', () => {
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(9)} agentUid={AGENT} year={YEAR} />,
    );
    expect(screen.getByTestId('filing-streak-celebration')).toBeInTheDocument();
    // Eyebrow keeps the "FILING STREAK · N WEEKS" shape (VH leg
    // t2-filing-streak-milestone asserts this literal text).
    expect(screen.getByText(/FILING STREAK · 5 WEEKS/i)).toBeInTheDocument();
    // Hero — the milestone number itself, rendered large/gold.
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('weeks filed in a row')).toBeInTheDocument();
    // Marker persisted so a reload cannot re-fire the same rung.
    expect(window.localStorage.getItem(FILING_KEY)).toBe('5');
  });

  it('shows the STREAK / BEST / NEXT MILESTONE chips', () => {
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(9)} agentUid={AGENT} year={YEAR} />,
    );
    const stats = screen.getByTestId('celebration-stats');
    expect(stats).toHaveTextContent('STREAK');
    expect(stats).toHaveTextContent('5 wks');
    expect(stats).toHaveTextContent('BEST');
    expect(stats).toHaveTextContent('NEXT MILESTONE');
    expect(stats).toHaveTextContent('10 wks');
  });

  it('shows the annual 52-week variant copy and THIS YEAR chip', () => {
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(52)} agentUid={AGENT} year={YEAR} />,
    );
    expect(screen.getByText(/★ FILING STREAK · A FULL YEAR/i)).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    const stats = screen.getByTestId('celebration-stats');
    expect(stats).toHaveTextContent('THIS YEAR');
    expect(stats).toHaveTextContent('52 / 52');
  });

  it('a single "Dismiss celebration" control exists and closes the takeover', () => {
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(9)} agentUid={AGENT} year={YEAR} />,
    );
    const dismissButtons = screen.getAllByLabelText('Dismiss celebration');
    expect(dismissButtons).toHaveLength(1);
    fireEvent.click(dismissButtons[0]);
    expect(screen.queryByTestId('filing-streak-celebration')).not.toBeInTheDocument();
  });

  it('the primary CTA ("Keep filing") closes the takeover', () => {
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(9)} agentUid={AGENT} year={YEAR} />,
    );
    fireEvent.click(screen.getByTestId('celebration-primary-cta'));
    expect(screen.queryByTestId('filing-streak-celebration')).not.toBeInTheDocument();
  });

  it('does NOT fire below the first milestone (short streak)', () => {
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(3)} agentUid={AGENT} year={YEAR} />,
    );
    expect(screen.queryByTestId('filing-streak-celebration')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(FILING_KEY)).toBeNull();
  });

  it('does NOT re-fire when the milestone marker is already set (celebratedMax >= streak rung)', () => {
    window.localStorage.setItem(FILING_KEY, '5');
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(9)} agentUid={AGENT} year={YEAR} />,
    );
    expect(screen.queryByTestId('filing-streak-celebration')).not.toBeInTheDocument();
  });

  it('fires the higher rung (10) once the streak climbs past a celebrated 5', () => {
    window.localStorage.setItem(FILING_KEY, '5');
    render(
      <FilingStreakCelebration allSubmissions={submittedWeeks(11)} agentUid={AGENT} year={YEAR} />,
    );
    expect(screen.getByTestId('filing-streak-celebration')).toBeInTheDocument();
    expect(screen.getByText(/FILING STREAK · 10 WEEKS/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(FILING_KEY)).toBe('10');
  });
});
