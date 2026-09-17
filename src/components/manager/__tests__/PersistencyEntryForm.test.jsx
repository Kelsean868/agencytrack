import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted mock state.
const hoisted = vi.hoisted(() => ({
  savePersistency: vi.fn(),
}));

vi.mock('../../../services/persistencyService', () => ({
  savePersistency: hoisted.savePersistency,
}));

import PersistencyEntryForm from '../PersistencyEntryForm';

const RICARDO = {
  businessPlaced: 357468.84,
  notTakens: 0,
  incPPPs: 48000,
  lumpsums100: 8666.90,
  lapses: 133600.08,
  reinstatements: 27662.28,
};

const EXISTING_RECORD = {
  businessPlaced: 200000,
  notTakens: 5000,
  incPPPs: 10000,
  lumpsums100: 3000,
  lapses: 50000,
  reinstatements: 12000,
};

function fillRicardo() {
  for (const [field, value] of Object.entries(RICARDO)) {
    const input = screen.getByTestId(`persistency-input-${field}`);
    fireEvent.change(input, { target: { value: String(value) } });
  }
}

const DEFAULT_PROPS = {
  tenantId: 't1',
  monthKey: '2026-02',
  agentUid: 'agent-1',
  agentName: 'Ricardo Duke',
  existingRecord: null,
  writerRole: 'branch_manager',
  writerUid: 'writer-1',
  onClose: () => {},
  onSaved: () => {},
};

