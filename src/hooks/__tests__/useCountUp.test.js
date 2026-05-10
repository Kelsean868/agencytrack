import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCountUp } from '../useCountUp';

describe('useCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Route rAF through fake setTimeout so performance.now() advances with each tick.
    // Promise.resolve() microtasks keep performance.now() frozen → infinite loop.
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) =>
      setTimeout(() => cb(performance.now()), 16)
    );
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts at 0 and ends at target', async () => {
    const { result } = renderHook(() => useCountUp(100, { duration: 100 }));
    expect(result.current).toBe(0);

    // Let all rAF callbacks flush
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current).toBe(100);
  });

  it('returns 0 immediately when target is 0', () => {
    const { result } = renderHook(() => useCountUp(0));
    expect(result.current).toBe(0);
  });

  it('respects decimals parameter', async () => {
    const { result } = renderHook(() => useCountUp(3.14159, { duration: 10, decimals: 2 }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current).toBe(3.14);
  });

  it('cleans up on unmount without throwing', async () => {
    const { unmount } = renderHook(() => useCountUp(500, { duration: 500 }));
    expect(() => unmount()).not.toThrow();
  });

  it('transitions smoothly when target changes', async () => {
    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target, { duration: 100 }),
      { initialProps: { target: 100 } }
    );
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current).toBe(100);

    rerender({ target: 200 });
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current).toBe(200);
  });
});
