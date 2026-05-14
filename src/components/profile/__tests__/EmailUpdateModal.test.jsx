// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  useAuth: vi.fn(),
  requestEmailUpdate: vi.fn(),
  isValidEmail: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: hoisted.useAuth,
}));

vi.mock('../../../services/authService', () => ({
  requestEmailUpdate: hoisted.requestEmailUpdate,
}));

vi.mock('../../../utils/validators', () => ({
  isValidEmail: hoisted.isValidEmail,
}));

import EmailUpdateModal from '../EmailUpdateModal';

const MOCK_USER = { uid: 'ta-uid-1', email: 'admin@tatillife.com' };

describe('EmailUpdateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useAuth.mockReturnValue({
      user: MOCK_USER,
      tenantId: 'tatillife_south',
    });
    hoisted.isValidEmail.mockReturnValue(true);
    hoisted.requestEmailUpdate.mockResolvedValue();
  });

  it('renders the modal with a title', () => {
    render(<EmailUpdateModal onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Update Email')).toBeInTheDocument();
  });

  it('renders current password and new email inputs', () => {
    render(<EmailUpdateModal onClose={vi.fn()} />);
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new email address/i)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<EmailUpdateModal onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send verification email/i })).toBeInTheDocument();
  });

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn();
    render(<EmailUpdateModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<EmailUpdateModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows inline error when current password is empty on submit', async () => {
    render(<EmailUpdateModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: 'new@email.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/current password is required/i);
    expect(hoisted.requestEmailUpdate).not.toHaveBeenCalled();
  });

  it('shows inline error when new email is invalid', async () => {
    hoisted.isValidEmail.mockReturnValue(false);
    render(<EmailUpdateModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid new email/i);
    expect(hoisted.requestEmailUpdate).not.toHaveBeenCalled();
  });

  it('shows inline error when new email equals current email', async () => {
    render(<EmailUpdateModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: MOCK_USER.email },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/different from your current email/i);
    expect(hoisted.requestEmailUpdate).not.toHaveBeenCalled();
  });

  it('calls requestEmailUpdate with correct params on valid submit', async () => {
    render(<EmailUpdateModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: 'new@tatillife.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));

    await waitFor(() => expect(hoisted.requestEmailUpdate).toHaveBeenCalledOnce());
    expect(hoisted.requestEmailUpdate).toHaveBeenCalledWith(
      MOCK_USER,
      'secret123',
      'new@tatillife.com',
      'tatillife_south',
    );
  });

  it('shows success state after requestEmailUpdate resolves', async () => {
    render(<EmailUpdateModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: 'new@tatillife.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));

    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
    expect(screen.getByText(/new@tatillife.com/)).toBeInTheDocument();
  });

  it('shows wrong-password error when auth/wrong-password is thrown', async () => {
    const err = Object.assign(new Error('wrong-password'), { code: 'auth/wrong-password' });
    hoisted.requestEmailUpdate.mockRejectedValueOnce(err);

    render(<EmailUpdateModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'badpassword' },
    });
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: 'new@tatillife.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect password/i);
  });

  it('shows email-in-use error when auth/email-already-in-use is thrown', async () => {
    const err = Object.assign(new Error(), { code: 'auth/email-already-in-use' });
    hoisted.requestEmailUpdate.mockRejectedValueOnce(err);

    render(<EmailUpdateModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: 'taken@email.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already associated/i);
  });

  it('success state "Got it" button calls onClose', async () => {
    const onClose = vi.fn();
    render(<EmailUpdateModal onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByLabelText(/new email address/i), {
      target: { value: 'new@tatillife.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification email/i }));

    const gotIt = await screen.findByRole('button', { name: /got it/i });
    fireEvent.click(gotIt);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
