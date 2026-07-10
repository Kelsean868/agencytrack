// @vitest-environment jsdom
//
// Sidebar — pin-star de-emphasis (Run3 F8).
// The pin/unpin star on a PINNED row renders one step smaller (14→12) and carries
// the `sidebar-nav-star-on` class (which the stylesheet maps to the muted ink
// token, dropping the brand-teal accent). Unpinned rows are unchanged: size 14,
// no `sidebar-nav-star-on` class. The star stays a real <button> (44px hit target
// in CSS) because it is also the interactive pin/unpin toggle.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import Sidebar from '../Sidebar';

const NAV = [
  { id: 'mp-report', label: 'Weekly Report', tabId: 'mp-report', Icon: Home, sectionLabel: 'My Production' },
  { id: 'leaderboard', label: 'Leaderboard', tabId: 'leaderboard', Icon: Home, sectionLabel: 'Recognition' },
];
const PINNED = [{ id: 'mp-report', label: 'Weekly Report', tabId: 'mp-report', Icon: Home }];

const baseProps = {
  navItems: NAV,
  activeTab: 'mp-report',
  setActiveTab: vi.fn(),
  onAction: vi.fn(),
  userProfile: { name: 'Agent', email: 'a@x.com' },
  roleLabel: 'Agent',
  onSignOut: vi.fn(),
  collapsed: false,
  toggleCollapse: vi.fn(),
  pinnedItems: PINNED,
  isPinned: (id) => id === 'mp-report',
  onPin: vi.fn(),
  onUnpin: vi.fn(),
};

const svgW = (btn) => btn.querySelector('svg')?.getAttribute('width');

describe('Sidebar — pin-star de-emphasis (Run3 F8)', () => {
  it('the pinned row star renders reduced (size 12 + on-class), unpinned star is unchanged (size 14, no on-class)', () => {
    render(<Sidebar {...baseProps} />);

    // Weekly Report is pinned → its star(s) read "Unpin Weekly Report". It renders
    // both in the ★ Pinned zone and in its group row; BOTH must be de-emphasized.
    const pinnedStars = screen.getAllByLabelText('Unpin Weekly Report');
    expect(pinnedStars.length).toBeGreaterThanOrEqual(2);
    for (const star of pinnedStars) {
      expect(star).toHaveClass('sidebar-nav-star-on');
      expect(svgW(star)).toBe('12');
    }

    // Leaderboard is NOT pinned → its star reads "Pin Leaderboard": full size, no on-class.
    const unpinnedStar = screen.getByLabelText('Pin Leaderboard');
    expect(unpinnedStar).not.toHaveClass('sidebar-nav-star-on');
    expect(svgW(unpinnedStar)).toBe('14');
  });

  it('the pinned star remains an operable pin/unpin <button> (hit target preserved in CSS)', () => {
    render(<Sidebar {...baseProps} />);
    const [pinnedStar] = screen.getAllByLabelText('Unpin Weekly Report');
    // Still the interactive toggle — a <button> carrying the star base class (the
    // 44px width/height that guarantees the touch target lives on this class in CSS).
    expect(pinnedStar.tagName).toBe('BUTTON');
    expect(pinnedStar).toHaveClass('sidebar-nav-star');
    expect(pinnedStar).toHaveAttribute('aria-pressed', 'true');
  });
});
