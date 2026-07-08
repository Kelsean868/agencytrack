// @vitest-environment jsdom
//
// CommandPalette (Fable Tier 1 · 1.1) — role-scoped Cmd-K palette over the
// dashboard's own nav + create actions.
//
// Covers: dialog contract (role/aria-modal, input autofocus, Escape, focus
// return); command construction (Go-to from tabId nav, Actions from nav-action
// + quick-add, soon/COMING_SOON excluded, dup action keys de-duped); substring
// filter over label + section; arrow-key highlight + Enter run; click run for
// both groups; empty state.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CommandPalette from '../CommandPalette';

vi.mock('../../../config/comingSoonTabs', () => ({
  COMING_SOON_TABS: new Set(['prospect-info']),
}));

const Ico = () => null;

const NAV = [
  { id: 'dashboard',   label: 'Dashboard',     tabId: 'dashboard',              Icon: Ico, sectionLabel: 'Today' },
  { id: 'history',     label: 'History',       tabId: 'history',                Icon: Ico },
  { id: 'leaderboard', label: 'Leaderboard',   tabId: 'production-leaderboard', Icon: Ico, sectionLabel: 'Recognition' },
  { id: 'wizard',      label: 'Weekly Report', action: 'submit',               Icon: Ico },
  { id: 'planner',     label: 'Planner',       tabId: 'planner',               Icon: Ico, soon: true },      // excluded (soon)
  { id: 'prospect',    label: 'Prospect Prep', tabId: 'prospect-info',         Icon: Ico },                  // excluded (COMING_SOON)
];

const QA = [
  { key: 'log-today',     label: 'Log today',        Icon: Ico },
  { key: 'policy-ledger', label: 'Log a policy',     Icon: Ico },
  { key: 'submit',        label: 'Weekly report',    Icon: Ico },               // dup of nav action:submit → de-duped
  { key: 'planner',       label: 'Book appointment', Icon: Ico, soon: true },   // excluded (soon)
  { key: 'quick-add',     label: 'Quick add',        Icon: Ico },               // excluded (meta)
];

afterEach(() => cleanup());

function renderPalette(overrides = {}) {
  const props = {
    navItems: NAV,
    quickAddActions: QA,
    setActiveTab: vi.fn(),
    onAction: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

describe('CommandPalette — dialog contract', () => {
  it('renders a modal dialog with the search input focused on open', () => {
    renderPalette();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const input = screen.getByRole('combobox');
    expect(document.activeElement).toBe(input);
  });

  it('calls onClose on Escape', () => {
    const { onClose } = renderPalette();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the opener when it unmounts', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(
      <CommandPalette navItems={NAV} quickAddActions={QA} setActiveTab={vi.fn()} onAction={vi.fn()} onClose={vi.fn()} />
    );
    expect(document.activeElement).not.toBe(opener);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('CommandPalette — command construction', () => {
  it('lists tabId nav under Go to and excludes soon / coming-soon entries', () => {
    renderPalette();
    expect(screen.getByTestId('cmdk-option-nav:dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('cmdk-option-nav:history')).toBeInTheDocument();
    expect(screen.getByTestId('cmdk-option-nav:production-leaderboard')).toBeInTheDocument();
    // planner (soon) and prospect-info (COMING_SOON_TABS) must not appear.
    expect(screen.queryByTestId('cmdk-option-nav:planner')).toBeNull();
    expect(screen.queryByTestId('cmdk-option-nav:prospect-info')).toBeNull();
  });

  it('merges nav-action + quick-add into Actions, de-dupes shared keys, drops meta/soon', () => {
    renderPalette();
    // act:submit exists exactly once (nav "Weekly Report" wins over quick-add "Weekly report").
    const submitOpts = screen.getAllByTestId('cmdk-option-act:submit');
    expect(submitOpts).toHaveLength(1);
    expect(submitOpts[0]).toHaveTextContent('Weekly Report');
    expect(screen.getByTestId('cmdk-option-act:log-today')).toBeInTheDocument();
    expect(screen.getByTestId('cmdk-option-act:policy-ledger')).toBeInTheDocument();
    // quick-add meta + planner (soon) excluded.
    expect(screen.queryByTestId('cmdk-option-act:quick-add')).toBeNull();
    expect(screen.queryByTestId('cmdk-option-act:planner')).toBeNull();
  });
});

describe('CommandPalette — filter', () => {
  it('filters by case-insensitive substring over the label', () => {
    renderPalette();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'hist' } });
    expect(screen.getByTestId('cmdk-option-nav:history')).toBeInTheDocument();
    expect(screen.queryByTestId('cmdk-option-nav:dashboard')).toBeNull();
  });

  it('also matches on section label', () => {
    renderPalette();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'recognition' } });
    expect(screen.getByTestId('cmdk-option-nav:production-leaderboard')).toBeInTheDocument();
    expect(screen.queryByTestId('cmdk-option-nav:history')).toBeNull();
  });

  it('shows an empty state and Enter is a no-op when nothing matches', () => {
    const { onClose } = renderPalette();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzznope' } });
    expect(screen.getByTestId('cmdk-empty')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('CommandPalette — execution', () => {
  it('ArrowDown moves the highlight and Enter runs the highlighted command', () => {
    const { setActiveTab, onClose } = renderPalette();
    const input = screen.getByRole('combobox');
    // First option (Dashboard) is selected initially.
    expect(screen.getByTestId('cmdk-option-nav:dashboard')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // → History
    expect(screen.getByTestId('cmdk-option-nav:history')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(setActiveTab).toHaveBeenCalledWith('history');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking a Go-to option navigates via setActiveTab and closes', () => {
    const { setActiveTab, onAction, onClose } = renderPalette();
    fireEvent.click(screen.getByTestId('cmdk-option-nav:production-leaderboard'));
    expect(setActiveTab).toHaveBeenCalledWith('production-leaderboard');
    expect(onAction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking an Actions option fires the real handler via onAction and closes', () => {
    const { onAction, setActiveTab, onClose } = renderPalette();
    fireEvent.click(screen.getByTestId('cmdk-option-act:policy-ledger'));
    expect(onAction).toHaveBeenCalledWith('policy-ledger');
    expect(setActiveTab).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
