// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import Toast from '../Toast.jsx';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('Toast — rendering', () => {
  it('renders the message', () => {
    render(<Toast id="t1" message="Hello" onDismiss={() => {}} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('defaults to info variant when none provided', () => {
    render(<Toast id="t1" message="Hi" onDismiss={() => {}} />);
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
  });

  it('applies success variant testid', () => {
    render(<Toast id="t1" message="Saved" variant="success" onDismiss={() => {}} />);
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
  });

  it('applies error variant testid', () => {
    render(<Toast id="t1" message="Failed" variant="error" onDismiss={() => {}} />);
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
  });

  it('applies warning variant testid', () => {
    render(<Toast id="t1" message="Heads up" variant="warning" onDismiss={() => {}} />);
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
  });
});

describe('Toast — ARIA semantics', () => {
  it('success uses role="status" and aria-live="polite"', () => {
    render(<Toast id="t1" message="Done" variant="success" onDismiss={() => {}} />);
    const node = screen.getByRole('status');
    expect(node).toHaveAttribute('aria-live', 'polite');
  });

  it('info uses role="status" and aria-live="polite"', () => {
    render(<Toast id="t1" message="FYI" variant="info" onDismiss={() => {}} />);
    const node = screen.getByRole('status');
    expect(node).toHaveAttribute('aria-live', 'polite');
  });

  it('error uses role="alert" and aria-live="assertive"', () => {
    render(<Toast id="t1" message="Oops" variant="error" onDismiss={() => {}} />);
    const node = screen.getByRole('alert');
    expect(node).toHaveAttribute('aria-live', 'assertive');
  });

  it('warning uses role="alert" and aria-live="assertive"', () => {
    render(<Toast id="t1" message="Watch out" variant="warning" onDismiss={() => {}} />);
    const node = screen.getByRole('alert');
    expect(node).toHaveAttribute('aria-live', 'assertive');
  });
});

describe('Toast — auto-dismiss', () => {
  it('calls onDismiss with id after duration ms', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t1" message="Bye" duration={1500} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('does not auto-dismiss when duration is 0 (sticky)', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t1" message="Sticky" duration={0} onDismiss={onDismiss} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('clears the timer on unmount', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Toast id="t1" message="X" duration={3000} onDismiss={onDismiss} />);
    unmount();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Toast — manual dismiss', () => {
  it('X button calls onDismiss with id', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t1" message="Click me away" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });
});

describe('Toast — action', () => {
  it('renders the action button when action is provided', () => {
    render(
      <Toast
        id="t1"
        message="Saved"
        action={{ label: 'Undo', onClick: () => {} }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('action button click fires action.onClick and dismisses', () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    render(
      <Toast
        id="t1"
        message="Saved"
        action={{ label: 'Undo', onClick: onAction }}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('does not render an action button when action is omitted', () => {
    render(<Toast id="t1" message="Plain" onDismiss={() => {}} />);
    // Only the Dismiss button should be present
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
