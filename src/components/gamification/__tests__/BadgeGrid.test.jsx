// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BadgeGrid, { computeEarnedBadges, BADGE_KEY_ORDER } from '../BadgeGrid';

describe('computeEarnedBadges', () => {
  it('returns empty set for no submissions', () => {
    expect(computeEarnedBadges([]).size).toBe(0);
  });

  it('returns empty set for submissions with no status=submitted', () => {
    expect(computeEarnedBadges([{ status: 'pending' }]).size).toBe(0);
  });

  it('awards first_submission for any submitted report', () => {
    const subs = [{ status: 'submitted', referralCalls: 0, followUpCalls: 0, coldCalls: 0, applicationsSold: 0, weekStarting: '2026-01-05' }];
    expect(computeEarnedBadges(subs).has('first_submission')).toBe(true);
  });
});

describe('BadgeGrid — rendering', () => {
  it('renders all 14 badge label elements', () => {
    const { container } = render(<BadgeGrid submissions={[]} />);
    // badge-name divs inside badge-item — one per badge regardless of label uniqueness
    const badgeNames = container.querySelectorAll('.badge-name');
    expect(badgeNames.length).toBe(BADGE_KEY_ORDER.length);
  });

  it('unearned badges have locked aria-label', () => {
    render(<BadgeGrid submissions={[]} />);
    const lockedBadges = document.querySelectorAll('[aria-label*="locked"]');
    // All 14 badges should be locked with no submissions
    expect(lockedBadges.length).toBe(BADGE_KEY_ORDER.length);
  });

  it('earned badge does not carry locked aria-label', () => {
    const subs = [{ status: 'submitted', referralCalls: 0, followUpCalls: 0, coldCalls: 0, applicationsSold: 0, weekStarting: '2026-01-05' }];
    render(<BadgeGrid submissions={subs} />);
    const firstStepEl = screen.getByText('First Steps').closest('[class*="badge-item"]');
    expect(firstStepEl).not.toHaveAttribute('aria-label');
  });

  it('tier pip aria-label reflects badge tier', () => {
    render(<BadgeGrid submissions={[]} />);
    const tier1Imgs = document.querySelectorAll('[aria-label="Tier 1 of 5"]');
    expect(tier1Imgs.length).toBeGreaterThan(0);
  });
});
