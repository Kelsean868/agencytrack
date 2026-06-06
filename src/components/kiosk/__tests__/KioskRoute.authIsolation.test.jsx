import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these refs are available inside the hoisted vi.mock factories.
const { mockSignInWithCustomToken, mockKioskAuth } = vi.hoisted(() => ({
  mockSignInWithCustomToken: vi.fn().mockResolvedValue({}),
  mockKioskAuth: { name: 'kiosk' },
}));

vi.mock('../../../lib/kiosk/kioskFirebase', () => ({
  kioskAuth: mockKioskAuth,
  kioskDb: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithCustomToken: mockSignInWithCustomToken,
}));

vi.mock('../KioskShell', () => ({
  default: ({ tenantId }) => <div data-testid="kiosk-shell" data-tenant={tenantId} />,
}));

import KioskRoute from '../KioskRoute';

const VALID_RESPONSE = {
  valid: true,
  customToken: 'tok-abc',
  tenantId: 'tatillife_south',
  branchId: 'south',
};

function setKioskPath(path = '/kiosk/tatillife_south/tokenABC') {
  Object.defineProperty(window, 'location', {
    value: { pathname: path },
    writable: true,
  });
}

describe('KioskRoute — auth isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setKioskPath();
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(VALID_RESPONSE),
    });
  });

  it('signs in via kioskAuth (secondary), NOT the default auth instance', async () => {
    render(<KioskRoute />);

    await waitFor(() => {
      expect(screen.getByTestId('kiosk-shell')).toBeInTheDocument();
    });

    // signInWithCustomToken must have been called with kioskAuth (secondary instance)
    expect(mockSignInWithCustomToken).toHaveBeenCalledTimes(1);
    expect(mockSignInWithCustomToken).toHaveBeenCalledWith(
      mockKioskAuth,
      VALID_RESPONSE.customToken,
    );
  });

  it('never touches the default auth import from firebase.js', async () => {
    // The default auth from ../../firebase must NOT appear in any signInWithCustomToken call.
    // We verify by checking the first argument is always our kioskAuth mock, not the firebase stub.
    render(<KioskRoute />);

    await waitFor(() => {
      expect(screen.getByTestId('kiosk-shell')).toBeInTheDocument();
    });

    const calls = mockSignInWithCustomToken.mock.calls;
    expect(calls.length).toBe(1);
    // First arg must be kioskAuth (has name:'kiosk'), not the global firebase stub ({})
    expect(calls[0][0]).toBe(mockKioskAuth);
  });

  it('renders KioskShell with tenantId on valid token', async () => {
    render(<KioskRoute />);

    await waitFor(() => {
      const shell = screen.getByTestId('kiosk-shell');
      expect(shell).toHaveAttribute('data-tenant', 'tatillife_south');
    });
  });

  it('shows invalid state without calling signIn when token is invalid', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ valid: false }),
    });

    render(<KioskRoute />);

    await waitFor(() => {
      expect(screen.getByText(/Display unavailable/i)).toBeInTheDocument();
    });

    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });

  it('shows invalid state when path is not a kiosk path', async () => {
    setKioskPath('/dashboard');
    render(<KioskRoute />);

    await waitFor(() => {
      expect(screen.getByText(/Display unavailable/i)).toBeInTheDocument();
    });

    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });
});
