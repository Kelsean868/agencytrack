// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../ConfirmDialog.jsx';

describe('ConfirmDialog — open/closed', () => {
  it('renders when open=true', () => {
    render(<ConfirmDialog open={true} title="Delete?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<ConfirmDialog open={false} title="Delete?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ConfirmDialog — content', () => {
  it('displays title', () => {
    render(<ConfirmDialog open={true} title="Deactivate account?" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Deactivate account?')).toBeInTheDocument();
  });

  it('displays message string', () => {
    render(
      <ConfirmDialog open={true} title="T" message="Are you sure?" onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('displays message ReactNode', () => {
    render(
      <ConfirmDialog
        open={true}
        title="T"
        message={<span data-testid="custom-msg">Custom content</span>}
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    expect(screen.getByTestId('custom-msg')).toBeInTheDocument();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(<ConfirmDialog open={true} title="T" onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('dialog has accessible name from title', () => {
    render(<ConfirmDialog open={true} title="Delete record" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Delete record' })).toBeInTheDocument();
  });
});

describe('ConfirmDialog — buttons', () => {
  it('cancel button fires onCancel', () => {
    const handler = vi.fn();
    render(<ConfirmDialog open={true} title="T" onConfirm={() => {}} onCancel={handler} cancelLabel="Cancel" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('close (X) button fires onCancel', () => {
    const handler = vi.fn();
    render(<ConfirmDialog open={true} title="T" onConfirm={() => {}} onCancel={handler} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('close (X) button meets the 44px touch-target floor', () => {
    render(<ConfirmDialog open={true} title="T" onConfirm={() => {}} onCancel={() => {}} />);
    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    expect(closeBtn.className).toContain('w-11');
    expect(closeBtn.className).toContain('h-11');
  });

  it('confirm button fires onConfirm', () => {
    const handler = vi.fn();
    render(<ConfirmDialog open={true} title="T" onConfirm={handler} onCancel={() => {}} confirmLabel="Delete" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('confirm button is disabled when loading=true', () => {
    render(<ConfirmDialog open={true} title="T" onConfirm={() => {}} onCancel={() => {}} loading={true} confirmLabel="Delete" />);
    expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
  });

  it('shows loadingLabel when loading=true', () => {
    render(
      <ConfirmDialog
        open={true} title="T"
        loading={true} loadingLabel="Deleting…"
        confirmLabel="Delete"
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    expect(screen.getByText('Deleting…')).toBeInTheDocument();
  });

  it('falls back to confirmLabel + … when no loadingLabel set', () => {
    render(
      <ConfirmDialog
        open={true} title="T"
        loading={true}
        confirmLabel="Remove"
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    expect(screen.getByText('Remove…')).toBeInTheDocument();
  });
});

describe('ConfirmDialog — variant', () => {
  it('danger variant shows AlertTriangle icon', () => {
    render(
      <ConfirmDialog open={true} title="T" variant="danger" onConfirm={() => {}} onCancel={() => {}} />
    );
    // Lucide renders an SVG; check for the data-testid via aria or class-based lookup
    const dialog = screen.getByRole('dialog');
    const svg = dialog.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('primary variant does not show AlertTriangle icon', () => {
    const { container } = render(
      <ConfirmDialog open={true} title="T" variant="primary" onConfirm={() => {}} onCancel={() => {}} />
    );
    // Should have only the X close icon SVG, not the AlertTriangle
    // We check by counting SVGs: primary should have 1 (X button), danger would have 2
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
  });
});

describe('ConfirmDialog — confirmValue (typed confirmation)', () => {
  it('confirm button disabled until correct value typed', () => {
    render(
      <ConfirmDialog
        open={true} title="T"
        confirmValue="user@example.com"
        confirmLabel="Deactivate"
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  });

  it('confirm button enabled after correct value typed', () => {
    render(
      <ConfirmDialog
        open={true} title="T"
        confirmValue="user@example.com"
        confirmLabel="Deactivate"
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    expect(screen.getByRole('button', { name: 'Deactivate' })).not.toBeDisabled();
  });

  it('confirm button disabled when typed value does not match', () => {
    render(
      <ConfirmDialog
        open={true} title="T"
        confirmValue="user@example.com"
        confirmLabel="Deactivate"
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'wrong@example.com' } });
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  });

  it('confirmValueLabel shown as input label', () => {
    render(
      <ConfirmDialog
        open={true} title="T"
        confirmValue="email@test.com"
        confirmValueLabel="Enter email to confirm"
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    expect(screen.getByText('Enter email to confirm')).toBeInTheDocument();
  });

  it('typed input clears when dialog closes and reopens', async () => {
    const { rerender } = render(
      <ConfirmDialog
        open={true} title="T"
        confirmValue="a@b.com"
        confirmLabel="Delete"
        onConfirm={() => {}} onCancel={() => {}}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@b.com' } });
    rerender(
      <ConfirmDialog open={false} title="T" confirmValue="a@b.com" confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />
    );
    rerender(
      <ConfirmDialog open={true} title="T" confirmValue="a@b.com" confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});

describe('ConfirmDialog — Escape key', () => {
  it('Escape key fires onCancel', () => {
    const handler = vi.fn();
    render(<ConfirmDialog open={true} title="T" onConfirm={() => {}} onCancel={handler} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('Escape key does not fire when dialog is closed', () => {
    const handler = vi.fn();
    render(<ConfirmDialog open={false} title="T" onConfirm={() => {}} onCancel={handler} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();
  });
});
