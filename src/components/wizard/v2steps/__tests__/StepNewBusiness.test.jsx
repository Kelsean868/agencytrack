// @vitest-environment jsdom
//
// Track J retirement R1 — StepNewBusiness (step 7) component test.
// Proves the v2 extraction of legacy Step4ClosingSales:
//   - renders the same fields + nested-object on-change writers,
//   - preserves suggestedCiConducted (newCIBooked + oldCIBooked),
//   - preserves the collapse-state for PPP + Lumpsum,
//   - FIXES the duplicate id="apps" — every input now has a UNIQUE id
//     (the MEDIUM duplicate-id FU proof).

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StepNewBusiness from '../StepNewBusiness';

vi.mock('../../../../utils/formatters', () => ({
  formatCurrency: (v) => `TTD ${Math.round(Number(v) || 0).toLocaleString('en-US')}`,
}));

describe('StepNewBusiness — Closing Interviews + suggested CI', () => {
  it('writes newCIBooked / oldCIBooked directly', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('New CIs Booked'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith('newCIBooked', 3);
    fireEvent.change(screen.getByLabelText('Old CIs Booked'), { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('oldCIBooked', 2);
  });

  it('suggestedCiConducted = newCIBooked + oldCIBooked', () => {
    render(<StepNewBusiness data={{ newCIBooked: 3, oldCIBooked: 2 }} onChange={vi.fn()} />);
    expect(screen.getByText(/Suggested: 5/)).toBeInTheDocument();
  });

  it('ciConducted writes directly via onChange', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('CIs Conducted'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('ciConducted', 4);
  });
});

describe('StepNewBusiness — New Business nested-object writer', () => {
  it('Applications Written writes newBusiness.apps (nested spread)', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{ newBusiness: { apps: 0, api: 5000 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Applications Written'), { target: { value: '2' } });
    // nbChange spreads the existing nested object + sets the field.
    expect(onChange).toHaveBeenCalledWith('newBusiness', { apps: 2, api: 5000 });
  });

  it('API writes newBusiness.api (nested spread, preserves apps)', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{ newBusiness: { apps: 2, api: 0 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('API (TTD)'), { target: { value: '10000' } });
    expect(onChange).toHaveBeenCalledWith('newBusiness', { apps: 2, api: 10000 });
  });

  it('Lives Sold writes livesSold directly', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Lives Sold'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('livesSold', 4);
  });
});

describe('StepNewBusiness — PPP + Lumpsum collapse state + writers', () => {
  it('PPP starts collapsed when no PPP data; expands on CTA', () => {
    render(<StepNewBusiness data={{}} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Number of PPP increases')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add PPP details/ }));
    expect(screen.getByLabelText('Number of PPP increases')).toBeInTheDocument();
  });

  it('PPP starts expanded when pre-existing PPP data', () => {
    render(<StepNewBusiness data={{ pppIncreases: { apps: 1, apiIncrease: 3000 } }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Number of PPP increases')).toBeInTheDocument();
  });

  it('PPP apps writes pppIncreases.apps (nested spread)', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{ pppIncreases: { apps: 0, apiIncrease: 3000 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Number of PPP increases'), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith('pppIncreases', { apps: 1, apiIncrease: 3000 });
  });

  it('Lumpsum starts collapsed; expands on CTA; grossAmount writes nested', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{}} onChange={onChange} />);
    expect(screen.queryByLabelText('Gross lumpsum amount (TTD)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add lumpsum details/ }));
    fireEvent.change(screen.getByLabelText('Gross lumpsum amount (TTD)'), { target: { value: '50000' } });
    expect(onChange).toHaveBeenCalledWith('lumpsums', { grossAmount: 50000 });
  });

  it('removePPP resets pppIncreases to zeros + collapses', () => {
    const onChange = vi.fn();
    render(<StepNewBusiness data={{ pppIncreases: { apps: 1, apiIncrease: 3000 } }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onChange).toHaveBeenCalledWith('pppIncreases', { apps: 0, apiIncrease: 0 });
  });
});

describe('StepNewBusiness — duplicate-id FIX (MEDIUM FU proof)', () => {
  it('every rendered input has a UNIQUE id (no duplicate id="apps")', () => {
    const { container } = render(
      <StepNewBusiness
        data={{
          pppIncreases: { apps: 1, apiIncrease: 3000 }, // force PPP expanded
          lumpsums: { grossAmount: 50000 },             // force Lumpsum expanded
        }}
        onChange={vi.fn()}
      />
    );
    const ids = Array.from(container.querySelectorAll('input[id]')).map((el) => el.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);            // zero duplicates
    expect(ids).toContain('newBusinessApps');
    expect(ids).toContain('pppApps');
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it('NB apps + PPP apps inputs have distinct ids (the collision is gone)', () => {
    render(
      <StepNewBusiness
        data={{ pppIncreases: { apps: 1, apiIncrease: 3000 } }}
        onChange={vi.fn()}
      />
    );
    const nbApps = screen.getByLabelText('Applications Written');
    const pppApps = screen.getByLabelText('Number of PPP increases');
    expect(nbApps.id).toBe('newBusinessApps');
    expect(pppApps.id).toBe('pppApps');
    expect(nbApps.id).not.toBe(pppApps.id);
  });
});

afterEach(() => cleanup());
