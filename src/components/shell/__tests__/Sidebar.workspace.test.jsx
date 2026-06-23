// @vitest-environment jsdom
//
// Sidebar — workspace/both layout rendering (Nav redesign PR-4).
// Covers: toggle renders only when showWorkspaceToggle; clicking fires
// onWorkspaceChange; pinned zone hidden for workspace (showPinnedZone=false);
// pinned zone renders ABOVE the toggle for both (decision #5).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  userProfile: { name: 'Mgr', email: 'm@x.com' },
  roleLabel: 'Branch Manager',
  onSignOut: vi.fn(),
  collapsed: false,
  toggleCollapse: vi.fn(),
  pinnedItems: PINNED,
  isPinned: () => true,
  onPin: vi.fn(),
  onUnpin: vi.fn(),
};

describe('Sidebar — workspace toggle', () => {
  it('does not render the toggle in the pinned layout (default)', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.queryByTestId('sidebar-ws-toggle-work')).not.toBeInTheDocument();
  });

  it('renders the toggle when showWorkspaceToggle is set', () => {
    render(<Sidebar {...baseProps} showWorkspaceToggle workspace="work" onWorkspaceChange={vi.fn()} showPinnedZone={false} />);
    expect(screen.getByTestId('sidebar-ws-toggle-work')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-ws-toggle-team')).toBeInTheDocument();
  });

  it('clicking My Team fires onWorkspaceChange("team")', () => {
    const onWorkspaceChange = vi.fn();
    render(<Sidebar {...baseProps} showWorkspaceToggle workspace="work" onWorkspaceChange={onWorkspaceChange} showPinnedZone={false} />);
    fireEvent.click(screen.getByTestId('sidebar-ws-toggle-team'));
    expect(onWorkspaceChange).toHaveBeenCalledWith('team');
  });

  it('aria-pressed reflects the active workspace', () => {
    render(<Sidebar {...baseProps} showWorkspaceToggle workspace="team" onWorkspaceChange={vi.fn()} showPinnedZone={false} />);
    expect(screen.getByTestId('sidebar-ws-toggle-team')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('sidebar-ws-toggle-work')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Sidebar — pinned zone × layout', () => {
  it('workspace layout hides the pinned zone (showPinnedZone=false)', () => {
    render(<Sidebar {...baseProps} showWorkspaceToggle workspace="work" onWorkspaceChange={vi.fn()} showPinnedZone={false} />);
    expect(screen.queryByText('★ Pinned')).not.toBeInTheDocument();
  });

  it('both layout renders the pinned zone ABOVE the toggle (decision #5)', () => {
    render(
      <Sidebar {...baseProps} showWorkspaceToggle workspace="work" onWorkspaceChange={vi.fn()} showPinnedZone />,
    );
    const pinnedHeader = screen.getByText('★ Pinned');
    const toggle = screen.getByTestId('sidebar-ws-toggle-work');
    // DOM order: ★ Pinned header precedes the toggle.
    expect(pinnedHeader.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('pinned layout (no toggle) still renders the pinned zone', () => {
    render(<Sidebar {...baseProps} />);
    expect(screen.getByText('★ Pinned')).toBeInTheDocument();
  });
});