describe('PersistencyEntryForm', () => {
  beforeEach(() => {
    hoisted.savePersistency.mockReset();
  });

  it('renders as a right-side drawer with dialog role', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-entry-form')).toBeInTheDocument();
  });

  it('shows the gold precedence banner with agent name and month', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    const banner = screen.getByTestId('pers-precedence-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Ricardo Duke');
    expect(banner).toHaveTextContent('February');
    expect(banner).toHaveTextContent('read-only');
  });

  it('renders the six TTD inputs', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('persistency-input-businessPlaced')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-notTakens')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-incPPPs')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-lumpsums100')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-lapses')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-input-reinstatements')).toBeInTheDocument();
  });

  it('prefills inputs when existingRecord is provided (prefill arm)', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} existingRecord={EXISTING_RECORD} />);
    expect(screen.getByTestId('persistency-input-businessPlaced')).toHaveValue(200000);
    expect(screen.getByTestId('persistency-input-lapses')).toHaveValue(50000);
    expect(screen.getByTestId('persistency-input-reinstatements')).toHaveValue(12000);
  });

  it('renders empty inputs when existingRecord is null (empty arm)', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} existingRecord={null} />);
    expect(screen.getByTestId('persistency-input-businessPlaced')).toHaveValue(null);
    expect(screen.getByTestId('persistency-input-lapses')).toHaveValue(null);
  });

  it('updates the derived preview as inputs change (Ricardo Duke validation)', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    fillRicardo();
    // Derived persistency should match the Tatil Feb 2026 figure (73.9% rounded
    // to one decimal in the form preview).
    const persText = screen.getByTestId('derived-persistency').textContent;
    expect(persText).toMatch(/73\.9%/);
  });

  it('disables save until all six inputs are populated', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /save.*lock/i })).toBeDisabled();
    fillRicardo();
    expect(screen.getByRole('button', { name: /save.*lock/i })).not.toBeDisabled();
  });

  it('save button label includes month name', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /save.*lock.*February/i })).toBeInTheDocument();
  });

  it('shows the award-gate copy templated on PERS_GATE_PCT, not a hardcoded literal', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} />);
    for (const [field, value] of Object.entries({
      businessPlaced: 1000000, notTakens: 0, incPPPs: 0, lumpsums100: 0,
      lapses: 50000, reinstatements: 10000, // -> persistency 0.96, >= PERS_GATE
    })) {
      fireEvent.change(screen.getByTestId(`persistency-input-${field}`), {
        target: { value: String(value) },
      });
    }
    expect(screen.getByText('Meets 90% award gate')).toBeInTheDocument();
  });

  it('calls savePersistency with monthKey + agentUid + numeric inputs + role', async () => {
    const onSaved = vi.fn();
    hoisted.savePersistency.mockResolvedValueOnce(undefined);

    render(<PersistencyEntryForm {...DEFAULT_PROPS} onSaved={onSaved} />);
    fillRicardo();
    fireEvent.click(screen.getByRole('button', { name: /save.*lock/i }));

    await waitFor(() => expect(hoisted.savePersistency).toHaveBeenCalledTimes(1));
    const [tenantId, monthKey, agentUid, inputs, role] = hoisted.savePersistency.mock.calls[0];
    expect(tenantId).toBe('t1');
    expect(monthKey).toBe('2026-02');
    expect(agentUid).toBe('agent-1');
    expect(role).toBe('branch_manager');
    expect(inputs.businessPlaced).toBe(RICARDO.businessPlaced);
    expect(inputs.lumpsums100).toBe(RICARDO.lumpsums100);
    expect(onSaved).toHaveBeenCalled();
  });

  it('surfaces save error inline without closing the form', async () => {
    hoisted.savePersistency.mockRejectedValueOnce(new Error('Permission denied'));

    render(<PersistencyEntryForm {...DEFAULT_PROPS} writerRole="agent" />);
    fillRicardo();
    fireEvent.click(screen.getByRole('button', { name: /save.*lock/i }));

    await waitFor(() => expect(screen.getByText(/Permission denied/i)).toBeInTheDocument());
    // form still rendered
    expect(screen.getByTestId('persistency-entry-form')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<PersistencyEntryForm {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<PersistencyEntryForm {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Month-aware model (Tatil memo of 29 Aug 2026)
//
// The form asks for what the MONTH's model requires, not a fixed six. August
// 2026 is the last legacy month; September 2026 is the first 24-month month.
// -----------------------------------------------------------------------------

const AUG_PROPS = { ...DEFAULT_PROPS, monthKey: '2026-08' };
const SEP_PROPS = { ...DEFAULT_PROPS, monthKey: '2026-09' };

describe('PersistencyEntryForm — legacy month (2026-08)', () => {
  beforeEach(() => { hoisted.savePersistency.mockReset(); });

  it('renders exactly the six legacy inputs and no decreases field', () => {
    render(<PersistencyEntryForm {...AUG_PROPS} />);
    for (const f of ['businessPlaced', 'notTakens', 'incPPPs', 'lumpsums100', 'lapses', 'reinstatements']) {
      expect(screen.getByTestId('persistency-input-' + f), f).toBeInTheDocument();
    }
    expect(screen.queryByTestId('persistency-input-decreases')).not.toBeInTheDocument();
    expect(screen.getByTestId('persistency-inputs-legacy12')).toBeInTheDocument();
  });

  it('keeps the pre-memo labels on a legacy month', () => {
    render(<PersistencyEntryForm {...AUG_PROPS} />);
    expect(screen.getByText(/Business Placed/)).toBeInTheDocument();
    expect(screen.getByText(/Inc PPPs/)).toBeInTheDocument();
  });

  it('labels the derived denominator "Gross Settled" on a legacy month', () => {
    render(<PersistencyEntryForm {...AUG_PROPS} />);
    const preview = screen.getByTestId('persistency-derived-preview');
    expect(preview).toHaveTextContent('Gross Settled');
    expect(preview).not.toHaveTextContent('Net Gross Settled');
  });
});

describe('PersistencyEntryForm — 24-month model month (2026-09)', () => {
  beforeEach(() => { hoisted.savePersistency.mockReset(); });

  it('renders a seventh input for decreases', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    expect(screen.getByTestId('persistency-input-decreases')).toBeInTheDocument();
    expect(screen.getByTestId('persistency-inputs-tatil24')).toBeInTheDocument();
  });

  it('adopts the memo vocabulary for the inputs', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    expect(screen.getByText(/Decreases/)).toBeInTheDocument();
    expect(screen.getByText(/Increases/)).toBeInTheDocument();
    // "Inc PPPs" is retired vocabulary from September onwards.
    expect(screen.queryByText(/Inc PPPs/)).not.toBeInTheDocument();
  });

  it('renames the derived denominator to "Net Gross Settled"', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    expect(screen.getByTestId('persistency-derived-preview'))
      .toHaveTextContent('Net Gross Settled');
  });

  it('drops every "12-month" claim from the help copy', () => {
    const { container } = render(<PersistencyEntryForm {...SEP_PROPS} />);
    expect(container.textContent).not.toMatch(/12[- ]?month/i);
    expect(container.textContent).toMatch(/24-month period/);
  });

  it('will not save until decreases is filled', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    fillRicardo(); // the six legacy figures only
    fireEvent.submit(screen.getByTestId('persistency-entry-form').querySelector('form'));
    expect(hoisted.savePersistency).not.toHaveBeenCalled();
    expect(screen.getByText(/Decreases is required/i)).toBeInTheDocument();
  });

  it('passes decreases through to savePersistency once filled', async () => {
    hoisted.savePersistency.mockResolvedValueOnce(undefined);
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    fillRicardo();
    fireEvent.change(screen.getByTestId('persistency-input-decreases'), {
      target: { value: '12000' },
    });
    fireEvent.submit(screen.getByTestId('persistency-entry-form').querySelector('form'));

    await waitFor(() => expect(hoisted.savePersistency).toHaveBeenCalledTimes(1));
    const [, monthKey, , inputs] = hoisted.savePersistency.mock.calls[0];
    expect(monthKey).toBe('2026-09');
    expect(inputs.decreases).toBe(12000);
  });

  it('subtracts decreases from the live derived preview', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    fillRicardo();
    const before = screen.getByTestId('derived-gross').textContent;
    fireEvent.change(screen.getByTestId('persistency-input-decreases'), {
      target: { value: '100000' },
    });
    expect(screen.getByTestId('derived-gross').textContent).not.toBe(before);
  });

  // P1b P-D10 — the negative-denominator guard shown inline, without a round-trip.
  it('shows the negative-denominator message inline once decreases outruns gross settled', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    fillRicardo(); // businessPlaced 357468.84 and friends
    fireEvent.change(screen.getByTestId('persistency-input-decreases'), {
      target: { value: '5000000' }, // far larger than businessPlaced -> negative gross
    });
    expect(screen.getByTestId('negative-denominator-warning')).toHaveTextContent(
      'Net Gross Settled is negative — check Decreases against Gross Settled.',
    );
  });

  it('disables save while the derived denominator is negative, and never calls savePersistency', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    fillRicardo();
    fireEvent.change(screen.getByTestId('persistency-input-decreases'), {
      target: { value: '5000000' },
    });
    fireEvent.submit(screen.getByTestId('persistency-entry-form').querySelector('form'));
    expect(hoisted.savePersistency).not.toHaveBeenCalled();
    // Both the proactive inline message and the post-submit error box render the
    // same text, so two matches is the expected (not ambiguous) outcome here.
    expect(screen.getAllByText(/Net Gross Settled is negative/i).length).toBeGreaterThan(0);
  });

  it('accepts a zero derived denominator (decreases exactly offsetting gross) with no warning', () => {
    render(<PersistencyEntryForm {...SEP_PROPS} />);
    // All-integer inputs so grossSettled lands on exactly 0, not a float-epsilon
    // sliver either side of it: 100000 - 0 - 100000 + 0 + 0*0.1 = 0.
    for (const [field, value] of Object.entries({
      businessPlaced: 100000, notTakens: 0, incPPPs: 0, lumpsums100: 0,
      lapses: 0, reinstatements: 0, decreases: 100000,
    })) {
      fireEvent.change(screen.getByTestId(`persistency-input-${field}`), {
        target: { value: String(value) },
      });
    }
    expect(screen.queryByTestId('negative-denominator-warning')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save.*lock/i })).not.toBeDisabled();
  });
});

