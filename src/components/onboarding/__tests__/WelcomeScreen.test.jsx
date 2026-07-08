// Dialog a11y contract (§4 dialog sweep) for the onboarding tour overlay.
// Component previously had no role/aria-modal/trap/Escape/return.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  authValue: { user: { uid: 'agent-1' }, tenantId: 't1' },
  updateDoc: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));

vi.mock('firebase/firestore', () => ({
  doc: (_db, ...segments) => ({ path: segments.join('/') }),
  updateDoc: (...a) => hoisted.updateDoc(...a),
}));

import WelcomeScreen from '../WelcomeScreen';

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.updateDoc.mockResolvedValue();
});

describe('WelcomeScreen', () => {
  it('renders the first slide', () => {
    render(<WelcomeScreen onComplete={() => {}} />);
    expect(screen.getByText('Welcome to AgencyTrack')).toBeInTheDocument();
  });

  it('advances slides via Next', () => {
    render(<WelcomeScreen onComplete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Next$/ }));
    expect(screen.getByText('Your Weekly Report')).toBeInTheDocument();
  });

  it('Skip calls onComplete (after the write attempt resolves)', async () => {
    const onComplete = vi.fn();
    render(<WelcomeScreen onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /^Skip$/ }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(hoisted.updateDoc).toHaveBeenCalled();
  });
});

// ── Dialog a11y contract (§4 dialog sweep) ───────────────────────────────────

describe('WelcomeScreen — dialog a11y', () => {
  it('exposes role=dialog + aria-modal=true + aria-labelledby', () => {
    render(<WelcomeScreen onComplete={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'welcome-screen-heading');
  });

  it('Escape triggers the same completion flow as Skip', async () => {
    const onComplete = vi.fn();
    render(<WelcomeScreen onComplete={onComplete} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', () => {
    render(<WelcomeScreen onComplete={() => {}} />);
    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll(
        'button:not([disabled]):not([aria-hidden="true"]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('restores focus to the invoking element when the tour unmounts', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<WelcomeScreen onComplete={() => {}} />);
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
