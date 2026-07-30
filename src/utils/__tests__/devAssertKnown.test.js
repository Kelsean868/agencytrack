/**
 * devAssertKnown — dev-only reporting of a lookup miss (v3 rule 11).
 *
 * The contract that matters: it must NEVER change what the call site returns.
 * These tests pin both halves — the report fires on a miss, and the helper is
 * inert on a hit.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { devAssertKnown } from '../devAssertKnown';

const MAP = { PC: 1, SC: 2 };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('devAssertKnown', () => {
  it('reports a miss, naming the map and the key', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    devAssertKnown(MAP, 'NOPE', 'MAP');
    expect(spy).toHaveBeenCalledTimes(1);
    const [msg] = spy.mock.calls[0];
    expect(msg).toContain('MAP');
    expect(msg).toContain('"NOPE"');
  });

  it('is silent for a key that is present', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    devAssertKnown(MAP, 'PC', 'MAP');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns whether the key was known, so a caller may branch on it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(devAssertKnown(MAP, 'PC', 'MAP')).toBe(true);
    expect(devAssertKnown(MAP, 'NOPE', 'MAP')).toBe(false);
  });

  it('survives a null map without throwing (it must never break a render)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => devAssertKnown(null, 'PC', 'MAP')).not.toThrow();
    expect(devAssertKnown(null, 'PC', 'MAP')).toBe(false);
  });

  // The half the rest of this file cannot see: every other test runs with
  // import.meta.env.DEV true, so they only ever prove the reporting branch. The
  // helper's actual contract is that it is INERT in the production bundle — if
  // that broke, a console.error would ship to users at a lookup site reached
  // from their own data, and nothing here would have caught it.
  it('is inert in production — no report, same return value', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('DEV', false);
    expect(devAssertKnown(MAP, 'NOPE', 'MAP')).toBe(false);
    expect(devAssertKnown(MAP, 'PC', 'MAP')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not treat inherited Object properties as known keys', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // A bare `key in map` or `map[key]` check would call this a hit.
    expect(devAssertKnown(MAP, 'toString', 'MAP')).toBe(false);
  });
});
