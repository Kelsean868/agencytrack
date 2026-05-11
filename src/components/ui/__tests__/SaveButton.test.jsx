// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import SaveButton from '../SaveButton.jsx';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('SaveButton — idle state', () => {
  it('renders idle label', () => {
    render(<SaveButton label="Save Changes" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();
  });

  it('uses "Save" as default label', () => {
    render(<SaveButton onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeInTheDocument();
  });

  it('renders icon alongside label in idle state', () => {
    render(<SaveButton onClick={() => {}} label="Save" icon={<span data-testid="save-icon" />} />);
    expect(screen.getByTestId('save-icon')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const handler = vi.fn();
    render(<SaveButton onClick={handler} label="Save" />);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('SaveButton — saving state', () => {
  it('shows savingLabel when saving=true', () => {
    render(<SaveButton saving={true} savingLabel="Saving…" onClick={() => {}} />);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('button is disabled when saving=true', () => {
    render(<SaveButton saving={true} onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not fire onClick when disabled', () => {
    const handler = vi.fn();
    render(<SaveButton disabled={true} onClick={handler} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SaveButton — saved state', () => {
  it('shows savedLabel immediately after savedAt is set', () => {
    const { rerender } = render(<SaveButton savedAt={null} onClick={() => {}} savedLabel="Saved" />);
    rerender(<SaveButton savedAt={new Date()} onClick={() => {}} savedLabel="Saved" />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('reverts to idle label after 3 seconds', async () => {
    const { rerender } = render(<SaveButton savedAt={null} label="Save" onClick={() => {}} />);
    rerender(<SaveButton savedAt={new Date()} label="Save" onClick={() => {}} />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('saved state does not appear when saving=true (saving overrides)', () => {
    render(<SaveButton saving={true} savedAt={new Date()} savingLabel="Saving…" onClick={() => {}} />);
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('saved state clears when savedAt resets to null', async () => {
    const { rerender } = render(<SaveButton savedAt={new Date()} label="Save" onClick={() => {}} />);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    rerender(<SaveButton savedAt={null} label="Save" onClick={() => {}} />);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});

describe('SaveButton — error display', () => {
  it('renders error text below button when error provided', () => {
    render(<SaveButton error="Network error" onClick={() => {}} label="Save" />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('error is not rendered when error is null', () => {
    render(<SaveButton error={null} onClick={() => {}} label="Save" />);
    expect(screen.queryByText('Network error')).toBeNull();
  });

  it('error element is a <p>', () => {
    const { container } = render(<SaveButton error="Oops" onClick={() => {}} />);
    const p = container.querySelector('p');
    expect(p).not.toBeNull();
    expect(p.textContent).toBe('Oops');
  });
});

describe('SaveButton — custom labels', () => {
  it('respects custom savingLabel', () => {
    render(<SaveButton saving={true} savingLabel="Please wait…" onClick={() => {}} />);
    expect(screen.getByText('Please wait…')).toBeInTheDocument();
  });

  it('respects custom savedLabel', () => {
    render(<SaveButton savedAt={new Date()} savedLabel="Goals saved!" onClick={() => {}} />);
    expect(screen.getByText('Goals saved!')).toBeInTheDocument();
  });
});

describe('SaveButton — className', () => {
  it('applies className to the wrapper div', () => {
    const { container } = render(<SaveButton onClick={() => {}} className="self-start" />);
    expect(container.firstChild).toHaveClass('self-start');
  });
});