describe('PersistencyEntryForm — render guard', () => {
  // No month, no form. The alternative would be guessing a model and showing
  // the wrong month's fields, which on a money surface is worse than nothing.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['malformed', '2026/09'],
  ])('renders nothing for a %s monthKey instead of throwing', (_label, monthKey) => {
    const { container } = render(
      <PersistencyEntryForm {...DEFAULT_PROPS} monthKey={monthKey} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ── P3 fix 1: the lock banner is addressed to whoever is entering ───────────
// The manager copy says "your figures override THEIR self-entry", which is
// simply false when the agent is entering their own month. Keyed on
// writerUid === agentUid, not on role, so a PRODUCING MANAGER entering their
// own persistency also gets the self wording.
describe('PersistencyEntryForm — lock banner copy (self vs manager)', () => {
  it('SELF entry: says the month locks, with no third party', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} agentUid="agent-1" writerUid="agent-1" agentName="You" />);

    const self = screen.getByTestId('pers-lock-copy-self');
    expect(self).toBeTruthy();
    expect(self.textContent).toMatch(/Saving locks February\./);
    expect(self.textContent).toMatch(/You can't edit it after saving\./);
    // The manager sentence must be absent entirely.
    expect(screen.queryByTestId('pers-lock-copy-manager')).toBeNull();
    expect(self.textContent).not.toMatch(/override/i);
    expect(self.textContent).not.toMatch(/their self-entry/i);
  });

  it('MANAGER entry: keeps the override wording and names the agent', () => {
    render(<PersistencyEntryForm {...DEFAULT_PROPS} agentUid="agent-1" writerUid="manager-9" />);

    const mgr = screen.getByTestId('pers-lock-copy-manager');
    expect(mgr).toBeTruthy();
    expect(mgr.textContent).toMatch(/Saving locks February for Ricardo Duke\./);
    expect(mgr.textContent).toMatch(/override their self-entry/i);
    expect(screen.queryByTestId('pers-lock-copy-self')).toBeNull();
  });

  it('a PRODUCING MANAGER entering their OWN month gets the self wording', () => {
    // Role would say "manager"; the uid says "this is her own month".
    render(
      <PersistencyEntryForm
        {...DEFAULT_PROPS}
        agentUid="um-7"
        writerUid="um-7"
        writerRole="unit_manager"
      />,
    );
    expect(screen.getByTestId('pers-lock-copy-self')).toBeTruthy();
    expect(screen.queryByTestId('pers-lock-copy-manager')).toBeNull();
  });

  it('falls back to the MANAGER wording when writerUid is absent', () => {
    // Failing this way round is deliberate: the manager copy is merely verbose
    // if shown to the wrong person, whereas the self copy would be a false
    // statement about somebody else's month.
    render(<PersistencyEntryForm {...DEFAULT_PROPS} agentUid="agent-1" writerUid={null} />);
    expect(screen.getByTestId('pers-lock-copy-manager')).toBeTruthy();
    expect(screen.queryByTestId('pers-lock-copy-self')).toBeNull();
  });
});
