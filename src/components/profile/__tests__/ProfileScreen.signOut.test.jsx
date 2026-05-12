// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ProfileScreen pulls firebase via authService + userService + loggingModeService.
// Mock everything load-bearing so the test can mount the component cheaply
// and exercise the new Sign Out button only.
const hoisted = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(),
  useAuth: vi.fn(),
  updateUserProfile: vi.fn(),
  compressImage: vi.fn(),
  uploadProfilePhoto: vi.fn(),
  aggregateCurrentWeekDaily: vi.fn(),
  catchUpWeeklyToDaily: vi.fn(),
}));

vi.mock('../../../services/authService', () => ({
  signOut: hoisted.signOut,
}));

vi.mock('../../../services/userService', () => ({
  updateUserProfile: hoisted.updateUserProfile,
  compressImage: hoisted.compressImage,
  uploadProfilePhoto: hoisted.uploadProfilePhoto,
}));

vi.mock('../../../services/loggingModeService', () => ({
  aggregateCurrentWeekDaily: hoisted.aggregateCurrentWeekDaily,
  catchUpWeeklyToDaily: hoisted.catchUpWeeklyToDaily,
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

import ProfileScreen from '../ProfileScreen';

describe('ProfileScreen — Sign Out button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({
      user: { uid: 'a1', email: 'agent@example.com' },
      userProfile: {
        name: 'Test Agent',
        email: 'agent@example.com',
        phone: '',
        bio: '',
        loggingMode: 'hybrid',
        dailyNudgeTime: '17:00',
      },
      role: 'agent',
    });
  });

  it('renders the Sign Out button', () => {
    render(<ProfileScreen />);
    expect(screen.getByTestId('profile-sign-out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
  });

  it('Sign Out button is in an "Account" section', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('clicking Sign Out calls signOut from authService', () => {
    render(<ProfileScreen />);
    fireEvent.click(screen.getByTestId('profile-sign-out'));
    expect(hoisted.signOut).toHaveBeenCalledOnce();
  });

  it('Sign Out button meets the 44px min-height touch target', () => {
    render(<ProfileScreen />);
    const btn = screen.getByTestId('profile-sign-out');
    // Tailwind class min-h-[44px] is the source of truth — assert it stays applied
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });
});
