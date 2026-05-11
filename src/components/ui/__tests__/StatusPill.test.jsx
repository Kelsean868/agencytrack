// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPill from '../StatusPill.jsx';

describe('StatusPill — rendering', () => {
  it('renders its label text', () => {
    render(<StatusPill variant="success" label="Submitted" />);
    expect(screen.getByText('Submitted')).toBeInTheDocument();
  });

  it('is a <span>', () => {
    const { container } = render(<StatusPill variant="muted" label="Draft" />);
    expect(container.firstChild.tagName).toBe('SPAN');
  });
});

describe('StatusPill — variants', () => {
  it('success → success color classes', () => {
    const { container } = render(<StatusPill variant="success" label="OK" />);
    expect(container.firstChild).toHaveClass('text-success');
    expect(container.firstChild).toHaveClass('bg-success/15');
  });

  it('warning → warning color classes', () => {
    const { container } = render(<StatusPill variant="warning" label="Warn" />);
    expect(container.firstChild).toHaveClass('text-warning');
    expect(container.firstChild).toHaveClass('bg-warning/15');
  });

  it('muted → border/muted color classes', () => {
    const { container } = render(<StatusPill variant="muted" label="N/A" />);
    expect(container.firstChild).toHaveClass('text-ink-muted');
    expect(container.firstChild).toHaveClass('bg-border/60');
  });

  it('danger → danger color classes', () => {
    const { container } = render(<StatusPill variant="danger" label="Error" />);
    expect(container.firstChild).toHaveClass('text-danger');
    expect(container.firstChild).toHaveClass('bg-danger/15');
  });

  it('primary → primary color classes', () => {
    const { container } = render(<StatusPill variant="primary" label="Active" />);
    expect(container.firstChild).toHaveClass('text-primary');
    expect(container.firstChild).toHaveClass('bg-primary/10');
  });

  it('unknown variant falls back to muted', () => {
    const { container } = render(<StatusPill variant="unknown_xyz" label="?" />);
    expect(container.firstChild).toHaveClass('text-ink-muted');
  });

  it('default variant is muted when omitted', () => {
    const { container } = render(<StatusPill label="Default" />);
    expect(container.firstChild).toHaveClass('text-ink-muted');
  });
});

describe('StatusPill — icon', () => {
  it('renders icon when provided', () => {
    const { container } = render(
      <StatusPill variant="success" label="Qualified" icon={<span data-testid="check-icon" />} />
    );
    expect(container.querySelector('[data-testid="check-icon"]')).toBeInTheDocument();
    expect(screen.getByText('Qualified')).toBeInTheDocument();
  });

  it('renders without icon when omitted', () => {
    const { container } = render(<StatusPill variant="primary" label="Active" />);
    expect(container.firstChild.children.length).toBe(0);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('StatusPill — className', () => {
  it('appends custom className', () => {
    const { container } = render(<StatusPill variant="muted" label="X" className="ring-2" />);
    expect(container.firstChild).toHaveClass('ring-2');
  });
});
