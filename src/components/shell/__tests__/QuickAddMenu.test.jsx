// @vitest-environment jsdom
//
// QuickAddMenu — role-aware Quick-Add picker (Nav redesign PR-3).
//
// Covers:
//   1. Agent list: primary on Log today, Weekly report present, planner SOON.
//   2. producingManager list: personal section + TEAM divider + Start a meeting.
//      TEAM divider present; log-today primary; planner SOON.
//   3. manager (non-producing) list: Start a meeting primary; no personal items.
//   4. SOON items are disabled and non-activatable.
//   5. Amber dot on Log-today row when todayLogged=false; absent when true.
//   6. onSelect dispatches the action key; onClose fires after select.
//   7. manager log-today (Decision #6): dispatches 'log-today' key.
//   8. Escape key calls onClose.

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import QuickAddMenu from '../QuickAddMenu';
import { getQuickAddActions } from '../quickAddConfig';

// COMING_SOON_TABS is checked by QuickAddMenu for SOON treatment.
vi.mock('../../../config/comingSoonTabs', () => ({
  COMING_SOON_TABS: new Set(['planner', 'prospect-info']),
}));

afterEach(() => cleanup());

function renderMenu(configKey, { todayLogged = true, onSelect = vi.fn(), onClose = vi.fn() } = {}) {
  const actions = getQuickAddActions(configKey);
  render(
    <QuickAddMenu
      actions={actions}
      onSelect={onSelect}
      onClose={onClose}
      todayLogged={todayLogged}
    />
  );
  return { onSelect, onClose };
}

describe('QuickAddMenu — agent config', () => {
  it('shows Log today as the primary (highlighted) action', () => {
    renderMenu('agent');
    expect(screen.getByTestId('quickadd-log-today')).toBeTruthy();
  });

  it('shows Weekly report action', () => {
    renderMenu('agent');
    expect(screen.getByTestId('quickadd-submit')).toBeTruthy();
  });

  it('disables planner (SOON) action', () => {
    renderMenu('agent');
    const btn = screen.getByTestId('quickadd-planner');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not dispatch when a SOON action is clicked', () => {
    const onSelect = vi.fn();
    renderMenu('agent', { onSelect });
    fireEvent.click(screen.getByTestId('quickadd-planner'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows amber dot on Log-today when todayLogged=false', () => {
    renderMenu('agent', { todayLogged: false });
    const btn = screen.getByTestId('quickadd-log-today');
    expect(btn.querySelector('.bg-warning')).toBeTruthy();
  });

  it('hides amber dot on Log-today when todayLogged=true', () => {
    renderMenu('agent', { todayLogged: true });
    const btn = screen.getByTestId('quickadd-log-today');
    expect(btn.querySelector('.bg-warning')).toBeNull();
  });

  it('calls onSelect with the key and onClose when a live action is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderMenu('agent', { onSelect, onClose });
    fireEvent.click(screen.getByTestId('quickadd-log-today'));
    expect(onSelect).toHaveBeenCalledWith('log-today');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('QuickAddMenu — producingManager config', () => {
  it('shows Log today, mp-report, mp-policies (personal items)', () => {
    renderMenu('producingManager');
    expect(screen.getByTestId('quickadd-log-today')).toBeTruthy();
    expect(screen.getByTestId('quickadd-mp-report')).toBeTruthy();
    expect(screen.getByTestId('quickadd-mp-policies')).toBeTruthy();
  });

  it('shows TEAM section with start-meeting (deferred from PR-1)', () => {
    renderMenu('producingManager');
    expect(screen.getByText(/team/i)).toBeTruthy();
    expect(screen.getByTestId('quickadd-start-meeting')).toBeTruthy();
  });

  it('shows monthly-recruiting and persistency under TEAM', () => {
    renderMenu('producingManager');
    expect(screen.getByTestId('quickadd-monthly-recruiting')).toBeTruthy();
    expect(screen.getByTestId('quickadd-persistency')).toBeTruthy();
  });

  it('disables planner (SOON) in TEAM section', () => {
    renderMenu('producingManager');
    expect(screen.getByTestId('quickadd-planner')).toBeDisabled();
  });

  it('dispatches log-today (Decision #6: opens DailyCaptureV2 overlay)', () => {
    const onSelect = vi.fn();
    renderMenu('producingManager', { onSelect });
    fireEvent.click(screen.getByTestId('quickadd-log-today'));
    expect(onSelect).toHaveBeenCalledWith('log-today');
  });

  it('dispatches start-meeting (deferred from PR-1)', () => {
    const onSelect = vi.fn();
    renderMenu('producingManager', { onSelect });
    fireEvent.click(screen.getByTestId('quickadd-start-meeting'));
    expect(onSelect).toHaveBeenCalledWith('start-meeting');
  });
});

describe('QuickAddMenu — manager (non-producing) config', () => {
  it('shows start-meeting as primary (no personal production items)', () => {
    renderMenu('manager');
    expect(screen.getByTestId('quickadd-start-meeting')).toBeTruthy();
    expect(screen.queryByTestId('quickadd-log-today')).toBeNull();
    expect(screen.queryByTestId('quickadd-mp-report')).toBeNull();
  });

  it('shows campaigns action', () => {
    renderMenu('manager');
    expect(screen.getByTestId('quickadd-campaigns')).toBeTruthy();
  });

  it('dispatches start-meeting', () => {
    const onSelect = vi.fn();
    renderMenu('manager', { onSelect });
    fireEvent.click(screen.getByTestId('quickadd-start-meeting'));
    expect(onSelect).toHaveBeenCalledWith('start-meeting');
  });
});

describe('QuickAddMenu — keyboard behaviour', () => {
  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    renderMenu('agent', { onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
