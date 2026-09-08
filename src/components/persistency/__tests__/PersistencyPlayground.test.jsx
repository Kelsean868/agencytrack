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

  // ── D2 + P4: the D2 pair plus goodBusinessFallingOff (unconditional, P4) ─────
  it('renders the D2 pair plus goodBusinessFallingOff; orphans/lapses levers still absent', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    expect(screen.getByTestId('playground-slider-newBusinessPlanned')).toBeInTheDocument();
    expect(screen.getByTestId('playground-slider-newReinstatementsPlanned')).toBeInTheDocument();
    // P4: goodBusinessFallingOff shows on both models — RICARDO_CURRENT has no
    // monthKey, so this also proves it does not depend on a model being resolved.
    expect(screen.getByTestId('playground-slider-goodBusinessFallingOff')).toBeInTheDocument();
    // decreasesAnticipated is model-gated — no monthKey means no model, so hidden.
    expect(screen.queryByTestId('playground-slider-decreasesAnticipated')).not.toBeInTheDocument();
    // Still out of scope — never became real levers
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

// ── P4: 24-month model levers + header model line ────────────────────────────

describe('PersistencyPlayground — P4 24-month model levers', () => {
  const SEPT_RECORD = { ...RICARDO_CURRENT, monthKey: '2026-09' }; // 24-month model
  const AUG_RECORD  = { ...RICARDO_CURRENT, monthKey: '2026-08' }; // legacy model

  it('shows the decreases lever and the "24-month model" header line on a September 2026 record', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={SEPT_RECORD} onClose={() => {}} />
    );
    expect(screen.getByTestId('playground-slider-decreasesAnticipated')).toBeInTheDocument();
    expect(screen.getByTestId('playground-slider-goodBusinessFallingOff')).toBeInTheDocument();
    expect(screen.getByTestId('playground-model-line')).toHaveTextContent('24-month model');
    expect(screen.getByTestId('playground-model-line')).toHaveTextContent('September 2026 onwards');
  });

  it('hides the decreases lever and shows the "12-month model" header line on an August 2026 record', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={AUG_RECORD} onClose={() => {}} />
    );
    expect(screen.queryByTestId('playground-slider-decreasesAnticipated')).not.toBeInTheDocument();
    // goodBusinessFallingOff is unconditional — present on the legacy model too.
    expect(screen.getByTestId('playground-slider-goodBusinessFallingOff')).toBeInTheDocument();
    expect(screen.getByTestId('playground-model-line')).toHaveTextContent('12-month model');
    expect(screen.getByTestId('playground-model-line')).toHaveTextContent('through August 2026');
  });

  it('never crashes on a malformed monthKey — hides the decreases lever and shows no model line', () => {
    const badRecord = { ...RICARDO_CURRENT, monthKey: 'not-a-month' };
    expect(() => render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={badRecord} onClose={() => {}} />
    )).not.toThrow();
    expect(screen.queryByTestId('playground-slider-decreasesAnticipated')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playground-model-line')).not.toBeInTheDocument();
    // The rest of the modal still renders normally.
    expect(screen.getByTestId('persistency-playground')).toBeInTheDocument();
  });

  it('shows no model line when there is no currentRecord at all (D1 zero-baseline arm)', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={null} onClose={() => {}} />
    );
    expect(screen.queryByTestId('playground-model-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playground-slider-decreasesAnticipated')).not.toBeInTheDocument();
  });

  it('decreasesAnticipated lever: displayed projection equals projectPersistency on the same inputs', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={SEPT_RECORD} onClose={() => {}} />
    );
    const DA = 60_000;
    setSlider('playground-slider-decreasesAnticipated', DA);

    const expected = projectPersistency({
      currentGrossSettled:      RICARDO_CURRENT.grossSettled,
      currentLapses:            RICARDO_CURRENT.lapses,
      currentReinstatements:    RICARDO_CURRENT.reinstatements,
      goodBusinessFallingOff:   0,
      newBusinessPlanned:       0,
      newReinstatementsPlanned: 0,
      newOrphansAdopted:        0,
      newLapsesAnticipated:     0,
      decreasesAnticipated:     DA,
    });
    const expectedPct = `${(expected.projectedPersistency * 100).toFixed(1)}%`;
    expect(getProjectedPct()).toBe(expectedPct);
  });

  it('goodBusinessFallingOff lever: displayed projection equals projectPersistency on the same inputs', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={SEPT_RECORD} onClose={() => {}} />
    );
    const GBF = 40_000;
    setSlider('playground-slider-goodBusinessFallingOff', GBF);

    const expected = projectPersistency({
      currentGrossSettled:      RICARDO_CURRENT.grossSettled,
      currentLapses:            RICARDO_CURRENT.lapses,
      currentReinstatements:    RICARDO_CURRENT.reinstatements,
      goodBusinessFallingOff:   GBF,
      newBusinessPlanned:       0,
      newReinstatementsPlanned: 0,
      newOrphansAdopted:        0,
      newLapsesAnticipated:     0,
      decreasesAnticipated:     0,
    });
    const expectedPct = `${(expected.projectedPersistency * 100).toFixed(1)}%`;
    expect(getProjectedPct()).toBe(expectedPct);
  });

  it('reset returns decreasesAnticipated and goodBusinessFallingOff to zero along with the D2 pair', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={SEPT_RECORD} onClose={() => {}} />
    );
    const baseline = getProjectedPct();
    setSlider('playground-slider-decreasesAnticipated', 75_000);
    setSlider('playground-slider-goodBusinessFallingOff', 30_000);
    expect(getProjectedPct()).not.toBe(baseline);

    fireEvent.click(screen.getByTestId('playground-reset-btn'));
    expect(getProjectedPct()).toBe(baseline);
  });
});

