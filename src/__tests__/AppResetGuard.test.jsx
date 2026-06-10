// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Stub all heavy child components — we're only testing App's routing logic.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ role: null, loading: false, isAuthenticated: false }),
  AuthProvider: ({ children }) => children,
}));
vi.mock('../components/auth/LoginScreen', () => ({
  default: () => <div data-testid="stub-login-screen" />,
}));
vi.mock('../components/auth/ResetPasswordHandler', () => ({
  default: ({ oobCode }) => <div data-testid="stub-reset-handler" data-oobcode={oobCode} />,
}));
vi.mock('../components/dashboard/AgentDashboard', () => ({ default: () => null }));
vi.mock('../components/dashboard/ManagerDashboard', () => ({ default: () => null }));
vi.mock('../components/dashboard/TenantAdminDashboard', () => ({ default: () => null }));
vi.mock('../components/ui/ToastProvider', () => ({
  default: ({ children }) => <>{children}</>,
}));

import App from '../App';

describe('App — reset-handler guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders LoginScreen when no action params are present', () => {
    vi.stubGlobal('location', { search: '', replace: vi.fn() });
    render(<App />);
    expect(screen.getByTestId('stub-login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-reset-handler')).toBeNull();
  });

  it('renders ResetPasswordHandler when mode=resetPassword + oobCode are both present', () => {
    vi.stubGlobal('location', {
      search: '?mode=resetPassword&oobCode=test-oob-code-xyz',
      replace: vi.fn(),
    });
    render(<App />);
    const handler = screen.getByTestId('stub-reset-handler');
    expect(handler).toBeInTheDocument();
    expect(handler).toHaveAttribute('data-oobcode', 'test-oob-code-xyz');
    expect(screen.queryByTestId('stub-login-screen')).toBeNull();
  });

  it('does NOT intercept when mode=resetPassword but oobCode is absent', () => {
    vi.stubGlobal('location', { search: '?mode=resetPassword', replace: vi.fn() });
    render(<App />);
    expect(screen.queryByTestId('stub-reset-handler')).toBeNull();
    expect(screen.getByTestId('stub-login-screen')).toBeInTheDocument();
  });

  it('does NOT intercept for other Firebase action modes (verifyEmail, recoverEmail)', () => {
    vi.stubGlobal('location', {
      search: '?mode=verifyEmail&oobCode=some-code',
      replace: vi.fn(),
    });
    render(<App />);
    expect(screen.queryByTestId('stub-reset-handler')).toBeNull();
    expect(screen.getByTestId('stub-login-screen')).toBeInTheDocument();
  });

  it('does NOT intercept when oobCode is present but mode is absent', () => {
    vi.stubGlobal('location', { search: '?oobCode=some-code', replace: vi.fn() });
    render(<App />);
    expect(screen.queryByTestId('stub-reset-handler')).toBeNull();
    expect(screen.getByTestId('stub-login-screen')).toBeInTheDocument();
  });
});
