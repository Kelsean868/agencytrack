// @vitest-environment jsdom
/**
 * Dense (week-column) appointment card — mockup-parity contract.
 *
 * jsdom has NO layout engine, so these assert the STRUCTURE that produced the
 * measured fix, not the pixels. The pixel evidence was taken in a real browser
 * against these same components at a 131.4px column (the operator's width:
 * 1280px desktop minus the expanded sidebar) and is recorded in the PR body —
 * before: status pill spilled 48.9px past the card and 36.1px past the COLUMN,
 * every 2-digit-hour time wrapped to two lines, the prospect name rendered at
 * 0px, and the day header clipped. After: zero card overflow, no pill, one-line
 * times, an 86.6px name, no header clip.
 *
 * The contract these lock, per mockups/planner-desktop.jsx `DeskApptChip`:
 *   1. STACK, not a row — the roomy card's fixed `w-16` time box is what wrapped
 *      2-digit hours, so the dense card must not use it.
 *   2. NO status pill — StatusPill is whitespace-nowrap and cannot shrink; the
 *      status moves to a left rail + opacity + line-through.
 *   3. Status still reaches assistive tech (sr-only), so dropping the visual
 *      pill costs nothing semantically.
 *   4. The name truncates gracefully rather than being squeezed to nothing.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
// No vi.mock here on purpose: `src/firebase.js` is GLOBALLY stubbed by the
// firebaseTestStubPlugin (CLAUDE.md § Test Policy), so importing the real
// plannerService is safe. A `{ ...actual }` pass-through factory would mock
// nothing while implying it did.
import { AppointmentCard } from '../AgentPlannerPanel';

const base = {
  id: 'x1', date: '2026-07-22', startTime: '10:00', durationMin: 60,
  type: 'FFI', status: 'scheduled', prospectId: 'p1', note: '',
};

const renderCard = (appt = {}, props = {}) => render(
  <AppointmentCard
    appt={{ ...base, ...appt }}
    prospectName="Kamla Persad-Bissessar"
    onChurn={vi.fn()}
    resolveAppt={() => null}
    conflicted={false}
    dense
    {...props}
  />,
);

describe('AppointmentCard — dense week-column variant', () => {
  it('marks itself dense so the layout is identifiable in smokes', () => {
    renderCard();
    expect(screen.getByTestId('appt-card-x1')).toHaveAttribute('data-dense', 'true');
  });

  it('stacks (flex-col) instead of the roomy row — no fixed-width time box', () => {
    renderCard();
    const card = screen.getByTestId('appt-card-x1');
    expect(card.className).toMatch(/flex-col/);
    // `w-16` is the roomy card's 64px time box: a 2-digit hour ("10:00 AM")
    // measures ~64.5px and wrapped inside it. It must not appear here.
    expect(card.querySelector('.w-16')).toBeNull();
  });

  it('keeps the time on ONE line (nowrap, unconstrained width)', () => {
    renderCard();
    const time = screen.getByText('10:00 AM');
    expect(time.className).toMatch(/whitespace-nowrap/);
  });

  it('renders NO status pill — the pill is what overflowed the column', () => {
    renderCard({ status: 'scheduled' });
    // The visible pill label must be absent from the rendered text.
    const card = screen.getByTestId('appt-card-x1');
    const visible = [...card.querySelectorAll('*')]
      .filter((el) => !el.classList.contains('sr-only'))
      .map((el) => el.textContent)
      .join(' ');
    expect(visible).not.toMatch(/Scheduled/);
  });

  it('still exposes the status to assistive tech (sr-only parity)', () => {
    renderCard({ status: 'confirmed' });
    expect(screen.getByTestId('appt-card-x1').querySelector('.sr-only'))
      .toHaveTextContent('Status: confirmed');
  });

  it('truncates the prospect name gracefully rather than squeezing it away', () => {
    renderCard();
    const name = screen.getByText('Kamla Persad-Bissessar');
    expect(name.className).toMatch(/truncate/);
  });

  it('carries a type-toned left rail (status-neutral appointments)', () => {
    renderCard({ type: 'SALE', status: 'scheduled' });
    expect(screen.getByTestId('appt-card-x1').className).toMatch(/border-l-gold/);
  });

  it('lets retired STATUS override the type rail so a tombstone reads as one', () => {
    renderCard({ type: 'SALE', status: 'cancelled' });
    const card = screen.getByTestId('appt-card-x1');
    expect(card.className).toMatch(/border-l-danger/);
    expect(card.className).not.toMatch(/border-l-gold/);
  });

  it('uses the warning rail for postponed tombstones', () => {
    renderCard({ status: 'postponed' });
    expect(screen.getByTestId('appt-card-x1').className).toMatch(/border-l-warning/);
  });

  it('strikes through and dims retired cards (retained-churn grammar preserved)', () => {
    renderCard({ status: 'cancelled' });
    const card = screen.getByTestId('appt-card-x1');
    expect(card.className).toMatch(/opacity-60/);
    expect(screen.getByText('Kamla Persad-Bissessar').className).toMatch(/line-through/);
  });

  it('shows the conflict marker with an accessible name, not a bare glyph', () => {
    renderCard({}, { conflicted: true });
    expect(screen.getByLabelText('Overlaps another appointment')).toBeInTheDocument();
  });

  it('supports selection mode with a compact checkbox', () => {
    renderCard({}, { selectMode: true, selected: true, onToggleSelect: vi.fn() });
    expect(screen.getByTestId('appt-select-x1')).toBeInTheDocument();
    expect(screen.getByTestId('appt-card-x1')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not offer selection on a retired card (bulk ops target live only)', () => {
    renderCard({ status: 'cancelled' }, { selectMode: true, onToggleSelect: vi.fn() });
    expect(screen.queryByTestId('appt-select-x1')).toBeNull();
  });
});

describe('AppointmentCard — roomy variant keeps its status pill', () => {
  it('renders the pill, now shrink-0 so it cannot overflow a narrow column', () => {
    render(
      <AppointmentCard
        appt={base}
        prospectName="Anand Maharaj"
        onChurn={vi.fn()}
        resolveAppt={() => null}
        conflicted={false}
      />,
    );
    const card = screen.getByTestId('appt-card-x1');
    expect(card).not.toHaveAttribute('data-dense');
    const pill = screen.getByText('Scheduled');
    expect(pill.className).toMatch(/shrink-0/);
  });
});