// ── P4b: guard the negative projected denominator, never clamp at 100% ──────

describe('PersistencyPlayground — P4b negative-denominator guard', () => {
  // A round fixture so the unconditional goodBusinessFallingOff lever can be
  // dragged to exact +1 / 0 / -1 projectedGrossSettled boundaries without
  // fighting RICARDO_CURRENT's fractional cents.
  const ROUND_RECORD = {
    grossSettled: 100000,
    lapses: 20000,
    reinstatements: 5000,
    persistency: 0.85,
  };

  it('projectedGross = +1: shows a real number, no danger message', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={ROUND_RECORD} onClose={() => {}} />
    );
    setSlider('playground-slider-goodBusinessFallingOff', 99_999);
    expect(getProjectedPct()).not.toBe('—');
    expect(screen.queryByTestId('playground-negative-denominator-warning')).not.toBeInTheDocument();
  });

  it('projectedGross = 0: suppresses the number, shows the danger message', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={ROUND_RECORD} onClose={() => {}} />
    );
    setSlider('playground-slider-goodBusinessFallingOff', 100_000);
    expect(getProjectedPct()).toBe('—');
    expect(screen.getByTestId('playground-negative-denominator-warning')).toBeInTheDocument();
  });

  it('projectedGross = -1: suppresses the number even though the raw ratio looks like a plausible positive percentage', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={ROUND_RECORD} onClose={() => {}} />
    );
    setSlider('playground-slider-goodBusinessFallingOff', 100_001);
    // Un-guarded: projectedNet(-15,001) / projectedGross(-1) = 15,001 — a
    // negative-over-negative ratio that renders as a healthy-looking number.
    // The guard (projectedGross <= 0) must suppress it regardless of sign.
    expect(getProjectedPct()).toBe('—');
    expect(screen.getByTestId('playground-negative-denominator-warning')).toBeInTheDocument();
  });

  it('never clamps at 100% — a real orphan-reinstatement scenario renders above 100%, un-suppressed (Candice, §2 of the P4b brief)', () => {
    // Candice writes 100,000 of her own business, no lapses. She adopts a
    // lapsed orphan policy and reinstates it: 10,000 lands in net only (it was
    // never in gross, because she did not write it). 110,000 / 100,000 = 110%
    // — legitimately above 100%, and the guard (projectedGross <= 0) must not
    // touch it, because projectedGross here is a healthy 100,000.
    const CANDICE = { grossSettled: 100000, lapses: 0, reinstatements: 0, persistency: 1 };
    render(
      <PersistencyPlayground mode="self" agentName="Candice" currentRecord={CANDICE} onClose={() => {}} />
    );
    setSlider('playground-slider-newReinstatementsPlanned', 10_000);

    const expected = projectPersistency({
      currentGrossSettled: CANDICE.grossSettled,
      currentLapses: CANDICE.lapses,
      currentReinstatements: CANDICE.reinstatements,
      goodBusinessFallingOff: 0,
      newBusinessPlanned: 0,
      newReinstatementsPlanned: 10_000,
      newOrphansAdopted: 0,
      newLapsesAnticipated: 0,
      decreasesAnticipated: 0,
    });
    expect(expected.projectedGrossSettled).toBe(100000);
    expect(expected.projectedPersistency).toBe(1.1); // 110,000 / 100,000

    expect(getProjectedPct()).toBe('110.0%');
    expect(screen.queryByTestId('playground-negative-denominator-warning')).not.toBeInTheDocument();
  });
});

