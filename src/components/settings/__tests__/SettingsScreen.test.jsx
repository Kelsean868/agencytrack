// @vitest-environment jsdom
//
// SettingsScreen — Settings v2 shell + My Preferences (Fable Tier 2 · 2.4).
// Value-level coverage: theme control round-trip (System via matchMedia mock),
// honesty-rule role gating, skipped prefs absent from the DOM, view-default
// writes, and the Account tab shortcut into Profile.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const setSetting = vi.fn();
let settingsValue = {};
vi.mock('../../../hooks/useAppSettings', () => ({
  __esModule: true,
  default: () => ({ settings: settingsValue, setSetting }),
}));

import SettingsScreen from '../SettingsScreen';
import { THEME_KEY } from '../../../lib/theme';

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches, media: query, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
  }));
}

const baseProps = {
  role: 'branch_manager',
  roleLabel: 'Branch Manager',
  userProfile: { name: 'Trevor R.', email: 'trevor@tatil.co.tt', branchName: 'South Branch' },
  tenantId: 't1',
  uid: 'u1',
  onOpenProfile: vi.fn(),
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  delete window.matchMedia;
  settingsValue = {};
  setSetting.mockReset();
  baseProps.onOpenProfile.mockReset();
});
afterEach(() => { delete window.matchMedia; });

describe('SettingsScreen — theme control', () => {
  it('round-trips: clicking Dark applies the dark class and checks the segment', () => {
    localStorage.setItem(THEME_KEY, 'light');
    render(<SettingsScreen {...baseProps} />);
    const dark = screen.getByRole('radio', { name: /Dark/i });
    expect(dark).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(dark);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('radio', { name: /Dark/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('System resolves via matchMedia (OS dark → dark class)', () => {
    mockMatchMedia(true);
    render(<SettingsScreen {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /System/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('SettingsScreen — honesty rule (skipped prefs absent)', () => {
  it('renders no Density control (no substrate in the app)', () => {
    render(<SettingsScreen {...baseProps} />);
    expect(screen.queryByText('Density')).toBeNull();
  });
  it('renders none of the mockup notification toggles (no consumer)', () => {
    render(<SettingsScreen {...baseProps} />);
    expect(screen.queryByText(/Weekly report reminders/i)).toBeNull();
    expect(screen.queryByText(/Exception alerts/i)).toBeNull();
    expect(screen.queryByText(/Recognition shout/i)).toBeNull();
  });
});

describe('SettingsScreen — view-default role gating', () => {
  it('shows the Default RANK BY control for a manager and writes on change', () => {
    render(<SettingsScreen {...baseProps} />);
    expect(screen.getByText('Default RANK BY')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-mastersheet-rankby-newNames'));
    expect(setSetting).toHaveBeenCalledWith('masterSheetPreset', 'newNames');
  });

  it('hides the Default RANK BY control for an agent (no such surface)', () => {
    // `role`/`roleLabel` spread so jsx-a11y doesn't read the literal `role` as an ARIA role.
    render(<SettingsScreen {...baseProps} {...{ role: 'agent', roleLabel: 'Agent' }} />);
    expect(screen.queryByText('Default RANK BY')).toBeNull();
    // agents still get the leaderboard default-period control
    expect(screen.getByText('Default time period')).toBeInTheDocument();
  });

  it('hides both view-defaults for a tenant admin (no leaderboard / master sheet)', () => {
    render(<SettingsScreen {...baseProps} {...{ role: 'tenant_admin', roleLabel: 'Tenant Admin' }} />);
    expect(screen.queryByText('Default time period')).toBeNull();
    expect(screen.queryByText('Default RANK BY')).toBeNull();
  });

  it('writes the default period on change', () => {
    render(<SettingsScreen {...baseProps} />);
    fireEvent.click(screen.getByTestId('settings-period-month'));
    expect(setSetting).toHaveBeenCalledWith('defaultPeriod', 'month');
  });
});

describe('SettingsScreen — Account tab', () => {
  it('shows read-only info and links into Profile', () => {
    render(<SettingsScreen {...baseProps} />);
    fireEvent.click(screen.getByTestId('settings-tab-account'));
    expect(screen.getByText('trevor@tatil.co.tt')).toBeInTheDocument();
    expect(screen.getByText('South Branch')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('settings-open-profile'));
    expect(baseProps.onOpenProfile).toHaveBeenCalledTimes(1);
  });
});
