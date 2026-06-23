// @vitest-environment jsdom
//
// ProfileScreen — Menu layout section (Nav redesign PR-4).
// Agents: workspace/both disabled (manager-only). Managers: all selectable,
// selection calls onMenuLayoutChange.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(),
  useAuth: vi.fn(),
  updateUserProfile: vi.fn(),
  compressImage: vi.fn(),
  uploadProfilePhoto: vi.fn(),
  aggregateCurrentWeekDaily: vi.fn(),
  catchUpWeeklyToDaily: vi.fn(),
}));

vi.mock('../../../services/authService', () => ({ signOut: hoisted.signOut }));
vi.mock('../../../services/userService', () => ({
  updateUserProfile: hoisted.updateUserProfile,
  compressImage: hoisted.compressImage,
  uploadProfilePhoto: hoisted.uploadProfilePhoto,
}));
vi.mock('../../../services/loggingModeService', () => ({
  aggregateCurrentWeekDaily: hoisted.aggregateCurrentWeekDaily,
  catchUpWeeklyToDaily: hoisted.catchUpWeeklyToDaily,
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));

import ProfileScreen from '../ProfileScreen';

const baseProfile = { name: 'X', email: 'x@example.com', phone: '', bio: '', loggingMode: 'hybrid', dailyNudgeTime: '17:00' };

describe('ProfileScreen — Menu layout (agent lock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ user: { uid: 'a1', email: 'x@example.com' }, userProfile: baseProfile, role: 'agent' });
  });

  it('renders all three layout cards', () => {
    render(<ProfileScreen menuLayout="pinned" onMenuLayoutChange={vi.fn()} />);
    expect(screen.getByTestId('menu-layout-pinned')).toBeInTheDocument();
    expect(screen.getByTestId('menu-layout-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('menu-layout-both')).toBeInTheDocument();
  });

  it('disables workspace + both for agents; pinned enabled + checked', () => {
    render(<ProfileScreen menuLayout="pinned" onMenuLayoutChange={vi.fn()} />);
    expect(screen.getByTestId('menu-layout-workspace')).toBeDisabled();
    expect(screen.getByTestId('menu-layout-both')).toBeDisabled();
    expect(screen.getByTestId('menu-layout-pinned')).not.toBeDisabled();
    expect(screen.getByTestId('menu-layout-pinned')).toBeChecked();
  });

  it('does not fire onMenuLayoutChange when an agent clicks the disabled workspace card', () => {
    const onChange = vi.fn();
    render(<ProfileScreen menuLayout="pinned" onMenuLayoutChange={onChange} />);
    fireEvent.click(screen.getByTestId('menu-layout-workspace'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen — Menu layout (manager)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ user: { uid: 'm1', email: 'm@example.com' }, userProfile: baseProfile, role: 'branch_manager' });
  });

  it('enables all three cards for a manager', () => {
    render(<ProfileScreen menuLayout="pinned" onMenuLayoutChange={vi.fn()} />);
    expect(screen.getByTestId('menu-layout-pinned')).not.toBeDisabled();
    expect(screen.getByTestId('menu-layout-workspace')).not.toBeDisabled();
    expect(screen.getByTestId('menu-layout-both')).not.toBeDisabled();
  });

  it('selecting Workspace calls onMenuLayoutChange("workspace")', () => {
    const onChange = vi.fn();
    render(<ProfileScreen menuLayout="pinned" onMenuLayoutChange={onChange} />);
    fireEvent.click(screen.getByTestId('menu-layout-workspace'));
    expect(onChange).toHaveBeenCalledWith('workspace');
  });
});
