// @vitest-environment jsdom
//
// Track J retirement R1 — StepApproachesInterviews (step 6) component test.
// Proves the v2 extraction renders the same fields + writes the same state
// keys as the legacy Step3Approaches it replaces.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StepApproachesInterviews from '../StepApproachesInterviews';

const FIELDS = [
  ['Qualified Approaches', 'qualifiedApproaches'],
  ['Appointments Set', 'appointmentsSet'],
  ['FFIs Scheduled', 'ffisScheduled'],
  ['FFIs Conducted', 'ffiConducted'],
  ['Solution Presentations', 'solutionPresentations'],
];

describe('StepApproachesInterviews — fields + on-change parity', () => {
  it('renders all 5 approach/FFI/presentation fields', () => {
    render(<StepApproachesInterviews data={{}} onChange={vi.fn()} />);
    for (const [label] of FIELDS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('writes the correct persisted key for each field on change', () => {
    for (const [label, key] of FIELDS) {
      const onChange = vi.fn();
      const { unmount } = render(<StepApproachesInterviews data={{}} onChange={onChange} />);
      fireEvent.change(screen.getByLabelText(label), { target: { value: '7' } });
      expect(onChange).toHaveBeenCalledWith(key, 7);
      unmount();
    }
  });

  it('renders the qualifying-criteria checklist (3 items)', () => {
    render(<StepApproachesInterviews data={{}} onChange={vi.fn()} />);
    expect(screen.getByText(/identifiable insurance need/)).toBeInTheDocument();
    expect(screen.getByText(/afford the premiums/)).toBeInTheDocument();
    expect(screen.getByText(/likely to be approved/)).toBeInTheDocument();
  });
});
