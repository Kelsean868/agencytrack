/**
 * activityLogService — the in-memory activity log.
 *
 * The 60-entry cap is the one behaviour with a stated source
 * (`01-ARCHITECTURE.md` §2), so it is pinned exactly rather than approximately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { log, getEntries, clearEntries, MAX_ENTRIES } from '../activityLogService';

beforeEach(() => clearEntries());

describe('log()', () => {
  it('appends an entry with type, message, an id and a timestamp', () => {
    const before = Date.now();
    const entry = log('commit', 'Saved the week plan');
    const after = Date.now();

    expect(entry).toMatchObject({ type: 'commit', message: 'Saved the week plan' });
    expect(typeof entry.id).toBe('number');
    expect(entry.at).toBeGreaterThanOrEqual(before);
    expect(entry.at).toBeLessThanOrEqual(after);
  });

  it('returns entries NEWEST-first', () => {
    log('a', 'first');
    log('b', 'second');
    log('c', 'third');
    expect(getEntries().map((e) => e.message)).toEqual(['third', 'second', 'first']);
  });

  it('gives every entry a distinct id', () => {
    for (let i = 0; i < 10; i += 1) log('t', `m${i}`);
    const ids = getEntries().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('coerces nullish type/message to strings rather than storing null', () => {
    const entry = log(undefined, null);
    expect(entry.type).toBe('');
    expect(entry.message).toBe('');
  });
});

describe('the 60-entry cap (01-ARCHITECTURE.md §2)', () => {
  it('MAX_ENTRIES is 60', () => {
    expect(MAX_ENTRIES).toBe(60);
  });

  it('holds exactly 60 after 61 appends, dropping the OLDEST', () => {
    for (let i = 1; i <= 61; i += 1) log('t', `entry-${i}`);

    const all = getEntries();
    expect(all).toHaveLength(60);
    expect(all[0].message).toBe('entry-61');   // newest kept
    expect(all[59].message).toBe('entry-2');   // entry-1 fell off
    expect(all.map((e) => e.message)).not.toContain('entry-1');
  });

  it('stays capped under sustained appends, not just one over', () => {
    for (let i = 0; i < 500; i += 1) log('t', `m${i}`);
    expect(getEntries()).toHaveLength(60);
  });
});

describe('buffer isolation', () => {
  it('getEntries returns a new ARRAY — pushing into it cannot inject an entry', () => {
    log('t', 'original');
    const snapshot = getEntries();
    snapshot.push({ id: 999, type: 'injected', message: 'nope', at: 0 });

    expect(getEntries()).toHaveLength(1);
  });

  // An activity log whose entries can be edited after the fact is not evidence.
  // Entries are frozen, so a rewrite attempt THROWS (ESM is strict mode) rather
  // than silently succeeding — which is what a shallow copy alone would allow.
  it('entries are FROZEN — a logged message cannot be rewritten in place', () => {
    log('t', 'original');
    const [entry] = getEntries();

    expect(Object.isFrozen(entry)).toBe(true);
    expect(() => { entry.message = 'mutated'; }).toThrow(TypeError);
    expect(getEntries()[0].message).toBe('original');
  });

  it('clearEntries empties the buffer', () => {
    log('t', 'x');
    clearEntries();
    expect(getEntries()).toEqual([]);
  });
});
