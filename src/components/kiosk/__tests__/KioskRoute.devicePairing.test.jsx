import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// P2e (SEC-04) — the kiosk client's half of device binding.

const { mockSignInWithCustomToken } = vi.hoisted(() => ({
  mockSignInWithCustomToken: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../lib/kiosk/kioskFirebase', () => ({ kioskAuth: { name: 'kiosk' }, kioskDb: {} }));
vi.mock('firebase/auth', () => ({ signInWithCustomToken: mockSignInWithCustomToken }));
vi.mock('../KioskShell', () => ({ default: () => <div data-testid="kiosk-shell" /> }));

import KioskRoute from '../KioskRoute';

const TENANT = 'tatillife_south';
const TOKEN = 'tokenABC'.repeat(8);

function respond(body) {
  globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) });
}

describe('KioskRoute — device pairing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'location', { value: { pathname: `/kiosk/${TENANT}/${TOKEN}` }, writable: true });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('first open: sends no device secret, keeps the one the server issues', async () => {
    respond({ valid: true, customToken: 'ct', tenantId: TENANT, branchId: 'south', deviceSecret: 'sec-1' });
    render(<KioskRoute />);
    await waitFor(() => expect(screen.getByTestId('kiosk-shell')).toBeInTheDocument());
    expect(globalThis.fetch.mock.calls[0][0]).not.toContain('device=');
    expect(Object.values(window.localStorage)).toContain('sec-1');
  });

  it('later opens present the stored secret', async () => {
    respond({ valid: true, customToken: 'ct', tenantId: TENANT, branchId: 'south', deviceSecret: 'sec-1' });
    const first = render(<KioskRoute />);
    await waitFor(() => expect(screen.getByTestId('kiosk-shell')).toBeInTheDocument());
    first.unmount();
    respond({ valid: true, customToken: 'ct', tenantId: TENANT, branchId: 'south' });
    render(<KioskRoute />);
    await waitFor(() => expect(screen.getByTestId('kiosk-shell')).toBeInTheDocument());
    expect(globalThis.fetch.mock.calls[0][0]).toContain('device=sec-1');
  });

  it('a link paired elsewhere shows the "paired with another screen" message, no session', async () => {
    respond({ valid: false, reason: 'device' });
    render(<KioskRoute />);
    await waitFor(() => expect(screen.getByTestId('kiosk-device')).toBeInTheDocument());
    expect(screen.getByText(/paired with another screen/i)).toBeInTheDocument();
    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });

  it('a browser that will not keep the pairing is told so, and no session starts', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    respond({ valid: true, customToken: 'ct', tenantId: TENANT, branchId: 'south', deviceSecret: 'sec-1' });
    render(<KioskRoute />);
    await waitFor(() => expect(screen.getByTestId('kiosk-storage')).toBeInTheDocument());
    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });
});
