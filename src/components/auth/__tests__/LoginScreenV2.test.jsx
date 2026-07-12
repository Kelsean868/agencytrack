// @vitest-environment jsdom
//
// Track J — LoginScreen v2 restyle. Asserts the new visual elements were
// added (animated backdrop pattern + liquid-glass card + password
// eye-toggle) WITHOUT touching the auth flow (signIn / sendPasswordReset).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../services/authService', () => ({
  signIn:             vi.fn(() => Promise.resolve()),
  sendPasswordReset:  vi.fn(() => Promise.resolve()),
}));

import LoginScreen from '../LoginScreen';
import { signIn, sendPasswordReset } from '../../../services/authService';

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('LoginScreen v2 — animated backdrop pattern', () => {
  it('renders the animated login-pattern (4 drifting rows, no static SVG <pattern>)', () => {
    render(<LoginScreen />);
    const pattern = screen.getByTestId('login-pattern');
    expect(pattern).toBeInTheDocument();
    // 4 rows expected.
    const rows = pattern.children;
    expect(rows.length).toBe(4);
    // Alternating drift directions — rows 0/2 drift left, 1/3 drift right.
    expect(rows[0].className).toMatch(/animate-login-drift-l/);
    expect(rows[1].className).toMatch(/animate-login-drift-r/);
    expect(rows[2].className).toMatch(/animate-login-drift-l/);
    expect(rows[3].className).toMatch(/animate-login-drift-r/);
    // motion-reduce safety on every row.
    Array.from(rows).forEach((row) => {
      expect(row.className).toMatch(/motion-reduce:animate-none/);
    });
  });
});

describe('LoginScreen v2 — liquid-glass card', () => {
  it('uses backdrop-blur + alpha-modulated card surface', () => {
    render(<LoginScreen />);
    const card = screen.getByTestId('login-card');
    expect(card).toBeInTheDocument();
    expect(card.className).toMatch(/backdrop-blur-md/);
    expect(card.className).toMatch(/bg-card\/80/);
  });
});

describe('LoginScreen v2 — password eye-toggle (UI-only)', () => {
  it('toggles the password input type between password and text', () => {
    render(<LoginScreen />);
    const pwd = screen.getByLabelText('Password');
    const toggle = screen.getByTestId('login-password-toggle');
    expect(pwd).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Show password');

    fireEvent.click(toggle);
    expect(pwd).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Hide password');

    fireEvent.click(toggle);
    expect(pwd).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('does NOT call signIn or sendPasswordReset when the toggle is clicked', () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByTestId('login-password-toggle'));
    expect(signIn).not.toHaveBeenCalled();
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });
});

describe('LoginScreen v2 — caps-lock trust affordance', () => {
  it('shows the caps-lock hint only while CapsLock is on (aria-live=polite)', () => {
    render(<LoginScreen />);
    const pwd = screen.getByLabelText('Password');
    const hint = screen.getByTestId('caps-lock-hint');
    expect(hint).toHaveAttribute('aria-live', 'polite');
    expect(hint.textContent.trim()).toBe('');

    // jsdom's native KeyboardEvent honors the `modifierCapsLock` init flag
    // and derives a real getModifierState('CapsLock') from it — this
    // exercises the actual browser API LoginScreen reads, not a stub.
    fireEvent.keyDown(pwd, { key: 'a', modifierCapsLock: true });
    expect(hint.textContent).toMatch(/Caps Lock is on/i);

    fireEvent.keyUp(pwd, { key: 'a', modifierCapsLock: false });
    expect(hint.textContent.trim()).toBe('');
  });

  it('does not throw when the key event has no getModifierState (non-keyboard-modifier environments)', () => {
    render(<LoginScreen />);
    const pwd = screen.getByLabelText('Password');
    expect(() => fireEvent.keyDown(pwd, { key: 'a' })).not.toThrow();
    expect(screen.getByTestId('caps-lock-hint').textContent.trim()).toBe('');
  });
});

describe('LoginScreen v2 — help footer + trust line', () => {
  it('renders the help footer with a non-link "Contact your manager" and the trust line', () => {
    render(<LoginScreen />);
    const footer = screen.getByTestId('login-help-footer');
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toMatch(/Trouble signing in\?/);
    expect(footer.textContent).toMatch(/Contact your manager/);
    expect(footer.textContent).toMatch(/Secured by Tatil Life/);
    // No fabricated contact link/button — "Contact your manager" must not
    // be an interactive element since no real contact target exists.
    expect(screen.queryByRole('link', { name: /contact your manager/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /contact your manager/i })).not.toBeInTheDocument();
  });
});

describe('LoginScreen v2 — carded error', () => {
  it('renders the auth error inside the established error-card grammar (role=alert, danger tokens)', async () => {
    signIn.mockRejectedValueOnce({ code: 'auth/wrong-password' });
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const card = await screen.findByTestId('login-error-card');
    expect(card).toHaveAttribute('role', 'alert');
    expect(card.className).toMatch(/bg-danger\/10/);
    expect(card.className).toMatch(/border-danger\/30/);
    expect(card.textContent).toMatch(/Incorrect email or password\./);
  });

  it('keeps the existing error MESSAGE for the empty-email forgot-password guard, now in the carded grammar', () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    const card = screen.getByTestId('login-error-card');
    expect(card).toHaveAttribute('role', 'alert');
    expect(card.textContent).toMatch(/Enter your email/);
  });
});

describe('LoginScreen v2 — auth flow (regression: unchanged)', () => {
  it('calls signIn with the entered email + password on submit', async () => {
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'),       { target: { value: 'secret!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    // Drain the microtask queue so the submit handler's awaited signIn resolves.
    await Promise.resolve();
    expect(signIn).toHaveBeenCalledWith('a@b.com', 'secret!');
  });

  it('calls sendPasswordReset with the entered email when "Forgot password?" is clicked', async () => {
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    await Promise.resolve();
    expect(sendPasswordReset).toHaveBeenCalledWith('a@b.com');
  });

  it('blocks "Forgot password?" with an inline error when email is empty', () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/Enter your email/);
    expect(sendPasswordReset).not.toHaveBeenCalled();
  });
});
