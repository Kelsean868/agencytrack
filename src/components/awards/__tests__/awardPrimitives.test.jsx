// @vitest-environment jsdom
//
// Track J — Agent Awards v2 shared primitives.
//
// Asserts the state→token mapping (qualified=gold / contention=primary /
// locked=text-faint) + groupByProgress logic, since those are the load-bearing
// invariants for the manager-side carve-out and the future cleanup that will
// dedup AgentAwardsPanel's inline copies onto this module.

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import {
  AwardDonut, HeroAwardCard, GroupHeader, AwardCard, AwardDrillDrawer,
} from '../awardPrimitives';
import { groupByProgress } from '../awardGrouping';

beforeEach(() => cleanup());

describe('AwardDonut', () => {
  it('exposes data-state + data-percent for assertion stability', () => {
    render(<AwardDonut state="contention" percent={47} />);
    const node = screen.getByTestId('award-donut');
    expect(node.getAttribute('data-state')).toBe('contention');
    expect(node.getAttribute('data-percent')).toBe('47');
    expect(node.textContent).toMatch(/47%/);
  });

  it('renders for all three states (qualified, contention, locked) without throwing', () => {
    render(<><AwardDonut state="qualified" percent={100} /></>);
    render(<><AwardDonut state="contention" percent={50} /></>);
    render(<><AwardDonut state="locked" percent={5} /></>);
    // All three appear in the document (cleanup happens between tests, not
    // within one test — so we just assert each one rendered).
    expect(screen.getAllByTestId('award-donut').length).toBe(3);
  });
});

