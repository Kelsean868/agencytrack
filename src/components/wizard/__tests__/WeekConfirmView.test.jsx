// @vitest-environment jsdom
//
// Q3 — WeekConfirmView component tests.
//
// Suites:
//   A — deriveSections  (pure function, no mount)
//   B — render: sections, provenance labels, collapsed summary
//   C — edit mode: Edit button → stepper rows appear, Done collapses
//   D — onEditField: stepper interactions call the prop callback

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (n) => `TTD ${n}`,
}));

import WeekConfirmView from '../WeekConfirmView';
import { deriveSections } from '../WeekConfirmView.helpers';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DRAFT_EMPTY = {
  version: 2,
  aggregatedFromDaily: true,
  daysWorked: 0,
  newBusiness: { apps: 0, api: 0 },
  pppIncreases: { apps: 0, apiIncrease: 0 },
  lumpsums: { grossAmount: 0, apiCredit: 0, commission: 0 },
  socialPlatformBreakdown: { facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 },
};

const DRAFT_PARTIAL = {
  ...DRAFT_EMPTY,
  daysWorked: 3,
  dials: 25,
  qualifiedApproaches: 10,
  appointmentsSet: 4,
  ffiConducted: 2,
  ciConducted: 1,
  newBusiness: { apps: 1, api: 5000 },
  policiesDelivered: 2,
  officeHours: 4.5,
  fieldHours: 3,
};

// ── Suite A — deriveSections (pure function) ──────────────────────────────────

describe('A — deriveSections', () => {
  it('returns 7 sections in the expected order', () => {
    const s = deriveSections(DRAFT_PARTIAL);
    expect(s).toHaveLength(7);
    expect(s.map((x) => x.id)).toEqual([
      'prospecting', 'social', 'appointments', 'interviews',
      'production', 'delivery', 'hours',
    ]);
  });

  it('each section carries daysWorked as provenanceCount', () => {
    const s = deriveSections(DRAFT_PARTIAL);
    s.forEach((sec) => expect(sec.provenanceCount).toBe(3));
  });

  it('provenanceCount is 0 for an empty draft', () => {
    const s = deriveSections(DRAFT_EMPTY);
    s.forEach((sec) => expect(sec.provenanceCount).toBe(0));
  });

  it('draft=null / undefined returns 7 sections with 0 provenance', () => {
    expect(deriveSections(null)).toHaveLength(7);
    expect(deriveSections(undefined)).toHaveLength(7);
    deriveSections(null).forEach((s) => expect(s.provenanceCount).toBe(0));
  });

  it('prospecting section rows include dials and maps namesFromOther correctly', () => {
    const draft = { ...DRAFT_EMPTY, daysWorked: 5, dials: 30, namesFromOther: 8 };
    const prospecting = deriveSections(draft).find((s) => s.id === 'prospecting');
    const dialsRow  = prospecting.rows.find((r) => r.key === 'dials');
    const namesRow  = prospecting.rows.find((r) => r.key === 'namesFromOther');
    expect(dialsRow.value).toBe(30);
    expect(namesRow.value).toBe(8);
  });

  it('production section rows carry unit=TTD for api / apiIncrease / grossAmount', () => {
    const prod = deriveSections(DRAFT_PARTIAL).find((s) => s.id === 'production');
    expect(prod.rows.find((r) => r.key === 'newBusiness.api').unit).toBe('TTD');
    expect(prod.rows.find((r) => r.key === 'pppIncreases.apiIncrease').unit).toBe('TTD');
    expect(prod.rows.find((r) => r.key === 'lumpsums.grossAmount').unit).toBe('TTD');
  });

  it('hours section rows carry unit=h', () => {
    const hours = deriveSections(DRAFT_PARTIAL).find((s) => s.id === 'hours');
    expect(hours.rows.find((r) => r.key === 'officeHours').unit).toBe('h');
    expect(hours.rows.find((r) => r.key === 'fieldHours').unit).toBe('h');
    expect(hours.rows.find((r) => r.key === 'officeHours').value).toBe(4.5);
    expect(hours.rows.find((r) => r.key === 'fieldHours').value).toBe(3);
  });

  it('social section maps platform breakdown keys with dot-notation', () => {
    const social = deriveSections({ ...DRAFT_EMPTY, daysWorked: 1, socialPlatformBreakdown: { facebook: 5, instagram: 2, whatsapp: 0, linkedin: 1 } }).find((s) => s.id === 'social');
    const fbRow = social.rows.find((r) => r.key === 'socialPlatformBreakdown.facebook');
    expect(fbRow.value).toBe(5);
    expect(social.rows.find((r) => r.key === 'socialPlatformBreakdown.linkedin').value).toBe(1);
  });
});

// ── Suite B — render: sections and provenance ─────────────────────────────────

