// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('firebase/auth', () => ({
  applyActionCode: vi.fn(),
}));
vi.mock('../../../firebase', () => ({ auth: {} }));

import { applyActionCode } from 'firebase/auth';
import EmailVerificationHandler from '../EmailVerificationHandler';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EmailVerificationHandler', () => {
  it('shows verifying spinner while applyActionCode is pending', () => {
    applyActionCode.mockReturnValue(new Promise(() => {}));
    render(<EmailVerificationHandler oobCode="test-code" />);
    expect(screen.getByTestId('verify-phase-verifying')).toBeInTheDocument();
  });

  it('shows success state after applyActionCode resolves', async () => {
    applyActionCode.mockResolvedValue();
    render(<EmailVerificationHandler oobCode="test-code" />);
    await waitFor(() =>
      expect(screen.getByTestId('verify-phase-success')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('verify-phase-verifying')).toBeNull();
  });

  it('shows invalid/expired state when applyActionCode rejects', async () => {
    applyActionCode.mockRejectedValue(new Error('auth/expired-action-code'));
    render(<EmailVerificationHandler oobCode="bad-code" />);
    await waitFor(() =>
      expect(screen.getByTestId('verify-phase-invalid')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('verify-phase-verifying')).toBeNull();
  });

  it('calls applyActionCode with the oobCode prop', async () => {
    applyActionCode.mockResolvedValue();
    render(<EmailVerificationHandler oobCode="abc123" />);
    await waitFor(() => expect(applyActionCode).toHaveBeenCalledWith({}, 'abc123'));
  });

  it('renders the branded card and AgencyTrack heading', async () => {
    applyActionCode.mockResolvedValue();
    render(<EmailVerificationHandler oobCode="test-code" />);
    expect(screen.getByTestId('verify-handler-card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /AgencyTrack/i })).toBeInTheDocument();
  });

  it('success "Sign in" button navigates to /', async () => {
    applyActionCode.mockResolvedValue();
    const replaceMock = vi.fn();
    vi.stubGlobal('location', { replace: replaceMock });
    render(<EmailVerificationHandler oobCode="test-code" />);
    await waitFor(() => screen.getByTestId('verify-phase-success'));
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(replaceMock).toHaveBeenCalledWith('/');
    vi.unstubAllGlobals();
  });

  it('invalid "Back to sign in" button navigates to /', async () => {
    applyActionCode.mockRejectedValue(new Error('auth/invalid-action-code'));
    const replaceMock = vi.fn();
    vi.stubGlobal('location', { replace: replaceMock });
    render(<EmailVerificationHandler oobCode="bad-code" />);
    await waitFor(() => screen.getByTestId('verify-phase-invalid'));
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(replaceMock).toHaveBeenCalledWith('/');
    vi.unstubAllGlobals();
  });
});
