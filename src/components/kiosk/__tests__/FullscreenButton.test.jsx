import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FullscreenButton from '../FullscreenButton';

describe('FullscreenButton', () => {
  let listeners;

  beforeEach(() => {
    listeners = {};
    vi.spyOn(document, 'addEventListener').mockImplementation((event, cb) => {
      listeners[event] = cb;
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation(() => {});

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null,
    });

    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders when not in fullscreen', () => {
    render(<FullscreenButton />);
    expect(screen.getByRole('button', { name: /enter fullscreen/i })).toBeInTheDocument();
  });

  it('renders the Maximize2 icon', () => {
    render(<FullscreenButton />);
    const btn = screen.getByRole('button', { name: /enter fullscreen/i });
    expect(btn).toBeInTheDocument();
    // Lucide renders an SVG inside the button
    expect(btn.querySelector('svg')).not.toBeNull();
  });

  it('calls requestFullscreen on click', () => {
    render(<FullscreenButton />);
    fireEvent.click(screen.getByRole('button', { name: /enter fullscreen/i }));
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('hides when fullscreen becomes active', () => {
    render(<FullscreenButton />);
    expect(screen.getByRole('button', { name: /enter fullscreen/i })).toBeInTheDocument();

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => document.documentElement,
      });
      listeners['fullscreenchange']?.();
    });

    expect(screen.queryByRole('button', { name: /enter fullscreen/i })).toBeNull();
  });

  it('reappears when fullscreen exits', () => {
    render(<FullscreenButton />);

    // Enter fullscreen → hide
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => document.documentElement,
      });
      listeners['fullscreenchange']?.();
    });
    expect(screen.queryByRole('button', { name: /enter fullscreen/i })).toBeNull();

    // Exit fullscreen → reappear
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      });
      listeners['fullscreenchange']?.();
    });
    expect(screen.getByRole('button', { name: /enter fullscreen/i })).toBeInTheDocument();
  });
});
