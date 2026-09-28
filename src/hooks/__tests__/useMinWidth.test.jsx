/**
 * useMinWidth — lazy synchronous first read, live updates, jsdom fallback.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import useMinWidth from '../useMinWidth';

function Probe({ px, onRender }) {
  const wide = useMinWidth(px);
  onRender?.(wide);
  return <span data-testid="wide">{String(wide)}</span>;
}

/** A controllable matchMedia: `width` decides matches; `resize(w)` fires change. */
function stubMatchMedia(initialWidth) {
  let width = initialWidth;
  const lists = [];
  const matchMedia = vi.fn((q) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(q)[1]);
    const listeners = new Set();
    const mql = {
      media: q,
      get matches() { return width >= min; },
      addEventListener: vi.fn((_, fn) => listeners.add(fn)),
      removeEventListener: vi.fn((_, fn) => listeners.delete(fn)),
      fire() { listeners.forEach((fn) => fn({ matches: width >= min })); },
      listeners,
    };
    lists.push(mql);
    return mql;
  });
  vi.stubGlobal('matchMedia', matchMedia);
  window.matchMedia = matchMedia;
  return {
    matchMedia,
    lists,
    resize(w) { width = w; lists.forEach((l) => l.fire()); },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.matchMedia;
});

describe('useMinWidth', () => {
  it('is false when matchMedia is absent (jsdom)', () => {
    delete window.matchMedia;
    render(<Probe px={768} />);
    expect(screen.getByTestId('wide')).toHaveTextContent('false');
  });

  it('reads the wide state on the FIRST render (no narrow flash)', () => {
    stubMatchMedia(1440);
    const seen = [];
    render(<Probe px={768} onRender={(w) => seen.push(w)} />);
    expect(seen[0]).toBe(true);
    expect(seen.every(Boolean)).toBe(true);
  });

  it('is false below the width, and follows a resize across the boundary', () => {
    const mm = stubMatchMedia(390);
    render(<Probe px={768} />);
    expect(screen.getByTestId('wide')).toHaveTextContent('false');
    act(() => mm.resize(900));
    expect(screen.getByTestId('wide')).toHaveTextContent('true');
    act(() => mm.resize(767));
    expect(screen.getByTestId('wide')).toHaveTextContent('false');
  });

  it('removes its listener on unmount', () => {
    const mm = stubMatchMedia(1000);
    const { unmount } = render(<Probe px={768} />);
    const withListener = mm.lists.filter((l) => l.listeners.size > 0);
    expect(withListener).toHaveLength(1);
    unmount();
    expect(mm.lists.every((l) => l.listeners.size === 0)).toBe(true);
  });
});
