import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import PersistencyPlayground from '../PersistencyPlayground';

const RICARDO_CURRENT = {
  grossSettled: 406335.53,
  netSettled:   300397.73,
  lapses:        133600.08,
  reinstatements: 27662.28,
  persistency:   0.7393,
};

function setSlider(testId, value) {
  fireEvent.change(screen.getByTestId(testId), { target: { value: String(value) } });
}

describe('PersistencyPlayground', () => {
  it('renders current state from currentRecord', () => {
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('persistency-playground')).toBeInTheDocument();
    expect(screen.getByTestId('playground-current-state')).toBeInTheDocument();
  });

  it('renders the three shortfall cards (NB / NR / Orphans)', () => {
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('playground-shortfall-card-nb')).toBeInTheDocument();
    expect(screen.getByTestId('playground-shortfall-card-nr')).toBeInTheDocument();
    expect(screen.getByTestId('playground-shortfall-card-no')).toBeInTheDocument();
  });

  it('updates projected persistency when New Business slider changes', () => {
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
      />
    );

    const projectedBefore = screen.getByTestId('persistency-projected-output').textContent;

    // Inject 200,000 in new business — gross goes up, persistency improves.
    setSlider('playground-slider-newBusinessPlanned', 200000);

    const projectedAfter = screen.getByTestId('persistency-projected-output').textContent;
    expect(projectedAfter).not.toEqual(projectedBefore);
    // Persistency must have IMPROVED (text contains a higher %).
    const matchAfter = projectedAfter.match(/(\d+\.\d)%/);
    const matchBefore = projectedBefore.match(/(\d+\.\d)%/);
    expect(parseFloat(matchAfter[1])).toBeGreaterThan(parseFloat(matchBefore[1]));
  });

  it('shortfall card values reflect the target slider', () => {
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={RICARDO_CURRENT}
        onClose={() => {}}
      />
    );
    // Default target is 0.92. Set higher target → NB needed should increase.
    const nbBefore = screen.getByTestId('playground-shortfall-card-nb').textContent;
    setSlider('playground-target-slider', 0.99);
    const nbAfter  = screen.getByTestId('playground-shortfall-card-nb').textContent;
    expect(nbAfter).not.toEqual(nbBefore);
  });

  it('falls back to zero baselines when no currentRecord provided', () => {
    render(
      <PersistencyPlayground
        mode="self"
        agentName="Ricardo"
        currentRecord={null}
        onClose={() => {}}
      />
    );
    // No baseline → all shortfall calculations return 0.
    expect(screen.getByText(/No persistency record yet/i)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
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
