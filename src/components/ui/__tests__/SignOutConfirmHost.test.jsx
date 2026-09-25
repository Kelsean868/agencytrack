// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import SignOutConfirmHost from '../SignOutConfirmHost';
import { requestSignOutConfirmation } from '../../../lib/signOutConfirmBridge';

describe('SignOutConfirmHost', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing (dialog closed) until a confirmation is requested', () => {
    render(<SignOutConfirmHost />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the dialog with the exact copy when requestSignOutConfirmation() is called', async () => {
    render(<SignOutConfirmHost />);

    let pending;
    act(() => {
      pending = requestSignOutConfirmation();
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(
      screen.getByText("You have changes that haven't synced yet. Sign out anyway?")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    // Settle so the test doesn't leave a dangling promise / act warning.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await pending;
  });

  it('clicking "Sign out" resolves the pending promise true and closes the dialog', async () => {
    render(<SignOutConfirmHost />);

    let pending;
    act(() => {
      pending = requestSignOutConfirmation();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await expect(pending).resolves.toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clicking "Cancel" resolves the pending promise false and closes the dialog', async () => {
    render(<SignOutConfirmHost />);

    let pending;
    act(() => {
      pending = requestSignOutConfirmation();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await expect(pending).resolves.toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('unregisters its handler on unmount — a subsequent request fails safe to false (no host to ask)', async () => {
    const { unmount } = render(<SignOutConfirmHost />);
    unmount();

    await expect(requestSignOutConfirmation()).resolves.toBe(false);
  });
});
