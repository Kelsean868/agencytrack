// Dialog a11y contract (§4 dialog sweep) for the fullscreen Meeting Mode
// presentation overlay. Component previously had Escape-only handling (mixed
// into the arrow-key navigation handler) — no role/aria-modal/trap/return.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  authValue: { tenantId: 't1' },
  getDocs: vi.fn(),
}));

vi.mock('../../../context/AuthContext', () => ({ useAuth: () => hoisted.authValue }));

vi.mock('firebase/firestore', () => ({
  collection: (_db, ...segments) => ({ path: segments.join('/') }),
  getDocs: (...a) => hoisted.getDocs(...a),
}));

import MeetingMode from '../MeetingMode';

const SUBMISSIONS = [
  {
    agentId: 'agent-1',
    agentName: 'Alice Agent',
    status: 'submitted',
    prospectingTouches: 10,
    totalTelAttempts: 5,
    f2fAttempts: 3,
    qualifiedApproaches: 2,
    ffiConducted: 1,
    solutionPresentations: 1,
    ciConducted: 1,
    applicationsSold: 1,
    livesSold: 1,
    apiSold: 5000,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getDocs.mockResolvedValue({ forEach: () => {} });
});

describe('MeetingMode', () => {
  it('renders the summary slide first', async () => {
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />);
    await waitFor(() => expect(hoisted.getDocs).toHaveBeenCalled());
    expect(screen.getByText(/Week of/)).toBeInTheDocument();
  });

  it('calls onClose when the Exit button is clicked', async () => {
    const onClose = vi.fn();
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /exit meeting mode/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ArrowRight still advances to the next slide', async () => {
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText('Alice Agent')).toBeInTheDocument());
  });
});

// ── Dialog a11y contract (§4 dialog sweep) ───────────────────────────────────

describe('MeetingMode — dialog a11y', () => {
  it('exposes role=dialog + aria-modal=true + aria-label', () => {
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Meeting mode presentation');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab from the last focusable element cycles back to the first (focus trap)', () => {
    render(<MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />);
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

  it('restores focus to the invoking element when Meeting Mode unmounts', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <MeetingMode submissions={SUBMISSIONS} selectedWeek="2026-06-28" onClose={() => {}} />
    );
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
