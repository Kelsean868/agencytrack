// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import SyncIndicator from '../SyncIndicator';

afterEach(() => {
  // restore navigator.onLine default
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('SyncIndicator', () => {
  it('renders nothing when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { container } = render(<SyncIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Offline banner when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<SyncIndicator />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows Offline banner after offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<SyncIndicator />);
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('hides Offline banner after online event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<SyncIndicator />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });
});
