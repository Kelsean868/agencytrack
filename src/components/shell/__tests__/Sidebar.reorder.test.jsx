// @vitest-environment jsdom
//
// Sidebar drag-reorder interaction (Fable Tier 1 · 1.4). Exercises the pointer
// state machine at the jsdom level: pointer drag past the threshold fires
// onReorder with the new within-section order; a press without movement still
// navigates (setActiveTab); touch requires a long-press to arm (early scroll
// cancels), and an armed long-press then drags.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../WorkspaceToggle', () => ({ default: () => null }));

import Sidebar from '../Sidebar';

const NAV = [
  { id: 'a', label: 'A', tabId: 'a', sectionLabel: 'Sec', Icon: () => null },
  { id: 'b', label: 'B', tabId: 'b', Icon: () => null },
  { id: 'c', label: 'C', tabId: 'c', Icon: () => null },
];

// Assign deterministic geometry to the three rendered rows (40px bands) so the
// pointer-Y → insertion-index math is testable in jsdom (rects are 0 otherwise).
function stubRowRects(container) {
  const rows = container.querySelectorAll('.sidebar-link-row');
  const bands = [
    { top: 0, bottom: 40, height: 40 },
    { top: 40, bottom: 80, height: 40 },
    { top: 80, bottom: 120, height: 40 },
  ];
  rows.forEach((row, i) => {
    row.getBoundingClientRect = () => ({ ...bands[i], left: 0, right: 200, width: 200, x: 0, y: bands[i].top });
  });
  return rows;
}

function renderSidebar(extra = {}) {
  const setActiveTab = vi.fn();
  const onReorder = vi.fn();
  const utils = render(
    <Sidebar
      navItems={NAV}
      activeTab="a"
      setActiveTab={setActiveTab}
      onAction={vi.fn()}
      onReorder={onReorder}
      userProfile={{ name: 'X User' }}
      roleLabel="Agent"
      onSignOut={vi.fn()}
      collapsed={false}
      toggleCollapse={vi.fn()}
      {...extra}
    />
  );
  return { ...utils, setActiveTab, onReorder };
}

afterEach(() => cleanup());

describe('Sidebar drag-reorder — pointer (mouse)', () => {
  it('reorders within the section on a drag past the threshold', () => {
    const { container, onReorder } = renderSidebar();
    const rows = stubRowRects(container);
    const row0 = rows[0];
    // press on row A, drag down into row C's band, release.
    fireEvent.pointerDown(row0, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 5, clientY: 20 });
    fireEvent.pointerMove(row0, { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 110 });
    fireEvent.pointerUp(row0, { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 110 });
    // A moves to index 2 → [b, c, a]
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
  });

  it('a press without movement navigates (no reorder)', () => {
    const { container, getByTestId, setActiveTab, onReorder } = renderSidebar();
    const rows = stubRowRects(container);
    fireEvent.pointerDown(rows[1], { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 5, clientY: 60 });
    fireEvent.pointerUp(rows[1], { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 60 });
    // the following click (real browsers fire it after pointerup) still navigates
    fireEvent.click(getByTestId('nav-b'));
    expect(setActiveTab).toHaveBeenCalledWith('b');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('a completed drag suppresses the trailing click (no accidental nav)', () => {
    const { container, getByTestId, setActiveTab, onReorder } = renderSidebar();
    const rows = stubRowRects(container);
    fireEvent.pointerDown(rows[0], { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 5, clientY: 20 });
    fireEvent.pointerMove(rows[0], { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 110 });
    fireEvent.pointerUp(rows[0], { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 110 });
    fireEvent.click(getByTestId('nav-a')); // the drag's trailing click
    expect(onReorder).toHaveBeenCalled();
    expect(setActiveTab).not.toHaveBeenCalled();
  });
});

describe('Sidebar drag-reorder — touch long-press', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('an early scroll (pre-long-press) cancels — no drag', () => {
    const { container, onReorder } = renderSidebar();
    const rows = stubRowRects(container);
    fireEvent.pointerDown(rows[0], { pointerId: 2, pointerType: 'touch', clientX: 5, clientY: 20 });
    vi.advanceTimersByTime(200); // before the 450ms arm
    fireEvent.pointerMove(rows[0], { pointerId: 2, pointerType: 'touch', clientX: 5, clientY: 45 }); // >10px → scroll
    vi.advanceTimersByTime(400); // arm timer already cancelled
    fireEvent.pointerMove(rows[0], { pointerId: 2, pointerType: 'touch', clientX: 5, clientY: 110 });
    fireEvent.pointerUp(rows[0], { pointerId: 2, pointerType: 'touch', clientX: 5, clientY: 110 });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('a long-press arms drag, then a move reorders', () => {
    const { container, onReorder } = renderSidebar();
    const rows = stubRowRects(container);
    fireEvent.pointerDown(rows[0], { pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 20 });
    vi.advanceTimersByTime(450); // arm
    fireEvent.pointerMove(rows[0], { pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 110 });
    fireEvent.pointerUp(rows[0], { pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 110 });
    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
  });
});
