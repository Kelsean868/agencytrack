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
import { applyNavOrder } from '../navConfig';

const NAV = [
  { id: 'a', label: 'A', tabId: 'a', sectionLabel: 'Sec', Icon: () => null },
  { id: 'b', label: 'B', tabId: 'b', Icon: () => null },
  { id: 'c', label: 'C', tabId: 'c', Icon: () => null },
];

// Two-section fixture for cross-section clamp assertions: One=[a,b], Two=[c,d].
const NAV2 = [
  { id: 'a', label: 'A', tabId: 'a', sectionLabel: 'One', Icon: () => null },
  { id: 'b', label: 'B', tabId: 'b', Icon: () => null },
  { id: 'c', label: 'C', tabId: 'c', sectionLabel: 'Two', Icon: () => null },
  { id: 'd', label: 'D', tabId: 'd', Icon: () => null },
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

  // Regression (caught by the 1.4 live smoke): when a drag's pointer-up lands
  // over a DIFFERENT row than pointer-down, the browser fires NO trailing click
  // for that gesture — so the armed suppress flag must not linger and swallow
  // the user's NEXT legitimate click. The flag self-clears on a 0ms timeout.
  it('a later independent click still navigates after a drag with no trailing click', async () => {
    const { container, getByTestId, setActiveTab, onReorder } = renderSidebar();
    const rows = stubRowRects(container);
    fireEvent.pointerDown(rows[0], { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 5, clientY: 20 });
    fireEvent.pointerMove(rows[0], { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 110 });
    fireEvent.pointerUp(rows[0], { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 110 });
    expect(onReorder).toHaveBeenCalled();
    // No trailing click fired (up landed over a different row). Flush the 0ms
    // self-clear, then a fresh user click must navigate — this failed before
    // the fix (the stale flag ate the click).
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(getByTestId('nav-b'));
    expect(setActiveTab).toHaveBeenCalledWith('b');
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

// ── ★ Keyboard reorder (Fable VH · D2) ────────────────────────────────────────
// Alt+Arrow moves the focused row one slot within its section, committing through
// the SAME onReorder path (no geometry needed — keyboard uses index math). Plain
// arrows are left alone; edges clamp (no wrap, no cross-section); the live region
// announces every action; focus follows the moved row after the parent re-orders.
describe('Sidebar keyboard reorder — Alt+Arrow', () => {
  it('Alt+ArrowDown moves the focused row down one within its section (onReorder once, new ids)', () => {
    const { getByTestId, onReorder } = renderSidebar();
    fireEvent.keyDown(getByTestId('nav-a'), { key: 'ArrowDown', altKey: true });
    // A (idx0) → idx1 within [a,b,c] ⇒ [b,a,c]
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('Alt+ArrowUp moves the focused row up one within its section', () => {
    const { getByTestId, onReorder } = renderSidebar();
    fireEvent.keyDown(getByTestId('nav-c'), { key: 'ArrowUp', altKey: true });
    // C (idx2) → idx1 within [a,b,c] ⇒ [a,c,b]
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('clamps at the top edge — Alt+ArrowUp on the first row does not reorder', () => {
    const { getByTestId, onReorder } = renderSidebar();
    fireEvent.keyDown(getByTestId('nav-a'), { key: 'ArrowUp', altKey: true });
    expect(onReorder).not.toHaveBeenCalled();
    expect(getByTestId('nav-reorder-live').textContent).toBe('A is already first in Sec.');
  });

  it('clamps at the bottom edge — Alt+ArrowDown on the last row does not reorder', () => {
    const { getByTestId, onReorder } = renderSidebar();
    fireEvent.keyDown(getByTestId('nav-c'), { key: 'ArrowDown', altKey: true });
    expect(onReorder).not.toHaveBeenCalled();
    expect(getByTestId('nav-reorder-live').textContent).toBe('C is already last in Sec.');
  });

  it('never crosses sections — Alt+ArrowDown on the last row of a section clamps (no move into the next section)', () => {
    const setActiveTab = vi.fn();
    const onReorder = vi.fn();
    const { getByTestId } = render(
      <Sidebar
        navItems={NAV2}
        activeTab="a"
        setActiveTab={setActiveTab}
        onAction={vi.fn()}
        onReorder={onReorder}
        userProfile={{ name: 'X User' }}
        roleLabel="Agent"
        onSignOut={vi.fn()}
        collapsed={false}
        toggleCollapse={vi.fn()}
      />
    );
    // B is last in section One; Alt+ArrowDown must NOT pull it into section Two.
    fireEvent.keyDown(getByTestId('nav-b'), { key: 'ArrowDown', altKey: true });
    expect(onReorder).not.toHaveBeenCalled();
    expect(getByTestId('nav-reorder-live').textContent).toBe('B is already last in One.');
    // And a legal within-section move still works in the same fixture.
    fireEvent.keyDown(getByTestId('nav-a'), { key: 'ArrowDown', altKey: true });
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c', 'd']);
  });

  it('announces the committed move with position + section + saved confirmation', () => {
    const { getByTestId } = renderSidebar();
    fireEvent.keyDown(getByTestId('nav-a'), { key: 'ArrowDown', altKey: true });
    expect(getByTestId('nav-reorder-live').textContent).toBe('A moved to position 2 of 3 in Sec. Order saved.');
  });

  it('plain ArrowDown (no Alt) does not reorder', () => {
    const { getByTestId, onReorder } = renderSidebar();
    fireEvent.keyDown(getByTestId('nav-b'), { key: 'ArrowDown' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('Escape is a no-op (atomic-commit model has no pending state to cancel)', () => {
    const { getByTestId, onReorder } = renderSidebar();
    fireEvent.keyDown(getByTestId('nav-a'), { key: 'Escape' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('returns focus to the moved row after the parent applies the new order', () => {
    // Controlled harness: onReorder feeds applyNavOrder back into navItems, so the
    // reorder actually re-renders (mirrors useNavOrder → applyNavOrder in prod).
    function Harness() {
      const [order, setOrder] = React.useState([]);
      const items = applyNavOrder(NAV, order);
      return (
        <Sidebar
          navItems={items}
          activeTab="a"
          setActiveTab={() => {}}
          onAction={() => {}}
          onReorder={setOrder}
          userProfile={{ name: 'X User' }}
          roleLabel="Agent"
          onSignOut={() => {}}
          collapsed={false}
          toggleCollapse={() => {}}
        />
      );
    }
    const { getByTestId } = render(<Harness />);
    fireEvent.keyDown(getByTestId('nav-a'), { key: 'ArrowDown', altKey: true });
    // A committed to position 2; focus must land back on the (moved) A row button.
    expect(document.activeElement).toBe(getByTestId('nav-a'));
  });
});