describe('B — render: sections, provenance, collapsed summary', () => {
  let sections;

  beforeEach(() => {
    sections = deriveSections(DRAFT_PARTIAL);
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={vi.fn()}
        variant="mobile"
      />,
    );
  });

  it('renders a card for each section', () => {
    ['prospecting', 'social', 'appointments', 'interviews', 'production', 'delivery', 'hours'].forEach(
      (id) => expect(screen.getByTestId(`wcv-section-${id}`)).toBeInTheDocument(),
    );
  });

  it('shows correct section labels', () => {
    expect(screen.getByText('Prospecting & outreach')).toBeInTheDocument();
    expect(screen.getByText('Social & content')).toBeInTheDocument();
    expect(screen.getByText('Appointments & FFI')).toBeInTheDocument();
    expect(screen.getByText('Interviews')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Delivery & service')).toBeInTheDocument();
    expect(screen.getByText('Hours')).toBeInTheDocument();
  });

  it('renders provenance as "✓ from daily ×N" for each section', () => {
    const provNodes = screen.getAllByTestId(/^wcv-section-.+-provenance$/);
    provNodes.forEach((node) => {
      expect(node.textContent).toMatch(/✓ from daily ×3/);
    });
  });

  it('collapsed section shows non-zero values as summary', () => {
    // dials: 25 — prospecting section
    expect(screen.getByText('25')).toBeInTheDocument();
    // ffiConducted: 2 and policiesDelivered: 2 both appear (multiple matches expected)
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('collapsed section with no activity shows "No activity logged"', () => {
    // social section: all zeros in DRAFT_PARTIAL
    const socialCard = screen.getByTestId('wcv-section-social');
    expect(socialCard.textContent).toContain('No activity logged');
  });

  it('data-variant attribute reflects the variant prop', () => {
    expect(screen.getByTestId('week-confirm-view').dataset.variant).toBe('mobile');
  });

  it('each section has an Edit button in collapsed state', () => {
    const editBtns = screen.getAllByRole('button', { name: /^Edit /i });
    expect(editBtns).toHaveLength(7);
  });
});

// ── Suite C — edit mode ───────────────────────────────────────────────────────

describe('C — edit mode: expand / collapse via Edit / Done', () => {
  it('clicking Edit on a section shows its stepper fields', () => {
    const sections = deriveSections(DRAFT_PARTIAL);
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={vi.fn()}
      />,
    );

    const editBtn = screen.getByTestId('wcv-section-appointments-edit');
    fireEvent.click(editBtn);

    // Edit mode: the field rows container renders
    expect(screen.getByTestId('wcv-section-appointments-fields')).toBeInTheDocument();
    // Stepper buttons visible for "Appointments set"
    expect(screen.getByRole('button', { name: 'Appointments set increase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Appointments set decrease' })).toBeInTheDocument();
  });

  it('Edit button becomes Done while section is being edited', () => {
    const sections = deriveSections(DRAFT_PARTIAL);
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    const doneBtn = screen.getByTestId('wcv-section-appointments-edit');
    expect(doneBtn.textContent).toContain('Done');
    expect(doneBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking Done collapses the section back to summary view', () => {
    const sections = deriveSections(DRAFT_PARTIAL);
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    expect(screen.getByTestId('wcv-section-appointments-fields')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    expect(screen.queryByTestId('wcv-section-appointments-fields')).toBeNull();
  });

  it('only one section can be in edit mode at a time', () => {
    const sections = deriveSections(DRAFT_PARTIAL);
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    expect(screen.getByTestId('wcv-section-appointments-fields')).toBeInTheDocument();

    // Open a different section — appointments should close
    fireEvent.click(screen.getByTestId('wcv-section-prospecting-edit'));
    expect(screen.queryByTestId('wcv-section-appointments-fields')).toBeNull();
    expect(screen.getByTestId('wcv-section-prospecting-fields')).toBeInTheDocument();
  });
});

// ── Suite D — onEditField callback ────────────────────────────────────────────

describe('D — onEditField: stepper interactions', () => {
  it('+ button on an integer field calls onEditField with key + incremented value', () => {
    const onEditField = vi.fn();
    const sections = deriveSections(DRAFT_PARTIAL); // appointmentsSet: 4
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={onEditField}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Appointments set increase' }));

    expect(onEditField).toHaveBeenCalledWith('appointmentsSet', 5);
  });

  it('− button on an integer field calls onEditField with decremented value', () => {
    const onEditField = vi.fn();
    const sections = deriveSections(DRAFT_PARTIAL); // appointmentsSet: 4
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={onEditField}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Appointments set decrease' }));

    expect(onEditField).toHaveBeenCalledWith('appointmentsSet', 3);
  });

  it('− button is disabled when value is 0 (no negative calls)', () => {
    const onEditField = vi.fn();
    // ffisScheduled: 0 in DRAFT_PARTIAL
    const sections = deriveSections(DRAFT_PARTIAL);
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={onEditField}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    const decrBtn = screen.getByRole('button', { name: 'FFIs scheduled decrease' });
    expect(decrBtn).toBeDisabled();
    fireEvent.click(decrBtn);
    expect(onEditField).not.toHaveBeenCalledWith('ffisScheduled', expect.anything());
  });

  it('+ button on a hours field calls onEditField with step=0.5 increment', () => {
    const onEditField = vi.fn();
    const sections = deriveSections(DRAFT_PARTIAL); // officeHours: 4.5
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={onEditField}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-hours-edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Office hours increase' }));

    expect(onEditField).toHaveBeenCalledWith('officeHours', 5);
  });

  it('TTD field renders MoneyInput with TTD prefix (no stepper buttons)', () => {
    const sections = deriveSections(DRAFT_PARTIAL);
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={sections}
        onEditField={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('wcv-section-production-edit'));
    // MoneyInput uses a TTD prefix span — no increase/decrease buttons for API field
    expect(screen.queryByRole('button', { name: 'API (TTD) increase' })).toBeNull();
    // But TTD prefix should be present
    const ttdSpans = screen.getAllByText('TTD');
    expect(ttdSpans.length).toBeGreaterThan(0);
  });
});

// ── Suite E — Phase 1: onConfirm + carried #696 FUs (a/b/c) ───────────────────

describe('E — onConfirm footer', () => {
  it('renders "Looks good →" and calls onConfirm when provided', () => {
    const onConfirm = vi.fn();
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const btn = screen.getByTestId('week-confirm-next');
    expect(btn.textContent).toMatch(/looks good/i);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('omits the footer button when onConfirm is not provided', () => {
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('week-confirm-next')).toBeNull();
  });
});

describe('E — FU-a: keystroke coercion (partial entry holds while focused)', () => {
  it('a partial decimal ("1.") is held verbatim while focused, not snapped', () => {
    const onEditField = vi.fn();
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={onEditField}
      />,
    );
    fireEvent.click(screen.getByTestId('wcv-section-hours-edit'));
    const input = screen.getByRole('textbox', { name: 'Office hours' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1.' } });
    // Held raw — NOT coerced to "1" (the pre-FU bug stripped the dot every keystroke).
    expect(input.value).toBe('1.');
    expect(onEditField).not.toHaveBeenCalled();
    // Commit on blur → parsed float.
    fireEvent.blur(input);
    expect(onEditField).toHaveBeenCalledWith('officeHours', 1);
  });

  it('clearing the field to empty holds "" while focused (not forced to 0)', () => {
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('wcv-section-hours-edit'));
    const input = screen.getByRole('textbox', { name: 'Office hours' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
  });

  // Type-then-click: the +/- buttons must commit from the live typed draft, not
  // the originally-committed value. Proves bump()'s base() reads the focused
  // draft (DRAFT_PARTIAL.appointmentsSet starts at 4; after typing 7 the bump
  // must operate on 7, not 4).
  it('+ button commits from the typed draft (type 7 → click + → 8)', () => {
    const onEditField = vi.fn();
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={onEditField}
      />,
    );
    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    const input = screen.getByRole('textbox', { name: 'Appointments set' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appointments set increase' }));
    expect(onEditField).toHaveBeenCalledWith('appointmentsSet', 8);
  });

  it('− button commits from the typed draft (type 7 → click − → 6)', () => {
    const onEditField = vi.fn();
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={onEditField}
      />,
    );
    fireEvent.click(screen.getByTestId('wcv-section-appointments-edit'));
    const input = screen.getByRole('textbox', { name: 'Appointments set' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Appointments set decrease' }));
    expect(onEditField).toHaveBeenCalledWith('appointmentsSet', 6);
  });
});

describe('E — FU-b: social platform breakdown expandable', () => {
  it('platform rows are hidden behind a toggle in edit mode until expanded', () => {
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('wcv-section-social-edit'));
    // Aggregate row present; platform stepper hidden initially.
    expect(screen.getByRole('button', { name: 'Posts / content published increase' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Facebook increase' })).toBeNull();
    // Expand → platform steppers appear.
    fireEvent.click(screen.getByTestId('wcv-section-social-expand'));
    expect(screen.getByRole('button', { name: 'Facebook increase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LinkedIn increase' })).toBeInTheDocument();
  });

  it('non-social sections render no platform-breakdown toggle', () => {
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('wcv-section-prospecting-edit'));
    expect(screen.queryByTestId('wcv-section-prospecting-expand')).toBeNull();
  });
});

describe('E — FU-c: edit button active-state', () => {
  it('the edit button gains a distinct active class while editing', () => {
    render(
      <WeekConfirmView
        draft={DRAFT_PARTIAL}
        sections={deriveSections(DRAFT_PARTIAL)}
        onEditField={vi.fn()}
      />,
    );
    const btn = screen.getByTestId('wcv-section-appointments-edit');
    // Inactive: no accent background.
    expect(btn.className).not.toMatch(/bg-primary\/10/);
    fireEvent.click(btn);
    // Active: accent background + border applied.
    expect(btn.className).toMatch(/bg-primary\/10/);
    expect(btn.className).toMatch(/border-primary\/50/);
  });
});