describe('HeroAwardCard', () => {
  it('returns null when award is null', () => {
    const { container } = render(<HeroAwardCard award={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the eyebrow + name + gap label for an in-contention award', () => {
    const award = {
      id: 'a', name: 'Production Silver', prize: 'Silver trophy',
      progressPercent: 75,
      criteria: [{ label: 'Settled API', target: 200000, current: 150000, met: false, unit: 'TTD' }],
    };
    render(<HeroAwardCard award={award} />);
    expect(screen.getByTestId('hero-award-card')).toBeInTheDocument();
    expect(screen.getByText('Production Silver')).toBeInTheDocument();
    expect(screen.getByText(/Silver trophy/)).toBeInTheDocument();
    // Gap = 50000 → TTD 50,000
    expect(screen.getByText(/TTD 50,000/)).toBeInTheDocument();
  });

  it('honors a custom eyebrow prop', () => {
    const award = {
      id: 'a', name: 'X', prize: 'Y', progressPercent: 50,
      criteria: [{ label: 'L', target: 100, current: 50, met: false, unit: '' }],
    };
    render(<HeroAwardCard award={award} eyebrow="★ Closest goal" />);
    expect(screen.getByText('★ Closest goal')).toBeInTheDocument();
  });

  // §2.7 — pace-to-qualify narrative. award.pace is undefined in all the
  // cases above (pre-existing awardPrimitives contract), so no pace line
  // renders there — confirmed backward-compatible by the first case below.
  it('renders no pace line when award.pace is absent (backward compatible)', () => {
    const award = {
      id: 'a', name: 'X', prize: 'Y', progressPercent: 50,
      criteria: [{ label: 'L', target: 100, current: 50, met: false, unit: '' }],
    };
    render(<HeroAwardCard award={award} />);
    expect(screen.queryByTestId('hero-pace-line')).toBeNull();
  });

  it('renders the pace line "~N wks at your current pace · avg TTD X/wk" when award.pace is present', () => {
    const award = {
      id: 'a', name: 'Production Silver', prize: 'Silver trophy', progressPercent: 75,
      criteria: [{ label: 'Settled API', target: 200000, current: 156000, met: false, unit: 'TTD' }],
      pace: { avgPerWeek: 22000, unit: 'TTD', gap: 44000, weeksToQualify: 2, hasPace: true },
    };
    render(<HeroAwardCard award={award} />);
    const line = screen.getByTestId('hero-pace-line');
    expect(line.textContent).toBe('~2 wks at your current pace · avg TTD 22,000/wk');
  });

  it('renders the honest no-pace fallback when award.pace.hasPace is false — no NaN/Infinity', () => {
    const award = {
      id: 'a', name: 'Production Silver', prize: 'Silver trophy', progressPercent: 5,
      criteria: [{ label: 'Settled API', target: 200000, current: 0, met: false, unit: 'TTD' }],
      pace: { avgPerWeek: 0, unit: 'TTD', gap: 200000, weeksToQualify: null, hasPace: false },
    };
    render(<HeroAwardCard award={award} />);
    const line = screen.getByTestId('hero-pace-line');
    expect(line.textContent).toBe('No pace data yet — check back after your next submission.');
    expect(line.textContent).not.toMatch(/NaN|Infinity/);
  });
});

describe('AwardCard', () => {
  const baseAward = {
    id: 'p1', name: 'Persistency Bronze', prize: 'Bronze',
    progressPercent: 88, eligible: false, inContention: true,
    criteria: [{ label: 'Avg Persistency', target: 90, current: 79.2, met: false, unit: '%' }],
  };

  it('renders qualified state pill + state=qualified data attr', () => {
    const award = { ...baseAward, eligible: true, inContention: false, progressPercent: 105 };
    render(<AwardCard award={award} onClick={() => {}} />);
    const card = screen.getByTestId('award-card-p1');
    expect(card.getAttribute('data-state')).toBe('qualified');
    expect(card.textContent).toContain('QUALIFIED');
  });

  it('renders contention state pill + state=contention data attr', () => {
    render(<AwardCard award={baseAward} onClick={() => {}} />);
    const card = screen.getByTestId('award-card-p1');
    expect(card.getAttribute('data-state')).toBe('contention');
    expect(card.textContent).toContain('88%');
  });

  it('renders IN PROGRESS label + state=locked data attr for a not-yet-eligible award with real progress', () => {
    const award = { ...baseAward, inContention: false, progressPercent: 5 };
    render(<AwardCard award={award} onClick={() => {}} />);
    const card = screen.getByTestId('award-card-p1');
    expect(card.getAttribute('data-state')).toBe('locked');
    expect(card.textContent).toContain('IN PROGRESS');
    expect(card.textContent).not.toContain('NOT STARTED');
  });

  // Banked FOLLOW_UP "Award card NOT STARTED above 0%" — the fix keeps NOT
  // STARTED for exactly 0 progress and only reclassifies 0 < progress <
  // contention as IN PROGRESS.
  it('renders NOT STARTED label for an award at exactly 0% progress', () => {
    const award = { ...baseAward, inContention: false, progressPercent: 0 };
    render(<AwardCard award={award} onClick={() => {}} />);
    const card = screen.getByTestId('award-card-p1');
    expect(card.getAttribute('data-state')).toBe('locked');
    expect(card.textContent).toContain('NOT STARTED');
  });

  it('fires onClick when activated', () => {
    let fired = 0;
    render(<AwardCard award={baseAward} onClick={() => { fired++; }} />);
    fireEvent.click(screen.getByTestId('award-card-p1'));
    expect(fired).toBe(1);
  });
});

describe('AwardDrillDrawer', () => {
  const award = {
    id: 'p1', name: 'Production Silver', prize: 'Silver trophy',
    progressPercent: 75, eligible: false,
    criteria: [
      { label: 'Settled API', target: 200000, current: 150000, met: false, unit: 'TTD' },
      { label: 'Apps Sold',   target: 24,     current: 24,     met: true,  unit: 'apps' },
    ],
    note: 'Estimated — pending confirmation',
  };

  it('renders criteria checklist + matches each criterion percent', () => {
    render(<AwardDrillDrawer award={award} onClose={() => {}} />);
    const drawer = screen.getByTestId('award-drill-drawer');
    expect(drawer.textContent).toContain('Production Silver');
    expect(drawer.textContent).toContain('Settled API');
    expect(drawer.textContent).toContain('Apps Sold');
    // Settled API: 150/200 = 75% · Apps Sold: 24/24 = 100%
    expect(drawer.textContent).toContain('75%');
    expect(drawer.textContent).toContain('100%');
    expect(drawer.textContent).toContain('Estimated — pending confirmation');
  });

  it('closes on Escape key', () => {
    let closed = 0;
    render(<AwardDrillDrawer award={award} onClose={() => { closed++; }} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(1);
  });

  it('3.4 — renders the provenance panel only when a provenance prop is passed', () => {
    const provenance = {
      source: 'CONFIRMED SETTLEMENTS', sourceLive: false, unit: 'TTD',
      settled: 150000, target: 200000, pct: 75,
      segments: [{ kind: 'base', label: 'Settled production', value: 150000 }],
      campaignPending: true, pending: null,
    };
    const { rerender } = render(<AwardDrillDrawer award={award} onClose={() => {}} />);
    expect(screen.queryByTestId('award-provenance-panel')).not.toBeInTheDocument();
    rerender(<AwardDrillDrawer award={award} onClose={() => {}} provenance={provenance} />);
    expect(screen.getByTestId('award-provenance-panel')).toBeInTheDocument();
    expect(screen.getByTestId('award-provenance-campaign-pending')).toBeInTheDocument();
  });

  it('closes when scrim backdrop is clicked', () => {
    let closed = 0;
    render(<AwardDrillDrawer award={award} onClose={() => { closed++; }} />);
    // The scrim is the first absolute-positioned div with aria-hidden="true"
    const scrim = document.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim);
    expect(closed).toBe(1);
  });

  it('returns null when award is null', () => {
    const { container } = render(<AwardDrillDrawer award={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  // §2.7 — YOUR PACE block.
  it('renders no YOUR PACE block when award.pace is absent (backward compatible)', () => {
    render(<AwardDrillDrawer award={award} onClose={() => {}} />);
    expect(screen.queryByTestId('award-drawer-your-pace')).toBeNull();
  });

  it('YOUR PACE block renders avg/wk + remaining gap + projected qualify week', () => {
    const awardWithPace = {
      ...award,
      eligible: false,
      pace: {
        avgPerWeek: 22000, unit: 'TTD', gap: 13000, weeksToQualify: 1,
        hasPace: true, projectedDateISO: '2026-07-08',
      },
    };
    render(<AwardDrillDrawer award={awardWithPace} onClose={() => {}} />);
    const block = screen.getByTestId('award-drawer-your-pace');
    expect(block.textContent).toContain('TTD 13,000');   // remaining gap
    expect(block.textContent).toContain('TTD 22,000/wk'); // avg pace
    expect(block.textContent).toContain('~1 wk');         // projection (weeks)
    expect(block.textContent).toMatch(/2026|Jul/);        // projected date surfaced somewhere
    expect(block.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('YOUR PACE block is not rendered for a qualified award (no gap left to pace toward)', () => {
    const qualifiedAward = {
      ...award,
      eligible: true,
      pace: { avgPerWeek: 22000, unit: 'TTD', gap: 0, weeksToQualify: null, hasPace: true },
    };
    render(<AwardDrillDrawer award={qualifiedAward} onClose={() => {}} />);
    expect(screen.queryByTestId('award-drawer-your-pace')).toBeNull();
  });

  it('YOUR PACE block shows the honest no-pace fallback when hasPace is false — no NaN/Infinity', () => {
    const noPaceAward = {
      ...award,
      eligible: false,
      pace: { avgPerWeek: 0, unit: 'TTD', gap: 200000, weeksToQualify: null, hasPace: false },
    };
    render(<AwardDrillDrawer award={noPaceAward} onClose={() => {}} />);
    const block = screen.getByTestId('award-drawer-your-pace');
    expect(block.textContent).toContain('No pace data yet');
    expect(block.textContent).not.toMatch(/NaN|Infinity/);
  });
});

// Display-formatting guard (fix: round displayed progress percentage).
// progressPercent arrives from the awards engine as a raw float (e.g.
// 13.333…); every render site must whole-number it. A formatter-only test
// is insufficient given the awardPrimitives ↔ AgentAwardsPanel duplication,
// so this asserts against the actual rendered components.
describe('award percent rounding (display-only)', () => {
  const RAW_FLOAT = /\d+\.\d{3,}\s*%/;

  it('AwardDonut whole-numbers a fractional percent', () => {
    render(<AwardDonut state="contention" percent={13.333333333333334} />);
    const node = screen.getByTestId('award-donut');
    expect(node.textContent).toContain('13%');
    expect(node.textContent).not.toMatch(RAW_FLOAT);
  });

  it('AwardCard whole-numbers the state pill + big percent', () => {
    const award = {
      id: 'p1', name: 'Persistency Bronze', prize: 'Bronze',
      progressPercent: 9.538461538461538, eligible: false, inContention: true,
      criteria: [{ label: 'API', target: 100, current: 9.5, met: false, unit: '' }],
    };
    render(<AwardCard award={award} onClick={() => {}} />);
    const card = screen.getByTestId('award-card-p1');
    // Both the state pill and the large percent display read "10%".
    expect(card.textContent).toContain('10%');
    expect(card.textContent).not.toMatch(RAW_FLOAT);
  });

  it('rounds 0.5 boundary up (half-up via Math.round)', () => {
    render(<AwardDonut state="contention" percent={49.5} />);
    expect(screen.getByTestId('award-donut').textContent).toContain('50%');
  });
});

describe('GroupHeader', () => {
  it('renders label + count and accent color is threaded through', () => {
    render(<GroupHeader label="✓ Qualified" count={3} accentStyle={{ color: 'var(--color-gold)' }} />);
    expect(screen.getByText('✓ Qualified')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('groupByProgress', () => {
  const awards = [
    { id: 'q',  eligible: true,  inContention: false, progressPercent: 110 },
    { id: 'a1', eligible: false, inContention: true,  progressPercent: 95  },
    { id: 'a2', eligible: false, inContention: true,  progressPercent: 75  },
    { id: 'p1', eligible: false, inContention: true,  progressPercent: 60  },
    { id: 'p2', eligible: false, inContention: false, progressPercent: 35  },
    { id: 's1', eligible: false, inContention: false, progressPercent: 12  },
  ];

  it('partitions awards into Qualified / Almost / Progress / Starting', () => {
    const { hero, qualified, almostThere, makingProgress, justStarting } = groupByProgress(awards);
    expect(qualified.map((a) => a.id)).toEqual(['q']);
    expect(almostThere.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(makingProgress.map((a) => a.id).sort()).toEqual(['p1', 'p2'].sort());
    expect(justStarting.map((a) => a.id)).toEqual(['s1']);
    // Hero = highest-percent in-contention
    expect(hero.id).toBe('a1');
  });

  it('returns hero=null when no in-contention awards exist', () => {
    const { hero } = groupByProgress([
      { id: 'q', eligible: true, inContention: false, progressPercent: 110 },
    ]);
    expect(hero).toBeNull();
  });
});
