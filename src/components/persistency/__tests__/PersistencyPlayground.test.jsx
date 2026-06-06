import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import PersistencyPlayground from '../PersistencyPlayground';
import { projectPersistency } from '../../../lib/persistency/calculations';

// Real-world fixture: Ricardo Duke / Mikel Granderson branch Feb 2026 Tatil report.
const RICARDO_CURRENT = {
  grossSettled:   406335.53,
  netSettled:     300397.73,
  lapses:         133600.08,
  reinstatements:  27662.28,
  persistency:    0.7393,
};

function setSlider(testId, value) {
  fireEvent.change(screen.getByTestId(testId), { target: { value: String(value) } });
}

function getProjectedPct() {
  return screen.getByTestId('playground-projected-pct').textContent;
}

describe('PersistencyPlayground', () => {
  it('renders current state badge', () => {
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('persistency-playground')).toBeInTheDocument();
    expect(screen.getByTestId('playground-current-pct')).toBeInTheDocument();
  });

  // ── D2: only two levers present ──────────────────────────────────────────────
  it('renders exactly the two D2 lever sliders', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    expect(screen.getByTestId('playground-slider-newBusinessPlanned')).toBeInTheDocument();
    expect(screen.getByTestId('playground-slider-newReinstatementsPlanned')).toBeInTheDocument();
    // Removed levers must not be present
    expect(screen.queryByTestId('playground-slider-goodBusinessFallingOff')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playground-slider-newOrphansAdopted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playground-slider-newLapsesAnticipated')).not.toBeInTheDocument();
  });

  // ── == leg: projected % equals direct engine call ────────────────────────────
  it('newBusinessPlanned lever: displayed projection equals projectPersistency on same inputs', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    const NB = 150_000;
    setSlider('playground-slider-newBusinessPlanned', NB);

    const expected = projectPersistency({
      currentGrossSettled:      RICARDO_CURRENT.grossSettled,
      currentLapses:            RICARDO_CURRENT.lapses,
      currentReinstatements:    RICARDO_CURRENT.reinstatements,
      goodBusinessFallingOff:   0,
      newBusinessPlanned:       NB,
      newReinstatementsPlanned: 0,
      newOrphansAdopted:        0,
      newLapsesAnticipated:     0,
    });
    const expectedPct = `${(expected.projectedPersistency * 100).toFixed(1)}%`;
    expect(getProjectedPct()).toBe(expectedPct);
  });

  it('newReinstatementsPlanned lever: displayed projection equals projectPersistency on same inputs', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    const NR = 40_000;
    setSlider('playground-slider-newReinstatementsPlanned', NR);

    const expected = projectPersistency({
      currentGrossSettled:      RICARDO_CURRENT.grossSettled,
      currentLapses:            RICARDO_CURRENT.lapses,
      currentReinstatements:    RICARDO_CURRENT.reinstatements,
      goodBusinessFallingOff:   0,
      newBusinessPlanned:       0,
      newReinstatementsPlanned: NR,
      newOrphansAdopted:        0,
      newLapsesAnticipated:     0,
    });
    const expectedPct = `${(expected.projectedPersistency * 100).toFixed(1)}%`;
    expect(getProjectedPct()).toBe(expectedPct);
  });

  it('both levers combined: projected equals engine with both inputs', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    const NB = 200_000;
    const NR = 30_000;
    setSlider('playground-slider-newBusinessPlanned', NB);
    setSlider('playground-slider-newReinstatementsPlanned', NR);

    const expected = projectPersistency({
      currentGrossSettled:      RICARDO_CURRENT.grossSettled,
      currentLapses:            RICARDO_CURRENT.lapses,
      currentReinstatements:    RICARDO_CURRENT.reinstatements,
      goodBusinessFallingOff:   0,
      newBusinessPlanned:       NB,
      newReinstatementsPlanned: NR,
      newOrphansAdopted:        0,
      newLapsesAnticipated:     0,
    });
    const expectedPct = `${(expected.projectedPersistency * 100).toFixed(1)}%`;
    expect(getProjectedPct()).toBe(expectedPct);
  });

  // ── D3: reset affordance ─────────────────────────────────────────────────────
  it('reset button returns projected % to the at-zero-levers value', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    const baseline = getProjectedPct();
    setSlider('playground-slider-newBusinessPlanned', 300_000);
    expect(getProjectedPct()).not.toBe(baseline);

    fireEvent.click(screen.getByTestId('playground-reset-btn'));
    expect(getProjectedPct()).toBe(baseline);
  });

  // ── D5: shortfall cards ──────────────────────────────────────────────────────
  it('renders NB and NR shortfall cards (D5 ships)', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    expect(screen.getByTestId('playground-shortfall-card-nb')).toBeInTheDocument();
    expect(screen.getByTestId('playground-shortfall-card-nr')).toBeInTheDocument();
  });

  // ── D4: lapsed-policies link (self mode only) ────────────────────────────────
  it('renders lapsed link when mode=self and onViewLapsedPolicies is provided', () => {
    const spy = vi.fn();
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
        onViewLapsedPolicies={spy}
      />
    );
    expect(screen.getByTestId('playground-lapsed-link')).toBeInTheDocument();
    expect(screen.getByTestId('playground-view-lapsed-btn')).toBeInTheDocument();
  });

  it('lapsed link calls onViewLapsedPolicies (and onClose) on click', () => {
    const onClose = vi.fn();
    const onViewLapsedPolicies = vi.fn();
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={onClose}
        onViewLapsedPolicies={onViewLapsedPolicies}
      />
    );
    fireEvent.click(screen.getByTestId('playground-view-lapsed-btn'));
    expect(onClose).toHaveBeenCalled();
    expect(onViewLapsedPolicies).toHaveBeenCalled();
  });

  it('lapsed link absent in coaching mode', () => {
    render(
      <PersistencyPlayground
        mode="coaching"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
        onViewLapsedPolicies={() => {}}
      />
    );
    expect(screen.queryByTestId('playground-lapsed-link')).not.toBeInTheDocument();
  });

  it('lapsed link absent when onViewLapsedPolicies not provided (self mode)', () => {
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
      />
    );
    expect(screen.queryByTestId('playground-lapsed-link')).not.toBeInTheDocument();
  });

  // ── Zero-baseline arm (D1: no currentRecord) ─────────────────────────────────
  it('shows warning and uses zero baselines when no currentRecord provided', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={null} onClose={() => {}} />
    );
    expect(screen.getByText(/No persistency record yet/i)).toBeInTheDocument();
  });

  // ── onClose ──────────────────────────────────────────────────────────────────
  it('calls onClose when Close button clicked', () => {
    const onClose = vi.fn();
    render(
      <PersistencyPlayground
        mode="coaching"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByLabelText(/^Close$/));
    expect(onClose).toHaveBeenCalled();
  });
});
