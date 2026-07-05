// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ChunkLoadErrorBoundary from '../ChunkLoadErrorBoundary';

// A child that throws during render — simulates a rejected lazy import()
// (ChunkLoadError) surfacing to the boundary.
function Boom() {
  throw new Error('Failed to fetch dynamically imported module');
}

describe('ChunkLoadErrorBoundary', () => {
  let errorSpy;
  beforeEach(() => {
    // React logs caught render errors to console.error; silence it to keep test
    // output clean. componentDidCatch also logs — asserted below.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders children normally when there is no error', () => {
    render(
      <ChunkLoadErrorBoundary>
        <div data-testid="child-ok">loaded</div>
      </ChunkLoadErrorBoundary>,
    );
    expect(screen.getByTestId('child-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('state-chunk-error')).toBeNull();
  });

  it('renders the themed reload fallback (not a crash) when a child throws', () => {
    render(
      <ChunkLoadErrorBoundary>
        <Boom />
      </ChunkLoadErrorBoundary>,
    );
    // The fallback rendered instead of the error propagating (white screen).
    expect(screen.getByTestId('state-chunk-error')).toBeInTheDocument();
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    // Reload affordance present.
    expect(screen.getByTestId('chunk-error-reload')).toBeInTheDocument();
    // componentDidCatch logged the error (our message + React's own logging).
    expect(errorSpy).toHaveBeenCalled();
  });

  it('the Reload button triggers a FULL window.location.reload()', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    render(
      <ChunkLoadErrorBoundary>
        <Boom />
      </ChunkLoadErrorBoundary>,
    );
    fireEvent.click(screen.getByTestId('chunk-error-reload'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
