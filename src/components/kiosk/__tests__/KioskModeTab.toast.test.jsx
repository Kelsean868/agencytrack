// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// KioskModeTab depends on Firestore + Functions + AuthContext + useToast.
// Mock everything load-bearing so the test exercises the toast wire-up only.
const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  showToast: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args) => args),
  collection: vi.fn(() => ({ __mock: 'collection' })),
  orderBy: vi.fn(),
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

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

vi.mock('../../../firebase', () => ({
  db: { __mock: 'db' },
  auth: { currentUser: null },
}));

import KioskModeTab from '../KioskModeTab';

describe('KioskModeTab — copy toast wire-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({ tenantId: 't1' });
    // One existing token in the listing so the copy button renders
    hoisted.getDocs.mockResolvedValue({
      docs: [{
        id: 'tok1',
        data: () => ({
          createdAt: { toDate: () => new Date('2026-01-01') },
          revokedAt: null,
        }),
      }],
    });
    // Patch navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: hoisted.writeText },
    });
    hoisted.writeText.mockResolvedValue(undefined);
  });

  it('clicking Copy fires a success toast with "Link copied"', async () => {
    render(<KioskModeTab />);
    // Wait for tokens to load
    const copyButtons = await screen.findAllByTitle(/Copy URL|Copied/);
    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });
    await waitFor(() => {
      expect(hoisted.showToast).toHaveBeenCalledWith({
        message: 'Link copied',
        variant: 'success',
      });
    });
  });

  it('Copy failure fires an error toast', async () => {
    hoisted.writeText.mockRejectedValueOnce(new Error('clipboard denied'));
    render(<KioskModeTab />);
    const copyButtons = await screen.findAllByTitle(/Copy URL|Copied/);
    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });
    await waitFor(() => {
      expect(hoisted.showToast).toHaveBeenCalledWith({
        message: 'Copy failed',
        variant: 'error',
      });
    });
  });

  it('Generate fires a success toast on auto-copy success', async () => {
    const fakeFn = vi.fn().mockResolvedValue({
      data: { kioskUrl: 'https://example.com/kiosk/t1/tok2', tokenId: 'tok2' },
    });
    hoisted.httpsCallable.mockReturnValue(fakeFn);
    render(<KioskModeTab />);
    // Wait for initial load
    await screen.findByText(/Generate URL/);
    await act(async () => {
      fireEvent.click(screen.getByText('Generate URL'));
    });
    await waitFor(() => {
      expect(hoisted.showToast).toHaveBeenCalledWith({
        message: 'Kiosk URL generated and copied',
        variant: 'success',
      });
    });
  });

  it('Generate fires a warning toast when auto-copy fails', async () => {
    hoisted.writeText.mockRejectedValueOnce(new Error('clipboard denied'));
    const fakeFn = vi.fn().mockResolvedValue({
      data: { kioskUrl: 'https://example.com/kiosk/t1/tok3', tokenId: 'tok3' },
    });
    hoisted.httpsCallable.mockReturnValue(fakeFn);
    render(<KioskModeTab />);
    await screen.findByText(/Generate URL/);
    await act(async () => {
      fireEvent.click(screen.getByText('Generate URL'));
    });
    await waitFor(() => {
      expect(hoisted.showToast).toHaveBeenCalledWith({
        message: 'URL generated — copy failed, use the copy button',
        variant: 'warning',
      });
    }, { timeout: 3000 });
  });
});
