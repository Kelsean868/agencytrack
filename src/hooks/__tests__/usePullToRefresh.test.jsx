/**
 * usePullToRefresh — threshold + arming-guard unit tests.
 *
 * Pins the PTR over-trigger fix (mobile-nav PTR brief, re-scoped 2026-07-05):
 *   - PULL_THRESHOLD raised 72 → 110: a 100px pull (which fired under the old
 *     72px threshold) must NOT trigger; a ≥110px pull still must.
 *   - Arming guard: a touch that STARTS while the container is scrolled
 *     (scrollTop > 0) never arms PTR — momentum-settled scrolls can't refresh.
 *   - Mid-move disarm: leaving the top mid-gesture cancels the pull.
 */
import React, { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll } from 'vitest';

import { usePullToRefresh } from '../usePullToRefresh';

function Harness({ onRefresh }) {
  const ref = useRef(null);
  const state = usePullToRefresh(ref, onRefresh);
  return (
    <div ref={ref} data-testid="scroller" style={{ overflowY: 'auto' }}>
      <span data-testid="ptr-state">{state}</span>
    </div>
  );
}

beforeAll(() => {
  // The hook attaches only when 'ontouchstart' in window — jsdom has no touch
  // support by default, so declare the property (matches touch devices).
  window.ontouchstart = () => {};
});

const touches = (y) => ({ touches: [{ clientY: y }] });

function pull(el, fromY, toY) {
  fireEvent.touchStart(el, touches(fromY));
  // two intermediate moves — mirrors a real drag, exercises repeated onTouchMove
  fireEvent.touchMove(el, touches(fromY + Math.round((toY - fromY) / 2)));
  fireEvent.touchMove(el, touches(toY));
  fireEvent.touchEnd(el);
}

describe('usePullToRefresh — threshold (72 → 110 regression pins)', () => {
  it('does NOT fire onRefresh for a 100px pull (fired under the old 72px threshold)', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    pull(el, 100, 200); // delta 100 < 110

    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('ptr-state').textContent).toBe('idle');
  });

  it('fires onRefresh exactly once for a deliberate ≥110px pull from the top', async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    pull(el, 100, 215); // delta 115 ≥ 110

    expect(onRefresh).toHaveBeenCalledTimes(1);
    // refresh resolves → phase returns to idle
    await waitFor(() =>
      expect(screen.getByTestId('ptr-state').textContent).toBe('idle')
    );
  });

  it('fires at exactly the 110px boundary (>= semantics)', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    pull(el, 100, 210); // delta exactly 110 — the hook uses >=

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows the pulling phase only once the 110px threshold is crossed', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    fireEvent.touchStart(el, touches(100));
    fireEvent.touchMove(el, touches(200)); // delta 100 — below threshold
    expect(screen.getByTestId('ptr-state').textContent).toBe('idle');
    fireEvent.touchMove(el, touches(215)); // delta 115 — crossed
    expect(screen.getByTestId('ptr-state').textContent).toBe('pulling');
    fireEvent.touchEnd(el);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('usePullToRefresh — arming guards', () => {
  it('never arms when the touch STARTS while scrolled (scrollTop > 0)', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    el.scrollTop = 50; // mid-list — e.g. a momentum scroll that has not settled at top
    pull(el, 100, 300); // huge 200px drag — must still not fire

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('disarms when the container leaves the top mid-gesture — even past threshold', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    fireEvent.touchStart(el, touches(100));
    fireEvent.touchMove(el, touches(215)); // delta 115 ≥ 110 — armed and pulling
    expect(screen.getByTestId('ptr-state').textContent).toBe('pulling');

    el.scrollTop = 30; // container scrolled away mid-move
    fireEvent.touchMove(el, touches(300)); // disarm — retained pullDelta must not fire
    fireEvent.touchEnd(el);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('ptr-state').textContent).toBe('idle');
  });

  it('does not fire when the user pulls past threshold then pushes back up to cancel', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    fireEvent.touchStart(el, touches(100));
    fireEvent.touchMove(el, touches(215)); // delta 115 ≥ 110 — pulling
    expect(screen.getByTestId('ptr-state').textContent).toBe('pulling');

    fireEvent.touchMove(el, touches(90)); // delta -10 ≤ 0 — cancelled
    fireEvent.touchEnd(el);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('ptr-state').textContent).toBe('idle');
  });

  it('does not fire for an upward swipe (normal scroll-down gesture)', () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    render(<Harness onRefresh={onRefresh} />);
    const el = screen.getByTestId('scroller');

    fireEvent.touchStart(el, touches(400));
    fireEvent.touchMove(el, touches(250)); // finger moves UP — scrolling down
    fireEvent.touchEnd(el);

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
