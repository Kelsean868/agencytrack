// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Tier-3 3.1 — verifies AppRoot routes role 'cro' to the CRODashboard.
const hoisted = vi.hoisted(() => ({ authState: { role: 'cro', loading: false, isAuthenticated: true, userProfile: { uid: 'cro-1' } } }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => hoisted.authState,
  AuthProvider: ({ children }) => children,
}));
vi.mock('../components/auth/LoginScreen', () => ({ default: () => <div data-testid="stub-login-screen" /> }));
vi.mock('../components/auth/ResetPasswordHandler', () => ({ default: () => null }));
vi.mock('../components/auth/EmailVerificationHandler', () => ({ default: () => null }));
vi.mock('../components/dashboard/AgentDashboard', () => ({ default: () => <div data-testid="stub-agent-dashboard" /> }));
vi.mock('../components/dashboard/ManagerDashboard', () => ({ default: () => <div data-testid="stub-manager-dashboard" /> }));
vi.mock('../components/dashboard/TenantAdminDashboard', () => ({ default: () => <div data-testid="stub-ta-dashboard" /> }));
vi.mock('../components/dashboard/CRODashboard', () => ({ default: () => <div data-testid="stub-cro-dashboard" /> }));
vi.mock('../components/ui/ToastProvider', () => ({ default: ({ children }) => <>{children}</> }));

import App from '../App';

describe('App routing — cro role (Tier-3 3.1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
    hoisted.authState = { role: 'cro', loading: false, isAuthenticated: true, userProfile: { uid: 'cro-1' } };
  });

  it('routes role "cro" to the CRODashboard (not manager / agent / tenant-admin)', async () => {
    vi.stubGlobal('location', { search: '', replace: vi.fn() });
    render(<App />);
    expect(await screen.findByTestId('stub-cro-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-manager-dashboard')).toBeNull();
    expect(screen.queryByTestId('stub-ta-dashboard')).toBeNull();
    expect(screen.queryByTestId('stub-agent-dashboard')).toBeNull();
  });

  it('still routes a manager role to the ManagerDashboard (cro branch does not capture others)', async () => {
    hoisted.authState = { role: 'branch_manager', loading: false, isAuthenticated: true, userProfile: { uid: 'bm-1' } };
    vi.stubGlobal('location', { search: '', replace: vi.fn() });
    render(<App />);
    expect(await screen.findByTestId('stub-manager-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-cro-dashboard')).toBeNull();
  });
});
