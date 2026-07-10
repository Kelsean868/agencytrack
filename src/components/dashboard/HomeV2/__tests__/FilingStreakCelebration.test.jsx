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
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText(/FILING STREAK · 5 WEEKS/i)).toBeInTheDocument();
    // Marker persisted so a reload cannot re-fire the same rung.
    expect(window.localStorage.getItem(FILING_KEY)).toBe('5');
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
