// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Tier-3 #15: manager per-panel enable/disable. Mock everything load-bearing so
// the test exercises the toggle → kioskConfigService write wire-up only.
const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  showToast: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args) => args),
  collection: vi.fn(() => ({ __mock: 'collection' })),
  orderBy: vi.fn(),
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(),
  getKioskConfig: vi.fn(),
  setKioskDisabledPanels: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: hoisted.useAuth }));
vi.mock('../../../hooks/useToast', () => ({
  default: () => ({ show: hoisted.showToast, dismiss: vi.fn() }),
}));
vi.mock('firebase/firestore', () => ({
  getDocs: hoisted.getDocs,
  query: hoisted.query,
  collection: hoisted.collection,
  orderBy: hoisted.orderBy,
}));
vi.mock('firebase/functions', () => ({
  getFunctions: hoisted.getFunctions,
  httpsCallable: hoisted.httpsCallable,
}));
vi.mock('../../../firebase', () => ({ db: { __mock: 'db' }, auth: { currentUser: null } }));
vi.mock('../../../lib/kiosk/kioskConfigService', () => ({
  getKioskConfig: hoisted.getKioskConfig,
  setKioskDisabledPanels: hoisted.setKioskDisabledPanels,
}));

import KioskModeTab from '../KioskModeTab';

describe('KioskModeTab — per-panel enable/disable', () => {
  afterEach(() => { vi.useRealTimers(); });

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ tenantId: 't1', branchId: 'b1', user: { uid: 'u1' } });
    hoisted.getDocs.mockResolvedValue({ docs: [] }); // no tokens; panels still render
    hoisted.getKioskConfig.mockResolvedValue({ disabledPanels: [] });
    hoisted.setKioskDisabledPanels.mockResolvedValue(undefined);
  });

  it('renders a switch per PANEL_ORDER panel, all enabled by default', async () => {
    render(<KioskModeTab />);
    const toggle = await screen.findByTestId('kiosk-panel-toggle-agentOfMonth');
    expect(toggle).toHaveAttribute('role', 'switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('toggling a panel OFF persists it via setKioskDisabledPanels and fires a success toast', async () => {
    render(<KioskModeTab />);
    const toggle = await screen.findByTestId('kiosk-panel-toggle-agentOfMonth');
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => {
      expect(hoisted.setKioskDisabledPanels).toHaveBeenCalledWith('t1', 'b1', 'u1', ['agentOfMonth']);
    });
    expect(hoisted.showToast).toHaveBeenCalledWith({
      message: 'Agent of the Month hidden from kiosk',
      variant: 'success',
    });
    // Optimistic UI flips aria-checked to false.
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  });

  it('toggling an already-disabled panel back ON removes it from the list', async () => {
    hoisted.getKioskConfig.mockResolvedValue({ disabledPanels: ['compliance'] });
    render(<KioskModeTab />);
    const toggle = await screen.findByTestId('kiosk-panel-toggle-compliance');
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => {
      expect(hoisted.setKioskDisabledPanels).toHaveBeenCalledWith('t1', 'b1', 'u1', []);
    });
    expect(hoisted.showToast).toHaveBeenCalledWith({
      message: 'Compliance shown on kiosk',
      variant: 'success',
    });
  });

  it('reverts optimistic state and fires an error toast when the write fails', async () => {
    hoisted.setKioskDisabledPanels.mockRejectedValueOnce(new Error('permission-denied'));
    render(<KioskModeTab />);
    const toggle = await screen.findByTestId('kiosk-panel-toggle-agentOfMonth');
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => {
      expect(hoisted.showToast).toHaveBeenCalledWith({
        message: 'Failed to update panel — try again',
        variant: 'error',
      });
    });
    // Reverted back to enabled.
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('disables the switches when the manager has no branch assigned', async () => {
    hoisted.useAuth.mockReturnValue({ tenantId: 't1', branchId: null, user: { uid: 'u1' } });
    render(<KioskModeTab />);
    const toggle = await screen.findByTestId('kiosk-panel-toggle-agentOfMonth');
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(hoisted.setKioskDisabledPanels).not.toHaveBeenCalled();
  });
});
