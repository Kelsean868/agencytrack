/**
 * MobileNavDrawer + MobileBottomNav — mobile nav drawer integration tests.
 *
 * Covers: drawer opens on More click, backdrop dismiss, Escape dismiss.
 * Focus trapping and Tab cycling are exercised by the shared useFocusTrap
 * hook (covered separately); here we only verify the integration points.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';

import MobileBottomNav from '../MobileBottomNav';
import MobileNavDrawer from '../MobileNavDrawer';

const MockIcon = () => <svg />;

const BOTTOM_ITEMS = [
  { id: 'overview', label: 'Dashboard', tabId: 'overview', Icon: MockIcon },
];

const DRAWER_ITEMS = [
  { id: 'reports',      label: 'Reports',      tabId: 'reports',      Icon: MockIcon },
  { id: 'persistency',  label: 'Persistency',  tabId: 'persistency',  Icon: MockIcon },
];

afterEach(() => {
  // useFocusTrap restores overflow on unmount; reset manually to be safe
  document.body.style.overflow = '';
});

// ── 1. More button opens the drawer ──────────────────────────────────────────

describe('MobileBottomNav — More button', () => {
  it('opens the drawer when More is clicked', () => {
    render(
      <MobileBottomNav
        items={BOTTOM_ITEMS}
        drawerNavItems={DRAWER_ITEMS}
        activeTab="overview"
        setActiveTab={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bottomnav-more'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('More options')).toBeInTheDocument();
  });
});

// ── 2. Backdrop click dismisses the drawer ────────────────────────────────────

describe('MobileNavDrawer — dismiss', () => {
  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <MobileNavDrawer
        items={DRAWER_ITEMS}
        activeTab="overview"
        setActiveTab={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByTestId('nav-drawer-backdrop'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── 3. Escape key dismisses the drawer ─────────────────────────────────────

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <MobileNavDrawer
        items={DRAWER_ITEMS}
        activeTab="overview"
        setActiveTab={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── 4. A drawer row routes to its tab (v2 nav reorder: Profile → More) ─────────
// Every role folds Profile into the More drawer as a { tabId: 'profile' } row.
// This proves such a row navigates to the Profile screen (setActiveTab('profile'))
// and dismisses the sheet — the contract the per-dashboard injections rely on.

describe('MobileNavDrawer — row navigation', () => {
  it('clicking a Profile row calls setActiveTab("profile") and closes the drawer', () => {
    const setActiveTab = vi.fn();
    const onClose = vi.fn();
    const PROFILE_ITEM = { id: 'profile', label: 'Profile', tabId: 'profile', Icon: MockIcon };
    render(
      <MobileNavDrawer
        items={[...DRAWER_ITEMS, PROFILE_ITEM]}
        activeTab="overview"
        setActiveTab={setActiveTab}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText('Profile'));

    expect(setActiveTab).toHaveBeenCalledWith('profile');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
