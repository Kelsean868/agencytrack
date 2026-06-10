// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import ResetPasswordHandler from '../ResetPasswordHandler';

describe('ResetPasswordHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('shows verifying spinner initially', () => {
    verifyPasswordResetCode.mockReturnValue(new Promise(() => {})); // pending forever
    render(<ResetPasswordHandler oobCode="test-code" />);
    expect(screen.getByTestId('reset-phase-verifying')).toBeInTheDocument();
    expect(screen.queryByTestId('reset-phase-ready')).toBeNull();
    expect(screen.queryByTestId('reset-phase-invalid')).toBeNull();
  });

  it('shows password form after valid oobCode verification', async () => {
    verifyPasswordResetCode.mockResolvedValue('pilot@tatillife.com');
    render(<ResetPasswordHandler oobCode="valid-code" />);
    await waitFor(() => expect(screen.getByTestId('reset-phase-ready')).toBeInTheDocument());
    expect(screen.getByText('pilot@tatillife.com')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
  });

  it('shows invalid/expired state when oobCode verification fails', async () => {
    verifyPasswordResetCode.mockRejectedValue({ code: 'auth/expired-action-code' });
    render(<ResetPasswordHandler oobCode="expired-code" />);
    await waitFor(() => expect(screen.getByTestId('reset-phase-invalid')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('shows success state after confirmPasswordReset resolves', async () => {
    verifyPasswordResetCode.mockResolvedValue('pilot@tatillife.com');
    confirmPasswordReset.mockResolvedValue();
    render(<ResetPasswordHandler oobCode="valid-code" />);
    await waitFor(() => screen.getByTestId('reset-phase-ready'));

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'strongpassword1' },
    });
    fireEvent.submit(screen.getByTestId('reset-phase-ready'));

    await waitFor(() => expect(screen.getByTestId('reset-phase-success')).toBeInTheDocument());
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows inline error on weak-password rejection', async () => {
    verifyPasswordResetCode.mockResolvedValue('pilot@tatillife.com');
    confirmPasswordReset.mockRejectedValue({ code: 'auth/weak-password' });
    render(<ResetPasswordHandler oobCode="valid-code" />);
    await waitFor(() => screen.getByTestId('reset-phase-ready'));

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'abc' },
    });
    fireEvent.submit(screen.getByTestId('reset-phase-ready'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/6 characters/i);
    // Form stays visible — user can retry
    expect(screen.getByTestId('reset-phase-ready')).toBeInTheDocument();
  });

  it('shows inline error on network failure', async () => {
    verifyPasswordResetCode.mockResolvedValue('pilot@tatillife.com');
    confirmPasswordReset.mockRejectedValue({ code: 'auth/network-request-failed' });
    render(<ResetPasswordHandler oobCode="valid-code" />);
    await waitFor(() => screen.getByTestId('reset-phase-ready'));

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'strongpassword1' },
    });
    fireEvent.submit(screen.getByTestId('reset-phase-ready'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/network/i);
  });

  it('toggles password field visibility', async () => {
    verifyPasswordResetCode.mockResolvedValue('pilot@tatillife.com');
    render(<ResetPasswordHandler oobCode="valid-code" />);
    await waitFor(() => screen.getByTestId('reset-phase-ready'));

    const input = screen.getByLabelText('New password');
    const toggle = screen.getByTestId('reset-password-toggle');

    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('does not submit when password is empty/whitespace', async () => {
    verifyPasswordResetCode.mockResolvedValue('pilot@tatillife.com');
    render(<ResetPasswordHandler oobCode="valid-code" />);
    await waitFor(() => screen.getByTestId('reset-phase-ready'));

    // Leave password blank and submit
    fireEvent.submit(screen.getByTestId('reset-phase-ready'));

    // confirmPasswordReset must not have been called
    expect(confirmPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByTestId('reset-phase-ready')).toBeInTheDocument();
  });

  it('renders the branded card and header', async () => {
    verifyPasswordResetCode.mockResolvedValue('pilot@tatillife.com');
    render(<ResetPasswordHandler oobCode="valid-code" />);
    expect(screen.getByTestId('reset-handler-card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AgencyTrack');
  });
});
