// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ObjectionRehearsal from '../ObjectionRehearsal';
import ApptBadge from '../ApptBadge';

describe('ObjectionRehearsal — rehearsal aid', () => {
  it('renders nothing for an empty / non-array objections list', () => {
    const { container } = render(<ObjectionRehearsal objections={[]} />);
    expect(container).toBeEmptyDOMElement();
    const { container: c2 } = render(<ObjectionRehearsal objections={undefined} />);
    expect(c2).toBeEmptyDOMElement();
  });

  it('expands a matched objection to label + meaning + counter', () => {
    render(<ObjectionRehearsal objections={['no-money']} />);
    expect(screen.getByTestId('objection-expanded')).toBeInTheDocument();
    expect(screen.getByText('No Money')).toBeInTheDocument();
    expect(screen.getByText(/room in the budget/i)).toBeInTheDocument();
    expect(screen.getByText(/smaller starter premium/i)).toBeInTheDocument();
    expect(screen.getByText(/Rehearse the Objections · 1/i)).toBeInTheDocument();
  });

  it('renders unmatched labels as a plain chip (honest fallback)', () => {
    render(<ObjectionRehearsal objections={['some-legacy-objection']} />);
    expect(screen.getByTestId('objection-plain')).toHaveTextContent('some-legacy-objection');
    expect(screen.queryByTestId('objection-expanded')).not.toBeInTheDocument();
  });

  it('mixes matched (expanded) and unmatched (plain) in one list', () => {
    render(<ObjectionRehearsal objections={['no-hurry', 'unknown-x']} />);
    expect(screen.getAllByTestId('objection-expanded')).toHaveLength(1);
    expect(screen.getByTestId('objection-plain')).toHaveTextContent('unknown-x');
  });
});

describe('ApptBadge — countdown chip', () => {
  it('renders TODAY label for a same-day appointment', () => {
    render(<ApptBadge intendedDate="2026-07-09" today="2026-07-09" />);
    expect(screen.getByTestId('appt-badge')).toHaveTextContent('TODAY');
  });

  it('renders overdue framing for a past appointment', () => {
    render(<ApptBadge intendedDate="2026-07-04" today="2026-07-09" />);
    expect(screen.getByTestId('appt-badge')).toHaveTextContent('5 DAYS AGO');
  });

  it('renders nothing for an unparseable date', () => {
    const { container } = render(<ApptBadge intendedDate="" today="2026-07-09" />);
    expect(container).toBeEmptyDOMElement();
  });
});