// ── P4c: "no data yet" vs "this plan is impossible" ──────────────────────────

describe('PersistencyPlayground — P4c empty record vs impossible plan', () => {
  // A record with settled business, distinct from the EMPTY fixture below, so
  // the "impossible plan" and "normal" states are reachable from the same
  // starting point the "nothing to plan from" state is not.
  const REAL_RECORD = { grossSettled: 500000, lapses: 20000, reinstatements: 5000, persistency: 0.97 };
  const EMPTY_RECORD = { grossSettled: 0, lapses: 0, reinstatements: 0, persistency: 0 };

  // Deliverable 1, row 1: grossSettled = 0, no levers touched.
  it('grossSettled = 0, no levers touched: neutral line, no danger warning, no percentage, no shortfall cards', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={EMPTY_RECORD} onClose={() => {}} />
    );
    expect(getProjectedPct()).toBe('—');
    expect(screen.getByTestId('playground-nothing-to-plan-warning')).toBeInTheDocument();
    expect(screen.queryByTestId('playground-negative-denominator-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playground-shortfall-card-nb')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playground-shortfall-card-nr')).not.toBeInTheDocument();
  });

  // Deliverable 1, row 2: grossSettled = 500,000, levers drive it below zero.
  it('grossSettled = 500,000 with levers driving it below zero: the P4b danger message, never the neutral line', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={REAL_RECORD} onClose={() => {}} />
    );
    setSlider('playground-slider-goodBusinessFallingOff', 500_000);
    expect(getProjectedPct()).toBe('—');
    expect(screen.getByTestId('playground-negative-denominator-warning')).toBeInTheDocument();
    expect(screen.queryByTestId('playground-nothing-to-plan-warning')).not.toBeInTheDocument();
  });

  // Deliverable 1, row 3: grossSettled = 500,000, untouched.
  it('grossSettled = 500,000 untouched: normal projection, neither warning, shortfall cards present', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={REAL_RECORD} onClose={() => {}} />
    );
    expect(getProjectedPct()).not.toBe('—');
    expect(screen.queryByTestId('playground-nothing-to-plan-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playground-negative-denominator-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('playground-shortfall-card-nb')).toBeInTheDocument();
    expect(screen.getByTestId('playground-shortfall-card-nr')).toBeInTheDocument();
  });

  // Deliverable 3: the shortfall-card text in the impossible-plan state.
  it('impossible-plan shortfall cards read "—", never "Already at or above target"', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={REAL_RECORD} onClose={() => {}} />
    );
    setSlider('playground-slider-goodBusinessFallingOff', 500_000);
    const nb = screen.getByTestId('playground-shortfall-card-nb');
    const nr = screen.getByTestId('playground-shortfall-card-nr');
    expect(nb).toHaveTextContent('—');
    expect(nr).toHaveTextContent('—');
    expect(nb).not.toHaveTextContent('Already at or above target');
    expect(nr).not.toHaveTextContent('Already at or above target');
  });

  it('a record with no currentRecord at all (D1 zero-baseline arm) is the same "nothing to plan from" state', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={null} onClose={() => {}} />
    );
    expect(getProjectedPct()).toBe('—');
    expect(screen.getByTestId('playground-nothing-to-plan-warning')).toBeInTheDocument();
    expect(screen.queryByTestId('playground-shortfall-card-nb')).not.toBeInTheDocument();
  });
});

// ── Dialog a11y contract (§4 dialog sweep) ───────────────────────────────────

describe('PersistencyPlayground — dialog a11y', () => {
  it('exposes role=dialog + aria-modal=true + aria-label', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Persistency Playground');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll(
        'button:not([disabled]):not([aria-hidden="true"]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('restores focus to the invoking element when the playground unmounts', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('header Close button and footer CTAs meet the 44px touch-target floor', () => {
    render(
      <PersistencyPlayground mode="self" agentName="Ricardo" currentRecord={RICARDO_CURRENT} onClose={() => {}} />
    );
    expect(screen.getByLabelText(/^Close$/).className).toMatch(/\bh-11\b/);
    expect(screen.getByTestId('playground-reset-btn').className).toMatch(/\bh-11\b/);
  });
});
