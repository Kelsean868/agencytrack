/**
 * SwipePager — structure, ARIA, keyboard, deep link and the pointer engine.
 * jsdom has no layout, so drags are simulated with fireEvent pointer events and a
 * controlled performance.now() clock (velocity depends on time).
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SwipePager from '../SwipePager';

const PAGES = [
  { id: 'today', label: 'Today', content: <p>Today content</p> },
  { id: 'week', label: 'Week', content: <p>Week content</p> },
  { id: 'goals', label: 'Goals', content: <button type="button">Goal card</button> },
];

function setup(props = {}) {
  const onPageChange = vi.fn();
  const utils = render(
    <SwipePager pages={PAGES} ariaLabel="Home pages" width={390} onPageChange={onPageChange} {...props} />,
  );
  return { ...utils, onPageChange };
}

const selected = () => screen.getAllByRole('tab').findIndex((t) => t.getAttribute('aria-selected') === 'true');

let clock = 0;
function mockClock() {
  clock = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
}

/** Drag on the viewport from (200,300) by (dx,dy) in `steps` moves, `msPerStep` apart. */
function drag(dx, dy, { steps = 10, msPerStep = 16 } = {}) {
  const vp = screen.getByTestId('swipe-pager-viewport');
  fireEvent.pointerDown(vp, { clientX: 200, clientY: 300, pointerId: 1, button: 0, pointerType: 'touch' });
  for (let s = 1; s <= steps; s += 1) {
    clock += msPerStep;
    fireEvent.pointerMove(vp, {
      clientX: 200 + (dx * s) / steps, clientY: 300 + (dy * s) / steps, pointerId: 1, pointerType: 'touch',
    });
  }
  clock += msPerStep;
  fireEvent.pointerUp(vp, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1, pointerType: 'touch' });
}

afterEach(() => { vi.restoreAllMocks(); });

describe('SwipePager structure', () => {
  it('renders a labelled tablist with tabs linked to panels', () => {
    setup();
    expect(screen.getByRole('tablist', { name: 'Home pages' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab, i) => {
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', tab.id);
      expect(tab).toHaveTextContent(PAGES[i].label);
    });
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
  });

  it('hides inactive panels from assistive tech and makes them inert', () => {
    setup();
    const panels = document.querySelectorAll('[role="tabpanel"]');
    expect(panels[0]).not.toHaveAttribute('aria-hidden');
    expect(panels[1]).toHaveAttribute('aria-hidden', 'true');
    expect(panels[2]).toHaveAttribute('aria-hidden', 'true');
    expect(panels[1]).toHaveAttribute('inert');
    expect(panels[0]).not.toHaveAttribute('inert');
  });

  it('sizes the track and pages from width and translates to the active page', () => {
    setup({ initialPageId: 'week' });
    const track = screen.getByTestId('swipe-pager-track');
    expect(track.style.width).toBe('1170px');
    expect(track.style.transform).toBe('translateX(-390px)');
    expect(track).toHaveClass('fr-track');
    expect(track).toHaveAttribute('data-dragging', 'false');
    document.querySelectorAll('[role="tabpanel"]').forEach((p) => expect(p.style.width).toBe('390px'));
  });

  it('respects initialPageId', () => {
    setup({ initialPageId: 'goals' });
    expect(selected()).toBe(2);
  });
});

describe('SwipePager chips and keyboard', () => {
  it('clicking a chip selects it and fires onPageChange', () => {
    const { onPageChange } = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Goals' }));
    expect(selected()).toBe(2);
    expect(onPageChange).toHaveBeenCalledWith('goals');
    expect(screen.getByTestId('swipe-pager-track').style.transform).toBe('translateX(-780px)');
  });

  it('ArrowRight / ArrowLeft / End / Home on the tablist move pages', () => {
    const { onPageChange } = setup();
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selected()).toBe(1);
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Week' }));
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selected()).toBe(0);
    fireEvent.keyDown(list, { key: 'End' });
    expect(selected()).toBe(2);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(selected()).toBe(0);
    expect(onPageChange.mock.calls.map((c) => c[0])).toEqual(['week', 'today', 'goals', 'today']);
  });

  it('does not move past the ends with the keyboard', () => {
    const { onPageChange } = setup();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(selected()).toBe(0);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('shows the swipe hint until the first page change', () => {
    setup();
    expect(screen.getByText('Swipe for more')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(screen.queryByText('Swipe for more')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Today' }));
    expect(screen.queryByText('Swipe for more')).not.toBeInTheDocument();
  });
});

describe('SwipePager pointer engine', () => {
  it('a -220px drag moves to the next page', () => {
    mockClock();
    const { onPageChange } = setup();
    drag(-220, 0, { steps: 10, msPerStep: 40 });
    expect(selected()).toBe(1);
    expect(onPageChange).toHaveBeenCalledWith('week');
    expect(screen.getByTestId('swipe-pager-track')).toHaveAttribute('data-dragging', 'false');
  });

  it('a slow -60px drag stays on the page', () => {
    mockClock();
    const { onPageChange } = setup();
    drag(-60, 0, { steps: 10, msPerStep: 80 });
    expect(selected()).toBe(0);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('a fast -60px flick moves one page', () => {
    mockClock();
    setup();
    drag(-60, 0, { steps: 4, msPerStep: 10 }); // 1500 px/s
    expect(selected()).toBe(1);
  });

  it('a vertical drag does not change page', () => {
    mockClock();
    const { onPageChange } = setup();
    drag(5, 200);
    expect(selected()).toBe(0);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('marks the track as dragging and rubber-bands past the first page', () => {
    mockClock();
    setup();
    const vp = screen.getByTestId('swipe-pager-viewport');
    fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' });
    clock += 16;
    fireEvent.pointerMove(vp, { clientX: 200, clientY: 100, pointerId: 1, pointerType: 'touch' });
    const track = screen.getByTestId('swipe-pager-track');
    expect(track).toHaveAttribute('data-dragging', 'true');
    const tx = parseFloat(track.style.transform.replace('translateX(', ''));
    expect(tx).toBeGreaterThan(0);
    expect(tx).toBeLessThan(100);
    clock += 200;
    fireEvent.pointerUp(vp, { clientX: 200, clientY: 100, pointerId: 1, pointerType: 'touch' });
    expect(selected()).toBe(0);
  });

  it('suppresses the click that follows a horizontal drag', () => {
    mockClock();
    const onCardClick = vi.fn();
    render(
      <SwipePager
        ariaLabel="Home pages"
        width={390}
        pages={[
          { id: 'a', label: 'A', content: <button type="button" onClick={onCardClick}>Card A</button> },
          ...PAGES.slice(1),
        ]}
      />,
    );
    drag(-60, 0, { steps: 10, msPerStep: 80 });
    fireEvent.click(screen.getByRole('button', { name: 'Card A' }));
    expect(onCardClick).not.toHaveBeenCalled();
    // A plain tap afterwards still works.
    fireEvent.click(screen.getByRole('button', { name: 'Card A' }));
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });
});
