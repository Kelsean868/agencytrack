// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, renderHook } from '@testing-library/react';
import ToastProvider from '../ToastProvider.jsx';
import useToast from '../../../hooks/useToast.js';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// Tiny consumer that exposes the hook's API via DOM buttons so tests can
// drive show/dismiss without renderHook ceremony for every case.
function Harness({ initialOptions }) {
  const { show, dismiss } = useToast();
  const [lastId, setLastId] = React.useState(null);
  return (
    <div>
      <button onClick={() => setLastId(show(initialOptions ?? { message: 'Hi' }))}>show</button>
      <button onClick={() => lastId && dismiss(lastId)}>dismiss-last</button>
      <button onClick={() => setLastId(show({ message: 'Success!', variant: 'success' }))}>show-success</button>
      <button onClick={() => setLastId(show({ message: 'Error!', variant: 'error' }))}>show-error</button>
      <button onClick={() => setLastId(show({ message: 'Sticky', duration: 0 }))}>show-sticky</button>
      <span data-testid="last-id">{lastId ?? ''}</span>
    </div>
  );
}

describe('ToastProvider — show()', () => {
  it('renders a toast when show() is called', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    expect(screen.queryByTestId('toast-stack')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('show'));
    expect(screen.getByTestId('toast-stack')).toBeInTheDocument();
    expect(screen.getByText('Hi')).toBeInTheDocument();
  });

  it('returns a toast id', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show'));
    const id = screen.getByTestId('last-id').textContent;
    expect(id).toMatch(/^toast_/);
  });

  it('renders multiple toasts simultaneously', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show-success'));
    fireEvent.click(screen.getByText('show-error'));
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('defaults variant to info when none provided', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show'));
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
  });

  it('uses provided variant', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show-success'));
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
  });
});

describe('ToastProvider — auto-dismiss', () => {
  it('removes toast from stack after duration expires', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show')); // default 3000ms
    expect(screen.getByText('Hi')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Hi')).not.toBeInTheDocument();
  });

  it('sticky toast (duration=0) is not auto-removed', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show-sticky'));
    expect(screen.getByText('Sticky')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Sticky')).toBeInTheDocument();
  });
});

describe('ToastProvider — dismiss()', () => {
  it('programmatic dismiss removes the toast', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show-sticky'));
    expect(screen.getByText('Sticky')).toBeInTheDocument();
    fireEvent.click(screen.getByText('dismiss-last'));
    expect(screen.queryByText('Sticky')).not.toBeInTheDocument();
  });

  it('X button removes the toast', () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    fireEvent.click(screen.getByText('show-sticky'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Sticky')).not.toBeInTheDocument();
  });
});

describe('ToastProvider — queue cap', () => {
  it('FIFO-evicts the oldest toast when cap exceeded (max=3 default)', () => {
    function MultiHarness() {
      const { show } = useToast();
      return (
        <button
          onClick={() => {
            show({ message: 'A', duration: 0 });
            show({ message: 'B', duration: 0 });
            show({ message: 'C', duration: 0 });
            show({ message: 'D', duration: 0 });
          }}
        >
          fire-four
        </button>
      );
    }
    render(<ToastProvider><MultiHarness /></ToastProvider>);
    fireEvent.click(screen.getByText('fire-four'));
    expect(screen.queryByText('A')).not.toBeInTheDocument(); // evicted
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('respects the `max` prop override', () => {
    function MultiHarness() {
      const { show } = useToast();
      return (
        <button
          onClick={() => {
            show({ message: 'X', duration: 0 });
            show({ message: 'Y', duration: 0 });
          }}
        >
          fire-two
        </button>
      );
    }
    render(<ToastProvider max={1}><MultiHarness /></ToastProvider>);
    fireEvent.click(screen.getByText('fire-two'));
    expect(screen.queryByText('X')).not.toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
  });
});

describe('useToast — without provider', () => {
  it('throws a clear error when used outside <ToastProvider>', () => {
    // suppress React's error logging for this expected throw
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      /useToast must be used inside a <ToastProvider>/
    );
    spy.mockRestore();
  });
});
