// @vitest-environment jsdom
//
// Sidebar — pin-star de-emphasis v2 (Run4 polish — operator-locked, supersedes
// Run3 F8's size/contrast reduction).
//
// New rule: the pin/unpin star renders FILLED (`sidebar-nav-star-filled`,
// brand-teal) ONLY when the row sits in the ★ Pinned zone itself. Everywhere
// else the tab's pin affordance appears (its home/group section), the star
// stays OUTLINE regardless of whether the item is currently pinned — position
// (which zone) + fill-vs-outline carry the "this is pinned" signal now, not
// size or muted color (F8's size-12/muted-color treatment is removed). Size is
// uniform (14) in both zones. Opacity (`sidebar-nav-star-pinned`, always-visible
// vs reveal-on-hover) still tracks pinned STATE independently of the zone-driven
// fill — a pinned item's home-row star stays glanceable without hovering, just
// outlined instead of filled. The star stays a real <button> (44px hit target in
// CSS) because it is also the interactive pin/unpin toggle.

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

describe('Sidebar — pin-star de-emphasis v2 (Run4 polish)', () => {
  it('the ★ Pinned-zone star renders FILLED (brand-teal); the SAME item\'s home-row star renders OUTLINE', () => {
    render(<Sidebar {...baseProps} />);

    // Weekly Report is pinned → it renders in BOTH the ★ Pinned zone (canonical
    // testid `pinned-mp-report`) and its home section (canonical testid `nav-mp-report`).
    const stars = screen.getAllByLabelText('Unpin Weekly Report');
    expect(stars.length).toBe(2);

    const pinnedZoneRow = document.querySelector('[data-testid="pinned-mp-report"]').closest('.sidebar-link-row');
    const homeRow = document.querySelector('[data-testid="nav-mp-report"]').closest('.sidebar-link-row');
    const pinnedZoneStar = pinnedZoneRow.querySelector('.sidebar-nav-star');
    const homeStar = homeRow.querySelector('.sidebar-nav-star');

    // ★ Pinned zone: filled + carries the "pinned" opacity class too.
    expect(pinnedZoneStar).toHaveClass('sidebar-nav-star-filled');
    expect(pinnedZoneStar).toHaveClass('sidebar-nav-star-pinned');
    expect(svgW(pinnedZoneStar)).toBe('14');

    // Home section: NEVER filled, even though this item IS pinned — only the
    // opacity/always-visible class applies, position gates the fill.
    expect(homeStar).not.toHaveClass('sidebar-nav-star-filled');
    expect(homeStar).toHaveClass('sidebar-nav-star-pinned');
    expect(svgW(homeStar)).toBe('14');
  });

  it('an UNPINNED tab renders outline in its home section (unchanged) and never appears in the ★ Pinned zone', () => {
    render(<Sidebar {...baseProps} />);

    expect(screen.queryByTestId('pinned-leaderboard')).not.toBeInTheDocument();
    const unpinnedStar = screen.getByLabelText('Pin Leaderboard');
    expect(unpinnedStar).not.toHaveClass('sidebar-nav-star-filled');
    expect(unpinnedStar).not.toHaveClass('sidebar-nav-star-pinned');
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
